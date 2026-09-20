"""
VIATRA Detection Engine v5.2 — One Challan Per Vehicle
=======================================================
Fixes over v5.1:
  🔧 FIX 1 — Line 402 walrus operator bug removed (was: if not x := y)
  🔧 FIX 2 — ONE challan per track_id ever. Once issued → grey box, skipped.
  🔧 FIX 3 — Shirt-aware helmet via classifier v9 (head top 20%, shirt mid 30-55%)
  🔧 FIX 4 — Threshold 0.55 (classifier v9 defaults at 0.62 for genuine violations)
  🔧 FIX 5 — Triple riding debounce: must see 3+ riders for 3 consecutive frames
"""

import cv2
import numpy as np
import requests, base64, time, os
from ultralytics import YOLO
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Set
from collections import defaultdict, deque
from app.core.config import settings
from app.services.frame_enhancer import enhance_frame
from app.services.helmet_classifier import classify_helmet


class VType:
    NO_HELMET      = "no_helmet"
    TRIPLE_RIDING  = "triple_riding"
    SIGNAL_JUMPING = "signal_jumping"
    LANE_VIOLATION = "lane_violation"
    WRONG_WAY      = "wrong_way"
    OVERSPEEDING   = "overspeeding"
    BOTH           = "both"

    FINES = {
        NO_HELMET: 500, TRIPLE_RIDING: 1000, SIGNAL_JUMPING: 1000,
        LANE_VIOLATION: 500, WRONG_WAY: 5000, OVERSPEEDING: 2000, BOTH: 1500
    }
    SECTIONS = {
        NO_HELMET:      "Section 129 MV Act 1988",
        TRIPLE_RIDING:  "Section 128 MV Act 1988",
        SIGNAL_JUMPING: "Section 119 MV Act 1988",
        LANE_VIOLATION: "Section 112 MV Act 1988",
        WRONG_WAY:      "Section 119 MV Act 1988",
        OVERSPEEDING:   "Section 112 MV Act 1988",
        BOTH:           "Section 128 & 129 MV Act 1988",
    }


@dataclass
class Detection:
    bbox:       Tuple[int, int, int, int]
    label:      str
    confidence: float
    class_id:   int
    track_id:   Optional[int] = None


@dataclass
class ViolationResult:
    has_violation:     bool                 = False
    violation_type:    Optional[str]        = None
    fine_amount:       int                  = 1000
    legal_section:     str                  = ""
    rider_count:       int                  = 1
    helmet_confidence: float                = 1.0
    plate_number:      Optional[str]        = None
    track_id:          Optional[int]        = None
    speed_kmh:         Optional[float]      = None
    detections:        List[Detection]      = field(default_factory=list)
    annotated_frame:   Optional[np.ndarray] = None
    all_violations:    List[str]            = field(default_factory=list)


# ── Trajectory tracker ────────────────────────────
class TrajectoryTracker:
    def __init__(self, max_history=45):
        self.tracks     = defaultdict(lambda: deque(maxlen=max_history))
        self.last_seen  = {}
        self.first_seen = {}

    def update(self, tid, center):
        if tid not in self.first_seen:
            self.first_seen[tid] = time.time()
        self.tracks[tid].append((center, time.time()))
        self.last_seen[tid] = time.time()

    def velocity(self, tid):
        pts = list(self.tracks[tid])
        if len(pts) < 5:
            return 0.0, 0.0
        (x1, y1), t1 = pts[-5]
        (x2, y2), t2 = pts[-1]
        dt = max(t2 - t1, 0.01)
        return (x2 - x1) / dt, (y2 - y1) / dt

    def speed_kmh(self, tid, ppm=10.0):
        vx, vy = self.velocity(tid)
        return round(((vx**2 + vy**2)**0.5 / max(ppm, 1)) * 3.6, 1)

    def is_wrong_way(self, tid, direction="down"):
        vx, vy = self.velocity(tid)
        spd = (vx**2 + vy**2)**0.5
        if spd < 5:
            return False
        return {"down": vy < -8, "up": vy > 8,
                "right": vx < -8, "left": vx > 8}.get(direction, False)

    def crossed_lane(self, tid, lx):
        pts = [p[0] for p in self.tracks[tid]]
        if len(pts) < 8:
            return False
        xs    = [p[0] for p in pts]
        left  = [x for x in xs[:-3] if x < lx - 25]
        right = [x for x in xs[:-3] if x > lx + 25]
        now   = xs[-1]
        return (left and now > lx + 25) or (right and now < lx - 25)

    def cleanup(self, max_age=8.0):
        now  = time.time()
        dead = [t for t, s in self.last_seen.items() if now - s > max_age]
        for t in dead:
            self.tracks.pop(t, None)
            self.last_seen.pop(t, None)
            self.first_seen.pop(t, None)


# ── Signal detector ───────────────────────────────
class SignalDetector:
    def __init__(self):
        self.stop_lines   = []
        self.light_state  = "unknown"
        self.red_crossers: Set[int] = set()
        self._red_frames  = 0

    def set_stop_line(self, x1, y1, x2, y2):
        self.stop_lines.append((x1, y1, x2, y2))

    def detect_light(self, frame):
        upper = frame[:frame.shape[0] // 4, :]
        hsv   = cv2.cvtColor(upper, cv2.COLOR_BGR2HSV)
        r1 = cv2.inRange(hsv, np.array([0,   140, 120]), np.array([10,  255, 255]))
        r2 = cv2.inRange(hsv, np.array([170, 140, 120]), np.array([180, 255, 255]))
        g  = cv2.inRange(hsv, np.array([45,  100, 100]), np.array([85,  255, 255]))
        rp = cv2.countNonZero(cv2.bitwise_or(r1, r2))
        gp = cv2.countNonZero(g)
        if rp > 120 and rp > gp * 2:
            self._red_frames += 1
            if self._red_frames >= 3:
                self.light_state = "red"
        elif gp > 120 and gp > rp * 2:
            self._red_frames = 0
            self.light_state = "green"
        return self.light_state

    def crossed(self, bbox, tid):
        if not self.stop_lines or self.light_state != "red":
            return False
        if tid in self.red_crossers:
            return False
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) // 2
        for lx1, ly1, lx2, ly2 in self.stop_lines:
            if abs(ly1 - ly2) < 30 and ly1 < y2 < ly1 + 50 and lx1 < cx < lx2:
                self.red_crossers.add(tid)
                return True
        return False


# ══════════════════════════════════════════════════
# MAIN DETECTOR
# ══════════════════════════════════════════════════
class TrafficViolationDetector:

    HELMET_CONF_THRESHOLD  = 0.55   # classifier v9 defaults at 0.62
    TRIPLE_DEBOUNCE_FRAMES = 3      # consecutive frames before triple riding fires

    def __init__(self):
        print("\n🚀 VIATRA v5.2 — One Challan Per Vehicle\n")
        self._load_main_yolo()
        self._load_helmet_models()
        self._load_mediapipe()
        self._load_plate()
        self._load_ocr()

        self.trajectory = TrajectoryTracker()
        self.signal     = SignalDetector()

        # FIX 2: one challan per track_id per session
        self.challaned_ids: Set[int]             = set()
        self.track_viols:   Dict[int, List[str]] = defaultdict(list)
        # FIX 5: triple riding debounce
        self.triple_frames: Dict[int, int]       = defaultdict(int)

        self.frame_count = 0

        self.enable_signal = False
        self.enable_lane   = False
        self.enable_wrong  = False
        self.enable_speed  = False
        self.traffic_dir   = "down"
        self.lane_bounds:  List[int] = []
        self.speed_limit   = settings.SPEED_LIMIT_KMH
        self.px_per_meter  = 10.0

        print(f"\n{'='*54}")
        print(f"✅ VIATRA v5.2 Ready!")
        print(f"   Main YOLO      : {self.yolo_name}")
        print(f"   Helmet model   : {self.helmet_info}")
        print(f"   Plate          : {self.plate_info}")
        print(f"   Helmet thresh  : {self.HELMET_CONF_THRESHOLD}")
        print(f"   Triple debounce: {self.TRIPLE_DEBOUNCE_FRAMES} frames")
        print(f"   Person IDs     : {self.person_cls}")
        print(f"   Bike IDs       : {self.bike_cls}")
        print(f"{'='*54}\n")

    # ── Loaders ──────────────────────────────────
    def _load_main_yolo(self):
        for mp in [settings.YOLO_MODEL, settings.YOLO_FALLBACK,
                   "yolov8x.pt", "yolov8n.pt", "yolo11n.pt"]:
            if os.path.exists(mp):
                try:
                    self.yolo       = YOLO(mp)
                    self.yolo_name  = mp
                    names           = self.yolo.names
                    self.bike_cls   = set()
                    self.person_cls = set()
                    self.veh_cls    = set()
                    for k, v in names.items():
                        vl = str(v).lower()
                        if any(x in vl for x in ["motorcycle", "motor", "bike",
                                                   "bicycle", "tricycle", "scooter"]):
                            self.bike_cls.add(k)
                        if any(x in vl for x in ["person", "pedestrian", "people"]):
                            self.person_cls.add(k)
                        if any(x in vl for x in ["car", "van", "truck", "bus"]):
                            self.veh_cls.add(k)
                    if not self.bike_cls:   self.bike_cls   = {1, 3}
                    if not self.person_cls: self.person_cls = {0}
                    if not self.veh_cls:    self.veh_cls    = {2, 5, 7}
                    print(f"✅ Main YOLO: {mp}")
                    print(f"   Classes: {dict(names)}")
                    return
                except Exception as e:
                    print(f"⚠  {mp}: {e}")
        raise RuntimeError("No YOLO model found")

    def _load_helmet_models(self):
        self.helmet_yolo = None
        self.helmet_info = "HSV classifier v9 (shirt-aware, default NO HELMET)"
        for mpath in [settings.HELMET_MODEL, "helmet_model.pt", "hard_hat_model.pt"]:
            if os.path.exists(mpath):
                try:
                    self.helmet_yolo = YOLO(mpath)
                    self.helmet_info = f"Fine-tuned: {mpath} + HSV v9 fallback"
                    print(f"✅ Helmet YOLO: {mpath}  classes:{self.helmet_yolo.names}")
                    break
                except Exception as e:
                    print(f"⚠  {mpath}: {e}")
        if not self.helmet_yolo:
            print("ℹ  No helmet_model.pt — using HSV v9 only")

    def _load_mediapipe(self):
        self.pose = None
        self.mp_ok = False
        try:
            from app.services.mediapipe_helper import load_pose
            self.pose, self.mp_ok = load_pose()
        except Exception:
            try:
                import mediapipe as mp
                self.pose  = mp.solutions.pose.Pose(
                    static_image_mode=True, min_detection_confidence=0.3)
                self.mp_ok = True
                print("✅ MediaPipe loaded")
            except Exception as e:
                print(f"⚠  MediaPipe: {e}")

    def _load_plate(self):
        self.plate = None
        self.plate_info = "EasyOCR only"
        try:
            from app.services.plate_reader import PlateReaderV2
            key = settings.PLATE_RECOGNIZER_KEY
            if key and key.strip() and key not in ("", "your_key_here"):
                self.plate      = PlateReaderV2(key)
                self.plate_info = "PlateReaderV2 (API + EasyOCR)"
            else:
                self.plate      = PlateReaderV2("")
                self.plate_info = "EasyOCR only"
        except Exception as e:
            print(f"⚠  Plate reader: {e}")

    def _load_ocr(self):
        self.ocr = None
        self.ocr_ok = False
        try:
            import easyocr
            self.ocr    = easyocr.Reader(["en"], gpu=False, verbose=False)
            self.ocr_ok = True
            print("✅ EasyOCR loaded")
        except Exception as e:
            print(f"⚠  EasyOCR: {e}")

    # ── Main detection ────────────────────────────
    def detect_frame(self, frame: np.ndarray) -> ViolationResult:
        result = ViolationResult()
        self.frame_count += 1
        dbg = (self.frame_count % 20 == 0)

        frame, is_night = enhance_frame(frame)
        annotated = frame.copy()

        if is_night:
            cv2.putText(annotated, "NIGHT MODE",
                        (annotated.shape[1] - 150, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)

        if self.frame_count % 200 == 0:
            self.trajectory.cleanup()

        # ── YOLO + ByteTrack ──────────────────────
        try:
            yr = self.yolo.track(
                frame,
                conf=settings.YOLO_CONFIDENCE,
                persist=True,
                tracker="bytetrack.yaml",
                verbose=False,
                iou=0.45,
                imgsz=640,
            )[0]
        except Exception:
            try:
                yr = self.yolo(frame,
                               conf=settings.YOLO_CONFIDENCE,
                               verbose=False,
                               imgsz=640)[0]
            except Exception as e:
                print(f"❌ YOLO: {e}")
                result.annotated_frame = frame
                return result

        persons:  List[Detection] = []
        bikes:    List[Detection] = []
        vehicles: List[Detection] = []

        for box in yr.boxes:
            cls  = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            lbl  = self.yolo.names[cls]
            tid  = int(box.id[0]) if box.id is not None else None
            det  = Detection((x1, y1, x2, y2), lbl, conf, cls, tid)
            result.detections.append(det)
            if tid:
                self.trajectory.update(tid, ((x1 + x2) // 2, (y1 + y2) // 2))
            if cls in self.person_cls:
                persons.append(det)
            if cls in self.bike_cls:
                bikes.append(det)
                vehicles.append(det)
            elif cls in self.veh_cls:
                vehicles.append(det)

        if dbg:
            print(f"[F{self.frame_count}] bikes:{len(bikes)} "
                  f"persons:{len(persons)} challaned:{len(self.challaned_ids)}")

        # Plate reading every 20 frames
        targets = bikes or vehicles
        if targets and self.frame_count % 20 == 0 and self.plate:
            p = self.plate.get_plate(frame, targets)
            if p:
                result.plate_number = p
        if not result.plate_number and targets and self.plate:
            for v in targets:
                if v.track_id and v.track_id in self.plate.cache:
                    result.plate_number = self.plate.cache[v.track_id]
                    break

        # Signal light indicator
        if self.enable_signal:
            ls = self.signal.detect_light(frame)
            lc = {"red": (0, 0, 255), "green": (0, 200, 0),
                  "yellow": (0, 200, 255)}.get(ls, (120, 120, 120))
            cv2.circle(annotated, (30, 30), 14, lc, -1)
            cv2.putText(annotated, f"LIGHT:{ls.upper()}", (50, 36),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, lc, 2)

        if self.enable_lane:
            for lx in self.lane_bounds:
                cv2.line(annotated, (lx, 0), (lx, frame.shape[0]), (255, 255, 0), 2)

        # ── Per-bike analysis ─────────────────────
        for bike in bikes:
            bx1, by1, bx2, by2 = bike.bbox
            tid = bike.track_id
            result.track_id = tid

            # FIX 2: already challaned → grey box, skip entirely
            if tid and tid in self.challaned_ids:
                cv2.rectangle(annotated, (bx1, by1), (bx2, by2), (80, 80, 80), 1)
                plate_str = result.plate_number or (
                    self.plate.cache.get(tid, "") if self.plate else "")
                label = f"ID:{tid} CHALLANED"
                if plate_str:
                    label += f" [{plate_str}]"
                cv2.putText(annotated, label, (bx1, by1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.38, (80, 80, 80), 1)
                continue

            viol: List[str] = []

            # ── Rider count ───────────────────────
            riders_det = self._riders_on_bike(persons, bike.bbox, expand=0.25)
            riders     = self._count_riders(frame, persons, bike.bbox)
            result.rider_count = max(result.rider_count, riders)

            if dbg:
                print(f"  Bike ID:{tid} bbox:{bike.bbox} "
                      f"overlap_persons:{len(riders_det)} count:{riders}")

            # FIX 5: triple riding debounce
            if riders > settings.MAX_RIDERS:
                self.triple_frames[tid] = self.triple_frames.get(tid, 0) + 1
                if self.triple_frames[tid] >= self.TRIPLE_DEBOUNCE_FRAMES:
                    viol.append(VType.TRIPLE_RIDING)
                    print(f"  🚨 TRIPLE RIDING: {riders} on bike ID:{tid}")
            else:
                # decay counter when count drops back
                self.triple_frames[tid] = max(0, self.triple_frames.get(tid, 0) - 1)

            # ── Helmet check ──────────────────────
            no_helm: List[Detection] = []

            # FIX 1 (line 402 bug): removed walrus operator, plain if/else
            if len(riders_det) == 0:
                # No person bbox overlaps bike → classify bike top region directly
                has_helm, hconf = self._classify_bike_top(frame, bike.bbox)
                result.helmet_confidence = hconf
                if dbg:
                    print(f"  Bike ID:{tid} fallback bike-top: "
                          f"helmet={has_helm} conf={hconf:.2f}")
                if not has_helm and hconf >= self.HELMET_CONF_THRESHOLD:
                    synthetic = Detection(bike.bbox, "rider", hconf, -1, tid)
                    no_helm.append(synthetic)
            else:
                for person in riders_det:
                    has_helm, hconf = self._detect_helmet(frame, person.bbox, dbg)
                    result.helmet_confidence = hconf
                    if dbg:
                        print(f"  Person {person.bbox}: "
                              f"helmet={has_helm} conf={hconf:.2f}")
                    if not has_helm and hconf >= self.HELMET_CONF_THRESHOLD:
                        no_helm.append(person)

            if no_helm:
                viol.append(VType.NO_HELMET)
                print(f"  🚨 NO HELMET: {len(no_helm)} riders on bike ID:{tid}")

            # ── Signal jump ───────────────────────
            if self.enable_signal and tid and self.signal.crossed(bike.bbox, tid):
                viol.append(VType.SIGNAL_JUMPING)

            # ── Lane violation ────────────────────
            if self.enable_lane and tid:
                for lx in self.lane_bounds:
                    if self.trajectory.crossed_lane(tid, lx):
                        viol.append(VType.LANE_VIOLATION)
                        break

            # ── Wrong way ─────────────────────────
            if self.enable_wrong and tid:
                if self.trajectory.is_wrong_way(tid, self.traffic_dir):
                    viol.append(VType.WRONG_WAY)

            # ── Speed ─────────────────────────────
            if self.enable_speed and tid:
                spd = self.trajectory.speed_kmh(tid, self.px_per_meter)
                if 3 < spd < 200 and spd > self.speed_limit:
                    result.speed_kmh = spd
                    viol.append(VType.OVERSPEEDING)

            # ── No violation → green box ──────────
            if not viol:
                cv2.rectangle(annotated, (bx1, by1), (bx2, by2), (0, 200, 0), 2)
                label = f"ID:{tid}" if tid else "OK"
                if riders > 1:
                    label += f" ({riders}👤)"
                cv2.putText(annotated, label, (bx1, by1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 0), 1)
                continue

            # ── Violation found → issue challan ───
            primary = self._primary(viol)
            if VType.NO_HELMET in viol and VType.TRIPLE_RIDING in viol:
                primary = VType.BOTH

            result.has_violation  = True
            result.violation_type = primary
            result.fine_amount    = VType.FINES.get(primary, 1000)
            result.legal_section  = VType.SECTIONS.get(primary, "MV Act 1988")
            result.all_violations.extend(viol)
            result.track_id = tid

            # FIX 2: mark challaned → will show grey box from next frame
            if tid:
                self.challaned_ids.add(tid)
                self.track_viols[tid].extend(viol)

            vc = {
                VType.NO_HELMET:      (0,   0, 255),
                VType.TRIPLE_RIDING:  (0,   0, 200),
                VType.SIGNAL_JUMPING: (147, 0, 255),
                VType.LANE_VIOLATION: (255,140,   0),
                VType.WRONG_WAY:      (180,  0, 180),
                VType.OVERSPEEDING:   (0,   69, 255),
                VType.BOTH:           (0,   0, 180),
            }.get(primary, (0, 0, 255))

            cv2.rectangle(annotated, (bx1, by1), (bx2, by2), vc, 3)

            parts = []
            if VType.TRIPLE_RIDING  in viol: parts.append(f"TRIPLE({riders})")
            if VType.NO_HELMET       in viol: parts.append("NO HELMET")
            if VType.SIGNAL_JUMPING  in viol: parts.append("RED LIGHT")
            if VType.LANE_VIOLATION  in viol: parts.append("LANE")
            if VType.WRONG_WAY       in viol: parts.append("WRONG WAY")
            if VType.OVERSPEEDING    in viol: parts.append(f"{result.speed_kmh}km/h")

            label = " | ".join(parts)
            if tid:                  label = f"ID:{tid} " + label
            if result.plate_number:  label += f" [{result.plate_number}]"

            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            cv2.rectangle(annotated,
                          (bx1, by1 - th - 14), (bx1 + tw + 8, by1), vc, -1)
            cv2.putText(annotated, label, (bx1 + 4, by1 - 7),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

            for p in no_helm:
                cv2.rectangle(annotated,
                              (p.bbox[0], p.bbox[1]),
                              (p.bbox[2], p.bbox[3]), (0, 0, 200), 2)
                cv2.putText(annotated, "NO HELMET",
                            (p.bbox[0], p.bbox[1] - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 200), 1)

            print(f"🚨 CHALLAN: {primary} | ID:{tid} | riders:{riders} | "
                  f"plate:{result.plate_number} | ₹{result.fine_amount}")

        # Draw pedestrians not on bikes
        for p in persons:
            if not any(self._in_bike(p, b) for b in bikes):
                cv2.rectangle(annotated,
                              (p.bbox[0], p.bbox[1]),
                              (p.bbox[2], p.bbox[3]), (0, 165, 255), 1)

        result.annotated_frame = annotated
        return result

    # ── Helmet detection ──────────────────────────
    def _detect_helmet(self, frame: np.ndarray,
                       person_bbox: Tuple[int, int, int, int],
                       debug: bool = False) -> Tuple[bool, float]:
        """
        Shirt-aware helmet detection.
        1. Fine-tuned YOLO on head crop (top 20%) if model available.
        2. classify_helmet v9 (HSV, shirt-aware) as fallback.
        Default = NO HELMET.
        """
        px1, py1, px2, py2 = person_bbox
        ph = py2 - py1
        pw = px2 - px1
        fh, fw = frame.shape[:2]

        if ph < 8 or pw < 4:
            return False, 0.65

        head_h  = max(8, int(ph * 0.20))
        head_y2 = min(py1 + head_h, fh)
        pad     = max(3, pw // 8)
        hx1     = max(0, px1 - pad)
        hx2     = min(fw, px2 + pad)
        head_crop = frame[py1:head_y2, hx1:hx2]

        if head_crop.size < 60:
            return False, 0.65

        # Fine-tuned YOLO on head crop
        if self.helmet_yolo is not None:
            try:
                res = self.helmet_yolo(head_crop, conf=0.20, verbose=False)[0]
                if len(res.boxes) > 0:
                    best_no  = None
                    best_yes = None
                    for b in res.boxes:
                        lbl  = self.helmet_yolo.names[int(b.cls[0])].lower()
                        conf = float(b.conf[0])
                        if debug:
                            print(f"    YOLO helmet: {lbl} {conf:.2f}")
                        if any(x in lbl for x in ["no", "without", "bare",
                                                    "none", "face", "head"]):
                            if best_no is None or conf > best_no[1]:
                                best_no = (False, conf)
                        if any(x in lbl for x in ["helmet", "hardhat",
                                                    "hard_hat", "safety",
                                                    "yes", "wear"]):
                            if best_yes is None or conf > best_yes[1]:
                                best_yes = (True, conf)
                    if best_no and best_yes:
                        return best_no if best_no[1] >= best_yes[1] else best_yes
                    if best_no:  return best_no
                    if best_yes: return best_yes
                # YOLO ran but no boxes → NO HELMET
                if debug:
                    print("    YOLO: no boxes → NO HELMET default")
                return False, 0.63
            except Exception as e:
                if debug:
                    print(f"    Helmet YOLO err: {e}")

        # Fallback: HSV classifier v9 (shirt-aware)
        return classify_helmet(person_bbox, frame, debug=debug)

    def _classify_bike_top(self, frame: np.ndarray,
                           bike_bbox: Tuple[int, int, int, int]) -> Tuple[bool, float]:
        """
        Classify top 35% of bike bbox as synthetic head region
        when no person detections overlap the bike.
        """
        bx1, by1, bx2, by2 = bike_bbox
        bh = by2 - by1
        synth_bbox = (bx1, by1, bx2, by1 + int(bh * 0.35))
        try:
            return classify_helmet(synth_bbox, frame, debug=False)
        except Exception as e:
            print(f"⚠  _classify_bike_top: {e}")
            return False, 0.65

    # ── Helpers ───────────────────────────────────
    def _riders_on_bike(self, persons: List[Detection],
                        bike_bbox: Tuple[int, int, int, int],
                        expand: float = 0.25) -> List[Detection]:
        """
        Overlap-ratio based person↔bike association.
        Bike bbox expanded by `expand` in all directions.
        Person accepted if >25% of their width overlaps expanded bbox.
        """
        bx1, by1, bx2, by2 = bike_bbox
        bw = bx2 - bx1
        bh = by2 - by1
        ex  = int(bw * expand)
        ey  = int(bh * expand)
        ebx1 = max(0, bx1 - ex)
        ebx2 = bx2 + ex
        eby1 = max(0, by1 - ey)
        eby2 = by2 + ey

        result = []
        for p in persons:
            px1, py1, px2, py2 = p.bbox
            ov_x = max(0, min(px2, ebx2) - max(px1, ebx1))
            ov_y = max(0, min(py2, eby2) - max(py1, eby1))
            pw   = max(px2 - px1, 1)
            if ov_x / pw > 0.25 and ov_y > 0:
                result.append(p)
        return result

    def _in_bike(self, person: Detection, bike: Detection) -> bool:
        """Simple center-point check used for pedestrian drawing only."""
        bx1, by1, bx2, by2 = bike.bbox
        bw = bx2 - bx1
        bh = by2 - by1
        ex = int(bw * 0.15)
        ey = int(bh * 0.10)
        pcx = (person.bbox[0] + person.bbox[2]) // 2
        pcy = (person.bbox[1] + person.bbox[3]) // 2
        return (bx1 - ex < pcx < bx2 + ex) and (by1 - ey < pcy < by2 + ey)

    def _count_riders(self, frame: np.ndarray,
                      persons: List[Detection],
                      bike_bbox: Tuple[int, int, int, int]) -> int:
        """Count riders with MediaPipe fallback when YOLO finds no overlap."""
        count = len(self._riders_on_bike(persons, bike_bbox, expand=0.25))
        if count == 0 and self.mp_ok and self.pose:
            try:
                bx1, by1, bx2, by2 = bike_bbox
                fh, fw = frame.shape[:2]
                region = frame[max(0, by1):min(fh, by2),
                               max(0, bx1):min(fw, bx2)]
                if region.size > 0:
                    rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
                    res = self.pose.process(rgb)
                    if res.pose_landmarks:
                        count = 1
            except Exception:
                pass
        return max(count, 1)

    def _primary(self, viol: List[str]) -> str:
        order = [VType.WRONG_WAY, VType.SIGNAL_JUMPING, VType.OVERSPEEDING,
                 VType.TRIPLE_RIDING, VType.NO_HELMET, VType.LANE_VIOLATION]
        for v in order:
            if v in viol:
                return v
        return viol[0]

    # ── Configuration ─────────────────────────────
    def enable_signal_detection(self, x1, y1, x2, y2):
        self.enable_signal = True
        self.signal.set_stop_line(x1, y1, x2, y2)

    def enable_lane_detection(self, lx: int):
        self.enable_lane = True
        self.lane_bounds.append(lx)

    def enable_wrong_way_detection(self, direction: str = "down"):
        self.enable_wrong  = True
        self.traffic_dir   = direction

    def enable_speed_detection(self, limit: float, ppm: float = 10.0):
        self.enable_speed  = True
        self.speed_limit   = limit
        self.px_per_meter  = ppm

    def reset_tracked_ids(self):
        """Call this at the start of every new video."""
        self.challaned_ids.clear()
        self.track_viols.clear()
        self.triple_frames.clear()
        self.trajectory = TrajectoryTracker()
        self.signal.red_crossers.clear()
        self.frame_count = 0
        if self.plate:
            self.plate.cache.clear()
        print("🔄 Session reset — all challans cleared")


# ── Singleton ─────────────────────────────────────
_detector: Optional[TrafficViolationDetector] = None

def get_detector() -> TrafficViolationDetector:
    global _detector
    if _detector is None:
        _detector = TrafficViolationDetector()
    return _detector