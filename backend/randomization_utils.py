import json
import os
import random


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

        if repeat_counts:
            base_order = e_folders_shuffled[:]

            def insert_farthest(ap_list, trial_name):
                positions = [i for i, name in enumerate(ap_list) if name == trial_name]
                if not positions:
                    ap_list.append(trial_name)
                    return

                best_pos = 0
                best_min_dist = -1
                n = len(ap_list)
                for pos in range(n + 1):
                    min_dist = min(abs(pos - p) for p in positions)
                    if min_dist > best_min_dist:
                        best_min_dist = min_dist
                        best_pos = pos
                ap_list.insert(best_pos, trial_name)

            spaced_order = base_order[:]
            for trial_name in sorted(repeat_counts.keys()):
                extra = repeat_counts[trial_name]
                for _ in range(extra):
                    insert_farthest(spaced_order, trial_name)

            e_folders_shuffled = spaced_order

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

        total_weight = sum(len(active_groups[k]) for k in candidates)
        target = random_.random() * total_weight
        running = 0
        chosen_key = candidates[-1]
        for key in candidates:
            running += len(active_groups[key])
            if target < running:
                chosen_key = key
                break

        spread_order.append(active_groups[chosen_key].pop(0))
        if not active_groups[chosen_key]:
            del active_groups[chosen_key]
        prev_key = chosen_key

    e_folders_shuffled = spread_order

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

    groups_by_base = {}
    for idx, folder_name in enumerate(randomized_trial_order):
        base_key, _ = parse_experimental_trial_name(folder_name)
        groups_by_base.setdefault(base_key, []).append(idx)

    if repeat_trials and not apply_symmetry_to_repeated_trials:
        filtered_groups = {}
        for base_key, indices in groups_by_base.items():
            seen_names = set()
            filtered_indices = []
            for idx in indices:
                folder_name = randomized_trial_order[idx]
                if folder_name not in seen_names:
                    seen_names.add(folder_name)
                    filtered_indices.append(idx)
            filtered_groups[base_key] = filtered_indices
        groups_by_base = filtered_groups

    trial_transform_map = {}
    base_transforms = list(range(8))

    for base_key in sorted(groups_by_base.keys()):
        indices = sorted(groups_by_base[base_key])
        n = len(indices)
        if n == 0:
            continue
        if n <= 8:
            assigned = rng.sample(base_transforms, n)
        else:
            full_cycles = n // 8
            remainder = n % 8
            assigned = base_transforms * full_cycles + rng.sample(base_transforms, remainder)
            rng.shuffle(assigned)
        for idx, transform_index in zip(indices, assigned):
            trial_transform_map[idx] = transform_index

    return trial_transform_map
