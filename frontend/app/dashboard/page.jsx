'use client';

// Dashboard — reskinned per frontend/design.md §2/§3 + tododesign Phase 2.
// All data comes from real API endpoints (no mock arrays):
//   GET /api/products/detailed — products + persisted compliance reports
//   GET /api/global-heatmap    — seller rows for "Sellers not yet verified"

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  Store,
  ScanLine,
  Loader2,
  Eye,
  Utensils,
  Cpu,
  Sparkles,
  BookOpen,
  Package,
  RefreshCw,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import {
  StatCard,
  ProgressRing,
  CategoryCard,
  ScheduledItemCard,
  CountPillTab,
  ReviewButton,
  CardHeader,
  EmptyState,
} from '../../components/ui';
import { categoryMeta, scoreColor, formatMetaDate } from '../../lib/design';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

/* ---------------------------------------------------------------------------
 * Data helpers — derive dashboard metrics from the real product rows.
 * ------------------------------------------------------------------------- */
const safeParseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/** Latest analysis for a product (compliance_report is pre-parsed by the API). */
const reportOf = (p) => p.compliance_report || safeParseJson(p.analysis_results) || null;

const scoreOf = (p) => {
  const score = reportOf(p)?.compliance_score;
  const num = score === null || score === undefined ? null : Number(score);
  return num === null || Number.isNaN(num) ? null : num;
};

const isOpenViolation = (p) => {
  const report = reportOf(p);
  if (!report) return false;
  if (report.is_compliant) return false;
  const summary = report.violation_summary || {};
  return (summary.total || 0) > 0 || report.requires_action === true;
};

const isStale = (p, now) => {
  if (!p.last_analysed) return true;
  const then = new Date(p.last_analysed).getTime();
  if (Number.isNaN(then)) return true;
  return now - then > 30 * 24 * 60 * 60 * 1000;
};

/** Declarations found = compliance score share (score is the persisted weighted
 * rate of satisfied rule checks). */
const declarationsRate = (p) => scoreOf(p);

/** Label-OCR coverage: 100 when a successful OCR pass exists, else 0. */
const ocrCoverage = (p) => {
  const ocr = reportOf(p)?.ocr_analysis || p.ocr_analysis;
  if (!ocr) return null;
  if (ocr.success === true) return 100;
  if (ocr.success === false) return 0;
  return null;
};

/** Rule-checks pass rate: 10 canonical checks âˆ’ violations. */
const ruleChecksRate = (p) => {
  const report = reportOf(p);
  if (!report) return null;
  const summary = report.violation_summary || {};
  const total = summary.total ?? 0;
  if (total === 0 && scoreOf(p) === null) return null;
  const checks = 10;
  return Math.max(0, Math.min(100, ((checks - total) / checks) * 100));
};

const avg = (arr) => {
  const values = arr.filter((v) => v !== null && !Number.isNaN(v));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

/* ---------------------------------------------------------------------------
 * Dashboard
 * ------------------------------------------------------------------------- */
export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');

  const [products, setProducts] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('products');
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/detailed`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }

    // Seller rows for "Sellers not yet verified" (global heatmap endpoint).
    try {
      const res = await fetch(`${API_BASE_URL}/api/global-heatmap`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSellers(data.global_heatmap_data || []);
      }
    } catch {
      setSellers([]);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, userId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setTimeout(() => setRefreshing(false), 400);
  };

  /* -----------------------------------------------------------------------
   * Derived metrics (real data only).
   * --------------------------------------------------------------------- */
  const now = useMemo(() => Date.now(), []);

  const openViolations = useMemo(
    () => products.filter(isOpenViolation),
    [products]
  );
  const staleListings = useMemo(
    () => products.filter((p) => isStale(p, now)),
    [products]
  );
  const inProgress = useMemo(
    () =>
      products.filter((p) => {
        const report = reportOf(p);
        if (!report) return !p.last_analysed;
        const status = String(report.analysis_status || '').toLowerCase();
        return (
          status.includes('pending') ||
          status.includes('queued') ||
          status.includes('running')
        );
      }),
    [products]
  );

  // Sellers not yet verified = seller rows with no compliance data yet.
  const unverifiedSellers = useMemo(
    () =>
      sellers.filter(
        (s) =>
          s.avg_compliance_score === null ||
          s.avg_compliance_score === undefined ||
          Number(s.avg_compliance_score) === 0
      ),
    [sellers]
  );

  // Public compliance reports viewed: the backend has no view counter, so
  // this reports analyses available as public reports — closest real mapping
  // for design.md §3 (flagged per tododesign instructions).
  const publicReportsViewed = useMemo(
    () => products.filter((p) => reportOf(p) && p.last_analysed).length,
    [products]
  );

  const overallScore = useMemo(() => avg(products.map(scoreOf)), [products]);
  const declarations = useMemo(
    () => avg(products.map(declarationsRate)),
    [products]
  );
  const ocr = useMemo(() => avg(products.map(ocrCoverage)), [products]);
  const ruleChecks = useMemo(() => avg(products.map(ruleChecksRate)), [products]);

  /* Category readiness — grouped by design.md categories. */
  const categoryCards = useMemo(() => {
    const groups = { food: [], electronics: [], skincare: [], books: [], generic: [] };
    products.forEach((p) => {
      const meta = categoryMeta(
        p.product_json?.detected_category || reportOf(p)?.category
      );
      groups[meta.key].push(p);
    });
    const defs = [
      { key: 'food', icon: Utensils, label: 'Food' },
      { key: 'electronics', icon: Cpu, label: 'Electronics' },
      { key: 'skincare', icon: Sparkles, label: 'Skincare' },
      { key: 'books', icon: BookOpen, label: 'Books' },
    ];
    return defs.map((def) => {
      const items = groups[def.key] || [];
      const meta = categoryMeta(def.key);
      const readiness = avg(items.map(scoreOf));
      return {
        ...def,
        meta,
        count: items.length,
        readiness,
        footer:
          items.length === 0
            ? 'No products analyzed yet'
            : `${items.length} product${items.length === 1 ? '' : 's'} analyzed`,
      };
    });
  }, [products]);

  /* Flagged lists per tab (design.md §3 content mapping). */
  const flaggedProducts = useMemo(
    () =>
      [...openViolations]
        .sort((a, b) => (scoreOf(a) ?? 101) - (scoreOf(b) ?? 101))
        .slice(0, 6),
    [openViolations]
  );

  const flaggedSellers = useMemo(
    () => unverifiedSellers.slice(0, 6),
    [unverifiedSellers]
  );

  // Flagged declarations: products whose report names missing critical info.
  const flaggedDeclarations = useMemo(() => {
    const rows = [];
    products.forEach((p) => {
      const report = reportOf(p);
      const missing = report?.data_analysis?.missing_critical_info || [];
      if (missing.length > 0) {
        rows.push({ product: p, missing });
      }
    });
    return rows
      .sort((a, b) => b.missing.length - a.missing.length)
      .slice(0, 6);
  }, [products]);

  /* Recent / scheduled analyses (design.md §3 — replaces "Upcoming Audits"). */
  const recentAnalyses = useMemo(
    () =>
      [...products]
        .filter((p) => p.last_analysed || p.created_at)
        .sort(
          (a, b) =>
            new Date(b.last_analysed || b.created_at || 0) -
            new Date(a.last_analysed || a.created_at || 0)
        )
        .slice(0, 5),
    [products]
  );

  const tabCounts = {
    products: flaggedProducts.length,
    sellers: flaggedSellers.length,
    declarations: flaggedDeclarations.length,
  };

  const navWithParams = (path) =>
    userId ? `/${path}?userId=${userId}` : `/${path}`;

  const productHref = (p) =>
    `/products/${p.product_id}${userId ? `?userId=${userId}` : ''}`;

  return (
    <AppShell
      title="Dashboard"
      wide
      actions={
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-pill border border-default bg-surface text-sm font-medium text-secondary hover:text-primary hover:border-muted transition-colors disabled:opacity-50"
        >
          {refreshing || loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-24 text-secondary text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading dashboard…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top stat row (design.md §3 — Open Risks … mapping) */}
          <section
            aria-label="Key metrics"
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5"
          >
            <StatCard
              label="Open violations"
              value={openViolations.length}
              hint="Unresolved, across all products"
            />
            <StatCard
              label="Sellers not verified"
              value={unverifiedSellers.length}
              hint="No compliance data yet"
            />
            <StatCard
              label="Listings not re-scanned"
              value={staleListings.length}
              hint="Older than 30 days"
            />
            <StatCard
              label="Analyses in progress"
              value={inProgress.length}
              hint="Queued or running"
            />
            <StatCard
              label="Reports viewed"
              value={publicReportsViewed}
              hint="Compliance reports available"
            />
          </section>

          {/* Compliance progress (large donut + 3 sub-rings, design.md §2) */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-surface border border-default rounded-card shadow-card p-6">
              <CardHeader
                title="Compliance progress"
                subtitle="Overall weighted compliance score across all analyzed products"
              />
              {products.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No products analyzed yet"
                  hint="Run a compliance check to see your score here."
                />
              ) : (
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <ProgressRing
                    value={overallScore}
                    size={200}
                    thickness={14}
                    label="Overall compliance score"
                    centerValue={
                      overallScore === null ? 'N/A' : `${Math.round(overallScore)}%`
                    }
                    centerLabel="Compliant"
                  />
                  <div className="flex-1 w-full space-y-5">
                    {[
                      { label: 'Declarations found', value: declarations },
                      { label: 'Label OCR coverage', value: ocr },
                      { label: 'Rule checks passed', value: ruleChecks },
                    ].map((sub) => (
                      <div key={sub.label} className="flex items-center gap-4">
                        <ProgressRing
                          value={sub.value}
                          size={56}
                          thickness={5}
                          label={sub.label}
                          centerValue={
                            sub.value === null ? '—' : `${Math.round(sub.value)}`
                          }
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-primary">
                            {sub.label}
                          </p>
                          <p className="text-xs text-secondary">
                            {sub.value === null
                              ? 'No data'
                              : `${Math.round(sub.value)}% of analyzed products`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Categories grid — readiness per design.md category (§2/§3) */}
            <div className="bg-surface border border-default rounded-card shadow-card p-6">
              <CardHeader
                title="Categories"
                subtitle="% fully declared per category"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
                {categoryCards.map((cat) => (
                  <CategoryCard
                    key={cat.key}
                    icon={cat.icon}
                    label={cat.label}
                    percent={cat.readiness}
                    footer={cat.footer}
                    tileClass={cat.meta.tile}
                    barClass={cat.meta.bar}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Flagged items panel — tabs Products / Sellers / Declarations
           * (design.md §2 "Tabbed attention list", §3 content mapping) */}
          <section className="bg-surface border border-default rounded-card shadow-card p-6">
            <CardHeader
              title="Needs attention"
              subtitle="Flagged items across your portfolio"
            />
            <div className="inline-flex items-center gap-1 p-1 rounded-pill bg-page mb-2">
              <CountPillTab
                label="Products"
                count={tabCounts.products}
                active={tab === 'products'}
                onClick={() => setTab('products')}
              />
              <CountPillTab
                label="Sellers"
                count={tabCounts.sellers}
                active={tab === 'sellers'}
                onClick={() => setTab('sellers')}
              />
              <CountPillTab
                label="Declarations"
                count={tabCounts.declarations}
                active={tab === 'declarations'}
                onClick={() => setTab('declarations')}
              />
            </div>

            <div className="divide-y divide-default">
              {tab === 'products'
                ? flaggedProducts.length === 0
                  ? (
                    <EmptyState
                      icon={Package}
                      title="No open violations"
                      hint="Products with unresolved violations appear here."
                    />
                  )
                  : flaggedProducts.map((p) => {
                      const score = scoreOf(p);
                      const meta = categoryMeta(
                        p.product_json?.detected_category || reportOf(p)?.category
                      );
                      const summary = reportOf(p)?.violation_summary || {};
                      return (
                        <div
                          key={p.product_id}
                          className="py-3.5 flex items-center gap-4"
                        >
                          <div
                            className={`w-10 h-10 rounded-tile ${meta.tile} flex items-center justify-center shrink-0`}
                          >
                            <Package className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-primary truncate">
                              {p.title || p.asin}
                            </p>
                            <p className="text-xs text-secondary truncate">
                              {meta.label} ·{' '}
                              {summary.total
                                ? `${summary.total} violation${summary.total === 1 ? '' : 's'}`
                                : 'Needs review'}{' '}
                              ·{' '}
                              <span
                                className="font-semibold"
                                style={{ color: scoreColor(score) }}
                              >
                                {score === null ? 'N/A' : `${Math.round(score)}%`}
                              </span>
                            </p>
                          </div>
                          <ReviewButton href={productHref(p)} />
                        </div>
                      );
                    })
                : null}

              {tab === 'sellers'
                ? flaggedSellers.length === 0
                  ? (
                    <EmptyState
                      icon={Store}
                      title="All sellers verified"
                      hint="Sellers without compliance data appear here."
                    />
                  )
                  : flaggedSellers.map((s, i) => (
                      <div
                        key={`${s.seller_name}-${s.location}-${i}`}
                        className="py-3.5 flex items-center gap-4"
                      >
                        <div className="w-10 h-10 rounded-tile bg-cat-generic flex items-center justify-center shrink-0">
                          <Store className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-primary truncate">
                            {s.seller_name || 'Unknown seller'}
                          </p>
                          <p className="text-xs text-secondary truncate">
                            {s.location || 'Location unknown'} ·{' '}
                            {s.total_scrapes || 0} listing
                            {(s.total_scrapes || 0) === 1 ? '' : 's'} · not verified
                          </p>
                        </div>
                        <ReviewButton href={navWithParams('entities')}>
                          Review
                        </ReviewButton>
                      </div>
                    ))
                : null}

              {tab === 'declarations'
                ? flaggedDeclarations.length === 0
                  ? (
                    <EmptyState
                      icon={AlertCircle}
                      title="No flagged declarations"
                      hint="Missing mandatory declarations appear here."
                    />
                  )
                  : flaggedDeclarations.map(({ product, missing }) => {
                      const meta = categoryMeta(
                        product.product_json?.detected_category
                      );
                      return (
                        <div
                          key={product.product_id}
                          className="py-3.5 flex items-center gap-4"
                        >
                          <div
                            className={`w-10 h-10 rounded-tile ${meta.tile} flex items-center justify-center shrink-0`}
                          >
                            <AlertCircle className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-primary truncate">
                              {product.title || product.asin}
                            </p>
                            <p className="text-xs text-secondary truncate">
                              Missing: {missing.slice(0, 3).join(', ')}
                              {missing.length > 3 ? ` +${missing.length - 3}` : ''}
                            </p>
                          </div>
                          <ReviewButton href={productHref(product)} />
                        </div>
                      );
                    })
                : null}
            </div>
          </section>

          {/* Recent / scheduled analyses (design.md §2 scheduled item card) */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-surface border border-default rounded-card shadow-card p-6">
              <CardHeader
                title="Recent & scheduled analyses"
                subtitle="Latest batch analyses by category"
              />
              {recentAnalyses.length === 0 ? (
                <EmptyState
                  icon={ScanLine}
                  title="No analyses yet"
                  hint="Analyzed products appear here with their most recent run."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recentAnalyses.map((p) => {
                    const meta = categoryMeta(
                      p.product_json?.detected_category || reportOf(p)?.category
                    );
                    const CatIcon =
                      meta.key === 'food'
                        ? Utensils
                        : meta.key === 'electronics'
                          ? Cpu
                          : meta.key === 'skincare'
                            ? Sparkles
                            : meta.key === 'books'
                              ? BookOpen
                              : Package;
                    return (
                      <ScheduledItemCard
                        key={p.product_id}
                        date={p.last_analysed || p.created_at}
                        icon={CatIcon}
                        title={p.title || p.asin}
                        meta={`${meta.label} · ${
                          scoreOf(p) === null
                            ? 'not graded'
                            : `score ${Math.round(scoreOf(p))}%`
                        } · ${formatMetaDate(p.last_analysed || p.created_at)}`}
                        onClick={() => {
                          window.location.href = productHref(p);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick actions — links into existing flows (no new endpoints) */}
            <div className="bg-surface border border-default rounded-card shadow-card p-6">
              <CardHeader title="Quick actions" />
              <div className="space-y-3">
                <Link
                  href={navWithParams('check-compliance')}
                  className="flex items-center gap-3 h-11 px-4 rounded-pill border border-default text-sm font-medium text-primary hover:border-muted transition-colors"
                >
                  <ScanLine className="w-4 h-4 text-secondary" />
                  Check a new listing
                </Link>
                <Link
                  href={navWithParams('entities')}
                  className="flex items-center gap-3 h-11 px-4 rounded-pill border border-default text-sm font-medium text-primary hover:border-muted transition-colors"
                >
                  <Store className="w-4 h-4 text-secondary" />
                  Seller heatmap
                </Link>
                <Link
                  href={navWithParams('seller-verification')}
                  className="flex items-center gap-3 h-11 px-4 rounded-pill border border-default text-sm font-medium text-primary hover:border-muted transition-colors"
                >
                  <Eye className="w-4 h-4 text-secondary" />
                  Pre-upload validator
                </Link>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
