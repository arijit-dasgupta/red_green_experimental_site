# Quick Start: Run Locally with ngrok

## Prerequisites
1. Python 3.x installed
2. Dependencies installed: `pip install -r requirements.txt`
3. ngrok installed (see below)

## Install ngrok

### macOS (Homebrew)
```bash
brew install ngrok
```

### Manual Installation
1. Go to https://ngrok.com/download
2. Download for macOS
3. Unzip and move to `/usr/local/bin` or add to PATH

### Sign up (Free)
1. Go to https://ngrok.com/signup
2. Get your authtoken
3. Run: `ngrok config add-authtoken YOUR_TOKEN`

## Run the Server

### Method 1: Simple Flask (Recommended for testing)

**Terminal 1 - Start Flask:**
```bash
cd backend
python run_redgreen_experiment.py
```

**Terminal 2 - Start ngrok:**
```bash
ngrok http 5000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:5000
```

**Access your app:**
- Local: http://localhost:5000
- Public: https://abc123.ngrok.io (use this URL to share/test from other devices)

### Method 2: Gunicorn (Better performance)

**Terminal 1 - Start Gunicorn:**
```bash
cd backend
./run_with_gunicorn.sh
# Or manually:
gunicorn -c gunicorn_config.py run_redgreen_experiment:app
```

**Terminal 2 - Start ngrok:**
```bash
ngrok http 8000  # Note: Gunicorn uses port 8000
```

## Using Your Local Data

The app is already configured to use local data from:
- `backend/trial_data/` directory
- Dataset specified by `DATASET_NAME` in `run_redgreen_experiment.py` (currently: `cogsci_2025_trials_reduced`)

To change the dataset, edit line 86 in `run_redgreen_experiment.py`:
```python
DATASET_NAME = 'your_dataset_name'  # Change this
```

## Testing

1. Open the ngrok URL in your browser
2. Or use the localhost URL if testing on the same machine
3. The frontend should load and connect to your local backend
4. All data will be saved to `backend/*.db` (SQLite database)

## Troubleshooting

**Port already in use?**
- Change port in `run_redgreen_experiment.py`: `app.run(host='0.0.0.0', port=5001, debug=True)`
- Update ngrok: `ngrok http 5001`

**Can't access from phone/other device?**
- Make sure Flask is running with `host='0.0.0.0'` (already configured)
- Check ngrok is running and shows "Forwarding" status
- Try the ngrok URL, not localhost (localhost only works on same machine)

**Database errors?**
- Make sure you have write permissions in the `backend` directory
- The database will be created automatically on first run

## Stopping the Server

- Flask/Gunicorn: Press `Ctrl+C` in the terminal
- ngrok: Press `Ctrl+C` in the ngrok terminal
