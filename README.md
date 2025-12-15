# Code to run the Red-Green Experiment Locally

Requirements:
- Desktop/Laptop
- Conda
- Git

Step 1: First clone the repo (use https cloning if no ssh key) and enter the directory
```bash
git clone git@github.com:arijit-dasgupta/red_green_experimental_site.git
cd red_green_experimental_site
```

Then install the python requirements in conda

```bash
conda create -n redgreen_exp python=3.11
conda activate redgreen_exp
pip install -r requirements.txt
```


Step 2: Install Node.js and npm (if not already installed)

My `npm` version is `10.9.0` and Node.js version is `v23.3.0`. To be safe, please install these versions

**For Windows:**
- Download and install Node.js from https://nodejs.org/
- This will automatically include npm

**For macOS:**
- Using Homebrew: `brew install node`
- Or download from https://nodejs.org/

**For Linux (Ubuntu/Debian):**
- Update your package index: `sudo apt update`
- Install Node.js and npm: `sudo apt install nodejs npm`

Step 3: Build the frontend (ignore the barrage of deprecation warnings)

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

Step 4: Run the experiment and go to the localhost link shown in the terminal (default is http://127.0.0.1:5000)

```bash
python backend/run_redgreen_experiment.py
```
The data will be automatically saved in a SQLite database `.db` in a folder named `instance` from the folder where the experiment python file is run (in the example above, it will be in the root folder).

## Broadcasting to Internet for Prolific

**REMINDER: Update prolific completion URL, dataset name, exp name and verify shuffling/counterbalance logic is correct**

Tools used: gunicorn (to handle python side traffic handling -- builds on top of Flask) and ngrok (broadcasting to the internet using either a temorary one-time domain, or a fixed domain on the paid version). Refer to `DEPLOYMENT.md` for more instructions.

### Step 1: Gunicorn

After building via `npm`, run the following in one terminal:

```bash
gunicorn -c gunicorn_config.py run_redgreen_experiment:app
```

This uses the settings defined by `gunicorn_config.py`

### Step 2: Ngrok

Broadcast to internet (after authenticating ngrok on terminal) on a separate terminal:

```bash
ngrok http 8000
```

## Notes on running experiment (from Arijit)

The `backend/trial_data` stores all the datasets. The dataset present here is named `pilot_final` which was used for CogSci 2025's JTAP experiments. in the dataset folder has all the familiarization stimuli and experiment trial stimuli. Fam trials start with 'F' and an integer starting from 1 until the max number of trials (So F1, F2 etc.). The same is the case for the main experiment trials (E1, E2, E3 etc.) which start with an 'E'. The trial folder prefixes are configurable via `FAM_TRIAL_PREFIXES` and `EXP_TRIAL_PREFIXES` variables in `backend/run_redgreen_experiment.py` (defaulting to `['F']` and `['E']` respectively).

This experiment creates an SQL database using `flask_sqlalchemy` in the backend and handles trial randomization, assignment, counterbalancing, and fine-grained keystroke-per-frame data recording. To configure the experiment, edit the start of `backend/run_redgreen_experiment.py`. You can monitor the experiment using `backend/experiment_monitoring_dashboard.py`, though stability is not guaranteed. For database inspection during the experiment, I usually open the database file in a GUI such as [DB Browser for SQLite](https://sqlitebrowser.org/).

To postprocess the database file. Run through the `backend/postprocess.ipynb` notebook and configure the values in the first cell. Then run through the cells to save a `.pkl` file. Optionally, you can write your own postprocessing code, but I highly recommend you to re-use the `extract_human_data` function from `backend/postprocess_redgreen_human_data.py`, so that you don't have to deal with SQLAlchemy, you simply get the data in pandas dataframes. The demographics csv file is the one from Prolific. If you do not have it, you can comment out that section.

Keep in mind that the Prolific completion URL for participants is configured in `backend/run_redgreen_experiment.py` via the `PROLIFIC_COMPLETION_URL` variable. If you are using Prolific, you *MUST* update this variable with your study's completion URL. The URL is automatically passed to the finish page, so no frontend code changes are needed.