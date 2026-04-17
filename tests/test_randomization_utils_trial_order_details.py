from pathlib import Path

from backend import randomization_utils as ru


def _write_trial_order_details(base_dir: Path):
    dataset_dir = base_dir / "redgreen_experiment_1"
    dataset_dir.mkdir(parents=True)
    (dataset_dir / "trial_order_details.csv").write_text(
        "\n".join(
            [
                "base_trial_name,session_id,repeat_instance_index,trial_order_position,symmetry_transform",
                "T1A,7,0,1,3",
                "T3B,7,0,2,1",
                "T1A,7,1,3,3",
                "T1A,8,0,1,4",
                "T3B,8,0,2,2",
                "T1A,8,1,3,4",
            ]
        )
        + "\n"
    )
    return dataset_dir


def test_load_trial_order_details_reads_dataset_root_csv(tmp_path):
    _write_trial_order_details(tmp_path / "trial_data")

    rows = ru.load_trial_order_details(dataset_name="redgreen_experiment_1", trial_data_root=str(tmp_path / "trial_data"))

    assert [row["session_id"] for row in rows] == [7, 7, 7, 8, 8, 8]
    assert [row["trial_order_position"] for row in rows] == [1, 2, 3, 1, 2, 3]
    assert [row["base_trial_name"] for row in rows] == ["T1A", "T3B", "T1A", "T1A", "T3B", "T1A"]


def test_collectors_use_raw_trial_order_details(tmp_path):
    _write_trial_order_details(tmp_path / "trial_data")

    trial_names, counts_by_name, max_slot = ru.collect_trial_heatmap_data_from_trial_order_details(
        dataset_name="redgreen_experiment_1",
        trial_data_root=str(tmp_path / "trial_data"),
    )
    symmetry_names, symmetry_counts, symmetry_max = ru.collect_symmetry_heatmap_data_from_trial_order_details(
        dataset_name="redgreen_experiment_1",
        trial_data_root=str(tmp_path / "trial_data"),
    )
    repeated_names, participant_positions, occurrence_positions, gap_values, monotonic_violations, repeat_max = ru.collect_repeat_data_from_trial_order_details(
        dataset_name="redgreen_experiment_1",
        trial_data_root=str(tmp_path / "trial_data"),
    )

    assert trial_names == ["T1A_rep_0", "T1A_rep_1", "T3B"]
    assert counts_by_name["T1A_rep_0"][0] == 2
    assert counts_by_name["T1A_rep_1"][2] == 2
    assert max_slot == 3

    assert symmetry_names == ["T1A_rep_0", "T1A_rep_1", "T3B"]
    assert symmetry_counts["T1A_rep_0"][4] == 1
    assert symmetry_counts["T1A_rep_1"][5] == 1
    assert symmetry_max == 1

    assert repeated_names == ["T1A"]
    assert len(participant_positions) == 2
    assert occurrence_positions["T1A"][0] == [0, 0]
    assert occurrence_positions["T1A"][1] == [2, 2]
    assert gap_values[("T1A", 0)] == [2, 2]
    assert monotonic_violations["T1A"] == 0
    assert repeat_max == 3
