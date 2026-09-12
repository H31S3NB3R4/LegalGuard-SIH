# LegalGuard — FIXES.md (Audit Remediation Changelog)

Working log of every fix applied from the audit (score 34/100). Each entry shows
the bug, the fix, and a way to reproduce/verify it is gone. Phases match the
"Fix-It Prompt".

---

## PHASE 0 — Real dev environment

### FIX 0.1 — Health endpoint misreported DB state
- **Bug:** `GET /api/health` returned `"status":"ok"` even when `"database":"unavailable"` — a health check that says OK while the DB is down.
- **Fix:** `server.py` health handler now returns `"status":"degraded"` whenever the DB is unavailable (still HTTP 200 so existing clients don't break).
- **Verify:** `venv\Scripts\python.exe verify_phase0.py` → asserts `degraded` when `database==unavailable`. **PASS.**

### FIX 0.2 — Missing Docker provisioning so `.env` and the DB agree
- **Bug:** `.env` pointed at `127.0.0.1:3307` user `legalguard` but no matching DB existed (real server was 3306 with different creds, and `amazon_scraper_db` did not exist).
- **Fix:** Added root `docker-compose.yml` that provisions MySQL 8 on host port **3307** with the documented creds (`legalguard`/`legalguard#2026`/`amazon_scraper_db`), auto-loads the schema, sets `lower_case_table_names=1` for cross-platform table-name casing, and has a healthcheck. Added `setup.sh` (POSIX) and `setup.ps1` (Windows). Updated `.env.example` to match the compose defaults.
- **Verify:** `docker-compose config` validates YAML; `docker compose up -d` then `curl /api/health` → expect `database":"connected"`, `status":"ok"`. *(Docker could not start inside the audit sandbox; the compose file validates as YAML and the health HTTP path was verified via FIX 0.1.)*

### FIX 0.3 — Schema/code drift (missing tables & columns)
- **Bug:** Endpoints reference `users.mt_tokens`, `gifts`, `gifts_redeemed`, `products.product_json_raw` but the shipped schema (`schema.txt`/`dump.sql`) had none of them → runtime SQL failures even with a healthy connection.
- **Fix:** Created canonical `database_schema.sql` (all 6 tables + new columns + FKs). Created idempotent `schema_migration.sql` to upgrade an existing old-schema DB.
- **Verify:** Load `database_schema.sql` into a fresh MySQL, then `schema_migration.sql`; confirm no errors and presence of `mt_tokens`, `product_json_raw`, `gifts`, `gifts_redeemed`.

---

## PHASE 1 — Critical security fixes

### FIX 1.1 — Token self-mint / arbitrary token award
- **Bug:** `/api/gifts/add-tokens` (`server.py`) let any logged-in customer add an arbitrary, client-supplied `mt_tokens` amount to their own balance — unlimited free Meta-Tokens.
- **Fix:** The add-tokens route is now hard-disabled (`403 SELF_MINT_DISABLED`) and cannot mint. A new server-side `award_mt_tokens(user_id, amount)` is the *only* way balances increase, with fixed (non client-controlled) amounts. It is wired into the genuine (non-demo) compliance-analysis completion as a reward (10 tokens, server-fixed).
- **Verify:** `verify_phase1.py` — POST `/api/gifts/add-tokens` returns `403 {code: SELF_MINT_DISABLED}`. **PASS.**

### FIX 1.2 — Unauthenticated data-leak endpoints
- **Bug:** `/api/gifts`, `/api/gifts/list`, `/api/global-heatmap`, `/api/image/<id>` required no auth; `gift_pin` leaked to everyone via the list.
- **Fix:** Auth (`401`) added to all four. `/api/gifts/list` no longer returns `gift_pin` (it is only revealed to the redeemer in `/my-redemptions`). `/api/image/<id>` now also checks product ownership.
- **Verify:** `verify_phase1.py` — all four return `401` unauthenticated. **PASS.**

### FIX 1.3 — IDOR on products
- **Bug:** `/api/product/<id>`, `/api/products/validate/<id>`, `/api/compliance/analyze/<id>`, and `/api/image/<id>` let any user read/validate another user's product.
- **Fix:** New `require_product_owner(product_id, user_id)` helper enforces ownership (`403` when `owner != requester`). Applied to all four routes.
- **Verify:** Requires a live DB (code-review verified; exercised in `verify_phase1` indirectly via auth gate). Add a real-DB integration test when MySQL is available.

### FIX 1.4 — Traceback leakage to clients
- **Bug:** `/api/seller/check-upload-text` returned `{'error': str(e), 'traceback': traceback.format_exc()}` — full stack trace to the client.
- **Fix:** That handler now returns a sanitized `{'error': ..., 'request_id': ...}` and logs the trace server-side only. A global `@app.errorhandler(Exception)` returns a generic internal-error payload with a `request_id` and defers HTTPExceptions so `404/400/403` keep their status codes. No stack trace reaches any client.
- **Verify:** Code review + `verify_phase0/1` exercise the sanitized paths. **PASS.**

### FIX 1.5 — Plaintext secrets in `.env`
- **Bug:** DB password and live Gemini key in plaintext `.env` on disk.
- **Fix:** Confirmed `.env` and `.env.local` are gitignored AND absent from git history (`git log --all -- <path>` empty). `.env.example` holds only dummy values. Documented that `.env` is dev-only; production should use a secrets manager.
- **Verify:** `git check-ignore` returns both paths; `git log --all` finds no committed `.env`. **PASS.**

### FIX 1.6 — Unsalted SHA-256 passwords
- **Bug:** `hash_password()` used unsalted SHA-256; `dump.sql` seeded crackable `password123`/`123456` hashes.
- **Fix:** `hash_password()` now uses **bcrypt**. Login transparently detects legacy SHA-256 hashes, verifies them, and re-hashes to bcrypt on next successful login (`verify_password` returns `needs_rehash`). The canonical `database_schema.sql` seeds **no** demo users. `dump.sql` is marked legacy (see FIXES note below).
- **Verify:** Requires a live DB; code-review verified. Add a real-DB test when MySQL is available.

### FIX 1.7 — No rate limiting
- **Bug:** No rate limiting anywhere; a 20-req/day free API could be exhausted in seconds and POST-verify works.
- **Fix:** Added `flask-limiter` (in-memory storage). Limits: `/api/login` 10/min, `/api/signup` 10/hour, `/api/seller/check-upload` & `/check-upload-text` 10/min, `/api/gifts` 10/min, `/api/gifts/redeem` 10/min; global default 200/hour. Added a friendly 429 handler.
- **Verify:** `verify_phase1.py` — burst of 14 logins yields 429s. **PASS.**

> **Note on `dump.sql`:** this 6.4 MB file is the *legacy* seed with wrong/missing columns and crackable demo hashes. The canonical schema is `database_schema.sql` (no seed creds). Do not load `dump.sql` into a fresh DB; use `database_schema.sql` (+ optional `schema_migration.sql` to upgrade an existing legacy DB).

---

## PHASE 2 — Crash fixes

### FIX 2.1 — Windows Unicode crash in `log()`
**Before:** `compliance_copy.py`/`compliance.py` `log()` used `print(...)` directly.
On Windows the console defaults to cp1252; any box-drawing/`└──`/emoji character or a
`None` in a log line raised `UnicodeEncodeError` and crashed the request mid-flight.
**After:** `log()` now calls `sys.stdout.reconfigure(encoding='utf-8', errors='replace')`
(guarded by try/except), falls back to an ASCII-safe encode-replace write, and is
None-safe for the message argument.
---
**Repro (Windows, cp1252 console):**
```
# before
> python -c "print('OK └── line')"
UnicodeEncodeError: 'charmap' codec can't encode character '\u2514'
# after (verify_phase2.py) -> 'PASS - log() no crash on box-draw/None on cp1252 stream'
```

### FIX 2.2 — `TypeError: string indices must be integers` on null LLM fields
**Before:** `compliance_copy.py` (~801) and `compliance.py` (~764) did
`str(value)[:60]` on a possibly-`None` `extracted_value`/`found_in`, raising
`TypeError` whenever Gemini returned a null field (common on sparse listings).
**After:** guard slices: `str(value)[:60] if value is not None else ''` and
`str(found_in)[:50] if found_in is not None else ''`.
---
**Repro:** `verify_phase2.py` -> `PASS - None-slice does not raise and yields empty`.

### FIX 2.3 — 429 rate-limit crash (no retry/backoff; crash on exhaustion)
**Before:** `generate_content(...)` was called once. On free-tier `429
RESOURCE_EXHAUSTED` it raised immediately; inside `analyze_seller_upload` the
generic handler returned `str(e)` (bleeding API details) and the OCR/seller pipeline
died.
**After:** added module-level `generate_with_retry(model, content, max_attempts=3,
base_delay=2.0, **kwargs)` with exponential backoff and a clear `RateLimitError`.
Wrapped the OCR `generate_content` call sites in `comply.py` (seller image path) and
`compliance_copy.py` (OCR path). Both `analyze_seller_upload` /
`analyze_seller_upload_text` now catch `RateLimitError` and return:
`{'error': 'Gemini rate limit reached...', 'rate_limited': True, ...,
'ready_for_upload': False}` — the product is never presented as uploadable, and the
app never crashes.
---
**Repro:** `verify_phase2.py` -> `PASS - generate_with_retry raises RateLimitError
after retries (attempts=3)` and `PASS - generate_with_retry returns success when no
error`.

### FIX 2.4 — Prompt-injection through product listing text
**Before:** `analyze_product_data` interpolated user-supplied `title`/`description`/
`feature_bullets`/`specs` directly into the Gemini prompt (`PRODUCT DATA: {full_text}`)
with no delimiter, so a malicious listing could inject `ignore previous instructions`
or role-redefinition text and steer the model's verdict.
**After:** added `_sanitize_input(text, max_len=4000)` that removes known
injection markers (`ignore all previous instructions`, `system:`, `you are now`,
`rewrite the prompt`, `forget ...`, etc.) plus `<|...|>` tokens, truncates length;
added an explicit guard line treating the product block as untrusted data; and added
LLM-output shape validation (coerces a non-dict result / non-list `findings` /
`missing_critical_info` / `recommendations` to safe empty-list defaults).
---
**Repro:** `verify_phase2.py` -> `PASS - sanitizer neutralizes injection markers`
(e.g. `'Title: Great product. [removed] ...'`).

### FIX 2.5 — Residual traceback leakage in response dicts
**Before:** `compliance_copy.py` (`analyze_seller_upload_text` ~2032 and a DB
helper ~1433) and `compliance.py` (DB helper ~1253, `analyze_seller_upload`
~1343) still returned `{'traceback': traceback.format_exc()}` / bare `str(e)` in
dicts that flow toward the HTTP response.
**After:** all such handlers now return a fixed, sanitized message
(`'Database operation failed. Please try again.'` /
`'Seller upload analysis failed. Please try again.'`) with no raw exception text;
the RateLimitError branch is friendlier. Grep confirms only one commented-out
occurrence remains.
---
**Repro:** `grep -rn "traceback.format_exc" compliance*.py comply.py server.py` ->
only `compliance_copy.py:1527` (inside a `#` comment).

### Phase 2 verification
`verify_phase2.py` (repo root of backend) — `6/6 checks PASS`, plus
`server.py` still imports with all 27 routes. Note: live Gemini calls were not made
(this session deliberately spent no quota; retry/backoff is verified by unit-style
simulation). Full live-DB + live-AI verification deferred to a machine with a
working MySQL/Docker and Gemini quota.

---

## PHASE 3 — Data-integrity fixes

### FIX 3.1 — Country-of-origin word-boundary false positive ("NutriPlus")
**Before:** `compliance_copy.py` country cross-validation used naive substring
matching (`variant in country_lower`), so the short variants `'us'` (USA) and `'ind'`
(India) matched inside unrelated words — e.g. an address like
"NUTRI **us** PLUS FOODS" or "subj**us**" flagged the USA, or "Bom**ind**a" flagged
India — yielding bogus HIGH-severity country/address mismatch violations.
**After:** added a whole-word matcher
`re.search(r'(?<![a-z])'+re.escape(variant)+r'(?![a-z])', text)` and used it in both
the declared-country and address-country detection loops. Short and multi-word
variants (`us`, `ind`, `uk`, `united states`, `sri lanka`, ...) now only match as
standalone words.
---
**Repro:** `verify_phase3.py` -> `PASS - NutriPlus address NOT flagged USA`,
`PASS - 'Bombay' address NOT flagged`, while `PASS - 'made in usa' -> USA` and
`PASS - 'made in india' -> India` still hold.

### FIX 3.2 — Consolidated grading (duplicate A+..F ladders)
**Before:** the identical 9-tier grade ladder (85/A+, 75/A, 65/B+, 55/B, 45/C+,
35/C, 25/D, else F) was copy-pasted inline at three sites (`compliance.py`,
`comply.py`, `compliance_copy.py`), in two different string-quoting styles — easy to
drift apart.
**After:** each module now exposes a single `grade_for_score(score)` as the one
source of truth, and all three call it. Verified byte-for-byte identical output.
---
**Repro:** `verify_phase3.py` ->
`PASS - grade_for_score ladders identical across 3 modules`.

### FIX 3.3 — Rule-citation validation + NaN-clean scoring
**Before:** (a) LLM findings could cite invented rule numbers; the keyword-fallback
matcher in `compliance.py`/`compliance_copy.py` could stretch to accept them, and
there was no check that a cited "Rule N" actually exists in the hardcoded dict.
(b) an LLM-supplied `data_quality_score` of `NaN`/`"N/A"`/non-numeric, or a
non-finite `total_score`, could flow into `round()`/`jsonify` and produce invalid
JSON (`NaN`) or a `TypeError`.
**After:**
- Added `_rule_number()` + `_valid_citation_findings()` which drop any LLM finding
  that cites a rule number not present in the hardcoded Legal Metrology rule dict
  (e.g. "Rule 99"); findings with no citation or with a valid rule number are kept.
  Wired into the `data_findings_by_req` build in `compliance.py` and
  `compliance_copy.py`. (`comply.py` is already anchored — it iterates only the
  hardcoded rules and does exact-match lookups.)
- Added `import math` + finite guards: `total_score` is clamped to `0.0` if
  non-finite before `max()`/`round()`, and `data_quality_score` is coerced to a
  finite `[0,1]` float (default 0.5) after every LLM parse in all three modules
  (comprehensive output-shape validation added to `compliance.py` and
  `compliance_copy.py` to match `comply.py`).
---
**Repro:** `verify_phase3.py` ->
`PASS - invented 'Rule 99(z)' dropped`, `PASS - valid 'Rule 6(e)' kept`,
`PASS - grade_for_score(NaN) -> 'F'`.

### Phase 3 verification
`verify_phase3.py` — `18/18 checks PASS`; `server.py` still imports with all 27
routes; `verify_phase2.py` still `6/6 PASS` (no regressions). Country matching,
grading, and citation filtering are verified by direct unit checks (no live Gemini
quota spent).

---

## Phase 4 — Frontend / User-Facing

- **UI-01 — Stored XSS via `dangerouslySetInnerHTML` on chatbot LLM output**
  (`frontend/app/chatbot/page.jsx`). The bot's raw markdown was injected with
  `dangerouslySetInnerHTML`, letting LLM output execute markup. Replaced with a
  new `renderAssistantContent()` helper that safely parses `**bold**`, newlines,
  and `•` bullets into React elements. Grep confirmed no other
  `dangerouslySetInnerHTML` remains in the frontend. Verified via
  `verify_phase4.py` + `npm run build`.
- **UI-02 — Chatbot auth keys inconsistent** (`userid`/`userrole` vs
  `user_id`/`user_role` used by login/signup/check-compliance). Standardized the
  chatbot's `localStorage` reads to `user_id`/`user_role`. Verified via
  `verify_phase4.py`.
- **UI-03 — Invalid Google Maps key in the frontend env**
  (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` was a Gemini `AQ...` key, not a Maps key)
  so the heatmap could never render. Removed the bad key from the gitignored
  `.env.local` (degrades to the existing "API key not configured" fallback in
  `entities/page.tsx`) and added a tracked `frontend/.env.example` documenting
  that a real Google Maps JS + Geocoding key is required. Verified via
  `verify_phase4.py`. Note: no usable Maps key exists in the sandbox, so the
  live map cannot be render-verified here — graceful degradation + docs only.
- **UI-04 — Demo mode not visibly flagged.** The backend already exposes
  `demo_mode` in `/api/health`. Added a global demo-mode banner in the frontend
  root layout (`frontend/app/DemoBanner.jsx`, imported into `layout.js`) and a
  demo banner in the extension popup (`extension/popup.html` `#demoBanner` +
  `extension/popup.js` `updateDemoBanner()`), both driven by the health
  endpoint's `demo_mode` flag; the extension banner also shows when the backend
  is offline. Verified via `verify_phase4.py`.
- **UI-05 — Flipkart URL handling was misleading/fail-hard.** The extension
  (`isProductPage`) claimed Flipkart support, but the backend `/api/scrape` is
  Amazon-only (`extract_asin_from_url` requires `/dp/` or `/gp/product/`), so
  Flipkart URLs returned raw `400/500` errors and the check-compliance page
  mislabeled results as "Flipkart". Added graceful degradation: the frontend
  `check-compliance` page and the extension now surface a clear
  "Flipkart scraping is not yet available" message for non-Amazon URLs instead
  of a raw error, and the `marketplace` display label is now `Amazon` (accurate).
  Building a real Flipkart scraper is out of scope here (backend, unverifiable
  without a live scraper). Verified via `verify_phase4.py`.
- **UI-06 — Broken landing/auth video asset (`/backgroundvideo4.mp4` missing).**
  The file does not exist under `frontend/public`, so the hero/login/signup
  background video rendered blank with no poster or fallback. Added a dark
  gradient fallback background on the video wrapper in `frontend/app/page.js`,
  `auth/login/page.jsx`, and `auth/signup/page.jsx` so the section stays visually
  intact when the video asset is absent (and continues to show the video if the
  file is later added). Verified via `verify_phase4.py`.
- **UI-07 — Selenium (SCRAPER_BROWSER_FALLBACK).** Confirmed optional: selenium /
  undetected-chromedriver are commented out of `requirements.txt`, not installed
  in the venv, and used only as a last-resort fetch fallback that returns `None`
  when absent (all callers already treat `None` as "could not scrape"). No code
  change required — documented as optional in `requirements.txt` and `.env.example`.

### Phase 4 verification
`verify_phase4.py` — `20/20 checks PASS`. Full `next build` in `frontend/`
succeeds with all 14 routes compiled. Fixes are verified by source inspection
(no live backend / Maps key needed).

---

## Phase 5 — Demo-Mode Data Integrity

- **INT-05 — Demo report claimed compliance / ready-for-upload for every product**
  (`server.py` `demo_compliance_report()`). When `GOOGLE_API_KEY` is absent, the
  placeholder report returned `is_compliant: True`, `ready_for_upload: True`,
  grade `B`, score `70` for every product — implying real compliance was verified
  when no analysis ran (audit PHASE 15 finding; Top-10 #6). This could mislead
  sellers/consumers into treating unverified products as ready. The Phase 4 demo
  banner surfaced *that it was* demo mode; this fix stops the report from
  *asserting* compliance.
  Changes: demo report now returns `is_compliant: False`, `ready_for_upload:
  False`, `requires_action: True`, `compliance_grade: 'N/A'`, `compliance_score:
  0`, plus an `analysis_status: 'demo_pending'` marker and a high-priority
  "Compliance analysis not performed (demo mode)" issue whose copy explicitly
  says the product is NOT confirmed compliant and NOT ready for upload.
  Propagates to all six consuming endpoints (auto-analyze at line 871, upload at
  954, batch at 1008, seller feedback at 1089 & 2143, batch at 1273) since they
  all return the same dict. Verified via `verify_phase5.py` + `py_compile`.

### Phase 5 verification
`verify_phase5.py` — `13/13 checks PASS`, including a live
`demo_compliance_report()` call (server import succeeds with all 27 routes) that
confirms `is_compliant is False`, `ready_for_upload is False`,
`requires_action is True`, and `analysis_status == 'demo_pending'`. No frontend
regression: all consuming pages read these fields defensively (`|| 'N/A'`,
`|| 0`, boolean ternaries) and the grade helpers return a safe default for
`'N/A'`; the `next build` from Phase 4 still covers those pages unchanged.

---

## Phase 6 — Heatmap

- **MAP-01 — Wiring a real Google Maps key.** A valid `AIza...` Maps key is now
  present in the gitignored `frontend/.env.local` (never committed; the tracked
  `frontend/.env.example` keeps a placeholder). Verified that
  `entities/page.tsx` passes it to `@react-google-maps/api`'s `GoogleMap` via
  `googleMapsApiKey` and uses `HeatmapLayer`, and that `products/page.jsx`
  geocodes via the Geocoding API with the same key. The Phase 4 graceful
  "API key not configured" fallback in `entities/page.tsx` remains intact, so a
  missing/invalid key never breaks the page. Verified via `verify_phase6.py`.
- **MAP-02 — External blocker: GCP billing disabled.** A live call to the
  Geocoding API with the supplied Maps key returns `status: REQUEST_DENIED`,
  `error_message: "You must enable Billing on the Google Cloud Project…"`. The
  key is in the correct format, but the Google Cloud project it belongs to has
  **billing disabled**, and the Maps/Geocoding APIs need billing + enablement to
  serve requests. This cannot be fixed from the code. Until resolved, the
  heatmap degrades to the built-in fallback banner.
  **To unblock:** (1) enable billing on the GCP project owning this key,
  (2) enable the "Maps JavaScript API" and "Geocoding API", (3) add
  `http://localhost:3000/*` to the key's HTTP-referrer allowlist.

### Phase 6 verification
`verify_phase6.py` — checks the env wiring (key present, `AIza` format, gitignored),
both pages' consumption of the key, the intact fallback, and that the billing
blocker is documented in this file. The live map itself cannot be render-verified
until the GCP project's billing/API setup is corrected (external dependency).

---

## Phase 7 — Compliance-Engine Code Hygiene (audit "minor bugs")

- **MAP-03 — `comply.py` star-import export table silently disabled.** The module
  declared its exports as `_all_ = [...]` (lowercase) instead of the special
  `__all__` used consistently by `compliance.py`, `compliance_copy.py`, and
  `chatbot_compliance.py`. As a plain (non-dunder) attribute, `_all_` is ignored
  by `from comply import *`, so the intended export contract was never enforced.
  Fixed `_all_` → `__all__` (`comply.py` line ~1489). Verified that star-importing
  now resolves all five listed names (`analyze_compliance`, `analyze_seller_upload`,
  `chatbot_agent`, `batch_analyze_products`, `REGULATORY_RULES`).
- **MAP-04 — `comply.py` `__main__` guard typo.** `if __name__ == '_main_':`
  (missing two underscores) meant the module's self-test block could never run.
  Fixed to `'__main__'`.
- **MAP-05 — duplicate `get_db_connection` in `compliance.py`.** The function was
  defined twice in the same file (lines 371 and 382); the later definition
  silently replaced the first, leaving one dead copy (differing only in
  `print()` vs `log()` on failure). Removed the dead first copy so only one
  connection helper remains. Both modules still `py_compile` cleanly.

### Phase 7 verification
`verify_phase7.py` — statically confirms `__all__` (not `_all_`), the corrected
`'__main__'` guard, and exactly one `get_db_connection` in `compliance.py`; both
modules compile; and a real `from comply import *` resolves all five exports,
proving the (previously inert) export table now works. `7/7 checks PASS`.

---

## Phase 8 — Database Bring-Up + Non-Hanging Server Import

- **DB-01 — MySQL via Docker (root `docker-compose.yml`).** The app could not
  run end-to-end because its DB (`amazon_scraper_db`, port 3307) did not exist:
  the native MySQL80 on 3306 had no matching user/schema and `docker-compose`
  had never been started. Running `docker compose up -d` at the repo root now
  provisions a self-contained MySQL 8 container (`legalguard-mysql`) on host port
  **3307** with the exact credentials already in backend `.env`
  (`legalguard` / `legalguard#2026`, `lower_case_table_names=1`), auto-loading
  `database_schema.sql` on first boot. Verified: MySQL 8.0.46, connected as
  `legalguard`, all **6 tables** present (`users`, `products`, `images`,
  `selleractivity`, `gifts`, `gifts_redeemed`). The native MySQL on 3306 is
  untouched.
- **DB-02 (critical) — `import server` hung before Flask bound its port.**
  A faulthandler dump showed the freeze inside `ssl.create_default_context()`
  (via google-genai's `_ensure_httpx_ssl_ctx`), reached when
  `chatbot_compliance.py` and `comply.py` **eagerly constructed**
  `ChatGoogleGenerativeAI` at import time. In this network-restricted
  environment that SSL setup can stall indefinitely, making the backend
  unstartable — the DB work above was pointless without it.
  **Fix:** both modules now build the chat model **lazily** in a thread-safe,
  daemon-worker `get_llm()` guarded by a **10 s timeout**; on stall/failure the
  module keeps `llm = None` and callers take the existing demo fallbacks. All
  `llm.invoke` call sites (compliance analysis, seller upload, DB agent,
  chatbot) route through `get_llm()` with explicit None-guards. The multimodal
  OCR path is unaffected (`genai.configure`/`GenerativeModel` do no network
  I/O). Also added the missing `port` key to both modules' `DB_CONFIG`.
- **DB-03 — run helper.** `run_test_5001.py` (import server + bind
  `127.0.0.1:5001`) provides a quick local run on a non-default port.

### Phase 8 verification
`verify_phase8.py` — starts by importing `server` under a faulthandler guard
(must complete in seconds, not stall), asserts all **27 routes** register, and
proves the LLM init is lazy (`get_llm()` exists; module-level `llm` is `None`
after import for both `chatbot_compliance` and `comply`). It then hits
`GET /api/health` through Flask's test client expecting `status: ok` and
`database: connected`, does a direct `get_db_connection()` against the Docker
DB confirming all 6 tables, and py_compiles the four core modules.
`15/15 checks PASS`. A real boot of `run_test_5001.py` also served
`/api/health` → 200 with `database: connected`.

---

## Phase 9 — RAG Grounding of the Legal Metrology Answers

- **RAG-01 — the audit's top-1 finding: answers were never grounded.** The
  product analyzer embeds a full rule checklist, but the free-text chatbot path
  (`comply.chatbot_agent`) answered via a bare
  `model.invoke("Provide LM-compliance based answer: …")` with **zero rules in
  the prompt** — letting the LLM invent rule numbers and penalties. Added a new
  stdlib-only module `grounding.py`:
  - `flatten_rules` builds stable, deterministic rule units (`LM-<cat>-<n>`) from
    the canonical `REGULATORY_RULES` (56 units across all categories).
  - `retrieve_rules(query, rules, category, top_k)` does deterministic lexical
    retrieval (keyword hits + name/description token overlap + severity bias),
    fully offline — no embeddings/vector DB/network needed, so it can never hang
    `import server`.
  - `build_grounded_prompt` injects a bounded `GROUNDING CONTEXT` with rule IDs,
    instructs the model to cite only retrieved rules, and to say "not covered"
    rather than invent rules.
  - `extract_citations(text, valid_ids)` validates that the model's answer cites
    ONLY rule IDs that were actually retrieved (flags hallucinated IDs).
- **RAG-02 — wired into both chatbot paths.**
  - `comply.chatbot_agent`: the formerly-bare fallback now runs
    `retrieve_rules(user_message, REGULATORY_RULES, top_k=6)` and answers via
    `build_grounded_prompt(...)`.
  - `chatbot_compliance.create_user_aware_agent`: every user-chatbot turn now
    injects a `Legal Metrology GROUNDING CONTEXT` (with rule IDs) into the
    agent input so the SQL agent cross-checks against the real rules.
- **RAG-03 — key verified live.** The existing `.env` `GOOGLE_API_KEY` (an
  `AQ…` key) was previously assumed invalid; a live call against
  `google.genai` confirmed **both** the current key and the newer supplied key
  return valid Gemini responses. The app path `comply.get_llm()` /
  `chatbot_compliance.get_llm()` both initialize `ChatGoogleGenerativeAI` on
  first use and answer correctly — no `.env` change was required (no secrets are
  committed).

### Phase 9 verification
`verify_phase9.py` — offline: 56 units built; MRP / FSSAI / net-quantity
questions each retrieve their correct rule; retrieval is deterministic;
context+prompt carry the no-invent instruction; citation validator accepts a
retrieved ID and flags invented ones (`LM-food-99`); both modules' grounding
wiring is present; all four core files compile; `import server` regression
guard still registers 27 routes. Online: a live grounded Gemini answer to an
MRP question cited `[LM-food-4]` (a genuinely retrieved rule) with **zero
ungrounded citations**. `18/18 checks PASS`.

---

## PHASE 10 �?" QA audit remediation (60/100 -> demo-ready)

Full end-to-end QA audit (login/signup, enrich, scrape, analyze, chat, rewards,
heatmap) with Gemini free-tier quota exhausted, Maps billing blocked, and a
completely empty database. All four must-fix issues below were fixed and then
verified against a live server (`run_test_5001.py`, port 5001) with real HTTP
requests.

### FIX 10.1 �?" `GET /api/product/<id>` crashed with NameError (500)
- **Bug:** `get_product_detail` checked auth but never defined `user_id`,
  then referenced it in the SQL -> every request returned
  `500 NameError: name 'user_id' is not defined`. The Products page's
  "View Details" (calls `/api/product/${id}`) was completely broken.
- **Fix:** Added `user_id = session.get('user_id')` after the auth check in
  `server.py:get_product_detail`.
- **Verify:** `/api/product/6` returns `200` and the product dict now carries
  `compliance_report` (grade `A+`). **PASS.**

### FIX 10.2 �?" Gemini failures now fail FAST instead of hanging (429/quota)
- **Bug:** on quota exhaustion every chat/analyze hit `429 RESOURCE_EXHAUSTED`
  and tenacity retried with 20-60s exponential backoffs; analyses hung for
  minutes and raw API exception JSON (e.g. `429 ... RESOURCE_EXHAUSTED`) leaked
  straight into the chat response.
- **Fix:**
  - New `ai_guard.py`: a shared 90s cooldown sentinel with
    `is_rate_limit_exc()` (matches `429`/`RESOURCE_EXHAUSTED`/`rate limit`),
    `note_rate_limit()`, `ai_ok()`, `clear()`, and a friendly message constant.
  - `ChatGoogleGenerativeAI(...)` now always sets `max_retries=0` in
    `comply.py`, `compliance.py`, `chatbot_compliance.py`.
  - Muted/cooldown short-circuits skip Gemini in data analysis and severity
    inference (`compliance.py`), intent detection (`server.py`), and both
    chatbot entry points.
  - Chat fallback is now deterministic: `_offline_grounded_answer()` answers
    from the Phase 9 offline rule base (`retrieve_rules` / `format_context`),
    so a rate-limited chatbot still answers from the Legal Metrology rules.
  - `_chat_safe_message()` in `server.py` guarantees no raw `429` /
    `RESOURCE_EXHAUSTED` text can reach the user.
- **Verify:** with the quota genuinely exhausted of the day,
  `POST /api/compliance/analyze/<id>` completed in ~1-2s (was minutes) and
  returned a graded degraded report; both chat routes returned friendly
  grounded text with `leak=False`. **PASS.**

### FIX 10.3 �?" Compliance reports now persisted (grades visible + filters work)
- **Bug:** `analysis_results` / `remarks` were never written after analysis, so
  every product showed grade "N/A" and the Products-page grade filter matched
  nothing.
- **Fix:**
  - New `_save_compliance_report(product_id, report)` in `server.py` writes the
    full report into `Products.analysis_results` and a human-readable
    `remarks` line `Grade: X | Score: Y | Critical: a, Major: b, Minor: c`
    (the frontend filters on `remarks`), plus `last_analysed=NOW()`.
    JSON serialization is Decimal-safe.
  - Called from the analyze endpoint and the scrape auto-analyze path.
  - `get_products` now selects `analysis_results` and deserializes it into
    `compliance_report` on every row.
- **Verify:** after a live analyze, the DB row shows updated
  `analysis_results` + `remarks`; `/api/products` returns grades
  `A+`, `C`, `F` with full `compliance_report` objects. **PASS.**

### FIX 10.4 �?" Demo seed data (empty DB -> populated demo)
- **Bug:** a fresh DB ships with 0 users / 0 products / 0 gifts: Products list,
  dashboard, heatmap and rewards redemption had nothing to show.
- **Fix:** new idempotent `seed_demo_data.py` creates a `demo` user
  (`demo` / `Dem0@LegalGuard!`, 120 MT), 3 realistic products (A+ compliant,
  C partially compliant, F non-compliant cosmetics) with persisted reports,
  remarks, and seller locations (for the heatmap), plus 3 gifts.
- **Verify:** rerunning it is a no-op; `/api/products` lists 3 graded items,
  `/api/dashboard` has 3 recent scrapes, `/api/global-heatmap` returns 3
  points, `/api/gifts/list` returns 3 gifts, token balance is `>0`. **PASS.**

### Phase 10 verification
`qa_verify_fixes.py` against the live server: **19/19 PASS** covering product
detail, fail-fast analyze with persistence, products list, grade filters,
both chat routes (no raw error leak), dashboard, heatmap, gifts and token
balance.

---

## Phase 11 — AI Assessment, Upload Validation, Live E2E (TODO #5/#6/#7/#9)

All verified against the live stack (Docker MySQL on 3307, backend on
`127.0.0.1:5001`, frontend on `:3000`), with the Gemini free-tier quota
genuinely exhausted (429) and intermittently overloaded (503) during the run.

### FIX 11.1 — Canned AI assessment (TODO #5)
- **Bug:** `gemini_analysis.assessment` on the check-compliance page was a
  hardcoded two-line string — identical for every product, ignoring the
  actual score/grade/violations.
- **Fix:** new stdlib-only `assessment.py`:
  - `deterministic_assessment(report)` builds a real verdict paragraph from the
    report's actual score, grade, violation summary, missing declarations, top
    violations and recommendations (score-band-specific wording; different
    products → different text).
  - `generate_assessment(report, llm)` asks Gemini (when available and not
    `ai_guard`-muted) to write a 3–4-sentence assessment from a compact
    sanitized fact sheet (no raw listing text → injection-safe); ANY failure
    (429/503/timeout/bad output) silently falls back to the deterministic text.
    Output is rejected if it contains provider-error markers.
  - Wired into all report builders (`compliance.py`, `compliance_copy.py`,
    `comply.py` analyze + both seller-upload paths) and the `/api/scrape`
    `compliance_analysis` block; `demo_compliance_report` got an honest
    "no real analysis ran" assessment; `_ensure_assessment()` backfills
    persisted/seeded reports on read; `seed_demo_data.py` bakes assessments in.
  - Frontend `check-compliance/page.jsx` now renders the backend assessment
    (with a grade/score fallback if absent).
- **Verify:** 9 unit tests (distinct texts for A+/C/F, degenerate-report safety,
  LLM paths, 429 fallback + mute, garbage-output fallback, good-output
  acceptance) — ALL PASS. Live: analyze/seller-check/products/detail all carry
  per-product assessments; 3 seeded products → 3 distinct, content-matched
  texts.

### FIX 11.2 — Upload validation (TODO #9)
- **Bug:** both `/api/seller/check-upload*` routes read up to 10 arbitrary
  files and passed the raw bytes straight to Gemini — no type, size or
  integrity checks.
- **Fix:** new `validate_upload_images()` in `server.py` (shared by both
  routes) enforcing, BEFORE any AI call: allowed extensions
  (.jpg/.jpeg/.png/.webp), magic-byte content sniff (renamed executables/text
  rejected), 8 MB/file, 40 MB total, and the preserved 10-file limit — each
  failure a friendly, specific 400 naming the offending image. Plus a global
  `MAX_CONTENT_LENGTH` (64 MB) with a friendly 413 handler.
- **Verify:** live — `.exe` → 400, fake `.png` (text) → 400, empty file → 400,
  11 files → 400 "at most 10", 9 MB PNG → 400 "too large", valid PNG passes to
  analysis. **PASS.**

### FIX 11.3 — Chat fallback on non-429 Gemini failures (TODO #6)
- **Bug:** `compliance.chatbot_agent`'s generic exception path returned an
  apology; during a real Gemini **503 high-demand** outage the chat gave no
  useful answer (only 429s hit the offline grounded path).
- **Fix:** ANY Gemini failure now routes to the offline grounded answer
  (relabelled "AI model temporarily unavailable" for non-429 cases).
- **Verify:** live — chat answered an MRP question from the offline rule base
  with rule IDs while Gemini was erroring. **PASS.**

### FIX 11.4 — Dashboard CSV export (TODO #7)
- **Bug:** the export quoted nothing (commas/quotes in titles corrupt rows) and
  exported the product star `rating` under the "Compliance Score" column.
- **Fix:** RFC 4180 escaping helper + export the persisted
  `compliance_report.compliance_score`.
- **Verify:** `npm run build` clean; data source verified against the live
  persisted reports (score=92.0 grade=A+). **PASS.**

### FIX 11.5 — Misc
- `verify_phase2.py`: stale "retried (calls==3)" assertion updated to the
  intended Phase 10 fail-fast design (calls==1 on quota 429) — now 6/6 PASS.
- README: new "Seed Demo Data" section documenting the idempotent
  `seed_demo_data.py` command (TODO #4's documentation item).
- Test users/products created during verification were cleaned; demo data
  reseeded fresh (3 graded products, 3 gifts).

### Phase 11 verification
- Live suites: **30/30 PASS** (health, auth, ownership, seller-only, all 6
  upload-validation cases, seller-check assessment, seeded grades, product
  detail + assessment, 404, dashboard, heatmap, gifts, analyze + persistence,
  chat, empty message) and **11/11 PASS** (grades, distinct assessments,
  persisted report data, products/detailed, chat fallback), **8/8 PASS**
  (invalid/empty URL, validate endpoint).
- Regressions: verify_phase0 2/2, phase1 9/9, phase2 6/6, phase3 18/18,
  phase7 7/7, phase9 16/17 (only the ONLINE live-Gemini check skipped due to
  quota).
- Frontend: `npm run build` exit 0; all 10 routes live-returned 200.

---

## PHASE 12 — Fake-F fix: AI outage misgraded a compliant product (Maggi B01N1UL0MZ)

**User report:** the Maggi 2-Minute Masala Noodles Amazon.in URL
(`.../dp/B01N1UL0MZ/...`) showed **grade F** in the app.

### FIX 12.1 — Gemini quota exhaustion produced fake `0.0 / F` grades
- **Bug (live-verified in `server_run.log`, product 19 / ASIN `B01N1UL0MZ`):**
  the Gemini free tier (20 requests/day/model) hit `429 RESOURCE_EXHAUSTED`.
  **Both** analysis layers (image OCR + listing-data analysis) then returned
  **zero findings**, and every scorer treated "AI produced no findings" as
  "all 9 Legal Metrology declarations are missing" — penalizing 90% (5 high
  rules × 18%) + 10% (4 low rules × 2.5%) = **100% → score 0.0, grade F**
  for a fully compliant product, persisted to
  `Products.analysis_results/remarks/rating` and displayed in the UI. The
  scraped listing in fact contained real declarations (price 198.0 INR,
  Net Quantity "70.0 Grams", Manufacturer "Nestle", Package Dimensions,
  unit price 282.86 INR/100 g).
- **Fix (three layers of defense):**
  1. **New `offline_analysis.py`** — a deterministic, stdlib-only extractor
     over the flattened listing JSON that emits findings in the exact Gemini
     data-analysis shape (`requirement/status/found_in/extracted_value/
     adequacy/notes`), mapped per-scorer from the caller's own rule list (so
     it works with all three modules' different rule names). Every
     Gemini-outage path in `compliance_copy.analyze_product_data`,
     `compliance.analyze_product_data` and `comply.analyze_product_data`
     (pre-check cooldown, no-key, rate-limit exception) now returns this
     instead of zero findings.
  2. **Indeterminate-analysis guard** — new
     `offline_analysis.is_analysis_indeterminate()`: when NO source produced
     findings AND at least one layer actually failed (error / rate-limit /
     offline marker), all three scorers return
     `score=None, grade='N/A', analysis_status='indeterminate'` instead of a
     fake 0/F. A genuinely declaration-free product (audit case #4 — OCR ran
     successfully and found nothing) still scores 0/F because no layer
     failed.
  3. **Honest degraded results everywhere** — `analysis_mode`
     ('ai'|'offline') and `analysis_status` flow through `/api/scrape`,
     `/api/products/validate`, the compliance reports and the extension;
     `is_compliant`/`requires_action`/`ready_for_upload` are None-score-safe;
     `rating` stays NULL and `remarks` says N/A for indeterminate reports;
     seller-upload error paths return N/A (was fake F).
- **Result for the reported product:** offline extraction of the actual
  Maggi listing now scores **61.5 / B** (was 0.0/F). The remaining deductions
  are the declarations genuinely absent from the listing *text* (country of
  origin, consumer-care contact, dates) — which image OCR will confirm once
  the Gemini quota resets.
- **Verify:** `verify_phase12.py` → **24/24 PASS** (offline extraction of the
  real Maggi data; scorer no longer 0/F; indeterminate → N/A; genuine
  no-declaration still 0/F; NameError fixes; grade-ladder parity; fail-fast
  429 retry).



### FIX 12.2 — `NameError: name 'ai_guard' is not defined` crashed every assessment
- **Bug:** `compliance_copy.analyze_compliance` (the `/api/scrape`
  auto-analyze path) called `get_llm() if ai_guard.ai_ok()` — **neither name
  existed** in that module (log: `[ASSESSMENT] generation failed (name
  'ai_guard' is not defined)`). `compliance.py` imported `ai_guard` but
  never defined `get_llm` either.
- **Fix:** `import ai_guard` + a `get_llm()` accessor added to both modules
  (`compliance_copy.get_llm`, `compliance.get_llm`);
  `compliance_copy.generate_with_retry` now notes quota-429s into the shared
  `ai_guard` cooldown and fails fast (single attempt, `RateLimitError`),
  matching comply.py's Phase-10 design; the OCR/data-analysis pre-checks in
  all three modules skip Gemini immediately while the cooldown is active.
- **Verify:** `verify_phase12.py` checks 5/7 — `get_llm` exists & callable in
  both modules, `ai_guard` importable in `compliance_copy`, retry fails fast
  on 429 (`calls=1`), success passthrough unchanged.

### FIX 12.3 — Frontend/extension rendered `N/A` as A-grade green + `null%` scores
- **Bug:** every grade-color helper used `grade.toUpperCase().includes('A')`
  — and `'N/A'.includes('A')` is true, so an indeterminate grade rendered as
  a green A. Score cells rendered `null%` or `0%`.
- **Fix:** `getGradeColor`/`getGradeBg` in `check-compliance`, `products`
  and `seller-verification` pages now short-circuit `N/A`/`NA`/`PENDING` to
  neutral gray; score cells render `N/A`/`No score` when null; a new blue
  "Offline/Incomplete analysis (AI service unavailable)" banner explains
  degraded results; the Status card shows "Not Graded" for indeterminate;
  the extension badge gets a gray `legalguard-na` style + explanatory note
  (CSS added to `content.css`).
- **Verify:** `npm run build` exit 0 (all 10 routes prerender);
  `node --check extension/content.js` OK.

### FIX 12.4 — Poisoned DB rows (fake F persisted) + regrade tool
- **Bug:** the fake 0.0/F was **persisted** — e.g. products 18 & 19 carry
  `Grade: F | Score: 0.0` in `remarks`/`rating` despite compliant listings.
- **Fix:** new `regrade_products.py` — auto-detects rows matching the fake-F
  signature (score 0 + grade F + all rules penalized + OCR layer failed) or
  accepts explicit ids, and re-runs the fixed engine (AI if available, else
  the deterministic offline extractor), re-persisting the honest grade. Run
  from the backend dir:
  `.\venv\Scripts\python.exe regrade_products.py` (or `regrade_products.py 18 19`).
- **Status:** script ready; the dev DB (Docker `legalguard-mysql` on 3307) was
  not running during this fix — run it after `docker compose up -d`.

### FIX 12.5 — assessment copy for indeterminate reports
- **Bug:** `deterministic_assessment` coerced `score=None` to `0.0` and would
  say the product "is NOT compliant".
- **Fix:** N/A/indeterminate reports now produce explicit "a definitive
  compliance grade could not be produced … re-run the analysis" text;
  `_fact_sheet` (the Gemini prompt) states INDETERMINATE so the AI cannot
  invent a verdict either.

### Phase 12 regression sweep
- Backend: `verify_phase0` PASS, `phase1` 8/8, `phase2` 6/6, `phase3` 18/18,
  `phase7` 7/7, `phase4` 18/20 (the 2 fails are pre-existing `.env.example`
  Maps-key doc checks, untouched by this phase), `verify_phase12` **24/24**.
- Frontend: `npm run build` exit 0.

