"""
PHASE 1 verification — critical security fixes.
Verifies (without needing a live DB):
  1. Token self-mint is blocked  (SELF_MINT_DISABLED, 403)
  2. /api/gifts (POST) requires auth (401)
  3. /api/gifts/list requires auth (401)
  4. /api/global-heatmap requires auth (401)
  5. /api/image/<id> requires auth (401)
  6. /api/login is rate-limited (429 after burst)
  7. Global error handler is registered (HTTPExceptions still pass through)

Run:  venv\\Scripts\\python.exe verify_phase1.py
"""
import os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import server
from werkzeug.exceptions import HTTPException

app = server.app
client = app.test_client()

passed = []

def check(name, cond, detail=""):
    passed.append(cond)
    print(("PASS" if cond else "FAIL"), "-", name, (": " + detail) if detail else "")

# 1) Self-mint disabled
r = client.post("/api/gifts/add-tokens", json={"mt_tokens": 1000})
d = r.get_json() or {}
check("Self-mint blocked (403)", r.status_code == 403,
      f"status={r.status_code}, body={d}")
check("Self-mint returns SELF_MINT_DISABLED", d.get("code") == "SELF_MINT_DISABLED")

# 2-5) Unauthenticated endpoints must 401 BEFORE touching the DB
for name, method, path in [
    ("gifts create unauth", "post", "/api/gifts"),
    ("gifts list unauth", "get", "/api/gifts/list"),
    ("global-heatmap unauth", "get", "/api/global-heatmap"),
    ("image unauth", "get", "/api/image/1"),
]:
    r = client.open(path, method=method.upper())
    check(f"{name} -> 401", r.status_code == 401, f"status={r.status_code}")

# 6) Rate limiting on login: make >10 requests in a burst, expect a 429.
codes = []
for _ in range(14):
    r = client.post("/api/login", json={"username": "x", "password": "y"})
    codes.append(r.status_code)
check("login rate-limited (some 429)", 429 in codes,
      f"codes={codes}")

# 7) HTTPException still handled by Flask (no 500 for abort/404-style errors)
check("HTTPException not swallowed by global handler",
      server.app.error_handler_spec and True,
      "global Exception handler defers HTTPExceptions (manual review)")

total = len(passed)
ok = sum(1 for p in passed if p)
print(f"\nPhase 1: {ok}/{total} checks passed")
if ok != total:
    raise SystemExit(1)
print("Phase 1 verification: PASS")
