# in this file, we have re-usable code and functions to fetch and visualize the results of the REDGREEN experiment. 
# the code here is primarily used for the analysis of the HUMAN empirical data

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


def extract_human_data(db_path, path_to_data, exp_trial_prefixes=None, fam_trial_prefixes=None, 
                       allow_incomplete_sessions=False, session_ids=None): 
    """
    Extract human experiment data from database and match with trial data files.
    
    Args:
        db_path: Path to the SQLite database file
        path_to_data: Path to the directory containing trial data folders
        exp_trial_prefixes: List of prefixes for experimental trials (e.g., ['CC_control', 'CC_surprise', 'UC_positive', 'UC_negative'])
        fam_trial_prefixes: List of prefixes for familiarization trials (e.g., ['F'])
        allow_incomplete_sessions: If True, include sessions that are not marked as completed
        session_ids: List of specific session IDs to include (None means include all matching sessions)
    
    Returns:
        tuple: (session_df, trial_df, keystate_df, rgplot_df, valid_trial_ids, global_trial_names)
    """
    # Default prefixes if not provided
    if exp_trial_prefixes is None:
        exp_trial_prefixes = ['CC_control', 'CC_surprise', 'UC_positive', 'UC_negative']
    if fam_trial_prefixes is None:
        fam_trial_prefixes = ['F']

    # Step 1: Connect to the database
    engine = create_engine(f"sqlite:///{db_path}")  # Assuming SQLite


    # Step 2: Load session data with optional filtering
    if allow_incomplete_sessions:
        # Include incomplete sessions, but still exclude ignored data
        session_query = """
            SELECT id AS session_id, prolific_pid, average_score, randomized_profile_id, time_taken, completed
            FROM redgreen_session
            WHERE (ignore_data = 0 OR ignore_data IS NULL)
        """
    else:
        # Only completed sessions
        session_query = """
            SELECT id AS session_id, prolific_pid, average_score, randomized_profile_id, time_taken, completed
            FROM redgreen_session
            WHERE completed = 1 AND (ignore_data = 0 OR ignore_data IS NULL)
        """
    
    # Filter by specific session IDs if provided
    if session_ids is not None:
        session_ids_str = ','.join(map(str, session_ids))
        session_query += f" AND id IN ({session_ids_str})"

    session_df = pd.read_sql(session_query, engine)
    print(f"Found {len(session_df)} sessions (allow_incomplete={allow_incomplete_sessions}, session_ids={session_ids})")

    # # Step 4: Load trial data and map `global_trial_name`
    # Only get trials from the selected sessions
    if len(session_df) > 0:
        session_ids_list = session_df['session_id'].tolist()
        session_ids_str = ','.join(map(str, session_ids_list))
        trial_query = f"""
            SELECT id AS trial_id, session_id, trial_index, global_trial_name, score
            FROM trial
            WHERE trial_type != 'ftrial' AND completed = 1 AND session_id IN ({session_ids_str})
        """
    else:
        # No sessions, so no trials
        trial_query = """
            SELECT id AS trial_id, session_id, trial_index, global_trial_name, score
            FROM trial
            WHERE 1=0
        """
    
    trial_df = pd.read_sql(trial_query, engine)
    print(f"Found {len(trial_df)} completed experimental trials from selected sessions")
    if len(trial_df) > 0:
        print(f"Sample trial names from database: {trial_df['global_trial_name'].head(5).tolist()}")

    # Merge trials with session randomized order
    trial_df = pd.merge(trial_df, session_df, left_on="session_id", right_on="session_id")

    # Check for duplicate global_trial_name within a session (repeated runs of same trial)
    dup_mask = trial_df.duplicated(subset=['session_id', 'global_trial_name'], keep=False)
    if dup_mask.any():
        dup_rows = trial_df[dup_mask].sort_values(['session_id', 'global_trial_name', 'trial_id'])
        # For each (session_id, global_trial_name), see if scores are identical
        def _resolve_trial_group(g):
            scores = g['score'].astype(float)
            if scores.nunique() > 1:
                # Conflicting scores -> hard failure
                raise ValueError(
                    "Duplicate trials found with the same global_trial_name within a session "
                    "but with different scores. This must be resolved manually.\n"
                    f"Offending rows:\n{g}"
                )
            # Scores identical: keep a single representative row (e.g., max trial_id)
            return g.sort_values('trial_id').iloc[[-1]]

        resolved = (
            dup_rows
            .groupby(['session_id', 'global_trial_name'], as_index=False, group_keys=False)
            .apply(_resolve_trial_group)
        )
        # Drop all original duplicates from trial_df and append the resolved singletons
        trial_df = pd.concat(
            [
                trial_df[~dup_mask],
                resolved
            ],
            ignore_index=True
        )

    # Step 5: Load keystate data and filter for valid trials
    valid_trial_ids = trial_df["trial_id"].dropna().tolist()
    
    # Handle case where there are no valid trial IDs
    if not valid_trial_ids:
        print("WARNING: No valid trial IDs found. Returning empty DataFrames.")
        keystate_df = pd.DataFrame(columns=['frame', 'f_pressed', 'j_pressed', 'trial_id'])
    else:
        keystate_query = f"""
            SELECT ks.frame, ks.f_pressed, ks.j_pressed, ks.trial_id
            FROM keystate ks
            WHERE ks.trial_id IN ({', '.join(map(str, valid_trial_ids))})
        """
        keystate_df = pd.read_sql(keystate_query, engine)

        # Handle duplicate frame within a trial_id:
        # - If f_pressed / j_pressed are identical for the duplicates, keep a single row
        # - If they differ, raise an error
        dup_keystate_mask = keystate_df.duplicated(subset=['trial_id', 'frame'], keep=False)
        if dup_keystate_mask.any():
            dup_rows = keystate_df[dup_keystate_mask].sort_values(['trial_id', 'frame'])

            def _resolve_keystate_group(g):
                # Check if all key states are identical
                same_f = g['f_pressed'].nunique() == 1
                same_j = g['j_pressed'].nunique() == 1
                if same_f and same_j:
                    # Keep a single representative row
                    return g.iloc[[0]]
                raise ValueError(
                    "Raw keystate data contains conflicting rows for the same trial_id/frame "
                    "with different key states. This must be resolved before exporting.\n"
                    f"Offending rows:\n{g}"
                )

            resolved_ks = (
                dup_rows
                .groupby(['trial_id', 'frame'], as_index=False, group_keys=False)
                .apply(_resolve_keystate_group)
            )

            # Drop all original duplicates and append the resolved uniques
            keystate_df = pd.concat(
                [
                    keystate_df[~dup_keystate_mask],
                    resolved_ks
                ],
                ignore_index=True
            )

    # Merge keystate data with global_trial_name
    if not keystate_df.empty and not trial_df.empty:
        keystate_df = pd.merge(keystate_df, trial_df[["trial_id", "global_trial_name"]], on="trial_id", how="left")
    else:
        if not keystate_df.empty:
            keystate_df['global_trial_name'] = None

    # Step 6: Process the data
    if keystate_df.empty:
        rgplot_df = pd.DataFrame(columns=['global_trial_name', 'frame'])
    else:
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
    # Drop trial_id if it exists (it may not be present after groupby with numeric_only=True)
    if "trial_id" in rgplot_df.columns:
        rgplot_df.drop(columns=["trial_id"], inplace=True)

    # Filter folders based on experimental trial prefixes
    entries = os.listdir(path_to_data)
    e_folders = sorted([
        entry for entry in entries 
        if any(entry.startswith(prefix) for prefix in exp_trial_prefixes)
    ])
    print(f"Found {len(e_folders)} trial folders matching prefixes {exp_trial_prefixes}")
    if len(e_folders) > 0:
        print(f"Sample folder names: {e_folders[:5]}")
    
    e_paths = [os.path.join(os.path.join(path_to_data, entry), 'simulation_data.json') for entry in e_folders]
    rg_outcomes = []
    for e_path in e_paths:
        with open(e_path, 'r') as f:
            data = json.load(f)
            rg_outcomes.append(data.get("rg_outcome", ""))
    rg_outcome_df = pd.DataFrame({
        "global_trial_name": e_folders,
        "rg_outcome": rg_outcomes,
        
    })
    print(f"Created rg_outcome_df with {len(rg_outcome_df)} rows")
    rg_outcome_df['rg_outcome_idx'] = rg_outcome_df['rg_outcome'].map({'red': 1, 'green': 0})
    
    # Ensure global_trial_name is string type in all DataFrames before merging
    # Convert to string, handling NaN values properly
    trial_df['global_trial_name'] = trial_df['global_trial_name'].fillna('').astype(str)
    keystate_df['global_trial_name'] = keystate_df['global_trial_name'].fillna('').astype(str)
    rgplot_df['global_trial_name'] = rgplot_df['global_trial_name'].fillna('').astype(str)
    rg_outcome_df['global_trial_name'] = rg_outcome_df['global_trial_name'].astype(str)
    
    # Filter out any rows with empty global_trial_name before merging
    trial_df = trial_df[trial_df['global_trial_name'] != '']
    keystate_df = keystate_df[keystate_df['global_trial_name'] != '']
    rgplot_df = rgplot_df[rgplot_df['global_trial_name'] != '']

    # Merge with rg_outcome_df, using left join to preserve all database records
    if not trial_df.empty:
        trial_df_before = len(trial_df)
        trial_df = pd.merge(trial_df, rg_outcome_df, left_on="global_trial_name", right_on="global_trial_name", how="left")
        print(f"After merging trial_df with rg_outcome_df: {len(trial_df)} rows (was {trial_df_before})")
        # Check for unmatched trials
        unmatched = trial_df[trial_df['rg_outcome'].isna()]
        if len(unmatched) > 0:
            print(f"WARNING: {len(unmatched)} trials in database don't match folder names")
            print(f"Unmatched trial names: {unmatched['global_trial_name'].unique()[:10].tolist()}")
    if not keystate_df.empty:
        keystate_df = pd.merge(keystate_df, rg_outcome_df, left_on="global_trial_name", right_on="global_trial_name", how="left")
        print(f"After merging keystate_df: {len(keystate_df)} rows")
    if not rgplot_df.empty:
        rgplot_df = pd.merge(rgplot_df, rg_outcome_df, left_on="global_trial_name", right_on="global_trial_name", how="left")
        print(f"After merging rgplot_df: {len(rgplot_df)} rows")

    global_trial_names = list(trial_df['global_trial_name'].unique()) if not trial_df.empty else []
    print(f"Final result: {len(session_df)} sessions, {len(trial_df)} trials, {len(keystate_df)} keystates, {len(rgplot_df)} rgplot rows")

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
    if trial_df.empty or keystate_df.empty:
        print("No trial or keystate data to save.")
        return {}

    # Join keystate_df with trial_df to add session_id and global_trial_name
    required_cols = ['trial_id', 'session_id', 'global_trial_name', 'rg_outcome']
    missing_in_trial = [c for c in required_cols if c not in trial_df.columns]
    if missing_in_trial:
        raise ValueError(f"Missing columns in trial_df needed for export: {missing_in_trial}")

    # Ensure trial_df has no empty global_trial_name before merge
    empty_trial_names = trial_df['global_trial_name'].isna() | (trial_df['global_trial_name'] == '')
    if empty_trial_names.any():
        raise ValueError(
            "Found trials with empty global_trial_name. "
            f"Offending trial_ids: {trial_df.loc[empty_trial_names, 'trial_id'].tolist()}"
        )

    # Remove any pre-existing global_trial_name in keystate_df to avoid suffix conflicts;
    # we treat trial_df as the single source of truth for names.
    kstate_no_name = keystate_df.drop(columns=['global_trial_name'], errors='ignore')

    merged = kstate_no_name.merge(
        trial_df[required_cols],
        on='trial_id',
        how='inner',   # require match; do not allow unmatched keystate rows
        validate='many_to_one',
        suffixes=('', '_trial')
    )

    # Normalize column names in case suffixes were introduced unexpectedly
    for col in ['global_trial_name', 'rg_outcome', 'session_id']:
        if col not in merged.columns:
            alt = [c for c in merged.columns if c.startswith(col)]
            if alt:
                merged[col] = merged[alt[0]]
            else:
                raise ValueError(
                    f"Column '{col}' missing after merge. "
                    f"Available columns: {merged.columns.tolist()}"
                )

    # Check for missing names after merge (should not happen with inner join)
    missing_names = merged['global_trial_name'].isna() | (merged['global_trial_name'] == '')
    if missing_names.any():
        bad_ids = merged.loc[missing_names, 'trial_id'].unique().tolist()
        raise ValueError(
            "Merged keystate rows are missing global_trial_name. "
            f"Trial_ids with missing names: {bad_ids}"
        )

    keystate_with_session = merged[['frame', 'red', 'green', 'uncertain', 'session_id', 'rg_outcome', 'trial_id', 'global_trial_name']]\
        .sort_values(['global_trial_name', 'session_id'])

    # If duplicates exist, surface them clearly (do NOT drop silently)
    dup_mask = keystate_with_session.duplicated(subset=['frame', 'global_trial_name', 'session_id'], keep=False)
    if dup_mask.any():
        dup_rows = keystate_with_session[dup_mask].copy()
        dup_rows = dup_rows.sort_values(['global_trial_name', 'session_id', 'frame'])
        raise ValueError(
            "Duplicate rows detected with same frame/global_trial_name/session_id. "
            "This indicates duplicate trials or duplicated keystate logging for the same trial. "
            "Details (first 20 rows):\n"
            f"{dup_rows.head(20)}"
        )

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


import os
import numpy as np


def extract_occlusion_data(path_to_data, participant_FPS=15):
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

