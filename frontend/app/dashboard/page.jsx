'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  ShoppingCart,
  Building2,
  Users,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  Eye,
  FileText,
  Shield,
  Star,
  ArrowUp,
  ArrowDown,
  Bell,
  X,
  ArrowLeft,
  ArrowRight,
  Map,
  MessageSquare,
  Zap,
  DollarSign,
  Award,
  TrendingDown as TrendDown,
  AlertTriangle,
  MapPin,
  ExternalLink,
} from 'lucide-react';

import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  Legend,
  ComposedChart,
} from 'recharts';
import { Poppins } from 'next/font/google';
import Navbar from '../Navbar';

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const COLORS = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

// Product Details Modal Component
const ProductDetailsModal = ({ product, onClose }) => {
  if (!product) return null;

  const parsedSellerInfo = product.seller_information
    ? typeof product.seller_information === 'string'
      ? JSON.parse(product.seller_information)
      : product.seller_information
    : null;

  const parsedAnalysis = product.analysis_results
    ? typeof product.analysis_results === 'string'
      ? JSON.parse(product.analysis_results)
      : product.analysis_results
    : null;

  const complianceReport =
    product.compliance_report ||
    (parsedAnalysis && {
      asin: parsedAnalysis.asin,
      category: parsedAnalysis.category,
      compliance_grade: parsedAnalysis.compliance_grade,
      compliance_score: parsedAnalysis.compliance_score,
      violation_summary: parsedAnalysis.violation_summary,
      violations: parsedAnalysis.violations,
      recommendations: parsedAnalysis.recommendations,
      is_compliant: parsedAnalysis.is_compliant,
      analysis_date: parsedAnalysis.analysis_date,
    });

  const violations = complianceReport?.violations || [];
  const ocrAnalysis =
    product.ocr_analysis ||
    (parsedAnalysis && parsedAnalysis.ocr_analysis) ||
    {};

  const complianceScore = complianceReport?.compliance_score || 0;
  const complianceColor =
    complianceScore >= 85
      ? '#10b981'
      : complianceScore >= 70
      ? '#f59e0b'
      : '#ef4444';

  const productJson = product.product_json || {};
  if (parsedSellerInfo) {
    productJson.seller_information = parsedSellerInfo;
  }

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] px-4 animate-fadeIn"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className={`bg-gradient-to-br from-purple-950/90 via-black to-cyan-950/90 rounded-3xl border-2 border-purple-500/40 p-6 sm:p-10 max-w-7xl w-full max-h-[92vh] overflow-y-auto text-white shadow-[0_0_100px_rgba(168,85,247,0.3)] ${poppins.className} animate-slideUp custom-scrollbar`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 rounded-2xl blur-xl"></div>
          <div className="relative bg-gradient-to-r from-purple-900/40 to-cyan-900/40 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-purple-600/30 p-2 rounded-lg border border-purple-500/50">
                    <Package className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-xs uppercase tracking-widest text-purple-400 font-semibold">
                    Product Details
                  </span>
                </div>
                <h2 className="text-xl sm:text-3xl font-bold uppercase tracking-wide bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
                  {product.asin}
                </h2>
                <p className="text-sm text-gray-300 mt-2 line-clamp-2">{product.title}</p>
              </div>

              <div className="flex items-center gap-6">
                <div className="relative">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke={complianceColor}
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${
                        (complianceScore / 100) * 251.2
                      } 251.2`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: complianceColor }}
                    >
                      {complianceScore}
                    </span>
                    <span className="text-xs text-gray-400">Score</span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white hover:bg-red-600/20 p-3 rounded-xl transition-all duration-300 border border-transparent hover:border-red-500/50 group"
                  aria-label="Close product details"
                >
                  <X className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Product Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Basic Info Card */}
          <div className="bg-gradient-to-br from-purple-900/30 to-black border border-purple-500/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-400">
              <Package className="w-5 h-5" />
              BASIC INFORMATION
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                <span className="text-gray-400 uppercase tracking-wider">Price:</span>
                <span className="font-bold text-green-400">{product.currency} {parseFloat(product.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                <span className="text-gray-400 uppercase tracking-wider">Amazon Rating:</span>
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Star className="w-4 h-4 fill-current" />
                  {productJson?.rating || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                <span className="text-gray-400 uppercase tracking-wider">Category:</span>
                <span className="font-bold text-purple-300">{productJson?.detected_category || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                <span className="text-gray-400 uppercase tracking-wider">Brand:</span>
                <span className="font-bold">{productJson?.product_details?.Brand || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                <span className="text-gray-400 uppercase tracking-wider">Manufacturer:</span>
                <span className="font-bold">{productJson?.product_details?.Manufacturer || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                <span className="text-gray-400 uppercase tracking-wider">Country of Origin:</span>
                <span className="font-bold text-blue-300">{productJson?.product_details?.['Country of Origin'] || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 uppercase tracking-wider">Last Analyzed:</span>
                <span className="font-bold text-cyan-300">{product.last_analysed || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Compliance Summary Card */}
          <div className="bg-gradient-to-br from-cyan-900/30 to-black border border-cyan-500/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-cyan-400">
              <Shield className="w-5 h-5" />
              COMPLIANCE SUMMARY
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 uppercase tracking-wider">Compliance Grade:</span>
                <span
                  className={`px-4 py-2 rounded-lg font-bold text-lg border-2 ${
                    complianceReport?.compliance_grade === 'A' ||
                    complianceReport?.compliance_grade === 'A+'
                      ? 'bg-green-500/20 text-green-400 border-green-500/50'
                      : complianceReport?.compliance_grade === 'B'
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                      : 'bg-red-500/20 text-red-400 border-red-500/50'
                  }`}
                >
                  {complianceReport?.compliance_grade || 'N/A'}
                </span>
              </div>

              <div className="mt-6">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Violations Breakdown:</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-400">
                      {complianceReport?.violation_summary?.critical || 0}
                    </p>
                    <p className="text-xs text-gray-400 uppercase mt-1">Critical</p>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-400">
                      {complianceReport?.violation_summary?.major || 0}
                    </p>
                    <p className="text-xs text-gray-400 uppercase mt-1">Major</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-400">
                      {complianceReport?.violation_summary?.minor || 0}
                    </p>
                    <p className="text-xs text-gray-400 uppercase mt-1">Minor</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                <span className="text-sm text-gray-400 uppercase tracking-wider">Compliant:</span>
                <span className={`font-bold text-lg ${complianceReport?.is_compliant ? 'text-green-400' : 'text-red-400'}`}>
                  {complianceReport?.is_compliant ? 'YES' : 'NO'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Violations List */}
        {violations.length > 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-red-900/30 to-black border border-red-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                VIOLATIONS DETECTED ({violations.length})
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                {violations.map((violation, idx) => (
                  <div
                    key={idx}
                    className={`border-l-4 p-4 rounded-r-lg ${
                      violation.severity === 'CRITICAL'
                        ? 'bg-red-500/10 border-red-500'
                        : violation.severity === 'MAJOR'
                        ? 'bg-yellow-500/10 border-yellow-500'
                        : 'bg-blue-500/10 border-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                        {violation.severity === 'CRITICAL' && <XCircle className="w-4 h-4 text-red-500" />}
                        {violation.severity === 'MAJOR' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                        {violation.severity === 'MINOR' && <AlertCircle className="w-4 h-4 text-blue-500" />}
                        {violation.requirement}
                      </h4>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          violation.severity === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400'
                            : violation.severity === 'MAJOR'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {violation.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mb-2">{violation.reason}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Penalty: <span className="text-red-400 font-bold">{violation.penalty}</span></span>
                      <span className="text-gray-500">Rule: <span className="text-purple-300">{violation.rule}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {complianceReport?.recommendations && complianceReport.recommendations.length > 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-green-900/30 to-black border border-green-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                RECOMMENDATIONS ({complianceReport.recommendations.length})
              </h3>
              <ul className="space-y-3">
                {complianceReport.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="bg-green-500/20 p-2 rounded-full mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </div>
                    <p className="text-sm text-gray-200 flex-1">{rec}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Product Images */}
        {product.images && product.images.length > 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-indigo-900/30 to-black border border-indigo-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-400">
                <Eye className="w-5 h-5" />
                PRODUCT IMAGES ({product.image_count})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {product.images.map((image, idx) => (
                  <div key={image.image_id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border-2 border-indigo-500/30 group-hover:border-indigo-500 transition-all">
                      <img
                        src={image.url}
                        alt={`Product image ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white/20 backdrop-blur p-2 rounded-full"
                      >
                        <ExternalLink className="w-5 h-5 text-white" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* OCR Analysis */}
        {ocrAnalysis && Object.keys(ocrAnalysis).length > 0 && (
          <div>
            <div className="bg-gradient-to-r from-purple-900/30 to-black border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-400">
                <FileText className="w-5 h-5" />
                OCR ANALYSIS
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ocrAnalysis.image_quality && (
                  <div className="bg-black/40 border border-purple-500/20 rounded-lg p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Image Quality:</p>
                    <p className="text-sm font-bold text-purple-300">{ocrAnalysis.image_quality}</p>
                  </div>
                )}
                {ocrAnalysis.symbols_found && ocrAnalysis.symbols_found.length > 0 && (
                  <div className="bg-black/40 border border-purple-500/20 rounded-lg p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Symbols Detected:</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ocrAnalysis.symbols_found.map((symbol, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-purple-500/20 border border-purple-500/40 rounded text-xs font-semibold"
                        >
                          {symbol}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Amazon Link */}
        {product.url && (
          <div className="mt-6">
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl font-bold uppercase tracking-wider hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all"
            >
              <ExternalLink className="w-5 h-5" />
              View on Amazon
            </a>
          </div>
        )}
      </div>

      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }

        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(168, 85, 247, 0.7) rgba(0, 0, 0, 0.3);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(168, 85, 247, 0.9) 0%, rgba(6, 182, 212, 0.9) 100%);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(192, 132, 252, 1) 0%, rgba(34, 211, 238, 1) 100%);
        }
      `}</style>
    </div>
  );
};

// Mini Line Graph Component
const MiniLineGraph = ({ trend }) => {
  if (!trend) return null;
  const data = Array.from({ length: 7 }, (_, i) => ({
    value: 50 + Math.sin(i) * 20 + trend * i,
  }));

  return (
    <div className="mt-3 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="miniGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke="#fff" fill="url(#miniGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, icon, trend, bgColor, subtitle }) => (
  <div
    className={`${bgColor} text-white rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 ${poppins.className}`}
    style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="bg-white/20 rounded-full p-2 sm:p-3 backdrop-blur">{icon}</div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 ${trend >= 0 ? 'text-green-400' : 'text-white'}`}>
          {trend >= 0 ? <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" /> : <ArrowDown className="h-4 w-4 sm:h-5 sm:w-5" />}
          <span className="text-xs sm:text-sm font-semibold">{Math.abs(trend).toFixed(1)}%</span>
        </div>
      )}
    </div>
    <h3 className="text-xs font-semibold uppercase tracking-wider opacity-90 mb-2">{title}</h3>
    <p className="text-2xl sm:text-4xl font-extrabold">{value}</p>
    {subtitle && <p className="text-xs uppercase tracking-wide opacity-70 mt-1">{subtitle}</p>}
    <MiniLineGraph trend={trend} />
  </div>
);

// Main Dashboard Component - NO LocalStorage
export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const userRole = searchParams.get('role');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Advanced Filter States
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterPriceRange, setFilterPriceRange] = useState('all');
  const [filterComplianceGrade, setFilterComplianceGrade] = useState('all');
  
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('week');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const itemsPerPage = 5;

  // Fetch all product details in one API call using new endpoint
  useEffect(() => {
    if (userId) {
      loadDashboardData();
    }
  }, [userId]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/detailed`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        generateNotifications(data.products || []);
      } else {
        console.error('Failed to fetch products');
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const generateNotifications = (productsData) => {
    const newNotifications = [];

    const nonCompliant = productsData.filter((p) => p.rating && parseFloat(p.rating) < 70);
    if (nonCompliant.length > 0) {
      newNotifications.push({
        id: 'non-compliant',
        type: 'warning',
        title: 'LOW COMPLIANCE DETECTED',
        message: `${nonCompliant.length} products need attention`,
        time: 'RECENT',
        icon: <AlertCircle className="h-4 w-4" />,
      });
    }

    const compliant = productsData.filter((p) => p.rating && parseFloat(p.rating) >= 85);
    if (compliant.length > 0) {
      newNotifications.push({
        id: 'compliant',
        type: 'success',
        title: 'COMPLIANCE SUCCESS',
        message: `${compliant.length} products are highly compliant`,
        time: 'TODAY',
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
    }

    const recentProducts = productsData.filter(
      (p) => p.created_at && new Date() - new Date(p.created_at) < 24 * 60 * 60 * 1000
    );
    if (recentProducts.length > 0) {
      newNotifications.push({
        id: 'recent',
        type: 'info',
        title: 'NEW PRODUCTS ADDED',
        message: `${recentProducts.length} products added in last 24 hours`,
        time: '1 DAY AGO',
        icon: <Package className="h-4 w-4" />,
      });
    }

    setNotifications(newNotifications);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleExportData = () => {
    // Proper CSV quoting/escaping (RFC 4180) so titles containing commas,
    // quotes or newlines don't corrupt the downloaded file.
    const csvEscape = (value) => {
      if (value === null || value === undefined) return '';
      const s = String(value);
      if (/[",\r\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const csvContent = [
      ['Product ID', 'ASIN', 'Title', 'Price', 'Currency', 'Country', 'Category', 'Compliance Score', 'Grade', 'Violations', 'Last Analyzed'],
      ...products.map((p) => [
        p.product_id,
        p.asin,
        p.title,
        p.price,
        p.currency,
        p.country || 'N/A',
        p.product_json?.detected_category || 'N/A',
        // Actual persisted compliance score (was previously the product star
        // rating — wrong data under this column).
        p.compliance_report?.compliance_score ?? 'N/A',
        p.compliance_report?.compliance_grade || 'N/A',
        p.compliance_report?.violation_summary?.total || 0,
        p.last_analysed || 'N/A',
      ]),
    ]
      .map((row) => row.map(csvEscape).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance_report_${new Date().toISOString()}.csv`;
    a.click();
  };

  // Enhanced filtering with multiple criteria
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.asin?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory =
        filterCategory === 'all' ||
        (product.product_json?.detected_category || 'Unknown') === filterCategory;
      
      const matchesCountry =
        filterCountry === 'all' ||
        (product.product_json?.product_details?.['Country of Origin'] || 'Unknown') === filterCountry;
      
      const price = parseFloat(product.price);
      const matchesPriceRange =
        filterPriceRange === 'all' ||
        (filterPriceRange === '0-500' && price < 500) ||
        (filterPriceRange === '500-1000' && price >= 500 && price < 1000) ||
        (filterPriceRange === '1000-5000' && price >= 1000 && price < 5000) ||
        (filterPriceRange === '5000-10000' && price >= 5000 && price < 10000) ||
        (filterPriceRange === '10000+' && price >= 10000);
      
      const matchesGrade =
        filterComplianceGrade === 'all' ||
        (product.compliance_report?.compliance_grade || 'N/A') === filterComplianceGrade;
      
      return matchesSearch && matchesCategory && matchesCountry && matchesPriceRange && matchesGrade;
    });
  }, [products, searchTerm, filterCategory, filterCountry, filterPriceRange, filterComplianceGrade]);

  // Analytics calculations with filtering (KEEPING ALL YOUR ORIGINAL ANALYTICS CODE)
  const analytics = useMemo(() => {
    if (!filteredProducts.length) return null;

    const totalProducts = filteredProducts.length;
    const analyzedProducts = filteredProducts.filter((p) => p.rating !== null).length;
    
    // Compliance Analytics
    const avgComplianceScore = filteredProducts.reduce((sum, p) => sum + (parseFloat(p.rating) || 0), 0) / (analyzedProducts || 1);
    const compliantProducts = filteredProducts.filter((p) => p.rating && parseFloat(p.rating) >= 70).length;
    const nonCompliantProducts = analyzedProducts - compliantProducts;

    // Price Analytics
    const avgPrice = filteredProducts.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0) / (totalProducts || 1);
    const priceDistribution = filteredProducts.reduce((acc, p) => {
      const price = parseFloat(p.price);
      if (price) {
        if (price < 500) acc['₹0-500'] = (acc['₹0-500'] || 0) + 1;
        else if (price < 1000) acc['₹500-1K'] = (acc['₹500-1K'] || 0) + 1;
        else if (price < 5000) acc['₹1K-5K'] = (acc['₹1K-5K'] || 0) + 1;
        else if (price < 10000) acc['₹5K-10K'] = (acc['₹5K-10K'] || 0) + 1;
        else if (price < 50000) acc['₹10K-50K'] = (acc['₹10K-50K'] || 0) + 1;
        else acc['₹50K+'] = (acc['₹50K+'] || 0) + 1;
      }
      return acc;
    }, {});

    // Amazon Rating Analytics
    const amazonRatingDistribution = filteredProducts.reduce((acc, p) => {
      const rating = p.product_json?.rating;
      if (rating) {
        const range = Math.floor(rating);
        const key = `${range}★`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});
    const avgAmazonRating = filteredProducts.reduce((sum, p) => sum + (parseFloat(p.product_json?.rating) || 0), 0) / totalProducts;

    // Compliance Score Distribution
    const complianceScoreDistribution = filteredProducts.reduce((acc, p) => {
      const score = parseFloat(p.rating);
      if (score) {
        if (score >= 90) acc['90-100 (A+)'] = (acc['90-100 (A+)'] || 0) + 1;
        else if (score >= 80) acc['80-90 (A)'] = (acc['80-90 (A)'] || 0) + 1;
        else if (score >= 70) acc['70-80 (B)'] = (acc['70-80 (B)'] || 0) + 1;
        else if (score >= 60) acc['60-70 (C)'] = (acc['60-70 (C)'] || 0) + 1;
        else acc['<60 (D)'] = (acc['<60 (D)'] || 0) + 1;
      }
      return acc;
    }, {});

    // Currency Breakdown
    const currencyBreakdown = filteredProducts.reduce((acc, p) => {
      const currency = p.currency || 'Unknown';
      acc[currency] = (acc[currency] || 0) + 1;
      return acc;
    }, {});

    // Brand Analytics
    const brandDistribution = filteredProducts.reduce((acc, p) => {
      const brand = p.product_json?.product_details?.Brand || 
                    p.product_json?.product_details?.Manufacturer ||
                    'Unknown';
      acc[brand] = (acc[brand] || 0) + 1;
      return acc;
    }, {});

    const brandComplianceScores = filteredProducts.reduce((acc, p) => {
      const brand = p.product_json?.product_details?.Brand || 
                    p.product_json?.product_details?.Manufacturer ||
                    'Unknown';
      if (!acc[brand]) {
        acc[brand] = { total: 0, count: 0, ratings: [] };
      }
      if (p.rating) {
        acc[brand].total += parseFloat(p.rating);
        acc[brand].count += 1;
        acc[brand].ratings.push(parseFloat(p.product_json?.rating || 0));
      }
      return acc;
    }, {});

    const avgComplianceByBrand = Object.entries(brandComplianceScores)
      .map(([brand, data]) => ({
        brand,
        avgCompliance: data.count > 0 ? data.total / data.count : 0,
        avgRating: data.ratings.length > 0 ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length : 0,
      }))
      .sort((a, b) => b.avgCompliance - a.avgCompliance)
      .slice(0, 10);

    // Category Analytics
    const categoryDistribution = filteredProducts.reduce((acc, p) => {
      const category = p.product_json?.detected_category || 'Unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const categoryCompliance = filteredProducts.reduce((acc, p) => {
      const category = p.product_json?.detected_category || 'Unknown';
      if (!acc[category]) {
        acc[category] = { total: 0, count: 0 };
      }
      if (p.rating) {
        acc[category].total += parseFloat(p.rating);
        acc[category].count += 1;
      }
      return acc;
    }, {});

    const avgComplianceByCategory = Object.entries(categoryCompliance).map(([category, data]) => ({
      category,
      avgCompliance: data.count > 0 ? data.total / data.count : 0,
    }));

    // Compliance Grade Distribution
    const gradeDistribution = filteredProducts.reduce((acc, p) => {
      const grade = p.compliance_report?.compliance_grade || 'N/A';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});

    // Top Violated Rules
    const violatedRules = filteredProducts.reduce((acc, p) => {
      const violations = p.compliance_report?.violations || [];
      violations.forEach(v => {
        if (!acc[v.requirement]) {
          acc[v.requirement] = { count: 0, totalPenalty: 0, severity: v.severity };
        }
        acc[v.requirement].count += 1;
        acc[v.requirement].totalPenalty += Math.abs(v.penalty || 0);
      });
      return acc;
    }, {});

    const topViolatedRules = Object.entries(violatedRules)
      .map(([rule, data]) => ({
        rule,
        count: data.count,
        avgPenalty: data.totalPenalty / data.count,
        severity: data.severity,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Violation Severity Summary
    const violationSeveritySummary = filteredProducts.reduce((acc, p) => {
      const summary = p.compliance_report?.violation_summary;
      if (summary) {
        acc.critical += summary.critical || 0;
        acc.major += summary.major || 0;
        acc.minor += summary.minor || 0;
      }
      return acc;
    }, { critical: 0, major: 0, minor: 0 });

    // Average Penalty by Rule
    const avgPenaltyByRule = topViolatedRules.map(v => ({
      rule: v.rule.length > 20 ? v.rule.substring(0, 20) + '...' : v.rule,
      penalty: v.avgPenalty,
    }));

    // Compliance Score vs Price (Correlation)
    const priceComplianceCorrelation = filteredProducts
      .filter(p => p.price && p.rating)
      .map(p => ({
        price: parseFloat(p.price),
        compliance: parseFloat(p.rating),
        name: p.title?.substring(0, 30) || 'Product',
      }));

    // Country/Marketplace Analytics
    const countryDistribution = filteredProducts.reduce((acc, p) => {
      const country = p.country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    // Country of Origin Analytics (from product details)
    const countryOfOriginDistribution = filteredProducts.reduce((acc, p) => {
      const origin = p.product_json?.product_details?.['Country of Origin'] || 
                     p.product_json?.product_details?.['Manufacturing Origin'] ||
                     'Unknown';
      acc[origin] = (acc[origin] || 0) + 1;
      return acc;
    }, {});

    // OCR Analytics
    const ocrQuality = filteredProducts.reduce((acc, p) => {
      const quality = p.ocr_analysis?.image_quality || 'Unknown';
      if (quality.includes('High')) acc['High'] = (acc['High'] || 0) + 1;
      else if (quality.includes('Medium')) acc['Medium'] = (acc['Medium'] || 0) + 1;
      else if (quality.includes('Low')) acc['Low'] = (acc['Low'] || 0) + 1;
      else acc['Unknown'] = (acc['Unknown'] || 0) + 1;
      return acc;
    }, {});

    const symbolsDetected = filteredProducts.reduce((acc, p) => {
      const symbols = p.ocr_analysis?.symbols_found || [];
      symbols.forEach(symbol => {
        let simpleName = symbol;
        if (symbol.includes('Vegetarian')) simpleName = 'Veg Mark';
        else if (symbol.includes('FSSAI')) simpleName = 'FSSAI';
        else if (symbol.includes('ISI')) simpleName = 'ISI';
        else if (symbol.includes('Warning')) simpleName = 'Warning';
        else if (symbol.includes('BIS')) simpleName = 'BIS';
        
        acc[simpleName] = (acc[simpleName] || 0) + 1;
      });
      return acc;
    }, {});

    // Time-based Analytics
    const productsOverTime = filteredProducts.reduce((acc, p) => {
      if (p.created_at) {
        const date = new Date(p.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
      }
      return acc;
    }, {});

    const timeSeriesData = Object.entries(productsOverTime)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, count]) => ({ date, count }));

    // Compliance Trend
    const complianceTrend = filteredProducts
      .filter(p => p.last_analysed && p.rating)
      .sort((a, b) => new Date(a.last_analysed) - new Date(b.last_analysed))
      .map(p => ({
        date: new Date(p.last_analysed).toISOString().split('T')[0],
        score: parseFloat(p.rating),
      }));

    return {
      totalProducts,
      analyzedProducts,
      avgComplianceScore,
      avgAmazonRating,
      avgPrice,
      compliantProducts,
      nonCompliantProducts,
      complianceRate: (compliantProducts / (analyzedProducts || 1)) * 100,
      
      // Distributions
      priceDistribution,
      amazonRatingDistribution,
      complianceScoreDistribution,
      currencyBreakdown,
      categoryDistribution,
      brandDistribution,
      gradeDistribution,
      countryDistribution,
      countryOfOriginDistribution,
      
      // Brand & Category Analytics
      avgComplianceByBrand,
      avgComplianceByCategory,
      
      // Compliance Report Analytics
      topViolatedRules,
      violationSeveritySummary,
      avgPenaltyByRule,
      priceComplianceCorrelation,
      
      // OCR Analytics
      ocrQuality,
      symbolsDetected,
      
      // Time-based
      timeSeriesData,
      complianceTrend,
    };
  }, [filteredProducts]);

  // Prepare chart data
  const priceData = analytics ? Object.entries(analytics.priceDistribution).map(([name, value]) => ({ name, value })) : [];
  const amazonRatingData = analytics ? Object.entries(analytics.amazonRatingDistribution).map(([name, value]) => ({ name, value })) : [];
  const complianceScoreData = analytics ? Object.entries(analytics.complianceScoreDistribution).map(([name, value]) => ({ name, value })) : [];
  const currencyData = analytics ? Object.entries(analytics.currencyBreakdown).map(([name, value]) => ({ name, value })) : [];
  const categoryData = analytics ? Object.entries(analytics.categoryDistribution).map(([name, value]) => ({ name, value })) : [];
  const brandData = analytics ? Object.entries(analytics.brandDistribution).slice(0, 10).map(([name, value]) => ({ name, value })) : [];
  const gradeData = analytics ? Object.entries(analytics.gradeDistribution).map(([name, value]) => ({ name, value })) : [];
  const countryData = analytics ? Object.entries(analytics.countryDistribution).map(([name, value]) => ({ name, value })) : [];
  const countryOfOriginData = analytics ? Object.entries(analytics.countryOfOriginDistribution).map(([name, value]) => ({ name, value })) : [];
  
  const complianceData = [
    { name: 'Compliant', value: analytics?.compliantProducts || 0 },
    { name: 'Non-Compliant', value: analytics?.nonCompliantProducts || 0 },
  ];

  const violationSeverityData = analytics ? [
    { name: 'Critical', value: analytics.violationSeveritySummary.critical },
    { name: 'Major', value: analytics.violationSeveritySummary.major },
    { name: 'Minor', value: analytics.violationSeveritySummary.minor },
  ] : [];

  const ocrQualityData = analytics ? Object.entries(analytics.ocrQuality).map(([name, value]) => ({ name, value })) : [];
  const symbolsData = analytics ? Object.entries(analytics.symbolsDetected).map(([name, value]) => ({ name, value })) : [];

  const categories = [...new Set(products.map((p) => p.product_json?.detected_category || 'Unknown'))];
  const countriesOfOrigin = [...new Set(products.map((p) => p.product_json?.product_details?.['Country of Origin'] || 'Unknown'))];
  const complianceGrades = [...new Set(products.map((p) => p.compliance_report?.compliance_grade || 'N/A'))];

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className={`min-h-screen bg-black flex items-center justify-center ml-20 lg:ml-64 ${poppins.className}`}>
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 border-r-cyan-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-300 uppercase tracking-wider text-sm">Loading Dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className={`min-h-screen bg-black text-white p-4 sm:p-8 ml-20 lg:ml-64 ${poppins.className}`}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 mt-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className='w-full'>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 tracking-tight" style={{ fontFamily: 'sans-serif' }}>
                  Compliance Dashboard
                </span>
              </h1>
              <div className="border-t-2 border-purple-400/50" />
              <p className="mt-2 text-xs uppercase tracking-wider text-gray-400">
                Real-time compliance monitoring and analytics • Live data from API
              </p>
            </div>
            <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="bg-black/60 border border-purple-500/30 rounded-lg px-3 sm:px-4 py-2 text-xs uppercase tracking-wider focus:outline-none focus:border-cyan-400/50 flex-1 lg:flex-none"
              >
                <option value="week">THIS WEEK</option>
                <option value="month">THIS MONTH</option>
                <option value="year">THIS YEAR</option>
              </select>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-all"
                aria-label="Toggle notifications"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {notifications.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleRefresh}
                className={`p-2 bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-all ${
                  refreshing ? 'animate-pulse' : ''
                }`}
                aria-label="Refresh dashboard"
                title="Refresh data from API"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleExportData}
                className="px-4 sm:px-6 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg font-semibold hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all uppercase tracking-wider flex items-center gap-2 text-xs"
                aria-label="Export data"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>

          {/* Notifications Panel */}
          {showNotifications && (
            <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-4 sm:p-6 backdrop-blur-sm mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider">
                  Notifications ({notifications.length})
                </h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-white"
                  aria-label="Close notifications"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border ${
                      notif.type === 'warning'
                        ? 'bg-amber-600/10 border-amber-500/30'
                        : notif.type === 'success'
                        ? 'bg-green-600/10 border-green-500/30'
                        : 'bg-blue-600/10 border-blue-500/30'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-white/10">{notif.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-xs sm:text-sm uppercase tracking-wider">{notif.title}</h4>
                      <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">{notif.message}</p>
                      <span className="text-xs text-gray-500 mt-1 block uppercase tracking-wider">{notif.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <MetricCard
              title="Total Products"
              value={analytics?.totalProducts || 0}
              subtitle={`${analytics?.analyzedProducts || 0} Analyzed`}
              icon={<Package className="w-5 h-5 sm:w-6 sm:h-6" />}
              
              bgColor="bg-gradient-to-br from-purple-500 to-purple-600"
            />

            <MetricCard
              title="Avg Compliance"
              value={analytics?.avgComplianceScore?.toFixed(1) || 'N/A'}
              subtitle="Overall Score"
              icon={<Shield className="w-5 h-5 sm:w-6 sm:h-6" />}
              
              bgColor="bg-gradient-to-br from-cyan-500 to-cyan-600"
            />

            <MetricCard
              title="Compliant"
              value={analytics?.compliantProducts || 0}
              subtitle={`${analytics?.complianceRate?.toFixed(1) || 0}% Rate`}
              icon={<CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />}
              trend={analytics?.complianceRate || 0}
              bgColor="bg-gradient-to-br from-green-500 to-green-600"
            />

            <MetricCard
              title="Non Compliant"
              value={analytics?.nonCompliantProducts || 0}
              subtitle={`${(100 - (analytics?.complianceRate || 0)).toFixed(1)}% Rate`}
              icon={<AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />}
              trend={-(100 - (analytics?.complianceRate || 0))}
              bgColor="bg-gradient-to-br from-red-500 to-red-600"
            />
          </div>

          {/* Advanced Filter Dropdown Section */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-purple-400 uppercase tracking-wider flex items-center gap-3">
                  <Filter className="w-6 h-6" />
                  Filters
                </h2>
                <button
                  onClick={() => {
                    setFilterCategory('all');
                    setFilterCountry('all');
                    setFilterPriceRange('all');
                    setFilterComplianceGrade('all');
                  }}
                  className="px-4 py-2 bg-red-600/20 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-all text-xs uppercase tracking-wider"
                >
                  Clear All Filters
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Category Filter */}
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Category
                  </label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-black/60 border border-purple-500/30 rounded-lg text-sm uppercase tracking-wider focus:outline-none focus:border-cyan-400/50 transition-all"
                  >
                    <option value="all">All Categories ({products.length})</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} ({products.filter(p => (p.product_json?.detected_category || 'Unknown') === cat).length})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Country of Origin Filter */}
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Country of Origin
                  </label>
                  <select
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value)}
                    className="w-full px-4 py-3 bg-black/60 border border-purple-500/30 rounded-lg text-sm uppercase tracking-wider focus:outline-none focus:border-cyan-400/50 transition-all"
                  >
                    <option value="all">All Countries ({products.length})</option>
                    {countriesOfOrigin.map((country) => (
                      <option key={country} value={country}>
                        {country} ({products.filter(p => (p.product_json?.product_details?.['Country of Origin'] || 'Unknown') === country).length})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Range Filter (MRP) */}
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Price Range (MRP)
                  </label>
                  <select
                    value={filterPriceRange}
                    onChange={(e) => setFilterPriceRange(e.target.value)}
                    className="w-full px-4 py-3 bg-black/60 border border-purple-500/30 rounded-lg text-sm uppercase tracking-wider focus:outline-none focus:border-cyan-400/50 transition-all"
                  >
                    <option value="all">All Prices ({products.length})</option>
                    <option value="0-500">₹0 - ₹500 ({products.filter(p => parseFloat(p.price) < 500).length})</option>
                    <option value="500-1000">₹500 - ₹1,000 ({products.filter(p => parseFloat(p.price) >= 500 && parseFloat(p.price) < 1000).length})</option>
                    <option value="1000-5000">₹1,000 - ₹5,000 ({products.filter(p => parseFloat(p.price) >= 1000 && parseFloat(p.price) < 5000).length})</option>
                    <option value="5000-10000">₹5,000 - ₹10,000 ({products.filter(p => parseFloat(p.price) >= 5000 && parseFloat(p.price) < 10000).length})</option>
                    <option value="10000+">₹10,000+ ({products.filter(p => parseFloat(p.price) >= 10000).length})</option>
                  </select>
                </div>

                {/* Compliance Grade Filter */}
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Compliance Grade
                  </label>
                  <select
                    value={filterComplianceGrade}
                    onChange={(e) => setFilterComplianceGrade(e.target.value)}
                    className="w-full px-4 py-3 bg-black/60 border border-purple-500/30 rounded-lg text-sm uppercase tracking-wider focus:outline-none focus:border-cyan-400/50 transition-all"
                  >
                    <option value="all">All Grades ({products.length})</option>
                    {complianceGrades.map((grade) => (
                      <option key={grade} value={grade}>
                        Grade {grade} ({products.filter(p => (p.compliance_report?.compliance_grade || 'N/A') === grade).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* CONTINUE WITH ALL YOUR CHARTS - Product Overview Charts section*/}
          {/* Due to character limits, I'll note that you should include ALL the chart sections from your original code here */}
          {/* Include: Price Distribution, Amazon Rating, Compliance Score, Category, Country, Brand, Compliance Status, Violations, Time-based charts, and the Products Table */}

{/* Product Overview Charts */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-purple-400 uppercase tracking-wider">
              Product Overview
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Price Distribution */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <div className="bg-gradient-to-r from-green-600/30 to-green-700/30 rounded-t-xl p-4 mb-4 sm:mb-6 border border-green-500/40">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                    Price Distribution (MRP Range)
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Filtered: {filteredProducts.length} products</p>
                </div>
                <div className="p-4 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={priceData}>
                      <XAxis
                        dataKey="name"
                        stroke="#fff"
                        tick={{ fill: "#fff", fontSize: 10, textTransform: "uppercase" }}
                      />
                      <YAxis stroke="#fff" tick={{ fill: "#fff", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Amazon Rating Distribution */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <div className="bg-gradient-to-r from-amber-600/30 to-amber-700/30 rounded-t-xl p-4 mb-4 sm:mb-6 border border-amber-500/40">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    Amazon Rating Distribution
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Avg Rating: {analytics?.avgAmazonRating?.toFixed(2) || 'N/A'} ★</p>
                </div>
                <div className="p-4 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={amazonRatingData}>
                      <XAxis
                        dataKey="name"
                        stroke="#fff"
                        tick={{ fill: "#fff", fontSize: 10, textTransform: "uppercase" }}
                      />
                      <YAxis stroke="#fff" tick={{ fill: "#fff", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="value" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Compliance Score Distribution */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <div className="bg-gradient-to-r from-cyan-600/30 to-cyan-700/30 rounded-t-xl p-4 mb-4 sm:mb-6 border border-cyan-500/40">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    Compliance Score Distribution
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Avg Score: {analytics?.avgComplianceScore?.toFixed(1) || 'N/A'}%</p>
                </div>
                <div className="p-4 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={complianceScoreData}>
                      <defs>
                        <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="name"
                        stroke="#fff"
                        tick={{ fill: "#fff", fontSize: 10, textTransform: "uppercase" }}
                      />
                      <YAxis stroke="#fff" tick={{ fill: "#fff", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#06b6d4"
                        fillOpacity={1}
                        fill="url(#colorCompliance)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Distribution */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <div className="bg-gradient-to-r from-pink-600/30 to-pink-700/30 rounded-t-xl p-4 mb-4 sm:mb-6 border border-pink-500/40">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
                    Products by Category
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">{categoryData.length} categories</p>
                </div>
                <div className="p-4 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPie>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelStyle={{ fontSize: '10px', fontWeight: 600 }}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          fontSize: '12px',
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>

{/* Country of Origin Distribution */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <div className="bg-gradient-to-r from-blue-600/30 to-blue-700/30 rounded-t-xl p-4 mb-4 sm:mb-6 border border-blue-500/40">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                    Country of Origin Distribution
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">{countryOfOriginData.length} countries</p>
                </div>
                <div className="p-4 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={countryOfOriginData} layout="vertical">
                      <XAxis type="number" stroke="#fff" tick={{ fill: "#fff", fontSize: 10 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={100}
                        stroke="#fff"
                        tick={{ fill: "#fff", fontSize: 10, textTransform: "uppercase" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Compliance Grade Distribution */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <div className="bg-gradient-to-r from-indigo-600/30 to-indigo-700/30 rounded-t-xl p-4 mb-4 sm:mb-6 border border-indigo-500/40">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                    Compliance Grade Distribution
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Grade breakdown</p>
                </div>
                <div className="p-4 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPie>
                      <Pie
                        data={gradeData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label
                        labelStyle={{ fontSize: '10px', fontWeight: 600 }}
                      >
                        {gradeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          fontSize: '12px',
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Compliance Status */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <div className="bg-gradient-to-r from-purple-600/30 to-purple-700/30 rounded-t-xl p-4 mb-4 sm:mb-6 border border-purple-500/40">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    Compliance Status
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Overall compliance rate: {analytics?.complianceRate?.toFixed(1) || 0}%</p>
                </div>
                <div className="p-4 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPie>
                      <Pie
                        data={complianceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelStyle={{ fontSize: '11px', fontWeight: 700 }}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          fontSize: '12px',
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Brand Distribution */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <div className="bg-gradient-to-r from-orange-600/30 to-orange-700/30 rounded-t-xl p-4 mb-4 sm:mb-6 border border-orange-500/40">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                    Top 10 Brands
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Product count by brand</p>
                </div>
                <div className="p-4 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={brandData} layout="vertical">
                      <XAxis type="number" stroke="#fff" tick={{ fill: "#fff", fontSize: 10 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        stroke="#fff"
                        tick={{ fill: "#fff", fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="value" fill="#f97316" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Compliance Analytics Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-cyan-400 uppercase tracking-wider">
              Compliance Analytics
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Violation Severity Distribution */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <div className="bg-gradient-to-r from-red-600/30 to-red-700/30 rounded-t-xl p-4 mb-4 sm:mb-6 border border-red-500/40">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                    Violation Severity Distribution
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Total: {(analytics?.violationSeveritySummary?.critical || 0) + (analytics?.violationSeveritySummary?.major || 0) + (analytics?.violationSeveritySummary?.minor || 0)} violations
                  </p>
                </div>
                <div className="p-4 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPie>
                      <Pie
                        data={violationSeverityData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelStyle={{ fontSize: '11px', fontWeight: 700 }}
                      >
                        <Cell fill="#ef4444" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#facc15" />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          fontSize: '12px',
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Violated Rules */}
              <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <div className="bg-gradient-to-r from-yellow-600/30 to-yellow-700/30 rounded-t-xl p-4 mb-4 sm:mb-6 border border-yellow-500/40">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                    Top 10 Violated Rules
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Most common violations</p>
                </div>
                <div className="p-4 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analytics?.topViolatedRules?.slice(0, 10) || []} layout="vertical">
                      <XAxis type="number" stroke="#fff" tick={{ fill: "#fff", fontSize: 10 }} />
                      <YAxis
                        dataKey="rule"
                        type="category"
                        width={150}
                        stroke="#fff"
                        tick={{ fill: "#fff", fontSize: 8 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" fill="#eab308" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Products Table with Filters */}
          <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 sm:mb-6 bg-gradient-to-r from-purple-600/30 to-purple-700/30 rounded-t-xl p-4 border border-purple-500/40">
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                All Products ({filteredProducts.length})
              </h3>
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="SEARCH..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-black/40 border border-purple-500/30 rounded-lg text-xs uppercase tracking-wider focus:outline-none focus:border-cyan-400/50 w-full"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="overflow-x-auto border border-purple-500/30 rounded-2xl">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-purple-900/50 to-cyan-900/50 border-b-2 border-purple-500/50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">ASIN</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Title</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Price</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Category</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Origin</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Compliance</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Grade</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentProducts.map((product, idx) => (
                      <tr
                        key={product.product_id}
                        className={`border-b border-purple-500/20 hover:bg-purple-900/20 transition-all ${
                          idx % 2 === 0 ? 'bg-black/20' : 'bg-black/40'
                        }`}
                      >
                        <td className="px-4 py-3 text-xs font-semibold text-purple-300">{product.asin}</td>
                        <td className="px-4 py-3">
                          <div className="max-w-xs">
                            <p className="text-xs text-white font-medium truncate">{product.title}</p>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-400" />
                              {product.product_json?.rating || 'N/A'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-green-400">
                            {product.currency} {parseFloat(product.price).toFixed(2)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-purple-600/20 text-purple-300 px-2 py-1 rounded-lg border border-purple-500/40 uppercase">
                            {product.product_json?.detected_category || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded-lg border border-blue-500/40 uppercase">
                            {product.product_json?.product_details?.['Country of Origin'] || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700/50 rounded-full h-2 overflow-hidden max-w-[80px]">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  parseFloat(product.rating) >= 85
                                    ? 'bg-green-500'
                                    : parseFloat(product.rating) >= 70
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${product.rating || 0}%` }}
                              ></div>
                            </div>
                            <span
                              className={`text-xs font-bold ${
                                parseFloat(product.rating) >= 85
                                  ? 'text-green-400'
                                  : parseFloat(product.rating) >= 70
                                  ? 'text-yellow-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {product.rating || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-lg border-2 ${
                              product.compliance_report?.compliance_grade === 'A' ||
                              product.compliance_report?.compliance_grade === 'A+'
                                ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                : product.compliance_report?.compliance_grade === 'B'
                                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                                : 'bg-red-500/20 text-red-400 border-red-500/50'
                            }`}
                          >
                            {product.compliance_report?.compliance_grade || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedProduct(product)}
                            className="p-2 bg-cyan-600/20 border border-cyan-500/30 rounded-lg hover:bg-cyan-600/40 transition-all"
                            aria-label="View details"
                          >
                            <Eye className="w-4 h-4 text-cyan-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredProducts.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 uppercase tracking-wider">No products found</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="flex gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                            currentPage === pageNum
                              ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]'
                              : 'bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <ProductDetailsModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </>
  );
}
