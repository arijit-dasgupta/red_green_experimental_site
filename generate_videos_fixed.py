#!/usr/bin/env python3
"""
Fixed Video Generator with Custom Textures
Generates videos from JSON trial data using your specific texture configuration
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
    'ball_rotation_rate': 90,  # degrees per second
    'canvas_border_thickness': 20,
    'world_width': 20,
    'world_height': 20,
    'output_fps': 30,
    'output_width': 1024,
    'output_height': 768
}

class VideoGeneratorFixed:
    def __init__(self, config: Dict):
        self.config = config
        self.textures = {}
        self.load_textures()
    
    def load_textures(self):
        """Load texture images"""
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
        """Draw tiled texture to fill a rectangle - FIXED VERSION"""
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
                    print(f"Unsupported texture format: {texture.shape}")
                    return False
            elif len(texture.shape) == 2:  # Grayscale
                # Convert grayscale to BGR
                texture_bgr = cv2.cvtColor(texture, cv2.COLOR_GRAY2BGR)
                alpha = None
            else:
                print(f"Unsupported texture format: {texture.shape}")
                return False
            
            tex_h, tex_w = texture_bgr.shape[:2]
            
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
            print(f"Error drawing tiled texture: {e}")
            return False
    
    def draw_canvas_border(self, canvas: np.ndarray):
        """Draw border around the canvas area using barrier texture"""
        border_thickness = self.config['canvas_border_thickness']
        if border_thickness <= 0:
            return
        
        canvas_h, canvas_w = canvas.shape[:2]
        
        # Top border
        if 'barrier' in self.textures:
            self.draw_tiled_texture(canvas, self.textures['barrier'], 
                                  0, 0, canvas_w, border_thickness)
        else:
            canvas[0:border_thickness, :] = [0, 0, 0]  # Black
        
        # Bottom border
        if 'barrier' in self.textures:
            self.draw_tiled_texture(canvas, self.textures['barrier'], 
                                  0, canvas_h - border_thickness, canvas_w, border_thickness)
        else:
            canvas[canvas_h - border_thickness:canvas_h, :] = [0, 0, 0]  # Black
        
        # Left border
        if 'barrier' in self.textures:
            self.draw_tiled_texture(canvas, self.textures['barrier'], 
                                  0, 0, border_thickness, canvas_h)
        else:
            canvas[:, 0:border_thickness] = [0, 0, 0]  # Black
        
        # Right border
        if 'barrier' in self.textures:
            self.draw_tiled_texture(canvas, self.textures['barrier'], 
                                  canvas_w - border_thickness, 0, border_thickness, canvas_h)
        else:
            canvas[:, canvas_w - border_thickness:canvas_w] = [0, 0, 0]  # Black
    
    def render_frame(self, trial_data: Dict, frame_index: int) -> np.ndarray:
        """Render a single frame - FIXED VERSION"""
        canvas = np.zeros((self.config['output_height'], self.config['output_width'], 3), dtype=np.uint8)
        canvas.fill(255)  # White background
        
        # Draw canvas border first
        self.draw_canvas_border(canvas)
        
        # Calculate the actual drawing area (inside the border)
        border_thickness = self.config['canvas_border_thickness']
        drawing_width = self.config['output_width'] - 2 * border_thickness
        drawing_height = self.config['output_height'] - 2 * border_thickness
        
        # Calculate scale factor for the drawing area
        scale_x = drawing_width / self.config['world_width']
        scale_y = drawing_height / self.config['world_height']
        scale = min(scale_x, scale_y)
        
        # Offset for centering within the drawing area
        offset_x = border_thickness + (drawing_width - self.config['world_width'] * scale) // 2
        offset_y = border_thickness + (drawing_height - self.config['world_height'] * scale) // 2
        
        # Transform coordinates (matching website's coordinate system)
        def transform_coords(x, y, width=0, height=0):
            # Website uses: ctx.scale(1, -1); ctx.translate(0, -canvas.height);
            # This flips Y axis, so we need to flip Y coordinates
            canvas_x = int(offset_x + x * scale)
            canvas_y = int(offset_y + (self.config['world_height'] - y - height) * scale)
            canvas_width = int(width * scale)
            canvas_height = int(height * scale)
            return canvas_x, canvas_y, canvas_width, canvas_height
        
        # Skip frame 0 for barriers (matching website logic: if (frameIndex !== 0))
        if frame_index != 0:
            # Draw barriers FIRST (they should be behind other elements)
            for barrier in trial_data.get('barriers', []):
                x, y, w, h = transform_coords(barrier['x'], barrier['y'], barrier['width'], barrier['height'])
                if 'barrier' in self.textures:
                    success = self.draw_tiled_texture(canvas, self.textures['barrier'], x, y, w, h)
                    if not success:
                        # Fallback to black fill
                        cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 0, 0), -1)
                else:
                    cv2.rectangle(canvas, (x, y), (x + w, y + h), (0, 0, 0), -1)  # Black fill
        
        # Draw sensors
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
        
        # Draw ball LAST (should be on top)
        step_data = trial_data.get('step_data', {})
        if str(frame_index) in step_data:
            ball_pos = step_data[str(frame_index)]
            ball_x_world = ball_pos['x']
            ball_y_world = ball_pos['y']
            
            # Transform ball position
            ball_x = int(offset_x + ball_x_world * scale)
            ball_y = int(offset_y + (self.config['world_height'] - ball_y_world) * scale)
            radius = int((trial_data.get('radius', 0.5)) * scale)
            
            if 'ball' in self.textures and radius > 0:
                # Calculate rotation based on time
                time_seconds = frame_index / self.config['output_fps']
                rotation_degrees = (time_seconds * self.config['ball_rotation_rate']) % 360
                
                # Resize ball texture
                ball_texture = self.textures['ball']
                size = radius * 2
                if size > 0:
                    ball_resized = cv2.resize(ball_texture, (size, size))
                    
                    # Apply rotation
                    center = (size // 2, size // 2)
                    rotation_matrix = cv2.getRotationMatrix2D(center, rotation_degrees, 1.0)
                    ball_rotated = cv2.warpAffine(ball_resized, rotation_matrix, (size, size))
                    
                    # Place on canvas
                    x_start = ball_x - radius
                    y_start = ball_y - radius
                    x_end = x_start + size
                    y_end = y_start + size
                    
                    # Ensure bounds
                    if (x_start >= 0 and y_start >= 0 and 
                        x_end <= canvas.shape[1] and y_end <= canvas.shape[0]):
                        
                        if len(ball_rotated.shape) == 3 and ball_rotated.shape[2] == 4:  # Has alpha channel
                            alpha = ball_rotated[:, :, 3] / 255.0
                            for c in range(3):
                                canvas[y_start:y_end, x_start:x_end, c] = (
                                    alpha * ball_rotated[:, :, c] +
                                    (1 - alpha) * canvas[y_start:y_end, x_start:x_end, c]
                                )
                        else:
                            canvas[y_start:y_end, x_start:x_end] = ball_rotated[:, :, :3]
            else:
                # Fallback: draw blue circle
                cv2.circle(canvas, (ball_x, ball_y), radius, (255, 0, 0), -1)
        
        # Draw occluders LAST (on top of everything, including the ball)
        for occluder in trial_data.get('occluders', []):
            x, y, w, h = transform_coords(occluder['x'], occluder['y'], occluder['width'], occluder['height'])
            if 'occluder' in self.textures:
                success = self.draw_tiled_texture(canvas, self.textures['occluder'], x, y, w, h)
                if not success:
                    # Fallback to gray fill
                    cv2.rectangle(canvas, (x, y), (x + w, y + h), (128, 128, 128), -1)
            else:
                cv2.rectangle(canvas, (x, y), (x + w, y + h), (128, 128, 128), -1)  # Gray fill
        
        return canvas
    
    def generate_video(self, trial_path: str, output_path: str) -> bool:
        """Generate video for a single trial"""
        print(f"🎬 Generating FIXED video for {trial_path}")
        
        # Load trial data
        trial_data = self.load_trial_data(trial_path)
        if not trial_data:
            return False
        
        # Get number of frames
        num_frames = trial_data.get('num_frames', len(trial_data.get('step_data', {})))
        if num_frames == 0:
            print("❌ No frames found in trial data")
            return False
        
        print(f"📊 Trial info: {num_frames} frames, {len(trial_data.get('barriers', []))} barriers, {len(trial_data.get('occluders', []))} occluders")
        
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
            
            print(f"✅ FIXED Video saved: {output_path}")
            return True
            
        except Exception as e:
            print(f"❌ Error generating video: {e}")
            return False
        finally:
            out.release()

def main():
    parser = argparse.ArgumentParser(description='Generate FIXED videos from trial JSON data with custom textures')
    parser.add_argument('--trial-dir', default='backend/trial_data/chs_training_zoom', 
                       help='Directory containing trial data')
    parser.add_argument('--output-dir', default='fixed_videos', 
                       help='Output directory for videos')
    parser.add_argument('--trial-name', help='Generate video for specific trial only')
    
    args = parser.parse_args()
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Initialize generator
    generator = VideoGeneratorFixed(CONFIG)
    
    # Find trials
    trial_dir = Path(args.trial_dir)
    if not trial_dir.exists():
        print(f"❌ Trial directory not found: {trial_dir}")
        return
    
    if args.trial_name:
        # Generate single trial
        trial_path = trial_dir / args.trial_name / 'simulation_data.json'
        if trial_path.exists():
            output_path = os.path.join(args.output_dir, f"{args.trial_name}_FIXED.mp4")
            generator.generate_video(str(trial_path), output_path)
        else:
            print(f"❌ Trial not found: {trial_path}")
    else:
        # Generate all trials
        trial_folders = [d for d in trial_dir.iterdir() if d.is_dir()]
        print(f"Found {len(trial_folders)} trial folders")
        
        for trial_folder in trial_folders:
            simulation_file = trial_folder / 'simulation_data.json'
            if simulation_file.exists():
                output_path = os.path.join(args.output_dir, f"{trial_folder.name}_FIXED.mp4")
                generator.generate_video(str(simulation_file), output_path)
            else:
                print(f"⚠️  Skipping {trial_folder.name}: no simulation_data.json found")

if __name__ == '__main__':
    main()
