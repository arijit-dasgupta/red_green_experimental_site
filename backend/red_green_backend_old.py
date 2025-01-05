from flask import Flask, request, jsonify
import numpy as np
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import csv
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///pre_pilot_redgreen.db'  # Change to your preferred DB URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'mysecretkey_redgreen_##$563456#$%^')
app.config['ADMIN_EMAIL'] = 'arijitdg@mit.edu'

# Global variable to store the current page state
current_page = "welcome"  # Default page

db = SQLAlchemy(app)

class Session(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    average_score = db.Column(db.Float, nullable=True)  # Set after experiment ends

class Trial(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('session.id'), nullable=False)
    trial_type = db.Column(db.String(20))  # 'ftrial' or 'trial'
    trial_index = db.Column(db.Integer)
    score = db.Column(db.Float, nullable=True)  # Set after trial ends

class KeyState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    trial_id = db.Column(db.Integer, db.ForeignKey('trial.id'), nullable=False)
    frame = db.Column(db.Integer)
    f_pressed = db.Column(db.Boolean)
    j_pressed = db.Column(db.Boolean)

def get_data_npz_paths(directory_path):
    try:
        # Get all entries in the directory
        entries = os.listdir(directory_path)
        # Filter entries to include only folders
        folders = [os.path.join(os.path.join(directory_path, entry), 'data.npz') for entry in entries if os.path.isdir(os.path.join(directory_path, entry))]
        return folders
    except FileNotFoundError:
        print(f"The directory {directory_path} does not exist.")
        return []
    except PermissionError:
        print(f"Permission denied to access {directory_path}.")
        return []

major_path = "data/pre_pilot"
data_npz_paths = get_data_npz_paths(major_path)
ftrial_paths = [x for x in data_npz_paths if 'ftrial' in x]
ftrial_paths.sort()
num_ftrials = len(ftrial_paths)
trial_paths = [x for x in data_npz_paths if 'ftrial' not in x]
trial_paths.sort()
num_trials = len(trial_paths)
ftrial_datas = [np.load(file_path, allow_pickle=True) for file_path in ftrial_paths]
trial_datas = [np.load(file_path, allow_pickle=True) for file_path in trial_paths]
trial_i = 0
ftrial_i = 0
is_ftrial = False
is_trial = False
fscores = []
tscores = []
transition_to_exp_page = False
    
@app.route("/load_next_scene", methods=["POST"])
def load_next_scene():
    try:
        # Get the file path from the request
        global trial_i, ftrial_i, is_ftrial, is_trial, transition_to_exp_page

        # revert ftrial_i by 1 as this means the last ftrial was not completed
        if len(fscores) < ftrial_i:
            print("reverting familiarization trial")
            ftrial_i -= 1
        if len(tscores) < trial_i:
            print("reverting regular experimental trial")
            trial_i -= 1

        avg_score = sum(tscores) / len(tscores) if tscores else 0

        print(fscores, tscores)

        if ftrial_i < num_ftrials:
            npz_data = ftrial_datas[ftrial_i]
            print(ftrial_paths[ftrial_i])
            ftrial_i += 1
            is_ftrial = True
            finish = False
        elif ftrial_i == num_ftrials and is_ftrial:
            transition_to_exp_page = True
            is_ftrial = False
            npz_data = trial_datas[0] # dummy data for transition page
            finish = False
        elif trial_i < num_trials:
            npz_data = trial_datas[trial_i]
            trial_i += 1
            is_trial = True
            finish = False
        elif trial_i == num_trials:
            finish = True
            npz_data = trial_datas[-1] # dummy data for finish page
        else:
            #NOTE : PLACEHOLDER
            print("ERROR: None of the conditions were met in the if-elif-else of load_next_scene")

        print(f"ftrial_i: {ftrial_i}, trial_i: {trial_i}")

        # Convert the loaded data to a dictionary for JSON serialization
        scene_data = {
            "barriers": npz_data.get("barriers", []).tolist(),
            "occluders": npz_data.get("occluders", []).tolist(),
            "step_data": {int(k): v for k, v in npz_data.get("step_data", {}).item().items()},
            "red_sensor": npz_data.get("red_sensor", {}).item(),
            "green_sensor": npz_data.get("green_sensor", {}).item(),
            "timestep": round(npz_data.get("timestep", {}).item(),2),
            "radius": npz_data['target'].item()['size']/2,
            "worldWidth": 20,
            "worldHeight": 20,
            "is_ftrial": is_ftrial,
            "is_trial": is_trial,
            "ftrial_i": ftrial_i,
            "trial_i": trial_i,
            'num_ftrials': num_ftrials,
            'num_trials': num_trials,
            'fam_to_exp_page' : transition_to_exp_page,
            'finish': finish,
            'average_score': avg_score
        }

        transition_to_exp_page = False
        
        print("ftrial_i: ", ftrial_i, "trial_i", trial_i, "rg_outcome", npz_data.get("rg_outcome"))

        return jsonify(scene_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/save_data', methods=['POST'])
def save_data():
    try:
        global trial_i
        data = request.json.get('recordedKeyStates', [])
        num_red = 0
        num_green = 0
        with open('key_states.csv', 'w', newline='') as csvfile:
            fieldnames = ['frame', 'f_pressed', 'j_pressed']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            num_frames = len(data)

            for entry in data:
                writer.writerow({
                    'frame': entry['frame'],
                    'f_pressed': entry['keys']['f'],
                    'j_pressed': entry['keys']['j'],
                })
                if entry['keys']['f'] and not entry['keys']['j']:
                    num_red += 1
                elif entry['keys']['j'] and not entry['keys']['f']:
                    num_green += 1

        # calculate score 20*100(prop(right) - prop(wrong))
        if is_ftrial:
            npz_data = ftrial_datas[ftrial_i-1]
        elif is_trial:
            npz_data = trial_datas[trial_i-1]
        else:
            #NOTE : DO SOMETHING TO END THE SCENE
            pass

        rg_outcome = npz_data.get("rg_outcome")
        if rg_outcome == 'red':
            score = 20 + 100 * ((num_red/num_frames) - (num_green/num_frames))
        elif rg_outcome == 'green':
            score = 20 + 100 * ((num_green/num_frames) - (num_red/num_frames))

        if is_ftrial:
            fscores.append(score)
        elif is_trial:
            tscores.append(score)

        print("data saved")

        return jsonify({"status": "success", 'score' : score}), 200
    except Exception as e:
        print(f"Error saving data: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/get_current_page', methods=['GET'])
def get_current_page():
    return jsonify({"currentPage": current_page})

@app.route('/update_current_page', methods=['POST'])
def update_current_page():
    global current_page
    data = request.json
    current_page = data.get('currentPage', "welcome")
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(debug=True)
