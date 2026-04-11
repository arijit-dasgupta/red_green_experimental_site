#!/usr/bin/env python3
"""Generate a repeat-order validation SVG for the red/green experiment."""

from __future__ import annotations

import argparse
import html
from collections import defaultdict
from pathlib import Path
import statistics
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend import randomization_utils as ru  # noqa: E402


def _natural_trial_key(value: str):
    parts = []
    chunk = ""
    is_digit = value[:1].isdigit()
    for ch in value:
        if ch.isdigit() == is_digit:
            chunk += ch
        else:
            parts.append((0, int(chunk)) if is_digit else (1, chunk))
            chunk = ch
            is_digit = ch.isdigit()
    if chunk:
        parts.append((0, int(chunk)) if is_digit else (1, chunk))
    return parts


def _percentile(values, p):
    if not values:
        return 0.0
    if len(values) == 1:
        return float(values[0])
    values = sorted(values)
    idx = (len(values) - 1) * p / 100.0
    lo = int(idx)
    hi = min(lo + 1, len(values) - 1)
    frac = idx - lo
    return values[lo] * (1 - frac) + values[hi] * frac


def collect_repeat_data(num_participants: int):
    repeated_names = None
    per_participant_positions = []
    per_name_occurrence_positions = defaultdict(lambda: defaultdict(list))
    gap_values = defaultdict(list)
    monotonic_violations = defaultdict(int)
    max_slot = 0

    for profile_id in range(num_participants):
        _, _, trial_order = ru.build_trial_paths(
            "trial_data/JTAP_Experiment_1",
            profile_id,
            fam_trial_prefixes=["F"],
            exp_trial_prefixes=["T"],
            repeat_trials=True,
            different_randomized_trial_order_per_participant=True,
        )

        max_slot = max(max_slot, len(trial_order))
        if repeated_names is None:
            counts = defaultdict(int)
            for name in trial_order:
                counts[name] += 1
            repeated_names = sorted(
                [name for name, count in counts.items() if count > 1],
                key=_natural_trial_key,
            )

        positions_by_name = defaultdict(list)
        for slot_idx, name in enumerate(trial_order):
            positions_by_name[name].append(slot_idx)

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


def _svg_header(width: int, height: int) -> list[str]:
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#fafafa"/>',
    ]


def _svg_footer() -> list[str]:
    return ['</svg>']


def _line(x1, y1, x2, y2, stroke="#94a3b8", width=1, dash=None, opacity=None):
    attrs = [
        f'x1="{x1:.2f}"',
        f'y1="{y1:.2f}"',
        f'x2="{x2:.2f}"',
        f'y2="{y2:.2f}"',
        f'stroke="{stroke}"',
        f'stroke-width="{width}"',
    ]
    if dash:
        attrs.append(f'stroke-dasharray="{dash}"')
    if opacity is not None:
        attrs.append(f'opacity="{opacity}"')
    return f'<line {" ".join(attrs)}/>'


def _rect(x, y, w, h, fill, stroke="none", width=1, opacity=None):
    attrs = [
        f'x="{x:.2f}"',
        f'y="{y:.2f}"',
        f'width="{w:.2f}"',
        f'height="{h:.2f}"',
        f'fill="{fill}"',
        f'stroke="{stroke}"',
        f'stroke-width="{width}"',
    ]
    if opacity is not None:
        attrs.append(f'opacity="{opacity}"')
    return f'<rect {" ".join(attrs)}/>'


def _text(x, y, value, size=10, fill="#111827", anchor="start", weight="400"):
    return (
        f'<text x="{x:.2f}" y="{y:.2f}" text-anchor="{anchor}" '
        f'font-family="Arial" font-size="{size}" font-weight="{weight}" fill="{fill}">'
        f'{html.escape(str(value))}</text>'
    )


def generate_repeat_validation_svg(num_participants: int = 100, output_path: Path | None = None):
    repeated_names, per_participant_positions, per_name_occurrence_positions, gap_values, monotonic_violations, max_slot = collect_repeat_data(num_participants)

    if output_path is None:
        output_path = REPO_ROOT / "analysis_trial_order_spread" / "repeat_order_validation.svg"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    width = 980
    left_margin = 150
    right_margin = 40
    panel_width = width - left_margin - right_margin
    panel_gap = 30
    top_margin = 80
    participant_panel_h = 205
    panel_row_h = participant_panel_h * len(repeated_names)
    stats_h = 280
    hist_h = 310
    height = top_margin + panel_row_h + panel_gap + stats_h + hist_h + 190

    slot_max = max_slot - 1 if max_slot else 1
    lines = []
    lines.extend(_svg_header(width, height))
    lines.append(_text(width / 2, 28, "JTAP_Experiment_1", size=17, fill="#111827", anchor="middle"))
    lines.append(
        _text(
            width / 2,
            48,
            f"Repeat-order validation for {num_participants} participants",
            size=13,
            fill="#475569",
            anchor="middle",
        )
    )
    lines.append(_line(6, 58, width - 8, 58, stroke="#e5edf5"))

    # Top panels: appearance order and spacing for each repeated trial group.
    for panel_idx, name in enumerate(repeated_names):
        panel_top = top_margin + panel_idx * participant_panel_h
        panel_h = participant_panel_h - 28
        panel_bottom = panel_top + panel_h

        lines.append(_text(left_margin, panel_top - 10, f"{name}: repeat instances in appearance order", size=12, fill="#111827"))
        lines.append(_rect(left_margin, panel_top, panel_width, panel_h, "#ffffff", stroke="#e2e8f0", width=0.8))

        # Axes / grid.
        y_ticks = list(range(0, max_slot, 10))
        if y_ticks[-1] != slot_max:
            y_ticks.append(slot_max)
        for tick in y_ticks:
            y = panel_top + (tick / slot_max) * (panel_h - 22) + 10
            lines.append(_line(left_margin, y, left_margin + panel_width, y, stroke="#eef2f7", width=0.8))
            lines.append(_text(left_margin - 8, y + 3, str(tick), size=9, fill="#64748b", anchor="end"))

        repeat_count = max(len(per_name_occurrence_positions[name]), 1)
        x_step = panel_width / max(repeat_count - 1, 1)

        for occ_idx in range(repeat_count):
            x = left_margin + occ_idx * x_step
            lines.append(_text(x, panel_bottom - 5, f"rep {occ_idx}", size=9, fill="#64748b", anchor="middle"))
            lines.append(_line(x, panel_bottom - 2, x, panel_bottom + 2, stroke="#cbd5e1", width=0.8))

        # Light participant traces.
        for positions_by_name in per_participant_positions:
            positions = positions_by_name.get(name, [])
            if len(positions) < 2:
                continue
            pts = []
            for occ_idx, slot_idx in enumerate(positions):
                x = left_margin + (occ_idx * x_step if repeat_count > 1 else panel_width / 2)
                y = panel_top + 10 + (slot_idx / slot_max) * (panel_h - 22)
                pts.append((x, y))
            point_str = " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)
            lines.append(f'<polyline points="{point_str}" fill="none" stroke="#94a3b8" stroke-width="0.9" opacity="0.12"/>')
            for x, y in pts:
                lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="1.6" fill="#94a3b8" opacity="0.16"/>')

        # Median band and line.
        occ_medians = []
        occ_q10 = []
        occ_q90 = []
        for occ_idx in range(repeat_count):
            vals = per_name_occurrence_positions[name].get(occ_idx, [])
            if not vals:
                continue
            occ_medians.append(statistics.median(vals))
            occ_q10.append(_percentile(vals, 10))
            occ_q90.append(_percentile(vals, 90))

        if occ_medians:
            band_pts = []
            for occ_idx, y in enumerate(occ_q10):
                x = left_margin + (occ_idx * x_step if repeat_count > 1 else panel_width / 2)
                band_pts.append(f"{x:.2f},{panel_top + 10 + (y / slot_max) * (panel_h - 22):.2f}")
            for occ_idx in reversed(range(len(occ_q90))):
                x = left_margin + (occ_idx * x_step if repeat_count > 1 else panel_width / 2)
                y = occ_q90[occ_idx]
                band_pts.append(f"{x:.2f},{panel_top + 10 + (y / slot_max) * (panel_h - 22):.2f}")
            lines.append(f'<polygon points="{" ".join(band_pts)}" fill="#fecaca" opacity="0.22" stroke="none"/>')

            median_pts = []
            for occ_idx, median_val in enumerate(occ_medians):
                x = left_margin + (occ_idx * x_step if repeat_count > 1 else panel_width / 2)
                y = panel_top + 10 + (median_val / slot_max) * (panel_h - 22)
                median_pts.append((x, y))
            lines.append(
                f'<polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in median_pts)}" '
                'fill="none" stroke="#dc2626" stroke-width="2" opacity="0.9"/>'
            )
            for x, y in median_pts:
                lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="3" fill="#b91c1c" opacity="0.9"/>')

        lines.append(_text(left_margin + panel_width - 2, panel_top + 13, "slot", size=9, fill="#94a3b8", anchor="end"))

    # Bottom summary panel.
    bottom_top = top_margin + panel_row_h + panel_gap
    bottom_h = stats_h
    lines.append(_text(left_margin, bottom_top - 8, "Repeat spacing summary", size=12, fill="#111827"))
    lines.append(_rect(left_margin, bottom_top, panel_width, bottom_h, "#ffffff", stroke="#e2e8f0", width=0.8))
    all_gaps = [gap for vals in gap_values.values() for gap in vals]
    gap_min = min(all_gaps) if all_gaps else 0
    gap_med = statistics.median(all_gaps) if all_gaps else 0
    gap_mean = statistics.mean(all_gaps) if all_gaps else 0
    gap_p90 = _percentile(all_gaps, 90) if all_gaps else 0
    gap_max = max(all_gaps) if all_gaps else 0
    gap_total = len(all_gaps)
    total_violations = sum(monotonic_violations.values())
    total_sequences = num_participants * len(repeated_names)
    total_repeat_instances = sum(len(per_name_occurrence_positions[name]) for name in repeated_names)

    stat_rows = [
        ("Adjacent gap min", f"{gap_min:.0f} slots"),
        ("Adjacent gap median", f"{gap_med:.1f} slots"),
        ("Adjacent gap mean", f"{gap_mean:.1f} slots"),
        ("Adjacent gap p90", f"{gap_p90:.1f} slots"),
        ("Adjacent gap max", f"{gap_max:.0f} slots"),
        ("Total gaps", f"{gap_total} gap measurements"),
        ("Monotonicity check", f"{total_violations} violations across {total_sequences} participant-repeat sequences"),
        ("Repeat copies", f"{total_repeat_instances} labeled repeat rows"),
    ]
    stat_x = left_margin + 18
    stat_y = bottom_top + 28
    stat_gap = 30
    for idx, (label, value) in enumerate(stat_rows):
        y = stat_y + idx * stat_gap
        lines.append(_text(stat_x, y, f"{label}:", size=10, fill="#64748b"))
        lines.append(_text(stat_x + 152, y, value, size=10, fill="#111827"))

    lines.append(
        _text(
            stat_x,
            bottom_top + bottom_h - 12,
            "The repeat sequence is preserved within each participant; later repetitions never move earlier than earlier ones.",
            size=9,
            fill="#64748b",
        )
    )

    # Histogram panel.
    hist_top = bottom_top + bottom_h + 80
    hist_bottom = hist_top + hist_h - 18
    hist_inner_top = hist_top + 32
    hist_inner_bottom = hist_bottom - 36
    hist_inner_h = max(hist_inner_bottom - hist_inner_top, 1)
    lines.append(_text(left_margin, hist_top - 8, "Gap histogram", size=12, fill="#111827"))
    lines.append(_rect(left_margin, hist_top, panel_width, hist_h - 8, "#ffffff", stroke="#e2e8f0", width=0.8))

    gap_counts = defaultdict(int)
    for gap in all_gaps:
        gap_counts[int(gap)] += 1
    max_count = max(gap_counts.values()) if gap_counts else 1
    gap_values_sorted = sorted(gap_counts.keys())
    hist_x0 = left_margin + 42
    hist_x1 = left_margin + panel_width - 10
    hist_w = max(hist_x1 - hist_x0, 1)
    bins = gap_values_sorted if gap_values_sorted else [0]
    bar_w = hist_w / max(len(bins), 1)

    for i, gap in enumerate(bins):
        count = gap_counts.get(gap, 0)
        bar_h = (count / max_count) * hist_inner_h if max_count else 0
        x = hist_x0 + i * bar_w
        y = hist_inner_bottom - bar_h
        lines.append(_rect(x + 2, y, max(bar_w - 4, 1), bar_h, "#fecaca", stroke="#dc2626", width=0.8))
        if i % 2 == 0 or len(bins) <= 12:
            lines.append(_text(x + bar_w / 2, hist_bottom + 8, str(gap), size=9, fill="#64748b", anchor="middle"))
        if count > 0:
            lines.append(_text(x + bar_w / 2, y - 4, str(count), size=9, fill="#b91c1c", anchor="middle"))

    for frac, label in [(0, "0"), (0.5, str(max_count // 2)), (1, str(max_count))]:
        yy = hist_inner_bottom - frac * hist_inner_h
        lines.append(_line(hist_x0, yy, hist_x0 - 4, yy, stroke="#cbd5e1", width=0.8))
        lines.append(_text(hist_x0 - 8, yy + 3, label, size=9, fill="#64748b", anchor="end"))
        lines.append(_line(hist_x0, yy, hist_x1, yy, stroke="#f1f5f9", width=0.8))

    lines.append(_text(hist_x0 - 6, hist_inner_top - 16, "Count", size=9, fill="#64748b", anchor="end"))

    lines.extend(_svg_footer())
    output_path.write_text("\n".join(lines) + "\n")
    return output_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--num-participants",
        type=int,
        default=100,
        help="Number of simulated participants to include in the validation plot.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional output path for the SVG plot.",
    )
    args = parser.parse_args()
    path = generate_repeat_validation_svg(args.num_participants, args.output)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
