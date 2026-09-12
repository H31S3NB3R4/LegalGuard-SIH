"""
RAG grounding for the Legal Metrology compliance pipeline (Phase 9).

WHY: The audit's top finding was that chatbot / compliance answers were not
grounded in the actual Legal Metrology rules — the LLM could (and did)
hallucinate rule references and citations. The product analyzer already embeds
a full rule checklist, but the chatbot's free-text path did a bare
`model.invoke(...)` with zero grounding.

WHAT THIS MODULE DOES (offline, deterministic, no new dependencies):
  1. Flatten the structured `REGULATORY_RULES` dict (see comply.py /
     compliance.py) into stable, retrievable units with explicit IDs
     (`LM-<category>-<n>`).
  2. Lexical retrieval (`retrieve_rules(query, rules, ...)`) that scores each
     unit by exact keyword hits + name/description token overlap + severity, so
     a compliance question deterministically pulls the most relevant rules.
  3. Context formatting (`format_context`) that renders the retrieved units as
     a bounded "GROUNDING CONTEXT" with rule IDs the model is told to cite.
  4. Prompt construction (`build_grounded_prompt`) that FORBIDS inventing rules
     outside the context.
  5. Citation validation (`extract_citations`) that checks the model's answer
     cites only retrieved rule IDs — the online guard against hallucination.

This module is import-light (stdlib only) so importing it can never hang or
fail on environment/network issues; the retrieval is 100% offline.
"""
import re
from typing import Dict, List, Optional, Tuple

_SEVERITY_RANK = {"critical": 2, "major": 1, "minor": 0}
_TOKEN_RE = re.compile(r"[a-z0-9]+")

CITATION_RE = re.compile(r"LM-[a-z0-9_-]+-\d+", re.IGNORECASE)


def _tokens(text: str) -> List[str]:
    return _TOKEN_RE.findall((text or "").lower())


def flatten_rules(rules: Optional[Dict[str, dict]] = None) -> List[Dict]:
    """Flatten a REGULATORY_RULES dict into stable, retrievable units.

    Args:
        rules: {category: {'critical'|'major'|'minor': [ {name, description,
               keywords, weight}, ... ]}}. Defaults to importing REGULATORY_RULES
               from comply.py (the canonical copy) when None.

    Returns:
        List of {id, category, severity, name, description, keywords, weight}.
        IDs are stable and deterministic: `LM-<category>-<n>` where <n> is the
        1-based position within that category's combined checklist.
    """
    if rules is None:
        from comply import REGULATORY_RULES  # lazy import avoids cycles
        rules = REGULATORY_RULES
    units: List[Dict] = []
    for category, sev_map in (rules or {}).items():
        n = 0
        for severity in ("critical", "major", "minor"):
            for rule in sev_map.get(severity, []):
                n += 1
                units.append({
                    "id": f"LM-{category}-{n}",
                    "category": category,
                    "severity": severity,
                    "name": rule.get("name", ""),
                    "description": rule.get("description", ""),
                    "keywords": rule.get("keywords", []),
                    "weight": rule.get("weight", 0),
                })
    return units


_RULE_IDX: Optional[List[Dict]] = None


def all_units(rules: Optional[Dict[str, dict]] = None) -> List[Dict]:
    """Flattened units, cached globally for the default rules set."""
    global _RULE_IDX
    if rules is not None:
        return flatten_rules(rules)
    if _RULE_IDX is None:
        from comply import REGULATORY_RULES
        _RULE_IDX = flatten_rules(REGULATORY_RULES)
    return _RULE_IDX


def _unit_score(query_tokens: List[str], unit: Dict) -> float:
    qset = set(query_tokens)
    name_tok = set(_tokens(unit["name"]))
    desc_tok = set(_tokens(unit["description"]))
    score = 0.0
    # Exact keyword hits are the strongest signal.
    for kw in unit.get("keywords", []):
        kw_s = str(kw).lower()
        if kw_s and (kw_s in qset or any(kw_s in t for t in query_tokens)):
            score += 3.0
    # Token overlap with the rule name / description.
    score += 2.0 * len(qset & name_tok)
    score += 1.0 * len(qset & desc_tok)
    # Severity bonus biases critical rules to the top for compliance checks.
    score += _SEVERITY_RANK.get(unit["severity"], 0)
    return score


def retrieve_rules(query: str,
                   rules: Optional[Dict[str, dict]] = None,
                   category: Optional[str] = None,
                   top_k: int = 6) -> List[Dict]:
    """Deterministic lexical retrieval of the most relevant rule units.

    When `category` is provided the search is restricted to that category's
    units (e.g. product analysis); otherwise it searches across every category
    (e.g. free-text chatbot questions). Ties are broken by category then
    severity rank then id, keeping results stable across runs.
    """
    units = all_units(rules)
    if category:
        units = [u for u in units if u["category"] == category]
    q_tokens = _tokens(query)
    if not q_tokens or not units:
        return []
    scored: List[Tuple[float, str, str, int, int, Dict]] = []
    for i, u in enumerate(units):
        s = _unit_score(q_tokens, u)
        if s <= 0:
            continue
        # (score, -severity_rank, id, orig_index) sorts deterministically.
        scored.append((-s, -_SEVERITY_RANK[u["severity"]], u["id"], i, s, u))
    scored.sort(key=lambda t: (t[0], t[1], t[2], t[3]))
    return [t[5] for t in scored[:top_k]]


def format_context(units: List[Dict]) -> str:
    """Render retrieved units as a bounded GROUNDING CONTEXT block."""
    if not units:
        return "(no Legal Metrology rules retrieved)"
    lines = []
    for u in units:
        sev = u["severity"].upper()
        lines.append(
            f"- [{u['id']}] ({sev.replace('_', ' ')}): {u['name']} — "
            f"{u['description']}"
        )
    return "\n".join(lines)


SYSTEM_ROLE = (
    "You are an expert in Indian Legal Metrology (Packaged Commodities) Rules, "
    "2011 (as amended), for Amazon product compliance on the LegalGuard platform."
)


def build_grounded_prompt(question: str, units: List[Dict]) -> str:
    """One-shot grounded prompt for the free-text chatbot path.

    The model is allowed to cite ONLY the rules present in the grounding
    context and instructed to say when a topic is not covered by the rules —
    never to invent rule numbers outside the context.
    """
    ctx = format_context(units)
    return f"""{SYSTEM_ROLE}

Answer the user's question about Legal Metrology compliance strictly on the basis of the GROUNDING CONTEXT below, which lists the only Legal Metrology rules you may rely on.

GROUNDING CONTEXT (rules retrieved for this question):
{ctx}

RULES FOR YOUR ANSWER:
- Base every claim on a rule in the GROUNDING CONTEXT.
- Cite the rule inline by its ID in square brackets, e.g. [LM-food-3].
- If the question touches something NOT covered by the GROUNDING CONTEXT, say "That is not covered by the Legal Metrology rules in my context" — never invent rule numbers, sections, or penalties.
- Keep the answer practical and concise (2-5 sentences).

USER QUESTION: {question}"""


def grounding_context_for(question: str,
                          rules: Optional[Dict[str, dict]] = None,
                          top_k: int = 6) -> List[Dict]:
    """Retrieve units for a question (convenience wrapper)."""
    return retrieve_rules(question, rules=rules, category=None, top_k=top_k)


def extract_citations(text: str, valid_ids: List[str]) -> Tuple[List[str], List[str]]:
    """Return (found_ids, ungrounded_ids) from a model answer.

    `valid_ids` is the set of rule IDs that were actually provided in the
    grounding context. Any citation in `text` matching the LM-...-N shape that
    is NOT in valid_ids is an ungrounded (hallucinated) citation.
    """
    valid = {str(v).lower() for v in valid_ids}
    found = [m.lower() for m in CITATION_RE.findall(text or "")]
    ungrounded = [c for c in found if c not in valid]
    return found, ungrounded