"""
Test Plate Recognizer API directly on a frame.
Usage: python test_plate.py
Put any traffic image as test_frame.jpg in backend/ folder first.
"""
import cv2, sys, os, requests, base64

# Load .env
key = ""
if os.path.exists(".env"):
    for line in open(".env"):
        if "PLATE_RECOGNIZER_KEY" in line and "=" in line:
            key = line.split("=",1)[1].strip().split("#")[0].strip()
            break

if not key:
    print("❌ PLATE_RECOGNIZER_KEY not found in .env")
    sys.exit(1)

print(f"✅ Key: {key[:8]}...")

# Find test image
test_img = None
for f in ["test_frame.jpg", "test.jpg", "frame.jpg"]:
    if os.path.exists(f):
        test_img = f; break

if not test_img:
    # Try snapshots folder
    if os.path.exists("snapshots"):
        snaps = os.listdir("snapshots")
        if snaps:
            test_img = f"snapshots/{snaps[0]}"

if not test_img:
    print("❌ No test image found. Put test_frame.jpg in backend/ folder")
    print("   OR take a screenshot of a frame from your video")
    sys.exit(1)

print(f"📷 Testing with: {test_img}")
img = cv2.imread(test_img)
if img is None:
    print("❌ Cannot read image")
    sys.exit(1)

h, w = img.shape[:2]
print(f"   Resolution: {w}x{h}")

# Test 1: Full image
print("\n[Test 1] Full image...")
_, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY,95])
b64 = base64.b64encode(buf).decode()
r = requests.post(
    "https://api.platerecognizer.com/v1/plate-reader/",
    data={"upload": f"data:image/jpeg;base64,{b64}", "regions": "in"},
    headers={"Authorization": f"Token {key}"},
    timeout=10
)
print(f"   Status: {r.status_code}")
data = r.json()
print(f"   Results: {data.get('results', [])}")
if data.get('results'):
    for res in data['results']:
        print(f"   ✅ PLATE: {res['plate']} (conf:{res.get('score',0):.2f})")
else:
    print("   ❌ No plate detected in full image")

# Check usage
print(f"\n📊 API Usage:")
r2 = requests.get("https://api.platerecognizer.com/v1/statistics/",
    headers={"Authorization": f"Token {key}"}, timeout=5)
if r2.status_code == 200:
    usage = r2.json()
    print(f"   Calls used: {usage}")
else:
    print(f"   Cannot get stats: {r2.status_code}")
