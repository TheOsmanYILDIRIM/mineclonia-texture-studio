#!/usr/bin/env python3
"""Guarded, reusable UV atlas alignment (V2).

Original image is the geometry authority; AI image supplies materials. The
archived Creeper pipeline supplies generic contour landmarks but is never
modified. Unsafe maps fail before a PNG can be written.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

import uv_geometry as reference


class AlignmentError(ValueError):
    """Unsafe topology, pairing, or resampling; no output should be published."""


def texture_mask(rgba: np.ndarray, black_threshold: int = 12) -> np.ndarray:
    """Use alpha when real transparency exists; otherwise black is empty."""
    alpha = rgba[:, :, 3]
    if int(np.count_nonzero(alpha <= 8)) >= max(16, int(alpha.size * 0.005)):
        return (alpha > 8).astype(np.uint8)
    return ((np.max(rgba[:, :, :3], axis=2) > black_threshold) & (alpha > 8)).astype(np.uint8)


def components(mask: np.ndarray, area: int) -> tuple[np.ndarray, list[dict[str, Any]]]:
    label, comp = reference.comps(mask, min_area=area)
    return label, comp


def component_pairs(target: list[dict], source: list[dict], width: int, height: int) -> list[tuple[dict, dict, float]]:
    if not target or len(target) != len(source):
        raise AlignmentError(f"Component mismatch: target={len(target)} source={len(source)}; refusing guesswork")
    pairs = reference.pair_components(target, source, width, height)
    if len(pairs) != len(target) or any(not np.isfinite(cost) or cost > 0.85 for _, _, cost in pairs):
        raise AlignmentError("Ambiguous or very different UV components; manual region matching is required")
    return pairs


def _monotone_hermite(left_value: float, right_value: float, left_x: float, right_x: float,
                      left_slope: float, right_slope: float, x: np.ndarray) -> np.ndarray:
    span = right_x - left_x
    delta = (right_value - left_value) / span
    if delta <= 0:
        raise AlignmentError("Reversed correspondence anchors")
    left_slope, right_slope = max(0.0, left_slope), max(0.0, right_slope)
    a, b = left_slope / delta, right_slope / delta
    if a * a + b * b > 9:
        scale = 3.0 / np.sqrt(a * a + b * b)
        left_slope, right_slope = scale * a * delta, scale * b * delta
    t = (x - left_x) / span
    return ((2*t**3 - 3*t**2 + 1) * left_value +
            (t**3 - 2*t**2 + t) * span * left_slope +
            (-2*t**3 + 3*t**2) * right_value +
            (t**3 - t**2) * span * right_slope)


def condition_axis(dst: np.ndarray, src: np.ndarray, dst_size: int, src_size: int,
                   min_rate: float = 0.28, max_rate: float = 3.5) -> tuple[np.ndarray, dict]:
    """Automatically repair all collapsed/overexpanded sampling spans.

    Stable spans remain identical to the historical mapping. Interior bad spans
    are repaired between nearby stable shoulder anchors. Boundary defects are
    redistributed to the nearest stable landmark. Coordinates are never chosen
    for any particular creature, texture, or image size.
    """
    if len(dst) < 2 or len(src) != len(dst) or np.any(np.diff(dst) <= 0):
        raise AlignmentError("Invalid contour constraints")
    points = np.arange(dst_size, dtype=np.float64) + 0.5
    original_map = np.interp(points, dst, src) - 0.5
    fixed = original_map.copy()
    ratio = np.diff(src) / np.diff(dst)
    bad = (ratio < min_rate) | (ratio > max_rate)
    spans = []
    k = 0
    while k < len(bad):
        if not bad[k]:
            k += 1
            continue
        start = k
        while k + 1 < len(bad) and bad[k + 1]:
            k += 1
        stop = k
        # A tiny source span maps onto a much wider destination and creates
        # solid bands. At the image edge there are no two shoulders; use the
        # nearest stable knot instead, preserving the component boundaries.
        if start == 0:
            span = float(dst[stop + 1] - dst[start])
            collar = max(2.0 * span, 0.016 * dst_size)
            left, right = float(dst[0]), float(min(dst[min(len(dst) - 1, stop + 2)] - 1,
                                                  dst[stop + 1] + collar))
            shape = "boundary-start"
        elif stop == len(bad) - 1:
            span = float(dst[stop + 1] - dst[start])
            collar = max(2.0 * span, 0.016 * dst_size)
            left, right = float(max(dst[max(0, start - 1)] + 1, dst[start] - collar)), float(dst[-1])
            shape = "boundary-end"
        else:
            span = float(dst[stop + 1] - dst[start])
            shoulder = max(2.0 * span, 0.016 * dst_size)
            left = max(float(dst[start - 1]) + 1.0, float(dst[start]) - shoulder)
            right = min(float(dst[stop + 2]) - 1.0, float(dst[stop + 1]) + shoulder)
            shape = "interior"
        if right <= left + 2:
            raise AlignmentError("Too little space to repair a collapsed UV mapping")
        selection = (points >= left) & (points <= right)
        v0, v1 = float(np.interp(left, dst, src) - 0.5), float(np.interp(right, dst, src) - 0.5)
        if shape == "interior":
            slope0 = float(ratio[start - 1])
            slope1 = float(ratio[stop + 1])
            proposal = _monotone_hermite(v0, v1, left, right, slope0, slope1, points[selection])
            # Monotone Hermite sometimes undershoots the rate floor near an
            # extreme knot. Strict linear fallback avoids repeating pixels.
            if len(proposal) > 1 and (np.min(np.diff(proposal)) < min_rate - 0.001 or
                                      np.max(np.diff(proposal)) > max_rate + 0.001):
                proposal = np.interp(points[selection], [left, right], [v0, v1])
        else:
            proposal = np.interp(points[selection], [left, right], [v0, v1])
        fixed[selection] = proposal
        spans.append({"kind": shape, "target_interval": [round(float(dst[start]), 2),
                      round(float(dst[stop + 1]), 2)], "repair_window": [round(left, 2), round(right, 2)]})
        k += 1
    gradients = np.diff(fixed)
    if len(gradients) and (float(gradients.min()) < min_rate - 0.015 or
                           float(gradients.max()) > max_rate + 0.015):
        raise AlignmentError(f"Mapping still unsafe after correction: rates {gradients.min():.3f}..{gradients.max():.3f}")
    if float(np.min(fixed)) < -1.01 or float(np.max(fixed)) > src_size + 0.01:
        raise AlignmentError("Remap escapes the AI component")
    displacement_limit = max(8.0, 0.04 * dst_size * (src_size / max(1, dst_size)))
    if float(np.max(np.abs(fixed-original_map))) > displacement_limit:
        raise AlignmentError("Correction requires excessive feature displacement; manual alignment needed")
    return fixed.astype(np.float32), {
        "unsafe_spans_before": int(bad.sum()),
        "repaired_spans": spans,
        "minimum_source_pixels_per_target_pixel": round(float(gradients.min()), 4) if len(gradients) else None,
        "maximum_source_pixels_per_target_pixel": round(float(gradients.max()), 4) if len(gradients) else None,
        "maximum_coordinate_change_px": round(float(np.max(np.abs(fixed - original_map))), 3),
        "modified_output_coordinates": int(np.count_nonzero(np.abs(fixed-original_map) > 1e-4))
    }


def guarded_warp(source: np.ndarray, source_mask: np.ndarray,
                 target_mask: np.ndarray) -> tuple[np.ndarray, dict]:
    tp, sp = reference.poly(target_mask), reference.poly(source_mask)
    if tp is None or sp is None:
        raise AlignmentError("No usable foreground contour")
    pairs = reference.ordered_pairs(reference.rectilinear(tp), reference.rectilinear(sp))
    maps = {}
    metrics = {}
    for axis, orientation, target_length, source_length in (
        ("x", "V", target_mask.shape[1], source_mask.shape[1]),
        ("y", "H", target_mask.shape[0], source_mask.shape[0]),
    ):
        dst, src = reference.cons(pairs, orientation)
        dst, src = reference.bounds(dst, src, target_length - 1, source_length - 1)
        maps[axis], metrics[axis] = condition_axis(dst, src, target_length, source_length)
    shape = target_mask.shape
    mx = np.broadcast_to(maps["x"][None, :], shape).copy()
    my = np.broadcast_to(maps["y"][:, None], shape).copy()
    # Cubic preserves material sharpness; the map has already been validated.
    warped = cv2.remap(source, mx, my, cv2.INTER_CUBIC,
                       borderMode=cv2.BORDER_REPLICATE)
    return warped, metrics


def run(original: np.ndarray, ai: np.ndarray, min_area: int | None = None) -> tuple[np.ndarray, dict]:
    if original.ndim != 3 or ai.ndim != 3 or original.shape != ai.shape or original.shape[2] != 4:
        raise AlignmentError("Both images must have identical width/height and four RGBA channels")
    height, width = original.shape[:2]
    min_area = min_area or max(20, int(round(width * height * 0.00020)))
    target_mask, source_mask = texture_mask(original), texture_mask(ai)
    target_labels, target_comp = components(target_mask, min_area)
    source_labels, source_comp = components(source_mask, min_area)
    matches = component_pairs(target_comp, source_comp, width, height)
    # Pixel-exact original background/alpha and target silhouette are immutable.
    output = original.copy()
    records = []
    for orig, new, cost in matches:
        _, tm = reference.crop(original, target_labels, orig)
        src, sm = reference.crop(ai, source_labels, new)
        # Component labels prevent unrelated islands from entering the warp.
        src = src.copy()
        part, diagnostics = guarded_warp(src, sm, tm)
        y, x, w, h = (orig["y"], orig["x"], orig["w"], orig["h"])
        dest = output[y:y + h, x:x + w]
        dest[tm.astype(bool)] = part[tm.astype(bool)]
        # Original alpha is a UV invariant, regardless of AI transparency.
        dest[:, :, 3] = original[y:y + h, x:x + w, 3]
        records.append({"target_bounds": [x, y, w, h],
                        "source_bounds": [new[z] for z in ("x", "y", "w", "h")],
                        "pairing_cost": round(float(cost), 4), "axis_diagnostics": diagnostics})
    # The original background, transparent pixels, and all enclosed voids
    # remain byte-identical, not just aligned approximately.
    outside = ~target_mask.astype(bool)
    if not np.array_equal(output[outside], original[outside]):
        raise AlignmentError("Target empty-region topology was modified")
    return output, {"status": "validated", "dimensions": [width, height],
                    "components": records, "outside_pixels_preserved": int(outside.sum()),
                    "source": "AI texture", "geometry": "Original UV atlas"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original", required=True)
    parser.add_argument("--ai", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", help="Optional JSON verification report")
    args = parser.parse_args()
    try:
        corrected, report = run(reference.load(args.original), reference.load(args.ai))
    except (AlignmentError, ValueError) as exc:
        parser.exit(2, f"UV ALIGNMENT REJECTED: {exc}\n")
    Image.fromarray(corrected, "RGBA").save(args.output)
    if args.report:
        Path(args.report).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"status": report["status"], "output": args.output,
                      "matched_components": len(report["components"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
