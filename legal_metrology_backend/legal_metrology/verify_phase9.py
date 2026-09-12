"""
PHASE 9 verification — RAG grounding of the Legal Metrology answers.

Fixes under test:
  1. New `grounding.py`: deterministic, OFFLINE lexical retrieval over the
     structured REGULATORY_RULES; builds stable rule units (LM-<cat>-<n>),
     retrieves the most relevant rules for a question, formats a bounded
     GROUNDING CONTEXT, builds a citation-mandating prompt, and validates that
     the model cites ONLY retrieved rule IDs (no hallucinated citations).
  2. `comply.chatbot_agent` fallback (the old bare `model.invoke(...)`) now
     grounds its answer in retrieved rules.
  3. `chatbot_compliance.create_user_aware_agent` invocation now injects a
     Legal Metrology GROUNDING CONTEXT into every user-chatbot turn.
  4. No server-import regression (import is still non-hanging) and the live
     Gemini path works and produces no ungrounded citations.

Run:  venv\\Scripts\\python.exe verify_phase9.py
  (online checks are skipped with a clear note when the Gemini key is missing)
"""
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

sys.path.insert(0, SCRIPT_DIR)

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

def io_open(fname):
    with open(os.path.join(SCRIPT_DIR, fname), "r", encoding="utf-8", errors="replace") as f:
        return f.read()

import grounding
import comply

# 1) Offline, deterministic retrieval over the canonical rules
rules = comply.REGULATORY_RULES
units = grounding.flatten_rules(rules)
check("grounding: flatten_rules builds stable units",
      len(units) > 0 and all(u["id"].startswith("LM-") for u in units),
      f"{len(units)} units")

def ids_for(q, category=None):
    return [u["id"] for u in grounding.retrieve_rules(q, rules, category=category, top_k=6)]

food_ids = ids_for("MRP maximum retail price incl of all taxes declared in Indian rupees", category="food")
check("retrieval: MRP question pulls the MRP rule",
      "LM-food-3" in food_ids, str(food_ids))

fssai_ids = ids_for("14 digit FSSAI license number must be shown", category="food")
check("retrieval: FSSAI question pulls the FSSAI rule",
      "LM-food-1" in fssai_ids, str(fssai_ids))

net_qty_ids = ids_for("net quantity declared in metric units grams or millilitres", category="food")
check("retrieval: net-quantity question pulls the net-quantity rule",
      "LM-food-2" in net_qty_ids, str(net_qty_ids))

q = "does the label of this packaged food need to show the manufacturer address?"
r1 = grounding.retrieve_rules(q, rules, top_k=6)
r2 = grounding.retrieve_rules(q, rules, top_k=6)
check("retrieval: deterministic (same query, same order)",
      [u["id"] for u in r1] == [u["id"] for u in r2])

# 2) Context + prompt construction
ctx = grounding.format_context(r1)
check("grounding: context lists retrieved rule IDs",
      all(u["id"] in ctx for u in r1))
prompt = grounding.build_grounded_prompt(q, r1)
check("grounding: prompt has GROUNDING CONTEXT + no-invent instruction",
      "GROUNDING CONTEXT" in prompt and "never invent rule numbers" in prompt)

# 3) Citation validation
found, bogus = grounding.extract_citations(
    "Per [LM-food-3] the MRP must include all taxes.", ["LM-food-3"])
check("citations: valid retrieved ID accepted", found == ["lm-food-3"] and bogus == [])
found2, bogus2 = grounding.extract_citations(
    "As per [LM-food-99] and [LM-skincare-42] you must do X.", ["LM-food-3"])
check("citations: invented IDs flagged ungrounded",
      bogus2 == ["lm-food-99", "lm-skincare-42"], str(bogus2))

# 4) Wiring present in both modules
csrc = io_open("comply.py")
check("comply.py: chatbot fallback uses grounding",
      "build_grounded_prompt(user_message, units)" in csrc)
bsrc = io_open("chatbot_compliance.py")
check("chatbot_compliance.py: grounding injected into agent turn",
      "grounding_context_for(user_message" in bsrc and "GROUNDING CONTEXT" in bsrc)

# 5) Compiles
for f in ("grounding.py", "comply.py", "chatbot_compliance.py", "server.py"):
    check(f"{f}: compiles cleanly", py_compiles(f))

# 6) import server still non-hanging (regression guard)
def _import_server():
    import faulthandler
    faulthandler.dump_traceback_later(25, exit=True)
    import server
    faulthandler.cancel_dump_traceback_later()
    return len(list(server.app.url_map.iter_rules()))
try:
    n_rules = _import_server()
    check("server import non-hanging (regression guard)", True, f"{n_rules} routes")
except SystemExit:
    check("server import non-hanging (regression guard)", False, "stalled in llm/SSL init")
except Exception as e:
    check("server import non-hanging (regression guard)", False, repr(e))

# 7) ONLINE: live grounded answer must not cite rules outside the context.
import os as _os
if comply.AI_AVAILABLE:
    try:
        import threading
        box = {}
        def _live():
            try:
                model = comply.get_llm()
                un = grounding.retrieve_rules("MRP incl of all taxes rules for packaged food",
                                              rules, category="food", top_k=4)
                answer = model.invoke(grounding.build_grounded_prompt(
                    "Must the MRP include 'incl. of all taxes' on a packaged food label?", un))
                text = answer.content if hasattr(answer, "content") else str(answer)
                found, bogus = grounding.extract_citations(text, [u["id"] for u in un])
                box["text"] = text[:300]
                box["bogus"] = bogus
            except Exception as e:
                box["err"] = f"{type(e).__name__}: {str(e)[:140]}"
        t = threading.Thread(target=_live, daemon=True)
        t.start(); t.join(40)
        if "err" in box:
            check("ONLINE: live grounded Gemini answer (no ungrounded citations)", False, box["err"])
        else:
            check("ONLINE: live grounded Gemini answer produced",
                  bool(box["text"]), box["text"])
            check("ONLINE: no hallucinated rule citations",
                  box.get("bogus") == [], str(box.get("bogus")))
    except Exception as e:
        check("ONLINE: live grounded Gemini answer (no ungrounded citations)", False, repr(e))
else:
    print("SKIP - GOOGLE_API_KEY absent; online citation check skipped")

print("-" * 60)
total = len(passed)
ok = sum(passed)
print(f"RESULT: {ok}/{total} passed")
if ok != total:
    raise SystemExit(1)
print("PHASE 9 verification PASSED")