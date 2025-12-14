#!/bin/bash
# Script to run Flask app with Gunicorn (better performance)

echo "Starting Gunicorn server..."
echo "Access at: http://localhost:8000"
echo ""
echo "To expose via ngrok, run in another terminal:"
echo "  ngrok http 8000"
echo ""

cd "$(dirname "$0")"

# Check if gunicorn is installed
if ! command -v gunicorn &> /dev/null; then
    echo "Gunicorn not found. Installing..."
    pip install gunicorn
fi

# Initialize database
python -c "from run_redgreen_experiment import app, db; app.app_context().push(); db.create_all(); print('Database initialized.')"

# Start gunicorn
gunicorn -c gunicorn_config.py run_redgreen_experiment:app
