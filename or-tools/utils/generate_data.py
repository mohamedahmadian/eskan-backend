import random
import math

def haversine_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two points in meters using Haversine formula"""
    R = 6371000  # Earth's radius in meters

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)

    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


EVENT_LAT = 36.2880
EVENT_LNG = 59.6157

CITY_LAT_MIN = 36.15
CITY_LAT_MAX = 36.45
CITY_LNG_MIN = 59.40
CITY_LNG_MAX = 59.80

NUM_GROUPS = 416
NUM_PLACES = 244

MEN_MIN = 0
MEN_MAX = 250
WOMEN_MIN = 0
WOMEN_MAX = 250
GROUP_TOTAL_AVERAGE = 230

CAPACITY_MIN = 80
CAPACITY_MAX = 3000
PLACE_CAPACITY_AVERATE = 500

CITIES = [
    "Mashhad", "Tehran", "Isfahan", "Shiraz", "Tabriz",
    "Yazd", "Kerman", "Rasht", "Ahvaz", "Qom",
    "Kashan", "Hamadan", "Ardabil", "BandarAbbas", "Sanandaj",
    "Zahedan", "Birjand", "Bojnord", "Gorgan", "Sari",
    "Qazvin", "Zanjan", "Kermanshah", "Lorestan", "Ilam",
    "Chabahar", "Kish", "Qeshm", "Meybod", "Nain"
]

# City Distance
city_distances = {
    "Mashhad": 0,
    "Tehran": 800,
    "Isfahan": 1000,
    "Shiraz": 1200,
    "Tabriz": 1200,
    "Yazd": 900,
    "Kerman": 1000,
    "Rasht": 1100,
    "Ahvaz": 1300,
    "Qom": 900,
    "Kashan": 950,
    "Hamadan": 1100,
    "Ardabil": 1300,
    "BandarAbbas": 1300,
    "Sanandaj": 1300,
    "Zahedan": 1100,
    "Birjand": 250,
    "Bojnord": 200,
    "Gorgan": 400,
    "Sari": 500,
    "Qazvin": 1000,
    "Zanjan": 1100,
    "Kermanshah": 1300,
    "Lorestan": 1200,
    "Ilam": 1400,
    "Chabahar": 1400,
    "Kish": 1400,
    "Qeshm": 1400,
    "Meybod": 850,
    "Nain": 850,
}

groups = []
for i in range(NUM_GROUPS):
    men = int(random.triangular(MEN_MIN, MEN_MAX, GROUP_TOTAL_AVERAGE / 2))
    women = int(random.triangular(WOMEN_MIN, WOMEN_MAX, GROUP_TOTAL_AVERAGE / 2))
    city = random.choice(CITIES)
    groups.append({
        "id": i,
        "men": men,
        "women": women,
        "origin_city": city,
        "origin_city_distance": city_distances[city]
    })

places = []
place_types = ["men", "women"]
for i in range(NUM_PLACES):
    lat, lng = random.uniform(CITY_LAT_MIN, CITY_LAT_MAX), random.uniform(CITY_LNG_MIN, CITY_LNG_MAX)
    place_type = random.choice(place_types)
    capacity = int(random.triangular(CAPACITY_MIN, CAPACITY_MAX, 500))
    places.append({
        "id": i,
        "type": place_type,
        "capacity": capacity,
        "lat": lat,
        "lng": lng,
        "event_distance": haversine_distance(lat, lng, EVENT_LAT, EVENT_LNG)
    })
    
city_conflicts = [
    ("Tehran", "Qom"),
    ("Isfahan", "Shiraz"),
    ("Tabriz", "Ardabil"),
    ("Kerman", "Zahedan"),
]


mean_lat_rad = math.radians(sum(p["lat"] for p in places) / len(places))
meters_per_lat = 111_320
meters_per_lng = 111_320 * math.cos(mean_lat_rad)
lat_min = min(p["lat"] for p in places)
lng_min = min(p["lng"] for p in places)
lat_max = max(p["lat"] for p in places)
lng_max = max(p["lng"] for p in places)
lat_range = int(round((lat_max - lat_min) * meters_per_lat)) + 1
lng_range = int(round((lng_max - lng_min) * meters_per_lng)) + 1
max_manhattan_span_m = lat_range + lng_range

max_event_distance = max(p["event_distance"] for p in places)
max_group_size = max(max(g["men"], g["women"]) for g in groups)
max_city_distance = max(city_distances.values())


THRESHOLD_DISTANCE_M = 1500  
near_place_pairs = []
for i, p1 in enumerate(places):
    for p2 in places[i + 1:]:
        if haversine_distance(p1['lat'], p1['lng'], p2['lat'], p2['lng']) < THRESHOLD_DISTANCE_M:
            near_place_pairs.append((p1["id"], p2["id"]))

groups_by_city = {}
for g in groups:
    groups_by_city.setdefault(g["origin_city"], []).append(g)

MAX_NEARBY_DISTANCE = 5000
near_cross_gender_pairs = []
men_places_all = [p for p in places if p["type"] == "men"]
women_places_all = [p for p in places if p["type"] == "women"]
for mp in men_places_all:
    for wp in women_places_all:
        d = haversine_distance(mp["lat"], mp["lng"], wp["lat"], wp["lng"])
        if d <= MAX_NEARBY_DISTANCE:
            near_cross_gender_pairs.append((mp["id"], wp["id"], d))
            
# ============================================
# CONFIGURATION
# ============================================
print("\n" + "="*60)
print("CONFIGURATION")
print("="*60)
print("MEN_MIN:", MEN_MIN)
print("MEN_MAX:", MEN_MAX)
print("WOMEN_MIN:", WOMEN_MIN)
print("WOMEN_MAX:", WOMEN_MAX)
print("GROUP_TOTAL_AVERAGE:", GROUP_TOTAL_AVERAGE)
print("CAPACITY_MIN:", CAPACITY_MIN)
print("CAPACITY_MAX:", CAPACITY_MAX)
print("PLACE_CAPACITY_AVERATE:", PLACE_CAPACITY_AVERATE)


# ============================================
# PRINT SUMMARY
# ============================================
print("\n" + "="*60)
print("DATA GENERATION SUMMARY")
print("="*60)

print(f"\nGroups generated: {len(groups)}")
total_men = sum(g["men"] for g in groups)
total_women = sum(g["women"] for g in groups)
print(f"Total men: {total_men}")
print(f"Total women: {total_women}")
print(f"Total people: {total_men + total_women}")

print(f"\nPlaces generated: {len(places)}")
men_places = [p for p in places if p["type"] == "men"]
women_places = [p for p in places if p["type"] == "women"]
print(f"Men's places: {len(men_places)}")
print(f"Women's places: {len(women_places)}")
total_men_capacity = sum(p["capacity"] for p in men_places)
total_women_capacity = sum(p["capacity"] for p in women_places)
print(f"Total men capacity: {total_men_capacity}")
print(f"Total women capacity: {total_women_capacity}")

print(f"\nCity conflicts: {len(city_conflicts)}")

# Check feasibility
if total_men > total_men_capacity:
    print(f"WARNING: Total men ({total_men}) exceeds men's capacity ({total_men_capacity})")
if total_women > total_women_capacity:
    print(f"WARNING: Total women ({total_women}) exceeds women's capacity ({total_women_capacity})")

print("\n" + "="*60)

# Output
FILE_NAME = 'data.py'
with open(FILE_NAME, 'w') as f:
    f.write(f"groups = {groups}\n\n")
    f.write(f"city_distances = {city_distances}\n\n")
    f.write(f"places = {places}\n\n")
    f.write(f"city_conflicts = {city_conflicts}\n")
    f.write(f"max_event_distance = {max_event_distance}\n")
    f.write(f"max_group_size = {max_group_size}\n")
    f.write(f"max_city_distance = {max_city_distance}\n")
    f.write(f"max_manhattan_span_m = {max_manhattan_span_m}\n")
    f.write(f"near_place_pairs = {near_place_pairs}\n")
    f.write(f"groups_by_city = {groups_by_city}\n")
    f.write(f"GENDERS = {['men', 'women']}\n")
    f.write(f"near_cross_gender_pairs = {near_cross_gender_pairs}\n")


print(f"{FILE_NAME} Updated.")

