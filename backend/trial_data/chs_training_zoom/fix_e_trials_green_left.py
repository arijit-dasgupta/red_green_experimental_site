#!/usr/bin/env python3
"""
Ensure E_* trials use a consistent sensor layout:
- green_sensor is on the LEFT (smaller x)
- red_sensor is on the RIGHT (larger x)

Edits both:
- simulation_data.json (top-level red_sensor/green_sensor objects)
- init_state_entities.json (entities with type red_sensor/green_sensor)

Also snaps near-zero coordinates (e.g. 1e-15) to exactly 0.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Tuple


EPS = 1e-9


def _snap_zero(v: Any) -> Any:
    if isinstance(v, (int, float)) and abs(v) < EPS:
        return 0
    return v


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _fix_simulation(sim_path: Path) -> Tuple[bool, str]:
    data: Dict[str, Any] = _read_json(sim_path)
    if "red_sensor" not in data or "green_sensor" not in data:
        return False, "missing red_sensor/green_sensor"

    red = data["red_sensor"]
    green = data["green_sensor"]
    rx = red.get("x")
    gx = green.get("x")

    if not isinstance(rx, (int, float)) or not isinstance(gx, (int, float)):
        return False, "non-numeric sensor x"

    changed = False
    # If green is to the right of red, swap the sensor objects.
    if gx > rx:
        data["red_sensor"], data["green_sensor"] = data["green_sensor"], data["red_sensor"]
        changed = True

    # Snap tiny float noise to 0.
    for k in ("red_sensor", "green_sensor"):
        for coord in ("x", "y"):
            if coord in data[k]:
                data[k][coord] = _snap_zero(data[k][coord])

    if changed:
        _write_json(sim_path, data)
    else:
        # Still write if we only snapped noise
        if _snap_zero(rx) != rx or _snap_zero(gx) != gx:
            _write_json(sim_path, data)
            changed = True

    return changed, "ok"


def _fix_init_state(init_path: Path) -> Tuple[bool, str]:
    data: Dict[str, Any] = _read_json(init_path)
    entities = data.get("entities")
    if not isinstance(entities, list):
        return False, "missing entities list"

    red_ent = None
    green_ent = None
    for e in entities:
        if not isinstance(e, dict):
            continue
        if e.get("type") == "red_sensor":
            red_ent = e
        elif e.get("type") == "green_sensor":
            green_ent = e

    if red_ent is None or green_ent is None:
        return False, "missing red_sensor/green_sensor entities"

    rx = red_ent.get("x")
    gx = green_ent.get("x")
    if not isinstance(rx, (int, float)) or not isinstance(gx, (int, float)):
        return False, "non-numeric entity x"

    changed = False
    if gx > rx:
        # Swap geometry fields, keep ids and types unchanged.
        for field in ("x", "y", "width", "height", "direction"):
            if field in red_ent or field in green_ent:
                red_ent[field], green_ent[field] = green_ent.get(field), red_ent.get(field)
        changed = True

    for ent in (red_ent, green_ent):
        for coord in ("x", "y"):
            if coord in ent:
                ent[coord] = _snap_zero(ent[coord])

    if changed:
        _write_json(init_path, data)
    else:
        if _snap_zero(rx) != rx or _snap_zero(gx) != gx:
            _write_json(init_path, data)
            changed = True

    return changed, "ok"


def main() -> None:
    base = Path(__file__).resolve().parent
    e_dirs = sorted(p for p in base.iterdir() if p.is_dir() and p.name.startswith("E_"))

    if not e_dirs:
        print("No E_* directories found.")
        return

    sim_changed = 0
    init_changed = 0
    sim_missing = 0
    init_missing = 0

    for d in e_dirs:
        sim_path = d / "simulation_data.json"
        if sim_path.exists():
            changed, msg = _fix_simulation(sim_path)
            if msg != "ok":
                print(f"{d.name}: simulation_data.json: {msg}")
            if changed:
                sim_changed += 1
        else:
            sim_missing += 1
            print(f"{d.name}: missing simulation_data.json")

        init_path = d / "init_state_entities.json"
        if init_path.exists():
            changed, msg = _fix_init_state(init_path)
            if msg != "ok":
                print(f"{d.name}: init_state_entities.json: {msg}")
            if changed:
                init_changed += 1
        else:
            init_missing += 1
            print(f"{d.name}: missing init_state_entities.json")

    print("\n=== Done ===")
    print(f"simulation_data.json changed: {sim_changed} (missing: {sim_missing})")
    print(f"init_state_entities.json changed: {init_changed} (missing: {init_missing})")


if __name__ == "__main__":
    main()

