# Red-Green Experiment

Run the Red-Green experiment locally or deploy to Heroku for online data collection (e.g. Prolific).

## Requirements

- Desktop/laptop
- Conda
- Git
- Node.js and npm (for frontend build)

---

## Local development

### 1. Clone and set up Python

```bash
git clone https://github.com/arijit-dasgupta/red_green_experimental_site.git
cd red_green_experimental_site

conda create -n redgreen_exp python=3.11
conda activate redgreen_exp
pip install -r requirements.txt
```

### 2. Build the frontend

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

(You can ignore deprecation warnings.)

### 3. Run the backend

```bash
python backend/run_redgreen_experiment.py
```

Open **http://127.0.0.1:5000** in your browser.

**Local database:** With no `DATABASE_URL` set, the app uses SQLite. The file is created at:

`human_raw_data/{DATASET_NAME}_{EXPERIMENT_RUN_VERSION}_redgreen.db`

(e.g. `human_raw_data/March072026_PointClick_red_green_2026_clickpilot_v0_redgreen.db`). You can open it in [DB Browser for SQLite](https://sqlitebrowser.org/).

---

## Database

### Local (SQLite)

- **Path:** `human_raw_data/{DATASET_NAME}_{EXPERIMENT_RUN_VERSION}_redgreen.db`
- **Naming:** `DATASET_NAME` and `EXPERIMENT_RUN_VERSION` are set in `backend/run_redgreen_experiment.py`. Changing them creates a new file on next run.
- **Inspection:** Use DB Browser for SQLite or any SQLite client.

### Heroku (Postgres)

- One Postgres database per app. All sessions (all runs) live in the same DB.
- Sessions are tagged with `dataset_name` and `experiment_run_version` so you can filter by run.
- **Size:** `heroku pg:info -a redgreen-exp`
- **Reset (wipe all data):** `heroku pg:reset DATABASE_URL -a redgreen-exp` (confirm when prompted). Redeploying does **not** reset the database.

### Exporting Heroku Postgres to a SQLite file

To get a single `.db` file for DB Browser (e.g. for analysis):

```bash
conda activate redgreen_exp
python scripts/export_postgres_to_sqlite.py
```

- Fetches `DATABASE_URL` from Heroku (requires Heroku CLI and `heroku login`).
- By default exports only sessions for the current run (matching `DATASET_NAME` and `EXPERIMENT_RUN_VERSION` from the backend).
- Output: `human_raw_data/{DATASET_NAME}_{EXPERIMENT_RUN_VERSION}_redgreen.db` (or `..._redgreen_1.db`, etc. if that file already exists—no overwrite).
- **Export everything:** `python scripts/export_postgres_to_sqlite.py --all`
- **From local Postgres (e.g. after pg:pull):** `python scripts/export_postgres_to_sqlite.py --url "postgresql://localhost/mylocaldb"`

---

## Deploying to Heroku

### Prerequisites

- Heroku account and [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- App `redgreen-exp` created and Heroku Postgres add-on attached (e.g. Essential-0)
- Buildpacks: **Node.js** first, then **Python** (Settings → Buildpacks)

### Config vars (Settings → Config Vars)

Set these for your app:

| Variable | Description | Example |
|----------|-------------|---------|
| `BASE_PATH` | URL path prefix for the app | `/march2026v0` |
| `REACT_APP_BASE_PATH` | Same as `BASE_PATH` (for frontend API calls) | `/march2026v0` |
| `PUBLIC_URL` | Same as `BASE_PATH` (for React asset paths) | `/march2026v0` |
| `SECRET_KEY` | Flask secret (random string) | e.g. `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | Set automatically by Heroku Postgres add-on | — |
| `PROLIFIC_COMPLETION_URL` | Prolific completion link (finish page) | `https://app.prolific.com/submissions/complete?cc=YOUR_CC` |
| `TIMEOUT_PERIOD_MINUTES` | Session timeout in minutes | `45` |
| `CHECK_TIMEOUT_INTERVAL_MINUTES` | How often the frontend checks timeout (minutes) | `5` |
| `NPM_CONFIG_PRODUCTION` | Must be `false` so the Node build installs devDependencies (e.g. react-scripts) | `false` |

For a new experiment run you can change only the path prefix, Prolific URL, and timeout via Config Vars; no code change required.

### Deploy

From the repo (with the `heroku` remote added: `heroku git:remote -a redgreen-exp`):

```bash
git push heroku heroku:main
```

(or push your default branch: `git push heroku main` if that branch has the deployment code).

App URL with path prefix: **https://redgreen-exp.herokuapp.com/BASE_PATH** (e.g. `https://redgreen-exp.herokuapp.com/march2026v0`).

### Root files required for Heroku

- **Procfile:** `web: gunicorn backend.run_redgreen_experiment:app --bind 0.0.0.0:$PORT`
- **package.json** (repo root): scripts for Node buildpack to install and build the frontend.

---

## Experiment configuration

- **Trial data:** Stored under `backend/trial_data`. The active dataset is set by `DATASET_NAME` in `backend/run_redgreen_experiment.py`. Familiarization trials use the `FAM_TRIAL_PREFIXES` (e.g. `['F']` → F1, F2, …); experimental trials use `EXP_TRIAL_PREFIXES` (e.g. `['T']` or `['E']`).
- **Prolific completion URL and timeout:** On Heroku, set `PROLIFIC_COMPLETION_URL` and `TIMEOUT_PERIOD_MINUTES` in Config Vars. Locally, edit `PROLIFIC_COMPLETION_URL` and the timeout defaults at the top of `backend/run_redgreen_experiment.py` (or set env vars).
- **Monitoring:** You can run `backend/experiment_monitoring_dashboard.py` locally (stability not guaranteed). On Heroku, use **More → View logs** or `heroku logs --tail -a redgreen-exp`.

---

## Postprocessing

Use `backend/postprocess.ipynb`: set the paths/config in the first cell, then run the notebook to produce a `.pkl` file. For custom code, reuse `extract_human_data` from `backend/postprocess_redgreen_human_data.py` to get pandas dataframes from the database without touching SQLAlchemy directly. Demographics CSV is from Prolific; you can comment out that part if you don’t have it.
