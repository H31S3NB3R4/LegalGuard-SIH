"""
PHASE 6 verification — heatmap wiring.
The heatmap failed to render because the frontend env used a Gemini 'AQ...' key
instead of a Google Maps key (audit PHASE 13). Phase 4 added a tracked
.env.example and removed the bad key; here we verify the wiring for a real Maps
key and surface the remaining external blocker.

Verified:
  1. frontend/.env.local holds a Maps key in the correct 'AIza...' format
     (gitignored -> the key itself is NEVER committed).
  2. entities + products pages read NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and feed it
     to @react-google-maps/api (GoogleMap) and the Geocoding API.
  3. The graceful "API key not configured" fallback is intact in entities.
  4. The external billing blocker is documented so the map cannot render until
     the GCP project enables Billing + the Maps/Geocoding APIs.

Run:  venv\\Scripts\\python.exe verify_phase6.py
"""
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
FE = os.path.join(ROOT, "frontend")

passed = []
def check(name, cond, detail=""):
    passed.append(cond)
    print(("PASS" if cond else "FAIL"), "-", name, (": "+detail) if detail else "")

def read(rel):
    p = os.path.join(ROOT, rel)
    if not os.path.isfile(p):
        return None
    with open(p, "r", encoding="utf-8", errors="replace") as f:
        return f.read()

env_local = read(os.path.join("frontend", ".env.local")) or ""
entities = read(os.path.join("frontend", "app", "entities", "page.tsx")) or ""
products = read(os.path.join("frontend", "app", "products", "page.jsx")) or ""

# 1) Key present + valid Maps (AIza) format in the gitignored local env
m = re.search(r'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=(\S+)', env_local)
key = m.group(1) if m else ""
check(".env.local: Maps key present", bool(key))
check(".env.local: key is AIza format (not Gemini AQ)",
      key.startswith("AIza") and not key.startswith("AQ"))
# never commit the key: gitignore must keep .env.local untracked
env_ignored = os.popen("cd " + ROOT + r" && git check-ignore frontend/.env.local").read().strip()
check(".env.local is gitignored (key not committed)",
      "frontend/.env.local" in env_ignored)

# 2) Both pages consume the key
for name, src in [("entities/page.tsx", entities), ("products/page.jsx", products)]:
    check(f"{name}: reads NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
          "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" in src)
check("entities: passes key to GoogleMap via googleMapsApiKey",
      "googleMapsApiKey" in entities and "GOOGLE_MAPS_API_KEY || ''" in entities)
check("entities: uses @react-google-maps/api HeatmapLayer", "HeatmapLayer" in entities)
check("products: geocodes via Geocoding API with key",
      "maps/api/geocode/json" in products and "key=${GOOGLE_MAPS_API_KEY}" in products)

# 3) Graceful fallback intact
check("entities: fallback banner when key missing",
      "API key not configured" in entities)

# 4) Billing blocker is documented in FIXES.md (external, cannot be auto-fixed)
fixes = read("FIXES.md") or ""
check("FIXES.md: billing blocker documented",
      "billing" in fixes.lower() and "REQUEST_DENIED" in fixes)

print("-" * 60)
total = len(passed)
ok = sum(passed)
print(f"RESULT: {ok}/{total} passed")
if ok != total:
    raise SystemExit(1)
print("PHASE 6 verification PASSED")
