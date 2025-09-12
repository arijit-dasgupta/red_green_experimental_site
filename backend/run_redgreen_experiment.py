"""
Red-Green Experiment Flask Backend Server

This Flask application serves as the backend for a psychological experiment that studies
decision-making under uncertainty using a red-green task paradigm. Participants view
animated scenes and make binary choices (red vs green) using keyboard inputs.

EXPERIMENT OVERVIEW:
The experiment consists of two phases:
1. Familiarization trials (F trials): Training phase where participants learn the task
2. Experimental trials (E trials): Main data collection phase with randomized trial order

CORE FUNCTIONALITY:
- Serves a React frontend from the build directory
- Manages participant sessions with unique profile IDs and Prolific integration
- Loads trial data from NPZ files containing scene information (barriers, occluders, sensor data)
- Tracks keypress data (F and J keys) frame-by-frame during trials
- Calculates scores based on participant responses vs. ground truth outcomes
- Handles session timeouts and data validation
- Exports data to CSV for analysis

DATABASE SCHEMA:
- REDGREEN_Session: Stores session metadata (participant info, timing, completion status)
- Trial: Individual trial records with scores and completion status
- KeyState: Frame-by-frame keypress data for each trial
- Config: Serialized experiment configuration data per session

DATA FLOW:
1. Participant starts experiment via /start_experiment endpoint
2. System assigns next available profile ID and loads trial configuration
3. Frontend requests scenes via /load_next_scene, backend serves trial data
4. Participant responses recorded via /save_data with keypress timestamps
5. Scores calculated based on response patterns vs. true outcomes
6. Session completed when all trials finished or timeout reached

CONFIGURATION:
Key variables at top of file control experiment parameters:
- PATH_TO_DATA_FOLDER: Directory containing trial data files
- DATASET_NAME: Specific dataset folder to use
- NUM_PARTICIPANTS: Target number of participants
- TIMEOUT_PERIOD: Maximum session duration
- PARTICIPANT_BUFFER: Extra slots for dropouts/invalid sessions

TRIAL RANDOMIZATION:
Each participant gets a unique randomized trial order based on their profile ID.
The system ensures proper counterbalancing across different trial types while
maintaining randomization constraints.

SCORING SYSTEM:
Scores calculated as: 20 + 100 * (correct_responses - incorrect_responses) / total_frames
Where correct/incorrect determined by comparing participant choices to ground truth
'rg_outcome' field in trial data.

DEPLOYMENT NOTES:
- Uses SQLite database for data persistence
- Supports ngrok for external access during development
- Includes CORS headers for frontend-backend communication
- Background scheduler can export data periodically
- Prolific integration for participant management
"""

from flask import send_from_directory, Flask, request, jsonify, has_request_context
from flask_cors import CORS
import numpy as np
from datetime import datetime, timedelta
import os
import copy
import random
import pandas as pd
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import and_, or_
from sqlalchemy.exc import OperationalError
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm.attributes import flag_modified

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Example URL with Prolific parameters for testing:
# http://localhost:3000/?PROLIFIC_PID=sfdgsdfgsdfg&STUDY_ID=rg1&SESSION_ID=77

#=============================================================================
# EXPERIMENT CONFIGURATION - MODIFY THESE VARIABLES TO CUSTOMIZE EXPERIMENT
#=============================================================================
PATH_TO_DATA_FOLDER = 'trial_data'  # Root folder containing all trial datasets
DATASET_NAME = 'pilot_final'  # Specific dataset folder name within PATH_TO_DATA_FOLDER
EXPERIMENT_RUN_VERSION = 'v0'  # Version identifier for this experiment run
TIMEOUT_PERIOD = timedelta(minutes=45)  # Maximum time before session expires
check_TIMEOUT_interval = timedelta(minutes=5)  # How often to check for timeouts
NUM_PARTICIPANTS = 60  # Target number of participants to recruit

# Buffer for additional participants to account for dropouts and invalid responses
# This ensures we can still reach our target even if some participants don't complete
PARTICIPANT_BUFFER = 15 
#=============================================================================

# Calculate maximum participants (target + buffer)
MAX_NUM_PARTICIPANTS = NUM_PARTICIPANTS + PARTICIPANT_BUFFER

# Setup paths for React frontend build files
REACT_BUILD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/build"))

# Initialize Flask app with static file serving for React build
app = Flask(__name__, static_folder=os.path.join(REACT_BUILD_DIR, "static"))

# Enable CORS for frontend-backend communication, with ngrok compatibility
CORS(app, headers=['Content-Type', 'ngrok-skip-browser-warning'])

# Database configuration using SQLite with experiment-specific filename
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DATASET_NAME}_{EXPERIMENT_RUN_VERSION}_redgreen.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'mysecretkey_redgreen_##$563456#$%^')
app.config['ADMIN_EMAIL'] = 'arijitdg@mit.edu'

# Initialize SQLAlchemy database object
db = SQLAlchemy(app)

@app.after_request
def add_ngrok_header(response):
    """Add ngrok compatibility header to all responses for tunnel access."""
    response.headers['ngrok-skip-browser-warning'] = 'true'
    return response

# Serve React static files for all routes (SPA routing)
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    """
    Serve React build files for the frontend application.
    Handles both static assets and SPA routing by serving index.html for unknown paths.
    """
    if path != "" and os.path.exists(os.path.join(REACT_BUILD_DIR, path)):
        response = send_from_directory(REACT_BUILD_DIR, path)
    else:
        # Serve index.html for SPA routing (any unrecognized path)
        response = send_from_directory(REACT_BUILD_DIR, "index.html")
    response.headers['ngrok-skip-browser-warning'] = 'true'
    return response

#=============================================================================
# DATABASE MODELS - Define the schema for storing experiment data
#=============================================================================

class Config(db.Model):
    """
    Stores serialized experiment configuration data for each active session.
    This includes trial data, progress tracking, and session-specific settings.
    Deleted when session completes or times out to free memory.
    """
    __tablename__ = 'config'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('redgreen_session.id'), nullable=False)
    config_data = db.Column(db.PickleType, nullable=False)  # Serialized Python object

class REDGREEN_Session(db.Model):
    """
    Main session record containing participant information and experiment metadata.
    One record per participant, tracks overall progress and completion status.
    """
    __tablename__ = 'redgreen_session'
    id = db.Column(db.Integer, primary_key=True)
    randomized_profile_id = db.Column(db.Integer)  # Determines trial order assignment
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    prolific_pid = db.Column(db.String(100))  # Prolific Participant ID for payment
    average_score = db.Column(db.Float, nullable=True)  # Calculated across all trials
    time_taken = db.Column(db.Float, nullable=True)  # Total session duration in seconds
    randomized_trial_order = db.Column(JSON)  # List of trial names in randomized order
    study_id = db.Column(db.String(100))  # Prolific Study ID
    prolific_session_id = db.Column(db.String(100))  # Prolific Session ID
    ignore_data = db.Column(db.Boolean, default=False)  # Flag to exclude participant from analysis
    completed = db.Column(db.Boolean, default=False)  # Whether session finished normally
    has_timed_out = db.Column(db.Boolean, default=False)  # Whether session exceeded time limit
    end_time = db.Column(db.DateTime, nullable=True)  # When session completed
    experiment_name = db.Column(db.String(100))  # Which experiment variant was run

class Trial(db.Model):
    """
    Individual trial records within a session. Contains trial-specific data
    including scores, timing, and metadata about the trial type and content.
    """
    __tablename__ = 'trial'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('redgreen_session.id'), nullable=False) # foreign key to the session record
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    trial_type = db.Column(db.String(20))  # 'ftrial' (familiarization) or 'trial' (experimental)
    trial_index = db.Column(db.Integer)  # Index within trial type (0-based)
    global_trial_name = db.Column(db.String(100), nullable=True)  # e.g., 'F2', 'E2', 'E21' etc.
    counterbalance = db.Column(db.Boolean, default=False)  # Whether Red/Green goals were randomly swapped in stimuli (need to account for this when scoring, for example, depending on the counterbalance, either the F or J key was the correct choice)
    score = db.Column(db.Float, nullable=True)  # Calculated performance score for this trial
    completed = db.Column(db.Boolean, default=False)  # Whether trial finished successfully

class KeyState(db.Model):
    """
    Frame-by-frame record of participant key presses during trials.
    Each row represents the state of F and J keys at a specific animation frame.
    This granular data enables detailed analysis of response patterns over time.
    """
    __tablename__ = 'keystate'
    id = db.Column(db.Integer, primary_key=True)
    trial_id = db.Column(db.Integer, db.ForeignKey('trial.id'), nullable=False)
    frame = db.Column(db.Integer)  # Animation frame number (0-based)
    f_pressed = db.Column(db.Boolean)  # State of F key (typically red choice) True if F key was pressed, False otherwise
    j_pressed = db.Column(db.Boolean)  # State of J key (typically green choice) True if J key was pressed, False otherwise
    session_id = db.Column(db.Integer, db.ForeignKey('redgreen_session.id'), nullable=False) # foreign key to the session record

#=============================================================================
# UTILITY FUNCTIONS
#=============================================================================

def print_active_sessions():
    """
    Debug function to display current session statistics and remaining profile IDs in the terminal.
    Helps track experiment progress and identify available slots for new participants.
    """
    current_time = datetime.utcnow()
    
    # Query for all profile IDs that are considered "active" (occupied)
    # This includes completed sessions, currently active sessions, and flagged sessions
    active_profile_ids = db.session.query(REDGREEN_Session.randomized_profile_id).filter(
        or_(
            REDGREEN_Session.ignore_data == True,  # Manually flagged sessions
            or_(
                REDGREEN_Session.completed == True,  # Successfully completed
                and_(  # Currently active (within timeout window)
                    REDGREEN_Session.completed == False,
                    REDGREEN_Session.start_time > current_time - TIMEOUT_PERIOD
                )
            )
        )
    ).all()
    
    # Extract profile IDs and find remaining available slots
    active_profile_ids = list(set([active_profile_id[0] for active_profile_id in active_profile_ids])) 
    remaining_ids = [i for i in range(MAX_NUM_PARTICIPANTS) if i not in active_profile_ids]

    print("=== Remaining Sessions ===")
    print(f"Remaining Randomized Profile IDs: {remaining_ids}")
    print("========================")
    print(app.config['SQLALCHEMY_DATABASE_URI'])

# Initialize database tables and print session status
with app.app_context():
    db.create_all()
    print("Database initialized.")
    print_active_sessions()

def get_all_trial_paths(directory_path, randomized_profile_id):
    """
    Generate file paths for familiarization and experimental trials for a given participant.
    
    Args:
        directory_path: Path to the dataset folder containing trial subdirectories
        randomized_profile_id: Unique ID determining this participant's trial assignment
    
    Returns:
        tuple: (f_paths, e_paths, randomized_trial_order)
            - f_paths: List of file paths for familiarization trials (F1, F2, F3, etc.)
            - e_paths: List of file paths for experimental trials in randomized order
            - randomized_trial_order: List of trial folder names in the order they'll be presented
    
    The function ensures proper randomization while maintaining experimental constraints:
    - All participants get the same familiarization trials in order
    - Experimental trials are randomized per participant using a seeded random generator
    - Randomization avoids consecutive trials of the same type where possible
    """
    try:
        # Get all trial folders in the dataset directory
        entries = os.listdir(directory_path)
        random_ = random.Random(314159)  # Consistent seed for reproducible randomization

        # Separate familiarization (F) and experimental (E) trial folders
        participants_f_assignments = [entry for entry in entries if entry.startswith('F')]
        participants_f_assignments.sort()  # F1, F2, F3, etc. in order
        
        e_folders = [entry for entry in entries if entry.startswith('E')]
        
        # Create randomized trial orders for each possible participant
        participants_e_assignments = [e_folders for _ in range(MAX_NUM_PARTICIPANTS)]
        
        # Generate unique randomized order for each participant profile
        for i in range(MAX_NUM_PARTICIPANTS):
            e_assignment = participants_e_assignments[i]
            randomizer_cond = True
            counter = 0
            
            # Keep shuffling until we meet randomization constraints
            while randomizer_cond:
                random_.shuffle(e_assignment)
                # Extract trial numbers from folder names (e.g., 'E1-1a' -> 1)
                intters = [int(e_assignment[i][1:]) for i in range(len(e_assignment))]
                
                # Check if consecutive trials avoid problematic patterns
                # This ensures good counterbalancing across trial types
                randomizer_list = [
                    ((intters[i]+1 != intters[i+1]) and (intters[i] %2 == 1)) or 
                    (intters[i]-1 != intters[i+1] and (intters[i] %2 == 0)) 
                    for i in range(len(intters)-1)
                ]
                randomizer_cond = not all(randomizer_list)
                counter += 1
                
                # Prevent infinite loops with safety break
                if counter > 200:
                    break
                    
            participants_e_assignments[i] = e_assignment

        # Build full file paths to data.npz files in each trial folder
        f_paths = [os.path.join(os.path.join(directory_path, entry), 'data.npz') 
                  for entry in participants_f_assignments]
        e_paths = [os.path.join(os.path.join(directory_path, entry), 'data.npz') 
                  for entry in participants_e_assignments[randomized_profile_id]]
        
        return f_paths, e_paths, participants_e_assignments[randomized_profile_id]

    except (FileNotFoundError, PermissionError) as e:
        print(f"Error accessing {directory_path}: {e}")
        return [], [], []

#=============================================================================
# EXPERIMENT CONFIGURATION LOADING
#=============================================================================

# Global experiment configuration - defines available experiments and their data sources
EXPERIMENTS = {
    "redgreen": {
        "major_path": f"{PATH_TO_DATA_FOLDER}/{DATASET_NAME}",  # Path to trial data files
        "num_trials": 0,        # Will be set when config loads
        "num_ftrials": 0,       # Will be set when config loads  
        "trial_datas": [],      # Will store parsed trial data
        "ftrial_datas": []      # Will store parsed familiarization data
    }
}

def load_experiment_config(experiment_name, randomized_profile_id):
    """
    Load and parse experiment configuration for a specific participant.
    
    This function:
    1. Gets trial file paths for the participant's assigned profile
    2. Loads and parses NPZ trial data files 
    3. Prepares trial data in format expected by frontend
    4. Returns configuration object and randomized trial order
    
    Args:
        experiment_name: Which experiment to load (e.g., 'redgreen')
        randomized_profile_id: Participant's unique profile ID for trial assignment
        
    Returns:
        tuple: (config_dict, randomized_trial_order) or (None, None) if experiment not found
    """
    config = EXPERIMENTS.get(experiment_name)
    if not config:
        return None, None

    major_path = config["major_path"]
    ftrial_paths, trial_paths, randomized_trial_order = get_all_trial_paths(major_path, randomized_profile_id)

    def parse_npz(file_path):
        """
        Parse a single NPZ trial data file into frontend-compatible format.
        
        NPZ files contain:
        - barriers: Physical obstacles in the scene
        - occluders: Visual occlusion elements  
        - step_data: Frame-by-frame position data for moving objects
        - red_sensor/green_sensor: Sensor position and properties
        - timestep: Animation frame duration
        - target: Information about the target object
        - rg_outcome: Ground truth answer ('red' or 'green')
        """
        data = np.load(file_path, allow_pickle=True)
        return {
            # Convert barrier/occluder data to list of dicts with rounded coordinates
            "barriers": [{key: round(value, 2) for key, value in item.items()} 
                        for item in data.get("barriers", []).tolist()],
            "occluders": [{key: round(value, 2) for key, value in item.items()} 
                         for item in data.get("occluders", []).tolist()],
            # Convert step data to frame-indexed position dictionary
            "step_data": {int(k): {'x': v['x'], 'y': v['y']} 
                         for k, v in data.get("step_data", {}).item().items()},
            # Sensor configuration data
            "red_sensor": data.get("red_sensor", {}).item(),
            "green_sensor": data.get("green_sensor", {}).item(),
            # Animation timing
            "timestep": round(data.get("timestep", {}).item(), 2),
            # Target object radius (from size)
            "radius": data['target'].item()['size'] / 2,
            # Ground truth outcome for scoring
            "rg_outcome": data.get("rg_outcome", {}).item(),
        }

    # Parse all trial data files for this participant
    config["ftrial_datas"] = [parse_npz(file_path) for file_path in ftrial_paths]
    config["trial_datas"] = [parse_npz(file_path) for file_path in trial_paths]
    config["num_ftrials"] = len(ftrial_paths)
    config["num_trials"] = len(trial_paths)

    return config, randomized_trial_order

#=============================================================================
# API ENDPOINTS
#=============================================================================

@app.route('/start_experiment/<experiment_name>', methods=['POST'])
def start_experiment(experiment_name):
    """
    Initialize a new experiment session for a participant.
    
    This endpoint:
    1. Extracts Prolific participant information from URL parameters
    2. Assigns the next available randomized profile ID
    3. Validates participant hasn't already participated
    4. Loads experiment configuration and trial data
    5. Creates new session record in database
    6. Returns session information to frontend
    
    URL Parameters:
        PROLIFIC_PID: Unique participant identifier from Prolific
        STUDY_ID: Study identifier for payment/tracking
        SESSION_ID: Session identifier from Prolific
        
    Returns:
        JSON response with session details or error message
    """
    current_time = datetime.utcnow()
    
    # Extract Prolific parameters from URL (with defaults for testing)
    prolific_pid = request.args.get('PROLIFIC_PID', 'default_pid')
    study_id = request.args.get('STUDY_ID', 'debug_study')
    prolific_session_id = request.args.get('SESSION_ID', 'debug_session')

    # Find next available profile ID by checking which ones are currently occupied
    active_profile_ids = db.session.query(REDGREEN_Session.randomized_profile_id).filter(
        or_(
            REDGREEN_Session.ignore_data == True,  # Manually flagged sessions
            or_(
                REDGREEN_Session.completed == True,  # Completed sessions
                and_(  # Active sessions (within timeout window)
                    REDGREEN_Session.completed == False,
                    REDGREEN_Session.start_time > current_time - TIMEOUT_PERIOD
                )
            )
        )
    ).all()
    
    # Convert to simple list and find first available ID
    active_profile_ids = list(set([active_profile_id[0] for active_profile_id in active_profile_ids]))
    randomized_profile_id = min(
        [i for i in range(MAX_NUM_PARTICIPANTS) if i not in active_profile_ids],
        default=MAX_NUM_PARTICIPANTS
    )
    
    # Validate participant hasn't already participated (prevent double participation)
    if prolific_pid != 'default_pid':
        existing_session = db.session.query(REDGREEN_Session).filter_by(prolific_pid=prolific_pid).first()
        if existing_session:
            return jsonify({
                "error": "duplicate_pid",
                "message": "Oops! According to our records, it seems you have already done this experiment or had started an incomplete session. We apologise, as you may not be allowed to attempt the experiment. If you think this is a mistake, please reach out on Prolific."
            }), 403
            
    # Check if we've reached maximum participants
    if randomized_profile_id >= MAX_NUM_PARTICIPANTS:
        return jsonify({
            "error": "max_participants_reached",
            "message": "Oops! It seems the maximum number of participants have already started the experiment. We apologise, as you may not be allowed to attempt the experiment. If you think this is a mistake, please reach out on Prolific."
        }), 403
    
    # Load experiment configuration for this participant's profile
    config, randomized_trial_order = load_experiment_config(experiment_name, randomized_profile_id)
    if not config:
        return jsonify({"error": f"Experiment '{experiment_name}' not found"}), 404
    
    # Create new session record
    new_session = REDGREEN_Session(
        experiment_name=experiment_name,
        prolific_pid=prolific_pid,
        study_id=study_id,
        prolific_session_id=prolific_session_id,
        randomized_profile_id=randomized_profile_id,
        randomized_trial_order=randomized_trial_order
    )
    db.session.add(new_session)
    db.session.commit()
    
    # Add session-specific tracking fields to configuration
    config.update({
        'trial_i': 0,                    # Current experimental trial index
        'ftrial_i': 0,                   # Current familiarization trial index
        'is_ftrial': False,              # Currently in familiarization phase
        'is_trial': False,               # Currently in experimental phase  
        'fscores': [],                   # Familiarization trial scores
        'tscores': [],                   # Experimental trial scores
        'transition_to_exp_page': False  # Show transition page between phases
    })

    # Store configuration in database for this session
    config_entry = Config(session_id=new_session.id, config_data=config)
    db.session.add(config_entry)
    db.session.commit()

    # Log session creation details
    print(f"=== New Experiment Started ===")
    print(f"Prolific PID: {prolific_pid}")
    print(f"Assigned Randomized Profile ID: {randomized_profile_id}")
    print(f"Server-Side Session ID: {new_session.id}")
    print(f"Prolific Session ID: {prolific_session_id}")
    print(f"Start Time (UTC): {new_session.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Study ID: {study_id}")
    print(f"=============================")

    # Calculate and log current session statistics for monitoring
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

    # Return session details to frontend
    return jsonify({
        "session_id": new_session.id,
        "experiment_name": experiment_name,
        "num_trials": config["num_trials"],
        "num_ftrials": config["num_ftrials"],
        "timeout_period_seconds": TIMEOUT_PERIOD.total_seconds(),
        "check_timeout_interval_seconds": check_TIMEOUT_interval.total_seconds(),
        "start_time_utc": new_session.start_time.isoformat(),
    }), 200

@app.route("/load_next_scene", methods=["POST"])
def load_next_scene():
    """
    Load the next trial scene for a participant session.
    
    This endpoint manages the experiment flow by:
    1. Determining which trial to present next (familiarization vs experimental)
    2. Handling transitions between experiment phases
    3. Creating trial records in the database
    4. Returning scene data formatted for the frontend
    5. Managing experiment completion
    
    The flow is: F trials → transition page → E trials → finish
    
    Returns:
        JSON containing scene data, trial metadata, and progress information
    """
    session_id = request.json.get('session_id')
    if not session_id:
        return jsonify({"error": "Session not found"}), 400

    # Retrieve session and configuration from database
    session = db.session.get(REDGREEN_Session, session_id)
    if not session:
        return jsonify({"error": "Session not found in database"}), 400

    config_entry = db.session.query(Config).filter_by(session_id=session_id).first()
    if not config_entry:
        return jsonify({"error": "Experiment configuration not found"}), 500
    config = config_entry.config_data
    
    # Extract current progress from configuration
    trial_i = config['trial_i']
    ftrial_i = config['ftrial_i']
    is_ftrial = config['is_ftrial']
    is_trial = config['is_trial']
    fscores = config['fscores']
    tscores = config['tscores']
    transition_to_exp_page = config['transition_to_exp_page']

    # Ensure indices don't exceed available scores (handles edge cases)
    if len(fscores) < ftrial_i:
        ftrial_i -= 1
    if len(tscores) < trial_i:
        trial_i -= 1

    # Calculate and update average score
    avg_score = sum(tscores) / len(tscores) if tscores else 0
    session.average_score = avg_score
    db.session.commit()

    # Determine which trial/scene to show next based on current progress
    if ftrial_i < config["num_ftrials"]:
        # Still in familiarization phase
        npz_data = config["ftrial_datas"][ftrial_i]
        ftrial_i += 1
        is_ftrial = True
        finish = False
    elif ftrial_i == config["num_ftrials"] and is_ftrial:
        # Just finished familiarization - show transition page
        transition_to_exp_page = True
        is_ftrial = False
        npz_data = config["trial_datas"][0]  # Dummy data for transition
        finish = False
    elif trial_i < config["num_trials"]:
        # In experimental phase
        transition_to_exp_page = False
        npz_data = config["trial_datas"][trial_i]
        trial_i += 1
        is_trial = True
        finish = False
    elif trial_i == config["num_trials"]:
        # Experiment complete
        finish = True
        npz_data = config["trial_datas"][-1]  # Dummy data for finish screen
    else:
        return jsonify({"error": "Unexpected condition"}), 500

    # Determine trial metadata for database record
    trial_type = 'ftrial' if is_ftrial else 'trial'
    trial_index = ftrial_i - 1 if is_ftrial else trial_i - 1
    
    # Create trial record if this is an actual trial (not transition/finish screen)
    if (not transition_to_exp_page) and (not finish):
        # Randomly assign counterbalancing (swaps F/J key meanings)
        counterbalance = random.choice([True, False])
        
        # Determine global trial name for tracking
        if is_trial:
            global_trial_name = session.randomized_trial_order[trial_index]
        else:
            global_trial_name = f"F{trial_index+1}"
            
        # Create and save trial record
        trial = Trial(
            session_id=session.id, 
            trial_type=trial_type, 
            trial_index=trial_index, 
            counterbalance=counterbalance,
            global_trial_name=global_trial_name
        )
        db.session.add(trial)
        db.session.commit()
        
        # Log trial progress
        print(f"--- Load Next Scene Request ---")
        print(f"Prolific PID: {session.prolific_pid} | Profile ID: {session.randomized_profile_id} | Session ID: {session.id}")
        if is_ftrial:
            print(f"Fam Trial Progress: {ftrial_i}/{config['num_ftrials']}")
        else:
            print(f"Exp Trial Progress: {trial_i}/{config['num_trials']}")
        print(f"-------------------------------")

    # Update configuration with new progress state
    config.update({
        'trial_i': trial_i,
        'ftrial_i': ftrial_i,
        'is_ftrial': is_ftrial,
        'is_trial': is_trial,
        'transition_to_exp_page': transition_to_exp_page
    })
    config_entry.config_data = config
    flag_modified(config_entry, "config_data")  # Mark as dirty for SQLAlchemy
    db.session.commit()

    # Handle experiment completion
    if finish:
        session.completed = True
        session.end_time = datetime.utcnow()
        time_taken_to_finish = session.end_time - session.start_time
        session.time_taken = time_taken_to_finish.total_seconds()

        # Clean up configuration data to free memory
        db.session.delete(config_entry)
        db.session.commit()
        
        # Log completion details
        print("=== Experiment Completed ===")
        print(f"Session ID: {session.id}")
        print(f"Participant Prolific PID: {session.prolific_pid}")
        print(f"Randomized Profile ID: {session.randomized_profile_id}")
        print(f"Time Taken: {str(time_taken_to_finish)}")
        print(f"Average Score: {avg_score:.2f}")
        print("=============================")

    # Prepare scene data for frontend
    scene_data = {
        **npz_data,  # Include all trial data (barriers, sensors, etc.)
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
    """
    Save participant response data for a completed trial.
    
    This endpoint:
    1. Validates the session and trial
    2. Processes frame-by-frame keypress data
    3. Calculates trial score based on responses vs. ground truth
    4. Updates trial record and session configuration
    5. Stores detailed keypress data for analysis
    
    Scoring algorithm:
    - Base score of 20 points
    - +100 points for each frame of correct response
    - -100 points for each frame of incorrect response
    - Final range: -80 to 120 points per trial
    
    Request JSON:
        session_id: Session identifier
        unique_trial_id: Trial identifier  
        recordedKeyStates: Array of frame-by-frame keypress data
        counterbalance: Whether F/J keys were swapped for this trial
    """
    try:
        # Validate session
        session_id = request.json.get('session_id')
        if not session_id:
            return jsonify({"error": "Session ID not provided"}), 401

        session = db.session.get(REDGREEN_Session, session_id)
        if not session:
            return jsonify({"error": "Session not found in database"}), 402
        
        # Validate trial
        unique_trial_id = request.json.get('unique_trial_id')
        trial = db.session.get(Trial, unique_trial_id)
        if not trial or trial.session_id != int(session_id):
            return jsonify({"error": "Trial not found for the current session"}), 405
            
        # Mark trial as completed
        trial.completed = True
        trial.end_time = datetime.utcnow()
        db.session.commit()
        
        # Process keypress data
        data = request.json.get('recordedKeyStates', [])
        if not data:
            return jsonify({"error": "No key state data provided"}), 406
            
        num_red = num_green = 0
        counterbalance = request.json.get('counterbalance', False)
        
        # Process each frame of keypress data
        for entry in data:
            f_pressed = entry['keys']['f']
            j_pressed = entry['keys']['j']
            
            # Apply counterbalancing if active (swap key meanings)
            if counterbalance:
                f_pressed, j_pressed = j_pressed, f_pressed
                
            # Store keypress state for this frame
            key_state = KeyState(
                trial_id=trial.id, 
                frame=entry['frame'], 
                f_pressed=f_pressed, 
                j_pressed=j_pressed, 
                session_id=session_id
            )
            db.session.add(key_state)

            # Count responses for scoring (only single key presses count)
            if f_pressed and not j_pressed:
                num_red += 1
            elif j_pressed and not f_pressed:
                num_green += 1

        # Retrieve trial configuration to get ground truth
        config_entry = db.session.query(Config).filter_by(session_id=session_id).first()
        if not config_entry:
            return jsonify({"error": "Experiment configuration not found"}), 500
        config = config_entry.config_data

        # Get the correct trial data based on current phase
        npz_data = config["ftrial_datas"][config['ftrial_i'] - 1] if config['is_ftrial'] else \
                   config["trial_datas"][config['trial_i'] - 1]
        
        rg_outcome = npz_data.get("rg_outcome")  # Ground truth: 'red' or 'green'

        # Calculate score based on responses vs. ground truth
        num_frames = len(data)
        if rg_outcome == 'red':
            # Correct answer is red: reward red responses, penalize green
            score = 20 + 100 * ((num_red / num_frames) - (num_green / num_frames))
        elif rg_outcome == 'green':
            # Correct answer is green: reward green responses, penalize red
            score = 20 + 100 * ((num_green / num_frames) - (num_red / num_frames))
        else:
            # No ground truth available
            score = 0

        trial.score = score

        # Add score to running totals in configuration
        if config['is_ftrial']:
            config['fscores'].append(score)
        else:
            config['tscores'].append(score)

        # Save all changes to database
        flag_modified(config_entry, "config_data")
        db.session.commit()

        return jsonify({"status": "success", "score": score}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 555

@app.route('/end_session', methods=['POST'])
def end_session():
    """
    Handle premature session ending (browser close, refresh, etc.).
    
    This endpoint cleans up session data when a participant leaves
    before completing the experiment. It removes the configuration
    data to free up the profile slot for another participant.
    """
    session_id = request.json.get('session_id')
    if not session_id:
        return jsonify({"error": "Session ID not provided"}), 400

    # Verify session exists
    session = db.session.get(REDGREEN_Session, session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    # Clean up configuration data to free the profile slot
    config_entry = db.session.query(Config).filter_by(session_id=session_id).first()
    if config_entry:
        print(f"Deleting config data for session_id: {session_id}")
        db.session.delete(config_entry)
        db.session.commit()

    return jsonify({"message": "Session ended and configuration deleted successfully."}), 200

@app.route('/check_timeout', methods=['POST'])
def check_timeout():
    """
    Check if a session has exceeded the timeout period.
    
    Called periodically by the frontend to ensure sessions don't run
    indefinitely. If timeout detected, cleans up session data and
    returns error to frontend.
    """
    session_id = request.json.get('session_id')
    if not session_id:
        return jsonify({"error": "Session ID not provided"}), 400

    session = db.session.get(REDGREEN_Session, session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    # Check if session has exceeded timeout period
    if session.start_time + TIMEOUT_PERIOD < datetime.utcnow() and not session.completed:
        # Mark as timed out and clean up
        session.has_timed_out = True
        config_entry = db.session.query(Config).filter_by(session_id=session_id).first()
        if config_entry:
            db.session.delete(config_entry)
        db.session.commit()
        
        return jsonify({
            "error": "timeout",
            "message": "Your session has expired after the time limit.",
            "start_time_utc": session.start_time.isoformat(),
            "current_time_utc": datetime.utcnow().isoformat()
        }), 403

    return jsonify({"status": "active"}), 200

@app.route('/sessions', methods=['GET'])
def sessions():
    """
    Return summary data for all sessions (for monitoring/analysis) for experiment_monitoring_dashboard.py.
    
    Provides overview of experiment progress including completion rates,
    scores, and aggregated response data. Used by researchers to monitor
    data collection progress.
    """
    sessions = REDGREEN_Session.query.all()
    result = []
    
    for session in sessions:
        # Get completed trials for this session
        trials = Trial.query.filter_by(session_id=session.id, trial_type="trial", completed=True).all()
        ftrials = Trial.query.filter_by(session_id=session.id, trial_type="ftrial", completed=True).all()
        
        # Extract trial scores
        trial_scores = [{"trial_index": t.trial_index, "score": t.score} for t in trials]

        # Get all keypress data for experimental trials
        key_states = KeyState.query.join(Trial, KeyState.trial_id == Trial.id).filter(
            Trial.session_id == session.id,
            Trial.trial_type == "trial"
        ).all()

        # Aggregate response patterns across all trials
        time_series_data = {
            "red": [],
            "green": [],
            "uncertain": []
        }

        for ks in key_states:
            time_series_data["red"].append(ks.f_pressed)
            time_series_data["green"].append(ks.j_pressed)
            time_series_data["uncertain"].append(not (ks.f_pressed or ks.j_pressed))

        # Compile session summary
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

#=============================================================================
# DATA EXPORT FUNCTIONS
# NOTE: These were disabled in the cogsci 2025 red green experiments, so this can be ignored.
#=============================================================================

def export_combined_csv():
    """
    Export all experimental data to a single CSV file for analysis.
    
    Creates a flattened dataset with one row per frame of keypress data,
    including session metadata, trial information, and response details.
    This format is suitable for statistical analysis in R, Python, etc.
    """
    with app.app_context():
        combined_data = []

        # Process all sessions
        sessions = REDGREEN_Session.query.all()
        for session in sessions:
            # Get experimental trials only (not familiarization)
            trials = Trial.query.filter_by(session_id=session.id, trial_type="trial").all()

            for trial in trials:
                # Get frame-by-frame keypress data
                key_states = KeyState.query.filter_by(trial_id=trial.id).all()

                for ks in key_states:
                    # Convert to binary response indicators
                    red = 1 if (ks.f_pressed and not ks.j_pressed) else 0
                    green = 1 if (ks.j_pressed and not ks.f_pressed) else 0
                    uncertain = 1 if not (red or green) else 0

                    # Add row to dataset
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

        # Save to CSV
        df = pd.DataFrame(combined_data)
        csv_filename = "redgreen_combined.csv"
        df.to_csv(csv_filename, index=False)
        print(f"Combined data saved to '{csv_filename}'.")

def export_all_to_csv():
    """Wrapper function for CSV export with error handling."""
    try:
        export_combined_csv()
        print("Combined database data exported successfully.")
    except Exception as e:
        print(f"Error exporting data: {e}")

def schedule_csv_exports():
    """
    Set up background scheduler for periodic data exports.
    
    Automatically exports data every 10 minutes during data collection
    to ensure data is backed up regularly. Can be enabled by uncommenting
    the call in the main block.
    """
    scheduler = BackgroundScheduler()
    scheduler.start()

    scheduler.add_job(
        func=export_all_to_csv,
        trigger=IntervalTrigger(minutes=10),
        id="csv_export_job",
        name="Export database tables to CSV",
        replace_existing=True,
    )

    print("Scheduler initialized for periodic CSV exports.")

#=============================================================================
# APPLICATION STARTUP
#=============================================================================

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("Database initialized in __main__.")
        # Uncomment the line below to enable periodic CSV exports
        # schedule_csv_exports()
    app.run(debug=True)
