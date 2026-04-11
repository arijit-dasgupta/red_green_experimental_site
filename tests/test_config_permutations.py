import json
import string
import tempfile
from pathlib import Path

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from backend import randomization_utils as ru


def write_trial_dataset(root, names):
    """Create a minimal trial dataset tree with square scenes."""
    import json

    root.mkdir(parents=True, exist_ok=True)
    payload = {"scene_dims": [10, 10], "rg_outcome": "red"}
    for name in names:
        trial_dir = root / name
        trial_dir.mkdir(parents=True, exist_ok=True)
        (trial_dir / "simulation_data.json").write_text(json.dumps(payload))


class RecordingRandom:
    """Deterministic stand-in for random.Random that records the seed."""

    seeds = []

    def __init__(self, seed):
        self.seed = seed
        RecordingRandom.seeds.append(seed)

    def shuffle(self, values):
        return None

    def sample(self, population, k):
        return list(population)[:k]


@pytest.fixture
def recording_random(monkeypatch):
    RecordingRandom.seeds = []
    monkeypatch.setattr(ru.random, "Random", RecordingRandom)
    return RecordingRandom


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(
    profile_id=st.integers(min_value=0, max_value=10_000),
    different_order=st.booleans(),
)
def test_trial_order_seed_selection_follows_config(recording_random, profile_id, different_order):
    with tempfile.TemporaryDirectory() as tmpdir:
        dataset_dir = Path(tmpdir) / "dataset"
        write_trial_dataset(dataset_dir, ["F1", "T1", "T2"])
        recording_random.seeds = []

        ru.build_trial_paths(
            str(dataset_dir),
            profile_id,
            fam_trial_prefixes=["F"],
            exp_trial_prefixes=["T"],
            repeat_trials=False,
            different_randomized_trial_order_per_participant=different_order,
        )

        expected_seed = 314159 + profile_id if different_order else 314159
        assert recording_random.seeds == [expected_seed]


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(
    profile_id=st.integers(min_value=0, max_value=10_000),
    different_symmetry=st.booleans(),
)
def test_symmetry_seed_selection_follows_config(recording_random, profile_id, different_symmetry):
    with tempfile.TemporaryDirectory() as tmpdir:
        dataset_dir = Path(tmpdir) / "dataset"
        names = ["T1A", "T1B", "T2A", "T2B"]
        write_trial_dataset(dataset_dir, names)
        trial_paths = [str(dataset_dir / name / "simulation_data.json") for name in names]
        recording_random.seeds = []

        ru.build_symmetry_transform_map(
            trial_paths,
            names,
            repeat_trials=False,
            apply_symmetry_to_repeated_trials=True,
            different_randomized_symmetry_transform_per_participant=different_symmetry,
            randomized_profile_id=profile_id,
        )

        expected_seed = 271828 + profile_id if different_symmetry else 271828
        assert recording_random.seeds == [expected_seed]


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(size=st.integers(min_value=1, max_value=8))
def test_same_base_group_gets_unique_transforms_up_to_eight(recording_random, size):
    with tempfile.TemporaryDirectory() as tmpdir:
        dataset_dir = Path(tmpdir) / "dataset"
        names = [f"T1{letter}" for letter in string.ascii_uppercase[:size]]
        write_trial_dataset(dataset_dir, names)
        trial_paths = [str(dataset_dir / name / "simulation_data.json") for name in names]

        transform_map = ru.build_symmetry_transform_map(
            trial_paths,
            names,
            repeat_trials=False,
            apply_symmetry_to_repeated_trials=True,
            different_randomized_symmetry_transform_per_participant=False,
            randomized_profile_id=0,
        )
        assigned = [transform_map[i] for i in range(size)]

        assert len(set(assigned)) == size
        assert all(0 <= transform < 8 for transform in assigned)


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(size=st.integers(min_value=9, max_value=16))
def test_same_base_group_reuses_transforms_after_eight(recording_random, size):
    with tempfile.TemporaryDirectory() as tmpdir:
        dataset_dir = Path(tmpdir) / "dataset"
        names = [f"T1{letter}" for letter in string.ascii_uppercase[:size]]
        write_trial_dataset(dataset_dir, names)
        trial_paths = [str(dataset_dir / name / "simulation_data.json") for name in names]

        transform_map = ru.build_symmetry_transform_map(
            trial_paths,
            names,
            repeat_trials=False,
            apply_symmetry_to_repeated_trials=True,
            different_randomized_symmetry_transform_per_participant=False,
            randomized_profile_id=0,
        )
        assigned = [transform_map[i] for i in range(size)]

        assert len(set(assigned)) < size
        assert all(0 <= transform < 8 for transform in assigned)


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(repeat_count=st.integers(min_value=2, max_value=6))
def test_repeat_trial_symmetry_assignment_respects_flag(recording_random, repeat_count):
    with tempfile.TemporaryDirectory() as tmpdir:
        dataset_dir = Path(tmpdir) / "dataset"
        names = ["T1A"] * repeat_count
        write_trial_dataset(dataset_dir, ["T1A"])
        trial_paths = [str(dataset_dir / "T1A" / "simulation_data.json")] * repeat_count

        without_repeat_symmetry = ru.build_symmetry_transform_map(
            trial_paths,
            names,
            repeat_trials=True,
            apply_symmetry_to_repeated_trials=False,
            different_randomized_symmetry_transform_per_participant=False,
            randomized_profile_id=0,
        )
        assert set(without_repeat_symmetry.keys()) == {0}

        with_repeat_symmetry = ru.build_symmetry_transform_map(
            trial_paths,
            names,
            repeat_trials=True,
            apply_symmetry_to_repeated_trials=True,
            different_randomized_symmetry_transform_per_participant=False,
            randomized_profile_id=0,
        )
        assert set(with_repeat_symmetry.keys()) == set(range(repeat_count))


@settings(max_examples=50, deadline=None)
@given(
    base_num=st.integers(min_value=1, max_value=999),
    variant=st.sampled_from(list("ABCD")),
)
def test_parse_experimental_trial_name_variant_groups(base_num, variant):
    base, parsed_variant = ru.parse_experimental_trial_name(f"T{base_num}{variant}")
    assert base == f"T{base_num}"
    assert parsed_variant == variant


@settings(max_examples=50, deadline=None)
@given(base_num=st.integers(min_value=1, max_value=999))
def test_parse_experimental_trial_name_plain_trials(base_num):
    name = f"T{base_num}"
    base, parsed_variant = ru.parse_experimental_trial_name(name)
    assert base == name
    assert parsed_variant is None


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(
    f_count=st.integers(min_value=1, max_value=5),
    t_count=st.integers(min_value=1, max_value=8),
)
def test_build_trial_paths_returns_expected_partitions(f_count, t_count):
    with tempfile.TemporaryDirectory() as tmpdir:
        dataset_dir = Path(tmpdir) / "dataset"
        fam_names = [f"F{i}" for i in range(1, f_count + 1)]
        exp_names = [f"T{i}" for i in range(1, t_count + 1)]
        write_trial_dataset(dataset_dir, fam_names + exp_names)

        f_paths, e_paths, randomized_order = ru.build_trial_paths(
            str(dataset_dir),
            0,
            fam_trial_prefixes=["F"],
            exp_trial_prefixes=["T"],
            repeat_trials=False,
            different_randomized_trial_order_per_participant=False,
        )

        assert [Path(p).parent.name for p in f_paths] == fam_names
        assert sorted(Path(p).parent.name for p in e_paths) == sorted(exp_names)
        assert sorted(randomized_order) == sorted(exp_names)


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(
    f_count=st.integers(min_value=1, max_value=5),
    t_count=st.integers(min_value=2, max_value=8),
    profile_a=st.integers(min_value=0, max_value=10_000),
    profile_b=st.integers(min_value=0, max_value=10_000),
)
def test_build_trial_paths_shared_order_is_same_when_flag_off(f_count, t_count, profile_a, profile_b):
    with tempfile.TemporaryDirectory() as tmpdir:
        dataset_dir = Path(tmpdir) / "dataset"
        fam_names = [f"F{i}" for i in range(1, f_count + 1)]
        exp_names = [f"T{i}" for i in range(1, t_count + 1)]
        write_trial_dataset(dataset_dir, fam_names + exp_names)

        result_a = ru.build_trial_paths(
            str(dataset_dir),
            profile_a,
            fam_trial_prefixes=["F"],
            exp_trial_prefixes=["T"],
            repeat_trials=False,
            different_randomized_trial_order_per_participant=False,
        )
        result_b = ru.build_trial_paths(
            str(dataset_dir),
            profile_b,
            fam_trial_prefixes=["F"],
            exp_trial_prefixes=["T"],
            repeat_trials=False,
            different_randomized_trial_order_per_participant=False,
        )

        assert result_a == result_b


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(
    size=st.integers(min_value=1, max_value=8),
    profile_id=st.integers(min_value=0, max_value=10_000),
)
def test_symmetry_map_is_deterministic_for_same_inputs(size, profile_id):
    with tempfile.TemporaryDirectory() as tmpdir:
        dataset_dir = Path(tmpdir) / "dataset"
        names = [f"T1{letter}" for letter in string.ascii_uppercase[:size]]
        write_trial_dataset(dataset_dir, names)
        trial_paths = [str(dataset_dir / name / "simulation_data.json") for name in names]

        result_a = ru.build_symmetry_transform_map(
            trial_paths,
            names,
            repeat_trials=False,
            apply_symmetry_to_repeated_trials=True,
            different_randomized_symmetry_transform_per_participant=True,
            randomized_profile_id=profile_id,
        )
        result_b = ru.build_symmetry_transform_map(
            trial_paths,
            names,
            repeat_trials=False,
            apply_symmetry_to_repeated_trials=True,
            different_randomized_symmetry_transform_per_participant=True,
            randomized_profile_id=profile_id,
        )

        assert result_a == result_b


@settings(max_examples=10, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(size=st.integers(min_value=1, max_value=5))
def test_symmetry_map_rejects_non_square_scenes(size):
    with tempfile.TemporaryDirectory() as tmpdir:
        dataset_dir = Path(tmpdir) / "dataset"
        dataset_dir.mkdir(parents=True, exist_ok=True)
        names = [f"T1{letter}" for letter in string.ascii_uppercase[:size]]
        for idx, name in enumerate(names):
            trial_dir = dataset_dir / name
            trial_dir.mkdir(parents=True, exist_ok=True)
            payload = {"scene_dims": [10, 11 if idx == 0 else 10], "rg_outcome": "red"}
            (trial_dir / "simulation_data.json").write_text(json.dumps(payload))

        trial_paths = [str(dataset_dir / name / "simulation_data.json") for name in names]
        with pytest.raises(AssertionError):
            ru.build_symmetry_transform_map(
                trial_paths,
                names,
                repeat_trials=False,
                apply_symmetry_to_repeated_trials=True,
                different_randomized_symmetry_transform_per_participant=False,
                randomized_profile_id=0,
            )
