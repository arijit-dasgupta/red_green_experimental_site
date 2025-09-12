# in this file, we have re-usable code and functions to fetch and visualize the results of the REDGREEN experiment. 
# the code here is primarily used for the analysis of the HUMAN empirical data

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
    e_paths = [os.path.join(os.path.join(path_to_data, entry), 'data.npz') for entry in e_folders]
    rg_outcomes = [np.load(e_paths[i], allow_pickle=True).get("rg_outcome", {}).item() for i in range(len(e_folders))]
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

import os
import numpy as np
def extract_occlusion_data(path_to_data, participant_FPS=30):
    # Initialize dictionaries to store results
    occlusion_durations = {}
    occlusion_frames = {}
    continuous_occlusion_periods = {}
    all_periods_seconds = {}

    # Loop through each folder in the directory
    for trial_name in tqdm(sorted(os.listdir(path_to_data))):
        trial_path = os.path.join(path_to_data, trial_name)
        if os.path.isdir(trial_path):
            npz_path = os.path.join(trial_path, "high_res_obs.npz")
            if os.path.exists(npz_path):
                # print(f"Processing trial: {trial_name}")
                # Load the video data
                video_data = np.load(npz_path)["arr_0"]  # Replace "arr_0" if array name differs
                T, M, N, _ = video_data.shape
                all_periods_seconds[trial_name] = T/participant_FPS

                num_blue_pixels = [
                    np.sum(np.logical_and(np.logical_and(video_data[t,...,2]>200 , video_data[t,...,0]<50), video_data[t,...,1]<50)) for t in range(T)
                ]

                # Find occluded/occluding frames
                occluded_frames = [
                    t for t in range(T) 
                    if num_blue_pixels[t] < 1900  # Threshold for occluding
                ]
                
                # Calculate duration of occlusion in seconds
                duration = len(occluded_frames) / participant_FPS  # 30 FPS
                
                # Store results
                if occluded_frames:  # Only store if occlusion is present
                    occlusion_durations[trial_name] = duration
                    occlusion_frames[trial_name] = occluded_frames
                    continuous_periods = []
                    current_period = [occluded_frames[0]]

                    for i in range(1, len(occluded_frames)):
                        if occluded_frames[i] == occluded_frames[i-1] + 1:  # Consecutive frame
                            current_period.append(occluded_frames[i])
                        else:
                            # Save the completed period and start a new one
                            continuous_periods.append(len(current_period))
                            current_period = [occluded_frames[i]]

                    # Add the last period
                    continuous_periods.append(len(current_period))

                    # Convert to duration in seconds
                    continuous_occlusion_periods[trial_name] = [period / participant_FPS for period in continuous_periods]


    # Calculate summary statistics for occlusion durations (scenes with occlusion)
    if occlusion_durations:
        durations = list(occlusion_durations.values())
        summary_stats = {
            "mean_duration": np.mean(durations),
            "median_duration": np.median(durations),
            "max_duration": np.max(durations),
            "min_duration": np.min(durations),
            "total_scenes_with_occlusion": len(durations)
        }

        # Print summary statistics
        print("Summary Statistics of Occlusion Durations:")
        for stat, value in summary_stats.items():
            print(f"{stat}: {value:.2f}")
    else:
        print("No occlusion detected in any scene.")

    # Print the occlusion data dictionaries
    print("\nOcclusion Durations (in seconds):")
    print(occlusion_durations)

    # Summary statistics for continuous occlusion periods
    if continuous_occlusion_periods:
        all_periods = [duration for periods in continuous_occlusion_periods.values() for duration in periods]
        continuous_summary_stats = {
            "mean_continuous_duration": np.mean(all_periods),
            "median_continuous_duration": np.median(all_periods),
            "max_continuous_duration": np.max(all_periods),
            "min_continuous_duration": np.min(all_periods),
            "total_continuous_periods": len(all_periods)
        }

        # Print summary statistics for continuous occlusion periods
        print("\nSummary Statistics of Continuous Occlusion Periods:")
        for stat, value in continuous_summary_stats.items():
            print(f"{stat}: {value:.2f}")

    if all_periods_seconds:
        all_periods = list(all_periods_seconds.values())
        continuous_summary_stats = {
            "mean_duration": np.mean(all_periods),
            "median_duration": np.median(all_periods),
            "max_duration": np.max(all_periods),
            "min_duration": np.min(all_periods),
            "total_periods": len(all_periods)
        }

        # Print summary statistics for continuous occlusion periods
        print("\nSummary Statistics of All Periods:")
        for stat, value in continuous_summary_stats.items():
            print(f"{stat}: {value:.2f}")
    return occlusion_durations, occlusion_frames, continuous_occlusion_periods, all_periods_seconds