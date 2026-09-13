// Shared design-system helpers — frontend/design.md is the single source of
// truth. Everything here maps a domain value (score, category, severity) onto
// the token palette; no bespoke colors anywhere.

/**
 * Ring / progress color follows the success/warning/critical scale BY VALUE
 * (design.md §1): >= 80 success, 40–79 warning, < 40 critical. Null/unknown
 * scores render muted so an indeterminate analysis never reads as "failed".
 */
export function scoreColor(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return 'var(--color-muted)';
  }
  const value = Number(score);
  if (value >= 80) return 'var(--color-success)';
  if (value >= 40) return 'var(--color-warning)';
  return 'var(--color-critical)';
}

/** Tailwind class variant of scoreColor for text. */
export function scoreTextClass(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return 'text-muted';
  }
  const value = Number(score);
  if (value >= 80) return 'text-success';
  if (value >= 40) return 'text-warning';
  return 'text-critical';
}

/** Tailwind class variant of scoreColor for backgrounds. */
export function scoreBgClass(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return 'bg-muted';
  }
  const value = Number(score);
  if (value >= 80) return 'bg-success';
  if (value >= 40) return 'bg-warning';
  return 'bg-critical';
}

/**
 * Category accents (design.md §1) — Food / Electronics / Skincare / Books;
 * anything else maps to the Generic grey. Backend categories come through as
 * 'food', 'electric', 'skincare', 'book', 'cosmetics', 'amazon', … so match
 * generously and fall back to Generic.
 */
export const CATEGORY_META = {
  food: {
    key: 'food',
    label: 'Food',
    color: 'var(--color-cat-food)',
    tile: 'bg-cat-food',
    text: 'text-cat-food',
    bar: 'bg-cat-food',
  },
  electronics: {
    key: 'electronics',
    label: 'Electronics',
    color: 'var(--color-cat-electronics)',
    tile: 'bg-cat-electronics',
    text: 'text-cat-electronics',
    bar: 'bg-cat-electronics',
  },
  skincare: {
    key: 'skincare',
    label: 'Skincare',
    color: 'var(--color-cat-skincare)',
    tile: 'bg-cat-skincare',
    text: 'text-cat-skincare',
    bar: 'bg-cat-skincare',
  },
  books: {
    key: 'books',
    label: 'Books',
    color: 'var(--color-cat-books)',
    tile: 'bg-cat-books',
    text: 'text-cat-books',
    bar: 'bg-cat-books',
  },
  generic: {
    key: 'generic',
    label: 'Other',
    color: 'var(--color-cat-generic)',
    tile: 'bg-cat-generic',
    text: 'text-cat-generic',
    bar: 'bg-cat-generic',
  },
};

export function categoryMeta(category) {
  const key = String(category || '').toLowerCase();
  if (
    key.includes('food') ||
    key.includes('grocery') ||
    key.includes('beverage') ||
    key.includes('snack')
  ) {
    return CATEGORY_META.food;
  }
  if (key.includes('electric') || key.includes('electronic') || key.includes('gadget')) {
    return CATEGORY_META.electronics;
  }
  if (
    key.includes('skin') ||
    key.includes('cosmetic') ||
    key.includes('beauty') ||
    key.includes('personal care')
  ) {
    return CATEGORY_META.skincare;
  }
  if (key.includes('book') || key.includes('stationery')) {
    return CATEGORY_META.books;
  }
  return CATEGORY_META.generic;
}

/** Normalize the various backend category spellings to a canonical key. */
export function categoryLabel(category) {
  return categoryMeta(category).label;
}

/**
 * Severity → token mapping (design.md §1): critical → #DC2626, major →
 * #D97706 (needs-attention warning), minor → the Generic grey (no dedicated
 * token exists; grey is the closest existing pattern).
 */
export const SEVERITY_META = {
  critical: { color: 'var(--color-critical)', text: 'text-critical', bg: 'bg-critical' },
  major: { color: 'var(--color-warning)', text: 'text-warning', bg: 'bg-warning' },
  minor: { color: 'var(--color-cat-generic)', text: 'text-cat-generic', bg: 'bg-cat-generic' },
  high: { color: 'var(--color-critical)', text: 'text-critical', bg: 'bg-critical' },
  medium: { color: 'var(--color-warning)', text: 'text-warning', bg: 'bg-warning' },
  low: { color: 'var(--color-cat-generic)', text: 'text-cat-generic', bg: 'bg-cat-generic' },
};

export function severityMeta(severity) {
  const key = String(severity || '').toLowerCase();
  return SEVERITY_META[key] || SEVERITY_META.minor;
}

/** "Feb 14"-style short date used by the scheduled-item cards. */
export function formatShortDate(dateInput) {
  const date = dateInput ? new Date(dateInput) : null;
  if (!date || Number.isNaN(date.getTime())) return { month: '', day: '' };
  return {
    month: date.toLocaleString('en-US', { month: 'short' }),
    day: String(date.getDate()),
  };
}

/** "Feb 14, 2026 · 4:05 PM" style meta line. */
export function formatMetaDate(dateInput) {
  const date = dateInput ? new Date(dateInput) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
