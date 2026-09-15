"""
Fleet optimisation using OR-Tools CP-SAT solver (with graceful fallback).
Constraints: capacity, availability, location, temperature, priority.
"""
from typing import List, Dict, Optional
import math

# OR-Tools is optional — falls back to greedy heuristic if unavailable
try:
    from ortools.sat.python import cp_model as _cp_model
    _ORTOOLS_AVAILABLE = True
except ImportError:
    _ORTOOLS_AVAILABLE = False
    _cp_model = None  # type: ignore


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def optimise_fleet(
    vehicles: List[Dict],       # {id, code, type, cap_tonnes, cap_teu, port_lat, port_lng,
                                 #  status, has_cold_chain, utilisation_pct, port_code}
    shipments: List[Dict],       # {id, tracking_id, weight_tonnes, requires_cold_chain,
                                 #  priority, value_usd, dest_lat, dest_lng, dest_code,
                                 #  origin_code, origin_lat, origin_lng}
    available_routes: List[Dict],# {id, code, origin, dest, days, cost, mode}
    objective: str = "minimize_delay",
) -> List[Dict]:
    """
    Returns list of assignment recommendations.
    Uses OR-Tools CP-SAT when available, otherwise greedy heuristic.
    """
    if not vehicles or not shipments:
        return []

    avail_vehicles = [v for v in vehicles if v["status"] == "available"]
    if not avail_vehicles:
        return []

    if _ORTOOLS_AVAILABLE:
        return _optimise_cpsat(avail_vehicles, shipments, available_routes, objective)
    else:
        return _optimise_greedy(avail_vehicles, shipments, available_routes, objective)


def _optimise_cpsat(
    avail_vehicles: List[Dict],
    shipments: List[Dict],
    routes: List[Dict],
    objective: str,
) -> List[Dict]:
    """OR-Tools CP-SAT optimisation."""
    cp_model = _cp_model

    SCALE = 100
    n_v = len(avail_vehicles)
    n_s = len(shipments)

    model = cp_model.CpModel()

    # Binary: x[v][s] = 1 if vehicle v handles shipment s
    x = [[model.NewBoolVar(f"x_{v}_{s}") for s in range(n_s)] for v in range(n_v)]

    # Each shipment assigned to at most one vehicle
    for s in range(n_s):
        model.AddAtMostOne(x[v][s] for v in range(n_v))

    # Capacity constraint (weight)
    for v_idx, veh in enumerate(avail_vehicles):
        cap = int(veh["cap_tonnes"] * SCALE)
        assigned_weight = sum(
            x[v_idx][s] * int(shipments[s]["weight_tonnes"] * SCALE)
            for s in range(n_s)
        )
        model.Add(assigned_weight <= cap)

    # Cold chain constraint
    for v_idx, veh in enumerate(avail_vehicles):
        if not veh["has_cold_chain"]:
            for s_idx, shp in enumerate(shipments):
                if shp["requires_cold_chain"]:
                    model.Add(x[v_idx][s_idx] == 0)

    # Objective: weighted assignment score
    priority_weights = {1: 100, 2: 60, 3: 30, 4: 10}
    scores = []
    for v_idx, veh in enumerate(avail_vehicles):
        for s_idx, shp in enumerate(shipments):
            pw = priority_weights.get(shp.get("priority", 3), 30)
            v_lat = veh.get("port_lat", 18.92)
            v_lng = veh.get("port_lng", 72.83)
            s_lat = shp.get("origin_lat", 18.92)
            s_lng = shp.get("origin_lng", 72.83)
            dist = haversine_km(v_lat, v_lng, s_lat, s_lng)
            dist_penalty = min(int(dist / 100), 20)
            util_bonus = max(0, int((100 - veh.get("utilisation_pct", 50)) / 10))
            score = pw + util_bonus - dist_penalty
            scores.append(score * x[v_idx][s_idx])

    model.Maximize(sum(scores))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)

    recommendations = []
    FEASIBLE = cp_model.FEASIBLE
    OPTIMAL = cp_model.OPTIMAL
    if status in (OPTIMAL, FEASIBLE):
        for v_idx, veh in enumerate(avail_vehicles):
            assigned_shp_ids = []
            total_weight = 0.0
            for s_idx, shp in enumerate(shipments):
                if solver.Value(x[v_idx][s_idx]) == 1:
                    assigned_shp_ids.append(shp["id"])
                    total_weight += shp["weight_tonnes"]
            if not assigned_shp_ids:
                continue
            recommendations.append(
                _build_recommendation(veh, assigned_shp_ids, total_weight, shipments, routes, objective)
            )

    return recommendations


def _optimise_greedy(
    avail_vehicles: List[Dict],
    shipments: List[Dict],
    routes: List[Dict],
    objective: str,
) -> List[Dict]:
    """
    Greedy fallback: sort shipments by priority, assign to best-fit vehicle
    (cold-chain first, then largest available capacity).
    """
    priority_weights = {1: 100, 2: 60, 3: 30, 4: 10}
    sorted_shp = sorted(shipments, key=lambda s: s.get("priority", 3))

    # Track remaining capacity per vehicle
    vehicle_remaining = {v["id"]: v["cap_tonnes"] for v in avail_vehicles}
    vehicle_assignments: Dict[int, List[int]] = {v["id"]: [] for v in avail_vehicles}
    vehicle_weight: Dict[int, float] = {v["id"]: 0.0 for v in avail_vehicles}

    for shp in sorted_shp:
        best_vehicle = None
        best_score = -1
        for veh in avail_vehicles:
            vid = veh["id"]
            # Cold-chain check
            if shp["requires_cold_chain"] and not veh["has_cold_chain"]:
                continue
            # Capacity check
            if vehicle_remaining[vid] < shp["weight_tonnes"]:
                continue
            # Score: priority + proximity bonus + low utilisation bonus
            pw = priority_weights.get(shp.get("priority", 3), 30)
            dist = haversine_km(
                veh.get("port_lat", 18.92), veh.get("port_lng", 72.83),
                shp.get("origin_lat", 18.92), shp.get("origin_lng", 72.83)
            )
            dist_penalty = min(dist / 100, 20)
            util_bonus = max(0, (100 - veh.get("utilisation_pct", 50)) / 10)
            score = pw + util_bonus - dist_penalty
            if score > best_score:
                best_score = score
                best_vehicle = veh

        if best_vehicle:
            vid = best_vehicle["id"]
            vehicle_assignments[vid].append(shp["id"])
            vehicle_remaining[vid] -= shp["weight_tonnes"]
            vehicle_weight[vid] += shp["weight_tonnes"]

    recommendations = []
    for veh in avail_vehicles:
        vid = veh["id"]
        assigned_shp_ids = vehicle_assignments[vid]
        if not assigned_shp_ids:
            continue
        total_weight = vehicle_weight[vid]
        recommendations.append(
            _build_recommendation(veh, assigned_shp_ids, total_weight, shipments, routes, objective)
        )

    return recommendations


def _build_recommendation(
    veh: Dict,
    assigned_shp_ids: List[int],
    total_weight: float,
    shipments: List[Dict],
    routes: List[Dict],
    objective: str,
) -> Dict:
    priority_weights = {1: 100, 2: 60, 3: 30, 4: 10}
    cap_match = round(min(total_weight / max(veh["cap_tonnes"], 1) * 100, 100), 1)
    best_route = _pick_best_route(veh, shipments, assigned_shp_ids, routes, objective)

    priority_score = sum(
        priority_weights.get(shp.get("priority", 3), 30)
        for shp in shipments if shp["id"] in assigned_shp_ids
    ) / max(len(assigned_shp_ids), 1)

    cost_delta = best_route["cost"] * len(assigned_shp_ids) if best_route else 0
    time_delta = best_route.get("days", 0) * 24 if best_route else 0

    cold_needed = any(
        shp["requires_cold_chain"] for shp in shipments if shp["id"] in assigned_shp_ids
    )
    rationale = _build_rationale(veh, assigned_shp_ids, cap_match, best_route, cold_needed)
    solver_tag = "OR-Tools CP-SAT" if _ORTOOLS_AVAILABLE else "Greedy Heuristic"

    return {
        "vehicle_id": veh["id"],
        "shipment_ids": assigned_shp_ids,
        "route_id": best_route["id"] if best_route else None,
        "action": "redeploy",
        "priority_score": round(priority_score, 1),
        "capacity_match_pct": cap_match,
        "cost_delta_usd": round(cost_delta, 2),
        "time_delta_hours": round(time_delta, 1),
        "rationale": f"[{solver_tag}] {rationale}",
    }


def _pick_best_route(vehicle: Dict, shipments: List[Dict], shp_ids: List[int],
                     routes: List[Dict], objective: str) -> Optional[Dict]:
    vport = vehicle.get("port_code", "")
    dest_codes = {
        shp.get("dest_code", "") for shp in shipments if shp["id"] in shp_ids
    }
    candidates = [r for r in routes if r["origin"] == vport and r["dest"] in dest_codes]
    if not candidates:
        candidates = routes[:3]
    if not candidates:
        return None
    if objective == "minimize_delay":
        return min(candidates, key=lambda r: r["days"])
    elif objective == "minimize_cost":
        return min(candidates, key=lambda r: r["cost"])
    else:
        max_days = max(r["days"] for r in candidates) or 1
        max_cost = max(r["cost"] for r in candidates) or 1
        return min(candidates, key=lambda r: r["days"] / max_days + r["cost"] / max_cost)


def _build_rationale(vehicle: Dict, shp_ids: List[int], cap_match: float,
                     route: Optional[Dict], cold_needed: bool) -> str:
    parts = [
        f"{vehicle['code']} ({vehicle['type']}) assigned {len(shp_ids)} shipment(s).",
        f"Capacity utilisation: {cap_match:.0f}%.",
    ]
    if cold_needed:
        parts.append("Cold-chain capability confirmed.")
    if route:
        parts.append(
            f"Recommended route: {route.get('code', 'N/A')} via {route.get('mode', 'sea')}, "
            f"{route['days']} days, cost factor ${route['cost']:,.0f}/unit."
        )
    else:
        parts.append("No pre-defined route available; ad-hoc routing required.")
    return " ".join(parts)
