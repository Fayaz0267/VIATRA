"""
VIATRA Frame Enhancer
=====================
Fixes night/low-light detection by preprocessing frames
before sending to YOLO. Uses CLAHE + gamma correction.
"""
import cv2
import numpy as np


def enhance_frame(frame: np.ndarray) -> tuple:
    """
    Returns (enhanced_frame, is_night)
    Enhances low-light frames for better YOLO detection.
    """
    gray    = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    avg_lum = float(np.mean(gray))
    is_night = avg_lum < 80

    if not is_night:
        return frame, False

    # Step 1: Gamma correction (brighten)
    gamma   = 2.2 if avg_lum < 40 else 1.6
    table   = np.array([((i/255.0)**( 1.0/gamma))*255
                         for i in range(256)]).astype("uint8")
    bright  = cv2.LUT(frame, table)

    # Step 2: CLAHE on luminance channel
    lab     = cv2.cvtColor(bright, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe   = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    l_enh   = clahe.apply(l)
    enhanced = cv2.merge([l_enh, a, b])
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    # Step 3: Denoise
    enhanced = cv2.fastNlMeansDenoisingColored(enhanced, None, 6, 6, 7, 21)

    return enhanced, True
