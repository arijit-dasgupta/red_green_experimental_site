#!/usr/bin/env python3
"""Check E_ trial JSONs for ball speed = 2 diameter/s. List trials that are not."""
import json
import os

TARGET_SPEED = 2.0
TOLERANCE = 0.05   # accept 1.95–2.05 as "2 diameter/s"
BASE = os.path.dirname(os.path.abspath(__file__))

def main():
    dirs = sorted(d for d in os.listdir(BASE) if d.startswith("E_") and os.path.isdir(os.path.join(BASE, d)))
    not_ok = []
    for name in dirs:
        path = os.path.join(BASE, name, "simulation_data.json")
        if not os.path.isfile(path):
            not_ok.append((name, "no simulation_data.json"))
            continue
        with open(path) as f:
            data = json.load(f)
        step_data = data.get("step_data") or {}
        if not step_data:
            not_ok.append((name, "empty step_data"))
            continue
        speeds = set()
        for frame_key, frame in step_data.items():
            if isinstance(frame, dict) and "speed" in frame:
                speeds.add(frame["speed"])
        bad_speeds = [s for s in speeds if abs(s - TARGET_SPEED) > TOLERANCE]
        if bad_speeds:
            not_ok.append((name, f"speeds (diameter/s): {sorted(speeds)}"))
        # Optionally report init_state_entities ballSpeed
        init_path = os.path.join(BASE, name, "init_state_entities.json")
        if os.path.isfile(init_path):
            with open(init_path) as f:
                init_data = json.load(f)
            params = (init_data.get("simulationParams") or {}) if isinstance(init_data, dict) else {}
            ball_speed = params.get("ballSpeed")
            if ball_speed is not None and abs(ball_speed - TARGET_SPEED) > TOLERANCE and name not in [n for n, _ in not_ok]:
                not_ok.append((name, f"init_state_entities ballSpeed = {ball_speed}"))
    if not_ok:
        print("Trials where ball speed is NOT 2 diameter/s (tolerance ±0.05):")
        for name, reason in not_ok:
            print(f"  {name}: {reason}")
    else:
        print("All E_ trials have ball speed = 2 diameter/s.")

if __name__ == "__main__":
    main()
