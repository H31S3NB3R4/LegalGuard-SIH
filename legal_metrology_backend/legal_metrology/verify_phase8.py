"""
PHASE 8 verification — database bring-up + non-hanging server import.

Fixes under test:
  1. A Docker MySQL (root docker-compose.yml) now serves `amazon_scraper_db`
     on host port 3307 with the credentials already in backend `.env`
     (legalguard / legalguard#2026). Verified: MySQL 8.x, all 6 schema tables.
  2. `import server` used to HANG at module level: chatbot_compliance.py and
     comply.py eagerly constructed ChatGoogleGenerativeAI, and the google-genai
     client's ssl.create_default_context() stalled in network-restricted
     environments, so Flask never bound its port. Fixed with lazy,
     thread-guarded get_llm() (10s timeout) + demo fallback. Verified: server
     imports in seconds, 27 routes register.
  3. The app reaches the live DB: /api/health returns 200 with
     database=connected, status=ok.

Run:  venv\\Scripts\\python.exe verify_phase8.py
"""
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
EXPECTED_TABLES = {"users", "products", "images", "selleractivity", "gifts",
                   "gifts_redeemed"}

passed = []
def check(name, cond, detail=""):
    passed.append(cond)
    print(("PASS" if cond else "FAIL"), "-", name, (": "+detail) if detail else "")

def py_compiles(fname):
    p = os.path.join(SCRIPT_DIR, fname)
    try:
        r = subprocess.run([sys.executable, "-m", "py_compile", p],
                           capture_output=True, text=True)
        return r.returncode == 0
    except Exception:
        return False

# 1) import server must NOT hang and must register all routes
result = {}
def _import_server():
    import faulthandler
    faulthandler.dump_traceback_later(25, exit=True)
    import server
    faulthandler.cancel_dump_traceback_later()
    result["server"] = server
    result["rules"] = len(list(server.app.url_map.iter_rules()))
    result["cc"] = server.chatbot_compliance
    result["comply"] = server.comply

try:
    _import_server()
    check("import server (no hang, faulthandler-guarded)", True)
    check("server: 27 routes registered", result["rules"] == 27,
          f"{result['rules']} routes")
except SystemExit:
    check("import server (no hang, faulthandler-guarded)", False,
          "stalled in ssl/llm init and was dumped")
except Exception as e:
    check("import server (no hang, faulthandler-guarded)", False, repr(e))

# 2) LLM init is lazy: module-level `llm` is None after import, get_llm exists
if "server" in result:
    for mod_name, mod in (("chatbot_compliance", result["cc"]),
                          ("comply", result["comply"])):
        check(f"{mod_name}: get_llm() defined (lazy init)",
              hasattr(mod, "get_llm") and callable(mod.get_llm))
        check(f"{mod_name}: module-level llm stays None at import (no eager build)",
              getattr(mod, "llm", "missing") is None)

# 3) App reaches the live Docker DB
if "server" in result:
    client = result["server"].app.test_client()
    r = client.get("/api/health")
    health = r.get_json() if r.is_json else {}
    check("GET /api/health -> 200", r.status_code == 200, f"HTTP {r.status_code}")
    check("health: database connected", health.get("database") == "connected",
          str(health.get("database")))
    check("health: status ok", health.get("status") == "ok",
          str(health.get("status")))

    conn = result["server"].get_db_connection()
    if conn is None:
        check("direct DB connect via get_db_connection", False)
    else:
        cur = conn.cursor()
        cur.execute("SELECT VERSION();")
        ver = cur.fetchone()[0]
        cur.execute("SHOW TABLES;")
        tabs = {x[0] for x in cur.fetchall()}
        conn.close()
        missing = sorted(EXPECTED_TABLES - tabs)
        check("direct DB connect via get_db_connection", True, f"MySQL {ver}")
        check("schema: all 6 tables present", not missing,
              (", ".join(missing) or "users/products/images/selleractivity/gifts/gifts_redeemed"))

# 4) Modules compile cleanly
for fname in ("server.py", "chatbot_compliance.py", "comply.py", "compliance.py"):
    check(f"{fname}: compiles cleanly", py_compiles(fname))

print("-" * 60)
total = len(passed)
ok = sum(passed)
print(f"RESULT: {ok}/{total} passed")
if ok != total:
    raise SystemExit(1)
print("PHASE 8 verification PASSED")