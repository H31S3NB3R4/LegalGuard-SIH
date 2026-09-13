'use client';

// Products list - reskinned per design.md (Phase 3 companion). Preserves the
// existing functionality of the old dark page: live search, category and
// grade filters, pagination, and links to each product's compliance report.

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Loader2,
  AlertCircle,
  Package,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import {
  StatCard,
  CardHeader,
  EmptyState,
  ReviewButton,
  CountPillTab,
} from '../../components/ui';
import { categoryMeta, scoreColor } from '../../lib/design';
import { getReport, reportScore, violationSummary, safeParse } from '../../lib/report';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const PAGE_SIZE = 12;

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters (preserved from the old page)
  const [query, setQuery] = useState('');
  const [grade, setGrade] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [refreshing, setRefreshing] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE_URL + '/api/products/detailed', {
        credentials: 'include',
      });
      if (!res.ok) {
        setProducts([]);
        if (res.status === 401) {
          setError('Please log in to see your products.');
        }
      } else {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setProducts([]);
      setError('Could not reach the LegalGuard backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setTimeout(() => setRefreshing(false), 400);
  };

  /* Derived rows: score, category, summary per product. */
  const rows = useMemo(
    () =>
      products.map((p) => {
        const report = getReport(p);
        const sellerInfo = safeParse(p.seller_information) || {};
        const category =
          p.product_json?.detected_category || report?.category || sellerInfo?.category;
        return {
          product: p,
          report,
          score: reportScore(report),
          grade: report?.compliance_grade || 'N/A',
          summary: violationSummary(report),
          meta: categoryMeta(category),
          sellerName: sellerInfo?.name || 'Unknown seller',
        };
      }),
    [products]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = (
          (r.product.title || '') +
          ' ' +
          (r.product.asin || '') +
          ' ' +
          r.sellerName
        ).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (grade !== 'all') {
        const g = r.grade;
        if (grade === 'pass' && !(g.startsWith('A') || g.startsWith('B'))) return false;
        if (grade === 'warn' && !g.startsWith('C')) return false;
        if (grade === 'fail' && g !== 'F') return false;
        if (grade === 'none' && r.score !== null) return false;
      }
      if (categoryFilter !== 'all' && r.meta.key !== categoryFilter) return false;
      return true;
    });
  }, [rows, query, grade, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(() => {
    const analyzed = rows.filter((r) => r.score !== null);
    const compliant = rows.filter((r) => r.report?.is_compliant).length;
    const openViolations = rows.filter(
      (r) => !r.report?.is_compliant && (r.summary.total || 0) > 0
    ).length;
    const avgScore =
      analyzed.length === 0
        ? null
        : analyzed.reduce((a, r) => a + r.score, 0) / analyzed.length;
    return { total: rows.length, compliant, openViolations, avgScore };
  }, [rows]);

  const productHref = (r) =>
    '/products/' +
    r.product.product_id +
    (userId ? '?userId=' + userId : '');

  return (
    <AppShell
      title="Products"
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
          <Loader2 className="w-5 h-5 animate-spin" /> Loading products...
        </div>
      ) : error ? (
        <EmptyState icon={AlertCircle} title={error} hint="Then refresh this page." />
      ) : (
        <div className="space-y-6">
          {/* Stat row */}
          <section
            aria-label="Product stats"
            className="grid grid-cols-2 md:grid-cols-4 gap-5"
          >
            <StatCard label="Products tracked" value={stats.total} />
            <StatCard label="Compliant" value={stats.compliant} hint="Passed all checks" />
            <StatCard label="Open violations" value={stats.openViolations} />
            <StatCard
              label="Average score"
              value={
                stats.avgScore === null ? 'N/A' : Math.round(stats.avgScore) + '%'
              }
            />
          </section>

          {/* Filters (preserved functionality, reskinned) */}
          <section className="bg-surface border border-default rounded-card shadow-card p-4">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by title, ASIN or seller..."
                  className="w-full h-9 pl-10 pr-4 rounded-pill border border-default bg-surface text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="relative">
                  <select
                    value={grade}
                    onChange={(e) => {
                      setGrade(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 pl-3.5 pr-8 rounded-pill border border-default bg-surface text-sm text-primary focus:outline-none focus:border-accent appearance-none"
                  >
                    <option value="all">All grades</option>
                    <option value="pass">A / B (passing)</option>
                    <option value="warn">C (warning)</option>
                    <option value="fail">F (fail)</option>
                    <option value="none">Not analyzed</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
                </label>
                <label className="relative">
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 pl-3.5 pr-8 rounded-pill border border-default bg-surface text-sm text-primary focus:outline-none focus:border-accent appearance-none"
                  >
                    <option value="all">All categories</option>
                    <option value="food">Food</option>
                    <option value="electronics">Electronics</option>
                    <option value="skincare">Skincare</option>
                    <option value="books">Books</option>
                    <option value="generic">Other</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
                </label>
              </div>
            </div>
          </section>

          {/* Results header + list */}
          <section className="bg-surface border border-default rounded-card shadow-card p-6">
            <CardHeader
              title="Product reports"
              subtitle={
                filtered.length + ' product' + (filtered.length === 1 ? '' : 's') + ' match your filters'
              }
            />
            {filtered.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products found"
                hint="Try clearing the search or filters, or check a new listing from Check Compliance."
              />
            ) : (
              <div className="divide-y divide-default">
                {pageRows.map((r) => (
                  <div
                    key={r.product.product_id}
                    className="py-3.5 flex items-center gap-4"
                  >
                    <div
                      className={
                        'w-10 h-10 rounded-tile flex items-center justify-center shrink-0 ' +
                        r.meta.tile
                      }
                    >
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-primary truncate">
                        {r.product.title || r.product.asin}
                      </p>
                      <p className="text-xs text-secondary truncate">
                        {r.meta.label} | {r.sellerName} | Grade {r.grade}
                        {r.summary.total > 0
                          ? ' | ' + r.summary.total + ' violation' + (r.summary.total === 1 ? '' : 's')
                          : ''}
                      </p>
                    </div>
                    <span
                      className="text-sm font-semibold tabular-nums shrink-0"
                      style={{ color: scoreColor(r.score) }}
                    >
                      {r.score === null ? 'N/A' : Math.round(r.score) + '%'}
                    </span>
                    <ReviewButton href={productHref(r)} />
                  </div>
                ))}
              </div>
            )}

            {/* Pagination (preserved) */}
            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-secondary">
                  Page {safePage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="w-9 h-9 rounded-pill border border-default flex items-center justify-center text-secondary hover:text-primary hover:border-muted disabled:opacity-40 transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="w-9 h-9 rounded-pill border border-default flex items-center justify-center text-secondary hover:text-primary hover:border-muted disabled:opacity-40 transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </AppShell>
  );
}
