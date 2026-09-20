"""
Run this to test YOLO detection on your video.
Usage: python test_detection.py
"""
import cv2
import sys
import os
from ultralytics import YOLO

# ── Config ────────────────────────────────────────
VIDEO_PATH   = "uploads"          # folder to look in
CONFIDENCE   = 0.15               # very low to catch everything
OUTPUT_VIDEO = "test_output.avi"

# Find first video in uploads folder
video_file = None
if os.path.exists(VIDEO_PATH):
    for f in os.listdir(VIDEO_PATH):
        if f.endswith((".mp4", ".avi", ".mov", ".mkv")):
            video_file = os.path.join(VIDEO_PATH, f)
            break

if not video_file:
    print("❌ No video found in uploads/ folder")
    print("   Put your video in the uploads/ folder first")
    sys.exit(1)

print(f"📹 Testing on: {video_file}")
print(f"🔄 Loading YOLO...")

model = YOLO("yolov8n.pt")
cap   = cv2.VideoCapture(video_file)

# Get video properties
fps    = cap.get(cv2.CAP_PROP_FPS) or 30
width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

print(f"📐 Resolution: {width}x{height} @ {fps:.1f}fps | {total} frames")

# Track what's detected
all_labels    = {}
frame_count   = 0
detect_count  = 0

print("\n🔍 Scanning frames (every 10th frame)...\n")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_count += 1
    if frame_count % 10 != 0:   # check every 10th frame
        continue

    results = model(frame, conf=CONFIDENCE, verbose=False)[0]

    if len(results.boxes) > 0:
        detect_count += 1
        labels = [model.names[int(c)] for c in results.boxes.cls.tolist()]
        confs  = [round(float(c), 2) for c in results.boxes.conf.tolist()]

        for l, c in zip(labels, confs):
            if l not in all_labels:
                all_labels[l] = []
            all_labels[l].append(c)

        # Print first 5 frames with detections
        if detect_count <= 5:
            print(f"  Frame {frame_count}: {list(zip(labels, confs))}")

cap.release()

print(f"\n{'='*50}")
print(f"📊 DETECTION SUMMARY")
print(f"{'='*50}")
print(f"Total frames scanned : {frame_count // 10}")
print(f"Frames with detections: {detect_count}")
print(f"\nAll detected classes:")
for label, confs in sorted(all_labels.items()):
    avg_conf = sum(confs) / len(confs)
    print(f"  {label:20s} → {len(confs):4d} detections | avg conf: {avg_conf:.2f}")

print(f"\n{'='*50}")
if "motorcycle" in all_labels:
    print("✅ Motorcycles DETECTED — detection pipeline should work")
elif "bicycle" in all_labels:
    print("⚠️  Only bicycles detected — your video may have bicycles not motorcycles")
    print("   Try changing bike_class_ids in detector.py to include class 1 (bicycle)")
elif "person" in all_labels:
    print("⚠️  Only persons detected — no vehicles found")
    print("   Your video may show pedestrians, not motorcyclists")
else:
    print("❌ Nothing detected — video may be too dark, blurry, or wrong angle")
    print("   Try a clearer traffic video with visible vehicles")
print(f"{'='*50}\n")