# Local Development Setup Guide

## Understanding Your Options

### Option 1: Simple Flask Dev Server (Easiest - Local Only)
- **Best for**: Testing on your laptop only
- **Access**: Only accessible at `http://localhost:5000` on your machine
- **Pros**: Simplest setup, no extra tools needed
- **Cons**: Can't access from other devices (phone, tablet, etc.)

### Option 2: Flask Dev Server + ngrok (Best for Testing)
- **Best for**: Testing from multiple devices or sharing with others temporarily
- **Access**: Public URL via ngrok (e.g., `https://abc123.ngrok.io`)
- **Pros**: Easy setup, works with your home WiFi, free
- **Cons**: URL changes each time (unless paid plan), not for production

### Option 3: Gunicorn + ngrok (Better Performance)
- **Best for**: When you need better performance than Flask dev server
- **Access**: Public URL via ngrok
- **Pros**: Production-grade server, handles multiple requests better
- **Cons**: More setup, still need ngrok for external access

### Option 4: Gunicorn + nginx (Production Setup)
- **Best for**: Permanent deployment on a server
- **Access**: Your own domain or IP
- **Pros**: Production-ready, handles SSL, reverse proxy
- **Cons**: Complex setup, requires server/VPS, not for laptop development

## Recommendation for Your Use Case

Since you're on a **laptop with home WiFi** and want to use **local data**, I recommend:

1. **Start with Option 2 (Flask + ngrok)** - easiest way to test from multiple devices
2. If you need better performance, upgrade to **Option 3 (Gunicorn + ngrok)**

---

## Quick Start: Option 2 (Flask + ngrok) - RECOMMENDED

### Step 1: Install ngrok
```bash
# macOS (using Homebrew)
brew install ngrok

# Or download from: https://ngrok.com/download
```

### Step 2: Update Flask app to bind to all interfaces
The Flask app needs to listen on `0.0.0.0` (all network interfaces) instead of just `localhost`.

Edit `run_redgreen_experiment.py` line 1128:
```python
# Change from:
app.run(debug=True)

# To:
app.run(host='0.0.0.0', port=5000, debug=True)
```

### Step 3: Start Flask server
```bash
cd backend
python run_redgreen_experiment.py
```

### Step 4: Start ngrok in a new terminal
```bash
ngrok http 5000
```

You'll get a public URL like: `https://abc123.ngrok.io`

### Step 5: Access your app
- Local: `http://localhost:5000`
- Public (via ngrok): `https://abc123.ngrok.io`

**Note**: The ngrok URL changes each time you restart ngrok (unless you have a paid plan with a static domain).

---

## Option 3: Gunicorn + ngrok (Better Performance)

### Step 1: Install gunicorn
```bash
pip install gunicorn
```

### Step 2: Create gunicorn config file
See `gunicorn_config.py` (created below)

### Step 3: Start with gunicorn
```bash
cd backend
gunicorn -c gunicorn_config.py run_redgreen_experiment:app
```

### Step 4: Start ngrok
```bash
ngrok http 8000  # Note: gunicorn uses port 8000 by default
```

---

## Troubleshooting

### Can't access from other devices?
- Make sure Flask is running with `host='0.0.0.0'`
- Check your firewall isn't blocking port 5000
- Verify ngrok is running and shows "Forwarding" status

### Database issues?
- The SQLite database will be created in the `backend` directory
- Make sure you have write permissions

### Port already in use?
- Change the port in `app.run(port=5001)` or gunicorn config
- Update ngrok accordingly: `ngrok http 5001`
