"""
Gunicorn configuration file for production-like local development

This configuration sets up Gunicorn (a Python WSGI HTTP Server) to serve the Flask application
with better performance and concurrency than Flask's built-in development server.

KEY CONFIGURATION MEANINGS:

SERVER SOCKET:
- bind = "0.0.0.0:8000": Makes server accessible from any IP address on port 8000
  (0.0.0.0 means "listen on all network interfaces", not just localhost)
- backlog = 2048: Maximum number of pending connections in the socket queue

WORKER PROCESSES:
- workers = multiprocessing.cpu_count() * 2 + 1: Creates multiple worker processes
  Formula: (CPU cores × 2) + 1 - balances CPU and I/O bound operations
- worker_class = "sync": Uses synchronous workers (simpler, good for most Flask apps)
- worker_connections = 1000: Max simultaneous connections per worker
- timeout = 30: Workers restart if they don't respond within 30 seconds
- keepalive = 2: Keep connections alive for 2 seconds to reuse them

LOGGING:
- accesslog/errorlog = "-": Log to stdout/stderr (visible in terminal)
- loglevel = "info": Show info-level messages and above
- access_log_format: Detailed format showing IP, timestamp, request, response, etc.

PROCESS MANAGEMENT:
- proc_name: Sets process name for easier identification in system monitors
- daemon = False: Run in foreground (not background) for development
- pidfile = None: Don't create process ID file (not needed for dev)

SECURITY/PERMISSIONS:
- umask/user/group: File permissions and process ownership (None = use defaults)
- SSL settings: Commented out since we're using HTTP for local development
"""
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:8000"  # Listen on all interfaces, port 8000
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1  # Recommended formula
print(f"Number of workers: {workers}")
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = "redgreen_experiment"

# Server mechanics
daemon = False  # Don't run as daemon (for development)
pidfile = None  # Don't create pidfile (for development)
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (not needed for local dev, but here for reference)
# keyfile = None
# certfile = None
