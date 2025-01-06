from flask import send_from_directory, Flask, request, jsonify, has_request_context
from flask_cors import CORS
import numpy as np
from datetime import datetime, timedelta
import os
import random
import pandas as pd
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import and_, or_
from sqlalchemy.exc import OperationalError
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm.attributes import flag_modified

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
# dummy prolific params
# http://localhost:3000/?PROLIFIC_PID=sfdgsdfgsdfg&STUDY_ID=rg1&SESSION_ID=77

#NOTE: ONLY HAVE TO DEFINE THESE VARIABLES
#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
DATASET_NAME = 'pre_pilot'
EXPERIMENT_RUN_VERSION = 'debug'
TIMEOUT_PERIOD = timedelta(hours=2)
check_TIMEOUT_interval = timedelta(minutes=10)
NUM_PARTICIPANTS = 10
# TIMEOUT_PERIOD = timedelta(minutes = 0, seconds=30)
# check_TIMEOUT_interval = timedelta(seconds=10)
#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

assert NUM_PARTICIPANTS %2 == 0, "NUM_PARTICIPANTS must be even"
REACT_BUILD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/build"))

app = Flask(__name__, static_folder=os.path.join(REACT_BUILD_DIR, "static"))
CORS(app, headers=['Content-Type', 'ngrok-skip-browser-warning'])  # Allow the header

app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DATASET_NAME}_{EXPERIMENT_RUN_VERSION}_redgreen.db'  # Database configuration
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'mysecretkey_redgreen_##$563456#$%^')
app.config['ADMIN_EMAIL'] = 'arijitdg@mit.edu'


db = SQLAlchemy(app)

@app.after_request
def add_ngrok_header(response):
    response.headers['ngrok-skip-browser-warning'] = 'true'
    return response

# Serve React static files
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    if path != "" and os.path.exists(os.path.join(REACT_BUILD_DIR, path)):
        response = send_from_directory(REACT_BUILD_DIR, path)
    else:
        response = send_from_directory(REACT_BUILD_DIR, "index.html")
    response.headers['ngrok-skip-browser-warning'] = 'true'
    return response


class Config(db.Model):
    __tablename__ = 'config'  # Explicitly define the table name
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('redgreen_session.id'), nullable=False)  # Link to the session
    config_data = db.Column(db.PickleType, nullable=False)  # Store the configuration as a pickled object

# Define models for storing session, trial, and key state data
class REDGREEN_Session(db.Model):
    __tablename__ = 'redgreen_session'
    id = db.Column(db.Integer, primary_key=True)
    randomized_profile_id = db.Column(db.Integer)
    randomized_trial_order = db.Column(JSON)
    experiment_name = db.Column(db.String(100))
    has_timed_out = db.Column(db.Boolean, default=False)  # New field for timeout status
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    prolific_pid = db.Column(db.String(100))  # Prolific Participant ID
    study_id = db.Column(db.String(100))  # Prolific Study ID
    prolific_session_id = db.Column(db.String(100))  # Prolific Session ID
    completed = db.Column(db.Boolean, default=False)  # New field for completion status
    end_time = db.Column(db.DateTime, nullable=True)
    time_taken = db.Column(db.Float, nullable=True)
    average_score = db.Column(db.Float, nullable=True)

class Trial(db.Model):
    __tablename__ = 'trial'  # Explicitly define the table name
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('redgreen_session.id'), nullable=False)  # Reference the correct table
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    trial_type = db.Column(db.String(20))  # 'ftrial' or 'trial'
    trial_index = db.Column(db.Integer) #ftrial_i or trial_i
    global_trial_name = db.Column(db.String(100), nullable=True) # This will be something like 'F2' or 'E1-1a, or 'E2B-3b'
    counterbalance = db.Column(db.Boolean, default=False)
    score = db.Column(db.Float, nullable=True)
    completed = db.Column(db.Boolean, default=False)  # New field for completion status

class KeyState(db.Model):
    __tablename__ = 'keystate'  # Explicitly define the table name
    id = db.Column(db.Integer, primary_key=True)
    trial_id = db.Column(db.Integer, db.ForeignKey('trial.id'), nullable=False)
    frame = db.Column(db.Integer)
    f_pressed = db.Column(db.Boolean)
    j_pressed = db.Column(db.Boolean)

# Initialize the database
with app.app_context():
    db.create_all()
    print("Database initialized.")

def get_all_trial_paths(directory_path, randomized_profile_id):
    try:
        # Get the list of entries in the directory
        entries = os.listdir(directory_path)
        random_ = random.Random(314159)  # Set consistent local random object

        # Separate F and E folders
        participants_f_assignments = [entry for entry in entries if entry.startswith('F')]
        participants_f_assignments.sort()
        e_folders = [entry for entry in entries if entry.startswith('E')]

        # Split E folders into 'a' and 'b' versions
        e_a_folders = [folder for folder in e_folders if folder.endswith('a')]
        e_b_folders = [folder for folder in e_folders if folder.endswith('b')]

        # Ensure the number of participants is even
        if NUM_PARTICIPANTS % 2 != 0:
            raise ValueError("NUM_PARTICIPANTS must be an even number.")

        # Ensure every `a` version has a corresponding `b` version
        paired_folders = []
        for folder_a in e_a_folders:
            base_name = folder_a[:-1]  # Remove the 'a'
            corresponding_b = f"{base_name}b"
            if corresponding_b in e_b_folders:
                paired_folders.append((folder_a, corresponding_b))

        # Randomly assign 'a' or 'b' versions evenly across participants
        participants_e_assignments = {i: [] for i in range(NUM_PARTICIPANTS)}
        for pair in paired_folders:
            assigned_versions = NUM_PARTICIPANTS//2 * [0] + NUM_PARTICIPANTS//2 * [1]
            random_.shuffle(assigned_versions)
            for i in range(NUM_PARTICIPANTS):
                participants_e_assignments[i].append(pair[assigned_versions[i]])

        # Shuffle the assigned trial order for variability
        for i in range(NUM_PARTICIPANTS):
            random_.shuffle(participants_e_assignments[i])

        # Build file paths
        f_paths = [os.path.join(os.path.join(directory_path, entry), 'data.npz') for entry in participants_f_assignments]
        e_paths = [os.path.join(os.path.join(directory_path, entry), 'data.npz') for entry in participants_e_assignments[randomized_profile_id]]
        
        return f_paths, e_paths, participants_e_assignments[randomized_profile_id]

    except (FileNotFoundError, PermissionError) as e:
        print(f"Error accessing {directory_path}: {e}")
        return [], []


# Load experiment configurations dynamically
# NOTE: This is where the exp folder is mentioned
EXPERIMENTS = {
    "redgreen": {
        "major_path": f"data/{DATASET_NAME}",
        "num_trials": 0,
        "num_ftrials": 0,
        "trial_datas": [],
        "ftrial_datas": []
    }
}

def load_experiment_config(experiment_name, randomized_profile_id):
    """Loads and caches experiment configuration."""
    config = EXPERIMENTS.get(experiment_name)
    if not config:
        return None

    major_path = config["major_path"]
    ftrial_paths, trial_paths, randomized_trial_order = get_all_trial_paths(major_path, randomized_profile_id)

    def parse_npz(file_path):
        data = np.load(file_path, allow_pickle=True)
        return {
            "barriers": data.get("barriers", []).tolist(),
            "occluders": data.get("occluders", []).tolist(),
            "step_data": {int(k): {'x': v['x'], 'y': v['y']} for k, v in data.get("step_data", {}).item().items()},
            "red_sensor": data.get("red_sensor", {}).item(),
            "green_sensor": data.get("green_sensor", {}).item(),
            "timestep": round(data.get("timestep", {}).item(), 2),
            "radius": data['target'].item()['size'] / 2,
            "rg_outcome": data.get("rg_outcome", {}).item(),
        }

    config["ftrial_datas"] = [parse_npz(file_path) for file_path in ftrial_paths]
    config["trial_datas"] = [parse_npz(file_path) for file_path in trial_paths]
    config["num_ftrials"] = len(ftrial_paths)
    config["num_trials"] = len(trial_paths)

    return config, randomized_trial_order

@app.route('/start_experiment/<experiment_name>', methods=['POST'])
def start_experiment(experiment_name):
    current_time = datetime.utcnow()
    prolific_pid = request.args.get('PROLIFIC_PID', 'debug_pid')
    study_id = request.args.get('STUDY_ID', 'debug_study')
    prolific_session_id = request.args.get('SESSION_ID', 'debug_session')

    # find all active sessions and assignm the next randomized_profile_id accordingly
    active_profile_ids = db.session.query(REDGREEN_Session.randomized_profile_id).filter(
        or_(
            REDGREEN_Session.completed == True,
            and_( # Check if any session has timed out (even if it is not explicitly marked -- because the user may have just closed it)
                REDGREEN_Session.completed == False,
                REDGREEN_Session.start_time > current_time - TIMEOUT_PERIOD
            )
        )
    ).all()
    active_profile_ids = list(set([active_profile_id[0] for active_profile_id in active_profile_ids])) # unwrap out of list
    randomized_profile_id = min(
        [i for i in range(NUM_PARTICIPANTS) if i not in active_profile_ids],
        default = NUM_PARTICIPANTS
    )
    
    # Check if the prolific_pid already exists in the database
    if prolific_pid != 'debug_pid':
        existing_session = db.session.query(REDGREEN_Session).filter_by(prolific_pid=prolific_pid).first()
        if existing_session:
            return jsonify({
                "error": "duplicate_pid",
                "message": "Oops! According to our records, it seems you have already done this experiment or had started an incomplete session. We apologise, as you may not be allowed to attempt the experiment. If you think this is a mistake, please reach out on Prolific."
            }), 403
    if randomized_profile_id >= NUM_PARTICIPANTS:
        return jsonify({
            "error": "max_participants_reached",
            "message": "Oops! It seems the maximum number of participants have already started the experiment. We apologise, as you may not be allowed to attempt the experiment. If you think this is a mistake, please reach out on Prolific."
        }), 403
    
    config, randomized_trial_order = load_experiment_config(experiment_name, randomized_profile_id)
    if not config:
        return jsonify({"error": f"Experiment '{experiment_name}' not found"}), 404
    
    new_session = REDGREEN_Session(
        experiment_name=experiment_name,
        prolific_pid=prolific_pid,
        study_id=study_id,
        prolific_session_id=prolific_session_id,
        randomized_profile_id=randomized_profile_id,
        randomized_trial_order = randomized_trial_order
    )
    db.session.add(new_session)
    db.session.commit()
    # Add session-specific fields to the configuration
    config.update({
        'trial_i': 0,
        'ftrial_i': 0,
        'is_ftrial': False,
        'is_trial': False,
        'fscores': [],
        'tscores': [],
        'transition_to_exp_page': False
    })

    # Store the configuration in the database
    config_entry = Config(session_id=new_session.id, config_data=config)
    db.session.add(config_entry)
    db.session.commit()

    # FINAL LOGGING OF INFO
    # Logging the new session details
    print(f"=== New Experiment Started ===")
    print(f"Prolific PID: {prolific_pid}")
    print(f"Assigned Randomized Profile ID: {randomized_profile_id}")
    print(f"Server-Side Session ID: {new_session.id}")
    print(f"Prolific Session ID: {prolific_session_id}")
    print(f"Start Time (UTC): {new_session.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Study ID: {study_id}")
    print(f"=============================")

    # Count statistics for active, completed, and timed-out sessions

    completed_count = db.session.query(REDGREEN_Session).filter(
        REDGREEN_Session.completed == True
    ).count()

    active_count = db.session.query(REDGREEN_Session).filter(
        REDGREEN_Session.completed == False,
        REDGREEN_Session.start_time >= current_time - TIMEOUT_PERIOD
    ).count()

    total_timed_out_count = db.session.query(REDGREEN_Session).filter(
        REDGREEN_Session.completed == False,
        REDGREEN_Session.start_time < current_time - TIMEOUT_PERIOD
    ).count()

    marked_timed_out_count = db.session.query(REDGREEN_Session).filter(
        REDGREEN_Session.has_timed_out == True,
    ).count()

    closed_timed_out = total_timed_out_count - marked_timed_out_count

    print(f"=== Session Statistics ===")
    print(f"Completed Sessions: {completed_count}")
    print(f"Active Sessions: {active_count}")
    print(f"Timed Out Sessions (after exiting experiment): {closed_timed_out}")
    print(f"Timed Out Sessions (while live in experiment): {marked_timed_out_count}")
    print(f"=========================")


    return jsonify({
        "session_id": new_session.id,
        "experiment_name": experiment_name,
        "num_trials": config["num_trials"],
        "num_ftrials": config["num_ftrials"],
        "timeout_period_seconds": TIMEOUT_PERIOD.total_seconds(),
        "check_timeout_interval_seconds": check_TIMEOUT_interval.total_seconds(),
        "start_time_utc": new_session.start_time.isoformat(),  # Include start time in UTC
    }), 200


@app.route("/load_next_scene", methods=["POST"])
def load_next_scene():
    """Loads the next scene based on the session and trial state."""
    session_id = request.json.get('session_id')
    if not session_id:
        return jsonify({"error": "REDGREEN_Session not found"}), 400

    session = db.session.get(REDGREEN_Session, session_id)
    if not session:
        return jsonify({"error": "REDGREEN_Session not found in database"}), 400

    # Retrieve the experiment configuration from the database
    config_entry = db.session.query(Config).filter_by(session_id=session_id).first()
    if not config_entry:
        return jsonify({"error": "Experiment configuration not found"}), 500
    config = config_entry.config_data
    
    trial_i = config['trial_i']
    ftrial_i = config['ftrial_i']
    is_ftrial = config['is_ftrial']
    is_trial = config['is_trial']
    fscores = config['fscores']
    tscores = config['tscores']
    transition_to_exp_page = config['transition_to_exp_page']

    if len(fscores) < ftrial_i:
        ftrial_i -= 1
    if len(tscores) < trial_i:
        trial_i -= 1

    avg_score = sum(tscores) / len(tscores) if tscores else 0
    session.average_score = avg_score  # Update completion status
    db.session.commit()  # Save changes to the database

    if ftrial_i < config["num_ftrials"]:
        npz_data = config["ftrial_datas"][ftrial_i]
        ftrial_i += 1
        is_ftrial = True
        finish = False
    elif ftrial_i == config["num_ftrials"] and is_ftrial:
        transition_to_exp_page = True
        is_ftrial = False
        npz_data = config["trial_datas"][0]  # Dummy data
        finish = False
    elif trial_i < config["num_trials"]:
        transition_to_exp_page = False
        npz_data = config["trial_datas"][trial_i]
        trial_i += 1
        is_trial = True
        finish = False
    elif trial_i == config["num_trials"]:
        finish = True
        npz_data = config["trial_datas"][-1]  # Dummy data
    else:
        return jsonify({"error": "Unexpected condition"}), 500

    trial_type = 'ftrial' if is_ftrial else 'trial'
    trial_index = ftrial_i - 1 if is_ftrial else trial_i - 1

    
    if (not transition_to_exp_page) and (not finish):
        counterbalance = random.choice([True, False])
        trial = Trial(session_id=session.id, trial_type=trial_type, trial_index=trial_index, counterbalance=counterbalance)
        db.session.add(trial)
        db.session.commit()
        print(f"--- Load Next Scene Request ---")
        print(f"Prolific PID: {session.prolific_pid} | Profile ID: {session.randomized_profile_id} | Session ID: {session.id}")
        if is_ftrial:
            print(f"Fam Trial Progress: {ftrial_i}/{config['num_ftrials']}")
        else:
            print(f"Exp Trial Progress: {trial_i}/{config['num_trials']}")
        print(f"-------------------------------")


    # Update the configuration in the database
    config.update({
        'trial_i': trial_i,
        'ftrial_i': ftrial_i,
        'is_ftrial': is_ftrial,
        'is_trial': is_trial,
        'transition_to_exp_page': transition_to_exp_page
    })
    config_entry.config_data = config
    flag_modified(config_entry, "config_data")
    db.session.commit()

    if finish:
        # Experiment is complete; delete the configuration entry
        session.completed = True  # Update completion status
        session.end_time = datetime.utcnow()
        time_taken_to_finish = session.end_time - session.start_time
        session.time_taken = (session.end_time - session.start_time).total_seconds()

        db.session.delete(config_entry)
        db.session.commit()
        print("=== Experiment Completed ===")
        print(f"Session ID: {session.id}")
        print(f"Participant Prolific PID: {session.prolific_pid}")
        print(f"Randomized Profile ID: {session.randomized_profile_id}")
        print(f"Time Taken: {str(time_taken_to_finish)}")
        print(f"Average Score: {avg_score:.2f}")
        print("=============================")


    scene_data = {
        **npz_data,
        "worldWidth": 20,
        "worldHeight": 20,
        "counterbalance": False if (transition_to_exp_page or finish) else counterbalance,
        "is_ftrial": is_ftrial,
        "is_trial": is_trial,
        "ftrial_i": ftrial_i,
        "trial_i": trial_i,
        "num_ftrials": config["num_ftrials"],
        "num_trials": config["num_trials"],
        "fam_to_exp_page": transition_to_exp_page,
        "finish": finish,
        "average_score": avg_score,
        "unique_trial_id": -1 if (transition_to_exp_page or finish) else trial.id
    }

    return jsonify(scene_data)

@app.route('/save_data', methods=['POST'])
def save_data():
    """Saves key state data for the current trial."""
    try:
        session_id = request.json.get('session_id')
        if not session_id:
            return jsonify({"error": "Session ID not provided"}), 401

        session = db.session.get(REDGREEN_Session, session_id)
        if not session:
            return jsonify({"error": "REDGREEN_Session not found in database"}), 402
        
        unique_trial_id = request.json.get('unique_trial_id')

        trial = db.session.get(Trial, unique_trial_id)
        if not trial or trial.session_id != int(session_id):
            return jsonify({"error": "Trial not found for the current session"}), 405
        trial.completed = True
        trial.end_time = datetime.utcnow()
        db.session.commit()
        
        # Get recorded key states
        data = request.json.get('recordedKeyStates', [])
        if not data:
            return jsonify({"error": "No key state data provided"}), 406
        num_red = num_green = 0

        for entry in data:
            f_pressed = entry['keys']['f']
            j_pressed = entry['keys']['j']
            key_state = KeyState(trial_id=trial.id, frame=entry['frame'], f_pressed=f_pressed, j_pressed=j_pressed)
            db.session.add(key_state)

            if f_pressed and not j_pressed:
                num_red += 1
            elif j_pressed and not f_pressed:
                num_green += 1

        counterbalance = request.json.get('counterbalance', False)
        if counterbalance:
            num_red, num_green = num_green, num_red

        # Retrieve the experiment configuration from the database
        config_entry = db.session.query(Config).filter_by(session_id=session_id).first()
        if not config_entry:
            return jsonify({"error": "Experiment configuration not found"}), 500
        config = config_entry.config_data

        npz_data = config["ftrial_datas"][config['ftrial_i'] - 1] if config['is_ftrial'] else \
                   config["trial_datas"][config['trial_i'] - 1]
        
        rg_outcome = npz_data.get("rg_outcome")

        num_frames = len(data)
        if rg_outcome == 'red':
            score = 20 + 100 * ((num_red / num_frames) - (num_green / num_frames))
        elif rg_outcome == 'green':
            score = 20 + 100 * ((num_green / num_frames) - (num_red / num_frames))
        else:
            score = 0

        trial.score = score

        # Append the score to the configuration
        if config['is_ftrial']:
            config['fscores'].append(score)
        else:
            config['tscores'].append(score)

        # Mark the field as modified
        flag_modified(config_entry, "config_data")
        # Commit the changes to the database
        db.session.commit()
        # Debugging step to ensure updates are persisted

        return jsonify({"status": "success", "score": score}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 555

@app.route('/end_session', methods=['POST'])
def end_session():
    """Handles session ending, such as browser refresh or closure."""
    session_id = request.json.get('session_id')
    if not session_id:
        return jsonify({"error": "Session ID not provided"}), 400

    # Check if the session exists
    session = db.session.get(REDGREEN_Session, session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    # Delete the associated Config entry
    config_entry = db.session.query(Config).filter_by(session_id=session_id).first()
    print("config_entry: ", config_entry)
    if config_entry:
        print("deleting config data for session_id: ", session_id)
        db.session.delete(config_entry)
        db.session.commit()

    return jsonify({"message": "Session ended and configuration deleted successfully."}), 200

@app.route('/check_timeout', methods=['POST'])
def check_timeout():
    """Checks if the session has timed out."""
    session_id = request.json.get('session_id')
    if not session_id:
        return jsonify({"error": "Session ID not provided"}), 400

    session = db.session.get(REDGREEN_Session, session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    # Check for timeout
    if session.start_time + TIMEOUT_PERIOD < datetime.utcnow() and not session.completed:
        session.has_timed_out = True
        config_entry = db.session.query(Config).filter_by(session_id=session_id).first()
        if not config_entry:
            return jsonify({"error": "Experiment configuration not found"}), 500
        db.session.delete(config_entry)
        db.session.commit()
        return jsonify({
            "error": "timeout",
            "message": "Your session has expired after 4 hours.",
            "start_time_utc": session.start_time.isoformat(),  # Include start time in UTC
            "current_time_utc": datetime.utcnow().isoformat()  # Include current time in UTC
        }), 403


    return jsonify({"status": "active"}), 200

@app.route('/sessions', methods=['GET'])
def sessions():
    # Temporarily suppress logging for this route

    sessions = REDGREEN_Session.query.all()
    result = []
    for session in sessions:
        trials = Trial.query.filter_by(session_id=session.id, trial_type="trial", completed = True).all()
        ftrials = Trial.query.filter_by(session_id=session.id, trial_type="ftrial", completed = True).all()
        
        trial_scores = [{"trial_index": t.trial_index, "score": t.score} for t in trials]

        key_states = KeyState.query.join(Trial, KeyState.trial_id == Trial.id).filter(
            Trial.session_id == session.id,
            Trial.trial_type == "trial"
        ).all()

        time_series_data = {
            "red": [],
            "green": [],
            "uncertain": []
        }

        for ks in key_states:
            time_series_data["red"].append(ks.f_pressed)
            time_series_data["green"].append(ks.j_pressed)
            time_series_data["uncertain"].append(not (ks.f_pressed or ks.j_pressed))

        result.append({
            "id": session.id,
            "start_time": session.start_time,
            "study_id": session.study_id,
            "average_score": session.average_score,
            "prolific_pid": session.prolific_pid,
            "completed": session.completed,
            "prolific_session_id": session.prolific_session_id,
            "num_ftrials_completed": len(ftrials),
            "num_trials_completed": len(trials),
            "trial_scores": trial_scores,
            "time_series_data": time_series_data
        })

    return jsonify(result)

def export_combined_csv():
    """Export all data into one combined CSV file."""
    with app.app_context():  # Ensure we are working inside the application context
        combined_data = []

        # Query all sessions
        sessions = REDGREEN_Session.query.all()
        for session in sessions:
            # Get all regular trials for the session
            trials = Trial.query.filter_by(session_id=session.id, trial_type="trial").all()

            for trial in trials:
                # Get all key states for the trial
                key_states = KeyState.query.filter_by(trial_id=trial.id).all()

                for ks in key_states:
                    # Determine button press state
                    red = 1 if (ks.f_pressed and not ks.j_pressed) else 0
                    green = 1 if (ks.j_pressed and not ks.f_pressed) else 0
                    uncertain = 1 if not (ks.red or ks.green) else 0

                    # Add data to the combined list
                    combined_data.append({
                        "session_id": session.id,
                        "start_time": session.start_time,
                        "prolific_pid": session.prolific_pid,
                        "study_id": session.study_id,
                        "prolific_session_id": session.prolific_session_id,
                        "completed": session.completed,
                        "trial_index": trial.trial_index,
                        "score": trial.score,
                        "red": red,
                        "green": green,
                        "uncertain": uncertain,
                        "frame": ks.frame,
                    })

        # Convert combined data to a pandas DataFrame
        df = pd.DataFrame(combined_data)

        # Save to a single CSV file
        csv_filename = "redgreen_combined.csv"
        df.to_csv(csv_filename, index=False)
        print(f"Combined data saved to '{csv_filename}'.")

def export_all_to_csv():
    try:
        export_combined_csv()
        print("Combined database data exported successfully.")
    except Exception as e:
        print(f"Error exporting data: {e}")

# Schedule periodic CSV exports
def schedule_csv_exports():
    scheduler = BackgroundScheduler()
    scheduler.start()

    # Run every few minutes (adjust as needed)
    scheduler.add_job(
        func=export_all_to_csv,
        trigger=IntervalTrigger(minutes=10),
        id="csv_export_job",
        name="Export database tables to CSV",
        replace_existing=True,
    )

    print("Scheduler initialized for periodic CSV exports.")


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("Database initialized in __main__.")
        # schedule_csv_exports()
    app.run(debug=True)
