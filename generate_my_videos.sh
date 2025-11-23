#!/bin/bash
# Script to generate videos from trial data

# Activate virtual environment
source venv/bin/activate

# Set the base directory
TRIAL_DIR="backend/trial_data/chs_training_zoom"

# Generate all E trials
echo "Generating E trials..."
python3 generate_videos_new.py --trial-dir "$TRIAL_DIR" --output-dir generated_videos_E --filter-prefix E

# Generate all T trials
echo "Generating T trials..."
python3 generate_videos_new.py --trial-dir "$TRIAL_DIR" --output-dir generated_videos_T --filter-prefix T

# Generate a specific trial (example)
# python3 generate_videos_new.py --trial-dir "$TRIAL_DIR" --trial-name E1_checker_NO --output-dir my_videos

echo "Done!"

