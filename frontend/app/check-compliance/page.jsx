'use client';

// Check Compliance (scan flow) - reskinned per design.md (Phase 3). Preserves
// ALL existing functionality: Amazon URL validation, scrape + auto-analysis
// via POST /api/scrape, staged loading feedback, purchase-success flow that
// awards Meta-Tokens via POST /api/gifts/add-tokens, and the full results.

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  Loader2,
  AlertCircle,
  ExternalLink,
  Star,
  Package,
  Store,
  Brain,
  FileCheck,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  Coins,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { CardHeader, ProgressRing, EmptyState } from '../../components/ui';
import { categoryMeta, scoreColor } from '../../lib/design';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function CheckCompliancePage() {
  return (
    <Suspense fallback={null}>
      <CheckComplianceContent />
    </Suspense>
  );
}

function extractField(obj, field) {
  if (!obj || typeof obj !== 'object') return null;
  const direct = obj[field];
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === field.toLowerCase()) {
      const v = obj[key];
      if (v !== null && v !== '' && typeof v !== 'object') return v;
    }
  }
  return null;
}

function CheckComplianceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Authentication (URL params OR localStorage - preserved behavior)
  useEffect(() => {
    const userIdParam = searchParams.get('userId');
    const roleParam = searchParams.get('role');
    if (userIdParam && roleParam) {
      setUserId(parseInt(userIdParam));
      setUserRole(roleParam);
      setIsAuthenticated(true);
      localStorage.setItem('user_id', userIdParam);
      localStorage.setItem('user_role', roleParam);
      localStorage.setItem('isAuthenticated', 'true');
    } else {
      const storedUserId = localStorage.getItem('user_id');
      const storedRole = localStorage.getItem('user_role');
      const storedAuth = localStorage.getItem('isAuthenticated');
      if (storedUserId && storedRole && storedAuth === 'true') {
        setUserId(parseInt(storedUserId));
        setUserRole(storedRole);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setTimeout(() => router.push('/auth/login'), 2000);
      }
    }
  }, [searchParams, router]);

  // Scan state
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [productData, setProductData] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [error, setError] = useState(null);

  // Purchase modal states (preserved)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseProcessing, setPurchaseProcessing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);
  const [earnedTokens, setEarnedTokens] = useState(0);

  // Scrape + auto-compliance (preserved logic)
  const handleScrapeProduct = async () => {
    if (!isAuthenticated || !userId || !userRole) {
      setError('Authentication required. Redirecting to login...');
      setTimeout(() => {
        localStorage.clear();
        router.push('/auth/login');
      }, 1500);
      return;
    }

    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    const trimmedUrl = url.trim();
    const isAmazonUrl =
      /amazon\.[a-z.]+|amzn\./i.test(trimmedUrl) ||
      /\/dp\//.test(trimmedUrl) ||
      /\/gp\/product\//.test(trimmedUrl);

    if (!isAmazonUrl) {
      setError(
        trimmedUrl.includes('flipkart')
          ? 'Flipkart scraping is not yet available. Please enter an Amazon product URL (such as https://www.amazon.in/dp/XXXXXXXXXX) to run a compliance check.'
          : 'Unsupported marketplace. Please enter a valid Amazon product URL.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setProductData(null);
    setComplianceData(null);
    setLoadingStage('Authenticating user session...');

    try {
      setTimeout(() => setLoadingStage('Connecting to marketplace...'), 500);
      setTimeout(() => setLoadingStage('Extracting product information...'), 1500);
      setTimeout(() => setLoadingStage('Downloading product images...'), 3000);
      setTimeout(() => setLoadingStage('Processing metadata...'), 4500);
      setTimeout(() => setLoadingStage('Running AI compliance analysis...'), 6000);

      const response = await fetch(API_BASE_URL + '/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim(), auto_analyze: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          setError('Session expired. Please log in again.');
          setTimeout(() => router.push('/auth/login'), 1500);
          return;
        }
        throw new Error(data.error || 'Failed to scrape product');
      }

      const transformedProductData = {
        product: {
          product_id: data.product_id,
          asin: data.asin,
          title: data.title,
          price: data.price,
          currency: data.currency,
          image: data.image,
          images: data.images || [],
          url: trimmedUrl,
          seller_name: data.seller_info?.name,
          seller_type: data.seller_info?.ai_insights?.seller_type,
          seller_location: data.seller_info?.ai_insights?.location,
          seller_reputation: data.seller_info?.ai_insights?.reputation,
          seller_description: data.seller_info?.ai_insights?.description,
          store_url: data.seller_info?.store_url || null,
          category: extractField(data.seller_info, 'category') || 'General',
          listed_price: extractField(data.seller_info, 'price') || data.price,
          rating: extractField(data.seller_info, 'rating'),
          review_count: extractField(data.seller_info, 'reviews_count'),
          country_of_origin: extractField(data.seller_info, 'country_of_origin'),
          manufacturer: extractField(data.seller_info, 'manufacturer'),
          weight: extractField(data.seller_info, 'weight'),
          dimensions: extractField(data.seller_info, 'dimensions'),
          description: extractField(data.seller_info, 'description'),
          importer: extractField(data.seller_info, 'importer'),
          importer_email: extractField(data.seller_info, 'importer_email'),
          importer_phone: extractField(data.seller_info, 'importer_phone'),
          isbn_10: extractField(data.seller_info, 'isbn_10'),
          isbn_13: extractField(data.seller_info, 'isbn_13'),
          publisher: extractField(data.seller_info, 'publisher'),
          // Phase 12: score stays null when indeterminate - never a fake 0/F.
          compliance_score: data.compliance_analysis?.score ?? null,
          compliance_grade: data.compliance_analysis?.grade || null,
          analysis_mode: data.compliance_analysis?.analysis_mode || null,
          analysis_status: data.compliance_analysis?.analysis_status || null,
          is_compliant: data.compliance_analysis?.is_compliant || false,
          requires_action: data.compliance_analysis?.requires_action || false,
          violations_count: data.compliance_analysis?.violations_count || 0,
          images_stored: data.images_stored || 0,
          is_update: data.is_update || false,
          crawled_at: new Date().toISOString(),
        }
      };

      setProductData(transformedProductData);

      if (data.compliance_analysis) {
        const ca = data.compliance_analysis;
        const assessmentText =
          ca.assessment ||
          'Compliance grade ' + String(ca.grade) + ' with a score of ' +
          (ca.score != null ? ca.score + '%' : 'no score (analysis incomplete)') + '. ' +
          (ca.analysis_status === 'indeterminate'
            ? 'The AI compliance service was unavailable, so the product could not be graded.'
            : ca.is_compliant
              ? 'Product is compliant with current regulations.'
              : 'Product has compliance violations that need attention.');
        setComplianceData({
          compliance_score: ca.score,
          final_grade: ca.grade,
          analysis_mode: ca.analysis_mode || null,
          analysis_status: ca.analysis_status || null,
          is_compliant: ca.is_compliant,
          requires_action: ca.requires_action,
          violations_count: ca.violations_count,
          passed_checks: ca.is_compliant ? 1 : 0,
          failed_checks: ca.violations_count || 0,
          total_checks: 1 + (ca.violations_count || 0),
          gemini_analysis: { assessment: assessmentText },
        });
      }

      setLoadingStage('');
    } catch (err) {
      console.error('[API ERROR]', err);
      setError(err.message || 'Failed to fetch product data');
      setLoadingStage('');
    } finally {
      setLoading(false);
    }
  };

  // Purchase Success - award MT Tokens (preserved)
  const handlePurchaseSuccess = async () => {
    if (!productData?.product?.price && !productData?.product?.listed_price) {
      setPurchaseError('Product price not available');
      return;
    }

    setPurchaseProcessing(true);
    setPurchaseError(null);

    try {
      const productPrice = parseFloat(
        productData.product.price || productData.product.listed_price
      );
      const tokensToAdd = Math.floor(productPrice / 100);

      const response = await fetch(API_BASE_URL + '/api/gifts/add-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mt_tokens: tokensToAdd }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          setPurchaseError('Session expired. Please log in again.');
          setTimeout(() => router.push('/auth/login'), 1500);
          return;
        }
        if (response.status === 403 && data.code === 'SELF_MINT_DISABLED') {
          setPurchaseError(
            'Meta-Tokens are awarded automatically for verified compliance checks, not for purchases.'
          );
          return;
        }
        if (response.status === 403) {
          setPurchaseError('Only customers can earn tokens');
          return;
        }
        throw new Error(data.error || 'Failed to add tokens');
      }

      setEarnedTokens(data.tokens_added);
      setPurchaseSuccess(true);
      setTimeout(() => {
        setShowPurchaseModal(false);
        setPurchaseSuccess(false);
        setEarnedTokens(0);
      }, 3000);
    } catch (err) {
      console.error('[PURCHASE ERROR]', err);
      setPurchaseError(err.message || 'Failed to process');
    } finally {
      setPurchaseProcessing(false);
    }
  };

  const p = productData?.product;
  const score = p?.compliance_score != null ? Number(p.compliance_score) : null;

  return (
    <AppShell title="Check Compliance">
      {!isAuthenticated ? (
        <EmptyState
          icon={AlertCircle}
          title="Authentication required"
          hint="Please log in to access this page. Redirecting to login..."
        />
      ) : (
        <div className="space-y-6">
          {/* Search card */}
          <section className="bg-surface border border-default rounded-card shadow-card p-6">
            <CardHeader
              title="Scan a product listing"
              subtitle="Validate an Amazon product against Legal Metrology standards"
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleScrapeProduct();
                  }}
                  placeholder="https://www.amazon.in/dp/XXXXXXXXXX"
                  className="w-full h-11 pl-10 pr-4 rounded-pill border border-default bg-surface text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                  disabled={loading}
                />
              </div>
              <button
                type="button"
                onClick={handleScrapeProduct}
                disabled={loading || !url.trim()}
                className="h-11 px-6 rounded-pill bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    Check compliance
                  </>
                )}
              </button>
            </div>

            {loading && loadingStage ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" />
                {loadingStage}
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 flex items-start gap-2 border border-critical rounded-tile p-3 text-sm text-critical">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            ) : null}
          </section>

          {/* Product result */}
          {productData && p ? (
            <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <div className="bg-surface border border-default rounded-card shadow-card p-6">
                  <CardHeader title="Product" subtitle={p.is_update ? 'Existing listing updated' : 'New listing scanned'} />
                  <div className="flex flex-col sm:flex-row gap-6">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt={p.title || 'Product'}
                        className="w-full sm:w-40 h-40 object-cover rounded-tile border border-default bg-page"
                      />
                    ) : (
                      <div className="w-full sm:w-40 h-40 rounded-tile border border-default bg-page flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-primary leading-snug">
                        {p.title || p.asin}
                      </h3>
                      <p className="mt-1 text-xs text-secondary">
                        ASIN {p.asin} | {p.category}
                        {p.rating ? ' | Rating ' + p.rating : ''}
                        {p.review_count ? ' (' + p.review_count + ' reviews)' : ''}
                      </p>
                      {p.price ? (
                        <p className="mt-2 text-2xl font-bold text-primary">
                          {p.currency || 'INR'} {p.price}
                        </p>
                      ) : null}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {p.compliance_grade ? (
                          <span
                            className={
                              'inline-flex items-center h-6 px-2.5 rounded-pill border text-xs font-semibold ' +
                              (p.is_compliant
                                ? 'bg-surface text-success border-success'
                                : 'bg-surface text-critical border-critical')
                            }
                          >
                            Grade {p.compliance_grade}
                          </span>
                        ) : null}
                        {p.country_of_origin ? (
                          <span className="inline-flex items-center h-6 px-2.5 rounded-pill border border-default bg-surface text-xs font-semibold text-secondary">
                            Origin: {p.country_of_origin}
                          </span>
                        ) : null}
                      </div>
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open on Amazon
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {/* Declarations quick grid (top listing fields) */}
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Manufacturer', value: p.manufacturer },
                      { label: 'Weight', value: p.weight },
                      { label: 'Dimensions', value: p.dimensions },
                      { label: 'Importer', value: p.importer },
                      { label: 'ISBN-10', value: p.isbn_10 },
                      { label: 'ISBN-13', value: p.isbn_13 },
                      { label: 'Publisher', value: p.publisher },
                      { label: 'Images stored', value: p.images_stored },
                    ]
                      .filter((item) => item.value)
                      .map((item) => (
                        <div key={item.label} className="border border-default rounded-tile p-3">
                          <p className="text-[11px] text-secondary">{item.label}</p>
                          <p className="mt-0.5 text-xs font-medium text-primary truncate">
                            {String(item.value)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Compliance analysis */}
                {complianceData ? (
                  <div className="bg-surface border border-default rounded-card shadow-card p-6">
                    <CardHeader
                      title="Compliance analysis"
                      subtitle={
                        complianceData.analysis_status === 'indeterminate'
                          ? 'Analysis could not complete (AI service unavailable)'
                          : 'Auto-run against Legal Metrology (Packaged Commodities) Rules'
                      }
                    />
                    <div className="flex flex-col sm:flex-row items-start gap-6">
                      <ProgressRing
                        value={score}
                        size={120}
                        thickness={9}
                        label="Compliance score"
                        centerValue={
                          score === null ? 'N/A' : Math.round(score) + '%'
                        }
                        centerLabel={'Grade ' + (complianceData.final_grade || 'N/A')}
                      />
                      <div className="grid grid-cols-3 gap-3 flex-1 w-full">
                        {[
                          { label: 'Passed', value: complianceData.passed_checks, tone: 'var(--color-success)' },
                          { label: 'Failed', value: complianceData.failed_checks, tone: 'var(--color-critical)' },
                          { label: 'Checks', value: complianceData.total_checks, tone: 'var(--color-secondary)' },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="border border-default rounded-tile p-3 text-center"
                          >
                            <p
                              className="text-2xl font-bold tabular-nums"
                              style={{ color: item.tone }}
                            >
                              {item.value}
                            </p>
                            <p className="mt-0.5 text-xs text-secondary">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {complianceData.gemini_analysis ? (
                      <div className="mt-5 border border-default rounded-tile p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-accent" />
                          <h4 className="text-sm font-semibold text-primary">
                            AI assessment
                          </h4>
                        </div>
                        <p className="text-sm leading-relaxed text-secondary">
                          {complianceData.gemini_analysis.assessment}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Right column - seller card + purchase */}
              <div className="space-y-6">
                <div className="bg-surface border border-default rounded-card shadow-card p-6">
                  <CardHeader title="Seller" />
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-tile bg-cat-generic flex items-center justify-center shrink-0">
                        <Store className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-primary truncate">
                          {p.seller_name || 'Unknown seller'}
                        </p>
                        <p className="text-xs text-secondary truncate">
                          {p.seller_location || 'Location unknown'}
                          {p.seller_type ? ' | ' + p.seller_type : ''}
                        </p>
                      </div>
                    </div>
                    {p.seller_reputation ? (
                      <p className="text-xs text-secondary flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-warning" />
                        Reputation: {p.seller_reputation}
                      </p>
                    ) : null}
                    {p.seller_description ? (
                      <p className="text-xs text-secondary leading-relaxed">
                        {p.seller_description}
                      </p>
                    ) : null}
                    {p.store_url ? (
                      <a
                        href={p.store_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Visit store
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* Purchase / rewards (preserved flow) */}
                {p.price ? (
                  <div className="bg-surface border border-default rounded-card shadow-card p-6">
                    <CardHeader
                      title="Bought this product?"
                      subtitle="Confirm a verified purchase to earn Meta-Tokens"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPurchaseError(null);
                        setShowPurchaseModal(true);
                      }}
                      className="w-full h-10 rounded-pill bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      I purchased this
                    </button>
                    <p className="mt-2 text-[11px] text-muted text-center">
                      ~1 MT per 100 {p.currency || 'INR'} of verified purchase value
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : !loading ? (
            <EmptyState
              icon={Search}
              title="No product scanned yet"
              hint="Paste an Amazon product URL above and run a compliance check."
            />
          ) : null}
        </div>
      )}

      {/* Purchase confirm modal (preserved flow, reskinned) */}
      {showPurchaseModal && productData?.product ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-primary/40"
            onClick={() => !purchaseProcessing && setShowPurchaseModal(false)}
          />
          <div className="relative bg-surface border border-default rounded-card shadow-card p-6 w-full max-w-md">
            {purchaseSuccess ? (
              <div className="text-center py-4">
                <Coins className="w-10 h-10 text-success mx-auto mb-3" />
                <h3 className="text-base font-semibold text-primary">
                  Purchase confirmed!
                </h3>
                <p className="mt-1 text-sm text-secondary">
                  You earned {earnedTokens} Meta-Tokens.
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-base font-semibold text-primary">
                  Confirm purchase
                </h3>
                <p className="mt-1 text-sm text-secondary">
                  Confirm you purchased{' '}
                  <span className="font-medium text-primary">
                    {productData.product.title || productData.product.asin}
                  </span>{' '}
                  for {productData.product.currency || 'INR'}{' '}
                  {productData.product.price || productData.product.listed_price}?
                </p>
                {purchaseError ? (
                  <div className="mt-3 flex items-start gap-2 border border-critical rounded-tile p-3 text-xs text-critical">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {purchaseError}
                  </div>
                ) : null}
                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPurchaseModal(false)}
                    disabled={purchaseProcessing}
                    className="h-9 px-4 rounded-pill border border-default text-sm font-medium text-secondary hover:text-primary hover:border-muted transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePurchaseSuccess}
                    disabled={purchaseProcessing}
                    className="h-9 px-5 rounded-pill bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {purchaseProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Confirm purchase
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
