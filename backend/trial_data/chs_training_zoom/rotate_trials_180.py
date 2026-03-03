#!/usr/bin/env python3
"""
Create _rotated copies of E_ trials: rotate scene 180° clockwise and swap red/green sensors.
New folders: E_*_rotated (e.g. E_B4_NO -> E_B4_NO_rotated).
"""
import json
import os
import shutil
import math

BASE = os.path.dirname(os.path.abspath(__file__))
BALL_RADIUS = 0.5  # diameter 1 in world units

def clamp_rect(x, y, w, h, W, H):
    """Clamp rect origin to world bounds so rect stays in [0,W]x[0,H]."""
    x = max(0, min(x, W - w))
    y = max(0, min(y, H - h))
    return x, y

def rotate_rect(x, y, w, h, W, H):
    """180° clockwise: new bottom-left = (W-x-w, H-y-h). Clamp to world."""
    x2 = W - x - w
    y2 = H - y - h
    x2, y2 = clamp_rect(x2, y2, w, h, W, H)
    return {"x": x2, "y": y2, "width": w, "height": h}

def rotate_ball_pos(x, y, W, H):
    """Ball position is min corner of ball box; ball box size 2*radius. Clamp to world."""
    d = 2 * BALL_RADIUS
    x2 = W - x - d
    y2 = H - y - d
    x2 = max(0, min(x2, W - d))
    y2 = max(0, min(y2, H - d))
    return (x2, y2)

def rotate_angle_rad(angle_rad):
    """Rotate direction by 180°: new = old + pi, normalize to (-pi, pi]."""
    a = angle_rad + math.pi
    while a > math.pi:
        a -= 2 * math.pi
    while a <= -math.pi:
        a += 2 * math.pi
    return a

def process_simulation_data(path, W, H):
    with open(path) as f:
        data = json.load(f)
    # Barriers
    data["barriers"] = [rotate_rect(b["x"], b["y"], b["width"], b["height"], W, H) for b in data.get("barriers", [])]
    # Occluders
    data["occluders"] = [rotate_rect(o["x"], o["y"], o["width"], o["height"], W, H) for o in data.get("occluders", [])]
    # Red and green: rotate then swap
    red = data.get("red_sensor")
    green = data.get("green_sensor")
    if red:
        data["green_sensor"] = rotate_rect(red["x"], red["y"], red["width"], red["height"], W, H)
    if green:
        data["red_sensor"] = rotate_rect(green["x"], green["y"], green["width"], green["height"], W, H)
    # Step data: position, velocity, direction
    for k, frame in data.get("step_data", {}).items():
        x, y = frame["x"], frame["y"]
        nx, ny = rotate_ball_pos(x, y, W, H)
        frame["x"], frame["y"] = nx, ny
        frame["vx"] = -frame["vx"]
        frame["vy"] = -frame["vy"]
        if "dir" in frame:
            frame["dir"] = rotate_angle_rad(frame["dir"])
    return data

def process_init_state_entities(path, W, H):
    with open(path) as f:
        data = json.load(f)
    entities = data.get("entities", [])
    type_map = {"red_sensor": "green_sensor", "green_sensor": "red_sensor"}
    for e in entities:
        t = e.get("type")
        if t in ("red_sensor", "green_sensor"):
            e["type"] = type_map[t]
        x, y = e["x"], e["y"]
        w = e.get("width", 0)
        h = e.get("height", 0)
        if t == "target":
            nx, ny = rotate_ball_pos(x, y, W, H)
            e["x"], e["y"] = nx, ny
            if "direction" in e:
                e["direction"] = rotate_angle_rad(e["direction"])
        else:
            ex = W - x - w
            ey = H - y - h
            ex = max(0, min(ex, W - w)) if w else ex
            ey = max(0, min(ey, H - h)) if h else ey
            e["x"], e["y"] = ex, ey
    return data

def main():
    dirs = sorted(d for d in os.listdir(BASE) if d.startswith("E_") and os.path.isdir(os.path.join(BASE, d)) and not d.endswith("_rotated"))
    for name in dirs:
        src_dir = os.path.join(BASE, name)
        sim_path = os.path.join(src_dir, "simulation_data.json")
        init_path = os.path.join(src_dir, "init_state_entities.json")
        if not os.path.isfile(sim_path) or not os.path.isfile(init_path):
            print(f"Skip {name}: missing simulation_data.json or init_state_entities.json")
            continue
        with open(sim_path) as f:
            sim = json.load(f)
        dims = sim.get("scene_dims", [20, 20])
        W, H = dims[0], dims[1]
        dest_dir = os.path.join(BASE, name + "_rotated")
        os.makedirs(dest_dir, exist_ok=True)
        # Copy and transform simulation_data.json
        rotated_sim = process_simulation_data(sim_path, W, H)
        with open(os.path.join(dest_dir, "simulation_data.json"), "w") as f:
            json.dump(rotated_sim, f, indent=2)
        # Copy and transform init_state_entities.json
        rotated_init = process_init_state_entities(init_path, W, H)
        with open(os.path.join(dest_dir, "init_state_entities.json"), "w") as f:
            json.dump(rotated_init, f, indent=2)
        print(f"Created {name}_rotated")
    print("Done.")

if __name__ == "__main__":
    main()
