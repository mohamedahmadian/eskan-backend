#!/usr/bin/env python3
"""
Patches your existing map_viewer.html so that it:
  1. loads the NEW solver files (input.json with groups/places + result.json with assignments)
  2. clears the previous group's highlighting when you pick another group
  3. fits the window (no page scrolling)

Usage:  python patch_viewer.py map_viewer.html [map_viewer_v2.html]
Every replacement must match exactly once, otherwise nothing is written.
"""
import re
import sys

LITERAL = [
    # ---- layout / scroll fixes
    ("html, body { margin: 0; height: 100%;", "html, body { margin: 0; height: 100%; overflow: hidden;"),
    (".app { display: grid; grid-template-rows: auto auto 1fr; height: 100vh; }",
     ".app { display: grid; grid-template-rows: auto auto minmax(0, 1fr); height: 100vh; height: 100dvh; overflow: hidden; }"),
    (".layout { display: grid; grid-template-columns: 340px 1fr; min-height: 0; }",
     ".layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); min-height: 0; overflow: hidden; }"),
    ("overflow-y: auto; border-right: 1px solid var(--sidebar-border);",
     "overflow-y: auto; min-height: 0; border-right: 1px solid var(--sidebar-border);"),
    ("main { position: relative; background: var(--map-bg); }",
     "main { position: relative; background: var(--map-bg); min-width: 0; min-height: 0; overflow: hidden; }"),
    ("#mapSvg { width: 80%; height: 100%; display: block; }",
     "#mapSvg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }"),

    # ---- header: allow selecting both files at once
    ("Load data file (.json)", "Load files (.json)"),
    ('accept="application/json" style="display:none;"', 'accept="application/json,.json" multiple style="display:none;"'),
    ("No data loaded yet.</div>", "No data loaded yet. Load the solver input and result files.</div>"),

    # ---- ids may be strings: stop forcing Number()
    ("const vid = Number(id);", "const vid = id;"),
    ("if (row) showPlaceInfo(Number(row.dataset.venueId));", "if (row) showPlaceInfo(row.dataset.venueId);"),
    ("if (row) focusGroup(Number(row.dataset.groupId));", "if (row) focusGroup(row.dataset.groupId);"),
    ("if (v !== '') focusGroup(Number(v));", "if (v.trim() !== '') focusGroup(v.trim());"),
    ("const venueId = Number(el.dataset.venueId);", "const venueId = el.dataset.venueId;"),

    # ---- bug: previous group selection stayed colored
    ("  drawAllSeparationLines(sorted, sorted.slice(0, topN));",
     "  resetColors();\n  drawAllSeparationLines(sorted, sorted.slice(0, topN));"),
    ("  drawAllSeparationLines(sorted, worst);",
     "  resetColors();\n  drawAllSeparationLines(sorted, worst);"),
]

# Replaces the old single-file loader (regex so whitespace differences don't matter)
OLD_LOADER = r"document\.getElementById\('fileInput'\)\.addEventListener\('change'.*?reader\.readAsText\(file\);\s*\}\);"

NEW_LOADER = r"""/* ---------- loading: solver input + solver result (legacy single file still works) ---------- */

let loaded = { input: null, result: null };

function normalizeAssignments(raw) {
  if (Array.isArray(raw)) {
    // [{group_id, gender, place_id}] or [[gender, place_id, group_id], ...]
    return raw.map(a => Array.isArray(a) ? { gender: a[0], place_id: a[1], group_id: a[2] } : a);
  }
  // checkpoint format: { "groupId:gender": placeId }
  return Object.entries(raw || {}).map(([key, place_id]) => {
    const i = key.lastIndexOf(':');
    return { group_id: key.slice(0, i), gender: key.slice(i + 1), place_id };
  });
}

function buildFromSolver(input, result) {
  const venues = input.places.map(p => ({
    id: p.id, gender: p.type, capacity: p.capacity, lat: p.lat, lng: p.lng,
    distance_to_event_km: (p.event_distance || 0) / 1000,
  }));
  const delegations = input.groups.map(g => ({
    id: g.id, men: g.men || 0, women: g.women || 0,
    home_city: g.origin_city, home_distance: g.origin_city_distance,
  }));
  const vIds = new Set(venues.map(v => String(v.id)));
  const dIds = new Set(delegations.map(d => String(d.id)));
  const placements = [];
  let skipped = 0;
  normalizeAssignments(result && result.assignments).forEach(a => {
    const ok = vIds.has(String(a.place_id)) && dIds.has(String(a.group_id)) &&
               (a.gender === 'men' || a.gender === 'women');
    if (!ok) { skipped++; return; }
    placements.push({ delegation_id: a.group_id, gender: a.gender, venue_id: a.place_id });
  });
  return { data: { venues, delegations, placements, city_conflicts: input.city_conflicts || [] }, skipped };
}

function tryBuild() {
  const line = document.getElementById('statsLine');
  if (!loaded.input) { line.textContent = 'Result loaded. Now load the solver input file (groups + places).'; return; }
  const { data, skipped } = buildFromSolver(loaded.input, loaded.result);
  initData(data);
  const r = loaded.result;
  const extra = r
    ? [r.status, r.objective != null ? 'objective ' + Math.round(r.objective) : null].filter(Boolean).join(' · ')
    : 'no result loaded yet';
  line.textContent += ' · ' + extra + (skipped ? ` · ${skipped} assignments skipped (unknown ids)` : '');
}

document.getElementById('fileInput').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  let gotInput = false, gotResult = false;
  for (const file of files) {
    try {
      const json = JSON.parse(await file.text());
      if (json.venues && json.delegations) { loaded = { input: null, result: null }; initData(json); return; }
      if (json.groups && json.places) { loaded.input = json; gotInput = true; }
      else if (json.assignments) { loaded.result = json; gotResult = true; }
      else throw new Error('expected solver input (groups + places) or solver result (assignments)');
    } catch (err) { alert(file.name + ': ' + err.message); return; }
  }
  if (gotInput && !gotResult) loaded.result = null;  // a new input makes the old result stale
  tryBuild();
});"""


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src.replace(".html", "_v2.html")
    with open(src, encoding="utf-8", newline="") as f:
        text = f.read()

    problems = []
    for old, new in LITERAL:
        n = text.count(old)
        if n != 1:
            problems.append(f"expected 1 match, found {n}: {old[:70]!r}")
        else:
            text = text.replace(old, new)

    text, n = re.subn(OLD_LOADER, lambda m: NEW_LOADER, text, count=1, flags=re.S)
    if n != 1:
        problems.append("could not find the old file-loading block")

    if problems:
        sys.exit("Nothing written. Problems:\n  " + "\n  ".join(problems))
    with open(dst, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print(f"Wrote {dst}")


if __name__ == "__main__":
    main()
