#!/bin/bash
# Simple script to run Flask app locally with proper host binding

echo "Starting Flask development server..."
echo "Access at: http://localhost:5000"
echo ""
echo "To expose via ngrok, run in another terminal:"
echo "  ngrok http 5000"
echo ""

cd "$(dirname "$0")"
python run_redgreen_experiment.py
