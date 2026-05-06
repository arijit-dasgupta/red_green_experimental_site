# Red-Green Experiment 2 Dataset

This folder contains the stimulus set and trial metadata for the Red-Green Human Study (Experiment 2).

## Folder structure

Each trial has its own folder, named by trial ID. The experiment 2 trial set uses `F1` to `F6` for familiarization trials and `L1` to `L75` for the main experiment.

Inside each trial folder:

- `simulation_data.json`: the main trial definition. It stores the scene geometry, simulation parameters, and the frame-by-frame ball trajectory from the Pymunk rollout.
- `init_state_entities.json`: the starting scene state before simulation. It records the initial positions and sizes of the ball, barriers, occluders, and goal sensors.
- `{trial_id}_stimulus.mp4`: the rendered stimulus video for that trial.

The familiarization trials `F1` to `F6` use the same basic trial folder structure.

At the top level, this dataset contains 81 trial directories total: 6 familiarization folders and 75 main trial folders.

## Metadata files

- `trial_label.csv`: labels the main trials by phase.
  - `Calibration (No Occlusion)`: `L1` to `L4`
  - `Calibration (Occlusion)`: `L5` to `L16`
  - `Diagnostic`: `L17` to `L32`
  - `Catch`: `L71` to `L75`
- `catch_trials.txt`: one catch trial ID per line.
  - Catch trials: `L71`, `L72`, `L73`, `L74`, `L75`
- `click_points.csv`: defines which trials use click-point pauses and the frame (at 30FPS) at which the pause occurs.

## Simulation schema

`simulation_data.json` is the main source for reconstructing each trial. It is a JSON object with:

- `barriers`: rectangle geometry for all barriers in the scene
- `occluders`: rectangle geometry for all occluders
- `target`: the ball shape metadata, including its size
- `red_sensor` and `green_sensor`: goal-region rectangles
- `scene_dims`: world width and height
- `interval`, `friction`, `elasticity`: simulation constants used by the `pymunk` physics engine
- `timestep`, `timesteps_per_frame`, `num_frames`, `fps`: timing and frame-count settings. A timestep is the physics simulation step, while a frame is the sampled point that becomes part of the rendered video at 30 FPS.
- `step_data`: frame-by-frame ball state, keyed by frame index
  - each frame stores `x`, `y`, `speed`, `dir`, `vx`, and `vy`
- `rg_outcome` and `rg_hit_timestep`: the first goal reached and the frame when it was reached
- `num_barriers` and `num_occs`: counts of barriers and occluders

The JSON file is also used directly by the experiment website to render the trial on a JavaScript canvas at 30 FPS. We do not rely on the MP4 alone for data collection, because the canvas-based rendering lets us record keypresses with frame-level synchronization.

`init_state_entities.json` stores the starting scene before simulation. Each entity includes an `id`, `type`, `x`, `y`, `width`, `height`, and, for the ball, an initial `direction`.
