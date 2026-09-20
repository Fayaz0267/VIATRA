"""
VIATRA — Vahan/Parivahan Integration Service
=============================================
Fetches vehicle owner details from plate number.

Integration levels:
  Level 1: Mock (demo mode) — instant results for hackathon
  Level 2: Vahan API (requires MoRTH approval)
  Level 3: Surepass API (commercial, works immediately)

For hackathon: Mock mode returns realistic data.
For production: Apply at vahan.parivahan.gov.in
"""
import re
import random
import hashlib
import aiohttp
from typing import Optional, Dict
from datetime import datetime, timedelta
from app.core.config import settings


# ── Indian name database for realistic mock data ──
FIRST_NAMES = [
    "Rahul","Priya","Suresh","Kavitha","Venkat","Lakshmi",
    "Ravi","Sunita","Arun","Deepa","Srinivas","Anitha",
    "Krishna","Padma","Ramesh","Swathi","Nagaraju","Revathi",
    "Shaik","Mohammed","Abdul","Fatima","Hussain","Ayesha"
]
LAST_NAMES = [
    "Kumar","Reddy","Sharma","Rao","Singh","Gupta",
    "Nair","Pillai","Naidu","Chowdary","Varma","Prasad",
    "Khan","Shaik","Mohammed","Begum","Patel","Verma"
]
HYD_AREAS = [
    "Hitech City","Banjara Hills","Jubilee Hills","Madhapur",
    "Kukatpally","Begumpet","Secunderabad","Ameerpet",
    "LB Nagar","Dilsukhnagar","Mehdipatnam","Tolichowki",
    "Kondapur","Gachibowli","Manikonda","Miyapur"
]
VEHICLE_MAKES = {
    "TS":["Hero Honda","Honda Activa","TVS Apache","Bajaj Pulsar",
           "Royal Enfield","Yamaha FZ","Hero Splendor","TVS Jupiter"],
    "AP":["Hero Honda","Honda Shine","Bajaj CT100","TVS Star City"],
    "MH":["Honda CB Shine","Yamaha R15","Bajaj Dominar","KTM Duke"],
}


def _seed_from_plate(plate: str) -> int:
    """Generate consistent seed from plate number."""
    return int(hashlib.md5(plate.encode()).hexdigest()[:8], 16)


def _mock_owner_data(plate: str) -> Dict:
    """Generate realistic but mock owner data from plate number."""
    seed  = _seed_from_plate(plate)
    rng   = random.Random(seed)

    fname = rng.choice(FIRST_NAMES)
    lname = rng.choice(LAST_NAMES)
    area  = rng.choice(HYD_AREAS)
    state = plate[:2] if plate else "TS"
    make  = rng.choice(VEHICLE_MAKES.get(state, VEHICLE_MAKES["TS"]))

    # Generate registration date (1-10 years ago)
    days_ago = rng.randint(365, 3650)
    reg_date = (datetime.now() - timedelta(days=days_ago)).strftime("%d/%m/%Y")

    # Generate expiry date (2-5 years from now)
    expiry_days = rng.randint(730, 1825)
    exp_date    = (datetime.now() + timedelta(days=expiry_days)).strftime("%d/%m/%Y")

    # Mobile (masked)
    mobile = f"+91 9{rng.randint(100,999)}{rng.randint(10000,99999)}"

    # DL number
    dl = f"{state}{rng.randint(10,99)}{rng.randint(1000000,9999999)}"

    # Chassis/Engine (masked)
    chassis = f"{''.join(rng.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',k=17))}"

    return {
        "found":          True,
        "source":         "VAHAN_MOCK",  # Change to VAHAN_API in production
        "plate_number":   plate,
        "owner_name":     f"{fname} {lname}",
        "owner_mobile":   mobile,
        "owner_address":  f"H.No {rng.randint(1,500)}, {area}, Hyderabad - {rng.randint(500001,500096)}",
        "vehicle_make":   make,
        "vehicle_type":   "Motorcycle/Scooter",
        "fuel_type":      rng.choice(["Petrol","Electric"]),
        "color":          rng.choice(["Black","Red","Blue","Silver","White","Grey"]),
        "registration_date": reg_date,
        "fitness_upto":      exp_date,
        "insurance_valid":   exp_date,
        "rc_status":         "Active",
        "dl_number":         dl,
        "chassis_number":    f"****{chassis[-4:]}",
        "engine_number":     f"****{rng.randint(1000,9999)}",
        "noc_status":        "Not Applicable",
        "blacklist_status":  "No",
    }


async def lookup_vehicle(plate: str) -> Dict:
    """
    Main lookup function. Tries real API first, falls back to mock.
    """
    if not plate or len(plate) < 4:
        return {"found": False, "error": "Invalid plate number"}

    plate = plate.upper().replace(" ","").replace("-","")

    # ── Level 2: Surepass ANPR API ────────────────
    # Sign up free at: https://surepass.io/
    surepass_key = getattr(settings, "SUREPASS_API_KEY", None)
    if surepass_key and surepass_key not in ("","your_key_here"):
        try:
            result = await _surepass_lookup(plate, surepass_key)
            if result.get("found"):
                return result
        except Exception as e:
            print(f"⚠  Surepass API: {e}")

    # ── Level 3: Vahan NIC API ────────────────────
    vahan_key = getattr(settings, "VAHAN_API_KEY", None)
    if vahan_key and vahan_key not in ("","your_key_here"):
        try:
            result = await _vahan_lookup(plate, vahan_key)
            if result.get("found"):
                return result
        except Exception as e:
            print(f"⚠  Vahan API: {e}")

    # ── Level 1: Mock data (hackathon demo) ───────
    print(f"ℹ  Using mock Vahan data for {plate} (no API key configured)")
    return _mock_owner_data(plate)


async def _surepass_lookup(plate: str, key: str) -> Dict:
    """
    Surepass ANPR API — works immediately with free tier.
    Sign up: https://surepass.io/rc-details-api/
    """
    url = "https://kyc-api.surepass.io/api/v1/rc/rc-full"
    async with aiohttp.ClientSession() as session:
        async with session.post(url,
            json={"id_number": plate},
            headers={"Authorization": f"Bearer {key}"},
            timeout=aiohttp.ClientTimeout(total=6)
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                if data.get("success"):
                    d = data.get("data",{})
                    return {
                        "found":             True,
                        "source":            "SUREPASS_API",
                        "plate_number":      plate,
                        "owner_name":        d.get("owner_name","Unknown"),
                        "owner_mobile":      d.get("mobile_number","Not available"),
                        "owner_address":     d.get("present_address","Not available"),
                        "vehicle_make":      d.get("maker_model","Unknown"),
                        "vehicle_type":      d.get("vehicle_class_desc","Unknown"),
                        "fuel_type":         d.get("fuel_type","Unknown"),
                        "color":             d.get("color","Unknown"),
                        "registration_date": d.get("registration_date","Unknown"),
                        "fitness_upto":      d.get("fit_upto","Unknown"),
                        "insurance_valid":   d.get("insurance_upto","Unknown"),
                        "rc_status":         d.get("rc_status","Unknown"),
                        "blacklist_status":  d.get("blacklist_status","No"),
                        "chassis_number":    f"****{d.get('chassis_number','????')[-4:]}",
                    }
    return {"found": False}


async def _vahan_lookup(plate: str, key: str) -> Dict:
    """
    Vahan NIC API (MoRTH official).
    Apply: https://vahan.parivahan.gov.in/vahanservice
    """
    url = f"https://vahan.parivahan.gov.in/vahanservice/vahan/api/regn/findbyregn"
    async with aiohttp.ClientSession() as session:
        async with session.get(url,
            params={"regNo": plate, "key": key},
            timeout=aiohttp.ClientTimeout(total=8)
        ) as resp:
            if resp.status == 200:
                d = await resp.json()
                return {
                    "found":             True,
                    "source":            "VAHAN_NIC_API",
                    "plate_number":      plate,
                    "owner_name":        d.get("ownerName","Unknown"),
                    "owner_address":     d.get("permanentAddress","Unknown"),
                    "vehicle_make":      d.get("makerModel","Unknown"),
                    "vehicle_type":      d.get("vehicleClass","Unknown"),
                    "registration_date": d.get("regDate","Unknown"),
                    "fitness_upto":      d.get("fitUpto","Unknown"),
                    "rc_status":         d.get("rcStatus","Unknown"),
                }
    return {"found": False}
