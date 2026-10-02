from ortools.sat.python import cp_model
import json
import math
import os
import sys
import tempfile

# Usage: python solver_minimal.py input.json [output.json]
# input.json = {"groups": [...], "places": [...], "city_conflicts": [[a, b], ...], "options": {...}}

DEFAULT_OPTIONS = {
    "weight_group_proximity": 1.0,   # goal 1
    "weight_event_distance": 1.0,    # goal 2
    "weight_conflict": 1.0,          # goal 3
    "far_penalty": 50_000,
    "share_penalty_multiplier": 50,
    "max_nearby_distance": 5000,     # cross-gender "near" pairs (meters)
    "near_place_distance": 1500,     # conflicting-city "near" places (meters)
    "time_limit_seconds": 120,
    "relative_gap_limit": 0.01,
    "num_workers": 4,
    "max_memory_mb": 8_000,
    "symmetry_level": 3,
    "checkpoint_path": "last_solution.json",
}


class SolutionCheckpoint(cp_model.CpSolverSolutionCallback):
    def __init__(self, assignments, filepath):
        super().__init__()

        self.assignments = assignments
        self.filepath = filepath

        self.solution_count = 0
        self.best_objective = float("inf")

    def on_solution_callback(self):
        objective = self.objective_value

        if self.best_objective != float("inf"):
            improvement = (
                self.best_objective - objective
            ) / self.best_objective

            if improvement < 0.001:
                return
        
        solution = {}

        for (group_id, gender, place_id), var in self.assignments.items():
            if self.boolean_value(var):
                solution[f"{group_id}:{gender}"] = place_id

        data = {
            "objective": objective,
            "wall_time": self.wall_time,
            "solution_count": self.solution_count + 1,
            "assignments": solution,
        }

        self._save(data)

        self.solution_count += 1
        self.best_objective = objective

        print(
            f"CHECKPOINT #{self.solution_count} "
            f"objective={objective:.0f}"
        )

    def _save(self, data):
        # Write to a temporary file first, then replace the real file.
        # This prevents a crash halfway through writing from corrupting
        # the checkpoint.
        directory = os.path.dirname(self.filepath) or "."

        fd, temp_path = tempfile.mkstemp(
            dir=directory,
            prefix=".solution_",
            suffix=".tmp"
        )

        try:
            with os.fdopen(fd, "w") as f:
                json.dump(data, f)

                # Make Python flush the data to the OS.
                f.flush()
                os.fsync(f.fileno())

            # Atomic replacement
            os.replace(temp_path, self.filepath)

        except Exception:
            try:
                os.remove(temp_path)
            except OSError:
                pass
            raise


# ---------------------------------------------------------------------------
# NEW: load data + options from JSON (replaces the hardcoded data block)
# ---------------------------------------------------------------------------
input_path = sys.argv[1]
output_path = sys.argv[2] if len(sys.argv) > 2 else "assignments.json"

with open(input_path, encoding="utf-8") as f:
    input_data = json.load(f)

options = dict(DEFAULT_OPTIONS)
user_options = input_data.get("options", {})
unknown = set(user_options) - set(DEFAULT_OPTIONS)
if unknown:
    raise ValueError(f"Unknown options: {sorted(unknown)}. Valid: {sorted(DEFAULT_OPTIONS)}")
options.update(user_options)

groups = input_data["groups"]
places = input_data["places"]
city_conflicts = [tuple(pair) for pair in input_data.get("city_conflicts", [])]
GENDERS = ['men', 'women']

# ---------------------------------------------------------------------------
# NEW: derived data (previously pasted into the script)
# ---------------------------------------------------------------------------
def distance_m(a, b):
    # haversine distance in meters
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dphi = p2 - p1
    dlmb = math.radians(b["lng"] - a["lng"])
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * 6_371_000.0 * math.asin(math.sqrt(h))

groups_by_city = {}
for g in groups:
    groups_by_city.setdefault(g["origin_city"], []).append(g)

near_place_pairs = []
near_cross_gender_pairs = []
for i in range(len(places)):
    for j in range(i + 1, len(places)):
        a, b = places[i], places[j]
        d = distance_m(a, b)
        if d <= options["near_place_distance"]:
            near_place_pairs.append((a["id"], b["id"]))
        if a["type"] != b["type"] and d <= options["max_nearby_distance"]:
            men, women = (a, b) if a["type"] == "men" else (b, a)
            near_cross_gender_pairs.append((men["id"], women["id"], d))

max_event_distance = max(p["event_distance"] for p in places)
max_group_size = max(max(g["men"], g["women"]) for g in groups)
max_city_distance = max(g["origin_city_distance"] for g in groups)

_lats = [p["lat"] for p in places]
_lngs = [p["lng"] for p in places]
_m_per_deg = 111_320.0
max_manhattan_span_m = (
    (max(_lats) - min(_lats)) * _m_per_deg
    + (max(_lngs) - min(_lngs)) * _m_per_deg * math.cos(math.radians(sum(_lats) / len(_lats)))
)


NORMALIZED_SCALE = 1_000_000

WEIGHT_GROUP_PROXIMITY = options["weight_group_proximity"]   # goal 1
WEIGHT_EVENT_DISTANCE = options["weight_event_distance"]    # goal 2
WEIGHT_CONFLICT = options["weight_conflict"]          # goal 3

FAR_PENALTY = options["far_penalty"]
goal1_scale = NORMALIZED_SCALE * WEIGHT_GROUP_PROXIMITY / max_manhattan_span_m
far_cost = int(round(goal1_scale * FAR_PENALTY))

max_goal2_raw = max_event_distance * max_group_size * max_city_distance
goal2_scale = NORMALIZED_SCALE * WEIGHT_EVENT_DISTANCE / max_goal2_raw

SHARE_PENALTY_MULTIPLIER = options["share_penalty_multiplier"]   # sharing a place costs ~50x a mere "too close" violation
goal3_cost = int(round(NORMALIZED_SCALE * WEIGHT_CONFLICT))
share_cost = goal3_cost * SHARE_PENALTY_MULTIPLIER

    
model = cp_model.CpModel()

print("Making Search Space")
assignments = {}
# Group x Gender x Places = Maximum number of assignment Booleans
# 500   x 2      x 200    = 200,000
# It would be way less in real life tho
for g in groups:
    for gender in GENDERS:
        if g[gender] <= 0:
            continue
        for place in places:
            if place["type"] != gender:
                continue
            if place["capacity"] < g[gender]:
                continue
            var = model.new_bool_var(f'{gender}_g{g["id"]}_p{place["id"]}')
            assignments[(g["id"], gender, place["id"])] = var
print(f"Assignment variables: {len(assignments):,}\n")

print("Adding Constrains")
print("Constrain 1. each sub-group should be assigned at exactly one location")
for g in groups:
    for gender in GENDERS:
        variables = []
        for (groupId, assignment_gender, placeId), variable in assignments.items():
            if g["id"] != groupId or gender != assignment_gender:
                continue
            variables.append(variable)
        if len(variables):
            model.add_exactly_one(variables)
            
print("Constrain 2. Sum of people in a place cannot exceed place's capacity")
for place in places:
    count_at_place = []
    for g in groups:
        if (g["id"], place["type"], place["id"]) in assignments:
            # We are saying if the assignment is true then count the sub-group
            does_stay = assignments[(g["id"], place["type"], place["id"])]
            count = does_stay * g[place["type"]]
            count_at_place.append(count)
    model.add(sum(count_at_place) <= place["capacity"])
print("Done adding Constrains\n")


print("Making Objective Terms")
objective_terms = []
print("Goal 1. keep sub-groups of a group near each other")
for g in groups:
    if g["men"] <= 0 or g["women"] <= 0:
        continue

    nearby_pairs = []
    for men_id, women_id, separation_distance in near_cross_gender_pairs:
        key_m = (g["id"], "men", men_id)
        key_w = (g["id"], "women", women_id)
        if key_m not in assignments or key_w not in assignments:
            continue
        together = model.new_bool_var(f"g{g['id']}_male{men_id}_female{women_id}")
        model.add_multiplication_equality(together, [assignments[key_m], assignments[key_w]])
        nearby_pairs.append(together)
        objective_terms.append(int(round(goal1_scale * separation_distance)) * together)

    too_far = model.new_bool_var(f"g{g['id']}_too_far")
    model.add(too_far + sum(nearby_pairs) == 1)
    objective_terms.append(far_cost * too_far)

print("Goal 2. Keep larger groups that came from far-away cities near event")
for group in groups:
    for gender in GENDERS:
        for place in places:
            key = (group["id"], gender, place["id"])
            if key not in assignments:
                continue
            variable = assignments[key]
            raw_cost = place['event_distance'] * group[gender] * group["origin_city_distance"]
            cost = int(round(raw_cost * goal2_scale))
            objective_terms.append(cost * variable)

print("Goal 3. keep conflicting cities away from each other")
for city_a, city_b in city_conflicts:
    for group1 in groups_by_city.get(city_a, []):
        for group2 in groups_by_city.get(city_b, []):
            for gender1 in GENDERS:
                if group1[gender1] <= 0:
                    continue
                for gender2 in GENDERS:
                    if group2[gender2] <= 0:
                        continue
                    for id_a, id_b in near_place_pairs:
                        for pa, pb in ((id_a, id_b), (id_b, id_a)):
                            key1 = (group1["id"], gender1, pa)
                            key2 = (group2["id"], gender2, pb)
                            if key1 not in assignments or key2 not in assignments:
                                continue
                            z = model.new_bool_var(f'conflict_g{group1["id"]}{gender1}p{pa}_g{group2["id"]}{gender2}p{pb}')
                            model.add_multiplication_equality(z, [assignments[key1], assignments[key2]])
                            objective_terms.append(goal3_cost * z)

print("Goal 3b. keep conflicting cities groups from sharing a place")
for city_a, city_b in city_conflicts:
    for group1 in groups_by_city.get(city_a, []):
        for group2 in groups_by_city.get(city_b, []):
            for gender in GENDERS:
                if group1[gender] <= 0 or group2[gender] <= 0:
                    continue
                for place in places:
                    if place["type"] != gender:
                        continue
                    key1 = (group1["id"], gender, place["id"])
                    key2 = (group2["id"], gender, place["id"])
                    if key1 in assignments and key2 in assignments:
                        z = model.new_bool_var(f'share_g{group1["id"]}_g{group2["id"]}_{gender}_p{place["id"]}')
                        model.add_multiplication_equality(z, [assignments[key1], assignments[key2]])
                        objective_terms.append(share_cost * z)
                        
model.minimize(sum(objective_terms))
print("Done Making Objective Terms\n")


print("Solving ....")
solver = cp_model.CpSolver()
solver.parameters.log_search_progress = True
solver.parameters.relative_gap_limit = options["relative_gap_limit"]
solver.parameters.max_time_in_seconds = options["time_limit_seconds"]
solver.parameters.symmetry_level = options["symmetry_level"]
solver.parameters.max_memory_in_mb = options["max_memory_mb"]
solver.parameters.num_workers = options["num_workers"]
checkpoint = SolutionCheckpoint(
    assignments,
    options["checkpoint_path"]
)
status = solver.solve(model, checkpoint)
print('Done solving', status)

if status == cp_model.OPTIMAL:
    print("Optimal solution found!")
elif status == cp_model.FEASIBLE:
    print("Feasible solution found (within time limit)")
elif status == cp_model.INFEASIBLE:
    print("Model is infeasible! Not enough capacity or constraints too tight")
elif status == cp_model.MODEL_INVALID:
    print("Model is invalid! there's a bug in the model construction")
else:
    print(f"Unknown status: {status}")

if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
    print('Saving the output')
    output = []
    for g in groups:
        for gender in GENDERS:
            for place in places:
                key = (g["id"], gender, place["id"])
                if key not in assignments:
                    continue
                if solver.value(assignments[key]):
                    output.append({"gender": gender, "place_id": place["id"], "group_id": g["id"]})

    with open(output_path, 'w') as f:
        json.dump({
            "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
            "objective": solver.objective_value,
            "assignments": output,
        }, f)
    print(f"\nOutput saved to {output_path}")
