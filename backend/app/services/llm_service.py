"""
VIATRA LLM Challan Generator
Supports: Gemini | Claude | OpenAI | Built-in fallback
Auto-selects working provider — no config needed if key is set.
"""
from app.core.config import settings
from datetime import datetime
from typing import Optional, List

CHALLAN_PROMPT = """You are an official traffic police challan generator for Telangana, India (VIATRA System).
Generate a formal traffic violation notice.

Details:
- Primary Violation: {violation_type}
- All Violations: {all_violations}
- Vehicle Plate: {plate_number}
- Riders: {rider_count}
- Speed: {speed}
- Location: {location}
- Date/Time: {datetime}
- Fine: ₹{fine_amount}
- Legal Section: {legal_section}
- System: VIATRA — Hyderabad Traffic Police

Write a formal challan notice with:
1. Header: TELANGANA TRAFFIC POLICE / VIATRA SYSTEM
2. Challan number (TSTP + timestamp)
3. Violation details + legal section
4. Fine amount + 7-day payment deadline
5. Payment options (online + UPI + court)
6. Brief Telugu translation at bottom

Keep under 280 words. Be formal and official."""


async def generate_challan(
    violation_type:  str,
    rider_count:     int             = 1,
    location:        str             = "Hyderabad, Telangana",
    fine_amount:     int             = 1000,
    plate_number:    Optional[str]   = None,
    speed_kmh:       Optional[float] = None,
    legal_section:   Optional[str]   = None,
    all_violations:  Optional[List]  = None,
) -> str:
    vtype = violation_type.replace("_"," ").title()
    all_v = ", ".join(
        [v.replace("_"," ").title() for v in (all_violations or [violation_type])]
    )

    prompt = CHALLAN_PROMPT.format(
        violation_type = vtype,
        all_violations = all_v,
        plate_number   = plate_number or "Not Detected",
        rider_count    = rider_count,
        speed          = f"{speed_kmh} km/h" if speed_kmh else "N/A",
        location       = location,
        datetime       = datetime.now().strftime("%d %B %Y, %H:%M hrs IST"),
        fine_amount    = fine_amount,
        legal_section  = legal_section or "Motor Vehicles Act 1988",
    )

    # Try each provider in order
    errors = []

    # 1. Gemini
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY not in ("", "your_key_here"):
        try:
            result = await _gemini(prompt)
            if result:
                return result
        except Exception as e:
            errors.append(f"Gemini: {str(e)[:60]}")
            print(f"⚠️  Gemini failed: {str(e)[:80]}")

    # 2. Claude
    if settings.CLAUDE_API_KEY and settings.CLAUDE_API_KEY not in ("", "your_key_here"):
        try:
            result = await _claude(prompt)
            if result:
                return result
        except Exception as e:
            errors.append(f"Claude: {str(e)[:60]}")
            print(f"⚠️  Claude failed: {str(e)[:80]}")

    # 3. OpenAI
    if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY not in ("", "your_key_here"):
        try:
            result = await _openai(prompt)
            if result:
                return result
        except Exception as e:
            errors.append(f"OpenAI: {str(e)[:60]}")
            print(f"⚠️  OpenAI failed: {str(e)[:80]}")

    # 4. Built-in fallback (always works, no API needed)
    if errors:
        print(f"ℹ️  Using built-in challan template (LLM errors: {errors})")
    else:
        print("ℹ️  No LLM API key configured — using built-in template")

    return _builtin_challan(
        vtype, all_v, plate_number, location,
        fine_amount, legal_section, speed_kmh, rider_count
    )


async def _gemini(prompt: str) -> str:
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model    = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(prompt)
    return response.text.strip()


async def _claude(prompt: str) -> str:
    import anthropic
    client  = anthropic.Anthropic(api_key=settings.CLAUDE_API_KEY)
    message = client.messages.create(
        model      = "claude-haiku-4-5-20251001",
        max_tokens = 600,
        messages   = [{"role": "user", "content": prompt}]
    )
    return message.content[0].text.strip()


async def _openai(prompt: str) -> str:
    from openai import OpenAI
    client   = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model      = "gpt-4o-mini",
        max_tokens = 600,
        messages   = [{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()


def _builtin_challan(
    vtype, all_violations, plate, location,
    fine, section, speed, riders
) -> str:
    now        = datetime.now()
    challan_no = f"TSTP{now.strftime('%Y%m%d%H%M%S')}"
    speed_str  = f"{speed} km/h" if speed else "N/A"

    # Telugu translation map
    telugu = {
        "No Helmet":      "హెల్మెట్ లేకుండా వాహనం నడపడం",
        "Triple Riding":  "ఒక వాహనంపై ముగ్గురు వ్యక్తులు",
        "Signal Jumping": "ఎర్ర సిగ్నల్ దాటడం",
        "Lane Violation": "లేన్ ఉల్లంఘన",
        "Wrong Way":      "తప్పు దిశలో వాహనం నడపడం",
        "Overspeeding":   "అతి వేగంగా వాహనం నడపడం",
        "Both":           "బహుళ ఉల్లంఘనలు",
    }
    telugu_desc = telugu.get(vtype, "ట్రాఫిక్ నిబంధనల ఉల్లంఘన")

    return f"""TELANGANA TRAFFIC POLICE
VIATRA — VIOLATION INTELLIGENCE SYSTEM
{'━'*42}
CHALLAN NO  : {challan_no}
DATE / TIME : {now.strftime('%d %B %Y, %H:%M hrs IST')}
LOCATION    : {location}
{'━'*42}
VEHICLE DETAILS
Vehicle No  : {plate or 'Not Detected'}
Riders      : {riders}
Speed       : {speed_str}
{'━'*42}
VIOLATION DETAILS
Violation   : {vtype}
All Charges : {all_violations}
Legal Ref   : {section or 'Motor Vehicles Act 1988'}
{'━'*42}
FINE DETAILS
Amount Due  : ₹{fine}
Pay Within  : 7 days from date of issue
{'━'*42}
PAYMENT OPTIONS
• Online  : echallan.tspolice.gov.in
• UPI     : tspolice@upi
• In Person: Nearest Traffic Police Court
{'━'*42}
తెలుగు అనువాదం:
వాహనం: {plate or 'గుర్తించబడలేదు'}
ఉల్లంఘన: {telugu_desc}
జరిమానా: ₹{fine}
7 రోజులలో చెల్లించండి.
{'━'*42}
Digitally issued by VIATRA AI System
Hyderabad Traffic Police, Telangana""".strip()
