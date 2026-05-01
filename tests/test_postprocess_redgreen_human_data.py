import json
from pathlib import Path
import sqlite3

import pandas as pd

from backend.postprocess_redgreen_human_data import (
    apply_click_localization_exclusion_criteria,
    extract_human_data,
    load_click_data,
    load_goal_probe_data,
    save_human_data_by_trial,
)


def test_save_human_data_by_trial_writes_trial_order_details_at_dataset_root(tmp_path):
    path_to_data = tmp_path / "dataset"
    path_to_data.mkdir()
    for trial_name in ["T1A", "T3B", "T14"]:
        (path_to_data / trial_name).mkdir()

    trial_df = pd.DataFrame(
        [
            {
                "trial_id": 103,
                "session_id": 2,
                "global_trial_name": "T1A",
                "rg_outcome": "loss",
                "repeat_instance_index": 0,
                "trial_index": 0,
                "symmetry_transform": 1,
            },
            {
                "trial_id": 101,
                "session_id": 8,
                "global_trial_name": "T3B",
                "rg_outcome": "win",
                "repeat_instance_index": 0,
                "trial_index": 2,
                "symmetry_transform": 5,
            },
            {
                "trial_id": 102,
                "session_id": 8,
                "global_trial_name": "T14",
                "rg_outcome": "win",
                "repeat_instance_index": 1,
                "trial_index": 3,
                "symmetry_transform": 6,
            },
        ]
    )
    keystate_df = pd.DataFrame(
        [
            {"trial_id": 101, "frame": 1, "red": 0, "green": 1, "uncertain": 0},
            {"trial_id": 102, "frame": 1, "red": 1, "green": 0, "uncertain": 0},
            {"trial_id": 103, "frame": 1, "red": 1, "green": 1, "uncertain": 0},
        ]
    )

    save_human_data_by_trial(trial_df, keystate_df, str(path_to_data))

    trial_order_path = Path(path_to_data) / "trial_order_details.csv"
    assert trial_order_path.exists()

    trial_order_df = pd.read_csv(trial_order_path)
    assert list(trial_order_df.columns) == [
        "base_trial_name",
        "session_id",
        "repeat_instance_index",
        "trial_order_position",
        "symmetry_transform",
    ]
    assert trial_order_df.to_dict(orient="records") == [
        {
            "base_trial_name": "T1A",
            "session_id": 2,
            "repeat_instance_index": 0,
            "trial_order_position": 1,
            "symmetry_transform": 1,
        },
        {
            "base_trial_name": "T3B",
            "session_id": 8,
            "repeat_instance_index": 0,
            "trial_order_position": 3,
            "symmetry_transform": 5,
        },
        {
            "base_trial_name": "T14",
            "session_id": 8,
            "repeat_instance_index": 1,
            "trial_order_position": 4,
            "symmetry_transform": 6,
        },
    ]


def _write_minimal_trial_dataset(
    path_to_data,
    trial_name,
    *,
    rg_outcome="red",
    world_width=10,
    world_height=10,
    radius=1,
    sensors=None,
):
    trial_dir = Path(path_to_data) / trial_name
    trial_dir.mkdir(parents=True, exist_ok=True)
    trial_payload = {
        "rg_outcome": rg_outcome,
        "worldWidth": world_width,
        "worldHeight": world_height,
        "radius": radius,
        "scene_dims": [world_width, world_height],
    }
    if sensors:
        trial_payload.update(sensors)
    (trial_dir / "simulation_data.json").write_text(json.dumps(trial_payload))


def _create_minimal_postprocess_db(db_path):
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE redgreen_session (
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
            trials_completed INTEGER,
            post_experiment_feedback TEXT,
            post_experiment_feedback_submitted INTEGER
        );

        CREATE TABLE trial (
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

        CREATE TABLE keystate (
            id INTEGER PRIMARY KEY,
            trial_id INTEGER NOT NULL,
            frame INTEGER,
            f_pressed INTEGER,
            j_pressed INTEGER,
            session_id INTEGER NOT NULL,
            relative_time_ms REAL
        );

        CREATE TABLE trial_pause_click (
            id INTEGER PRIMARY KEY,
            trial_id INTEGER NOT NULL,
            session_id INTEGER NOT NULL,
            pause_frame INTEGER NOT NULL,
            click_bottom_left_x REAL NOT NULL,
            click_bottom_left_y REAL NOT NULL,
            ball_x REAL,
            ball_y REAL,
            diameters_away REAL,
            reaction_time_ms REAL,
            trial_name TEXT
        );

        CREATE TABLE trial_goal_probe (
            id INTEGER PRIMARY KEY,
            trial_id INTEGER NOT NULL,
            session_id INTEGER NOT NULL,
            goal_choice TEXT,
            reaction_time_ms REAL,
            trial_name TEXT
        );
        """
    )
    conn.execute(
        """
        INSERT INTO redgreen_session (
            id, randomized_profile_id, ignore_data, completed, dataset_name,
            experiment_run_version, trials_completed, post_experiment_feedback_submitted
        ) VALUES (1, 7, 0, 1, 'dataset', 'experiment', 1, 0)
        """
    )
    conn.execute(
        """
        INSERT INTO trial (
            id, session_id, trial_type, trial_index, global_trial_name, score,
            completed, symmetry_transform, is_repeated, repeat_instance_index
        ) VALUES (11, 1, 'trial', 0, 'T1A', 20.0, 1, 1, 0, 0)
        """
    )
    conn.execute(
        """
        INSERT INTO keystate (
            id, trial_id, frame, f_pressed, j_pressed, session_id, relative_time_ms
        ) VALUES (21, 11, 0, 0, 1, 1, 12.5)
        """
    )
    conn.execute(
        """
        INSERT INTO trial_pause_click (
            id, trial_id, session_id, pause_frame, click_bottom_left_x,
            click_bottom_left_y, ball_x, ball_y, diameters_away, reaction_time_ms, trial_name
        ) VALUES (31, 11, 1, 12, 5.0, 2.0, 5.0, 2.0, 0.0, 250.0, 'T1A')
        """
    )
    conn.execute(
        """
        INSERT INTO trial_goal_probe (
            id, trial_id, session_id, goal_choice, reaction_time_ms, trial_name
        ) VALUES (41, 11, 1, 'red', 1200.0, 'T1A')
        """
    )
    conn.commit()
    conn.close()


def test_extract_human_data_preserves_canonical_red_green_after_counterbalance(tmp_path):
    path_to_data = tmp_path / "dataset"
    _write_minimal_trial_dataset(path_to_data, "T1A", rg_outcome="red")

    db_path = tmp_path / "human.db"
    _create_minimal_postprocess_db(db_path)

    session_df, trial_df, keystate_df, rgplot_df, valid_trial_ids, global_trial_names = extract_human_data(
        str(db_path),
        str(path_to_data),
        exp_trial_prefixes=["T"],
        fam_trial_prefixes=["F"],
        apply_session_exclusion_criteria=False,
    )

    assert len(session_df) == 1
    assert valid_trial_ids == [11]
    assert global_trial_names == ["T1A"]

    row = keystate_df.iloc[0]
    assert row["f_pressed"] == 0
    assert row["j_pressed"] == 1
    assert row["red"] == 0
    assert row["green"] == 1
    assert row["uncertain"] == 0


def test_load_click_data_undoes_symmetry_transform_for_click_locations(tmp_path):
    path_to_data = tmp_path / "dataset"
    _write_minimal_trial_dataset(path_to_data, "T1A", rg_outcome="red", world_width=10, world_height=10, radius=1)

    db_path = tmp_path / "clicks.db"
    _create_minimal_postprocess_db(db_path)

    click_df = load_click_data(str(db_path))
    assert len(click_df) == 1

    row = click_df.iloc[0]
    assert row["global_trial_name"] == "T1A"
    assert row["symmetry_transform"] == 1
    assert row["click_bottom_left_x"] == pytest.approx(2.0)
    assert row["click_bottom_left_y"] == pytest.approx(3.0)
    assert row["ball_x"] == pytest.approx(2.0)
    assert row["ball_y"] == pytest.approx(3.0)


def test_click_localization_criterion3_and_6_use_the_right_rows(tmp_path):
    path_to_data = tmp_path / "dataset"
    sensors = {
        "green_sensor": {"x": 0, "y": 0, "width": 2, "height": 2},
        "red_sensor": {"x": 8, "y": 8, "width": 1, "height": 1},
    }
    _write_minimal_trial_dataset(path_to_data, "L1", rg_outcome="red", world_width=10, world_height=10, radius=1, sensors=sensors)

    db_path = tmp_path / "clicks.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE redgreen_session (
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
            trials_completed INTEGER,
            post_experiment_feedback TEXT,
            post_experiment_feedback_submitted INTEGER
        );

        CREATE TABLE trial (
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

        CREATE TABLE trial_pause_click (
            id INTEGER PRIMARY KEY,
            trial_id INTEGER NOT NULL,
            session_id INTEGER NOT NULL,
            pause_frame INTEGER NOT NULL,
            click_bottom_left_x REAL NOT NULL,
            click_bottom_left_y REAL NOT NULL,
            ball_x REAL,
            ball_y REAL,
            diameters_away REAL,
            reaction_time_ms REAL,
            trial_name TEXT
        );

        CREATE TABLE trial_goal_probe (
            id INTEGER PRIMARY KEY,
            trial_id INTEGER NOT NULL,
            session_id INTEGER NOT NULL,
            goal_choice TEXT,
            reaction_time_ms REAL,
            trial_name TEXT
        );
        """
    )
    conn.execute(
        """
        INSERT INTO redgreen_session (
            id, randomized_profile_id, ignore_data, completed, dataset_name,
            experiment_run_version, trials_completed, post_experiment_feedback_submitted
        ) VALUES (1, 7, 0, 1, 'dataset', 'experiment', 1, 0),
                 (2, 7, 0, 1, 'dataset', 'experiment', 1, 0),
                 (3, 7, 0, 1, 'dataset', 'experiment', 1, 0)
        """
    )
    conn.execute(
        """
        INSERT INTO trial (
            id, session_id, trial_type, trial_index, global_trial_name, score,
            completed, symmetry_transform, is_repeated, repeat_instance_index
        ) VALUES
            (11, 1, 'trial', 0, 'L1', 20.0, 1, 0, 0, 0),
            (12, 2, 'trial', 0, 'L1', 20.0, 1, 0, 0, 0),
            (13, 3, 'trial', 0, 'L1', 20.0, 1, 0, 0, 0)
        """
    )
    conn.execute(
        """
        INSERT INTO trial_pause_click (
            id, trial_id, session_id, pause_frame, click_bottom_left_x,
            click_bottom_left_y, ball_x, ball_y, diameters_away, reaction_time_ms, trial_name
        ) VALUES
            (31, 11, 1, 12, 6.0, 6.0, 6.0, 6.0, 8.0, 250.0, 'L1'),
            (32, 12, 2, 12, 0.0, 0.0, 0.0, 0.0, 0.0, 6001.0, 'L1'),
            (33, 13, 3, 12, 4.0, 4.0, 4.0, 4.0, 1.0, 180.0, 'L1')
        """
    )
    conn.execute(
        """
        INSERT INTO trial_goal_probe (
            id, trial_id, session_id, goal_choice, reaction_time_ms, trial_name
        ) VALUES
            (41, 11, 1, 'red', 1200.0, 'L1'),
            (42, 12, 2, 'green', 200.0, 'L1'),
            (43, 13, 3, 'green', 180.0, 'L1')
        """
    )
    conn.commit()
    conn.close()

    click_df = load_click_data(str(db_path))
    goal_probe_df = load_goal_probe_data(str(db_path))
    session_df = pd.DataFrame({"session_id": [1, 2, 3]})
    session_df.attrs["single_keypress_session_ids"] = []
    session_df.attrs["catch_failure_session_ids"] = []
    trial_df = pd.DataFrame(
        [
            {"trial_id": 11, "session_id": 1, "global_trial_name": "L1", "trial_index": 0},
            {"trial_id": 12, "session_id": 2, "global_trial_name": "L1", "trial_index": 0},
            {"trial_id": 13, "session_id": 3, "global_trial_name": "L1", "trial_index": 0},
        ]
    )
    keystate_df = pd.DataFrame(
        [
            {"trial_id": 11, "frame": 0},
            {"trial_id": 12, "frame": 0},
            {"trial_id": 13, "frame": 0},
        ]
    )

    session_df2, trial_df2, keystate_df2, click_final, goal_probe_final, summary = apply_click_localization_exclusion_criteria(
        session_df,
        trial_df,
        keystate_df,
        click_df,
        str(path_to_data),
        goal_probe_df=goal_probe_df,
        max_rt_ms=5000,
        max_diameters_from_goal_edge=2.0,
        fraction_threshold=0.5,
        use_color=False,
    )

    assert summary["total_click_trials"] == 3
    assert summary["overview_rows"][2]["removed"] == 0
    assert summary["overview_rows"][3]["removed"] == 1
    assert summary["overview_rows"][4]["removed"] == 0
    assert summary["overview_rows"][5]["removed"] == 1
    assert summary["criterion_3_participants"][0]["session_id"] == 2
    assert summary["criterion_3_participants"][0]["status"] == "EXCLUDED"
    assert summary["criterion_4_participants"]
    assert session_df2["session_id"].tolist() == [3]
    assert trial_df2["session_id"].tolist() == [3]
    assert click_final["session_id"].tolist() == [3]
    assert summary["final_goal_probe_trials"] == 1
    assert goal_probe_final["reaction_time_ms"].tolist() == [180.0]
