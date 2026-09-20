# 🚦 TrafficAI — AI-Driven Traffic Violation Detection

Real-time CCTV violation detection using YOLOv8 + MediaPipe + LLM auto-challan generation.

---

## 🚀 Run in 3 Steps

```bash
# 1. Clone and enter directory
cd traffic-violation-ai

# 2. Add your API key (get one at hackathon)
#    Edit .env and set LLM_PROVIDER + your API key

# 3. Launch everything
docker-compose up --build
```

- **Frontend** → http://localhost:3000
- **Backend API** → http://localhost:8000
- **API Docs** → http://localhost:8000/docs

---

## 🔑 Switching LLM Providers

Edit `.env` — change just ONE line:

```env
LLM_PROVIDER=gemini   # or: claude | openai
GEMINI_API_KEY=xxx    # paste whichever key you have
```

---

## 📁 Project Structure

```
traffic-violation-ai/
├── docker-compose.yml          # One command to run all services
├── .env                        # API keys + config
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI entry point
│       ├── core/
│       │   ├── config.py       # Settings + LLM provider config
│       │   └── database.py     # Async PostgreSQL setup
│       ├── models/
│       │   └── violation.py    # DB schema
│       ├── services/
│       │   ├── detector.py     # YOLOv8 + MediaPipe + Helmet CNN
│       │   └── llm_service.py  # Gemini / Claude / OpenAI challan gen
│       └── api/
│           ├── video.py        # WebSocket live stream endpoint
│           ├── violations.py   # CRUD endpoints
│           ├── stats.py        # Dashboard stats
│           └── challan.py      # Challan generation
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── App.js              # Main layout + state
        ├── App.css             # Full dark dashboard theme
        ├── index.js            # React entry point
        └── components/
            ├── LiveFeed.js     # Webcam + video upload + WS client
            ├── StatsPanel.js   # Stats cards + Recharts bar chart
            ├── ViolationLog.js # Real-time violation list
            └── ChallanModal.js # Violation details + AI challan
```

---

## 🧠 How It Works

```
CCTV / Webcam
    ↓ frames via WebSocket
YOLOv8  →  detect vehicles + persons
    ↓
MediaPipe Pose  →  count riders per bike
    ↓
Helmet CNN  →  classify head crop (helmet / no-helmet)
    ↓
Violation Engine  →  flag if >2 riders OR no helmet
    ↓
LLM (Gemini/Claude/OpenAI)  →  generate challan notice
    ↓
PostgreSQL  →  store violation + snapshot
    ↓
React Dashboard  →  live feed + stats + log
```

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Recharts, TailwindCSS |
| Backend | FastAPI, Python 3.11, WebSockets |
| CV/AI | YOLOv8 (Ultralytics), MediaPipe, OpenCV |
| LLM | Gemini 1.5 Flash / Claude / OpenAI (pluggable) |
| Database | PostgreSQL 15 + SQLAlchemy async |
| Queue | Redis |
| Deploy | Docker + Docker Compose |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| WS | `/api/video/ws/stream` | Live frame stream (send/receive base64) |
| POST | `/api/video/upload` | Upload video file |
| GET | `/api/violations/` | List all violations |
| GET | `/api/stats/summary` | Dashboard summary stats |
| GET | `/api/stats/by-day` | Violations per day |
| POST | `/api/challan/generate` | Generate challan via LLM |
| GET | `/api/challan/{id}` | Get challan for violation |

---

## ⚡ Demo Tips for Judges

1. Start with **webcam mode** — point at a phone showing traffic footage
2. Upload the sample CCTV video from `/scripts/sample_traffic.mp4`
3. Show the **live bounding boxes** appearing in real-time
4. Click any violation in the log to show the **AI-generated challan**
5. Show the **stats dashboard** updating live

---

## 🎯 Tuning Detection

In `.env`:
```env
YOLO_CONFIDENCE=0.5   # lower = more detections (more false positives)
MAX_RIDERS=2          # flag if more than this many riders
HELMET_CONFIDENCE=0.85 # threshold for no-helmet classification
```
