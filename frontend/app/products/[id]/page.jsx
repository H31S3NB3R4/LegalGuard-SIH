'use client';

// Product compliance report - tododesign Phase 3 + design.md section 2.
// Fetches GET /api/product/<id> and renders the full report using only
// design-system components: header (name/seller/category, grade + score),
// per-declaration checklist (status, extracted value, layer attribution),
// AI assessment paragraph, and violations grouped by severity.

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Brain,
  ExternalLink,
  Package,
  Store,
} from 'lucide-react';
import AppShell from '../../../components/AppShell';
import {
  ProgressRing,
  CardHeader,
  ChecklistRow,
  StatusPill,
  EmptyState,
} from '../../../components/ui';
import { categoryMeta, formatMetaDate, severityMeta } from '../../../lib/design';
import {
  getReport,
  mergeFindings,
  normalizeViolations,
  violationSummary,
  reportScore,
  safeParse,
} from '../../../lib/report';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function ProductReportPage() {
  return (
    <Suspense fallback={null}>
      <ProductReportContent />
    </Suspense>
  );
}

function ProductReportContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params?.id;
  const userId = searchParams.get('userId');

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const res = await fetch(API_BASE_URL + '/api/product/' + productId, {
          credentials: 'include',
        });
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (res.status === 403) {
          if (!cancelled) setError('You can only view your own products.');
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError('Failed to load the product report.');
          return;
        }
        const data = await res.json();
        if (!cancelled) setProduct(data.product || null);
      } catch (err) {
        console.error('Error fetching product:', err);
        if (!cancelled) setError('Could not reach the LegalGuard backend.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const derived = useMemo(() => {
    if (!product) return null;
    const report = getReport(product);
    const sellerInfo = safeParse(product.seller_information) || {};
    const productJson = product.product_json || {};
    const category =
      productJson.detected_category || report?.category || sellerInfo?.category;
    const score = reportScore(report);
    const grade = report?.compliance_grade || 'N/A';
    const findings = mergeFindings(report);
    const violations = normalizeViolations(report);
    const summary = violationSummary(report);
    const isCompliant = report?.is_compliant ?? null;
    const status = String(report?.analysis_status || '').toLowerCase();
    const indeterminate =
      status.includes('indeterminate') || status.includes('demo_pending');
    return {
      report,
      sellerInfo,
      productJson,
      category,
      meta: categoryMeta(category),
      score,
      grade,
      findings,
      violations,
      summary,
      isCompliant,
      indeterminate,
    };
  }, [product]);

  const backHref = userId ? '/products?userId=' + userId : '/products';
  const scoreDisplay =
    derived && derived.score !== null ? Math.round(derived.score) + '%' : 'N/A';

  return (
    <AppShell
      title={derived ? 'Compliance report' : 'Product'}
      wide
      actions={
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-pill border border-default bg-surface text-sm font-medium text-secondary hover:text-primary hover:border-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Products
        </Link>
      }
    >
      {!derived ? (
        <div className="flex items-center justify-center py-24 text-secondary text-sm gap-2">
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Loading report...
            </>
          ) : notFound ? (
            'Product not found'
          ) : (
            (error || 'No product data')
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header - product name / seller / category, grade + score */}
          <section className="bg-surface border border-default rounded-card shadow-card p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <ProgressRing
                value={derived.score}
                size={132}
                thickness={10}
                label="Compliance score"
                centerValue={scoreDisplay}
                centerLabel={'Grade ' + derived.grade}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={
                      'inline-flex items-center h-6 px-2.5 rounded-pill border text-xs font-semibold capitalize ' +
                      (derived.indeterminate
                        ? 'bg-surface text-secondary border-default'
                        : derived.isCompliant
                          ? 'bg-surface text-success border-success'
                          : 'bg-surface text-critical border-critical')
                    }
                  >
                    {derived.indeterminate
                      ? 'Analysis pending'
                      : derived.isCompliant
                        ? 'Compliant'
                        : 'Non-compliant'}
                  </span>
                  <span
                    className={
                      'inline-flex items-center h-6 px-2.5 rounded-pill bg-surface border text-xs font-semibold ' +
                      derived.meta.text
                    }
                    style={{ borderColor: derived.meta.color }}
                  >
                    {derived.meta.label}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-primary leading-snug">
                  {product.title || product.asin}
                </h2>
                <p className="mt-1 text-xs text-secondary">
                  Seller: {derived.sellerInfo?.name || 'Unknown'} | ASIN{' '}
                  {product.asin} | {derived.meta.label}
                  {product.last_analysed
                    ? ' | Analyzed ' + formatMetaDate(product.last_analysed)
                    : ''}
                </p>
                {product.url ? (
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View original listing
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left 2/3 - checklist + assessment + violations */}
            <div className="xl:col-span-2 space-y-6">
              {/* Per-declaration checklist (Phase 3) */}
              <section className="bg-surface border border-default rounded-card shadow-card p-6">
                <CardHeader
                  title="Declaration checklist"
                  subtitle="Each mandatory declaration with the layer that verified it"
                />
                {derived.findings.length === 0 ? (
                  <EmptyState
                    icon={AlertCircle}
                    title="No declaration analysis available"
                    hint="Run a compliance analysis to populate this checklist."
                  />
                ) : (
                  derived.findings.map((f) => (
                    <ChecklistRow
                      key={f.requirement}
                      requirement={f.requirement}
                      status={f.status}
                      layer={f.layer}
                      value={f.value}
                    />
                  ))
                )}
              </section>

              {/* AI assessment paragraph (Phase 3) */}
              <section className="bg-surface border border-default rounded-card shadow-card p-6">
                <CardHeader
                  title="AI assessment"
                  subtitle="Generated from the actual analysis results"
                />
                {derived.report?.assessment ? (
                  <p className="text-sm leading-relaxed text-secondary whitespace-pre-line">
                    {derived.report.assessment}
                  </p>
                ) : (
                  <EmptyState
                    icon={Brain}
                    title="No assessment yet"
                    hint="An AI assessment is generated with every real analysis."
                  />
                )}
                {derived.report?.ocr_analysis?.extracted_text ? (
                  <details className="mt-4 group">
                    <summary className="cursor-pointer text-xs font-medium text-accent">
                      Show OCR extracted text
                    </summary>
                    <pre className="mt-2 p-3 bg-page border border-default rounded-tile text-xs text-secondary whitespace-pre-wrap thin-scrollbar max-h-48 overflow-auto">
                      {derived.report.ocr_analysis.extracted_text}
                    </pre>
                  </details>
                ) : null}
              </section>

              {/* Violations grouped by severity (Phase 3) */}
              <section className="bg-surface border border-default rounded-card shadow-card p-6">
                <CardHeader
                  title="Violations"
                  subtitle="Grouped by severity - critical, major, minor"
                />
                {derived.summary.total === 0 ? (
                  <EmptyState
                    icon={AlertCircle}
                    title="No violations recorded"
                    hint={
                      derived.indeterminate
                        ? 'Analysis has not completed yet - violations will appear here once graded.'
                        : 'This product satisfies the evaluated declarations.'
                    }
                  />
                ) : (
                  <div className="space-y-5">
                    {['critical', 'major', 'minor'].map((severity) => {
                      const items = derived.violations[severity];
                      if (!items || items.length === 0) return null;
                      const meta = severityMeta(severity);
                      return (
                        <div key={severity}>
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="w-2.5 h-2.5 rounded-pill"
                              style={{ backgroundColor: meta.color }}
                            />
                            <h4 className="text-sm font-semibold text-primary capitalize">
                              {severity}
                            </h4>
                            <span className="text-xs text-muted">
                              {items.length}
                            </span>
                          </div>
                          <div className="divide-y divide-default">
                            {items.map((v, i) => (
                              <div key={v.name + '-' + i} className="py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-sm font-medium text-primary">
                                    {v.name}
                                  </p>
                                  <StatusPill
                                    tone={severity === 'minor' ? 'neutral' : severity}
                                  >
                                    {v.type || 'missing'}
                                  </StatusPill>
                                </div>
                                {v.description ? (
                                  <p className="mt-1 text-xs text-secondary">
                                    {v.description}
                                  </p>
                                ) : null}
                                {v.remedy ? (
                                  <p className="mt-1 text-xs">
                                    <span className="font-medium text-primary">
                                      Remedy:
                                    </span>{' '}
                                    <span className="text-secondary">{v.remedy}</span>
                                  </p>
                                ) : null}
                                <p className="mt-1 text-[11px] text-muted">
                                  {v.rule_reference}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Right 1/3 - violation summary + seller + images */}
            <div className="space-y-6">
              <section className="bg-surface border border-default rounded-card shadow-card p-6">
                <CardHeader title="Violation summary" />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Critical', value: derived.summary.critical, tone: 'critical' },
                    { label: 'Major', value: derived.summary.major, tone: 'warning' },
                    { label: 'Minor', value: derived.summary.minor, tone: 'neutral' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="border border-default rounded-tile p-3 text-center"
                    >
                      <p
                        className="text-2xl font-bold tabular-nums"
                        style={{
                          color:
                            item.tone === 'critical'
                              ? 'var(--color-critical)'
                              : item.tone === 'warning'
                                ? 'var(--color-warning)'
                                : 'var(--color-secondary)',
                        }}
                      >
                        {item.value}
                      </p>
                      <p className="mt-0.5 text-xs text-secondary">{item.label}</p>
                    </div>
                  ))}
                </div>
                {derived.report?.recommendations?.length ? (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold text-primary mb-2">
                      Recommendations
                    </h4>
                    <ul className="space-y-2">
                      {derived.report.recommendations.map((rec, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-secondary"
                        >
                          <Sparkles className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              {/* Seller card */}
              <section className="bg-surface border border-default rounded-card shadow-card p-6">
                <CardHeader title="Seller" />
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-tile bg-cat-generic flex items-center justify-center">
                      <Store className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">
                        {derived.sellerInfo?.name || 'Unknown seller'}
                      </p>
                      <p className="text-xs text-secondary truncate">
                        {derived.sellerInfo?.ai_insights?.location || 'Location unknown'}
                      </p>
                    </div>
                  </div>
                  {product.price ? (
                    <p className="text-sm text-primary">
                      <span className="text-secondary text-xs">Price:</span>{' '}
                      {product.currency || 'INR'} {product.price}
                    </p>
                  ) : null}
                  {product.rating ? (
                    <p className="text-sm text-primary">
                      <span className="text-secondary text-xs">Rating:</span> {product.rating} / 5
                    </p>
                  ) : null}
                </div>
              </section>

              {/* Product images (from the API image list) */}
              {Array.isArray(product.images) && product.images.length > 0 ? (
                <section className="bg-surface border border-default rounded-card shadow-card p-6">
                  <CardHeader
                    title="Product images"
                    subtitle={product.images.length + ' stored'}
                  />
                  <div className="grid grid-cols-3 gap-3">
                    {product.images.slice(0, 6).map((img) => (
                      <a
                        key={img.image_id}
                        href={img.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block border border-default rounded-tile overflow-hidden hover:border-muted transition-colors"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt="Product"
                          className="w-full h-20 object-cover bg-page"
                        />
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
