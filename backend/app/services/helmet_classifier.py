"""
VIATRA Helmet Classifier v9 — Shirt-Aware
==========================================
Fixes:
  🔧 Head crop = strictly top 20% of person bbox
  🔧 Shirt sampled separately (mid 30–55%) for color reference
  🔧 Dark shirt contamination check — requires circle to confirm dark helmet
  🔧 Default = NO HELMET (False, 0.62) unless strong dome evidence
"""

import cv2
import numpy as np
from typing import Tuple

SKIN_RANGES = [
    (np.array([0,  20, 70]),  np.array([20, 220, 255])),
    (np.array([0,  10, 40]),  np.array([14, 130, 210])),
    (np.array([170,20, 70]),  np.array([180,220, 255])),
]
HAIR_LOWER = np.array([0,   0,  0])
HAIR_UPPER = np.array([180, 80, 85])
TOPI_LOWER = np.array([0,   0, 155])
TOPI_UPPER = np.array([180, 40, 255])


def _safe_crop_hsv(frame, x1, y1, x2, y2):
    """Safely crop frame region and return (bgr64, hsv64) or (None, None)."""
    fh, fw = frame.shape[:2]
    x1 = max(0, x1); y1 = max(0, y1)
    x2 = min(fw, x2); y2 = min(fh, y2)
    if x2 <= x1 or y2 <= y1:
        return None, None
    crop = frame[y1:y2, x1:x2]
    if crop.size < 100:
        return None, None
    crop = cv2.resize(crop, (64, 64))
    return crop, cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)


def classify_helmet(
    person_bbox: Tuple[int, int, int, int],
    full_frame:  np.ndarray,
    debug:       bool = False
) -> Tuple[bool, float]:
    """
    Returns (has_helmet: bool, confidence: float).
    Default = (False, 0.62) — NO HELMET unless proven.
    """
    px1, py1, px2, py2 = person_bbox
    ph = py2 - py1
    pw = px2 - px1
    fh, fw = full_frame.shape[:2]

    if ph < 12 or pw < 6:
        return False, 0.62

    pad = max(3, pw // 8)

    # Head region: top 20% only
    head_h  = max(8, int(ph * 0.20))
    head_y2 = min(py1 + head_h, fh)
    head, head_hsv = _safe_crop_hsv(
        full_frame,
        max(0, px1 - pad), py1,
        min(fw, px2 + pad), head_y2
    )
    if head is None:
        return False, 0.62

    # Shirt region: mid 30–55% of person
    shirt_y1 = py1 + int(ph * 0.30)
    shirt_y2 = py1 + int(ph * 0.55)
    _, shirt_hsv = _safe_crop_hsv(
        full_frame,
        max(0, px1), shirt_y1,
        min(fw, px2), shirt_y2
    )

    try:
        gray    = cv2.cvtColor(head, cv2.COLOR_BGR2GRAY)
        blur    = cv2.GaussianBlur(gray, (5, 5), 0)

        avg_s   = float(np.mean(head_hsv[:, :, 1]))
        avg_v   = float(np.mean(head_hsv[:, :, 2]))
        std_h   = float(np.std(head_hsv[:, :, 0]))
        lap_var = float(np.var(cv2.Laplacian(gray, cv2.CV_64F)))

        shirt_avg_v = float(np.mean(shirt_hsv[:, :, 2])) if shirt_hsv is not None else 128.0
        shirt_avg_s = float(np.mean(shirt_hsv[:, :, 1])) if shirt_hsv is not None else 50.0

        # Contamination: head color too similar to shirt AND both dark
        shirt_contaminated = (
            shirt_hsv is not None
            and abs(avg_v - shirt_avg_v) < 25
            and avg_v < 130
            and shirt_avg_v < 130
        )

        circles    = cv2.HoughCircles(blur, cv2.HOUGH_GRADIENT, 1, 12,
                                       param1=30, param2=10,
                                       minRadius=8, maxRadius=30)
        has_circle = circles is not None

        # Masks
        skin = np.zeros((64, 64), dtype=np.uint8)
        for lo, hi in SKIN_RANGES:
            skin = cv2.bitwise_or(skin, cv2.inRange(head_hsv, lo, hi))
        skin_pct = float(np.sum(skin > 0)) / (64 * 64)

        hair      = cv2.inRange(head_hsv, HAIR_LOWER, HAIR_UPPER)
        hair_pct  = float(np.sum(hair > 0)) / (64 * 64)

        topi      = cv2.inRange(head_hsv, TOPI_LOWER, TOPI_UPPER)
        topi_pct  = float(np.sum(topi > 0)) / (64 * 64)

        top16     = head[:16, :]
        top_hsv   = cv2.cvtColor(top16, cv2.COLOR_BGR2HSV)
        visor     = cv2.inRange(top_hsv,
                                np.array([90, 25, 100]),
                                np.array([140, 140, 255]))
        visor_pct = float(np.sum(visor > 0)) / (16 * 64)

        metallic  = cv2.inRange(head_hsv,
                                np.array([0, 0, 190]),
                                np.array([180, 40, 255]))
        metal_pct = float(np.sum(metallic > 0)) / (64 * 64)

        if debug:
            print(f"  [HC v9] circ:{has_circle} contam:{shirt_contaminated} "
                  f"skin:{skin_pct:.2f} hair:{hair_pct:.2f} topi:{topi_pct:.2f} "
                  f"visor:{visor_pct:.2f} metal:{metal_pct:.2f} "
                  f"head_v:{avg_v:.0f} shirt_v:{shirt_avg_v:.0f} "
                  f"avg_s:{avg_s:.0f} std_h:{std_h:.0f} lap:{lap_var:.0f}")

        # ── HELMET signals ────────────────────────

        # Visor reflection = definite helmet
        if visor_pct > 0.06:
            if debug: print("  → HELMET (visor)")
            return True, 0.97

        # Metallic shine
        if metal_pct > 0.22 and lap_var < 500:
            if debug: print(f"  → HELMET (metallic {metal_pct:.2f})")
            return True, 0.92

        # Dark smooth dome — shirt contamination check
        if avg_v < 100 and avg_s < 80 and lap_var < 450:
            if shirt_contaminated:
                if has_circle:
                    if debug: print("  → HELMET (dark+circle, shirt-aware)")
                    return True, 0.90
                else:
                    if debug: print("  → SKIP dark (shirt contamination, no circle)")
                    # fall through to NO HELMET
            else:
                if debug: print(f"  → HELMET (dark smooth v:{avg_v:.0f} lap:{lap_var:.0f})")
                return True, 0.93

        # Dark circle = dark helmet dome
        if has_circle and avg_v < 130 and avg_s < 100:
            if debug: print("  → HELMET (dark circle)")
            return True, 0.95

        # Colored helmet: circle + saturated + uniform hue
        if has_circle and avg_s > 50 and std_h < 35 and skin_pct < 0.22:
            c = min(0.87 + avg_s / 600, 0.97)
            if debug: print(f"  → HELMET (colored circle s:{avg_s:.0f})")
            return True, c

        # Any circle + smooth texture = hard dome
        if has_circle and lap_var < 280 and skin_pct < 0.18:
            if debug: print(f"  → HELMET (smooth circle lap:{lap_var:.0f})")
            return True, 0.84

        # Uniform solid color + smooth (not shirt-contaminated)
        if std_h < 14 and avg_s > 45 and lap_var < 320 \
                and skin_pct < 0.12 and not shirt_contaminated:
            if debug: print("  → HELMET (uniform smooth shell)")
            return True, 0.85

        # White dome: bright + smooth + circle + not flat topi
        if (avg_v > 175 and avg_s < 45 and lap_var < 320
                and topi_pct < 0.18 and skin_pct < 0.12 and has_circle):
            if debug: print("  → HELMET (white dome)")
            return True, 0.89

        # ── NO HELMET (default) ───────────────────
        score = 0.62
        if skin_pct > 0.22 and not has_circle:   score += 0.10
        if hair_pct > 0.30 and not has_circle:   score += 0.08
        if topi_pct > 0.25 and not has_circle:   score += 0.10
        if lap_var > 450 and not has_circle:      score += 0.05
        if not has_circle:                        score += 0.04
        if avg_s < 25 and avg_v > 80:             score += 0.03
        if shirt_contaminated and not has_circle: score += 0.06
        score = min(score, 0.95)

        if debug: print(f"  → NO HELMET (default score:{score:.2f})")
        return False, score

    except Exception as e:
        if debug: print(f"  [HC v9] Error: {e}")
        return False, 0.62