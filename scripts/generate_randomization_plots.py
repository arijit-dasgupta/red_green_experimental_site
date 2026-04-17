#!/usr/bin/env python3
"""Generate a repeat-order validation SVG for the red/green experiment."""

from __future__ import annotations

import argparse
import html
import subprocess
from collections import defaultdict
from collections import Counter
from pathlib import Path
import statistics
import re
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend import randomization_utils as ru  # noqa: E402

HEATMAP_COLOR_STEPS = 12
HEATMAP_LEGEND_SWATCHES = 12


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


def _repeat_aware_trial_key(value: str):
    match = re.match(r"^(.*)_rep_(\d+)$", value)
    if match:
        base = match.group(1)
        rep_idx = int(match.group(2))
        return _natural_trial_key(base) + [(0, rep_idx)]
    return _natural_trial_key(value) + [(1, -1)]


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


def _hex_lerp(start_hex: str, end_hex: str, t: float) -> str:
    t = max(0.0, min(1.0, t))
    start_hex = start_hex.lstrip("#")
    end_hex = end_hex.lstrip("#")
    sr = int(start_hex[0:2], 16)
    sg = int(start_hex[2:4], 16)
    sb = int(start_hex[4:6], 16)
    er = int(end_hex[0:2], 16)
    eg = int(end_hex[2:4], 16)
    eb = int(end_hex[4:6], 16)
    r = round(sr + (er - sr) * t)
    g = round(sg + (eg - sg) * t)
    b = round(sb + (eb - sb) * t)
    return f"#{r:02x}{g:02x}{b:02x}"


def _interpolated_palette(start_hex: str, end_hex: str, steps: int) -> list[str]:
    if steps <= 1:
        return [_hex_lerp(start_hex, end_hex, 1.0)]
    return [_hex_lerp(start_hex, end_hex, idx / (steps - 1)) for idx in range(steps)]


def _quantized_color(count: int, max_count: int, start_hex: str, end_hex: str, steps: int = HEATMAP_COLOR_STEPS) -> str:
    palette = _interpolated_palette(start_hex, end_hex, steps)
    if max_count <= 0:
        return palette[0]
    if count <= 0:
        return palette[0]
    if count >= max_count:
        return palette[-1]
    idx = round((count / max_count) * (steps - 1))
    return palette[max(0, min(steps - 1, idx))]


def _legend_ticks(max_count: int, num_ticks: int = 3) -> list[int]:
    if max_count <= 0:
        return [0]
    if num_ticks <= 1:
        return [0, max_count]
    fractions = [i / (num_ticks - 1) for i in range(num_ticks)]
    ticks = []
    for frac in fractions:
        tick = round(max_count * frac)
        if not ticks or tick != ticks[-1]:
            ticks.append(tick)
    if ticks[-1] != max_count:
        ticks[-1] = max_count
    return ticks


def _add_horizontal_legend(
    lines: list[str],
    *,
    x: float,
    title_y: float,
    bar_y: float,
    max_count: int,
    start_hex: str,
    end_hex: str,
    width_per: float,
    swatches: int = HEATMAP_LEGEND_SWATCHES,
    title: str,
):
    palette = _interpolated_palette(start_hex, end_hex, swatches)
    bar_w = width_per * len(palette)
    lines.append(_text(x, title_y, title, size=9, fill="#475569", anchor="start"))
    for idx, color in enumerate(palette):
        lines.append(_rect(x + idx * width_per, bar_y, width_per, 13, color, stroke="none"))
    lines.append(_rect(x, bar_y, bar_w, 13, "none", stroke="#94a3b8", width=0.5))

    tick_y = bar_y + 17
    label_y = bar_y + 29
    for tick in _legend_ticks(max_count):
        frac = 0 if max_count <= 0 else tick / max_count
        tick_x = x + frac * bar_w
        lines.append(_line(tick_x, bar_y + 13, tick_x, tick_y, stroke="#94a3b8", width=0.8))
        lines.append(_text(tick_x, label_y, str(tick), size=9, fill="#475569", anchor="middle"))
    return bar_y + 13, label_y


def collect_repeat_data(*, dataset_name: str):
    return ru.collect_repeat_data_from_trial_order_details(dataset_name=dataset_name)


def collect_trial_heatmap_data(*, dataset_name: str):
    return ru.collect_trial_heatmap_data_from_trial_order_details(dataset_name=dataset_name)


def collect_symmetry_heatmap_data(*, dataset_name: str):
    return ru.collect_symmetry_heatmap_data_from_trial_order_details(dataset_name=dataset_name)


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


def _render_svg_to_png(svg_path: Path, png_path: Path):
    png_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            ["rsvg-convert", "-f", "png", "-o", str(png_path), str(svg_path)],
            check=True,
            capture_output=True,
        )
    except FileNotFoundError:
        subprocess.run(
            ["convert", str(svg_path), str(png_path)],
            check=True,
            capture_output=True,
        )
    finally:
        if svg_path.exists():
            svg_path.unlink()


def _save_svg_lines_as_png(lines: list[str], output_path: Path):
    output_path = Path(output_path)
    if output_path.suffix.lower() != ".png":
        output_path = output_path.with_suffix(".png")
    svg_path = output_path.with_suffix(".svg")
    svg_path.parent.mkdir(parents=True, exist_ok=True)
    svg_path.write_text("\n".join(lines) + "\n")
    _render_svg_to_png(svg_path, output_path)
    return output_path


def generate_repeat_validation_svg(*, dataset_name: str, output_path: Path | None = None):
    repeated_names, per_participant_positions, per_name_occurrence_positions, gap_values, monotonic_violations, max_slot = collect_repeat_data(dataset_name=dataset_name)
    num_participants = len(per_participant_positions)

    if output_path is None:
        output_path = REPO_ROOT / "analysis_trial_order_spread" / "repeat_order_validation.png"

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
    return _save_svg_lines_as_png(lines, Path(output_path))


def generate_trial_order_heatmap_svg(*, dataset_name: str, output_path: Path | None = None):
    trial_names, counts_by_name, max_slot = collect_trial_heatmap_data(dataset_name=dataset_name)
    num_participants = len({row["session_id"] for row in ru.load_trial_order_details(dataset_name=dataset_name)})

    if output_path is None:
        output_path = REPO_ROOT / "analysis_trial_order_spread" / "trial_order_heatmap.png"

    width = 786
    left_margin = 92
    top_margin = 70
    row_h = 11
    cell_w = 9
    cell_h = 10
    n_rows = len(trial_names)
    matrix_w = max_slot * cell_w
    matrix_bottom = top_margin + n_rows * row_h + 3
    legend_label_y = matrix_bottom + 28
    legend_y = matrix_bottom + 36
    height = legend_y + 42

    slot_labels = list(range(1, max_slot + 1))
    tick_slots = [1]
    for start in range(11, max_slot + 1, 10):
        tick_slots.append(start)
    if slot_labels and slot_labels[-1] not in tick_slots:
        tick_slots.append(slot_labels[-1])

    max_count = max((max(row.values()) for row in counts_by_name.values()), default=1)
    lines = []
    lines.extend(_svg_header(width, height))
    lines.append(_text(width / 2, 28, "JTAP_Experiment_1", size=15, fill="#111827", anchor="middle"))
    lines.append(
        _text(
            width / 2,
            48,
            f"Trial-position heatmap with randomized ordering for {num_participants} participants",
            size=12,
            fill="#475569",
            anchor="middle",
        )
    )
    lines.append(_line(6, 58, width - 8, 58, stroke="#e5edf5"))

    for tick in tick_slots:
        x = left_margin + (tick - 1) * cell_w + cell_w / 2
        lines.append(_line(x, top_margin, x, matrix_bottom, stroke="#eef2f7", width=0.8))
        lines.append(_text(x + 4.5, matrix_bottom + 20, str(tick), size=8, fill="#475569", anchor="middle"))

    for row_idx, name in enumerate(trial_names):
        y = top_margin + row_idx * row_h
        lines.append(_text(left_margin - 8, y + 8, name, size=9, fill="#111827", anchor="end"))
        lines.append(_line(left_margin - 4, y + 4, left_margin, y + 4, stroke="#94a3b8", width=1, dash="2,3"))
        for slot_idx in range(max_slot):
            count = counts_by_name[name].get(slot_idx, 0)
            fill = "#ffffff" if count == 0 else _quantized_color(count, max_count, "#d9e8f5", "#0b4f8a")
            x = left_margin + slot_idx * cell_w
            lines.append(_rect(x, y, cell_w, cell_h, fill, stroke="#ffffff", width=0.35))

    _add_horizontal_legend(
        lines,
        x=left_margin,
        title_y=legend_label_y,
        bar_y=legend_y,
        max_count=max_count,
        start_hex="#ffffff",
        end_hex="#0b4f8a",
        width_per=20,
        swatches=HEATMAP_LEGEND_SWATCHES,
        title=f"Participant count in trial slot (empirical max = {max_count})",
    )

    lines.extend(_svg_footer())
    return _save_svg_lines_as_png(lines, Path(output_path))


def _symmetry_heatmap_palette():
    return _interpolated_palette("#fff7f5", "#4a0f0d", HEATMAP_COLOR_STEPS)


def _symmetry_heatmap_color(count: int, max_count: int) -> str:
    palette = _symmetry_heatmap_palette()
    if max_count <= 0:
        return palette[0]
    if len(palette) == 1:
        return palette[0]
    if count <= 0:
        return palette[0]
    if count >= max_count:
        return palette[-1]

    scaled = round(count * (len(palette) - 1) / max_count)
    return palette[max(0, min(len(palette) - 1, scaled))]


def generate_symmetry_transform_heatmap_svg(*, dataset_name: str, output_path: Path | None = None):
    trial_names, counts_by_name, max_count = collect_symmetry_heatmap_data(dataset_name=dataset_name)
    num_participants = len({row["session_id"] for row in ru.load_trial_order_details(dataset_name=dataset_name)})

    if output_path is None:
        output_path = REPO_ROOT / "analysis_trial_order_spread" / "symmetry_transform_heatmap.png"

    width = 470
    left_margin = 60
    top_margin = 70
    row_h = 11
    cell_w = 32
    cell_h = 10
    n_rows = len(trial_names)
    matrix_bottom = top_margin + n_rows * row_h + 3
    legend_label_y = matrix_bottom + 28
    legend_y = matrix_bottom + 36
    height = legend_y + 42

    lines = []
    lines.extend(_svg_header(width, height))
    lines.append(_text(width / 2, 28, "JTAP_Experiment_1", size=15, fill="#111827", anchor="middle"))
    lines.append(
        _text(
            width / 2,
            48,
            f"Symmetry-transform heatmap with randomized ordering for {num_participants} participants",
            size=12,
            fill="#475569",
            anchor="middle",
        )
    )
    lines.append(_line(6, 58, width - 8, 58, stroke="#e5edf5"))

    for tick in range(1, 9):
        x = left_margin + (tick - 1) * cell_w
        lines.append(_line(x, top_margin, x, matrix_bottom, stroke="#eef2f7", width=0.8))
        lines.append(_text(x + 15, matrix_bottom + 20, str(tick), size=8, fill="#475569", anchor="middle"))

    for row_idx, name in enumerate(trial_names):
        y = top_margin + row_idx * row_h
        lines.append(_text(left_margin - 8, y + 8, name, size=9, fill="#111827", anchor="end"))
        lines.append(_line(left_margin - 4, y + 4, left_margin, y + 4, stroke="#94a3b8", width=1, dash="2,3"))
        for slot_idx in range(8):
            count = counts_by_name[name].get(slot_idx + 1, 0)
            fill = _quantized_color(count, max_count, "#fff7f5", "#4a0f0d")
            x = left_margin + slot_idx * cell_w
            lines.append(_rect(x, y, cell_w - 2, cell_h, fill, stroke="#ffffff", width=0.35))

    _add_horizontal_legend(
        lines,
        x=60,
        title_y=legend_label_y,
        bar_y=legend_y,
        max_count=max_count,
        start_hex="#fff7f5",
        end_hex="#4a0f0d",
        width_per=20,
        swatches=HEATMAP_LEGEND_SWATCHES,
        title=f"Participant count in transform slot (empirical max = {max_count})",
    )

    lines.extend(_svg_footer())
    return _save_svg_lines_as_png(lines, Path(output_path))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset-name",
        type=str,
        required=True,
        help="Dataset name under backend/trial_data to read trial_order_details.csv from.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional output path for the repeat-validation PNG plot.",
    )
    parser.add_argument(
        "--trial-heatmap-output",
        type=Path,
        default=None,
        help="Optional output path for the trial-order heatmap PNG.",
    )
    parser.add_argument(
        "--symmetry-heatmap-output",
        type=Path,
        default=None,
        help="Optional output path for the symmetry-transform heatmap PNG.",
    )
    args = parser.parse_args()
    repeat_path = generate_repeat_validation_svg(dataset_name=args.dataset_name, output_path=args.output)
    trial_heatmap_path = generate_trial_order_heatmap_svg(dataset_name=args.dataset_name, output_path=args.trial_heatmap_output)
    symmetry_heatmap_path = generate_symmetry_transform_heatmap_svg(dataset_name=args.dataset_name, output_path=args.symmetry_heatmap_output)
    print(f"Wrote {repeat_path}")
    print(f"Wrote {trial_heatmap_path}")
    print(f"Wrote {symmetry_heatmap_path}")


if __name__ == "__main__":
    main()
