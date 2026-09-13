// Compliance-report helpers shared by the product report page (Phase 3) and
// the seller readiness report (Phase 4). Shapes come from the backend:
//   visual_findings[]: {requirement, status: present|partial|missing, extracted_value, location}
//   data_analysis.findings[]: {requirement, status, adequacy, extracted_value, ...}
//   violations[]: {type: missing|partial, severity: critical|major|minor,
//                  requirement|rule, description, remedy, rule_reference}

const safeParse = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/** Latest compliance report for a product row (API pre-parses compliance_report). */
export const getReport = (product) =>
  product?.compliance_report || safeParse(product?.analysis_results) || null;

/** Merge OCR (Gemini) findings and rule-engine (listing data) findings into
 * one checklist row per requirement, with the layer that caught it. */
export const mergeFindings = (report) => {
  if (!report) return [];
  const ocrFindings = report.ocr_analysis?.visual_findings || [];
  const dataFindings = report.data_analysis?.findings || [];

  const byRequirement = new Map();

  const push = (requirement, source, finding) => {
    if (!requirement) return;
    const key = String(requirement).toLowerCase().trim();
    if (!byRequirement.has(key)) {
      byRequirement.set(key, { requirement: String(requirement), ocr: null, data: null });
    }
    const row = byRequirement.get(key);
    if (source === 'ocr' && !row.ocr) row.ocr = finding;
    if (source === 'data' && !row.data) row.data = finding;
  };

  ocrFindings.forEach((f) => push(f.requirement, 'ocr', f));
  dataFindings.forEach((f) => push(f.requirement, 'data', f));

  return Array.from(byRequirement.values()).map((row) => {
    // Prefer the better status of the two layers; prefer OCR extracted value.
    const pickStatus = (s) => String(s || '').toLowerCase();
    const ocrStatus = pickStatus(row.ocr?.status);
    const dataStatus = pickStatus(row.data?.status);
    const dataAdequacy = pickStatus(row.data?.adequacy);

    let status = 'missing';
    const foundOcr = ocrStatus === 'present' || ocrStatus === 'found';
    const foundData = dataStatus === 'present' && dataAdequacy !== 'inadequate';
    const partialOcr = ocrStatus === 'partial' || ocrStatus === 'unclear';
    const partialData =
      dataStatus === 'partial' || dataAdequacy === 'inadequate' || dataAdequacy === 'partial';

    if (foundOcr || foundData) status = 'found';
    else if (partialOcr || partialData) status = 'inadequate';

    // Layer attribution: which layer caught it (rule engine vs Gemini).
    let layer = '—';
    if (foundOcr || partialOcr) layer = 'Gemini OCR';
    else if (foundData || partialData) layer = 'Rule engine';
    else if (row.ocr || row.data) layer = 'Both layers';

    const value =
      row.ocr?.extracted_value ||
      row.ocr?.extractedValue ||
      row.data?.extracted_value ||
      row.data?.value ||
      null;

    return {
      requirement: row.requirement,
      status,
      layer,
      value: value && String(value).trim() !== '' ? String(value) : null,
      location: row.ocr?.location || null,
    };
  });
};

/** Normalize violations across the two backend shapes (scrape report uses
 * `requirement`, seller feedback uses `rule`; severities sometimes
 * high/medium/low from the demo report). */
export const normalizeViolations = (report) => {
  if (!report) return { critical: [], major: [], minor: [] };
  const raw = report.violations || [];
  const extra = [];
  if (Array.isArray(report.critical_issues)) extra.push(...report.critical_issues);
  if (Array.isArray(report.major_issues)) extra.push(...report.major_issues);
  if (Array.isArray(report.minor_issues)) extra.push(...report.minor_issues);

  const rows = [...raw, ...extra].filter(Boolean);

  const groups = { critical: [], major: [], minor: [] };
  rows.forEach((v) => {
    const severityRaw = String(v.severity || '').toLowerCase();
    const severity =
      severityRaw === 'critical' || severityRaw === 'high'
        ? 'critical'
        : severityRaw === 'major' || severityRaw === 'medium'
          ? 'major'
          : 'minor';
    groups[severity].push({
      name: v.requirement || v.rule || 'Requirement',
      description: v.description || v.notes || '',
      remedy: v.remedy || v.recommendation || '',
      penalty: v.penalty ?? null,
      type: v.type || null,
      rule_reference: v.rule_reference || 'Legal Metrology (Packaged Commodities) Rules, 2011',
    });
  });
  return groups;
};

/** Violation summary with fallbacks for the demo high/medium/low shape. */
export const violationSummary = (report) => {
  if (!report) return { critical: 0, major: 0, minor: 0, total: 0 };
  const s = report.violation_summary || {};
  return {
    critical: s.critical ?? s.high ?? 0,
    major: s.major ?? s.medium ?? 0,
    minor: s.minor ?? s.low ?? 0,
    total: s.total ?? 0,
  };
};

/** Compliance score as a number or null (indeterminate analysis). */
export const reportScore = (report) => {
  if (!report) return null;
  const raw = report.compliance_score;
  const num = raw === null || raw === undefined ? null : Number(raw);
  return num === null || Number.isNaN(num) ? null : num;
};

export { safeParse };
