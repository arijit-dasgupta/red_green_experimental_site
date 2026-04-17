# in this file, we have re-usable code and functions to fetch and visualize the results of the REDGREEN experiment. 
# the code here is primarily used for the analysis of the HUMAN empirical data

import os
import pandas as pd
import matplotlib.pyplot as plt
from sqlalchemy import create_engine, text
import json
import cv2
from tqdm import tqdm
from matplotlib.animation import FuncAnimation
from IPython.display import display, HTML
import numpy as np
from matplotlib.gridspec import GridSpec
from matplotlib.patches import Rectangle


def _load_allowed_repeat_trial_names(path_to_data):
    """
    Load set of global_trial_names that are allowed to repeat (from repeat.csv in path_to_data).
    Returns set of names that have repeat count > 0. Returns empty set if repeat.csv missing or unreadable.
    """
    allowed = set()
    repeat_csv_path = os.path.join(path_to_data, "repeat.csv")
    if not os.path.exists(repeat_csv_path):
        return allowed
    try:
        with open(repeat_csv_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = [p.strip() for p in line.split(",")]
                if len(parts) != 2:
                    continue
                trial_name, extra_str = parts
                try:
                    extra = int(extra_str)
                except ValueError:
                    continue
                if extra > 0:
                    allowed.add(trial_name)
    except Exception as e:
        print(f"Warning: could not read repeat.csv at {repeat_csv_path}: {e}")
    return allowed


def _load_catch_trial_names(path_to_data):
    """
    Load ordered list of catch-trial names from catch_trials.txt in path_to_data.
    Returns an empty list if the file is missing or unreadable.
    """
    catch_trials_path = os.path.join(path_to_data, "catch_trials.txt")
    if not os.path.exists(catch_trials_path):
        return []

    catch_trial_names = []
    try:
        with open(catch_trials_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                catch_trial_names.append(line)
    except Exception as e:
        print(f"Warning: could not read catch_trials.txt at {catch_trials_path}: {e}")
        return []

    return catch_trial_names


def _compute_session_exclusion_info(
    trial_df,
    catch_trial_names=None,
    single_keypress_score_min=15,
    single_keypress_score_max=25,
    single_keypress_trial_fraction_threshold=0.5,
    catch_score_threshold=40,
    catch_min_correct=4,
):
    """
    Compute session IDs flagged by each exclusion rule.

    Returns:
        dict with sorted session ID lists for each criterion and their union.
    """
    empty_info = {
        "single_keypress_session_ids": [],
        "catch_failure_session_ids": [],
        "excluded_session_ids": [],
        "catch_failure_details": [],
    }
    if trial_df is None or trial_df.empty or "session_id" not in trial_df.columns:
        return empty_info

    catch_trial_names = catch_trial_names or []

    trial_df = trial_df.copy()
    trial_df["score"] = pd.to_numeric(trial_df["score"], errors="coerce")

    in_midrange = trial_df["score"].between(single_keypress_score_min, single_keypress_score_max, inclusive="both")
    per_session_trial_counts = trial_df.groupby("session_id").size()
    per_session_midrange_counts = in_midrange.groupby(trial_df["session_id"]).sum()
    per_session_midrange_fraction = (
        per_session_midrange_counts / per_session_trial_counts.replace(0, np.nan)
    ).fillna(0)

    single_keypress_session_ids = sorted(
        per_session_midrange_fraction[
            per_session_midrange_fraction > single_keypress_trial_fraction_threshold
        ].index.tolist()
    )

    catch_failure_session_ids = []
    catch_failure_details = []
    if catch_trial_names:
        all_session_ids = sorted(trial_df["session_id"].dropna().unique().tolist())
        catch_trial_set = set(catch_trial_names)
        catch_trial_df = trial_df[trial_df["global_trial_name"].isin(catch_trial_set)].copy()
        if catch_trial_df.empty:
            catch_failure_session_ids = all_session_ids
            catch_failure_details = [
                {
                    "session_id": int(session_id),
                    "n_correct": 0,
                    "n_failed": int(len(catch_trial_names)),
                    "n_missing": int(len(catch_trial_names)),
                    "n_total_catch_trials": int(len(catch_trial_names)),
                }
                for session_id in all_session_ids
            ]
        else:
            catch_trial_df["is_catch_correct"] = catch_trial_df["score"] > catch_score_threshold
            catch_correct_counts = (
                catch_trial_df.groupby("session_id")["is_catch_correct"]
                .sum()
                .reindex(all_session_ids, fill_value=0)
            )
            catch_present_counts = (
                catch_trial_df.groupby("session_id")
                .size()
                .reindex(all_session_ids, fill_value=0)
            )
            catch_failure_mask = (
                (catch_present_counts < len(catch_trial_names))
                | (catch_correct_counts < catch_min_correct)
            )
            catch_failure_session_ids = sorted(
                catch_failure_mask[catch_failure_mask].index.tolist()
            )
            for session_id in catch_failure_session_ids:
                n_correct = int(catch_correct_counts.loc[session_id])
                n_present = int(catch_present_counts.loc[session_id])
                n_missing = max(0, int(len(catch_trial_names) - n_present))
                n_failed = int(len(catch_trial_names) - n_correct)
                catch_failure_details.append({
                    "session_id": int(session_id),
                    "n_correct": n_correct,
                    "n_failed": n_failed,
                    "n_missing": n_missing,
                    "n_total_catch_trials": int(len(catch_trial_names)),
                })

    excluded_session_ids = sorted(
        set(single_keypress_session_ids).union(catch_failure_session_ids)
    )

    return {
        "single_keypress_session_ids": single_keypress_session_ids,
        "catch_failure_session_ids": catch_failure_session_ids,
        "excluded_session_ids": excluded_session_ids,
        "catch_failure_details": catch_failure_details,
    }


def extract_human_data(db_path, path_to_data, exp_trial_prefixes=None, fam_trial_prefixes=None, 
                       allow_incomplete_sessions=False, session_ids=None,
                       apply_session_exclusion_criteria=True,
                       single_keypress_score_min=15,
                       single_keypress_score_max=25,
                       single_keypress_trial_fraction_threshold=0.5,
                       catch_score_threshold=40,
                       catch_min_correct=4,
                       enforce_shared_symmetry_transform=False): 
    """
    Extract human experiment data from database and match with trial data files.
    
    Args:
        db_path: Path to the SQLite database file
        path_to_data: Path to the directory containing trial data folders
        exp_trial_prefixes: List of prefixes for experimental trials (e.g., ['CC_control', 'CC_surprise', 'UC_positive', 'UC_negative'])
        fam_trial_prefixes: List of prefixes for familiarization trials (e.g., ['F'])
        allow_incomplete_sessions: If True, include sessions that are not marked as completed
        session_ids: List of specific session IDs to include (None means include all matching sessions)
        apply_session_exclusion_criteria: If True, exclude sessions flagged by either criterion
        single_keypress_score_min: Lower score bound for the single-keypress exclusion criterion
        single_keypress_score_max: Upper score bound for the single-keypress exclusion criterion
        single_keypress_trial_fraction_threshold: Exclude if more than this fraction of trials are in the score band
        catch_score_threshold: Score threshold for a catch trial to count as correct
        catch_min_correct: Minimum number of correct catch trials required to keep a session
        enforce_shared_symmetry_transform: If True, require each (global_trial_name, repeat_instance_index)
            to have the same symmetry_transform across participants

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

    # Load which trials are allowed to repeat (from repeat.csv)
    allowed_repeat_trial_names = _load_allowed_repeat_trial_names(path_to_data)
    if allowed_repeat_trial_names:
        print(f"Trials allowed to repeat (from repeat.csv): {sorted(allowed_repeat_trial_names)}")
    catch_trial_names = _load_catch_trial_names(path_to_data)
    if catch_trial_names:
        print(f"Catch trials (from catch_trials.txt): {catch_trial_names}")
    else:
        print("No catch_trials.txt found; catch-trial exclusion criterion will not exclude any sessions.")

    # Step 2: Load session data with optional filtering
    if allow_incomplete_sessions:
        # Include incomplete sessions, but still exclude ignored data
        session_query = """
            SELECT id AS session_id, prolific_pid, average_score, randomized_profile_id, time_taken, completed, trials_completed
            FROM redgreen_session
            WHERE (ignore_data = 0 OR ignore_data IS NULL)
        """
    else:
        # Only completed sessions
        session_query = """
            SELECT id AS session_id, prolific_pid, average_score, randomized_profile_id, time_taken, completed, trials_completed
            FROM redgreen_session
            WHERE completed = 1 AND (ignore_data = 0 OR ignore_data IS NULL)
        """
    
    # Filter by specific session IDs if provided
    if session_ids is not None:
        session_ids_str = ','.join(map(str, session_ids))
        session_query += f" AND id IN ({session_ids_str})"

    try:
        session_df = pd.read_sql(session_query, engine)
    except Exception as e:
        msg = str(e).lower()
        if "no such column" in msg or "trials_completed" in msg:
            session_query_legacy = session_query.replace(", trials_completed", "")
            session_df = pd.read_sql(session_query_legacy, engine)
            session_df["trials_completed"] = np.nan
        else:
            raise
    print(f"Found {len(session_df)} sessions (allow_incomplete={allow_incomplete_sessions}, session_ids={session_ids})")

    # # Step 4: Load trial data and map `global_trial_name`
    # Only get trials from the selected sessions
    if len(session_df) > 0:
        session_ids_list = session_df['session_id'].tolist()
        session_ids_str = ','.join(map(str, session_ids_list))
        trial_query = f"""
            SELECT id AS trial_id, session_id, trial_index, global_trial_name, score,
                   repeat_instance_index, symmetry_transform, is_repeated
            FROM trial
            WHERE trial_type != 'ftrial' AND completed = 1 AND session_id IN ({session_ids_str})
        """
    else:
        # No sessions, so no trials
        trial_query = """
            SELECT id AS trial_id, session_id, trial_index, global_trial_name, score,
                   repeat_instance_index, symmetry_transform, is_repeated
            FROM trial
            WHERE 1=0
        """
    
    try:
        trial_df = pd.read_sql(trial_query, engine)
    except Exception as e:
        if "no such column" in str(e).lower() or "repeat_instance_index" in str(e):
            # Legacy DB without repeat/symmetry columns
            if len(session_df) > 0:
                session_ids_str = ','.join(map(str, session_df['session_id'].tolist()))
                trial_query_legacy = f"""
                    SELECT id AS trial_id, session_id, trial_index, global_trial_name, score
                    FROM trial
                    WHERE trial_type != 'ftrial' AND completed = 1 AND session_id IN ({session_ids_str})
                """
            else:
                trial_query_legacy = "SELECT id AS trial_id, session_id, trial_index, global_trial_name, score FROM trial WHERE 1=0"
            trial_df = pd.read_sql(trial_query_legacy, engine)
            trial_df["repeat_instance_index"] = 0
            trial_df["symmetry_transform"] = None
            trial_df["is_repeated"] = False
        else:
            raise
    # Normalize repeat_instance_index: None -> 0 (non-repeated or legacy DB)
    if "repeat_instance_index" in trial_df.columns:
        trial_df["repeat_instance_index"] = trial_df["repeat_instance_index"].fillna(0).astype(int)
    else:
        trial_df["repeat_instance_index"] = 0
    print(f"Found {len(trial_df)} completed experimental trials from selected sessions")
    if len(trial_df) > 0:
        print(f"Sample trial names from database: {trial_df['global_trial_name'].head(5).tolist()}")

    # Merge trials with session randomized order
    trial_df = pd.merge(trial_df, session_df, left_on="session_id", right_on="session_id")

    # Check for duplicate global_trial_name within a session (repeated runs of same trial)
    dup_mask = trial_df.duplicated(subset=['session_id', 'global_trial_name'], keep=False)
    if dup_mask.any():
        dup_rows = trial_df[dup_mask].sort_values(['session_id', 'global_trial_name', 'trial_id'])
        # For each (session_id, global_trial_name), either keep all rows (allowed repeats) or resolve to one
        def _resolve_trial_group(g):
            name = g['global_trial_name'].iloc[0]
            if name in allowed_repeat_trial_names:
                # Allowed repeats: keep one row per (session_id, global_trial_name, repeat_instance_index).
                # Error only on score discrepancy (different scores). Otherwise pick one: prefer the row with a score if exactly one has it, else pick any.
                def _keep_one_instance(h):
                    with_score = h[h['score'].notna()]
                    scores = h['score'].dropna()
                    if scores.nunique() > 1:
                        raise ValueError(
                            "Duplicate trials for the same (session, global_trial_name, repeat_instance_index) "
                            "have different scores (score discrepancy). This must be resolved manually.\n"
                            f"Offending rows:\n{h}"
                        )
                    if len(with_score) == 1:
                        return with_score.iloc[[0]]
                    return h.sort_values('trial_id').iloc[[-1]]
                return (
                    g.groupby('repeat_instance_index', as_index=False, group_keys=False)
                    .apply(_keep_one_instance)
                )
            scores = g['score'].astype(float)
            if scores.nunique() > 1:
                raise ValueError(
                    f"Duplicate trials found for global_trial_name={name!r} within a session "
                    "but with different scores, and this trial is not in repeat.csv. "
                    "Either add it to repeat.csv if repeats are intended, or resolve manually.\n"
                    f"Offending rows:\n{g}"
                )
            return g.sort_values('trial_id').iloc[[-1]]

        resolved = (
            dup_rows
            .groupby(['session_id', 'global_trial_name'], as_index=False, group_keys=False)
            .apply(_resolve_trial_group)
        )
        trial_df = pd.concat(
            [
                trial_df[~dup_mask],
                resolved
            ],
            ignore_index=True
        )

    exclusion_info = _compute_session_exclusion_info(
        trial_df,
        catch_trial_names=catch_trial_names,
        single_keypress_score_min=single_keypress_score_min,
        single_keypress_score_max=single_keypress_score_max,
        single_keypress_trial_fraction_threshold=single_keypress_trial_fraction_threshold,
        catch_score_threshold=catch_score_threshold,
        catch_min_correct=catch_min_correct,
    )
    single_keypress_session_ids = exclusion_info["single_keypress_session_ids"]
    catch_failure_session_ids = exclusion_info["catch_failure_session_ids"]
    excluded_session_ids = exclusion_info["excluded_session_ids"]
    catch_failure_details = exclusion_info["catch_failure_details"]

    print(
        "Criterion 1 - single-keypress-like sessions "
        f"({single_keypress_score_min} to {single_keypress_score_max} on more than "
        f"{100 * single_keypress_trial_fraction_threshold:.0f}% of trials): "
        f"{single_keypress_session_ids} (n={len(single_keypress_session_ids)})"
    )
    print(
        "Criterion 2 - failed catch sessions "
        f"(< {catch_min_correct} of {len(catch_trial_names)} catch trials above {catch_score_threshold}): "
        f"{catch_failure_session_ids} (n={len(catch_failure_session_ids)})"
    )
    if catch_failure_details:
        print("Catch-trial failures by session:")
        for detail in catch_failure_details:
            missing_text = f", missing={detail['n_missing']}" if detail["n_missing"] > 0 else ""
            print(
                f"  Session {detail['session_id']}: "
                f"failed {detail['n_failed']} of {detail['n_total_catch_trials']} "
                f"(correct={detail['n_correct']}{missing_text})"
            )

    if apply_session_exclusion_criteria and excluded_session_ids:
        session_df = session_df[~session_df["session_id"].isin(excluded_session_ids)].copy()
        trial_df = trial_df[~trial_df["session_id"].isin(excluded_session_ids)].copy()
        print(
            f"Excluded session IDs after applying session exclusion criteria: "
            f"{excluded_session_ids} (n={len(excluded_session_ids)})"
        )
    elif apply_session_exclusion_criteria:
        print("No session IDs met the exclusion criteria.")
    else:
        print("Session exclusion criteria were computed but not applied.")

    print(f"Sessions that made the cut: {len(session_df)}")
    session_df.attrs["single_keypress_session_ids"] = single_keypress_session_ids
    session_df.attrs["catch_failure_session_ids"] = catch_failure_session_ids
    session_df.attrs["excluded_session_ids"] = excluded_session_ids
    session_df.attrs["catch_failure_details"] = catch_failure_details

    # Symmetry may be randomized per participant. Keep the old consistency check optional.
    if "symmetry_transform" in trial_df.columns and enforce_shared_symmetry_transform:
        sym_check = (
            trial_df.groupby(["global_trial_name", "repeat_instance_index"])["symmetry_transform"]
            .agg(lambda x: x.dropna().nunique())
            .reset_index()
        )
        bad = sym_check[sym_check["symmetry_transform"] > 1]
        if not bad.empty:
            raise ValueError(
                "Symmetry transform must be the same for all participants for each (global_trial_name, repeat_instance_index). "
                "Different values indicate inconsistent trial ordering across participants.\n"
                f"Offending (global_trial_name, repeat_instance_index):\n{bad}"
            )
    elif "symmetry_transform" in trial_df.columns:
        varying_symmetry = (
            trial_df.groupby(["global_trial_name", "repeat_instance_index"])["symmetry_transform"]
            .agg(lambda x: x.dropna().nunique())
            .reset_index()
        )
        varying_symmetry = varying_symmetry[varying_symmetry["symmetry_transform"] > 1]
        if not varying_symmetry.empty:
            print(
                "Detected participant-randomized symmetry transforms for "
                f"{len(varying_symmetry)} (global_trial_name, repeat_instance_index) groups; "
                "continuing because enforce_shared_symmetry_transform=False."
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

    # Merge keystate data with global_trial_name and repeat_instance_index
    merge_cols = ["trial_id", "global_trial_name", "repeat_instance_index"]
    if not keystate_df.empty and not trial_df.empty:
        keystate_df = pd.merge(
            keystate_df,
            trial_df[[c for c in merge_cols if c in trial_df.columns]],
            on="trial_id",
            how="left",
        )
    else:
        if not keystate_df.empty:
            keystate_df['global_trial_name'] = None
    if not keystate_df.empty and 'repeat_instance_index' not in keystate_df.columns:
        keystate_df['repeat_instance_index'] = 0

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
    For trials with repeats (multiple instances per participant), saves one CSV per instance:
    - Instance 0 (first occurrence): human_data.csv
    - Instance 1, 2, ...: human_data_rep1.csv, human_data_rep2.csv, ...

    Args:
        trial_df: DataFrame containing trial information with trial_id, session_id, global_trial_name, and optionally repeat_instance_index
        keystate_df: DataFrame containing keystate data with trial_id
        path_to_data: Path to the directory containing trial folders

    Returns:
        dict: Dictionary keyed by (global_trial_name, repeat_instance_index) of dataframes
    """
    if trial_df.empty:
        print("No trial data to save.")
        return {}

    if 'repeat_instance_index' not in trial_df.columns:
        trial_df = trial_df.copy()
        trial_df['repeat_instance_index'] = 0
    if 'symmetry_transform' not in trial_df.columns:
        trial_df = trial_df.copy()
        trial_df['symmetry_transform'] = 0

    required_cols = ['trial_id', 'session_id', 'global_trial_name', 'rg_outcome']
    export_cols = required_cols + ['repeat_instance_index']
    missing_in_trial = [c for c in required_cols if c not in trial_df.columns]
    if missing_in_trial:
        raise ValueError(f"Missing columns in trial_df needed for export: {missing_in_trial}")

    empty_trial_names = trial_df['global_trial_name'].isna() | (trial_df['global_trial_name'] == '')
    if empty_trial_names.any():
        raise ValueError(
            "Found trials with empty global_trial_name. "
            f"Offending trial_ids: {trial_df.loc[empty_trial_names, 'trial_id'].tolist()}"
        )

    trial_order_details = trial_df.copy()
    if 'trial_index' not in trial_order_details.columns:
        raise ValueError(
            "Missing column 'trial_index' in trial_df needed to export trial order details."
        )
    if 'symmetry_transform' not in trial_order_details.columns:
        trial_order_details['symmetry_transform'] = 0
    trial_order_details['repeat_instance_index'] = trial_order_details['repeat_instance_index'].fillna(0).astype(int)
    trial_order_details['symmetry_transform'] = trial_order_details['symmetry_transform'].fillna(0).astype(int)
    trial_order_details = trial_order_details.rename(columns={'global_trial_name': 'base_trial_name'})
    trial_order_details['trial_order_position'] = trial_order_details['trial_index'].astype(int) + 1
    trial_order_details = trial_order_details[
        ['base_trial_name', 'session_id', 'repeat_instance_index', 'trial_order_position', 'symmetry_transform']
    ].sort_values(['session_id', 'trial_order_position', 'repeat_instance_index', 'base_trial_name'])
    trial_order_details_filepath = os.path.join(path_to_data, 'trial_order_details.csv')
    trial_order_details.to_csv(trial_order_details_filepath, index=False)

    if keystate_df.empty:
        print(f"Saved trial order details to {trial_order_details_filepath}")
        print("No keystate data to save.")
        return {}

    kstate_no_name = keystate_df.drop(columns=['global_trial_name', 'repeat_instance_index'], errors='ignore')

    merged = kstate_no_name.merge(
        trial_df[export_cols],
        on='trial_id',
        how='inner',
        validate='many_to_one',
        suffixes=('', '_trial')
    )

    for col in ['global_trial_name', 'rg_outcome', 'session_id', 'repeat_instance_index']:
        if col not in merged.columns:
            alt = [c for c in merged.columns if c.startswith(col)]
            if alt:
                merged[col] = merged[alt[0]]
            elif col == 'repeat_instance_index':
                merged['repeat_instance_index'] = 0
            else:
                raise ValueError(
                    f"Column '{col}' missing after merge. "
                    f"Available columns: {merged.columns.tolist()}"
                )

    missing_names = merged['global_trial_name'].isna() | (merged['global_trial_name'] == '')
    if missing_names.any():
        bad_ids = merged.loc[missing_names, 'trial_id'].unique().tolist()
        raise ValueError(
            "Merged keystate rows are missing global_trial_name. "
            f"Trial_ids with missing names: {bad_ids}"
        )

    merged['repeat_instance_index'] = merged['repeat_instance_index'].fillna(0).astype(int)
    keystate_with_session = merged[
        ['frame', 'red', 'green', 'uncertain', 'session_id', 'rg_outcome', 'trial_id', 'global_trial_name', 'repeat_instance_index']
    ].sort_values(['global_trial_name', 'repeat_instance_index', 'session_id'])

    # Uniqueness: (frame, global_trial_name, session_id, repeat_instance_index) must be unique
    dup_mask = keystate_with_session.duplicated(
        subset=['frame', 'global_trial_name', 'session_id', 'repeat_instance_index'], keep=False
    )
    if dup_mask.any():
        dup_rows = keystate_with_session[dup_mask].copy()
        dup_rows = dup_rows.sort_values(['global_trial_name', 'repeat_instance_index', 'session_id', 'frame'])
        raise ValueError(
            "Duplicate rows detected with same frame/global_trial_name/session_id/repeat_instance_index. "
            "Details (first 20 rows):\n"
            f"{dup_rows.head(20)}"
        )

    # One dataframe per (global_trial_name, repeat_instance_index)
    keystate_by_trial = {}
    for (trial_name, rep_idx), group in keystate_with_session.groupby(['global_trial_name', 'repeat_instance_index']):
        keystate_by_trial[(trial_name, rep_idx)] = group.drop(columns=['repeat_instance_index'], errors='ignore').copy()

    # Save: instance 0 -> human_data.csv, instance k -> human_data_rep{k}.csv
    for (trial_name, rep_idx), trial_data in keystate_by_trial.items():
        if rep_idx == 0:
            csv_filename = "human_data.csv"
        else:
            csv_filename = f"human_data_rep{rep_idx}.csv"
        csv_filepath = os.path.join(path_to_data, trial_name, csv_filename)
        trial_data.to_csv(csv_filepath, index=False)

    print(f"Saved trial order details to {trial_order_details_filepath}")
    print(f"Saved human data as CSV files in {path_to_data}")
    return keystate_by_trial


def load_click_data(db_path, session_ids=None):
    """
    Load click-point data from trial_pause_click table (if it exists).
    Joins with trial to get global_trial_name and repeat_instance_index.
    Returns a DataFrame with columns including session_id, trial_id, pause_frame,
    click_bottom_left_x/y, ball_x/y, diameters_away. When present in the DB,
    also includes trial_name (from c) and reaction_time_ms.

    Args:
        db_path: Path to the SQLite database file
        session_ids: Optional list of session IDs to include
    """
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='trial_pause_click'")
        )
        if result.fetchone() is None:
            return pd.DataFrame()
        # Discover columns so we can handle legacy DBs missing reaction_time_ms or trial_name
        info = conn.execute(text("PRAGMA table_info(trial_pause_click)")).fetchall()
        c_cols = [row[1] for row in info]
        t_info = conn.execute(text("PRAGMA table_info(trial)")).fetchall()
        t_cols = [row[1] for row in t_info]
    base_c = ["c.id", "c.trial_id", "c.session_id", "c.pause_frame",
              "c.click_bottom_left_x", "c.click_bottom_left_y", "c.ball_x", "c.ball_y", "c.diameters_away"]
    if "trial_name" in c_cols:
        base_c.append("c.trial_name")
    if "reaction_time_ms" in c_cols:
        base_c.append("c.reaction_time_ms")
    c_select = ", ".join(base_c)
    t_extra = ["t.trial_type"]
    if "symmetry_transform" in t_cols:
        t_extra.append("t.symmetry_transform")
    t_select = "t.global_trial_name, t.repeat_instance_index, " + ", ".join(t_extra)
    # Mirror extract_human_data trial filtering: only experimental trials (no fam).
    # - trial_type = 'trial' (exclude 'ftrial' familiarization trials)
    # - t.completed = 1; sessions completed and not ignored (ignore_data = 0/NULL, s.completed = 1)
    query = f"""
        SELECT {c_select},
               {t_select}
        FROM trial_pause_click c
        JOIN trial t ON c.trial_id = t.id
        JOIN redgreen_session s ON c.session_id = s.id
        WHERE (s.ignore_data = 0 OR s.ignore_data IS NULL)
          AND s.completed = 1
          AND t.trial_type = 'trial'
          AND t.completed = 1
    """
    if session_ids is not None:
        session_ids = list(session_ids)
        if len(session_ids) == 0:
            return pd.DataFrame()
        session_ids_str = ", ".join(map(str, session_ids))
        query += f" AND c.session_id IN ({session_ids_str})"
    query += "\n        ORDER BY t.global_trial_name, t.repeat_instance_index, c.session_id\n    "
    click_df = pd.read_sql(query, engine)
    if "reaction_time_ms" not in click_df.columns:
        click_df["reaction_time_ms"] = np.nan
    if "trial_name" not in click_df.columns:
        click_df["trial_name"] = click_df["global_trial_name"]
    if "symmetry_transform" not in click_df.columns:
        click_df["symmetry_transform"] = 0
    click_df["symmetry_transform"] = click_df["symmetry_transform"].fillna(0).astype(int)
    return click_df


def save_click_data_by_trial(click_df, path_to_data):
    """
    Save click data as separate CSV files per (global_trial_name, repeat_instance_index).
    - Instance 0: click_data.csv
    - Instance 1, 2, ...: click_data_rep1.csv, click_data_rep2.csv, ...
    Does nothing if click_df is empty.
    """
    if click_df is None or click_df.empty:
        return
    click_df = click_df.copy()
    # Exclude familiarization trials (same as non-click analysis: only experimental trials)
    if "trial_type" in click_df.columns:
        click_df = click_df[click_df["trial_type"] == "trial"].copy()
        click_df = click_df.drop(columns=["trial_type"])
    if click_df.empty:
        return
    click_df["repeat_instance_index"] = click_df["repeat_instance_index"].fillna(0).astype(int)

    # Undo D4 symmetry so exported click positions are in the canonical frame.
    def _inverse_transform_index(idx: int) -> int:
        # D4 group: reflections/self-inverse; 90deg <-> 270deg.
        if idx == 1:
            return 3
        if idx == 3:
            return 1
        return idx or 0

    def _transform_point(x, y, W, H, transform_index):
        # Copied from backend.transform_point
        cx = W / 2.0
        cy = H / 2.0
        def _get_d4_matrix(ti):
            if ti == 0:
                return 1, 0, 0, 1
            elif ti == 1:
                return 0, -1, 1, 0
            elif ti == 2:
                return -1, 0, 0, -1
            elif ti == 3:
                return 0, 1, -1, 0
            elif ti == 4:
                return -1, 0, 0, 1
            elif ti == 5:
                return 1, 0, 0, -1
            elif ti == 6:
                return 0, 1, 1, 0
            elif ti == 7:
                return 0, -1, -1, 0
            else:
                raise ValueError(f"Invalid D4 transform index: {ti}")
        a, b, c, d = _get_d4_matrix(transform_index)
        dx = x - cx
        dy = y - cy
        x_prime = cx + a * dx + b * dy
        y_prime = cy + c * dx + d * dy
        return x_prime, y_prime

    # Preload world dimensions and radius per trial_name from simulation_data.json
    trial_dims = {}
    for trial_name in sorted(click_df["global_trial_name"].unique()):
        trial_dir = os.path.join(path_to_data, str(trial_name))
        sim_path = os.path.join(trial_dir, "simulation_data.json")
        if not os.path.exists(sim_path):
            # Fallback to defaults if JSON missing
            trial_dims[trial_name] = (20.0, 20.0, 0.5)
            continue
        try:
            with open(sim_path, "r") as f:
                data = json.load(f)
            W = float(data.get("worldWidth", data.get("world_width", 20.0)))
            H = float(data.get("worldHeight", data.get("world_height", 20.0)))
            radius = float(data.get("radius", 0.5))
            trial_dims[trial_name] = (W, H, radius)
        except Exception:
            trial_dims[trial_name] = (20.0, 20.0, 0.5)

    def _undo_symmetry_for_row(row):
        trial_name = row["global_trial_name"]
        W, H, radius = trial_dims.get(trial_name, (20.0, 20.0, 0.5))
        idx = int(row.get("symmetry_transform", 0) or 0)
        inv_idx = _inverse_transform_index(idx)
        if inv_idx == 0:
            return row
        # Transform click bottom-left (if present)
        cbx = row.get("click_bottom_left_x")
        cby = row.get("click_bottom_left_y")
        if cbx is not None and cby is not None:
            cx = float(cbx) + radius
            cy = float(cby) + radius
            cx0, cy0 = _transform_point(cx, cy, W, H, inv_idx)
            row["click_bottom_left_x"] = cx0 - radius
            row["click_bottom_left_y"] = cy0 - radius
        # Transform ball bottom-left (if present)
        bx = row.get("ball_x")
        by = row.get("ball_y")
        if bx is not None and by is not None:
            bcx = float(bx) + radius
            bcy = float(by) + radius
            bcx0, bcy0 = _transform_point(bcx, bcy, W, H, inv_idx)
            row["ball_x"] = bcx0 - radius
            row["ball_y"] = bcy0 - radius
        return row

    # Apply inverse symmetry per row
    click_df = click_df.apply(_undo_symmetry_for_row, axis=1)

    for (trial_name, rep_idx), group in click_df.groupby(["global_trial_name", "repeat_instance_index"]):
        trial_dir = os.path.join(path_to_data, str(trial_name))
        os.makedirs(trial_dir, exist_ok=True)
        if rep_idx == 0:
            csv_filename = "click_data.csv"
        else:
            csv_filename = f"click_data_rep{rep_idx}.csv"
        csv_filepath = os.path.join(trial_dir, csv_filename)
        group.to_csv(csv_filepath, index=False)
    print(f"Saved click data as CSV files in {path_to_data}")


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


def plot_reaction_time_distributions(click_df, bins=30):
    """
    Plot overall reaction time distribution for all click trials, with summary statistics.
    """
    if click_df is None or click_df.empty or "reaction_time_ms" not in click_df.columns:
        print("No reaction_time_ms data to plot.")
        return
    rts = click_df["reaction_time_ms"].dropna()
    if rts.empty:
        print("No non-null reaction_time_ms values to plot.")
        return

    fig, ax = plt.subplots(figsize=(6, 4))
    ax.hist(rts, bins=bins, color="steelblue", edgecolor="black", alpha=0.7)

    mean_rt = rts.mean()
    median_rt = rts.median()
    ax.axvline(mean_rt, color="red", linestyle="--", label=f"Mean = {mean_rt:.0f} ms")
    ax.axvline(median_rt, color="green", linestyle=":", label=f"Median = {median_rt:.0f} ms")

    ax.set_xlabel("Reaction time (ms)")
    ax.set_ylabel("Count")
    ax.set_title("Reaction time distribution (all click trials)")
    # Ensure x-axis starts at 0
    xmin, xmax = ax.get_xlim()
    ax.set_xlim(left=0, right=xmax)
    ax.legend()
    plt.tight_layout()
    plt.show()


def plot_reaction_time_distributions_by_session(click_df, max_cols=4, bins=20):
    """
    Plot reaction time distributions per participant (session_id) in a grid of histograms.
    All subplots share the same x-axis limits.
    """
    if click_df is None or click_df.empty or "reaction_time_ms" not in click_df.columns:
        print("No reaction_time_ms data to plot.")
        return
    if "session_id" not in click_df.columns:
        print("click_df is missing 'session_id'; cannot facet by participant.")
        return

    data = click_df[["session_id", "reaction_time_ms"]].dropna()
    if data.empty:
        print("No non-null reaction_time_ms values to plot by session.")
        return

    # Global min/max for shared x-axis; force lower bound to 0
    rt_min = 0.0
    rt_max = data["reaction_time_ms"].max()
    if rt_min == rt_max:
        rt_min -= 1.0
        rt_max += 1.0
    bin_edges = np.linspace(rt_min, rt_max, bins + 1)

    session_ids = sorted(data["session_id"].unique())
    num_sessions = len(session_ids)
    n_cols = min(max_cols, num_sessions)
    n_rows = int(np.ceil(num_sessions / n_cols))

    fig, axes = plt.subplots(n_rows, n_cols, figsize=(4 * n_cols, 3 * n_rows), sharex=True)
    axes = np.atleast_2d(axes)

    for idx, sid in enumerate(session_ids):
        rts_s = data.loc[data["session_id"] == sid, "reaction_time_ms"]
        row = idx // n_cols
        col = idx % n_cols
        ax = axes[row, col]
        ax.hist(rts_s, bins=bin_edges, color="steelblue", edgecolor="black", alpha=0.7)
        participant_idx = idx + 1
        ax.set_title(f"Participant {participant_idx}")
        ax.set_ylabel("Count")
        # Ensure x-axis ticks/labels are visible on all subplots
        ax.tick_params(axis="x", which="both", labelbottom=True)

    # Turn off any unused subplots
    for j in range(num_sessions, n_rows * n_cols):
        row = j // n_cols
        col = j % n_cols
        axes[row, col].axis("off")

    for ax in axes[-1, :]:
        ax.set_xlabel("Reaction time (ms)")

    fig.suptitle("Reaction time distributions by participant", y=0.98)
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
