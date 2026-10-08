"""UV alignment safety regression tests. Run with: python -m unittest -v."""
import os
from pathlib import Path
import sys
import unittest

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import creeper_outer_rigid_truevoid as reference
import uv_align_guarded_v2 as engine


class GuardedUVTests(unittest.TestCase):
    def test_interior_collapse_detected_and_repaired(self):
        dest = np.array([0, 39, 52, 99], np.float32)
        source = np.array([0, 39, 39.5, 92], np.float32)
        mapped, metrics = engine.condition_axis(dest, source, 100, 93)
        self.assertEqual(metrics['unsafe_spans_before'], 1)
        self.assertGreaterEqual(float(np.min(np.diff(mapped))), 0.265)
        self.assertLess(float(np.max(np.abs(np.diff(mapped)))), 3.5)
        self.assertEqual(metrics['repaired_spans'][0]['kind'], 'interior')

    def test_boundary_collapse_detected_and_repaired(self):
        dest = np.array([0, 9, 396, 403], np.float32)
        source = np.array([0, 0.5, 385, 385.5], np.float32)
        mapped, metrics = engine.condition_axis(dest, source, 404, 389)
        self.assertEqual(metrics['unsafe_spans_before'], 2)
        self.assertEqual({c['kind'] for c in metrics['repaired_spans']}, {'boundary-start', 'boundary-end'})
        self.assertGreaterEqual(float(np.min(np.diff(mapped))), 0.265)

    def test_healthy_map_stays_unchanged(self):
        dest = np.array([0, 20, 60, 100], np.float32)
        source = np.array([0, 19, 58, 99], np.float32)
        mapped, metrics = engine.condition_axis(dest, source, 101, 100)
        old = np.interp(np.arange(101) + .5, dest, source) - .5
        self.assertEqual(metrics['unsafe_spans_before'], 0)
        self.assertTrue(np.allclose(mapped, old, atol=1e-5))

    def test_non_monotone_constraint_is_rejected(self):
        with self.assertRaises(engine.AlignmentError):
            engine.condition_axis(np.array([0, 10, 9], np.float32),
                                  np.array([0, 20, 30], np.float32), 12, 31)

    def test_mismatched_islands_rejected(self):
        original = np.zeros((160, 320, 4), np.uint8)
        source = original.copy()
        original[:, :, 3] = source[:, :, 3] = 255
        original[15:96, 14:110, :3] = 150
        original[25:110, 220:300, :3] = 150
        source[15:96, 14:110, :3] = 110
        with self.assertRaisesRegex(engine.AlignmentError, 'Component mismatch'):
            engine.run(original, source)

    def test_identical_uv_masks_never_resample_or_move_pixels(self):
        original = np.zeros((96, 160, 4), np.uint8)
        ai = original.copy()
        original[:, :, 3] = ai[:, :, 3] = 255
        original[12:75, 15:145, :3] = 105
        ai[12:75, 15:145, :3] = 168
        original[30:48, 55:72, :3] = 0
        ai[30:48, 55:72, :3] = 0
        out, report = engine.run(original, ai)
        expected = original.copy()
        occupied = engine.texture_mask(original).astype(bool)
        expected[occupied, :3] = ai[occupied, :3]
        self.assertTrue(np.array_equal(out, expected))
        self.assertEqual(report['method'], 'identity_mask_transfer')

    def test_mismatched_sizes_rejected(self):
        with self.assertRaises(engine.AlignmentError):
            engine.run(np.zeros((100, 100, 4), np.uint8), np.zeros((100, 99, 4), np.uint8))

    def test_background_topology_preserved_in_mock_atlas(self):
        target = np.zeros((180, 260, 4), np.uint8)
        generated = target.copy()
        target[:, :, 3] = generated[:, :, 3] = 255
        target[20:155, 15:240, :3] = 170
        target[59:85, 50:90, :3] = 0  # enclosed true-void opening
        generated[23:157, 16:236, :3] = 118
        generated[59:85, 50:90, :3] = 0
        out, report = engine.run(target, generated)
        outside = ~engine.texture_mask(target).astype(bool)
        self.assertTrue(np.array_equal(out[outside], target[outside]))
        self.assertTrue(np.array_equal(out[59:85, 50:90], target[59:85, 50:90]))
        self.assertEqual(report['status'], 'validated')

    def test_transparent_alpha_and_holes_remain_identical(self):
        original = np.zeros((128, 128, 4), dtype=np.uint8)
        generated = original.copy()
        original[20:100, 22:103, :3] = 167
        original[20:100, 22:103, 3] = 255
        generated[21:101, 24:105, :3] = 123
        generated[21:101, 24:105, 3] = 255
        original[55:68, 52:68] = 0
        generated[56:69, 54:70] = 0
        out, report = engine.run(original, generated)
        self.assertTrue(np.array_equal(out[:, :, 3], original[:, :, 3]))
        self.assertTrue(np.array_equal(out[55:68, 52:68], original[55:68, 52:68]))
        self.assertEqual(report['status'], 'validated')

    def test_known_translation_of_non_creeper_uv_shape_is_reversed(self):
        # Deterministic T-shaped atlas; not a Creeper example or coordinate patch.
        h, w = 128, 256
        yy, xx = np.mgrid[:h, :w]
        original = np.zeros((h, w, 4), np.uint8)
        mask = (((xx >= 30) & (xx < 100) & (yy >= 18) & (yy < 105)) |
                ((xx >= 100) & (xx < 175) & (yy >= 43) & (yy < 88)))
        mask[(xx >= 55) & (xx < 76) & (yy >= 57) & (yy < 75)] = False
        for channel, values in enumerate(((xx * 7 + yy * 5 + 60) % 190 + 60,
                                          (xx * 3 + yy * 11 + 40) % 190 + 60,
                                          (xx * 13 + yy * 2 + 25) % 190 + 60)):
            original[:, :, channel][mask] = values.astype(np.uint8)[mask]
        original[:, :, 3][mask] = 255
        ai = cv2.warpAffine(original, np.float32([[1, 0, 2], [0, 1, 1]]),
                            (w, h), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT)
        out, report = engine.run(original, ai)
        original_material = original[:, :, :3].astype(float)
        shifted_mae = float(np.abs(ai[:, :, :3].astype(float) - original_material)[mask].mean())
        corrected_mae = float(np.abs(out[:, :, :3].astype(float) - original_material)[mask].mean())
        self.assertLess(corrected_mae, shifted_mae * 0.05)
        self.assertTrue(np.array_equal(out[:, :, 3], original[:, :, 3]))
        self.assertTrue(np.array_equal(out[~mask], original[~mask]))
        self.assertEqual(report['status'], 'validated')

    def test_unsafe_map_refuses_to_publish(self):
        with self.assertRaises(engine.AlignmentError):
            engine.condition_axis(np.array([0, 95, 99], np.float32),
                                  np.array([0, .25, .5], np.float32), 100, 100)

    def test_creeper_real_regression_when_fixtures_supplied(self):
        """Set UV_TEST_ORIGINAL and UV_TEST_AI to use the original test PNGs."""
        op = os.environ.get('UV_TEST_ORIGINAL')
        ap = os.environ.get('UV_TEST_AI')
        if not op or not ap:
            self.skipTest('Real Creeper fixtures not supplied to this test environment')
        target, generated = reference.load(op), reference.load(ap)
        new, report = engine.run(target, generated)
        base_outer, base_final = reference.run(target, generated)
        # Facial region must remain byte-for-byte identical to archived baseline.
        self.assertTrue(np.array_equal(new[210:352, 200:410], base_final[210:352, 200:410]))
        blank = ~engine.texture_mask(target).astype(bool)
        self.assertTrue(np.array_equal(new[blank], target[blank]))
        self.assertEqual(len(report['components']), 2)
        self.assertGreaterEqual(sum(len(comp['axis_diagnostics'][axis]['repaired_spans'])
                                    for comp in report['components'] for axis in ('x', 'y')), 7)
        # Never encode these Creeper coordinates into the production algorithm.


if __name__ == '__main__':
    unittest.main()
