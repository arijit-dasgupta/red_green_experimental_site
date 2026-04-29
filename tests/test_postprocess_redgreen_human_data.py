from pathlib import Path
import sqlite3

import pandas as pd

from backend.postprocess_redgreen_human_data import extract_human_data, load_click_data, save_human_data_by_trial


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


def _write_minimal_trial_dataset(path_to_data, trial_name, *, rg_outcome="red", world_width=10, world_height=10, radius=1):
    trial_dir = Path(path_to_data) / trial_name
    trial_dir.mkdir(parents=True, exist_ok=True)
    trial_payload = {
        "rg_outcome": rg_outcome,
        "worldWidth": world_width,
        "worldHeight": world_height,
        "radius": radius,
        "scene_dims": [world_width, world_height],
    }
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
