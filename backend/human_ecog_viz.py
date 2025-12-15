"""
ECoG Patient visualization helpers for postprocessing.

Produces side-by-side plots per trial:
 - Left: ground-truth trajectory from simulation_data.json with decision change markers
 - Right: single participant response probabilities (no CI, thicker lines)

Relies only on the per-trial outputs already produced by postprocessing:
 - simulation_data.json
 - human_data.csv (columns: session_id, frame, red, green, uncertain, trial_id, global_trial_name, rg_outcome)
"""

import os
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import cv2
from PIL import Image
from typing import NamedTuple, List, Tuple

# Professional color palette (copied exactly from rg_lines.py)
COLOR_PALETTE = {
    "green": "green",  # Original green
    "red": "red",  # Original red
    "blue": "blue",  # Original blue
    "green_light": "#a8e6cf",  # Light green for fill
    "red_light": "#f8a5a5",  # Light red for fill
    "blue_light": "#a8d8f0",  # Light blue for fill
    "grid": "#e0e0e0",  # Light gray for grid
    "text": "#2c3e50",  # Dark blue-gray for text
    "axis": "#7f8c8d",  # Medium gray for axes
}


# Functions copied exactly from stimuli.py
def discrete_obs_to_rgb(discrete_obs: np.ndarray) -> np.ndarray:
    """Convert discrete observations to RGB video.

    Maps discrete pixel values to RGB colors for visualization.

    Args:
        discrete_obs: Discrete observations. Shape: (T, H, W).

    Returns:
        RGB video frames. Shape: (T, H, W, 3).
    """
    # Convert to numpy array if not already
    discrete_obs = np.array(discrete_obs)

    # Initialize RGB output array
    rgb_video = np.zeros((*discrete_obs.shape, 3), dtype=np.uint8)

    # Create color mapping - background (0) defaults to black, will be set to white
    rgb_video[discrete_obs == 0] = [255, 255, 255]  # White background
    rgb_video[discrete_obs == 1] = [128, 128, 128]  # Gray
    rgb_video[discrete_obs == 2] = [0, 0, 255]  # Blue (target)
    rgb_video[discrete_obs == 3] = [0, 0, 0]  # Black (barriers)
    rgb_video[discrete_obs == 4] = [255, 0, 0]  # Red (red sensor)
    rgb_video[discrete_obs == 5] = [0, 255, 0]  # Green (green sensor)

    return rgb_video


def create_video_from_simulation_data(simulation_data, pixel_density=20, skip_t=1):
    """
    Convert simulation data to RGB video frames.

    Creates RGB video frames from JTAP simulation data. The scene coordinate system uses:
    - Origin (0,0) at bottom-left of scene
    - X-axis increases rightward
    - Y-axis increases upward

    Video frames use standard image indexing:
    - frame[y, x, channel] where y=0 is top row, x=0 is left column
    - Channels: 0=Red, 1=Green, 2=Blue

    Color mapping:
    - White (255,255,255): Background
    - Black (0,0,0): Barriers
    - Red (255,0,0): Red sensor
    - Green (0,255,0): Green sensor
    - Blue (0,0,255): Target object
    - Gray (128,128,128): Occluders
    """
    # Extract scene dimensions

    # important to round the values to 2 decimal places
    # otherwise the entities may be off by 1 pixel
    def rnd(x):
        return round(x, 2)

    scene_width, scene_height = simulation_data["scene_dims"]

    # Get step data and sort by timestep
    step_data = simulation_data["step_data"]
    timesteps = sorted([int(k) for k in step_data])[::skip_t]

    # Precompute pixel dimensions
    frame_height = scene_height * pixel_density
    frame_width = scene_width * pixel_density

    # Create base frame with static elements (white background, barriers, sensors)
    base_frame = np.full((frame_height, frame_width, 3), 255, dtype=np.uint8)
    discrete_obs_base_frame = np.zeros((frame_height, frame_width), dtype=np.int8)

    # Draw barriers (black rectangles) on base frame
    for barrier in simulation_data["barriers"]:
        x, y, width, height = (
            rnd(barrier["x"]),
            rnd(barrier["y"]),
            rnd(barrier["width"]),
            rnd(barrier["height"]),
        )
        # Convert to pixel coordinates
        # Flip Y coordinate: y_flipped = scene_height - y - height
        x_px = max(int(x * pixel_density), 0)
        y_px = max(int(rnd(scene_height - y - height) * pixel_density) - 1, 0)
        w_px = int(width * pixel_density)
        h_px = int(height * pixel_density)

        # Draw barrier as black rectangle
        base_frame[y_px : y_px + h_px, x_px : x_px + w_px] = 0  # Black
        discrete_obs_base_frame[y_px : y_px + h_px, x_px : x_px + w_px] = 3

    # Draw red sensor on base frame
    red_sensor = simulation_data["red_sensor"]
    x, y, width, height = (
        rnd(red_sensor["x"]),
        rnd(red_sensor["y"]),
        rnd(red_sensor["width"]),
        rnd(red_sensor["height"]),
    )
    # Flip Y coordinate: y_flipped = scene_height - y - height
    x_px = max(int(x * pixel_density), 0)
    y_px = max(int(rnd(scene_height - y - height) * pixel_density) - 1, 0)
    w_px = int(width * pixel_density)
    h_px = int(height * pixel_density)
    base_frame[y_px : y_px + h_px, x_px : x_px + w_px, 0] = 255  # Red
    base_frame[y_px : y_px + h_px, x_px : x_px + w_px, 1:] = 0
    discrete_obs_base_frame[y_px : y_px + h_px, x_px : x_px + w_px] = 4

    # Draw green sensor on base frame
    green_sensor = simulation_data["green_sensor"]
    x, y, width, height = (
        rnd(green_sensor["x"]),
        rnd(green_sensor["y"]),
        rnd(green_sensor["width"]),
        rnd(green_sensor["height"]),
    )
    # Flip Y coordinate: y_flipped = scene_height - y - height
    x_px = max(int(x * pixel_density), 0)
    y_px = max(int(rnd(scene_height - y - height) * pixel_density) - 1, 0)
    w_px = int(width * pixel_density)
    h_px = int(height * pixel_density)
    base_frame[y_px : y_px + h_px, x_px : x_px + w_px, 1] = 255  # Green
    base_frame[y_px : y_px + h_px, x_px : x_px + w_px, [0, 2]] = 0
    discrete_obs_base_frame[y_px : y_px + h_px, x_px : x_px + w_px] = 5

    # Precompute all static elements for faster copying
    num_frames = len(timesteps)
    rgb_video = np.empty((num_frames, frame_height, frame_width, 3), dtype=np.uint8)
    discrete_obs_video = np.empty((num_frames, frame_height, frame_width), dtype=np.int8)
    partially_occluded_bool = np.empty(num_frames, dtype=bool)
    fully_occluded_bool = np.empty(num_frames, dtype=bool)

    # Precompute occluder rectangles in scene coordinates and pixel coordinates
    occluders = simulation_data["occluders"]
    occluder_rects = []
    occluder_pixel_rects = []
    for occ in occluders:
        # Scene coordinates
        x0 = rnd(occ["x"])
        y0 = rnd(occ["y"])
        x1 = x0 + rnd(occ["width"])
        y1 = y0 + rnd(occ["height"])
        occluder_rects.append((x0, y0, x1, y1))

        # Pixel coordinates for faster rendering
        x_px = max(int(x0 * pixel_density), 0)
        y_px = max(int(rnd(scene_height - y0 - occ["height"]) * pixel_density) - 1, 0)
        w_px = int(rnd(occ["width"]) * pixel_density)
        h_px = int(rnd(occ["height"]) * pixel_density)
        occluder_pixel_rects.append((y_px, y_px + h_px, x_px, x_px + w_px))

    target_size = rnd(simulation_data["target"]["size"])
    target_radius = target_size / 2
    target_radius_px = int(target_radius * pixel_density)
    target_radius_px_sq = target_radius_px**2

    def is_circle_intersecting_box(box_x1, box_y1, box_x2, box_y2, circle_x, circle_y, radius):
        # Find the closest point on the rectangle to the circle center
        closest_x = min(max(circle_x, box_x1), box_x2)
        closest_y = min(max(circle_y, box_y1), box_y2)
        dist_sq = (closest_x - circle_x) ** 2 + (closest_y - circle_y) ** 2
        # STRICTLY LESS THAN is when the circle is finally intersecting the box
        return dist_sq < radius**2

    for i, timestep in enumerate(timesteps):
        # Start with base frame
        rgb_video[i] = base_frame
        discrete_obs_video[i] = discrete_obs_base_frame

        # Draw target (blue circle)
        step = step_data[str(timestep)]
        target_x, target_y = step["x"], step["y"]
        # The x, y position refers to bottom left of bounding box, so add radius to get center
        target_center_x = target_x + target_radius
        target_center_y = target_y + target_radius

        target_center_x_px = int(target_center_x * pixel_density)
        target_center_y_px = int((scene_height - target_center_y) * pixel_density)  # Flip Y

        # Create circle mask more efficiently
        y_min = max(0, target_center_y_px - target_radius_px)
        y_max = min(frame_height, target_center_y_px + target_radius_px + 1)
        x_min = max(0, target_center_x_px - target_radius_px)
        x_max = min(frame_width, target_center_x_px + target_radius_px + 1)

        # Only compute mask for relevant region
        y_coords, x_coords = np.ogrid[y_min:y_max, x_min:x_max]
        mask = (x_coords - target_center_x_px + 0.5) ** 2 + (
            y_coords - target_center_y_px + 0.5
        ) ** 2 < target_radius_px_sq

        # Apply target color to relevant region
        rgb_video[i, y_min:y_max, x_min:x_max][mask, 2] = 255  # Blue
        rgb_video[i, y_min:y_max, x_min:x_max][mask, :2] = 0  # Clear red/green
        discrete_obs_video[i, y_min:y_max, x_min:x_max][mask] = 2

        # Draw occluders (gray rectangles) - must be rendered after target to occlude it
        for y_start, y_end, x_start, x_end in occluder_pixel_rects:
            # Draw occluder as gray rectangle
            rgb_video[i, y_start:y_end, x_start:x_end] = 128  # Gray
            discrete_obs_video[i, y_start:y_end, x_start:x_end] = 1

        # Check if there are any blue pixels (target visible) - more efficient check
        is_fully_occluded = not np.any(discrete_obs_video[i] == 2)

        # --- Compute occlusion booleans using ground truth geometry (target is a circle) ---
        # Partially occluded: the circle intersects any occluder, but is not fully occluded
        is_partially_occluded = False
        if not is_fully_occluded:
            for ox0, oy0, ox1, oy1 in occluder_rects:
                if is_circle_intersecting_box(
                    ox0, oy0, ox1, oy1, target_center_x, target_center_y, target_radius
                ):
                    is_partially_occluded = True
                    break

        fully_occluded_bool[i] = is_fully_occluded
        partially_occluded_bool[i] = is_partially_occluded

        assert not (is_fully_occluded and is_partially_occluded), (
            "Target is both fully and partially occluded"
        )

    return rgb_video, partially_occluded_bool, fully_occluded_bool, discrete_obs_video


def calculate_trial_score(human_data_df: pd.DataFrame, rg_outcome: str) -> float:
    """
    Calculate trial score using the same logic as run_redgreen_experiment.py
    
    Score = 20 + 100 * ((num_correct / num_frames) - (num_incorrect / num_frames))
    Where correct/incorrect determined by comparing participant choices to ground truth rg_outcome.
    
    Args:
        human_data_df: DataFrame with columns: frame, red, green, uncertain
        rg_outcome: Ground truth outcome ('red' or 'green')
    
    Returns:
        Calculated score (range: -80 to 120)
    """
    num_frames = len(human_data_df)
    num_red = human_data_df['red'].sum()
    num_green = human_data_df['green'].sum()
    
    if rg_outcome == 'red':
        # Correct answer is red: reward red responses, penalize green
        score = 20 + 100 * ((num_red / num_frames) - (num_green / num_frames))
    elif rg_outcome == 'green':
        # Correct answer is green: reward green responses, penalize red
        score = 20 + 100 * ((num_green / num_frames) - (num_red / num_frames))
    else:
        # No ground truth available
        score = 0
    
    return score


def find_decision_changes(human_data_df: pd.DataFrame) -> List[Tuple[int, str]]:
    """
    Find frames where the participant's decision changes.
    
    Returns list of (frame, change_type) tuples where change_type is:
    - 'green': participant pressed green (transitioned from uncertain/red to green)
    - 'red': participant pressed red (transitioned from uncertain/green to red)
    - 'release': participant released button (transitioned to uncertain, only if not immediately swapped)
    
    Args:
        human_data_df: DataFrame sorted by frame with columns: frame, red, green, uncertain
    
    Returns:
        List of (frame, change_type) tuples
    """
    changes = []
    prev_state = None  # None, 'green', 'red', or 'uncertain'
    
    for idx, row in human_data_df.iterrows():
        frame = int(row['frame'])  # Ensure frame is int
        red = int(row['red'])
        green = int(row['green'])
        uncertain = int(row['uncertain'])
        
        # Determine current state (prioritize green/red over uncertain)
        if green == 1:
            current_state = 'green'
        elif red == 1:
            current_state = 'red'
        else:
            current_state = 'uncertain'
        
        # Detect changes (only if state actually changed)
        if prev_state is not None and current_state != prev_state:
            # Transition TO green or red (button press)
            if current_state == 'green':
                changes.append((frame, 'green'))
            elif current_state == 'red':
                changes.append((frame, 'red'))
            # Transition TO uncertain (button release) - only if not immediately swapped
            elif current_state == 'uncertain' and prev_state in ['green', 'red']:
                # Check next frame to see if it's immediately swapped
                is_immediately_swapped = False
                if idx + 1 < len(human_data_df):
                    next_row = human_data_df.iloc[idx + 1]
                    next_red = int(next_row['red'])
                    next_green = int(next_row['green'])
                    # If next frame has a button pressed (swapped), don't mark as release
                    if next_red == 1 or next_green == 1:
                        is_immediately_swapped = True
                
                # Only mark as release if not immediately swapped
                if not is_immediately_swapped:
                    changes.append((frame, 'release'))
        
        prev_state = current_state
    
    return changes


def draw_stimulus_image_with_decision_markers(
    simulation_data,
    ground_truth_positions,
    discrete_obs,
    fps,
    skip_t,
    diameter,
    pixel_density,
    decision_changes: List[Tuple[int, str]],
    frame=0,
    line_color=(0, 0, 0),
    line_thickness=0.5,
    text_color=(0, 0, 0),
    font_scale=1.0,
    font_thickness=0.5,
    marker_color=(255, 140, 0),  # more orange
    marker_radius=4,
    marker_border_thickness=1,
    show_blue_dotted_ring=False,
    custom_rgb_video=None,
    horizontal_offsets=(0, 0),
    vertical_offsets=(0, 0),
):
    """
    Overlays the trajectory and decision change markers on a custom RGB video frame.
    Based on draw_stimulus_image from figure_visuals.py, with added decision markers.
    """
    stimulus_fps = fps

    FPS = stimulus_fps
    effective_fps = stimulus_fps / skip_t

    base_height, base_width = discrete_obs.shape[1], discrete_obs.shape[2]

    if custom_rgb_video is not None:
        assert isinstance(custom_rgb_video, np.ndarray) and custom_rgb_video.ndim == 4, (
            "custom_rgb_video must be a numpy array of shape [T, H, W, 3]"
        )
        assert 0 <= frame < custom_rgb_video.shape[0], "frame out of bounds for custom_rgb_video"
        frame_rgb = custom_rgb_video[frame]

        full_height, full_width = frame_rgb.shape[:2]
        border_left, border_right = horizontal_offsets
        border_top, border_bottom = vertical_offsets

        scene_width = full_width - border_left - border_right
        scene_height = full_height - border_top - border_bottom

        assert abs((scene_width / scene_height) - (base_width / base_height)) < 1e-6, (
            f"Scene area aspect ratio (video minus border) ({scene_width / scene_height:.4f}) != path/discrete_obs aspect ratio ({base_width / base_height:.4f})"
        )

        scale_x = scene_width / base_width
        scale_y = scene_height / base_height
        upscale_factor = (scale_x + scale_y) / 2.0

        def uv_scene_to_rgb(u, v):
            u2 = u * scale_x
            v2 = v * scale_y
            return u2 + border_left, v2 + border_top

        high_res_image = frame_rgb.copy()
    else:
        frame_discrete_obs = discrete_obs[frame : frame + 1]
        rgb_frame = discrete_obs_to_rgb(frame_discrete_obs)[0]
        upscale_factor = 4
        scale_x = scale_y = upscale_factor
        high_res_image = cv2.resize(
            rgb_frame,
            (int(rgb_frame.shape[1] * upscale_factor), int(rgb_frame.shape[0] * upscale_factor)),
            interpolation=cv2.INTER_NEAREST,
        )
        border_left = border_right = border_top = border_bottom = 0
        scene_width, scene_height = rgb_frame.shape[1], rgb_frame.shape[0]

        def uv_scene_to_rgb(u, v):
            return u * upscale_factor, v * upscale_factor

    # Convert base image to BGR for OpenCV drawing (colors will be correct after final RGB conversion)
    high_res_image = cv2.cvtColor(high_res_image, cv2.COLOR_RGB2BGR)
    # Convert marker color (provided in RGB) to BGR for OpenCV
    bgr_marker_color = (marker_color[2], marker_color[1], marker_color[0])

    image_height = base_height

    def xy_to_uv(x, y):
        u = (x + 0.5 * diameter) * pixel_density
        v = image_height - (y + 0.5 * diameter) * pixel_density
        return u, v

    # For compatibility/annotation placement
    pdata = {}
    for i, (x, y) in enumerate(ground_truth_positions):
        pdata[i] = {"x": x, "y": y}
    sorted_frames = sorted(pdata.keys())

    def safe_int_thick(val):
        return max(1, int(round(val)))

    # --- Draw trajectory ---
    for i in range(1, len(sorted_frames)):
        prev_frame = sorted_frames[i - 1]
        current_frame = sorted_frames[i]

        x1_uv, y1_uv = xy_to_uv(pdata[prev_frame]["x"], pdata[prev_frame]["y"])
        x2_uv, y2_uv = xy_to_uv(pdata[current_frame]["x"], pdata[current_frame]["y"])

        x1, y1 = uv_scene_to_rgb(x1_uv, y1_uv)
        x2, y2 = uv_scene_to_rgb(x2_uv, y2_uv)

        cv2.line(
            high_res_image,
            (int(round(x1)), int(round(y1))),
            (int(round(x2)), int(round(y2))),
            line_color,
            safe_int_thick(line_thickness * upscale_factor),
            lineType=cv2.LINE_AA,
        )

    # --- Draw decision change markers ---
    # Create a mapping from frame to position
    frame_to_pos = {}
    for i, (x, y) in enumerate(ground_truth_positions):
        frame_to_pos[i] = (x, y)
    
    # Draw crosses at decision change points
    cross_size = int(6 * upscale_factor)  # Size of cross arms (3/4 of original 8)
    cross_thickness = max(3, int(1.5 * upscale_factor))  # 1.5x thickness
    
    for change_frame, change_type in decision_changes:
        # Map frame number to position index (frame should match index in ground_truth_positions)
        if change_frame < len(ground_truth_positions):
            x, y = ground_truth_positions[change_frame]
            x_uv, y_uv = xy_to_uv(x, y)
            xs, ys = uv_scene_to_rgb(x_uv, y_uv)
            xs, ys = int(round(xs)), int(round(ys))
            
            # Choose color based on change type
            if change_type == 'green':
                cross_color = (0, 255, 0)  # Green in BGR
            elif change_type == 'red':
                cross_color = (0, 0, 255)  # Red in BGR
            elif change_type == 'release':
                cross_color = (255, 0, 0)  # Blue in BGR
            else:
                continue  # Skip unknown change types
            
            # Draw cross
            cv2.line(
                high_res_image,
                (xs - cross_size, ys - cross_size),
                (xs + cross_size, ys + cross_size),
                cross_color,
                cross_thickness,
                lineType=cv2.LINE_AA,
            )
            cv2.line(
                high_res_image,
                (xs - cross_size, ys + cross_size),
                (xs + cross_size, ys - cross_size),
                cross_color,
                cross_thickness,
                lineType=cv2.LINE_AA,
            )

    def find_clear_position(img, x, y, text, search_radius=20):
        h, w, _ = img.shape
        safe_font_thickness = max(1, int(round(font_thickness * upscale_factor)))
        text_size = cv2.getTextSize(
            text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, safe_font_thickness
        )[0]
        for r in range(1, search_radius):
            for dx, dy in [(-r, 0), (r, 0), (0, -r), (0, r)]:
                nx, ny = int(x + dx), int(y + dy)
                x_end, y_end = nx + (text_size[0] + 3), ny - (text_size[1] + 3)
                if 0 <= nx < w and 0 <= ny < h and 0 <= x_end < w and 0 <= y_end < h:
                    region = img[ny - (text_size[1] + 3) : ny, nx:x_end]
                    if not np.any(np.all(region < 27, axis=-1)):
                        return nx, ny
        return x, y

    # Annotate seconds
    max_time_seconds = (max(sorted_frames)) / effective_fps
    num_whole_seconds = int(np.floor(max_time_seconds)) + 1

    for s in range(num_whole_seconds):
        target_frame = s * effective_fps
        text = str(s)

        frame_before = int(np.floor(target_frame))
        frame_after = int(np.ceil(target_frame))

        if frame_before == frame_after and frame_before in pdata:
            interp_x = pdata[frame_before]["x"]
            interp_y = pdata[frame_before]["y"]
            point_frame = frame_before
        elif frame_before in pdata and frame_after in pdata and frame_before != frame_after:
            x0, y0 = pdata[frame_before]["x"], pdata[frame_before]["y"]
            x1_, y1_ = pdata[frame_after]["x"], pdata[frame_after]["y"]
            t = (target_frame - frame_before) / (frame_after - frame_before)
            interp_x = x0 + t * (x1_ - x0)
            interp_y = y0 + t * (y1_ - y0)
            point_frame = (
                frame_before
                if abs(target_frame - frame_before) < abs(target_frame - frame_after)
                else frame_after
            )
        elif frame_before in pdata:
            interp_x = pdata[frame_before]["x"]
            interp_y = pdata[frame_before]["y"]
            point_frame = frame_before
        elif frame_after in pdata:
            interp_x = pdata[frame_after]["x"]
            interp_y = pdata[frame_after]["y"]
            point_frame = frame_after
        else:
            continue

        x_uv, y_uv = xy_to_uv(interp_x, interp_y)
        xs, ys = uv_scene_to_rgb(x_uv, y_uv)

        cv2.circle(
            high_res_image,
            (int(round(xs)), int(round(ys))),
            int(marker_radius * upscale_factor // 4 + marker_border_thickness),
            (0, 0, 0),
            thickness=-1,
            lineType=cv2.LINE_AA,
        )
        cv2.circle(
            high_res_image,
            (int(round(xs)), int(round(ys))),
            int(marker_radius * upscale_factor // 4),
            bgr_marker_color,
            thickness=-1,
            lineType=cv2.LINE_AA,
        )

        # Draw blue dotted ring if requested, but DO NOT for the rendered frame itself
        if show_blue_dotted_ring and (point_frame != frame):
            ball_diameter_world = diameter
            if ball_diameter_world is not None:
                ball_radius_pixels = (ball_diameter_world / 2.0) * pixel_density
            else:
                ball_radius_pixels = marker_radius

            if custom_rgb_video is not None:
                ring_radius = int(round(ball_radius_pixels * upscale_factor))
            else:
                ring_radius = int(round(ball_radius_pixels * upscale_factor))

            ring_color = (0, 0, 255)  # OpenCV: BGR (pure blue)

            num_dots = min(16, int(2 * np.pi * ring_radius / 3))
            dot_radius = 1

            for i in range(num_dots):
                theta = 2 * np.pi * i / num_dots
                cx = int(round(xs + ring_radius * np.cos(theta)))
                cy = int(round(ys + ring_radius * np.sin(theta)))
                cv2.circle(
                    high_res_image,
                    (cx, cy),
                    dot_radius,
                    ring_color,
                    thickness=-1,
                    lineType=cv2.LINE_AA,
                )

        x_clear, y_clear = find_clear_position(high_res_image, xs, ys - 15, text)
        y_adjust = 0

        safe_font_thickness = max(1, int(round(font_thickness * upscale_factor)))
        cv2.putText(
            high_res_image,
            text,
            (int(x_clear), int(y_clear - y_adjust)),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            text_color,
            thickness=safe_font_thickness,
            lineType=cv2.LINE_AA,
        )

    # Convert back to RGB for PIL/matplotlib display
    high_res_image = cv2.cvtColor(high_res_image, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(high_res_image)
    return pil_image


def plot_human_only_trial(trial_dir, output_path):
    """Create one plot for a single trial_dir and save to output_path."""
    sim_path = os.path.join(trial_dir, "simulation_data.json")
    human_path = os.path.join(trial_dir, "human_data.csv")
    trial_name = os.path.basename(trial_dir.rstrip("/"))

    if not os.path.exists(sim_path) or not os.path.exists(human_path):
        raise FileNotFoundError(f"Missing simulation_data or human_data for {trial_name}")

    with open(sim_path, "r") as f:
        sim_data = json.load(f)

    # Load human data CSV
    human_data_df = pd.read_csv(human_path)
    human_data_df = human_data_df.sort_values("frame").reset_index(drop=True)
    
    # Get rg_outcome from CSV (should be same for all rows)
    rg_outcome = human_data_df['rg_outcome'].iloc[0] if 'rg_outcome' in human_data_df.columns else sim_data.get('rg_outcome', 'none')
    
    # Calculate score
    score = calculate_trial_score(human_data_df, rg_outcome)
    
    # Find decision changes
    decision_changes = find_decision_changes(human_data_df)
    
    # Compute single-participant output (no averaging needed)
    # For single participant, output is just the keypress values
    human_output = np.zeros((len(human_data_df), 3))
    human_output[:, 0] = human_data_df['green'].values  # Green
    human_output[:, 1] = human_data_df['red'].values     # Red
    human_output[:, 2] = human_data_df['uncertain'].values  # Uncertain

    # Create video and discrete_obs from simulation_data
    pixel_density = 10
    skip_t = 1
    rgb_video, partially_occluded_bool, fully_occluded_bool, discrete_obs = create_video_from_simulation_data(
        sim_data, pixel_density=pixel_density, skip_t=skip_t
    )

    # Extract ground truth positions
    step_data = sim_data["step_data"]
    timesteps = sorted([int(k) for k in step_data])[::skip_t]
    ground_truth_positions = np.array(
        [[step_data[str(t)]["x"], step_data[str(t)]["y"]] for t in timesteps]
    )
    diameter = sim_data["target"]["size"]
    fps = sim_data["fps"]

    # Create stimulus image with decision markers
    stimulus_image = draw_stimulus_image_with_decision_markers(
        sim_data,
        ground_truth_positions,
        discrete_obs,
        fps,
        skip_t,
        diameter,
        pixel_density,
        decision_changes,
        frame=0,
        show_blue_dotted_ring=False,
    )
    stimulus_array = np.array(stimulus_image)

    # Create figure with stimulus on left, human plot on right
    fig = plt.figure(figsize=(14, 5))
    gs = plt.GridSpec(1, 2, figure=fig, width_ratios=[0.6, 1], wspace=0.4)

    # Left: stimulus image
    ax_stim = fig.add_subplot(gs[0, 0])
    h, w = stimulus_array.shape[:2]
    ax_stim.imshow(stimulus_array, aspect="equal")
    ax_stim.set_xlim(0, w)
    ax_stim.set_ylim(h, 0)
    ax_stim.set_xticks([])
    ax_stim.set_yticks([])
    ax_stim.set_xticklabels([])
    ax_stim.set_yticklabels([])
    for spine in ax_stim.spines.values():
        spine.set_visible(True)
        spine.set_color("black")
        spine.set_linewidth(1.5)
    ax_stim.set_title(
        trial_name,
        fontsize=18,
        fontweight="bold",
        color="#2c3e50",
        pad=20,
        style="normal",
    )

    # Right: human responses (thicker lines, no CI)
    ax = fig.add_subplot(gs[0, 1])

    # Time values
    time_values = np.arange(human_output.shape[0])
    if fps is not None:
        adjusted_fps = fps / skip_t
        time_values = time_values / adjusted_fps
        xlabel = "Time (s)"
    else:
        xlabel = "Time (frames)"

    # Plot lines with thicker linewidth
    lines_green = ax.plot(
        time_values,
        human_output[:, 0],
        label="Green",
        color=COLOR_PALETTE["green"],
        linewidth=3.0,  # Thicker lines
        alpha=0.9,
    )
    lines_red = ax.plot(
        time_values,
        human_output[:, 1],
        label="Red",
        color=COLOR_PALETTE["red"],
        linewidth=3.0,  # Thicker lines
        alpha=0.9,
    )
    lines_unc = ax.plot(
        time_values,
        human_output[:, 2],
        label="Uncertain",
        color=COLOR_PALETTE["blue"],
        linewidth=3.0,  # Thicker lines
        alpha=0.9,
    )

    # Styling
    ax.axhline(
        y=0,
        color=COLOR_PALETTE["axis"],
        linestyle="--",
        linewidth=0.8,
        alpha=0.6,
        zorder=1,
    )
    ax.axhline(
        y=1,
        color=COLOR_PALETTE["axis"],
        linestyle="--",
        linewidth=0.8,
        alpha=0.6,
        zorder=1,
    )

    ax.set_xlabel(
        xlabel,
        fontsize=15,
        fontweight="medium",
        color=COLOR_PALETTE["text"],
        labelpad=8,
    )
    ax.set_ylabel(
        "Proportions", fontsize=15, fontweight="medium", color=COLOR_PALETTE["text"], labelpad=8
    )
    ax.set_title(
        f"ECoG Patient Response (Dec 2025) Score: {score:.2f}",
        fontsize=17,
        fontweight="semibold",
        color=COLOR_PALETTE["text"],
        pad=18,
    )

    ax.tick_params(
        axis="both",
        which="major",
        labelsize=13,
        colors=COLOR_PALETTE["text"],
        width=0.8,
        length=4,
        pad=5,
    )
    ax.tick_params(axis="both", which="minor", labelsize=11, colors=COLOR_PALETTE["text"])

    for spine in ax.spines.values():
        spine.set_color(COLOR_PALETTE["axis"])
        spine.set_linewidth(0.8)
        spine.set_alpha(0.7)

    ax.grid(
        True,
        which="major",
        linestyle="-",
        linewidth=0.5,
        color=COLOR_PALETTE["grid"],
        alpha=0.5,
        zorder=0,
    )
    ax.grid(
        True,
        which="minor",
        linestyle=":",
        linewidth=0.3,
        color=COLOR_PALETTE["grid"],
        alpha=0.3,
        zorder=0,
    )
    ax.set_axisbelow(True)
    ax.set_facecolor("white")

    # Legend
    legend_handles = [lines_green[0], lines_red[0], lines_unc[0]]
    legend_labels = ["Green", "Red", "Uncertain"]
    ax.legend(
        legend_handles,
        legend_labels,
        loc="best",
        fontsize=13,
        frameon=True,
        fancybox=True,
        shadow=True,
        framealpha=0.95,
        edgecolor="none",
        facecolor="white",
        borderpad=0.8,
        labelspacing=0.7,
        handletextpad=1.1,
        handlelength=2.5,
    )

    fig.patch.set_facecolor("white")
    plt.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return output_path


def plot_all_human_only_trials(path_to_data, output_dir):
    """Plot all trials under path_to_data that contain human_data.csv and simulation_data.json."""
    os.makedirs(output_dir, exist_ok=True)
    trials = [
        d for d in sorted(os.listdir(path_to_data))
        if os.path.isdir(os.path.join(path_to_data, d))
    ]

    saved = []
    for trial_name in trials:
        trial_dir = os.path.join(path_to_data, trial_name)
        sim_path = os.path.join(trial_dir, "simulation_data.json")
        human_path = os.path.join(trial_dir, "human_data.csv")
        if not (os.path.exists(sim_path) and os.path.exists(human_path)):
            continue
        out_path = os.path.join(output_dir, f"{trial_name}_human_plot.png")
        try:
            plot_human_only_trial(
                trial_dir,
                out_path,
            )
            saved.append(out_path)
        except Exception as e:
            print(f"Failed to plot {trial_name}: {e}")
    print(f"Saved {len(saved)} human-only plots to {output_dir}")
    return saved
