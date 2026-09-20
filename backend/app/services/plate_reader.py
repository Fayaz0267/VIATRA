"""
VIATRA Plate Reader v2
======================
Fixes:
  ✅ Sends FULL frame to Plate Recognizer (not just crop)
  ✅ Multiple preprocessing strategies
  ✅ Better caching — plate stored per track_id forever
  ✅ EasyOCR with CLAHE + sharpening + morphology
  ✅ Debug mode prints what it finds
"""

import cv2
import numpy as np
import requests
import base64
import time
from typing import Optional, Dict, List, Tuple


class PlateReaderV2:
    def __init__(self, api_key: str):
        self.key       = api_key.strip()
        self.endpoint  = "https://api.platerecognizer.com/v1/plate-reader/"
        self.cache:    Dict[int, str] = {}   # track_id → plate (permanent)
        self._last_call  = 0.0
        self._min_gap    = 2.0               # 2 seconds between API calls
        self.total_calls = 0
        self.ocr         = None
        self.ocr_ready   = False
        self._init_ocr()
        print(f"✅ PlateReader v2 ready — API key: {api_key[:8]}...")

    def _init_ocr(self):
        # Try PaddleOCR first (better for Indian plates)
        self.paddle = None
        try:
            from paddleocr import PaddleOCR
            self.paddle = PaddleOCR(use_angle_cls=True, lang="en",
                                     show_log=False, use_gpu=False)
            self.ocr_ready = True
            print("✅ PaddleOCR loaded (primary plate reader)")
        except Exception as e:
            print(f"ℹ  PaddleOCR not available: {e}")

        # EasyOCR fallback
        try:
            import easyocr
            self.ocr       = easyocr.Reader(["en"], gpu=False, verbose=False)
            self.ocr_ready = True
            print("✅ EasyOCR loaded (plate fallback)")
        except Exception as e:
            print(f"⚠  EasyOCR: {e}")

    def get_plate(self,
                  frame: np.ndarray,
                  vehicles: List,
                  track_id: Optional[int] = None) -> Optional[str]:
        """
        Main entry point. Returns plate string or None.
        Strategy:
          1. Check cache (free)
          2. Plate Recognizer API — full frame (best accuracy)
          3. Plate Recognizer API — per vehicle crop
          4. EasyOCR fallback with preprocessing
        """
        # ── 1. Cache check ────────────────────────
        if track_id and track_id in self.cache:
            return self.cache[track_id]

        # Also check all vehicle track IDs
        for v in vehicles:
            if v.track_id and v.track_id in self.cache:
                return self.cache[v.track_id]

        # ── 2. Plate Recognizer API ───────────────
        plate = self._api_read(frame, vehicles)
        if plate:
            # Cache for ALL vehicles in this frame
            if track_id:
                self.cache[track_id] = plate
            for v in vehicles:
                if v.track_id:
                    self.cache[v.track_id] = plate
            return plate

        # ── 3. EasyOCR fallback ───────────────────
        plate = self._ocr_read(frame, vehicles)
        if plate:
            if track_id:
                self.cache[track_id] = plate
            for v in vehicles:
                if v.track_id:
                    self.cache[v.track_id] = plate
            return plate

        return None

    def _api_read(self, frame: np.ndarray, vehicles: List) -> Optional[str]:
        """Call Plate Recognizer API."""
        if not self.key:
            return None

        # Rate limit
        now = time.time()
        if now - self._last_call < self._min_gap:
            return None

        fh, fw = frame.shape[:2]

        # Strategy A: Send full frame (API handles detection)
        plate = self._call_api(frame, region="in")
        if plate:
            return plate

        # Strategy B: Per vehicle crop
        for v in vehicles[:3]:
            bx1,by1,bx2,by2 = v.bbox
            # Add generous padding
            pad  = 30
            crop = frame[max(0,by1-pad):min(fh,by2+pad),
                         max(0,bx1-pad):min(fw,bx2+pad)]
            if crop.size < 500:
                continue
            # Upscale small crops for better detection
            ch, cw = crop.shape[:2]
            if cw < 400:
                scale = 400 / cw
                crop  = cv2.resize(crop, (400, int(ch*scale)))
            plate = self._call_api(crop, region="in")
            if plate:
                return plate

        return None

    def _call_api(self, img: np.ndarray, region: str = "in") -> Optional[str]:
        """Single API call."""
        try:
            _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 95])
            b64    = base64.b64encode(buf).decode()

            resp = requests.post(
                self.endpoint,
                data={
                    "upload":  f"data:image/jpeg;base64,{b64}",
                    "regions": region,
                    "config":  '{"mode":"fast","detection_rule":"strict"}',
                },
                headers={"Authorization": f"Token {self.key}"},
                timeout=6
            )
            self._last_call  = time.time()
            self.total_calls += 1

            if resp.status_code in (200, 201):
                results = resp.json().get("results", [])
                if results:
                    # Pick highest confidence result
                    best  = max(results, key=lambda r: r.get("score", 0))
                    plate = best["plate"].upper().replace(" ","").replace("-","")
                    score = best.get("score", 0)
                    if score > 0.35 and len(plate) >= 4:
                        # Validate Indian plate format loosely
                        alpha = sum(1 for c in plate if c.isalpha())
                        digit = sum(1 for c in plate if c.isdigit())
                        if alpha >= 2 and digit >= 2:
                            print(f"🪪 Plate Recognizer: {plate} (conf:{score:.2f})")
                            return plate[:12]
            elif resp.status_code == 429:
                print("⚠  Plate API rate limit — slowing down")
                self._min_gap = 5.0
            elif resp.status_code == 403:
                print("⚠  Plate API key invalid or expired")
                self.key = ""   # disable API
        except requests.Timeout:
            print("⚠  Plate API timeout")
        except Exception as e:
            print(f"⚠  Plate API error: {e}")
        return None

    def _ocr_read(self, frame: np.ndarray,
                  vehicles: List) -> Optional[str]:
        """EasyOCR with aggressive preprocessing."""
        if not self.ocr_ready or not self.ocr:
            return None

        fh, fw = frame.shape[:2]
        results = []

        for v in vehicles[:3]:
            bx1,by1,bx2,by2 = v.bbox
            vh = by2 - by1

            # Try multiple crop regions
            crops = [
                # Bottom 35% — front/rear plate
                frame[max(0, by1+int(vh*.65)):min(fh,by2+20),
                      max(0,bx1-10):min(fw,bx2+10)],
                # Bottom 20%
                frame[max(0, by1+int(vh*.80)):min(fh,by2+10),
                      max(0,bx1):min(fw,bx2)],
                # Full vehicle
                frame[max(0,by1):min(fh,by2),
                      max(0,bx1):min(fw,bx2)],
            ]

            for crop in crops:
                if crop.size < 200:
                    continue
                plate = self._ocr_single(crop)
                if plate:
                    return plate

        return None

    def _ocr_single(self, img: np.ndarray) -> Optional[str]:
        """Process single crop with OCR — PaddleOCR primary, EasyOCR fallback."""
        # Method 1: PaddleOCR (better for Indian plates)
        if self.paddle:
            try:
                h, w = img.shape[:2]
                if w < 150:
                    img = cv2.resize(img, (150, max(1, int(h*150/w))))
                result = self.paddle.ocr(img, cls=True)
                if result and result[0]:
                    text = "".join(
                        line[1][0] for line in result[0]
                        if line and line[1] and line[1][1] > 0.30
                    )
                    clean = "".join(c for c in text.upper() if c.isalnum())
                    if len(clean) >= 4:
                        alpha = sum(1 for c in clean if c.isalpha())
                        digit = sum(1 for c in clean if c.isdigit())
                        if alpha >= 2 and digit >= 2:
                            print(f"🪪 PaddleOCR: {clean[:10]}")
                            return clean[:10]
            except Exception as e:
                pass

        try:
            # Upscale
            h, w = img.shape[:2]
            if w < 200:
                scale = 200 / max(w, 1)
                img   = cv2.resize(img, (200, max(1, int(h*scale))))

            gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Multiple preprocessing variants
            variants = []

            # 1. CLAHE
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4,4))
            v1    = clahe.apply(gray)
            variants.append(cv2.resize(v1, (240, 80)))

            # 2. Bilateral + CLAHE + sharpen
            bil  = cv2.bilateralFilter(gray, 9, 75, 75)
            v2   = clahe.apply(bil)
            kern = np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])
            v2   = cv2.filter2D(v2, -1, kern)
            variants.append(cv2.resize(v2, (240, 80)))

            # 3. Threshold
            _, v3 = cv2.threshold(gray, 0, 255,
                cv2.THRESH_BINARY+cv2.THRESH_OTSU)
            variants.append(cv2.resize(v3, (240, 80)))

            for variant in variants:
                ocr_results = self.ocr.readtext(
                    variant,
                    detail=1,
                    allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                    paragraph=False,
                    min_size=10,
                )
                if not ocr_results:
                    continue

                # Combine all text above confidence threshold
                text = "".join(r[1] for r in ocr_results if r[2] > 0.25)
                clean = "".join(c for c in text.upper() if c.isalnum())

                if len(clean) >= 4:
                    alpha = sum(1 for c in clean if c.isalpha())
                    digit = sum(1 for c in clean if c.isdigit())
                    if alpha >= 2 and digit >= 2:
                        print(f"🪪 EasyOCR: {clean[:10]}")
                        return clean[:10]

        except Exception as e:
            pass
        return None
