'use client';

// Reusable design-system components — every pattern here is defined in
// frontend/design.md §2. Screens reuse these instead of one-off variants.
// No colors/radii/shadows outside the token palette (see app/globals.css).

import React from 'react';
import { scoreColor } from '../lib/design';

/* ---------------------------------------------------------------------------
 * Stat card — label (secondary, 12px) over a bold number (30px). Plain white
 * card, no icon required. Used in the top stat row. (design.md §2)
 * ------------------------------------------------------------------------- */
export function StatCard({ label, value, hint = null }) {
  return (
    <div className="bg-surface border border-default rounded-card shadow-card p-5">
      <p className="text-xs font-medium text-secondary">{label}</p>
      <p className="mt-1 text-[30px] leading-9 font-bold text-primary tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Compliance progress ring — donut with big % + label in the center. Ring
 * color follows the success/warning/critical scale BY VALUE, never a fixed
 * brand color. (design.md §2)
 * ------------------------------------------------------------------------- */
export function ProgressRing({
  value,
  size = 40,
  thickness = 4,
  label = null,
  centerValue,
  centerLabel = null,
  color,
}) {
  const numeric =
    value === null || value === undefined || Number.isNaN(Number(value))
      ? null
      : Math.max(0, Math.min(100, Number(value)));
  const stroke = color || scoreColor(numeric === null ? undefined : numeric);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = numeric === null ? 0 : (numeric / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ? `${label}: ${numeric ?? 'N/A'}` : undefined}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-track)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={thickness}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      {centerValue !== undefined ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold text-primary tabular-nums"
            style={{ fontSize: Math.max(12, size / 3) }}
          >
            {centerValue}
          </span>
          {centerLabel ? (
            <span
              className="text-secondary font-medium"
              style={{ fontSize: Math.max(9, size / 8) }}
            >
              {centerLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


/* ---------------------------------------------------------------------------
 * Category readiness card — small colored icon tile (40px square, 8px
 * radius), category name, readiness %, thin colored progress bar, footer
 * meta text. (design.md §2)
 * ------------------------------------------------------------------------- */
export function CategoryCard({
  icon: Icon,
  label,
  percent,
  footer = null,
  tileClass,
  barClass,
}) {
  const pct =
    percent === null || percent === undefined || Number.isNaN(Number(percent))
      ? null
      : Math.max(0, Math.min(100, Number(percent)));

  return (
    <div className="bg-surface border border-default rounded-card shadow-card p-5">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-tile ${tileClass} flex items-center justify-center text-white`}
        >
          {Icon ? <Icon className="w-5 h-5" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary truncate">{label}</p>
          <p className="text-xs text-secondary">
            {pct === null ? 'No analyses yet' : `${Math.round(pct)}% fully declared`}
          </p>
        </div>
        <span className="text-sm font-semibold text-primary tabular-nums">
          {pct === null ? '—' : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="mt-4 h-1.5 w-full bg-track rounded-pill overflow-hidden">
        <div
          className={`h-full rounded-pill ${barClass} transition-all duration-700`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      {footer ? <p className="mt-3 text-xs text-secondary">{footer}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Scheduled item card — date block (month abbreviation + bold day number) on
 * the left, icon + title on the right. (design.md §2)
 * ------------------------------------------------------------------------- */
export function ScheduledItemCard({ date, icon: Icon, title, meta = null, onClick }) {
  const d = date ? new Date(date) : null;
  const valid = d && !Number.isNaN(d.getTime());
  const month = valid ? d.toLocaleString('en-US', { month: 'short' }) : '—';
  const day = valid ? String(d.getDate()) : '–';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-surface border border-default rounded-card shadow-card p-4 flex items-center gap-4 hover:border-muted transition-colors"
    >
      <div className="w-12 shrink-0 flex flex-col items-center border border-default rounded-tile py-2 bg-page">
        <span className="text-xs font-medium text-secondary uppercase">{month}</span>
        <span className="text-lg font-bold text-primary leading-none">{day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="w-4 h-4 text-secondary shrink-0" /> : null}
          <p className="text-sm font-medium text-primary truncate">{title}</p>
        </div>
        {meta ? <p className="mt-0.5 text-xs text-secondary truncate">{meta}</p> : null}
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * Pill tab — count badge, active tab white + shadow on a light grey track.
 * (design.md §2 "Tabbed attention list")
 * ------------------------------------------------------------------------- */
export function CountPillTab({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 px-3.5 h-8 rounded-pill text-sm font-medium transition-colors ${
        active
          ? 'bg-surface text-primary shadow-card'
          : 'text-secondary hover:text-primary'
      }`}
    >
      {label}
      <span
        className={`min-w-5 h-5 px-1.5 rounded-pill text-xs font-semibold flex items-center justify-center tabular-nums ${
          active ? 'bg-accent text-white' : 'bg-default text-secondary'
        }`}
      >
        {count}
      </span>
    </button>
  );
}


/* ---------------------------------------------------------------------------
 * "Review" pill button (design.md §2 — the Resolve-button equivalent).
 * ------------------------------------------------------------------------- */
export function ReviewButton({ onClick, href, children = 'Review', disabled = false }) {
  if (href) {
    return (
      <a
        href={href}
        className="inline-flex items-center justify-center h-8 px-4 rounded-pill bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center h-8 px-4 rounded-pill bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * Card header — title 15–16px/600 + optional right-side action. (design.md §1)
 * ------------------------------------------------------------------------- */
export function CardHeader({ title, subtitle = null, action = null }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="text-base font-semibold text-primary">{title}</h3>
        {subtitle ? <p className="text-xs text-secondary mt-0.5">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Empty state — plain, token-only placeholder for zero-data cases.
 * ------------------------------------------------------------------------- */
export function EmptyState({ icon: Icon, title, hint = null }) {
  return (
    <div className="py-10 flex flex-col items-center text-center gap-2">
      {Icon ? <Icon className="w-8 h-8 text-muted" /> : null}
      <p className="text-sm font-medium text-secondary">{title}</p>
      {hint ? <p className="text-xs text-muted max-w-xs">{hint}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Status pill — found/missing/inadequate or severity chips (Phase 3/4).
 * ------------------------------------------------------------------------- */
export function StatusPill({ tone = 'neutral', children }) {
  const tones = {
    success: 'bg-surface text-success border-success',
    warning: 'bg-surface text-warning border-warning',
    critical: 'bg-surface text-critical border-critical',
    neutral: 'bg-surface text-secondary border-default',
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      className={`inline-flex items-center h-6 px-2.5 rounded-pill border text-xs font-semibold capitalize ${t}`}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Checklist row (Phase 3/4) — requirement name, status (found / missing /
 * inadequate), extracted value, which layer caught it (rule engine vs Gemini).
 * (design.md §2 + tododesign Phase 3)
 * ------------------------------------------------------------------------- */
export function ChecklistRow({ requirement, status, layer = null, value = null }) {
  const tone =
    status === 'found' || status === 'present' || status === 'compliant'
      ? 'success'
      : status === 'partial' || status === 'inadequate' || status === 'unclear'
        ? 'warning'
        : 'critical';
  const label =
    status === 'partial' || status === 'unclear'
      ? 'inadequate'
      : status === 'present'
        ? 'found'
        : status;

  return (
    <div className="py-3 border-b border-default last:border-b-0 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
      <div className="flex items-start gap-3 sm:flex-1 min-w-0">
        <div className="mt-0.5 shrink-0">
          <StatusPill tone={tone}>{label}</StatusPill>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">{requirement}</p>
          {value ? (
            <p className="mt-1 text-xs text-secondary break-words">
              <span className="font-medium">Extracted:</span> {value}
            </p>
          ) : null}
        </div>
      </div>
      {layer ? (
        <span className="text-xs text-muted shrink-0 sm:pt-1">{layer}</span>
      ) : null}
    </div>
  );
}
