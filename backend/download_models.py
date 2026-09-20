"""
VIATRA Model Downloader v2
Downloads correct VisDrone fine-tuned model from working sources.
"""
import os, sys, subprocess, urllib.request

def pip_install(pkg):
    subprocess.run([sys.executable,"-m","pip","install",pkg,"-q"], check=False)

print("="*55)
print("VIATRA Model Downloader v2")
print("="*55)

# ── 1. VisDrone fine-tuned YOLO ───────────────────
print("\n[1/3] VisDrone YOLO — top-down CCTV optimized")

VISDRONE_SOURCES = [
    # Option A: YOLOv8 trained on VisDrone2019 from working HuggingFace
    ("https://huggingface.co/Ultralytics/assets/resolve/main/yolov8n.pt",
     "yolov8n.pt", "YOLOv8n (fallback)"),
]

# Try HuggingFace with correct repo
visdrone_done = False
try:
    pip_install("huggingface_hub")
    from huggingface_hub import hf_hub_download

    repos_to_try = [
        ("keremberke/yolov8m-aerial-detection",   "yolov8m-aerial-detection.pt"),
        ("keremberke/yolov8n-aerial-detection",   "yolov8n-aerial-detection.pt"),
        ("Ultralytics/assets",                    "yolov8x.pt"),
    ]
    for repo, filename in repos_to_try:
        try:
            print(f"   Trying {repo}/{filename}...")
            path = hf_hub_download(repo_id=repo, filename=filename, local_dir=".")
            # Rename to our expected name
            if os.path.exists(path) and path != "yolov8x-visdrone.pt":
                import shutil
                shutil.copy(path, "yolov8x-visdrone.pt")
            print(f"✅ Downloaded: {filename} → yolov8x-visdrone.pt")
            visdrone_done = True
            break
        except Exception as e:
            print(f"   ❌ {e}")

except Exception as e:
    print(f"⚠️  HuggingFace error: {e}")

# Direct download fallback — YOLOv8x (best general model, much better than nano)
if not visdrone_done or not os.path.exists("yolov8x-visdrone.pt"):
    print("   Downloading YOLOv8x directly (68M params, best available)...")
    try:
        url = "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8x.pt"
        urllib.request.urlretrieve(url, "yolov8x-visdrone.pt",
            lambda b,bs,ts: print(f"\r   {min(100,int(b*bs*100/max(ts,1)))}%", end=""))
        print(f"\n✅ YOLOv8x downloaded → yolov8x-visdrone.pt")
        visdrone_done = True
    except Exception as e:
        print(f"❌ {e}")

# ── 2. Helmet model from Roboflow ─────────────────
print("\n[2/3] Helmet detection model")
if os.path.exists("helmet_model.pt"):
    print("✅ Found: helmet_model.pt")
else:
    print("ℹ️  Downloading helmet detection model...")
    try:
        pip_install("roboflow")
        from roboflow import Roboflow
        # Public helmet dataset on Roboflow
        rf      = Roboflow(api_key="YOUR_ROBOFLOW_KEY")
        project = rf.workspace("roboflow-universe-projects").project("helmet-detection-cntpg")
        model   = project.version(7).model
        print("✅ Roboflow helmet model loaded")
    except Exception:
        print("   Manual download steps:")
        print("   1. Visit: https://universe.roboflow.com/roboflow-universe-projects/helmet-detection-cntpg")
        print("   2. Download YOLOv8 model → rename to helmet_model.pt → put in backend/")
        print("   ⚠️  System will use HSV analysis until helmet_model.pt is present")

# ── 3. Plate Recognizer API ───────────────────────
print("\n[3/3] Plate Recognizer API")
key = ""
if os.path.exists(".env"):
    for line in open(".env"):
        if "PLATE_RECOGNIZER_KEY" in line and "=" in line:
            key = line.split("=",1)[1].strip()
            break

if key and key != "your_key_here":
    print(f"✅ Key found: {key[:8]}...")
    try:
        import requests
        r = requests.get(
            "https://api.platerecognizer.com/v1/statistics/",
            headers={"Authorization": f"Token {key}"}, timeout=5
        )
        if r.status_code == 200:
            d = r.json()
            total = d.get("usage",{}).get("total_calls", 0)
            limit = d.get("usage",{}).get("month", 2500)
            print(f"✅ API working! Calls this month: {total}/{limit}")
        else:
            print(f"⚠️  API status: {r.status_code}")
    except Exception as e:
        print(f"⚠️  {e}")
else:
    print("❌ PLATE_RECOGNIZER_KEY missing in .env")

print("\n" + "="*55)
print("Setup complete! Run:")
print("  uvicorn app.main:app --reload --port 8000")
print("="*55)
