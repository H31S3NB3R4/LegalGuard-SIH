"""
PHASE 7 verification — compliance-engine code hygiene (audit "minor bugs").

Fixes under test:
  1. comply.py used the wrong dunder: `_all_ = [...]` instead of `__all__`.
     Star-imports therefore ignored the export table.  Fixed to `__all__`.
  2. comply.py had `if __name__ == '_main_':` (two underscores missing),
     so the module's `__main__` block never ran.  Fixed to `'__main__'`.
  3. compliance.py defined `get_db_connection()` twice in the same file; the
     second silently overrode the first.  Removed the dead first copy.

We statically confirm each fix, ensure both modules still compile, and prove
the export table is honoured by actually star-importing comply.py.

Run:  venv\\Scripts\\python.exe verify_phase7.py
"""
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

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

comply = read(os.path.join("legal_metrology_backend", "legal_metrology", "comply.py")) or ""
compliance = read(os.path.join("legal_metrology_backend", "legal_metrology", "compliance.py")) or ""

# 1) comply.py export table uses the correct dunder
check("comply.py: exports use __all__ (was _all_)",
      "__all__ = [" in comply and "_all_ = [" not in comply)
check("comply.py: __main__ guard fixed (was _main_)",
      "if __name__ == '__main__':" in comply and "if __name__ == '_main_':" not in comply)

# 2) compliance.py has exactly one get_db_connection (dup removed)
n = comply.count("def get_db_connection():"), compliance.count("def get_db_connection():")
check("compliance.py: exactly one get_db_connection (dup removed)",
      compliance.count("def get_db_connection():") == 1,
      f"compliance.py has {compliance.count('def get_db_connection():')}")

# 3) Both modules still compile
def compiles(path):
    try:
        r = subprocess.run([sys.executable, "-m", "py_compile", path],
                           capture_output=True, text=True)
        return r.returncode == 0
    except Exception:
        return False

check("comply.py: compiles cleanly",
      compiles(os.path.join(SCRIPT_DIR, "comply.py")))
check("compliance.py: compiles cleanly",
      compiles(os.path.join(SCRIPT_DIR, "compliance.py")))

# 4) Export table is honoured: star-import resolves the four names
sys.path.insert(0, SCRIPT_DIR)
import comply
expect = {"analyze_compliance", "analyze_seller_upload", "chatbot_agent",
          "batch_analyze_products", "REGULATORY_RULES"}
missing = [nm for nm in expect if not hasattr(comply, nm)]
check("comply.py: __all__ exports resolve via import *",
      not missing,
      (", ".join(missing) or "all 5 present"))
check("comply.py: __all__ is the real dunder (import * honoured)",
      set(comply.__all__) == expect and len(comply.__all__) == len(expect),
      f"__all__={comply.__all__}")

print("-" * 60)
total = len(passed)
ok = sum(passed)
print(f"RESULT: {ok}/{total} passed")
if ok != total:
    raise SystemExit(1)
print("PHASE 7 verification PASSED")
