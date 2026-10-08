#!/usr/bin/env python3
"""UV component registration with seam-safe masked source resampling.

This deliberately preserves the V1 per-component bounding-box geometry. The fix
is only in image sampling: unobserved/transparent/black background pixels must
never be interpolated into an opaque target UV island. It is NOT semantic face
registration and must not be advertised as one.

Requires: Pillow, numpy, scipy, opencv-python.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

def load_rgba(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGBA"))


def mask_from_original(rgba: np.ndarray) -> np.ndarray:
    # The Mineclonia model's alpha is the only target geometry authority.
    return (rgba[:, :, 3] > 0).astype(np.uint8)


def mask_from_ai(rgba: np.ndarray, threshold: int = 8) -> np.ndarray:
    # For THIS black-background AI-output family. This heuristic cannot safely
    # segment dark opaque entities such as Enderman: use a source alpha/mask.
    foreground = (rgba[:, :, :3].max(axis=2) > threshold).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(foreground, 8)
    # Restrict tiny isolated AI-generated speckles, not genuine larger islands.
    candidates = sorted(((int(stats[i, cv2.CC_STAT_AREA]), i)
                         for i in range(1, n)), reverse=True)
    cutoff = max(20, int(round(foreground.size * 0.0001)))
    selected = [i for area, i in candidates if area >= cutoff]
    if not selected:
        raise ValueError("No visible AI UV islands were detected")
    return np.isin(labels, selected).astype(np.uint8)


def components(mask: np.ndarray) -> tuple[np.ndarray, list[dict]]:
    n, label, stats, centers = cv2.connectedComponentsWithStats(mask, 8)
    result=[]
    for i in range(1,n):
        x,y,w,h,area=stats[i]
        result.append({"label":i, "x":int(x), "y":int(y), "w":int(w),
                       "h":int(h), "area":int(area),
                       "cx":float(centers[i,0]), "cy":float(centers[i,1])})
    result.sort(key=lambda c:c["area"], reverse=True)
    return label, result


def pair_components(target: list[dict], source: list[dict]) -> list[tuple[dict, dict]]:
    if len(target) != len(source):
        raise ValueError(f"Island count mismatch: target={len(target)}, AI={len(source)}")
    pairs=[]; used=set()
    for t in target:
        choices=[]
        for i, src in enumerate(source):
            if i in used: continue
            cost = (abs(t["cx"]-src["cx"]) + 2*abs(t["cy"]-src["cy"]) +
                    0.05*abs(t["area"]-src["area"]))
            choices.append((cost,i))
        if not choices: raise ValueError("Unpaired UV island")
        cost,i=min(choices)
        used.add(i)
        pairs.append((t,source[i]))
    return pairs


def extend_valid_material(src_rgb: np.ndarray, valid_mask: np.ndarray,
                          inset: int = 2) -> tuple[np.ndarray, dict]:
    """Extrapolate nearest *real* source RGB into empty pixels before resampling.

    Optionally move mask 1-2 pixels inside the source to discard partially mixed
    black/transparent fringe pixels. The RGB of already valid pixels is unchanged.
    This is valid-pixel extension, not a geometric remap or boundary repaint.
    """
    valid = valid_mask.astype(bool)
    if not np.any(valid):
        raise ValueError("Empty source component")
    source_pixels = int(valid.sum())
    if inset:
        eroded = cv2.erode(valid.astype(np.uint8), np.ones((3, 3), np.uint8),
                           iterations=inset).astype(bool)
        if np.any(eroded):
            valid = eroded

    # scipy returns nearest zero for every nonzero cell: ~valid -> nearest valid
    distance, indices = distance_transform_edt(~valid, return_indices=True)
    filled = src_rgb[indices[0], indices[1]].copy()
    return filled, {
        "source_valid_pixels": source_pixels,
        "interior_valid_pixels": int(valid.sum()),
        "max_extrapolation_px": round(float(distance.max()), 3),
        "inset": int(inset),
    }, distance.astype(np.float32)


def run(original_path: str, ai_path: str, output_path: str,
        report_path: str | None = None, inset: int = 2) -> dict:
    orig = load_rgba(original_path)
    ai = load_rgba(ai_path)
    if orig.shape != ai.shape:
        raise ValueError("Both inputs must have identical dimensions and RGBA channels")

    target_label, target_comps = components(mask_from_original(orig))
    source_label, source_comps = components(mask_from_ai(ai))
    if len(source_comps) != len(target_comps):
        raise ValueError(f"Component mismatch: original={len(target_comps)}, AI={len(source_comps)}")
    pairs = pair_components(target_comps, source_comps)

    # The target geometry and alpha are never synthesized, guessed or resized.
    result = np.zeros_like(orig)
    result[:, :, 3] = orig[:, :, 3]
    records = []

    for target, source in pairs:
        sx, sy, sw, sh = (source[k] for k in ("x", "y", "w", "h"))
        tx, ty, tw, th = (target[k] for k in ("x", "y", "w", "h"))
        source_rgb = ai[sy:sy+sh, sx:sx+sw, :3]
        source_valid = (source_label[sy:sy+sh, sx:sx+sw] == source["label"])
        extended_rgb, diagnostics, source_distance = extend_valid_material(source_rgb, source_valid, inset)

        # Resample RGB *alone*, not RGBA with black transparent pixels.
        # Alpha/black-background resampling caused the previous 1-2px seams.
        # Bilinear is a convex combination of valid source colors, so unlike
        # Lanczos/Bicubic it cannot ring past a hard edge to negative/black.
        material = np.asarray(Image.fromarray(extended_rgb, "RGB").resize(
            (tw, th), Image.Resampling.BILINEAR))
        target_region = (target_label[ty:ty+th, tx:tx+tw] == target["label"])
        # Coverage audit only where the authentic UV expects material. A large
        # extrapolation distance is a sign of deeper island misregistration.
        warped_distance = np.asarray(Image.fromarray(source_distance, "F").resize(
            (tw, th), Image.Resampling.BILINEAR))
        used_distance = warped_distance[target_region]
        diagnostics["used_target_max_extrapolation_px"] = round(float(used_distance.max()), 3)
        diagnostics["used_target_fraction_over_4px"] = round(float(np.mean(used_distance > 4.0)), 5)
        dest = result[ty:ty+th, tx:tx+tw]
        dest[target_region, :3] = material[target_region]
        dest[:, :, 3] = orig[ty:ty+th, tx:tx+tw, 3]

        # If the AI intentionally contains near-black material, this heuristic
        # is not appropriate; report this limitation rather than claim generality.
        color_black = (material.max(axis=2) <= 8) & target_region
        records.append({
            "target_bbox": [tx,ty,tw,th], "source_bbox": [sx,sy,sw,sh],
            "target_opaque_px": int(target_region.sum()),
            "dark_target_px": int(color_black.sum()),
            "sampling": diagnostics,
        })

    target_occupied = orig[:, :, 3] > 0
    if not np.array_equal(result[:, :, 3], orig[:, :, 3]):
        raise AssertionError("Original UV alpha was modified")
    if np.any(result[~target_occupied, :3] != 0):
        raise AssertionError("Texture written into original transparent background")
    target_dark = (result[:, :, :3].max(axis=2) <= 8) & target_occupied

    Image.fromarray(result, "RGBA").save(output_path)
    report = {
        "status": "geometric_bbox_registered_not_semantically_validated",
        "target_dimensions": [orig.shape[1], orig.shape[0]],
        "component_count": len(records),
        "original_alpha_exact": True,
        "opaque_target_pixels": int(target_occupied.sum()),
        "near_black_opaque_pixels": int(target_dark.sum()),
        "components": records,
    }
    if report_path:
        Path(report_path).write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--original", required=True)
    p.add_argument("--ai", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--report")
    p.add_argument("--edge-inset", type=int, default=2)
    a = p.parse_args()
    print(json.dumps(run(a.original, a.ai, a.output, a.report, a.edge_inset), indent=2))

if __name__ == "__main__":
    main()
