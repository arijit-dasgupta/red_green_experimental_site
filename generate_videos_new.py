#!/usr/bin/env python3
"""
New Video Generator Script
Generates videos from JSON trial data with correct textures and rendering order.

Features:
- Ball texture with rotation (180°/sec)
- Barrier textures (grayscale)
- Sensor textures (red/green)
- Occluder textures (cloud.jpg)
- Canvas borders (20px thick)
- Correct rendering order (occluders on top of ball)
"""

import json
import cv2
import numpy as np
import os
from pathlib import Path
import argparse
from typing import Dict, List, Tuple, Optional

# Configuration matching your experiment
CONFIG = {
    'ball_texture_path': 'frontend/public/ball.png',
    'barrier_texture_path': 'frontend/public/barrier.png', 
    'red_sensor_texture_path': 'frontend/public/blueS.png',
    'green_sensor_texture_path': 'frontend/public/green.png',
    'occluder_texture_path': 'frontend/public/cloud.jpg',
    'ball_rotation_rate': 180,  # degrees per second (fixed: was 90)
    'canvas_border_thickness': 20,
    'world_width': 20,
    'world_height': 20,
    'output_fps': 30,
    # Square output: canvas is 600x600 (30 pixels per world unit)
    # Plus borders (20px on each side) = 640x640 total
    'canvas_size': 600,  # Square canvas size (without borders)
    'output_width': 640,  # Canvas + 2*20px borders = 640
    'output_height': 640  # Square video output
}

class VideoGenerator:
    def __init__(self, config: Dict):
        self.config = config
        self.textures = {}
        self.load_textures()
    
    def load_textures(self):
        """Load texture images and convert barriers to grayscale"""
        texture_paths = {
            'ball': self.config['ball_texture_path'],
            'barrier': self.config['barrier_texture_path'],
            'red_sensor': self.config['red_sensor_texture_path'],
            'green_sensor': self.config['green_sensor_texture_path'],
            'occluder': self.config['occluder_texture_path']
        }
        
        for name, path in texture_paths.items():
            if path and os.path.exists(path):
                texture = cv2.imread(path, cv2.IMREAD_UNCHANGED)
                if texture is not None:
                    # Convert barrier to grayscale
                    if name == 'barrier':
                        if len(texture.shape) == 3:
                            # Handle alpha channel separately
                            if texture.shape[2] == 4:
                                # Has alpha channel - preserve it
                                gray = cv2.cvtColor(texture[:, :, :3], cv2.COLOR_BGR2GRAY)
                                # Convert grayscale to BGR (3 channels)
                                texture_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
                                # Combine with alpha channel
                                alpha = texture[:, :, 3:4]
                                texture = np.concatenate([texture_bgr, alpha], axis=2)
                            else:
                                # No alpha channel - just convert to grayscale then BGR
                                gray = cv2.cvtColor(texture, cv2.COLOR_BGR2GRAY)
                                texture = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
                        elif len(texture.shape) == 2:
                            # Already grayscale, convert to BGR
                            texture = cv2.cvtColor(texture, cv2.COLOR_GRAY2BGR)
                    
                    self.textures[name] = texture
                    print(f"✅ Loaded texture: {name} from {path} - Shape: {texture.shape}")
                else:
                    print(f"❌ Failed to load texture: {name} from {path}")
            else:
                print(f"⚠️  Texture not found: {name} at {path}")
    
    def load_trial_data(self, trial_path: str) -> Optional[Dict]:
        """Load trial JSON data"""
        try:
            with open(trial_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ Error loading trial data from {trial_path}: {e}")
            return None
    
    def draw_tiled_texture(self, canvas: np.ndarray, texture: np.ndarray, 
                          x: int, y: int, width: int, height: int) -> bool:
        """Draw tiled texture to fill a rectangle"""
        if texture is None or width <= 0 or height <= 0:
            return False
        
        try:
            # Ensure coordinates are within canvas bounds
            x = max(0, min(x, canvas.shape[1]))
            y = max(0, min(y, canvas.shape[0]))
            width = min(width, canvas.shape[1] - x)
            height = min(height, canvas.shape[0] - y)
            
            if width <= 0 or height <= 0:
                return False
            
            # Handle different texture formats
            if len(texture.shape) == 3:
                if texture.shape[2] == 4:  # BGRA
                    texture_bgr = texture[:, :, :3]
                    alpha = texture[:, :, 3] / 255.0
                elif texture.shape[2] == 3:  # BGR
                    texture_bgr = texture
                    alpha = None
                else:
                    print(f"⚠️  Unsupported texture format: {texture.shape}")
                    return False
            elif len(texture.shape) == 2:  # Grayscale
                # Convert grayscale to BGR
                texture_bgr = cv2.cvtColor(texture, cv2.COLOR_GRAY2BGR)
                alpha = None
            else:
                print(f"⚠️  Unsupported texture format: {texture.shape}")
                return False
            
            tex_h, tex_w = texture_bgr.shape[:2]
            
            if tex_w == 0 or tex_h == 0:
                return False
            
            # Tile the texture
            for tile_y in range(0, height, tex_h):
                for tile_x in range(0, width, tex_w):
                    # Calculate actual tile size (handle partial tiles at edges)
                    actual_tile_w = min(tex_w, width - tile_x)
                    actual_tile_h = min(tex_h, height - tile_y)
                    
                    if actual_tile_w > 0 and actual_tile_h > 0:
                        # Canvas coordinates
                        canvas_x = x + tile_x
                        canvas_y = y + tile_y
                        canvas_x_end = canvas_x + actual_tile_w
                        canvas_y_end = canvas_y + actual_tile_h
                        
                        # Ensure we stay within canvas bounds
                        canvas_x_end = min(canvas_x_end, canvas.shape[1])
                        canvas_y_end = min(canvas_y_end, canvas.shape[0])
                        actual_tile_w = canvas_x_end - canvas_x
                        actual_tile_h = canvas_y_end - canvas_y
                        
                        if actual_tile_w > 0 and actual_tile_h > 0:
                            # Texture portion
                            tex_portion = texture_bgr[:actual_tile_h, :actual_tile_w]
                            
                            # Apply texture
                            if alpha is not None:
                                # Alpha blending
                                alpha_portion = alpha[:actual_tile_h, :actual_tile_w]
                                for c in range(3):
                                    canvas[canvas_y:canvas_y_end, canvas_x:canvas_x_end, c] = (
                                        alpha_portion * tex_portion[:, :, c] +
                                        (1 - alpha_portion) * canvas[canvas_y:canvas_y_end, canvas_x:canvas_x_end, c]
                                    )
                            else:
                                canvas[canvas_y:canvas_y_end, canvas_x:canvas_x_end] = tex_portion
            
            return True
        except Exception as e:
            print(f"❌ Error drawing tiled texture: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def draw_canvas_border(self, canvas: np.ndarray):
        """Draw border around the square canvas area using barrier texture (grayscale)"""
        border_thickness = self.config['canvas_border_thickness']
        if border_thickness <= 0:
            return
        
        canvas_h, canvas_w = canvas.shape[:2]
        canvas_size = self.config['canvas_size']
        
        # Calculate the square canvas area (inside borders)
        canvas_start_x = border_thickness
        canvas_start_y = border_thickness
        canvas_end_x = canvas_start_x + canvas_size
        canvas_end_y = canvas_start_y + canvas_size
        
        # Top border (above the square canvas)
        if 'barrier' in self.textures:
            self.draw_tiled_texture(canvas, self.textures['barrier'], 
                                  0, 0, canvas_w, border_thickness)
        else:
            canvas[0:border_thickness, :] = [0, 0, 0]  # Black
        
        # Bottom border (below the square canvas)
        if 'barrier' in self.textures:
            self.draw_tiled_texture(canvas, self.textures['barrier'], 
                                  0, canvas_end_y, canvas_w, border_thickness)
        else:
            canvas[canvas_end_y:canvas_h, :] = [0, 0, 0]  # Black
        
        # Left border (left of the square canvas)
        if 'barrier' in self.textures:
            self.draw_tiled_texture(canvas, self.textures['barrier'], 
                                  0, 0, border_thickness, canvas_h)
        else:
            canvas[:, 0:border_thickness] = [0, 0, 0]  # Black
        
        # Right border (right of the square canvas)
        if 'barrier' in self.textures:
            self.draw_tiled_texture(canvas, self.textures['barrier'], 
                                  canvas_end_x, 0, border_thickness, canvas_h)
        else:
            canvas[:, canvas_end_x:canvas_w] = [0, 0, 0]  # Black
    
    def render_frame(self, trial_data: Dict, frame_index: int) -> np.ndarray:
        """Render a single frame with correct rendering order"""
        # Create white canvas
        canvas = np.zeros((self.config['output_height'], self.config['output_width'], 3), dtype=np.uint8)
        canvas.fill(255)  # White background
        
        # Square canvas area (inside borders)
        border_thickness = self.config['canvas_border_thickness']
        canvas_size = self.config['canvas_size']  # Square canvas size
        
        # Calculate scale factor - canvas should fit the world (20x20)
        # canvas_size pixels for world_width world units
        scale = canvas_size / self.config['world_width']
        
        # Offset: borders on all sides, then center the canvas content
        offset_x = border_thickness
        offset_y = border_thickness
        
        # Note: Canvas borders will be drawn LAST so they appear on top
        
        # Transform coordinates (matching website's coordinate system: Y-axis flipped)
        def transform_coords(x, y, width=0, height=0):
            canvas_x = int(offset_x + x * scale)
            canvas_y = int(offset_y + (self.config['world_height'] - y - height) * scale)
            canvas_width = int(width * scale)
            canvas_height = int(height * scale)
            return canvas_x, canvas_y, canvas_width, canvas_height
        
        # Rendering order (from back to front):
        # 1. Barriers (always visible in videos, no countdown screen)
        for barrier in trial_data.get('barriers', []):
            x, y, w, h = transform_coords(barrier['x'], barrier['y'], barrier['width'], barrier['height'])
            if 'barrier' in self.textures:
                success = self.draw_tiled_texture(canvas, self.textures['barrier'], x, y, w, h)
                if not success:
                    # Fallback to black fill
                    cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 0, 0), -1)
            else:
                cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 0, 0), -1)  # Black fill
        
        # 2. Sensors (red/green)
        if 'red_sensor' in trial_data:
            sensor = trial_data['red_sensor']
            x, y, w, h = transform_coords(sensor['x'], sensor['y'], sensor['width'], sensor['height'])
            if 'red_sensor' in self.textures:
                success = self.draw_tiled_texture(canvas, self.textures['red_sensor'], x, y, w, h)
                if not success:
                    cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 0, 255), -1)  # Red fill
            else:
                cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 0, 255), -1)  # Red fill
        
        if 'green_sensor' in trial_data:
            sensor = trial_data['green_sensor']
            x, y, w, h = transform_coords(sensor['x'], sensor['y'], sensor['width'], sensor['height'])
            if 'green_sensor' in self.textures:
                success = self.draw_tiled_texture(canvas, self.textures['green_sensor'], x, y, w, h)
                if not success:
                    cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 255, 0), -1)  # Green fill
            else:
                cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 255, 0), -1)  # Green fill
        
        # 3. Ball (with rotation)
        step_data = trial_data.get('step_data', {})
        if str(frame_index) in step_data:
            ball_pos = step_data[str(frame_index)]
            radius_world = trial_data.get('radius', 0.5)
            
            # In the JSON, (x, y) is the bottom-left corner of the ball
            # We need to add radius to get the center (matching frontend: centerX = (x + radius) * scale)
            ball_x_world = ball_pos['x'] + radius_world  # Center X
            ball_y_world = ball_pos['y'] + radius_world  # Center Y
            
            # Transform ball center position (accounting for Y-axis flip)
            ball_x = int(offset_x + ball_x_world * scale)
            ball_y = int(offset_y + (self.config['world_height'] - ball_y_world) * scale)
            radius = int(radius_world * scale)
            
            if 'ball' in self.textures and radius > 0:
                # Calculate rotation based on time (180°/sec)
                time_seconds = frame_index / self.config['output_fps']
                rotation_degrees = (time_seconds * self.config['ball_rotation_rate']) % 360
                
                # Resize ball texture
                ball_texture = self.textures['ball']
                size = radius * 2
                if size > 0:
                    # Ensure minimum size
                    size = max(size, 2)
                    ball_resized = cv2.resize(ball_texture, (size, size), interpolation=cv2.INTER_LINEAR)
                    
                    # Apply rotation
                    center = (size // 2, size // 2)
                    rotation_matrix = cv2.getRotationMatrix2D(center, rotation_degrees, 1.0)
                    
                    # Create rotated ball with proper border handling
                    if len(ball_resized.shape) == 3 and ball_resized.shape[2] == 4:
                        # Has alpha channel - rotate each channel separately for better quality
                        ball_rotated = cv2.warpAffine(ball_resized, rotation_matrix, (size, size),
                                                      flags=cv2.INTER_LINEAR, 
                                                      borderMode=cv2.BORDER_CONSTANT,
                                                      borderValue=(0, 0, 0, 0))
                    else:
                        # No alpha channel
                        ball_rotated = cv2.warpAffine(ball_resized, rotation_matrix, (size, size),
                                                      flags=cv2.INTER_LINEAR, 
                                                      borderMode=cv2.BORDER_CONSTANT,
                                                      borderValue=(0, 0, 0))
                    
                    # Apply circular mask to remove rotation artifacts at edges
                    # This ensures clean edges like the frontend which uses ctx.clip() on a circle
                    mask = np.zeros((size, size), dtype=np.float32)
                    cv2.circle(mask, (size // 2, size // 2), radius, 1.0, -1)
                    
                    # Apply mask to alpha channel if present
                    if len(ball_rotated.shape) == 3 and ball_rotated.shape[2] == 4:
                        ball_rotated[:, :, 3] = (ball_rotated[:, :, 3] * mask).astype(np.uint8)
                    
                    # Place on canvas
                    x_start = ball_x - radius
                    y_start = ball_y - radius
                    x_end = x_start + size
                    y_end = y_start + size
                    
                    # Clamp to canvas bounds
                    x_start_clamped = max(0, x_start)
                    y_start_clamped = max(0, y_start)
                    x_end_clamped = min(canvas.shape[1], x_end)
                    y_end_clamped = min(canvas.shape[0], y_end)
                    
                    if x_end_clamped > x_start_clamped and y_end_clamped > y_start_clamped:
                        # Calculate crop for texture
                        tex_x_start = x_start_clamped - x_start
                        tex_y_start = y_start_clamped - y_start
                        tex_x_end = tex_x_start + (x_end_clamped - x_start_clamped)
                        tex_y_end = tex_y_start + (y_end_clamped - y_start_clamped)
                        
                        if tex_x_end > tex_x_start and tex_y_end > tex_y_start:
                            ball_cropped = ball_rotated[tex_y_start:tex_y_end, tex_x_start:tex_x_end]
                            mask_cropped = mask[tex_y_start:tex_y_end, tex_x_start:tex_x_end]
                            
                            # Handle alpha channel with circular mask
                            if len(ball_cropped.shape) == 3 and ball_cropped.shape[2] == 4:  # Has alpha channel
                                # Combine texture alpha with circular mask
                                alpha = (ball_cropped[:, :, 3] / 255.0) * mask_cropped
                                ball_rgb = ball_cropped[:, :, :3]
                                for c in range(3):
                                    canvas[y_start_clamped:y_end_clamped, x_start_clamped:x_end_clamped, c] = (
                                        alpha * ball_rgb[:, :, c] +
                                        (1 - alpha) * canvas[y_start_clamped:y_end_clamped, x_start_clamped:x_end_clamped, c]
                                    )
                            else:
                                # No alpha channel - apply circular mask
                                ball_rgb = ball_cropped[:, :, :3]
                                for c in range(3):
                                    canvas[y_start_clamped:y_end_clamped, x_start_clamped:x_end_clamped, c] = (
                                        mask_cropped * ball_rgb[:, :, c] +
                                        (1 - mask_cropped) * canvas[y_start_clamped:y_end_clamped, x_start_clamped:x_end_clamped, c]
                                    )
            else:
                # Fallback: draw blue circle
                cv2.circle(canvas, (ball_x, ball_y), radius, (255, 0, 0), -1)
        
        # 4. Occluders (on top of ball)
        for occluder in trial_data.get('occluders', []):
            x, y, w, h = transform_coords(occluder['x'], occluder['y'], occluder['width'], occluder['height'])
            if 'occluder' in self.textures:
                success = self.draw_tiled_texture(canvas, self.textures['occluder'], x, y, w, h)
                if not success:
                    # Fallback to gray fill
                    cv2.rectangle(canvas, (x, y), (x + w, y + h), (128, 128, 128), -1)
            else:
                cv2.rectangle(canvas, (x, y), (x + w, y + h), (128, 128, 128), -1)  # Gray fill
        
        # 5. Canvas borders LAST (on top of everything, ensuring visible walls)
        self.draw_canvas_border(canvas)
        
        return canvas
    
    def generate_video(self, trial_path: str, output_path: str) -> bool:
        """Generate video for a single trial"""
        print(f"🎬 Generating video for {trial_path}")
        
        # Load trial data
        trial_data = self.load_trial_data(trial_path)
        if not trial_data:
            return False
        
        # Get number of frames
        num_frames = trial_data.get('num_frames', len(trial_data.get('step_data', {})))
        if num_frames == 0:
            print("❌ No frames found in trial data")
            return False
        
        print(f"📊 Trial info: {num_frames} frames, {len(trial_data.get('barriers', []))} barriers, "
              f"{len(trial_data.get('occluders', []))} occluders")
        
        # Set up video writer
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, self.config['output_fps'], 
                             (self.config['output_width'], self.config['output_height']))
        
        if not out.isOpened():
            print(f"❌ Failed to open video writer for {output_path}")
            return False
        
        try:
            # Generate frames
            for frame_idx in range(num_frames):
                frame = self.render_frame(trial_data, frame_idx)
                out.write(frame)
                
                if frame_idx % 30 == 0:  # Progress update every 30 frames
                    progress = (frame_idx + 1) / num_frames * 100
                    print(f"  Progress: {progress:.1f}% ({frame_idx + 1}/{num_frames} frames)")
            
            print(f"✅ Video saved: {output_path}")
            return True
            
        except Exception as e:
            print(f"❌ Error generating video: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            out.release()

def main():
    parser = argparse.ArgumentParser(description='Generate videos from trial JSON data with correct textures')
    parser.add_argument('--trial-dir', default='backend/trial_data/chs_training_zoom', 
                       help='Directory containing trial data')
    parser.add_argument('--output-dir', default='generated_videos', 
                       help='Output directory for videos')
    parser.add_argument('--trial-name', help='Generate video for specific trial only')
    parser.add_argument('--filter-prefix', default='E', 
                       help='Only process trials starting with this prefix (default: E)')
    
    args = parser.parse_args()
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Initialize generator
    generator = VideoGenerator(CONFIG)
    
    # Find trials
    trial_dir = Path(args.trial_dir)
    if not trial_dir.exists():
        print(f"❌ Trial directory not found: {trial_dir}")
        return
    
    if args.trial_name:
        # Generate single trial
        trial_path = trial_dir / args.trial_name / 'simulation_data.json'
        if trial_path.exists():
            output_path = os.path.join(args.output_dir, f"{args.trial_name}.mp4")
            generator.generate_video(str(trial_path), output_path)
        else:
            print(f"❌ Trial not found: {trial_path}")
    else:
        # Generate all trials starting with the prefix
        trial_folders = [d for d in trial_dir.iterdir() if d.is_dir() and d.name.startswith(args.filter_prefix)]
        trial_folders.sort()  # Sort for consistent processing order
        
        print(f"📁 Found {len(trial_folders)} trial folders starting with '{args.filter_prefix}'")
        
        success_count = 0
        error_count = 0
        
        for trial_folder in trial_folders:
            simulation_file = trial_folder / 'simulation_data.json'
            if simulation_file.exists():
                output_path = os.path.join(args.output_dir, f"{trial_folder.name}.mp4")
                if generator.generate_video(str(simulation_file), output_path):
                    success_count += 1
                else:
                    error_count += 1
            else:
                print(f"⚠️  Skipping {trial_folder.name}: no simulation_data.json found")
        
        print(f"\n✅ Completed: {success_count} videos generated successfully")
        if error_count > 0:
            print(f"❌ Errors: {error_count} videos failed to generate")

if __name__ == '__main__':
    main()
