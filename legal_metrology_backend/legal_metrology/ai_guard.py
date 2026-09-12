"""Fast-fail guard for Gemini rate limits (shared by the backend modules).

Problem: when the Gemini free tier is exhausted, both the Google SDK and
langchain_google_genai retry 429 RESOURCE_EXHAUSTED errors with long
exponential backoffs (tens of seconds per retry). A single compliance
analysis was observed hanging for minutes, and raw API error text was leaked
to users in chat.

This module gives every AI call site a shared cooldown sentinel: the first
429 mutes the AI layer briefly, and callers use `ai_ok()` to skip further
Gemini calls immediately and fall back to the offline rule-based engine.
"""
import threading
import time

_LOCK = threading.Lock()
_MUTED_UNTIL = 0.0
_COOLDOWN_SECONDS = 90.0


def is_rate_limit_exc(exc) -> bool:
    """True when the exception is a Gemini 429 / RESOURCE_EXHAUSTED."""
    text = (str(exc) + " | " + repr(exc)).lower()
    return ("429" in text) or ("resource_exhausted" in text) or ("rate limit" in text)


def note_rate_limit() -> None:
    """Record that Gemini is rate-limited; mutes AI calls for the cooldown."""
    global _MUTED_UNTIL
    now = time.time()
    with _LOCK:
        _MUTED_UNTIL = max(_MUTED_UNTIL, now) + _COOLDOWN_SECONDS
    print(f"[AI-GUARD] Gemini rate-limited; AI muted for {_COOLDOWN_SECONDS:.0f}s (fail fast)")


def ai_ok() -> bool:
    """True when the AI layer is allowed to make Gemini calls."""
    return time.time() >= _MUTED_UNTIL


def clear() -> None:
    """Reset the cooldown (used by tests/admin)."""
    global _MUTED_UNTIL
    with _LOCK:
        _MUTED_UNTIL = 0.0


FRIENDLY_RATE_LIMIT_MSG = (
    "The Legal Metrology AI is temporarily rate-limited by Gemini "
    "(free-tier daily quota reached). Showing offline rule-based results for now - "
    "please try the AI again after the quota resets."
)