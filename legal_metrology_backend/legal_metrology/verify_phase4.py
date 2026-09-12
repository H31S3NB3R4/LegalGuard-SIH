"""
PHASE 4 verification — frontend / user-facing fixes.
This is a stateless source-inspection script (no live backend / Maps key needed).
It checks that each Phase 4 fix is present in the committed source files.

Fixes verified:
  1. Chatbot: dangerous HTML output sanitized (renderAssistantContent), no
     dangerouslySetInnerHTML remains, localStorage keys standardized
     (user_id/user_role instead of userid/userrole).
  2. Heatmap: .env.example documents the required (non-Gemini) Maps key.
  3. Demo-mode banner added in the frontend root layout (DemoBanner) and the
     browser extension, driven by the backend's /api/health demo_mode flag.
  4. Flipkart graceful degradation: frontend check-compliance + extension no
     longer surface a raw fail-hard error for unsupported (non-Amazon) URLs;
     the misleading 'Flipkart' marketplace label is removed.
  5. Landing video fallback: broken /backgroundvideo4.mp4 is backed by a dark
     gradient fallback on the page/login/signup video wrappers.

Run:  venv\\Scripts\\python.exe verify_phase4.py   (from legal_metrology dir)
"""
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
FE = os.path.join(ROOT, "frontend", "app")
EXT = os.path.join(ROOT, "extension")

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

# ---------------------------------------------------------------
# 1) Chatbot XSS removal + key standardization
# ---------------------------------------------------------------
chat = read(os.path.join("frontend", "app", "chatbot", "page.jsx")) or ""
check("chatbot: renderAssistantContent helper present", "renderAssistantContent" in chat)
check("chatbot: no dangerouslySetInnerHTML remains",
      "dangerouslySetInnerHTML" not in chat,
      "found" if "dangerouslySetInnerHTML" in chat else "")
check("chatbot: renderAssistantContent actually used in render",
      "{renderAssistantContent(message.content)}" in chat)
check("chatbot: localStorage uses user_id (not userid)",
      "user_id" in chat and "getItem('userid')" not in chat)
check("chatbot: localStorage uses user_role (not userrole)",
      "user_role" in chat and "getItem('userrole')" not in chat)

# ---------------------------------------------------------------
# 2) Heatmap Maps key documentation
# ---------------------------------------------------------------
env_ex = read(os.path.join("frontend", ".env.example")) or ""
check(".env.example: exists", env_ex != "")
check(".env.example: documents GOOGLE_MAPS_API_KEY",
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" in env_ex)
check(".env.example: warns Gemini key not a Maps key",
      re.search(r"(?i)gemini.*(not a maps|not.*maps)", env_ex) is not None)

# ---------------------------------------------------------------
# 3) Demo-mode banner (frontend + extension)
# ---------------------------------------------------------------
demo = read(os.path.join("frontend", "app", "DemoBanner.jsx")) or ""
check("DemoBanner: component created", demo != "")
check("DemoBanner: reads demo_mode from /api/health", "demo_mode" in demo)
layout = read(os.path.join("frontend", "app", "layout.js")) or ""
check("layout: imports DemoBanner", "DemoBanner" in layout)
check("layout: renders <DemoBanner />", "<DemoBanner />" in layout)
popup_js = read(os.path.join("extension", "popup.js")) or ""
check("extension popup.js: reads demo_mode", "demo_mode" in popup_js)
popup_html = read(os.path.join("extension", "popup.html")) or ""
check("extension popup.html: demo banner element",
      'id="demoBanner"' in popup_html)

# ---------------------------------------------------------------
# 4) Flipkart graceful degradation
# ---------------------------------------------------------------
cc = read(os.path.join("frontend", "app", "check-compliance", "page.jsx")) or ""
check("check-compliance: graceful non-Amazon guard",
      re.search(r"(?i)flipkart scraping is not yet available", cc) is not None or
      re.search(r"Unsupported marketplace", cc) is not None)
check("check-compliance: marketplace label is Amazon (no faux Flipkart)",
      "marketplace: 'Amazon'" in cc and "? 'Amazon' : 'Flipkart'" not in cc)
content = read(os.path.join("extension", "content.js")) or ""
check("extension content.js: graceful Flipkart message",
      re.search(r"(?i)flipkart scraping is not yet available", content) is not None)

# ---------------------------------------------------------------
# 5) Landing video fallback (page + login + signup)
# ---------------------------------------------------------------
for rel, label in [
    (os.path.join("frontend", "app", "page.js"), "landing page"),
    (os.path.join("frontend", "app", "auth", "login", "page.jsx"), "login page"),
    (os.path.join("frontend", "app", "auth", "signup", "page.jsx"), "signup page"),
]:
    txt = read(rel) or ""
    check(f"video fallback: {label} has gradient fallback on wrapper",
          "linear-gradient" in txt)

# ---------------------------------------------------------------
print("-" * 60)
total = len(passed)
ok = sum(passed)
print(f"RESULT: {ok}/{total} passed")
if ok != total:
    raise SystemExit(1)
print("PHASE 4 verification PASSED")
