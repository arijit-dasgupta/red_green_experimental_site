from pathlib import Path

import pandas as pd

from backend.postprocess_redgreen_human_data import save_human_data_by_trial


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

