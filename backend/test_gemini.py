"""
Run this to test your Gemini API key.
Usage: python test_gemini.py YOUR_GEMINI_KEY
"""
import sys, os

key = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GEMINI_API_KEY","")

if not key:
    # Try .env
    if os.path.exists(".env"):
        for line in open(".env"):
            if line.startswith("GEMINI_API_KEY="):
                key = line.split("=",1)[1].strip()
                break

if not key or key == "your_gemini_key_here":
    print("❌ No Gemini key found!")
    print("   Get one FREE at: https://aistudio.google.com/app/apikey")
    sys.exit(1)

print(f"🔑 Testing key: {key[:12]}...")

try:
    import google.generativeai as genai
    genai.configure(api_key=key)
    model    = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content("Say exactly: VIATRA system online!")
    print(f"✅ Gemini works! Response: {response.text.strip()}")
    print(f"\n✅ Your key is valid. Make sure .env has:")
    print(f"   GEMINI_API_KEY={key}")
except Exception as e:
    print(f"❌ Gemini error: {e}")
    print("\n   Common fixes:")
    print("   1. Key may be for Google Cloud (not AI Studio) — get from aistudio.google.com")
    print("   2. Key may be restricted — remove IP restrictions in Google Console")
    print("   3. Billing not enabled — AI Studio free tier needs no billing")
    print("   4. Key copied with extra spaces — check for spaces around = in .env")
