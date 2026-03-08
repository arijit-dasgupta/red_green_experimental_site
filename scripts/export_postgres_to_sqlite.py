#!/usr/bin/env python3
"""
Export Postgres (Heroku or local) to a single SQLite .db file for viewing in DB Browser for SQLite.

Output naming matches the backend's SQLite convention: {DATASET_NAME}_{EXPERIMENT_RUN_VERSION}_redgreen.db
(see backend/run_redgreen_experiment.py). If that file already exists, a new copy is made with
incremental versioning (e.g. ..._redgreen_1.db, ..._redgreen_2.db) so existing exports are never overwritten.

Usage:
  # From Heroku (fetches DATABASE_URL via Heroku CLI; must be logged in):
  python scripts/export_postgres_to_sqlite.py

  # Override dataset/experiment name (otherwise read from backend config):
  python scripts/export_postgres_to_sqlite.py --dataset March072026_PointClick --experiment-version red_green_2026_clickpilot_v0

  # From local Postgres (e.g. after heroku pg:pull):
  python scripts/export_postgres_to_sqlite.py --url "postgresql://localhost/mylocaldb"

  # Force a specific output path (still no overwrite: uses _1, _2, ... if path exists):
  python scripts/export_postgres_to_sqlite.py -o human_raw_data/my_export.db

Note on Heroku Postgres: There is a single database for the app. Changing experiment name, dataset name,
or NUM_PARTICIPANTS in the backend does not create a new DB or new tables—all sessions live in the same
tables. Session rows have experiment_name for filtering. Export naming (dataset + experiment version) is
for your local file organization only.

Requires: psycopg2-binary (in requirements.txt). SQLite support is stdlib.
For Heroku: Heroku CLI installed and logged in (heroku login).
"""

import argparse
import json
import os
import sqlite3
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Error: psycopg2 is required. Install with: pip install psycopg2-binary", file=sys.stderr)
    print(f"  (Python used: {sys.executable})", file=sys.stderr)
    print("  Ensure your conda env is activated: conda activate redgreen_exp", file=sys.stderr)
    sys.exit(1)


# Table order respects foreign keys: parent tables first.
TABLES = ["redgreen_session", "config", "trial", "keystate", "trial_pause_click"]


def get_backend_dataset_and_version(script_dir):
    """Read DATASET_NAME and EXPERIMENT_RUN_VERSION from backend/run_redgreen_experiment.py."""
    backend_path = os.path.join(script_dir, "..", "backend", "run_redgreen_experiment.py")
    backend_path = os.path.abspath(backend_path)
    dataset, version = None, None
    if os.path.isfile(backend_path):
        with open(backend_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATASET_NAME = ") and "=" in line:
                    # DATASET_NAME = 'March072026_PointClick'
                    for sep in ("'", '"'):
                        if sep in line:
                            start = line.find(sep) + 1
                            end = line.find(sep, start)
                            if end > start:
                                dataset = line[start:end]
                                break
                if line.startswith("EXPERIMENT_RUN_VERSION = ") and "=" in line:
                    for sep in ("'", '"'):
                        if sep in line:
                            start = line.find(sep) + 1
                            end = line.find(sep, start)
                            if end > start:
                                version = line[start:end]
                                break
    return dataset or "dataset", version or "experiment_version"


def resolve_output_path(dir_path, base_name):
    """
    Return a path under dir_path that does not exist.
    Uses base_name.db, then base_name_1.db, base_name_2.db, ...
    """
    base = os.path.join(dir_path, base_name)
    candidate = base + ".db"
    if not os.path.exists(candidate):
        return candidate
    n = 1
    while True:
        candidate = f"{base}_{n}.db"
        if not os.path.exists(candidate):
            return candidate
        n += 1


def get_heroku_database_url(app_name):
    """Fetch DATABASE_URL from Heroku config. Returns None if CLI fails or not set."""
    result = subprocess.run(
        ["heroku", "config:get", "DATABASE_URL", "-a", app_name],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0 or not result.stdout or not result.stdout.strip():
        return None
    return result.stdout.strip()


def get_postgres_url(args):
    url = args.url or os.environ.get("DATABASE_URL")
    if not url:
        app = args.app or "redgreen-exp"
        print(f"No DATABASE_URL set. Fetching from Heroku app '{app}'...", file=sys.stderr)
        url = get_heroku_database_url(app)
        if not url:
            print(
                "Error: Could not get DATABASE_URL from Heroku. Run 'heroku login' and ensure the app exists, "
                "or set DATABASE_URL or use --url postgresql://...",
                file=sys.stderr,
            )
            sys.exit(1)
    if url.startswith("postgres://"):
        url = "postgresql://" + url[11:]
    return url


def value_to_sqlite(val):
    """Convert a Postgres row value to something SQLite accepts."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, bool):
        return 1 if val else 0
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    if isinstance(val, (bytes, bytearray)):
        return val
    return val


def copy_table(pg_cur, sqlite_cur, table, session_ids=None):
    """
    Copy table from Postgres to SQLite. If session_ids is set, only export rows
    for that run: for redgreen_session use id IN (...), for others use session_id IN (...).
    """
    if session_ids is not None:
        if table == "redgreen_session":
            if not session_ids:
                return 0
            placeholders = ",".join("%s" for _ in session_ids)
            pg_cur.execute(f'SELECT * FROM "{table}" WHERE id IN ({placeholders}) ORDER BY id', tuple(session_ids))
        else:
            if not session_ids:
                return 0
            placeholders = ",".join("%s" for _ in session_ids)
            pg_cur.execute(f'SELECT * FROM "{table}" WHERE session_id IN ({placeholders}) ORDER BY id', tuple(session_ids))
    else:
        pg_cur.execute(f'SELECT * FROM "{table}" ORDER BY id')
    rows = pg_cur.fetchall()
    if not rows:
        return 0
    colnames = [d[0] for d in pg_cur.description]
    placeholders = ", ".join("?" for _ in colnames)
    cols = ", ".join(f'"{c}"' for c in colnames)
    insert_sql = f'INSERT INTO "{table}" ({cols}) VALUES ({placeholders})'
    count = 0
    for row in rows:
        values = [value_to_sqlite(row[c]) for c in colnames]
        sqlite_cur.execute(insert_sql, values)
        count += 1
    return count


def main():
    parser = argparse.ArgumentParser(
        description="Export Postgres (Heroku or local) to a SQLite .db file for DB Browser."
    )
    parser.add_argument(
        "--url",
        default=None,
        help="Postgres URL. If not set, DATABASE_URL is used or fetched from Heroku.",
    )
    parser.add_argument(
        "--app",
        default="redgreen-exp",
        help="Heroku app name when fetching DATABASE_URL (default: redgreen-exp)",
    )
    parser.add_argument(
        "--dataset",
        default=None,
        help="Dataset name for output filename (default: read from backend DATASET_NAME)",
    )
    parser.add_argument(
        "--experiment-version",
        default=None,
        help="Experiment run version for output filename (default: read from backend EXPERIMENT_RUN_VERSION)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="Exact output .db path (overrides dataset/experiment naming; still uses _1, _2 if file exists)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Export all sessions (no filter by dataset/run version). Default: only sessions matching this run.",
    )
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    human_raw_dir = os.path.join(repo_root, "human_raw_data")
    Path(human_raw_dir).mkdir(parents=True, exist_ok=True)

    pg_url = get_postgres_url(args)

    # Resolve dataset/version for filename and for run filter (when not --all)
    dataset = args.dataset
    version = args.experiment_version
    if dataset is None or version is None:
        read_dataset, read_version = get_backend_dataset_and_version(script_dir)
        dataset = dataset or read_dataset
        version = version or read_version

    if args.output:
        out_path = resolve_output_path(
            os.path.dirname(os.path.abspath(args.output)),
            os.path.splitext(os.path.basename(args.output))[0],
        )
    else:
        base_name = f"{dataset}_{version}_redgreen"
        out_path = resolve_output_path(human_raw_dir, base_name)

    # SQLite schema matching the app's models (compatible with DB Browser).
    # Order matches TABLES so FKs can be created; we skip FKs for maximum compatibility.
    ddl = """
CREATE TABLE IF NOT EXISTS redgreen_session (
    id INTEGER PRIMARY KEY,
    randomized_profile_id INTEGER,
    start_time TEXT,
    prolific_pid TEXT,
    average_score REAL,
    time_taken REAL,
    randomized_trial_order TEXT,
    study_id TEXT,
    prolific_session_id TEXT,
    ignore_data INTEGER,
    completed INTEGER,
    has_timed_out INTEGER,
    end_time TEXT,
    experiment_name TEXT,
    dataset_name TEXT,
    experiment_run_version TEXT,
    post_experiment_feedback TEXT,
    post_experiment_feedback_submitted INTEGER
);

CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL,
    config_data BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS trial (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL,
    start_time TEXT,
    end_time TEXT,
    trial_type TEXT,
    trial_index INTEGER,
    global_trial_name TEXT,
    counterbalance INTEGER,
    score REAL,
    completed INTEGER,
    first_frame_utc TEXT,
    last_frame_utc TEXT,
    symmetry_transform INTEGER,
    is_repeated INTEGER,
    repeat_instance_index INTEGER
);

CREATE TABLE IF NOT EXISTS keystate (
    id INTEGER PRIMARY KEY,
    trial_id INTEGER NOT NULL,
    frame INTEGER,
    f_pressed INTEGER,
    j_pressed INTEGER,
    session_id INTEGER NOT NULL,
    relative_time_ms REAL
);

CREATE TABLE IF NOT EXISTS trial_pause_click (
    id INTEGER PRIMARY KEY,
    trial_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    pause_frame INTEGER NOT NULL,
    click_bottom_left_x REAL NOT NULL,
    click_bottom_left_y REAL NOT NULL,
    ball_x REAL,
    ball_y REAL,
    diameters_away REAL
);
"""

    print(f"Connecting to Postgres...")
    pg_conn = psycopg2.connect(pg_url)
    pg_conn.autocommit = True

    # When not --all, only export sessions for this dataset + run version
    filter_session_ids = None
    if not args.all:
        try:
            pg_cur_find = pg_conn.cursor()
            pg_cur_find.execute(
                "SELECT id FROM redgreen_session WHERE dataset_name = %s AND experiment_run_version = %s ORDER BY id",
                (dataset, version),
            )
            filter_session_ids = [r[0] for r in pg_cur_find.fetchall()]
            pg_cur_find.close()
            print(f"Filtering to run {dataset} / {version}: {len(filter_session_ids)} session(s).")
        except Exception as e:
            if "column" in str(e).lower() and "does not exist" in str(e).lower():
                print("Warning: dataset_name/experiment_run_version columns missing (old DB); exporting all sessions.", file=sys.stderr)
            else:
                raise
            filter_session_ids = None

    print(f"Writing SQLite database: {out_path}")
    sqlite_conn = sqlite3.connect(out_path)
    sqlite_conn.executescript(ddl.strip())

    pg_cur = pg_conn.cursor(cursor_factory=RealDictCursor)
    sqlite_cur = sqlite_conn.cursor()

    total = 0
    for table in TABLES:
        n = copy_table(pg_cur, sqlite_cur, table, session_ids=filter_session_ids)
        total += n
        print(f"  {table}: {n} rows")

    sqlite_conn.commit()
    sqlite_conn.close()
    pg_conn.close()

    print(f"Done. Total rows: {total}. Open {out_path} in DB Browser for SQLite.")


if __name__ == "__main__":
    main()
