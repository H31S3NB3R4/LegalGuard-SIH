#!/usr/bin/env python3
"""
Shared AI-assessment generator (Phase 11 / TODO #5).

Problem: `gemini_analysis.assessment` shown on the check-compliance page was a
canned two-line static string — identical for every product, regardless of the
actual score, grade or violations.

This module generates a REAL assessment for every compliance report:
  - `deterministic_assessment(report)` — always available, offline, built
    directly from the report's actual score, grade, violation summary,
    missing/incorrect declarations and recommendations. Two different products
    with different results always produce different text.
  - `generate_assessment(report, llm=None)` — when a Gemini chat model is
    available (and not rate-limit-muted via ai_guard), it asks Gemini to write
    a concise 3-4 sentence assessment from a compact, sanitized fact sheet of
    the SAME report; any failure (quota, network, timeout, bad output) silently
    falls back to the deterministic version. Gemini never sees raw user data —
    only the already-extracted compliance facts.

Imported by: compliance.py, compliance_copy.py, comply.py, server.py.
Stdlib-only imports; never blocks `import server`.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import ai_guard


def _fmt_list(items: Optional[List[str]], limit: int = 3, none_label: str = "none") -> str:
    """Render up to `limit` items as 'a, b and c' (or the none-label)."""
    if not items:
        return none_label
    cleaned = [str(i).strip() for i in items if i is not None and str(i).strip()]
    if not cleaned:
        return none_label
    shown = cleaned[:limit]
    more = len(cleaned) - len(shown)
    text = ", ".join(shown[:-1]) + f" and {shown[-1]}" if len(shown) > 1 else shown[0]
    if more > 0:
        text += f" (+{more} more)"
    return text


def _top_violations(violations: Optional[List[Dict[str, Any]]], limit: int = 4) -> List[str]:
    """Human-readable one-liners for the most severe violations (critical first)."""
    if not violations:
        return []
    rank = {"critical": 0, "high": 1, "major": 2, "minor": 3}
    ordered = sorted(
        violations,
        key=lambda v: rank.get(str(v.get("severity", "minor")).lower(), 4),
    )
    out: List[str] = []
    for v in ordered[:limit]:
        rule = (v.get("rule") or v.get("requirement") or v.get("category") or "requirement").strip()
        desc = (v.get("description") or "").strip()
        sev = str(v.get("severity", "")).lower() or "issue"
        if desc:
            out.append(f"[{sev}] {rule}: {desc}"[:160])
        else:
            out.append(f"[{sev}] {rule}"[:160])
    return out


def deterministic_assessment(report: Dict[str, Any]) -> str:
    """
    Build an assessment paragraph from the ACTUAL report contents.

    Safe for any report shape (missing keys degrade gracefully) and fully
    deterministic — same report in, same text out.
    """
    try:
        score = report.get("compliance_score")
        try:
            score_num = float(score)
        except (TypeError, ValueError):
            score_num = 0.0
        grade = report.get("compliance_grade") or "N/A"
        title = (report.get("title") or "This product").strip() or "This product"

        # Phase 12: indeterminate analysis (AI outage, score None / grade N/A)
        # must read as "could not grade", never as "NOT compliant".
        if score is None or grade == "N/A" or report.get("analysis_status") == "indeterminate":
            return (
                f"A definitive compliance grade could not be produced for {title}: "
                "the AI compliance service was unavailable (Gemini quota exhausted) "
                "and the available listing data was not sufficient to complete the "
                "Legal Metrology checks. No violations are asserted. Please re-run "
                "the compliance analysis once the AI quota resets."
            )

        summary = report.get("violation_summary") or {}
        def _n(key: str) -> int:
            try:
                return int(summary.get(key) or 0)
            except (TypeError, ValueError):
                return 0
        critical, major, minor, total = _n("critical"), _n("major"), _n("minor"), _n("total")

        data_analysis = report.get("data_analysis") or {}
        missing = data_analysis.get("missing_critical_info") or report.get("missing_critical_info") or []

        violations = report.get("violations") or []
        top_v = _top_violations(violations, limit=3)
        recommendations = report.get("recommendations") or []

        # --- verdict sentence (varies with score band) ---
        if score_num >= 85:
            verdict = (f"{title} is fully compliant with the Legal Metrology (Packaged "
                       f"Commodities) Rules: it scored {score_num:.0f}/100 (grade {grade}) with no "
                       f"significant violations detected.")
        elif score_num >= 70:
            verdict = (f"{title} is largely compliant with the Legal Metrology (Packaged "
                       f"Commodities) Rules: it scored {score_num:.0f}/100 (grade {grade}), but "
                       f"{total} violation(s) were detected that should be fixed.")
        elif score_num >= 45:
            verdict = (f"{title} is only partially compliant: it scored {score_num:.0f}/100 "
                       f"(grade {grade}) with {total} violation(s), including {critical} critical "
                       f"and {major} major issue(s). Corrective labelling changes are required.")
        else:
            verdict = (f"{title} is NOT compliant with the Legal Metrology (Packaged "
                       f"Commodities) Rules: it scored just {score_num:.0f}/100 (grade {grade}) with "
                       f"{total} violation(s), {critical} of them critical. The listing needs "
                       f"substantial label corrections before it can be sold.")

        # --- findings sentence ---
        parts: List[str] = [verdict]
        if missing:
            parts.append(f"Missing mandatory declarations: {_fmt_list(missing)}.")
        if top_v:
            parts.append("Key issues detected: " + "; ".join(top_v) + ".")
        if not missing and not top_v and total == 0:
            parts.append(
                "All mandatory declarations (MRP, net quantity, manufacturer details, "
                "country of origin, dates and contact information) were found and validated."
            )

        # --- recommendation sentence ---
        if recommendations:
            parts.append(
                "Recommended next steps: "
                + _fmt_list(recommendations, limit=2, none_label="review the full recommendation list")
                + "."
            )
        elif total > 0:
            parts.append(
                "Recommended next steps: correct the violations listed above and re-run the "
                "compliance analysis to confirm the improved grade."
            )
        else:
            parts.append(
                "Recommended next steps: none — maintain the current labelling and keep "
                "periodically re-checking after any listing change."
            )
        return " ".join(parts)
    except Exception as e:  # pragma: no cover — absolute safety net
        print(f"[ASSESSMENT] deterministic fallback build error: {e}")
        return (
            "Compliance assessment could not be summarised in detail, but the score, "
            "grade and violation list above are authoritative. Review the violations "
            "and recommendations before listing this product."
        )


def _fact_sheet(report: Dict[str, Any]) -> str:
    """Compact, sanitized fact sheet of the report for the AI prompt.

    Only already-extracted compliance facts are included — no raw scraped
    listing text (prompt-injection safe by construction).
    """
    score = report.get("compliance_score")
    grade = report.get("compliance_grade") or "N/A"
    if score is None or grade == "N/A" or report.get("analysis_status") == "indeterminate":
        return (
            "Compliance analysis was INDETERMINATE: the AI service was "
            "unavailable and no score could be produced (score: N/A). No "
            "violations are asserted. The recommended next step is to re-run "
            "the analysis when the AI quota resets."
        )
    summary = report.get("violation_summary") or {}
    data_analysis = report.get("data_analysis") or {}
    missing = data_analysis.get("missing_critical_info") or []
    recommendations = report.get("recommendations") or []
    top_v = _top_violations(report.get("violations") or [], limit=6)
    return (
        f"Compliance score: {score}/100 (grade {grade})\n"
        f"Violation summary: critical={summary.get('critical', 0)}, "
        f"major={summary.get('major', 0)}, minor={summary.get('minor', 0)}, "
        f"total={summary.get('total', 0)}\n"
        f"Missing mandatory declarations: {_fmt_list(missing, limit=6)}\n"
        f"Top violations:\n" + ("\n".join(f"- {v}" for v in top_v) if top_v else "- none") +
        "\nRecommendations:\n" + ("\n".join(f"- {str(r)[:140]}" for r in recommendations[:5])
                                  if recommendations else "- none")
    )


def generate_assessment(report: Dict[str, Any], llm=None) -> str:
    """
    Return an assessment string for the report.

    Order of preference:
      1. Gemini (llm) — only when the model is provided AND ai_guard says the
         quota is not currently muted; any failure falls back silently.
      2. Deterministic summary built from the report itself (always works).

    The result NEVER contains raw provider errors.
    """
    fallback = deterministic_assessment(report)

    if llm is None or not ai_guard.ai_ok():
        return fallback

    prompt = (
        "You are a Legal Metrology (Packaged Commodities) Rules, 2011 compliance "
        "officer. Based ONLY on the compliance facts below, write a concise "
        "assessment of 3-4 sentences (max 120 words) for the product's seller. "
        "State the overall verdict (compliant / partially compliant / "
        "non-compliant), mention the score, the most important violations and "
        "missing declarations, and give one clear next step. Do not invent rules, "
        "penalties or facts that are not in the facts below.\n\n"
        f"COMPLIANCE FACTS:\n{_fact_sheet(report)}"
    )
    try:
        resp = llm.invoke(prompt)
        text = ""
        if isinstance(resp, str):
            text = resp
        else:
            content = getattr(resp, "content", None)
            if isinstance(content, str):
                text = content
            elif isinstance(content, list):
                text = " ".join(
                    getattr(p, "text", "") if not isinstance(p, str) else p
                    for p in content
                )
        text = (text or "").strip()
        # Accept only a sane AI answer; otherwise keep the deterministic one.
        if 80 <= len(text) <= 1200 and "RESOURCE_EXHAUSTED" not in text.upper() and "429" not in text:
            return text
        return fallback
    except Exception as e:
        if ai_guard.is_rate_limit_exc(e):
            ai_guard.note_rate_limit()
            print("[ASSESSMENT] Gemini rate-limited -> deterministic assessment")
        else:
            print(f"[ASSESSMENT] Gemini assessment failed ({type(e).__name__}) -> deterministic assessment")
        return fallback

