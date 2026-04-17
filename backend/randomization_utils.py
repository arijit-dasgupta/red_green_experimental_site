import json
import hashlib
import csv
import os
import random
import re
from collections import defaultdict


def parse_experimental_trial_name(trial_folder_name):
    """
    Split a trial folder name into its base key and variant suffix.

    Examples:
      T2A -> ("T2", "A")
      T10  -> ("T10", None)
    """
    if not trial_folder_name:
        return trial_folder_name, None

    prefix = ""
    i = 0
    while i < len(trial_folder_name) and trial_folder_name[i].isalpha():
        prefix += trial_folder_name[i]
        i += 1

    rest = trial_folder_name[i:]
    digits = ""
    j = 0
    while j < len(rest) and rest[j].isdigit():
        digits += rest[j]
        j += 1

    variant = rest[j:] or None
    if variant is not None and len(variant) > 1:
        variant = variant[0]

    if prefix and digits:
        return f"{prefix}{digits}", variant
    return trial_folder_name, None


def _natural_sort_key(value):
    parts = re.split(r"(\d+)", value)
    key = []
    for part in parts:
        if part.isdigit():
            key.append((0, int(part)))
        else:
            key.append((1, part))
    return key


def _repeat_aware_trial_key(value):
    match = re.match(r"^(.*)_rep_(\d+)$", value)
    if match:
        base = match.group(1)
        rep_idx = int(match.group(2))
        return _natural_sort_key(base) + [(0, rep_idx)]
    return _natural_sort_key(value) + [(1, -1)]


def _evenly_spaced_targets(total_length, item_count):
    """Return monotonically increasing target slots that avoid the ends."""
    if item_count <= 0:
        return []
    if item_count == 1:
        return [max(total_length // 2, 0)]

    raw_targets = [
        int(round(i * (total_length - 1) / (item_count - 1)))
        for i in range(item_count)
    ]
    targets = []
    for i, target in enumerate(raw_targets):
        min_allowed = 0 if i == 0 else targets[-1] + 1
        max_allowed = total_length - (item_count - i)
        target = max(min_allowed, min(target, max_allowed))
        targets.append(target)
    return targets


MIN_REPEAT_GAP = 15
REPEAT_FIRST_START_BIAS_POWER = 1.0


def _weighted_choice_from_range(rng, start, stop, *, bias_power=1.0):
    """Sample an integer in [start, stop] with a soft later-position bias."""
    if stop <= start:
        return start

    weights = [float((value - start + 1) ** bias_power) for value in range(start, stop + 1)]
    total_weight = sum(weights)
    draw = rng.random() * total_weight
    running = 0.0
    for value, weight in zip(range(start, stop + 1), weights):
        running += weight
        if draw < running:
            return value
    return stop


def _redistribute_repeats_by_anchor_targets(base_order, repeat_counts, rng, min_repeat_gap=MIN_REPEAT_GAP):
    """Reserve repeated trial copies first, then fill the remaining slots."""
    repeat_names = set(repeat_counts.keys())
    if not repeat_names:
        return base_order

    repeated_occurrences = defaultdict(list)
    base_items = []
    for name in base_order:
        if name in repeat_names:
            repeated_occurrences[name].append(name)
        else:
            base_items.append(name)

    final_length = len(base_items) + sum(len(repeated_occurrences[name]) + repeat_counts[name] for name in repeat_names)
    slots = [None] * final_length
    group_specs = []
    for name in sorted(repeat_names, key=_natural_sort_key):
        total_copies = len(repeated_occurrences[name]) + repeat_counts[name]
        max_first = final_length - 1 - min_repeat_gap * (total_copies - 1)
        if max_first < 0:
            raise RuntimeError(
                f"Repeat group '{name}' with {total_copies} copies cannot fit "
                f"with min gap {min_repeat_gap} in a list of length {final_length}."
            )
        first_target = _weighted_choice_from_range(
            rng,
            0,
            max_first,
            bias_power=REPEAT_FIRST_START_BIAS_POWER,
        )
        group_specs.append((first_target, -total_copies, name, total_copies))

    for first_target, _, name, total_copies in sorted(
        group_specs,
        key=lambda item: (item[0], item[1], _natural_sort_key(item[2])),
    ):
        max_start = final_length - 1 - min_repeat_gap * (total_copies - 1)
        start = None
        candidate_positions = None

        for candidate in range(first_target, max_start + 1):
            positions = [candidate + i * min_repeat_gap for i in range(total_copies)]
            if all(slots[pos] is None for pos in positions):
                start = candidate
                candidate_positions = positions
                break

        if start is None:
            for candidate in range(0, first_target):
                positions = [candidate + i * min_repeat_gap for i in range(total_copies)]
                if positions[-1] >= final_length:
                    continue
                if all(slots[pos] is None for pos in positions):
                    start = candidate
                    candidate_positions = positions
                    break

        if candidate_positions is None:
            raise RuntimeError("Could not place repeat trial copies without exhausting slots.")

        for pos in candidate_positions:
            slots[pos] = name

    base_iter = iter(base_items)
    for idx in range(final_length):
        if slots[idx] is None:
            slots[idx] = next(base_iter)

    return slots


def _get_trial_data_dataset_dir(*, dataset_name, trial_data_root=None):
    """
    Return the dataset directory under backend/trial_data for the given dataset name.
    """
    if not dataset_name:
        raise ValueError("dataset_name is required")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = trial_data_root or os.path.join(script_dir, "trial_data")
    dataset_dir = os.path.join(root_dir, dataset_name)
    if not os.path.isdir(dataset_dir):
        raise FileNotFoundError(
            f"Dataset directory not found: {dataset_dir}. "
            "Expected a subdirectory inside backend/trial_data."
        )
    return dataset_dir


def load_trial_order_details(*, dataset_name, trial_data_root=None):
    """
    Load the raw trial_order_details.csv for a dataset from backend/trial_data.
    """
    dataset_dir = _get_trial_data_dataset_dir(dataset_name=dataset_name, trial_data_root=trial_data_root)
    csv_path = os.path.join(dataset_dir, "trial_order_details.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Missing trial order file: {csv_path}")

    rows = []
    with open(csv_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row:
                continue
            try:
                rows.append({
                    "base_trial_name": row["base_trial_name"],
                    "session_id": int(row["session_id"]),
                    "repeat_instance_index": int(row["repeat_instance_index"]),
                    "trial_order_position": int(row["trial_order_position"]),
                    "symmetry_transform": int(row["symmetry_transform"]),
                })
            except (KeyError, TypeError, ValueError) as e:
                raise ValueError(f"Invalid row in {csv_path}: {row}") from e

    rows.sort(key=lambda row: (row["session_id"], row["trial_order_position"], row["repeat_instance_index"], row["base_trial_name"]))
    return rows


def _count_trial_instances_by_session(trial_order_rows):
    counts = defaultdict(lambda: defaultdict(int))
    for row in trial_order_rows:
        counts[row["session_id"]][row["base_trial_name"]] += 1
    return counts


def collect_repeat_data_from_trial_order_details(*, dataset_name, trial_data_root=None):
    """
    Collect repeat-order validation data from raw trial_order_details.csv rows.
    Returns the same structure the SVG helper expects, but driven by empirical data.
    """
    rows = load_trial_order_details(dataset_name=dataset_name, trial_data_root=trial_data_root)
    if not rows:
        return [], [], defaultdict(lambda: defaultdict(list)), defaultdict(list), defaultdict(int), 0

    per_participant_positions = []
    per_name_occurrence_positions = defaultdict(lambda: defaultdict(list))
    gap_values = defaultdict(list)
    monotonic_violations = defaultdict(int)
    max_slot = 0

    rows_by_session = defaultdict(list)
    for row in rows:
        rows_by_session[row["session_id"]].append(row)

    repeated_name_set = set()
    for session_rows in rows_by_session.values():
        session_counts = defaultdict(int)
        for row in session_rows:
            session_counts[row["base_trial_name"]] += 1
        repeated_name_set.update(name for name, count in session_counts.items() if count > 1)
    repeated_names = sorted(repeated_name_set, key=_natural_sort_key)

    for session_id in sorted(rows_by_session.keys()):
        session_rows = rows_by_session[session_id]
        max_slot = max(max_slot, len(session_rows))

        positions_by_name = defaultdict(list)
        for row in session_rows:
            positions_by_name[row["base_trial_name"]].append(row["trial_order_position"] - 1)

        per_participant_positions.append(positions_by_name)

        for name in repeated_names:
            positions = positions_by_name.get(name, [])
            if any(right < left for left, right in zip(positions, positions[1:])):
                monotonic_violations[name] += 1
            for occurrence_idx, slot_idx in enumerate(positions):
                per_name_occurrence_positions[name][occurrence_idx].append(slot_idx)
            for i, (left, right) in enumerate(zip(positions, positions[1:])):
                gap_values[(name, i)].append(right - left)

    return repeated_names or [], per_participant_positions, per_name_occurrence_positions, gap_values, monotonic_violations, max_slot


def collect_trial_heatmap_data_from_trial_order_details(*, dataset_name, trial_data_root=None):
    """
    Build trial-order heatmap counts from raw trial_order_details.csv rows.
    """
    rows = load_trial_order_details(dataset_name=dataset_name, trial_data_root=trial_data_root)
    counts_by_name = defaultdict(lambda: defaultdict(int))
    max_slot = 0

    rows_by_session = defaultdict(list)
    for row in rows:
        rows_by_session[row["session_id"]].append(row)

    for session_id in sorted(rows_by_session.keys()):
        session_rows = rows_by_session[session_id]
        total_counts = defaultdict(int)
        for row in session_rows:
            total_counts[row["base_trial_name"]] += 1
        seen_counts = defaultdict(int)
        max_slot = max(max_slot, len(session_rows))

        for row in session_rows:
            name = row["base_trial_name"]
            occurrence_idx = seen_counts[name]
            seen_counts[name] += 1
            label = f"{name}_rep_{occurrence_idx}" if total_counts[name] > 1 else name
            counts_by_name[label][row["trial_order_position"] - 1] += 1

    trial_names = sorted(counts_by_name.keys(), key=_repeat_aware_trial_key)
    return trial_names, counts_by_name, max_slot


def collect_symmetry_heatmap_data_from_trial_order_details(*, dataset_name, trial_data_root=None):
    """
    Build symmetry-transform heatmap counts from raw trial_order_details.csv rows.
    """
    rows = load_trial_order_details(dataset_name=dataset_name, trial_data_root=trial_data_root)
    counts_by_name = defaultdict(lambda: defaultdict(int))
    max_count = 0

    rows_by_session = defaultdict(list)
    for row in rows:
        rows_by_session[row["session_id"]].append(row)

    for session_id in sorted(rows_by_session.keys()):
        session_rows = rows_by_session[session_id]
        total_counts = defaultdict(int)
        for row in session_rows:
            total_counts[row["base_trial_name"]] += 1
        seen_counts = defaultdict(int)

        for row in session_rows:
            name = row["base_trial_name"]
            occurrence_idx = seen_counts[name]
            seen_counts[name] += 1
            label = f"{name}_rep_{occurrence_idx}" if total_counts[name] > 1 else name
            transform_index = int(row["symmetry_transform"]) + 1
            counts_by_name[label][transform_index] += 1
            max_count = max(max_count, counts_by_name[label][transform_index])

    trial_names = sorted(counts_by_name.keys(), key=_repeat_aware_trial_key)
    return trial_names, counts_by_name, max_count


def build_trial_paths(
    directory_path,
    randomized_profile_id,
    *,
    fam_trial_prefixes,
    exp_trial_prefixes,
    repeat_trials,
    different_randomized_trial_order_per_participant,
):
    """
    Pure helper that reproduces the backend's trial-order logic.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    absolute_directory_path = os.path.join(script_dir, directory_path)

    entries = sorted(os.listdir(absolute_directory_path))
    if different_randomized_trial_order_per_participant:
        random_seed = 314159 + int(randomized_profile_id)
    else:
        random_seed = 314159
    random_ = random.Random(random_seed)

    participants_f_assignments = [
        entry for entry in entries
        if any(entry.startswith(prefix) for prefix in fam_trial_prefixes)
    ]
    participants_f_assignments.sort()

    prefix_stacks = {}
    for prefix in exp_trial_prefixes:
        prefix_trials = [entry for entry in entries if entry.startswith(prefix)]
        prefix_trials_shuffled = prefix_trials[:]
        random_.shuffle(prefix_trials_shuffled)
        prefix_stacks[prefix] = prefix_trials_shuffled

    e_folders_shuffled = []
    max_trials = max((len(stack) for stack in prefix_stacks.values()), default=0)
    for round_idx in range(max_trials):
        round_trials = []
        for prefix in exp_trial_prefixes:
            if len(prefix_stacks[prefix]) > round_idx:
                round_trials.append(prefix_stacks[prefix][round_idx])
        if round_trials:
            random_.shuffle(round_trials)
            e_folders_shuffled.extend(round_trials)

    if repeat_trials:
        repeat_csv_path = os.path.join(absolute_directory_path, "repeat.csv")
        repeat_counts = {}
        if os.path.exists(repeat_csv_path):
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
                            repeat_counts[trial_name] = repeat_counts.get(trial_name, 0) + extra
            except Exception:
                repeat_counts = {}

    groups_by_base = {}
    for name in e_folders_shuffled:
        base_key, _ = parse_experimental_trial_name(name)
        groups_by_base.setdefault(base_key, []).append(name)
    for base_key in groups_by_base:
        random_.shuffle(groups_by_base[base_key])

    # Interleave groups one item at a time so singleton groups do not all get
    # exhausted in the first pass. We bias toward groups with more remaining
    # items, but we avoid repeating the same base_key when another group is
    # available.
    spread_order = []
    prev_key = None
    active_groups = {k: v[:] for k, v in groups_by_base.items() if v}
    while active_groups:
        candidates = [k for k in active_groups.keys() if k != prev_key]
        if not candidates:
            candidates = list(active_groups.keys())

        weighted_candidates = []
        for key in candidates:
            weight = len(active_groups[key])
            weighted_candidates.append((key, weight))

        total_weight = sum(weight for _, weight in weighted_candidates)
        target = random_.random() * total_weight
        running = 0
        chosen_key = candidates[-1]
        for key, weight in weighted_candidates:
            running += weight
            if target < running:
                chosen_key = key
                break

        spread_order.append(active_groups[chosen_key].pop(0))
        if not active_groups[chosen_key]:
            del active_groups[chosen_key]
        prev_key = chosen_key

    e_folders_shuffled = spread_order
    if repeat_trials and repeat_counts:
        e_folders_shuffled = _redistribute_repeats_by_anchor_targets(
            e_folders_shuffled,
            repeat_counts,
            random_,
        )

    f_paths = [
        os.path.join(os.path.join(absolute_directory_path, entry), "simulation_data.json")
        for entry in participants_f_assignments
    ]
    e_paths = [
        os.path.join(os.path.join(absolute_directory_path, entry), "simulation_data.json")
        for entry in e_folders_shuffled
    ]

    return f_paths, e_paths, e_folders_shuffled


def build_symmetry_transform_map(
    trial_paths,
    randomized_trial_order,
    *,
    repeat_trials,
    apply_symmetry_to_repeated_trials,
    different_randomized_symmetry_transform_per_participant,
    randomized_profile_id,
    validate_square_scenes=True,
):
    """
    Build a D4 transform assignment map for the provided trial order.
    """
    if validate_square_scenes:
        base_counts = {}
        for path in trial_paths:
            with open(path, "r") as f:
                data = json.load(f)

            scene_dims = data.get("scene_dims", [20, 20])
            w = scene_dims[0] if len(scene_dims) > 0 else 20
            h = scene_dims[1] if len(scene_dims) > 1 else 20
            if not (w == h and w > 0):
                folder_name = os.path.basename(os.path.dirname(path))
                raise AssertionError(
                    f"trial '{folder_name}' has non-square scene_dims={scene_dims}."
                )

            folder_name = os.path.basename(os.path.dirname(path))
            base_key, _ = parse_experimental_trial_name(folder_name)
            base_counts[base_key] = base_counts.get(base_key, 0) + 1

        for base_key, count in base_counts.items():
            if count >= 8:
                print(
                    f"\033[93m[SYMMETRY WARNING]\033[0m "
                    f"Base trial set '{base_key}' has {count} variants; "
                    f"symmetry transforms will be reused within this set."
                )

    if different_randomized_symmetry_transform_per_participant:
        rng_seed = 271828 + int(randomized_profile_id or 0)
    else:
        rng_seed = 271828
    rng = random.Random(rng_seed)

    participant_offset = int(randomized_profile_id or 0) % 8

    def _base_transform_offset(base_key):
        digest = hashlib.sha1(base_key.encode("utf-8")).digest()
        return digest[0] % 8

    groups_by_base = {}
    occurrence_by_name = {}
    for idx, folder_name in enumerate(randomized_trial_order):
        occurrence = occurrence_by_name.get(folder_name, 0)
        occurrence_by_name[folder_name] = occurrence + 1
        base_key, _ = parse_experimental_trial_name(folder_name)
        groups_by_base.setdefault(base_key, []).append((folder_name, occurrence, idx))

    if repeat_trials and not apply_symmetry_to_repeated_trials:
        filtered_groups = {}
        for base_key, members in groups_by_base.items():
            seen_names = set()
            filtered_members = []
            for folder_name, occurrence, idx in members:
                if folder_name not in seen_names:
                    seen_names.add(folder_name)
                    filtered_members.append((folder_name, occurrence, idx))
            filtered_groups[base_key] = filtered_members
        groups_by_base = filtered_groups

    trial_transform_map = {}
    base_transforms = list(range(8))

    for base_key in sorted(groups_by_base.keys()):
        members = sorted(
            groups_by_base[base_key],
            key=lambda item: (_natural_sort_key(item[0]), item[1]),
        )
        n = len(members)
        if n == 0:
            continue
        if different_randomized_symmetry_transform_per_participant:
            # Rotate a fixed D4 ordering by participant and base-trial offsets so
            # each base group stays deterministic while remaining much more even
            # across participants than independent random sampling.
            rotation = (participant_offset + _base_transform_offset(base_key)) % 8
            rotated_transforms = base_transforms[rotation:] + base_transforms[:rotation]
            if n <= 8:
                assigned = rotated_transforms[:n]
            else:
                full_cycles = n // 8
                remainder = n % 8
                assigned = rotated_transforms * full_cycles + rotated_transforms[:remainder]
        else:
            if n <= 8:
                assigned = rng.sample(base_transforms, n)
            else:
                full_cycles = n // 8
                remainder = n % 8
                assigned = base_transforms * full_cycles + rng.sample(base_transforms, remainder)
                rng.shuffle(assigned)
        for (_, _, idx), transform_index in zip(members, assigned):
            trial_transform_map[idx] = transform_index

    return trial_transform_map
