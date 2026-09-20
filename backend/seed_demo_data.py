"""
VIATRA Demo Data Seeder
Run: python seed_demo_data.py
Inserts 60 realistic violations for demo purposes.
"""
import asyncio, random, os, sys
from datetime import datetime, timedelta

# Load env
if os.path.exists(".env"):
    for line in open(".env"):
        if "=" in line and not line.startswith("#"):
            k,_,v = line.strip().partition("=")
            os.environ.setdefault(k.strip(), v.strip().split("#")[0].strip())

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal, engine, Base
from app.models.officer import Officer   # needed for FK resolution
from app.models.violation import Violation

# ── Realistic data pools ──────────────────────────
TS_PLATES = [
    "TS08HH0998","TS09AB1234","TS07CD5678","TS01EF9012",
    "TS29GH3456","TS08IJ7890","TS09KL2345","TS07MN6789",
    "TS01OP0123","TS29QR4567","TS08ST8901","TS09UV2345",
    "TS07WX6789","TS01YZ0123","TS09AA9876","TS08BB5432",
    "AP28CD1111","AP09EF2222","AP29GH3333","AP10IJ4444",
    "MP04ZD7116","MP19WC3922","MH12DE1234","MH14GH5678",
    "KA03MN9012","KA05OP3456","DL4CAF1234","DL7CRF5678",
]

HYD_LOCATIONS = [
    "Hitech City Junction, Hyderabad",
    "Banjara Hills Road No.12, Hyderabad",
    "Jubilee Hills Checkpost, Hyderabad",
    "Madhapur Junction, Hyderabad",
    "Kukatpally Housing Board, Hyderabad",
    "Begumpet Airport Road, Hyderabad",
    "Secunderabad Clock Tower, Hyderabad",
    "Ameerpet Metro Junction, Hyderabad",
    "LB Nagar Circle, Hyderabad",
    "Dilsukhnagar Main Road, Hyderabad",
    "Mehdipatnam Flyover, Hyderabad",
    "Tolichowki Junction, Hyderabad",
    "Kondapur Main Road, Hyderabad",
    "Gachibowli Flyover, Hyderabad",
    "Miyapur X Roads, Hyderabad",
    "Uppal Ring Road, Hyderabad",
    "ECIL X Road, Hyderabad",
    "Malkajgiri Junction, Hyderabad",
    "Sainikpuri Main Road, Hyderabad",
    "Vanasthalipuram Circle, Hyderabad",
]

VIOLATION_TYPES = [
    ("no_helmet",      500,  "Section 129 MV Act 1988"),
    ("triple_riding",  1000, "Section 128 MV Act 1988"),
    ("both",           1500, "Section 128 & 129 MV Act 1988"),
    ("signal_jumping", 1000, "Section 119 MV Act 1988"),
    ("lane_violation", 500,  "Section 112 MV Act 1988"),
    ("overspeeding",   2000, "Section 112 MV Act 1988"),
]

# Weighted distribution (more no_helmet/triple in demo)
WEIGHTS = [35, 25, 15, 10, 10, 5]

STATUSES = ["open","open","open","paid","paid","disputed"]

CHALLAN_TEMPLATE = """TELANGANA TRAFFIC POLICE
VIATRA — VIOLATION INTELLIGENCE SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHALLAN NO  : TSTP{challan_id:06d}
DATE / TIME : {timestamp}
LOCATION    : {location}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VEHICLE DETAILS
Vehicle No  : {plate}
Riders      : {riders}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIOLATION DETAILS
Violation   : {violation}
Legal Ref   : {section}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINE DETAILS
Amount Due  : ₹{fine}
Pay Within  : 7 days from date of issue
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYMENT OPTIONS
• Online  : echallan.tspolice.gov.in
• UPI     : tspolice@upi
• In Person: Nearest Traffic Court
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
తెలుగు: వాహనం {plate} పై {violation_te}
ఉల్లంఘన నమోదైంది. జరిమానా: ₹{fine}
7 రోజులలో చెల్లించండి.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digitally issued by VIATRA AI System
Hyderabad Traffic Police, Telangana"""

TELUGU = {
    "no_helmet":      "హెల్మెట్ లేకుండా వాహనం నడపడం",
    "triple_riding":  "ఒక వాహనంపై ముగ్గురు వ్యక్తులు",
    "both":           "బహుళ ఉల్లంఘనలు",
    "signal_jumping": "ఎర్ర సిగ్నల్ దాటడం",
    "lane_violation": "లేన్ ఉల్లంఘన",
    "overspeeding":   "అతి వేగంగా వాహనం నడపడం",
}


async def seed():
    print("="*50)
    print("VIATRA Demo Data Seeder")
    print("="*50)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    count = 0
    now   = datetime.now()

    async with AsyncSessionLocal() as db:
        # Generate 60 violations spread over last 30 days
        for i in range(60):
            # Pick violation type (weighted)
            vtype, fine, section = random.choices(VIOLATION_TYPES, weights=WEIGHTS, k=1)[0]
            plate    = random.choice(TS_PLATES)
            location = random.choice(HYD_LOCATIONS)
            status   = random.choice(STATUSES)
            riders   = random.randint(1,3) if vtype in ("triple_riding","both") else random.randint(1,2)
            speed    = random.uniform(45,90) if vtype == "overspeeding" else None
            conf     = round(random.uniform(0.72, 0.96), 3)

            # Spread over last 30 days with realistic traffic hours
            days_ago = random.randint(0, 30)
            # Peak hours: 8-10am and 5-8pm
            hour     = random.choices(
                list(range(24)),
                weights=[1,1,1,1,1,1,1,2,5,5,3,3,3,3,3,3,3,5,5,5,3,2,1,1],
                k=1
            )[0]
            minute   = random.randint(0,59)
            ts       = now - timedelta(days=days_ago,
                                        hours=now.hour-hour,
                                        minutes=now.minute-minute)

            challan_text = CHALLAN_TEMPLATE.format(
                challan_id  = 1000 + i,
                timestamp   = ts.strftime("%d %B %Y, %H:%M hrs IST"),
                location    = location,
                plate       = plate,
                riders      = riders,
                violation   = vtype.replace("_"," ").title(),
                section     = section,
                fine        = fine,
                violation_te= TELUGU.get(vtype,"ట్రాఫిక్ ఉల్లంఘన"),
            )

            v = Violation(
                violation_type = vtype,
                plate_number   = plate,
                confidence     = conf,
                rider_count    = riders,
                speed_kmh      = round(speed, 1) if speed else None,
                location       = location,
                legal_section  = section,
                challan_text   = challan_text,
                fine_amount    = fine,
                status         = status,
                all_violations = vtype,
                created_at     = ts,
            )
            db.add(v)
            count += 1

        await db.commit()

    print(f"\n✅ Inserted {count} violations successfully!")
    print(f"\nBreakdown:")
    type_counts = {}
    status_counts = {"open":0,"paid":0,"disputed":0}

    # Quick stats
    print("  Violation types : no_helmet(35%) triple(25%) both(15%) signal(10%) lane(10%) speed(5%)")
    print("  Status split    : open(50%) paid(33%) disputed(17%)")
    print("  Date range      : Last 30 days")
    print("  Locations       : 20 Hyderabad junctions")
    print("  Plates          : Mix of TS/AP/MH/KA/DL vehicles")
    print(f"\n✅ Dashboard analytics, challan manager now populated!")
    print(f"   Restart backend and refresh dashboard to see data.")

asyncio.run(seed())