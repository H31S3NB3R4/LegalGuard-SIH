'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '../Navbar';
import { Poppins } from "next/font/google";
import {
  Search,
  Loader2,
  ExternalLink,
  Package,
  User,
  Building2,
  DollarSign,
  FileText,
  Star,
  Calendar,
  Globe,
  Weight,
  Ruler,
  Book,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Sparkles,
  Image as ImageIcon,
  FileCheck,
  Brain,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ShoppingCart,
  CreditCard,
  Coins,
  Gift,
  X as CloseIcon,
  ChevronRight,
  Store
} from 'lucide-react';

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

function CheckComplianceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Extract authentication from URL params OR localStorage
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
      
      console.log(`[AUTH] User ID: ${userIdParam}, Role: ${roleParam}`);
    } else {
      const storedUserId = localStorage.getItem('user_id');
      const storedRole = localStorage.getItem('user_role');
      const storedAuth = localStorage.getItem('isAuthenticated');
      
      if (storedUserId && storedRole && storedAuth === 'true') {
        setUserId(parseInt(storedUserId));
        setUserRole(storedRole);
        setIsAuthenticated(true);
        console.log(`[AUTH] Loaded from localStorage - User ID: ${storedUserId}, Role: ${storedRole}`);
      } else {
        console.warn('[AUTH] No authentication found, redirecting to login...');
        setIsAuthenticated(false);
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      }
    }
  }, [searchParams, router]);

  // Scroll position state
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Custom scrollbar styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(168, 85, 247, 0.3), rgba(6, 182, 212, 0.3));
        border-radius: 10px;
        transition: all 0.3s ease;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, rgba(168, 85, 247, 0.6), rgba(6, 182, 212, 0.6));
      }
      * {
        scrollbar-width: thin;
        scrollbar-color: rgba(168, 85, 247, 0.3) transparent;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // State variables
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [productData, setProductData] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [error, setError] = useState(null);
  const [copiedText, setCopiedText] = useState('');

  // Purchase Modal States
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseProcessing, setPurchaseProcessing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);
  const [earnedTokens, setEarnedTokens] = useState(0);

  // API call for scraping + auto-compliance
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
          : 'Unsupported marketplace. Please enter a valid Amazon product URL.')
      ;
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

      console.log(`[API CALL] User ID: ${userId}, Role: ${userRole}, URL: ${url.trim()}`);

      const response = await fetch(`${API_BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          url: url.trim(),
          auto_analyze: true,
        }),
      });

      const data = await response.json();
      console.log('[API RESPONSE]', data);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          setError('Session expired. Please log in again.');
          setTimeout(() => router.push('/auth/login'), 1500);
          return;
        }
        throw new Error(data.error || 'Failed to scrape product');
      }

      // ⭐ ENHANCED: Transform product data with ALL fields from API response
      const transformedProductData = {
        product: {
          // Core product info
          product_id: data.product_id,
          asin: data.asin,
          title: data.title,
          price: data.price, // ⭐ Direct MRP price from API
          url: url.trim(),
          marketplace: 'Amazon',
          message: data.message,
          
          // Seller information - COMPLETE
          seller_id: data.seller_id,
          seller_name: data.seller_info?.name || 'Unknown',
          seller_type: data.seller_info?.ai_insights?.seller_type || 'Unknown',
          seller_location: data.seller_info?.ai_insights?.location || 'N/A',
          seller_reputation: data.seller_info?.ai_insights?.reputation || 'N/A',
          seller_description: data.seller_info?.ai_insights?.description || 'N/A',
          seller_other_notes: data.seller_info?.ai_insights?.other_notes || 'N/A',
          store_url: data.seller_info?.store_url || null,
          
          // Product details from seller_info
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
          
          // Compliance data - COMPLETE
          // Phase 12: score stays null when the analysis was indeterminate
          // (AI outage) — grade shows N/A, never a fake 0/F.
          compliance_score: data.compliance_analysis?.score ?? null,
          compliance_grade: data.compliance_analysis?.grade || null,
          analysis_mode: data.compliance_analysis?.analysis_mode || null,
          analysis_status: data.compliance_analysis?.analysis_status || null,
          is_compliant: data.compliance_analysis?.is_compliant || false,
          requires_action: data.compliance_analysis?.requires_action || false,
          violations_count: data.compliance_analysis?.violations_count || 0,
          
          // Images - COMPLETE
          images: data.images || [],
          images_stored: data.images_stored || 0,
          
          // Metadata
          is_update: data.is_update || false,
          crawled_at: new Date().toISOString(),
        }
      };

      setProductData(transformedProductData);

      // Set compliance data if available
      if (data.compliance_analysis) {
        const transformedComplianceData = {
          compliance_score: data.compliance_analysis.score,
          final_grade: data.compliance_analysis.grade,
          analysis_mode: data.compliance_analysis.analysis_mode || null,
          analysis_status: data.compliance_analysis.analysis_status || null,
          is_compliant: data.compliance_analysis.is_compliant,
          requires_action: data.compliance_analysis.requires_action,
          violations_count: data.compliance_analysis.violations_count,
          passed_checks: data.compliance_analysis.is_compliant ? 1 : 0,
          failed_checks: data.compliance_analysis.violations_count || 0,
          total_checks: 1 + (data.compliance_analysis.violations_count || 0),
          gemini_analysis: {
            // Phase 11: real per-product assessment generated by the backend
            // from the actual compliance results (Gemini when available,
            // deterministic summary otherwise) — never a canned static string.
            // Phase 12: null-safe fallback copy for indeterminate results.
            assessment: data.compliance_analysis.assessment
              || `Compliance grade ${data.compliance_analysis.grade} with a score of ${
                  data.compliance_analysis.score != null ? `${data.compliance_analysis.score}%` : 'no score (analysis incomplete)'
                }. ${
                  data.compliance_analysis.analysis_status === 'indeterminate'
                    ? 'The AI compliance service was unavailable, so the product could not be graded.'
                    : data.compliance_analysis.is_compliant
                      ? 'Product is compliant with current regulations.'
                      : 'Product has compliance violations that need attention.'
                }`,
          },
          grade_explanation: `Compliance grade ${data.compliance_analysis.grade} with a score of ${
              data.compliance_analysis.score != null ? `${data.compliance_analysis.score}%` : 'no score (analysis incomplete)'
            }. ${
              data.compliance_analysis.analysis_status === 'indeterminate'
                ? 'The AI compliance service was unavailable, so the product could not be graded.'
                : data.compliance_analysis.is_compliant 
                  ? 'Product is compliant with current regulations.' 
                  : 'Product has compliance violations that need attention.'
          }`,
        };

        setComplianceData(transformedComplianceData);
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

  // Handle Purchase Success - Award MT Tokens
  const handlePurchaseSuccess = async () => {
    if (!productData?.product?.price && !productData?.product?.listed_price) {
      setPurchaseError('Product price not available');
      return;
    }

    setPurchaseProcessing(true);
    setPurchaseError(null);

    try {
      const productPrice = parseFloat(productData.product.price || productData.product.listed_price);
      const tokensToAdd = Math.floor(productPrice / 100);

      console.log(`[PURCHASE] Product Price: ₹${productPrice}, Tokens to Add: ${tokensToAdd}`);

      const response = await fetch(`${API_BASE_URL}/api/gifts/add-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          mt_tokens: tokensToAdd
        }),
      });

      const data = await response.json();
      console.log('[TOKEN RESPONSE]', data);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          setPurchaseError('Session expired. Please log in again.');
          setTimeout(() => router.push('/auth/login'), 1500);
          return;
        }
        if (response.status === 403 && data.code === 'SELF_MINT_DISABLED') {
          setPurchaseError('Meta-Tokens are awarded automatically for verified compliance checks, not for purchases.');
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
      setPurchaseError(err.message || 'Failed to process purchase');
    } finally {
      setPurchaseProcessing(false);
    }
  };

  // Handle Purchase Failure
  const handlePurchaseFailure = () => {
    setShowPurchaseModal(false);
    setPurchaseSuccess(false);
    setPurchaseError(null);
    setEarnedTokens(0);
  };

  // Helper function to extract fields from seller_info
  const extractField = (sellerInfo, fieldName) => {
    if (!sellerInfo) return null;
    if (typeof sellerInfo === 'string') {
      try {
        const parsed = JSON.parse(sellerInfo);
        return parsed[fieldName] || null;
      } catch {
        return null;
      }
    }
    return sellerInfo[fieldName] || null;
  };

  const getGradeColor = (grade) => {
    if (!grade) return 'text-gray-400';
    const g = grade.toUpperCase();
    // Phase 12: 'N/A' (indeterminate analysis) renders gray, not green —
    // 'N/A'.includes('A') was true, so it previously showed as A-grade green.
    if (g === 'N/A' || g === 'NA' || g === 'PENDING') return 'text-gray-400';
    if (g.includes('A')) return 'text-green-400';
    if (g.includes('B')) return 'text-blue-400';
    if (g.includes('C')) return 'text-amber-400';
    return 'text-red-400';
  };

  const getGradeBg = (grade) => {
    if (!grade) return 'bg-gray-600/20 border-gray-500/30';
    const g = grade.toUpperCase();
    // Phase 12: 'N/A' renders gray (was wrongly green).
    if (g === 'N/A' || g === 'NA' || g === 'PENDING') return 'bg-gray-600/20 border-gray-500/30';
    if (g.includes('A')) return 'bg-green-600/20 border-green-500/50';
    if (g.includes('B')) return 'bg-blue-600/20 border-blue-500/50';
    if (g.includes('C')) return 'bg-amber-600/20 border-amber-500/50';
    return 'bg-red-600/20 border-red-500/50';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2000);
  };

  // Show authentication warning if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-black text-white p-4 sm:p-6 md:p-8 ml-0 md:ml-64 flex items-center justify-center">
          <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-8 max-w-2xl">
            <div className="flex items-center gap-4 mb-4">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <h2 className="text-2xl font-bold text-red-400">Authentication Required</h2>
            </div>
            <p className="text-gray-300 mb-4">
              Please log in to access this page. Redirecting to login...
            </p>
            <button
              onClick={() => router.push('/auth/login')}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg font-semibold hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all"
            >
              Go to Login
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black text-white p-4 sm:p-6 md:p-8 ml-0 md:ml-64">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 mt-6">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 tracking-tight">
                Check Compliance
              </span>
            </h2>
            <div className="border-t-2 [border-image:linear-gradient(to_right,theme(colors.purple.400),theme(colors.cyan.400))_1]" />
            <div className="flex items-center justify-between mt-2">
              <p className={`text-xs sm:text-sm ${poppins.className} tracking-wider uppercase text-gray-400`}>
                Validate product listings against Legal Metrology standards
              </p>
              <div className={`text-xs ${poppins.className} text-cyan-400`}>
                User: <span className="font-mono">{userId}</span> | Role: <span className="font-semibold uppercase">{userRole}</span>
              </div>
            </div>
          </div>

          {/* Search Section */}
          <div className="bg-black/60 backdrop-blur-sm mb-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Enter Amazon or Flipkart product URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleScrapeProduct()}
                  className={`w-full px-4 sm:px-6 py-3 sm:py-4 bg-black/40 border border-purple-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 transition-all text-sm sm:text-base ${poppins.className}`}
                />
              </div>
              <button
                onClick={handleScrapeProduct}
                disabled={loading}
                className={`px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${poppins.className} uppercase tracking-wider text-sm sm:text-base`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                  <div className="flex items-center justify-center gap-2">
                    <Search className="w-5 h-5" />
                    <span className="hidden sm:inline">Scrape & Analyze</span>
                    <span className="sm:hidden">Analyze</span>
                  </div>
                )}
              </button>
            </div>

            {/* Loading Stage */}
            {loadingStage && (
              <div className="mt-4 flex items-center gap-3 text-cyan-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className={`${poppins.className} tracking-wider uppercase text-xs sm:text-sm`}>{loadingStage}</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-center gap-3 text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className={`${poppins.className} tracking-wide text-sm`}>{error}</span>
              </div>
            )}
          </div>

          {/* Product Data Display */}
          {productData?.product && (
            <div className="space-y-6">
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-4 sm:p-6 md:p-8 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300">
                {/* Header */}
                <div className="flex flex-col lg:flex-row items-start justify-between gap-4 mb-6">
                  <div className="flex-1 w-full">
                    <h2 className={`text-xl sm:text-2xl font-bold mb-3 ${poppins.className} tracking-wide break-words`}>
                      {productData.product.title}
                    </h2>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      <span className={`px-3 sm:px-4 py-1 bg-purple-600/20 border border-purple-500/30 rounded-full text-xs sm:text-sm text-purple-400 uppercase tracking-wider ${poppins.className}`}>
                        {productData.product.category || 'Uncategorized'}
                      </span>
                      <span className={`px-3 sm:px-4 py-1 bg-cyan-600/20 border border-cyan-500/30 rounded-full text-xs sm:text-sm text-cyan-400 uppercase tracking-wider ${poppins.className}`}>
                        {productData.product.marketplace}
                      </span>
                      {productData.product.seller_name && productData.product.seller_name !== 'Unknown' && (
                        <span className={`px-3 sm:px-4 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full text-xs sm:text-sm text-blue-400 tracking-wider ${poppins.className}`}>
                          <User className="w-3 h-3 inline mr-1" />
                          {productData.product.seller_name}
                        </span>
                      )}
                      {productData.product.is_update && (
                        <span className={`px-3 sm:px-4 py-1 bg-amber-600/20 border border-amber-500/30 rounded-full text-xs sm:text-sm text-amber-400 uppercase tracking-wider ${poppins.className}`}>
                          Updated
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Compliance Badge */}
                  {(productData.product.compliance_score != null || productData.product.compliance_grade) && (
                    <div className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl border ${getGradeBg(productData.product.compliance_grade)} self-start`}>
                      <div className="text-center">
                        <div className={`text-2xl sm:text-3xl font-bold ${getGradeColor(productData.product.compliance_grade)}`}>
                          {productData.product.compliance_grade || 'N/A'}
                        </div>
                        <div className={`text-xs text-gray-400 mt-1 uppercase tracking-wider ${poppins.className}`}>
                          Score: {productData.product.compliance_score != null ? `${productData.product.compliance_score}%` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ⭐ MRP PRICE DISPLAY - Primary Price Section */}
                {productData.product.price && (
                  <div className="mb-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-2 border-green-500/50 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-5 h-5 text-green-400" />
                          <span className={`text-sm text-gray-400 uppercase tracking-wider ${poppins.className}`}>
                            MRP (Maximum Retail Price)
                          </span>
                        </div>
                        <div className="text-3xl sm:text-4xl font-bold text-green-400">
                          ₹{parseFloat(productData.product.price).toLocaleString('en-IN', { 
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2 
                          })}
                        </div>
                      </div>
                      {productData.product.message && (
                        <div className="bg-cyan-600/20 border border-cyan-500/30 rounded-lg px-4 py-2">
                          <p className={`text-xs text-cyan-400 ${poppins.className}`}>
                            {productData.product.message}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
                  {productData.product.rating && (
                    <div className="bg-black/40 border border-purple-500/20 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="w-4 h-4 text-amber-400" />
                        <span className={`text-xs text-gray-400 uppercase tracking-wider ${poppins.className}`}>Rating</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg sm:text-xl font-bold">{productData.product.rating}</span>
                        {productData.product.review_count && (
                          <span className={`text-xs sm:text-sm text-gray-400 tracking-wide ${poppins.className}`}>
                            ({productData.product.review_count.toLocaleString()} reviews)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {productData.product.country_of_origin && (
                    <div className="bg-black/40 border border-purple-500/20 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-4 h-4 text-green-400" />
                        <span className={`text-xs text-gray-400 uppercase tracking-wider ${poppins.className}`}>Country of Origin</span>
                      </div>
                      <div className={`text-base sm:text-lg font-semibold tracking-wide break-words ${poppins.className}`}>
                        {productData.product.country_of_origin.replace(/^:\s*/, '')}
                      </div>
                    </div>
                  )}

                  {productData.product.manufacturer && (
                    <div className="bg-black/40 border border-purple-500/20 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-purple-400" />
                        <span className={`text-xs text-gray-400 uppercase tracking-wider ${poppins.className}`}>Manufacturer</span>
                      </div>
                      <div className={`text-base sm:text-lg font-semibold tracking-wide break-words ${poppins.className}`}>
                        {productData.product.manufacturer}
                      </div>
                    </div>
                  )}

                  {productData.product.weight && (
                    <div className="bg-black/40 border border-purple-500/20 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Weight className="w-4 h-4 text-blue-400" />
                        <span className={`text-xs text-gray-400 uppercase tracking-wider ${poppins.className}`}>Weight</span>
                      </div>
                      <div className={`text-base sm:text-lg font-semibold tracking-wide break-words ${poppins.className}`}>
                        {productData.product.weight.replace(/^:\s*/, '')}
                      </div>
                    </div>
                  )}

                  {productData.product.dimensions && (
                    <div className="bg-black/40 border border-purple-500/20 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Ruler className="w-4 h-4 text-cyan-400" />
                        <span className={`text-xs text-gray-400 uppercase tracking-wider ${poppins.className}`}>Dimensions</span>
                      </div>
                      <div className={`text-base sm:text-lg font-semibold tracking-wide break-words ${poppins.className}`}>
                        {productData.product.dimensions}
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {productData.product.description && (
                  <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4 sm:p-6 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 sm:w-5 h-4 sm:h-5 text-purple-400" />
                      <span className={`text-sm sm:text-base font-semibold uppercase tracking-wider ${poppins.className}`}>Description</span>
                    </div>
                    <p className={`text-sm sm:text-base text-gray-300 leading-relaxed tracking-wide break-words ${poppins.className}`}>
                      {productData.product.description}
                    </p>
                  </div>
                )}

                {/* ⭐ COMPLETE SELLER INFORMATION SECTION */}
                {productData.product.seller_id && (
                  <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-6 mb-6">
                    <h3 className={`text-xl font-bold mb-4 ${poppins.className}`}>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                        Seller Information
                      </span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Seller Name */}
                      {productData.product.seller_name && productData.product.seller_name !== 'Unknown' && (
                        <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-purple-400" />
                            <span className={`text-sm font-semibold uppercase ${poppins.className}`}>
                              Seller Name
                            </span>
                          </div>
                          <p className={`text-base text-gray-300 ${poppins.className}`}>
                            {productData.product.seller_name}
                          </p>
                        </div>
                      )}
                      
                      {/* Seller Type */}
                      {productData.product.seller_type && productData.product.seller_type !== 'Unknown' && (
                        <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-cyan-400" />
                            <span className={`text-sm font-semibold uppercase ${poppins.className}`}>
                              Seller Type
                            </span>
                          </div>
                          <p className={`text-base text-gray-300 ${poppins.className}`}>
                            {productData.product.seller_type}
                          </p>
                        </div>
                      )}
                      
                      {/* Location */}
                      {productData.product.seller_location && productData.product.seller_location !== 'N/A' && (
                        <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className="w-4 h-4 text-green-400" />
                            <span className={`text-sm font-semibold uppercase ${poppins.className}`}>
                              Location
                            </span>
                          </div>
                          <p className={`text-base text-gray-300 ${poppins.className}`}>
                            {productData.product.seller_location}
                          </p>
                        </div>
                      )}
                      
                      {/* Store URL */}
                      {productData.product.store_url && (
                        <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Store className="w-4 h-4 text-blue-400" />
                            <span className={`text-sm font-semibold uppercase ${poppins.className}`}>
                              Store Link
                            </span>
                          </div>
                          <a 
                            href={productData.product.store_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-blue-400 hover:text-blue-300 underline break-all text-sm ${poppins.className}`}
                          >
                            Visit Store
                          </a>
                        </div>
                      )}
                    </div>
                    
                    {/* Seller Description */}
                    {productData.product.seller_description && productData.product.seller_description !== 'N/A' && (
                      <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-purple-400" />
                          <span className={`text-sm font-semibold uppercase ${poppins.className}`}>
                            About Seller
                          </span>
                        </div>
                        <p className={`text-sm text-gray-300 leading-relaxed ${poppins.className}`}>
                          {productData.product.seller_description}
                        </p>
                      </div>
                    )}
                    
                    {/* Seller Reputation */}
                    {productData.product.seller_reputation && productData.product.seller_reputation !== 'N/A' && (
                      <div className="bg-gradient-to-r from-amber-600/10 to-yellow-600/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-4 h-4 text-amber-400" />
                          <span className={`text-sm font-semibold uppercase ${poppins.className}`}>
                            Seller Reputation
                          </span>
                        </div>
                        <p className={`text-sm text-gray-300 leading-relaxed ${poppins.className}`}>
                          {productData.product.seller_reputation}
                        </p>
                      </div>
                    )}
                    
                    {/* Additional Notes */}
                    {productData.product.seller_other_notes && productData.product.seller_other_notes !== 'N/A' && (
                      <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-cyan-400" />
                          <span className={`text-sm font-semibold uppercase ${poppins.className}`}>
                            Additional Notes
                          </span>
                        </div>
                        <p className={`text-sm text-gray-300 leading-relaxed ${poppins.className}`}>
                          {productData.product.seller_other_notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Additional Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {productData.product.importer && (
                    <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-orange-400" />
                        <span className={`text-sm font-semibold uppercase tracking-wider ${poppins.className}`}>Importer</span>
                      </div>
                      <p className={`text-xs sm:text-sm text-gray-300 tracking-wide break-words ${poppins.className}`}>
                        {productData.product.importer}
                      </p>
                      {productData.product.importer_email && (
                        <div className={`flex items-center gap-2 mt-2 text-xs text-cyan-400 tracking-wide break-all ${poppins.className}`}>
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          {productData.product.importer_email}
                        </div>
                      )}
                      {productData.product.importer_phone && (
                        <div className={`flex items-center gap-2 mt-1 text-xs text-cyan-400 tracking-wide ${poppins.className}`}>
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {productData.product.importer_phone}
                        </div>
                      )}
                    </div>
                  )}

                  {(productData.product.isbn_10 || productData.product.isbn_13) && (
                    <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Book className="w-4 h-4 text-indigo-400" />
                        <span className={`text-sm font-semibold uppercase tracking-wider ${poppins.className}`}>ISBN</span>
                      </div>
                      {productData.product.isbn_13 && (
                        <div className={`text-xs sm:text-sm text-gray-300 mb-1 tracking-wide break-words ${poppins.className}`}>
                          ISBN-13: {productData.product.isbn_13}
                        </div>
                      )}
                      {productData.product.isbn_10 && (
                        <div className={`text-xs sm:text-sm text-gray-300 tracking-wide break-words ${poppins.className}`}>
                          ISBN-10: {productData.product.isbn_10}
                        </div>
                      )}
                      {productData.product.publisher && (
                        <div className={`text-xs text-gray-400 mt-2 tracking-wide break-words ${poppins.className}`}>
                          Publisher: {productData.product.publisher}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ⭐ PRODUCT IMAGES GALLERY */}
                {productData.product.images && productData.product.images.length > 0 && (
                  <div className="bg-black/40 border border-purple-500/20 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-xl font-bold ${poppins.className}`}>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                          Product Images
                        </span>
                      </h3>
                      <span className={`text-sm text-gray-400 ${poppins.className}`}>
                        {productData.product.images_stored} images stored
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {productData.product.images.map((img, idx) => (
                        <div key={img.image_id} className="relative group">
                          <div className="aspect-square bg-black/40 border border-purple-500/20 rounded-lg overflow-hidden hover:border-cyan-400/50 transition-all">
                            <img 
                              src={`data:image/jpeg;base64,${img.image_data}`}
                              alt={`Product image ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>
                          <div className={`absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-cyan-400 ${poppins.className}`}>
                            #{img.image_id}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-purple-500/20">
                  <div className="flex flex-col gap-2">
                    <div className={`flex items-center gap-2 text-xs sm:text-sm text-gray-400 tracking-wide ${poppins.className}`}>
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>Crawled: {formatDate(productData.product.crawled_at)}</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs text-gray-500 tracking-wide font-mono ${poppins.className}`}>
                      <span>Product ID: {productData.product.product_id}</span>
                      <span>•</span>
                      <span>ASIN: {productData.product.asin}</span>
                      <span>•</span>
                      <span>Seller ID: {productData.product.seller_id}</span>
                      <span>•</span>
                      <span>Images: {productData.product.images_stored}</span>
                    </div>
                  </div>
                  <a
                    href={productData.product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-all uppercase tracking-wider text-xs sm:text-sm ${poppins.className}`}
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on {productData.product.marketplace}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ⭐ ENHANCED COMPLIANCE REPORT WITH ALL DETAILS */}
          {complianceData && (
            <div className="mt-8 space-y-6">
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-4 sm:p-6 md:p-8 backdrop-blur-sm">
                <div className="flex flex-col lg:flex-row items-start justify-between gap-6 mb-6">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 py-3 border-b-2 w-full [border-image:linear-gradient(to_right,theme(colors.purple.400),theme(colors.cyan.400))_1]">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 tracking-tight">
                      Compliance Report
                    </span>
                  </h2>

                  <div className={`px-6 sm:px-8 py-3 sm:py-4 rounded-xl border ${getGradeBg(complianceData.final_grade)} self-start`}>
                    <div className="text-center">
                      <div className={`text-3xl sm:text-4xl font-bold ${getGradeColor(complianceData.final_grade)}`}>
                        {complianceData.final_grade}
                      </div>
                      <div className={`text-xs sm:text-sm text-gray-400 mt-1 uppercase tracking-wider ${poppins.className}`}>
                        {complianceData.compliance_score != null ? `${complianceData.compliance_score}%` : 'No score'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Phase 12: degraded-analysis banner (offline / indeterminate) */}
                {(complianceData.analysis_mode === 'offline' || complianceData.analysis_status === 'indeterminate') && (
                  <div className="mb-6 bg-blue-600/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0" />
                      <div>
                        <div className={`font-bold text-blue-400 mb-1 ${poppins.className}`}>
                          {complianceData.analysis_status === 'indeterminate'
                            ? 'Analysis Incomplete (AI Service Unavailable)'
                            : 'Offline Analysis (AI Service Unavailable)'}
                        </div>
                        <p className={`text-sm text-gray-300 ${poppins.className}`}>
                          {complianceData.analysis_status === 'indeterminate'
                            ? 'The AI compliance service was temporarily unavailable (Gemini quota exhausted), and the listing data alone was not sufficient to grade this product. No violations are asserted — please re-run the analysis after the quota resets.'
                            : 'The AI compliance service was temporarily unavailable (Gemini quota exhausted). This grade was computed deterministically from the listing data only (no image OCR). Some package-printed declarations may be missing from this result — re-run the analysis after the quota resets for full verification.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ⭐ COMPLETE COMPLIANCE METRICS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Compliance Score */}
                  <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                    <div className={`text-xs text-gray-400 uppercase mb-2 ${poppins.className}`}>
                      Compliance Score
                    </div>
                    <div className="text-3xl font-bold text-cyan-400">
                      {complianceData.compliance_score != null ? `${complianceData.compliance_score}%` : 'N/A'}
                    </div>
                  </div>
                  
                  {/* Grade */}
                  <div className={`border rounded-xl p-4 ${getGradeBg(complianceData.final_grade)}`}>
                    <div className={`text-xs text-gray-400 uppercase mb-2 ${poppins.className}`}>
                      Grade
                    </div>
                    <div className={`text-3xl font-bold ${getGradeColor(complianceData.final_grade)}`}>
                      {complianceData.final_grade}
                    </div>
                  </div>
                  
                  {/* Compliant Status */}
                  <div className={`border rounded-xl p-4 ${complianceData.is_compliant ? 'bg-green-600/10 border-green-500/30' : 'bg-red-600/10 border-red-500/30'}`}>
                    <div className={`text-xs text-gray-400 uppercase mb-2 ${poppins.className}`}>
                      Status
                    </div>
                    <div className="flex items-center gap-2">
                      {complianceData.is_compliant ? (
                        <>
                          <CheckCircle2 className="w-6 h-6 text-green-400" />
                          <span className="font-bold text-green-400">Compliant</span>
                        </>
                      ) : complianceData.analysis_status === 'indeterminate' ? (
                        <>
                          <AlertCircle className="w-6 h-6 text-gray-400" />
                          <span className="font-bold text-gray-400">Not Graded</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-6 h-6 text-red-400" />
                          <span className="font-bold text-red-400">Non-Compliant</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Violations Count */}
                  <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-4">
                    <div className={`text-xs text-gray-400 uppercase mb-2 ${poppins.className}`}>
                      Violations
                    </div>
                    <div className="text-3xl font-bold text-red-400">
                      {complianceData.violations_count}
                    </div>
                  </div>
                </div>

                {/* Action Required Badge */}
                {complianceData.requires_action && complianceData.analysis_status !== 'indeterminate' && (
                  <div className="mb-6 bg-amber-600/10 border border-amber-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
                      <div>
                        <div className={`font-bold text-amber-400 mb-1 ${poppins.className}`}>
                          Action Required
                        </div>
                        <p className={`text-sm text-gray-300 ${poppins.className}`}>
                          This product requires compliance improvements based on Legal Metrology standards.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-600/10 border border-green-500/30 rounded-xl p-4 sm:p-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 sm:w-8 h-6 sm:h-8 text-green-400 flex-shrink-0" />
                      <div>
                        <div className="text-2xl sm:text-3xl font-bold text-green-400">{complianceData.passed_checks}</div>
                        <div className={`text-xs sm:text-sm text-gray-400 uppercase tracking-wider ${poppins.className}`}>Passed</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-4 sm:p-6">
                    <div className="flex items-center gap-3">
                      <XCircle className="w-6 sm:w-8 h-6 sm:h-8 text-red-400 flex-shrink-0" />
                      <div>
                        <div className="text-2xl sm:text-3xl font-bold text-red-400">{complianceData.failed_checks}</div>
                        <div className={`text-xs sm:text-sm text-gray-400 uppercase tracking-wider ${poppins.className}`}>Failed</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-cyan-600/10 border border-cyan-500/30 rounded-xl p-4 sm:p-6">
                    <div className="flex items-center gap-3">
                      <FileCheck className="w-6 sm:w-8 h-6 sm:h-8 text-cyan-400 flex-shrink-0" />
                      <div>
                        <div className="text-2xl sm:text-3xl font-bold text-cyan-400">{complianceData.total_checks}</div>
                        <div className={`text-xs sm:text-sm text-gray-400 uppercase tracking-wider ${poppins.className}`}>Total Checks</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gemini Analysis */}
                {complianceData.gemini_analysis && (
                  <div className="bg-gradient-to-r from-purple-600/10 to-cyan-600/10 border border-purple-500/30 rounded-xl p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Brain className="w-5 sm:w-6 h-5 sm:h-6 text-purple-400 flex-shrink-0" />
                      <h3 className={`text-lg sm:text-xl font-bold ${poppins.className} uppercase tracking-wider`}>AI Assessment</h3>
                    </div>
                    <p className={`text-sm sm:text-base text-gray-300 leading-relaxed mb-4 ${poppins.className} tracking-wide`}>
                      {complianceData.gemini_analysis.assessment}
                    </p>
                    <div className="bg-black/40 border border-purple-500/20 rounded-lg p-4">
                      <div className={`text-xs sm:text-sm text-gray-400 mb-2 uppercase tracking-wider ${poppins.className}`}>
                        Grade Explanation:
                      </div>
                      <p className={`text-sm sm:text-base text-gray-300 ${poppins.className} tracking-wide`}>
                        {complianceData.grade_explanation}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* PURCHASE SECTION */}
              {productData?.product?.price && (
                <div className="bg-gradient-to-br from-green-900/20 via-emerald-900/20 to-black border-2 border-green-500/50 rounded-2xl p-6 sm:p-8 backdrop-blur-sm shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-600/20 rounded-lg border border-green-500/50">
                          <ShoppingCart className="w-6 h-6 text-green-400" />
                        </div>
                        <h3 className={`text-xl sm:text-2xl font-bold ${poppins.className} text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 uppercase tracking-wider`}>
                          Complete Purchase & Earn Rewards
                        </h3>
                      </div>
                      <p className={`text-sm sm:text-base text-gray-300 mb-4 ${poppins.className}`}>
                        Purchase this product and earn <span className="text-yellow-400 font-bold text-lg">{Math.floor(parseFloat(productData.product.price) / 100)} Meta-Tokens</span> (1 MT per ₹100)
                      </p>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="bg-black/40 border border-green-500/30 rounded-lg px-4 py-3">
                          <div className={`text-xs text-gray-400 uppercase tracking-wider mb-1 ${poppins.className}`}>Product Price</div>
                          <div className="text-2xl font-bold text-green-400">
                            ₹{parseFloat(productData.product.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="bg-black/40 border border-yellow-500/30 rounded-lg px-4 py-3">
                          <div className={`text-xs text-gray-400 uppercase tracking-wider mb-1 ${poppins.className}`}>Tokens to Earn</div>
                          <div className="flex items-center gap-2">
                            <Coins className="w-6 h-6 text-yellow-400" />
                            <span className="text-2xl font-bold text-yellow-400">
                              {Math.floor(parseFloat(productData.product.price) / 100)} MT
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPurchaseModal(true)}
                      className={`px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl font-bold hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all duration-300 ${poppins.className} uppercase tracking-wider text-base sm:text-lg flex items-center gap-3 group border-2 border-green-500/50`}
                    >
                      <ShoppingCart className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      Buy Now
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Purchase Modal */}
        {showPurchaseModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-green-900/90 to-black border border-green-500/50 rounded-2xl p-8 max-w-lg w-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl"></div>
              
              <button
                onClick={handlePurchaseFailure}
                className="absolute top-4 right-4 z-20 bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-all duration-300"
              >
                <CloseIcon className="w-5 h-5 text-white" />
              </button>
              
              <div className="relative z-10">
                {!purchaseSuccess ? (
                  <>
                    <div className="text-center mb-6">
                      <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-500/50">
                        <CreditCard className="w-10 h-10 text-green-400" />
                      </div>
                      <h3 className={`text-2xl sm:text-3xl font-bold mb-2 text-white ${poppins.className} uppercase tracking-wider`}>
                        Simulate Purchase
                      </h3>
                      <p className={`text-gray-400 ${poppins.className}`}>
                        Choose purchase outcome to test token rewards
                      </p>
                    </div>

                    {purchaseError && (
                      <div className="mb-4 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                        <p className="text-sm text-red-400 text-center">{purchaseError}</p>
                      </div>
                    )}

                    <div className="bg-black/40 rounded-xl p-6 mb-6 border border-green-500/20">
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-gray-400 ${poppins.className}`}>Product Price (MRP)</span>
                        <span className="font-bold text-xl text-white">
                          ₹{parseFloat(productData.product.price || productData.product.listed_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-gray-400 ${poppins.className}`}>Tokens to Earn</span>
                        <div className="flex items-center gap-2">
                          <Coins className="w-5 h-5 text-yellow-400" />
                          <span className="font-bold text-xl text-yellow-400">
                            {Math.floor(parseFloat(productData.product.price || productData.product.listed_price) / 100)} MT
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-gray-700 my-3"></div>
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                        <p className={`text-xs text-green-400 text-center uppercase tracking-wider ${poppins.className}`}>
                          🎁 Earn 1 Meta-Token for every ₹100 spent
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={handlePurchaseSuccess}
                        disabled={purchaseProcessing}
                        className={`px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg transition-all duration-300 uppercase tracking-wider text-sm ${poppins.className} disabled:opacity-50 flex items-center justify-center gap-2`}
                      >
                        {purchaseProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5" />
                            Success
                          </>
                        )}
                      </button>
                      <button
                        onClick={handlePurchaseFailure}
                        disabled={purchaseProcessing}
                        className={`px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-lg transition-all duration-300 uppercase tracking-wider text-sm ${poppins.className} disabled:opacity-50 flex items-center justify-center gap-2`}
                      >
                        <XCircle className="w-5 h-5" />
                        Fail
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-24 h-24 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-green-500/50 animate-pulse">
                      <Gift className="w-12 h-12 text-green-400" />
                    </div>
                    <h3 className={`text-3xl font-bold mb-4 text-white ${poppins.className} uppercase tracking-wider`}>
                      Purchase Successful!
                    </h3>
                    <p className={`text-gray-400 mb-6 ${poppins.className}`}>
                      Your Meta-Tokens have been credited
                    </p>
                    <div className="bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border-2 border-yellow-500/50 rounded-xl p-6 mb-4">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <Coins className="w-8 h-8 text-yellow-400" />
                        <span className="text-4xl font-bold text-yellow-400">+{earnedTokens} MT</span>
                      </div>
                      <p className={`text-sm text-gray-300 uppercase tracking-wider ${poppins.className}`}>
                        Meta-Tokens Earned
                      </p>
                    </div>
                    <p className={`text-xs text-gray-500 ${poppins.className}`}>
                      Check your rewards page to redeem tokens
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function CheckCompliance() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading compliance checker...</div>}>
      <CheckComplianceContent />
    </Suspense>
  );
}
