# in this file, we have re-usable code and functions to fetch and visualize the results of the REDGREEN experiment. 
# the code here is primarily used for the analysis of the HUMAN empirical data

from typing import Any
import os
import pandas as pd
import matplotlib.pyplot as plt
from sqlalchemy import create_engine
import json
import cv2
from tqdm import tqdm
from matplotlib.animation import FuncAnimation
from IPython.display import display, HTML
import numpy as np
from matplotlib.gridspec import GridSpec
from matplotlib.patches import Rectangle
def extract_human_data(db_path, path_to_data): # the second is raw data path to videos

    # Step 1: Connect to the database
    engine = create_engine(f"sqlite:///{db_path}")  # Assuming SQLite


    # Step 2: Load session data and filter for complete sessions
    session_query = """
        SELECT id AS session_id, prolific_pid, average_score, randomized_profile_id, time_taken
        FROM redgreen_session
        WHERE completed = 1 AND (ignore_data = 0 OR ignore_data IS NULL)
    """

    session_df = pd.read_sql(session_query, engine)

    # # Step 4: Load trial data and map `global_trial_name`
    trial_query = """
        SELECT id AS trial_id, session_id, trial_index, global_trial_name, score
        FROM trial
        WHERE trial_type != 'ftrial' AND completed = 1
    """
    trial_df = pd.read_sql(trial_query, engine)

    # Merge trials with session randomized order
    trial_df = pd.merge(trial_df, session_df, left_on="session_id", right_on="session_id")

    # Step 5: Load keystate data and filter for valid trials
    valid_trial_ids = trial_df["trial_id"].dropna().tolist()

    keystate_query = f"""
        SELECT ks.frame, ks.f_pressed, ks.j_pressed, ks.trial_id
        FROM keystate ks
        WHERE ks.trial_id IN ({', '.join(map(str, valid_trial_ids))})
    """
    keystate_df = pd.read_sql(keystate_query, engine)

    # Merge keystate data with global_trial_name
    keystate_df = pd.merge(keystate_df, trial_df[["trial_id", "global_trial_name"]], on="trial_id")

    # Step 6: Process the data
    # Convert boolean to integer for aggregation
    keystate_df["f_pressed"] = keystate_df["f_pressed"].astype(int)
    keystate_df["j_pressed"] = keystate_df["j_pressed"].astype(int)

    keystate_df["red"] = ((keystate_df["f_pressed"] == 1) & (keystate_df["j_pressed"] == 0)).astype(int)
    keystate_df["green"] = ((keystate_df["j_pressed"] == 1) & (keystate_df["f_pressed"] == 0)).astype(int)
    keystate_df["uncertain"] = ((keystate_df["j_pressed"] == 0) & (keystate_df["f_pressed"] == 0)
                                | (keystate_df["j_pressed"] == 1) & (keystate_df["f_pressed"] == 1)).astype(int)
    # Group by global_trial_name and frame, calculate mean
    rgplot_df = (
        keystate_df.groupby(["global_trial_name", "frame"])
        .mean(numeric_only=True)
        .reset_index()
    )
    rgplot_df.drop(columns=["trial_id"], inplace=True)

    entries = os.listdir(path_to_data)
    e_folders = sorted([entry for entry in entries if entry.startswith('E')])
    e_paths = [os.path.join(os.path.join(path_to_data, entry), 'simulation_data.json') for entry in e_folders]
    
    # Parse JSON files to get rg_outcome
    rg_outcomes = []
    for file_path in e_paths:
        with open(file_path, 'r') as f:
            data = json.load(f)
            rg_outcomes.append(data.get("rg_outcome", ""))
    
    rg_outcome_df = pd.DataFrame({
        "global_trial_name": e_folders,
        "rg_outcome": rg_outcomes,
        
    })
    rg_outcome_df['rg_outcome_idx'] = rg_outcome_df['rg_outcome'].map({'red': 1, 'green': 0})

    trial_df = pd.merge(trial_df, rg_outcome_df, left_on="global_trial_name", right_on="global_trial_name")
    keystate_df = pd.merge(keystate_df, rg_outcome_df, left_on="global_trial_name", right_on="global_trial_name")
    rgplot_df = pd.merge(rgplot_df, rg_outcome_df, left_on="global_trial_name", right_on="global_trial_name")

    global_trial_names = list(trial_df['global_trial_name'].unique())

    return session_df, trial_df, keystate_df, rgplot_df, valid_trial_ids, global_trial_names

def save_human_data_by_trial(trial_df, keystate_df, path_to_data):
    """
    Save human keystate data as separate CSV files for each trial.
    
    Args:
        trial_df: DataFrame containing trial information with trial_id and session_id
        keystate_df: DataFrame containing keystate data with trial_id
        path_to_data: Path to the directory containing trial folders
    
    Returns:
        dict: Dictionary of dataframes, one for each global_trial_name
    """
    # Create a new dataframe by joining keystate_df with trial_df to add session_id
    keystate_with_session = keystate_df.merge(
        trial_df[['trial_id', 'session_id']], 
        on='trial_id', 
        how='inner'
    )[['frame', 'red', 'green', 'uncertain', 'session_id', 'rg_outcome', 'trial_id', 'global_trial_name']].sort_values(['global_trial_name', 'session_id'])

    # Assert that each row has a unique combination of frame, global_trial_name, and session_id
    assert keystate_with_session.duplicated(subset=['frame', 'global_trial_name', 'session_id']).sum() == 0, "Found duplicate rows with same frame, global_trial_name, and session_id"

    # Create a dictionary of dataframes, one for each global_trial_name
    keystate_by_trial = {}
    for trial_name in keystate_with_session['global_trial_name'].unique():
        keystate_by_trial[trial_name] = keystate_with_session[keystate_with_session['global_trial_name'] == trial_name].copy()

    # Save each trial as a separate CSV file in path_to_data
    for trial_name, trial_data in keystate_by_trial.items():
        csv_filename = "human_data.csv"
        csv_filepath = os.path.join(path_to_data, trial_name, csv_filename)
        trial_data.to_csv(csv_filepath, index=False)
    
    print(f"Saved human data as CSV files in {path_to_data}")
    
    return keystate_by_trial

def find_duplicate_completed_trials(trial_df):
    """
    Checks for duplicate completed trials within each session where the global trial name
    and session ID are the same.

    Args:
        trial_df (pd.DataFrame): DataFrame containing trial and session data with the following columns:
            - session_id
            - global_trial_name

    Returns:
        pd.DataFrame: DataFrame containing duplicate entries with their counts, if any.
    """
    # Group by session_id and global_trial_name and count occurrences
    duplicate_trials = (
        trial_df.groupby(["session_id", "global_trial_name"])
        .size()
        .reset_index(name="count")
    )

    # Filter for duplicate entries (count > 1)
    duplicate_trials = duplicate_trials[duplicate_trials["count"] > 1]

    return duplicate_trials

def count_completed_trials_by_global_name(trial_df):
    """
    Counts the number of completed trials for each global trial name.

    Args:
        trial_df (pd.DataFrame): DataFrame containing trial data with the column:
            - global_trial_name

    Returns:
        pd.DataFrame: DataFrame with the count of completed trials for each global trial name.
    """
    # Group by global_trial_name and count occurrences
    trial_counts = (
        trial_df.groupby("global_trial_name")
        .size()
        .reset_index(name="count")
    )

    return trial_counts

def plot_scores_distribution(trial_df):
    """
    Plots the distribution of scores for each participant/session ID.
    Each participant's scores are plotted separately.

    Args:
        trial_df (pd.DataFrame): DataFrame containing trial data with the following columns:
            - session_id
            - score
    """
    if "score" not in trial_df.columns or "session_id" not in trial_df.columns:
        raise KeyError("The required 'score' or 'session_id' columns are missing in trial_df.")
    
    # Get unique session IDs
    session_ids = trial_df["session_id"].unique()
    
    # Create a figure with subplots for each session
    num_sessions = len(session_ids)
    print(num_sessions)
    fig, axes = plt.subplots(num_sessions, 1, figsize=(6, 2*num_sessions), sharex=True)
    
    if num_sessions == 1:
        axes = [axes]  # Make sure axes is iterable for a single session
    
    # Plot scores for each session
    for ax, session_id in zip(axes, session_ids):
        session_scores = trial_df[trial_df["session_id"] == session_id]["score"]
        ax.hist(
            session_scores,
            bins=10,  # Adjust bins as needed
            alpha=0.7,
            color='blue',
            edgecolor='black'
        )
        ax.set_title(f"Score Distribution for Session {session_id}")
        ax.set_ylabel("Frequency")
        ax.tick_params(axis='x', which='both', labelbottom=True)  # Ensure x-ticks are visible
    
    plt.xlabel("Score")  # Set x-axis label for the entire figure
    plt.tight_layout()
    plt.show()

def print_demo_data(session_df, demographic_path):
    demo_df = pd.read_csv(demographic_path)
    valid_demo_df = session_df.merge(demo_df, left_on='prolific_pid', right_on='Participant id')
    assert len(valid_demo_df) == len(session_df), "Mismatch in session and demographic data."
    gender_counts = valid_demo_df['Sex'].value_counts()
    # Print the result
    print(f"The mean age is: {np.mean(np.array([int(x) for x in valid_demo_df['Age'].to_list()])):.2f}")
    print(f"The STDDEV of age is: {np.std(np.array([int(x) for x in valid_demo_df['Age'].to_list()])):.2f}")
    print("\nGender Profile Counts:")
    print(gender_counts)