"""
PHASE 0 verification — /api/health must reflect real DB state.
Repro of the bug: previously /api/health always returned status="ok" even when
the DB was down. Now it must return status="degraded" when database is unavailable.

Run:  venv\\Scripts\\python.exe verify_phase0.py
"""
import os
import sys

os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import server  # noqa: E402  (imports app)

app = server.app
client = app.test_client()

resp = client.get("/api/health")
data = resp.get_json()

print(f"HTTP {resp.status_code}")
print(f"  status     = {data.get('status')}")
print(f"  database   = {data.get('database')}")
print(f"  ai_available = {data.get('ai_available')}")

# The bug we are fixing: status must NOT say "ok" while the DB is unavailable.
if data.get("database") == "unavailable":
    assert data.get("status") == "degraded", (
        "BUG: database is unavailable but status is not 'degraded'"
    )
    print("PASS: status correctly reflects DB as 'degraded'")
elif data.get("database") == "connected":
    # If a real DB is reachable, status must be 'ok'.
    assert data.get("status") == "ok"
    print("PASS: DB connected, status 'ok'")
else:
    raise SystemExit(f"Unexpected database state: {data.get('database')}")

print("\nPhase 0 health check: PASS")
