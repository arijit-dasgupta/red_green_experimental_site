"""
Gunicorn configuration file for production-like local development
"""
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:8000"  # Listen on all interfaces, port 8000
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1  # Recommended formula
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
