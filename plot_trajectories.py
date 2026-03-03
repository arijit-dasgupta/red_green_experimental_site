#!/usr/bin/env python3
"""
Trajectory Plotting Script
Generates static trajectory images for all E_* trials,
using the same rendering as the online experiment (generate_videos_new.py).

Scene rendering: barriers (grayscale brick), sensors (yellow.png / green.png),
occluders (cloud.jpg, semi-transparent), canvas borders (brick).
Trajectory: black line with dots + integer second labels at whole-second marks.
Start: ball texture image at frame-0 position.
"""

import json
import cv2
import numpy as np
import os
from pathlib import Path

# Configuration matching the online experiment (from config.js + generate_videos_new.py)
CONFIG = {
    'ball_texture_path': 'frontend/public/ball.png',
    'barrier_texture_path': 'frontend/public/barrier.png',
    'red_sensor_texture_path': 'frontend/public/yellow.jpg',
    'green_sensor_texture_path': 'frontend/public/green.jpg',
    'occluder_texture_path': 'frontend/public/cloud.jpg',
    'world_width': 20,
    'world_height': 20,
    'canvas_size': 600,
    'border_thickness': 20,
    'output_width': 640,
    'output_height': 640,
    'fps': 30,
}


class TrajectoryPlotter:
    def __init__(self, config):
        self.config = config
        self.textures = {}
        self._load_textures()

    # ── texture loading (matches generate_videos_new.py) ──────────────
    def _load_textures(self):
        paths = {
            'ball': self.config['ball_texture_path'],
            'barrier': self.config['barrier_texture_path'],
            'red_sensor': self.config['red_sensor_texture_path'],
            'green_sensor': self.config['green_sensor_texture_path'],
            'occluder': self.config['occluder_texture_path'],
        }
        for name, path in paths.items():
            if not path or not os.path.exists(path):
                print(f"⚠️  Texture not found: {name} at {path}")
                continue
            tex = cv2.imread(path, cv2.IMREAD_UNCHANGED)
            if tex is None:
                print(f"❌ Failed to load texture: {name}")
                continue
            # barriers → grayscale (matching generate_videos_new.py)
            if name == 'barrier':
                if len(tex.shape) == 3:
                    if tex.shape[2] == 4:
                        gray = cv2.cvtColor(tex[:, :, :3], cv2.COLOR_BGR2GRAY)
                        bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
                        tex = np.concatenate([bgr, tex[:, :, 3:4]], axis=2)
                    else:
                        gray = cv2.cvtColor(tex, cv2.COLOR_BGR2GRAY)
                        tex = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
            self.textures[name] = tex
            print(f"✅ Loaded texture: {name} ({path}) shape={tex.shape}")

    # ── tiled‑texture draw (same as generate_videos_new.py) ───────────
    def _draw_tiled(self, canvas, texture, x, y, w, h):
        if texture is None or w <= 0 or h <= 0:
            return
        x = max(0, min(x, canvas.shape[1]))
        y = max(0, min(y, canvas.shape[0]))
        w = min(w, canvas.shape[1] - x)
        h = min(h, canvas.shape[0] - y)
        if w <= 0 or h <= 0:
            return

        has_alpha = len(texture.shape) == 3 and texture.shape[2] == 4
        tex_bgr = texture[:, :, :3] if has_alpha else texture
        alpha = texture[:, :, 3] / 255.0 if has_alpha else None
        if len(tex_bgr.shape) == 2:
            tex_bgr = cv2.cvtColor(tex_bgr, cv2.COLOR_GRAY2BGR)

        th, tw = tex_bgr.shape[:2]
        for ty in range(0, h, th):
            for tx in range(0, w, tw):
                aw = min(tw, w - tx)
                ah = min(th, h - ty)
                cx, cy = x + tx, y + ty
                cxe = min(cx + aw, canvas.shape[1])
                cye = min(cy + ah, canvas.shape[0])
                aw, ah = cxe - cx, cye - cy
                if aw <= 0 or ah <= 0:
                    continue
                tp = tex_bgr[:ah, :aw]
                if alpha is not None:
                    ap = alpha[:ah, :aw]
                    for c in range(3):
                        canvas[cy:cye, cx:cxe, c] = (
                            ap * tp[:, :, c]
                            + (1 - ap) * canvas[cy:cye, cx:cxe, c]
                        )
                else:
                    canvas[cy:cye, cx:cxe] = tp

    # ── coordinate transform (Y-flipped, matching website) ────────────
    def _transform(self, x, y, w=0, h=0):
        bt = self.config['border_thickness']
        scale = self.config['canvas_size'] / self.config['world_width']
        cx = int(bt + x * scale)
        cy = int(bt + (self.config['world_height'] - y - h) * scale)
        return cx, cy, int(w * scale), int(h * scale)

    # ── draw the scene (barriers, sensors, occluders, borders) ────────
    def _draw_scene(self, canvas, data):
        bt = self.config['border_thickness']
        cs = self.config['canvas_size']
        ow, oh = self.config['output_width'], self.config['output_height']

        # barriers
        for bar in data.get('barriers', []):
            x, y, w, h = self._transform(bar['x'], bar['y'], bar['width'], bar['height'])
            tex = self.textures.get('barrier')
            if tex is not None:
                self._draw_tiled(canvas, tex, x, y, w, h)
            else:
                cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 0, 0), -1)

        # red sensor (yellow.png)
        rs = data.get('red_sensor')
        if rs:
            x, y, w, h = self._transform(rs['x'], rs['y'], rs['width'], rs['height'])
            tex = self.textures.get('red_sensor')
            if tex is not None:
                self._draw_tiled(canvas, tex, x, y, w, h)
            else:
                cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 255, 255), -1)

        # green sensor (green.png)
        gs = data.get('green_sensor')
        if gs:
            x, y, w, h = self._transform(gs['x'], gs['y'], gs['width'], gs['height'])
            tex = self.textures.get('green_sensor')
            if tex is not None:
                self._draw_tiled(canvas, tex, x, y, w, h)
            else:
                cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 255, 0), -1)

        # occluders (semi-transparent so trajectory is still visible through them)
        for occ in data.get('occluders', []):
            x, y, w, h = self._transform(occ['x'], occ['y'], occ['width'], occ['height'])
            overlay = canvas.copy()
            tex = self.textures.get('occluder')
            if tex is not None:
                self._draw_tiled(overlay, tex, x, y, w, h)
            else:
                cv2.rectangle(overlay, (x, y), (x + w, y + h), (200, 200, 200), -1)
            cv2.addWeighted(overlay, 0.5, canvas, 0.5, 0, canvas)

        # canvas borders (brick texture on all 4 sides, on top)
        tex = self.textures.get('barrier')
        if tex is not None:
            self._draw_tiled(canvas, tex, 0, 0, ow, bt)                     # top
            self._draw_tiled(canvas, tex, 0, bt + cs, ow, bt)               # bottom
            self._draw_tiled(canvas, tex, 0, 0, bt, oh)                     # left
            self._draw_tiled(canvas, tex, bt + cs, 0, bt, oh)               # right
        else:
            canvas[0:bt, :] = 0
            canvas[bt + cs:oh, :] = 0
            canvas[:, 0:bt] = 0
            canvas[:, bt + cs:ow] = 0

    # ── draw the ball texture at a specific position ──────────────────
    def _draw_ball(self, canvas, cx, cy, radius_px):
        """Draw ball.png at (cx, cy) with given pixel radius."""
        tex = self.textures.get('ball')
        if tex is None or radius_px <= 0:
            cv2.circle(canvas, (cx, cy), radius_px, (0, 0, 255), -1)
            return
        size = radius_px * 2
        if size < 2:
            size = 2
        resized = cv2.resize(tex, (size, size), interpolation=cv2.INTER_LINEAR)

        # Circular mask (like ctx.clip() in the frontend)
        mask = np.zeros((size, size), dtype=np.float32)
        cv2.circle(mask, (size // 2, size // 2), radius_px, 1.0, -1)

        x0, y0 = cx - radius_px, cy - radius_px
        x1, y1 = x0 + size, y0 + size

        # clamp to canvas
        sx = max(0, -x0); sy = max(0, -y0)
        x0c, y0c = max(x0, 0), max(y0, 0)
        x1c = min(x1, canvas.shape[1])
        y1c = min(y1, canvas.shape[0])
        ew, eh = x1c - x0c, y1c - y0c
        if ew <= 0 or eh <= 0:
            return

        crop = resized[sy:sy+eh, sx:sx+ew]
        mcrop = mask[sy:sy+eh, sx:sx+ew]

        if crop.shape[2] == 4:
            alpha = (crop[:, :, 3] / 255.0) * mcrop
            rgb = crop[:, :, :3]
        else:
            alpha = mcrop
            rgb = crop[:, :, :3]
        for c in range(3):
            canvas[y0c:y1c, x0c:x1c, c] = (
                alpha * rgb[:, :, c]
                + (1 - alpha) * canvas[y0c:y1c, x0c:x1c, c]
            )

    # ── main entry: generate one trajectory image ─────────────────────
    def plot(self, json_path, output_path):
        with open(json_path) as f:
            data = json.load(f)

        canvas = np.full(
            (self.config['output_height'], self.config['output_width'], 3),
            255, dtype=np.uint8,
        )

        # Draw scene
        self._draw_scene(canvas, data)

        # Extract trajectory positions
        step = data.get('step_data', {})
        if not step:
            return False
        radius_world = data.get('radius', data.get('target', {}).get('size', 1) / 2)
        scale = self.config['canvas_size'] / self.config['world_width']
        bt = self.config['border_thickness']

        frames = sorted(int(k) for k in step.keys())
        pts = []
        for fi in frames:
            s = step[str(fi)]
            wx = s['x'] + radius_world   # center X
            wy = s['y'] + radius_world   # center Y
            px = int(bt + wx * scale)
            py = int(bt + (self.config['world_height'] - wy) * scale)
            pts.append((px, py))

        if len(pts) < 2:
            return False

        fps = self.config['fps']
        radius_px = max(int(radius_world * scale), 4)

        # ── Draw trajectory: black antialiased line ──
        pts_np = np.array(pts, dtype=np.int32).reshape(-1, 1, 2)
        cv2.polylines(canvas, [pts_np], isClosed=False,
                      color=(0, 0, 0), thickness=2, lineType=cv2.LINE_AA)

        # ── Draw dots + time labels at each whole second ──
        for sec in range(1, len(pts) // fps + 1):
            idx = sec * fps
            if idx >= len(pts):
                break
            px, py = pts[idx]
            # dot
            cv2.circle(canvas, (px, py), 5, (0, 0, 0), -1, lineType=cv2.LINE_AA)
            # label: just the integer
            label = str(sec)
            font = cv2.FONT_HERSHEY_SIMPLEX
            fscale, thick = 0.45, 1
            (tw, th), _ = cv2.getTextSize(label, font, fscale, thick)
            tx, ty = px + 6, py + th // 2
            # white background
            cv2.rectangle(canvas, (tx - 2, ty - th - 2), (tx + tw + 2, ty + 2),
                          (255, 255, 255), -1)
            cv2.putText(canvas, label, (tx, ty), font, fscale,
                        (0, 0, 0), thick, cv2.LINE_AA)

        # ── Draw ball texture at starting position ──
        self._draw_ball(canvas, pts[0][0], pts[0][1], radius_px)

        # ── Re-draw borders on top (ensure clean edges) ──
        tex = self.textures.get('barrier')
        cs = self.config['canvas_size']
        ow, oh = self.config['output_width'], self.config['output_height']
        if tex is not None:
            self._draw_tiled(canvas, tex, 0, 0, ow, bt)
            self._draw_tiled(canvas, tex, 0, bt + cs, ow, bt)
            self._draw_tiled(canvas, tex, 0, 0, bt, oh)
            self._draw_tiled(canvas, tex, bt + cs, 0, bt, oh)

        cv2.imwrite(output_path, canvas)
        return True


def main():
    trial_dir = Path('backend/trial_data/chs_training_zoom')
    output_dir = Path('trajectory_plots')
    output_dir.mkdir(exist_ok=True)

    plotter = TrajectoryPlotter(CONFIG)

    folders = sorted(d for d in trial_dir.iterdir()
                     if d.is_dir() and d.name.startswith('E'))
    print(f"\n📊 Found {len(folders)} E_* trial folders")
    print(f"📁 Output directory: {output_dir}\n")

    ok, fail = 0, 0
    for folder in folders:
        jf = folder / 'simulation_data.json'
        if not jf.exists():
            print(f"⚠️  Skipping {folder.name}: no simulation_data.json")
            continue
        out = output_dir / f"{folder.name}_trajectory.png"
        print(f"🎨 {folder.name}...", end=' ')
        if plotter.plot(str(jf), str(out)):
            print("✅")
            ok += 1
        else:
            print("❌")
            fail += 1

    print(f"\n{'='*50}")
    print(f"✅ Generated: {ok} trajectory plots")
    if fail:
        print(f"❌ Failed: {fail}")
    print(f"📂 Saved to: {output_dir.absolute()}")
    print(f"{'='*50}\n")


if __name__ == '__main__':
    main()
