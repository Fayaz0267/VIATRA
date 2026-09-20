"""
VIATRA — Download Helmet Detection Model
Run: python download_helmet_model.py
"""
import os, sys, subprocess, urllib.request

def pip(pkg):
    subprocess.run([sys.executable, "-m", "pip", "install", pkg, "-q"], check=False)

print("="*55)
print("VIATRA Helmet Model Downloader")
print("="*55)

if os.path.exists("helmet_model.pt"):
    print("✅ helmet_model.pt already exists!")
    from ultralytics import YOLO
    m = YOLO("helmet_model.pt")
    print(f"   Classes: {m.names}")
    sys.exit(0)

pip("huggingface_hub")

# Try multiple sources
SOURCES = [
    ("keremberke/yolov8m-hard-hat-detection", "best.pt"),
    ("keremberke/yolov8n-hard-hat-detection",  "best.pt"),
    ("arnabdhar/YOLOv8-Face-Detection",        "model.pt"),
]

downloaded = False
for repo, filename in SOURCES:
    try:
        print(f"Trying {repo}...")
        from huggingface_hub import hf_hub_download
        path = hf_hub_download(repo_id=repo, filename=filename, local_dir=".")
        os.rename(path, "helmet_model.pt")
        print(f"✅ Downloaded → helmet_model.pt")
        downloaded = True
        break
    except Exception as e:
        print(f"  ❌ {e}")

if not downloaded:
    # Direct GitHub download
    URLS = [
        "https://github.com/niconielsen32/ComputerVision/raw/master/trafficSignDetection/helmet_model.pt",
        "https://github.com/Karan-Malik/HelmetDetector/raw/master/weights/best.pt",
    ]
    for url in URLS:
        try:
            print(f"Trying direct: {url[:50]}...")
            urllib.request.urlretrieve(url, "helmet_model.pt")
            print("✅ Downloaded via direct URL")
            downloaded = True
            break
        except Exception as e:
            print(f"  ❌ {e}")

if not downloaded:
    print("\n❌ Auto-download failed. Manual steps:")
    print("1. Go to: https://universe.roboflow.com/search?q=helmet+motorcycle+india")
    print("2. Pick any model → Export → YOLOv8 → Download Model")
    print("3. Save the best.pt file as: backend/helmet_model.pt")
    print("\nOR use this direct Roboflow export (requires free account):")
    print("   Model: hardhat-detection | Version: 1")
else:
    from ultralytics import YOLO
    m = YOLO("helmet_model.pt")
    print(f"\n✅ Model classes: {m.names}")
    print("Now restart backend: uvicorn app.main:app --reload --port 8000")
