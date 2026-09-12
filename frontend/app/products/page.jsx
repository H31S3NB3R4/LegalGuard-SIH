'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Poppins } from 'next/font/google';
import Navbar from '../Navbar';
import { checkAddressLocation } from '../../lib/geocoder';
import {
  Package,
  Eye,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ShoppingCart,
  X,
  Shield,
  DollarSign,
  Star,
  MessageSquare,
  Map,
  BarChart3,
  CheckCircle2,
  XCircle,
  Zap,
  FileText,
  Users,
  MapPin,
  ExternalLink,
  Calendar,
  Package2,
  Weight,
  Ruler,
  Info,
  Globe,
  Tag,
  Factory, // Add this icon for manufacturer
} from 'lucide-react';

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

// ==================== COMPREHENSIVE DATA EXTRACTION UTILITY ====================
const deepSearchValue = (obj, searchKeys, depth = 0, maxDepth = 5) => {
  if (depth > maxDepth || !obj || typeof obj !== 'object') return null;
  
  for (const key of searchKeys) {
    const lowerKey = key.toLowerCase();
    for (const objKey in obj) {
      if (objKey.toLowerCase() === lowerKey) {
        const value = obj[objKey];
        if (value && value !== 'null' && value !== null) {
          return value;
        }
      }
    }
  }
  
  for (const key of searchKeys) {
    const lowerKey = key.toLowerCase();
    for (const objKey in obj) {
      if (objKey.toLowerCase().includes(lowerKey) || lowerKey.includes(objKey.toLowerCase())) {
        const value = obj[objKey];
        if (value && value !== 'null' && value !== null && typeof value !== 'object') {
          return value;
        }
      }
    }
  }
  
  for (const objKey in obj) {
    const value = obj[objKey];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const result = deepSearchValue(value, searchKeys, depth + 1, maxDepth);
      if (result) return result;
    }
  }
  
  return null;
};

const getValueFromAllSources = (product, ...possibleKeys) => {
  if (!product) return null;
  
  const allKeys = possibleKeys.flat();
  const productJson = product.product_json || {};
  const specifications = productJson.specifications || productJson.product_details || {};
  const extra = productJson.extra || {};
  const importantInfo = productJson.important_information || productJson.important_info || {};
  
  const directValue = deepSearchValue(productJson, allKeys, 0, 2);
  if (directValue) return directValue;
  
  const specsValue = deepSearchValue(specifications, allKeys, 0, 2);
  if (specsValue) return specsValue;
  
  const importantValue = deepSearchValue(importantInfo, allKeys, 0, 2);
  if (importantValue) return importantValue;
  
  const extraValue = deepSearchValue(extra, allKeys, 0, 2);
  if (extraValue) return extraValue;
  
  const topLevelValue = deepSearchValue(product, allKeys, 0, 2);
  if (topLevelValue) return topLevelValue;
  
  return null;
};

const safeJsonParse = (jsonString, fallback = null) => {
  if (!jsonString) return fallback;
  if (typeof jsonString === 'object') return jsonString;
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback;
  }
};

const extractAllProductDetails = (product) => {
  const productJson = product?.product_json || {};
  const specifications = productJson.specifications || productJson.product_details || {};
  
  return {
    asin: product.asin || getValueFromAllSources(product, 'asin', 'ASIN'),
    title: product.title || getValueFromAllSources(product, 'title'),
    description: getValueFromAllSources(product, 'description', 'about', 'product description'),
    price: product.price || getValueFromAllSources(product, 'price', 'cost'),
    currency: product.currency || getValueFromAllSources(product, 'currency') || 'INR',
    country: getValueFromAllSources(product, 'country', 'country of origin', 'region produced in', 'origin'),
    language: getValueFromAllSources(product, 'language'),
    brand: getValueFromAllSources(product, 'brand', 'brand name'),
    manufacturer: getValueFromAllSources(product, 'manufacturer', 'mfr', 'made by'),
    packer: getValueFromAllSources(product, 'packer', 'packed by'),
    importer: getValueFromAllSources(product, 'importer', 'imported by'),
    weight: getValueFromAllSources(product, 'weight', 'item weight', 'net quantity', 'net weight', 'product weight'),
    dimensions: getValueFromAllSources(product, 'dimensions', 'product dimensions', 'item dimensions', 'size dimensions'),
    category: getValueFromAllSources(product, 'category', 'detected_category', 'generic name', 'department', 'product category'),
    availability: getValueFromAllSources(product, 'availability', 'in stock', 'stock status'),
    modelNumber: getValueFromAllSources(product, 'model number', 'item model number', 'model', 'sku'),
    ingredients: getValueFromAllSources(product, 'ingredients', 'ingredient list'),
    nutritionInfo: getValueFromAllSources(product, 'nutrition info', 'nutrition facts', 'nutritional information'),
    allergenInfo: getValueFromAllSources(product, 'allergen information', 'allergens', 'allergy info'),
    dietType: getValueFromAllSources(product, 'diet type', 'dietary', 'ingredient type', 'suitable for'),
    storageInstructions: getValueFromAllSources(product, 'storage', 'storage instructions', 'how to store'),
    material: getValueFromAllSources(product, 'material', 'fabric', 'material composition', 'material type'),
    careInstructions: getValueFromAllSources(product, 'care instructions', 'washing instructions', 'care'),
    fitType: getValueFromAllSources(product, 'fit type', 'fit', 'style'),
    dateFirstAvailable: getValueFromAllSources(product, 'date first available', 'first available', 'launch date'),
    bestBefore: getValueFromAllSources(product, 'best before', 'expiry', 'expiry date', 'exp date'),
    packageInfo: getValueFromAllSources(product, 'package information', 'packaging', 'package type'),
    packageWeight: getValueFromAllSources(product, 'package weight'),
    packageQuantity: getValueFromAllSources(product, 'item package quantity', 'quantity', 'pack of'),
    rating: getValueFromAllSources(product, 'rating', 'customer reviews', 'review rating', 'stars'),
    reviewsCount: getValueFromAllSources(product, 'reviews count', 'review count', 'number of reviews'),
    bestSellersRank: getValueFromAllSources(product, 'best sellers rank', 'rank', 'ranking'),
    specialty: getValueFromAllSources(product, 'specialty', 'speciality', 'special features'),
    features: productJson.feature_bullets || [],
    specifications: specifications,
  };
};

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}

function ProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const userRole = searchParams.get('role');
  const productId = searchParams.get('productId');
  
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterGrade, setFilterGrade] = useState('all');
  const itemsPerPage = 10;

  useEffect(() => {
    if (userId) {
      fetchProducts();
    }
  }, [userId]);

  useEffect(() => {
    if (productId) {
      fetchProductDetails(productId);
    }
  }, [productId]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductDetails = async (id) => {
    setDetailsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/product/${id}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch product details: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Products Detailed Data →\n", JSON.stringify(data, null, 2));

      setSelectedProduct(data.product);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching product details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleViewDetails = (id) => {
    router.push(`/products?userId=${userId}&role=${userRole}&productId=${id}`);
    fetchProductDetails(id);
  };

  const closeDetailsModal = () => {
    router.push(`/products?userId=${userId}&role=${userRole}`);
    setSelectedProduct(null);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.asin?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGrade =
      filterGrade === 'all' ||
      product.remarks?.includes(`Grade: ${filterGrade}`);
    
    return matchesSearch && matchesGrade;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const getGradeColor = (grade) => {
    // Phase 12: 'N/A' (indeterminate analysis) renders gray, not green —
    // 'N/A'.includes('A') was true, so it previously showed as A-grade green.
    if (grade === 'N/A' || grade === 'NA' || grade === 'PENDING' || !grade) return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    if (grade.includes('A+') || grade.includes('A')) return 'text-green-400 border-green-500/50 bg-green-500/20';
    if (grade.includes('B')) return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/20';
    return 'text-red-400 border-red-500/50 bg-red-500/20';
  };

  const getComplianceColor = (rating) => {
    const score = parseFloat(rating);
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#f59e0b';
    return '#ef4444';
  };

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
            <p className="text-gray-300 uppercase tracking-wider text-sm">Loading Products...</p>
          </div>
        </div>
      </>
    );
  }

  if (error && !selectedProduct) {
    return (
      <>
        <Navbar />
        <div className={`min-h-screen bg-black flex items-center justify-center ml-20 lg:ml-64 ${poppins.className}`}>
          <div className="text-center bg-red-950/50 border border-red-500/50 rounded-2xl p-8 max-w-md">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold mb-2 uppercase tracking-wider">Error Loading Products</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={fetchProducts}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all font-semibold uppercase tracking-wider"
            >
              Retry
            </button>
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
          <div className="mb-8 mt-4">
            <div className="w-full">
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 tracking-tight" style={{ fontFamily: 'sans-serif' }}>
                  Product Management
                </span>
              </h1>
              <div className="border-t-2 border-purple-400/50">
                <p className="mt-2 text-xs uppercase tracking-wider text-gray-400">
                  Total Products: {products.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm p-4 sm:p-6 mb-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="SEARCH BY TITLE OR ASIN..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none transition-all uppercase tracking-wider text-sm"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="text-purple-400 w-5 h-5" />
                <select
                  value={filterGrade}
                  onChange={(e) => {
                    setFilterGrade(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-black/40 border border-purple-500/30 rounded-lg text-white focus:border-purple-400 focus:outline-none transition-all uppercase tracking-wider text-sm"
                >
                  <option value="all">ALL GRADES</option>
                  <option value="A+">GRADE A+</option>
                  <option value="A">GRADE A</option>
                  <option value="B">GRADE B</option>
                  <option value="C">GRADE C</option>
                  <option value="F">GRADE F</option>
                </select>
              </div>
            </div>
          </div>

          {paginatedProducts.length === 0 ? (
            <div className="text-center py-20 bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
              <Package className="w-20 h-20 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-xl uppercase tracking-wider">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {paginatedProducts.map((product) => (
                <div
                  key={product.product_id}
                  className="bg-gradient-to-br from-purple-900/30 to-purple-950/30 border border-purple-500/30 rounded-2xl p-6 hover:border-purple-400/50 transition-all duration-300 shadow-lg hover:shadow-purple-500/20 backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-purple-400" />
                      <span className="text-xs uppercase tracking-wider text-purple-400 font-semibold">
                        {product.asin}
                      </span>
                    </div>
                    <div className={`px-3 py-1 rounded-lg font-bold text-sm border ${getGradeColor(product.remarks)}`}>
                      {product.remarks?.match(/Grade: ([A-Z+]+)/)?.[1] || 'N/A'}
                    </div>
                  </div>

                  <h3 className="text-white font-semibold mb-4 line-clamp-2 min-h-[3rem] leading-tight">
                    {product.title}
                  </h3>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-black/40 border border-purple-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-gray-400 uppercase tracking-wider">Price</span>
                      </div>
                      <p className="text-sm font-bold text-green-400">
                        {product.currency || 'INR'} {product.price || 'N/A'}
                      </p>
                    </div>

                    <div className="bg-black/40 border border-purple-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs text-gray-400 uppercase tracking-wider">Score</span>
                      </div>
                      <p className="text-sm font-bold text-cyan-400">
                        {parseFloat(product.rating).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Compliance</span>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: getComplianceColor(product.rating) }}>
                        {parseFloat(product.rating).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${parseFloat(product.rating)}%`,
                          backgroundColor: getComplianceColor(product.rating),
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4 text-xs">
                    <span className="text-gray-400 uppercase tracking-wider">
                      {product.remarks?.match(/Violations: (\d+)/)?.[1] || '0'} Violations
                    </span>
                    <span className="text-gray-400 uppercase tracking-wider">
                      {new Date(product.last_analysed).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleViewDetails(product.product_id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all font-semibold uppercase tracking-wider text-xs"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-all flex items-center justify-center"
                      aria-label="View product on Amazon"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 sm:px-4 py-2 bg-purple-700 rounded-lg text-white disabled:opacity-50 hover:bg-purple-600 transition uppercase tracking-wider text-xs font-bold border border-purple-500/50"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 inline-block" />
              </button>
              
              <span className="inline-flex items-center text-xs text-gray-300 font-bold tracking-wider uppercase">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 sm:px-4 py-2 bg-purple-700 rounded-lg text-white disabled:opacity-50 hover:bg-purple-600 transition uppercase tracking-wider text-xs font-bold border border-purple-500/50"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 inline-block" />
              </button>
            </div>
          )}
        </div>

        {selectedProduct && (
          <ProductDetailsModal
            product={selectedProduct}
            onClose={closeDetailsModal}
            loading={detailsLoading}
          />
        )}
      </div>
    </>
  );
}

// ==================== PRODUCT DETAILS MODAL WITH IMPORTER & MANUFACTURER COMPLIANCE ====================
const ProductDetailsModal = ({ product, onClose, loading }) => {
  // ✅ State for both importer and manufacturer location checks
  const [importerLocationCheck, setImporterLocationCheck] = useState(null);
  const [manufacturerLocationCheck, setManufacturerLocationCheck] = useState(null);
  const [checkingImporter, setCheckingImporter] = useState(false);
  const [checkingManufacturer, setCheckingManufacturer] = useState(false);

  // Memoize expensive computations
  const details = useMemo(() => extractAllProductDetails(product), [product]);
  
  const parsedSellerInfo = useMemo(() => safeJsonParse(product?.seller_information), [product?.seller_information]);
  const parsedAnalysis = useMemo(() => safeJsonParse(product?.analysis_results), [product?.analysis_results]);

  const complianceReport = useMemo(() => 
    product?.compliance_report ||
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
    }), [product?.compliance_report, parsedAnalysis]);

  const violations = useMemo(() => complianceReport?.violations || [], [complianceReport]);
  
  const ocrAnalysis = useMemo(() =>
    product?.ocr_analysis ||
    (parsedAnalysis && parsedAnalysis.ocr_analysis) ||
    {}, [product?.ocr_analysis, parsedAnalysis]);

  const complianceScore = useMemo(() => complianceReport?.compliance_score || 0, [complianceReport]);
  
  const complianceColor = useMemo(() =>
    complianceScore >= 85
      ? '#10b981'
      : complianceScore >= 70
      ? '#f59e0b'
      : '#ef4444', [complianceScore]);

  // ✅ Check both importer and manufacturer locations
  useEffect(() => {
    const checkCompliance = async () => {
      const importerAddress = details.importer;
      const manufacturerAddress = details.manufacturer;
      const countryOfOrigin = details.country;
      
      // Check Importer Location
      if (importerAddress && countryOfOrigin) {
        setCheckingImporter(true);
        const locationResult = await checkAddressLocation(importerAddress);
        setImporterLocationCheck(locationResult);
        setCheckingImporter(false);
      }

      // Check Manufacturer Location
      if (manufacturerAddress && countryOfOrigin) {
        setCheckingManufacturer(true);
        const locationResult = await checkAddressLocation(manufacturerAddress);
        setManufacturerLocationCheck(locationResult);
        setCheckingManufacturer(false);
      }
    };

    if (product) {
      checkCompliance();
    }
  }, [product, details.importer, details.manufacturer, details.country]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60]">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 border-r-cyan-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const productJson = product.product_json || {};
  if (parsedSellerInfo) {
    productJson.seller_information = parsedSellerInfo;
  }

  const specifications = details.specifications;
  const sellerInfo = productJson.seller_information;
  const insights = sellerInfo?.ai_insights;

  // ✅ Check importer violation
  const hasImporter = details.importer && details.importer.trim() !== '';
  const countryOfOrigin = details.country;
  const isCountryIndia = countryOfOrigin && (
    countryOfOrigin.toLowerCase() === 'india' || 
    countryOfOrigin.toLowerCase() === 'in'
  );
  
  const showImportCompliance = hasImporter && isCountryIndia && importerLocationCheck;
  const isImportViolation = showImportCompliance && !importerLocationCheck.isInIndia;

  // ✅ Check manufacturer violation
  const hasManufacturer = details.manufacturer && details.manufacturer.trim() !== '';
  const showManufacturerCompliance = hasManufacturer && isCountryIndia && manufacturerLocationCheck;
  const isManufacturerViolation = showManufacturerCompliance && !manufacturerLocationCheck.isInIndia;

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] px-0 animate-fadeIn"
      onClick={onClose}
    >
      {/* Separated scroll container with performance optimizations */}
      <div
        className={`bg-gradient-to-br from-purple-950/90 via-black to-cyan-950/90 
        rounded-none border-2 border-purple-500/40 
        w-full h-full text-white 
        shadow-[0_0_100px_rgba(168,85,247,0.3)] 
        ${poppins.className} animate-slideUp flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable content wrapper */}
        <div className="overflow-y-auto custom-scrollbar-optimized flex-1 p-6 sm:p-10">

          {/* Header */}
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
                    {details.asin}
                  </h2>
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
                        strokeDasharray={`${(complianceScore / 100) * 251.2} 251.2`}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: complianceColor }}>
                        {complianceScore}
                      </span>
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Score</span>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white hover:bg-red-600/20 p-3 rounded-xl transition-all duration-300 border border-transparent hover:border-red-500/50 group"
                  >
                    <X className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ IMPORTER COMPLIANCE CARD */}
          {showImportCompliance && (
            <div className="mb-6">
              <div
                className={`border-2 rounded-2xl p-6 ${
                  isImportViolation
                    ? 'bg-gradient-to-br from-red-950/50 to-red-900/30 border-red-500/50'
                    : 'bg-gradient-to-br from-green-950/50 to-green-900/30 border-green-500/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${isImportViolation ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                    {isImportViolation ? (
                      <XCircle className="w-8 h-8 text-red-400" />
                    ) : (
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-bold uppercase tracking-wider mb-2 ${isImportViolation ? 'text-red-300' : 'text-green-300'}`}>
                      {isImportViolation ? '⚠️ IMPORTER COMPLIANCE VIOLATION' : '✓ IMPORTER COMPLIANCE CHECK PASSED'}
                    </h3>
                    <p className="text-sm text-gray-300 mb-4">
                      {isImportViolation
                        ? 'This product is marked as non-compliant. The declared country of origin is India, but the importer\'s address is located outside India.'
                        : 'This product passes the importer compliance check. The importer address is within India as expected for products with Indian origin.'}
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/30 rounded-xl p-4 border border-white/10">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Country of Origin</p>
                        <p className={`text-sm font-bold ${isImportViolation ? 'text-red-300' : 'text-green-300'}`}>
                          {countryOfOrigin}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Importer Location</p>
                        <p className={`text-sm font-bold ${isImportViolation ? 'text-red-300' : 'text-green-300'}`}>
                          {importerLocationCheck.country} ({importerLocationCheck.countryCode})
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Importer Address</p>
                        <p className="text-sm text-white">{details.importer}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Verified Address</p>
                        <p className="text-sm text-white">{importerLocationCheck.formattedAddress}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ✅ MANUFACTURER COMPLIANCE CARD */}
          {showManufacturerCompliance && (
            <div className="mb-6">
              <div
                className={`border-2 rounded-2xl p-6 ${
                  isManufacturerViolation
                    ? 'bg-gradient-to-br from-orange-950/50 to-orange-900/30 border-orange-500/50'
                    : 'bg-gradient-to-br from-blue-950/50 to-blue-900/30 border-blue-500/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${isManufacturerViolation ? 'bg-orange-500/20' : 'bg-blue-500/20'}`}>
                    {isManufacturerViolation ? (
                      <XCircle className="w-8 h-8 text-orange-400" />
                    ) : (
                      <CheckCircle2 className="w-8 h-8 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-bold uppercase tracking-wider mb-2 ${isManufacturerViolation ? 'text-orange-300' : 'text-blue-300'}`}>
                      {isManufacturerViolation ? '⚠️ MANUFACTURER COMPLIANCE VIOLATION' : '✓ MANUFACTURER COMPLIANCE CHECK PASSED'}
                    </h3>
                    <p className="text-sm text-gray-300 mb-4">
                      {isManufacturerViolation
                        ? 'This product is marked as non-compliant. The declared country of origin is India, but the manufacturer\'s address is located outside India.'
                        : 'This product passes the manufacturer compliance check. The manufacturer address is within India as expected for products with Indian origin.'}
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/30 rounded-xl p-4 border border-white/10">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Country of Origin</p>
                        <p className={`text-sm font-bold ${isManufacturerViolation ? 'text-orange-300' : 'text-blue-300'}`}>
                          {countryOfOrigin}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Manufacturer Location</p>
                        <p className={`text-sm font-bold ${isManufacturerViolation ? 'text-orange-300' : 'text-blue-300'}`}>
                          {manufacturerLocationCheck.country} ({manufacturerLocationCheck.countryCode})
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Manufacturer Address</p>
                        <p className="text-sm text-white">{details.manufacturer}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Verified Address</p>
                        <p className="text-sm text-white">{manufacturerLocationCheck.formattedAddress}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ✅ Loading states */}
          {checkingImporter && hasImporter && isCountryIndia && (
            <div className="mb-6 bg-gradient-to-br from-purple-950/50 to-purple-900/30 border-2 border-purple-500/50 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <p className="text-purple-300 font-semibold">Verifying importer location using OpenStreetMap...</p>
              </div>
            </div>
          )}

          {checkingManufacturer && hasManufacturer && isCountryIndia && (
            <div className="mb-6 bg-gradient-to-br from-cyan-950/50 to-cyan-900/30 border-2 border-cyan-500/50 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                <p className="text-cyan-300 font-semibold">Verifying manufacturer location using OpenStreetMap...</p>
              </div>
            </div>
          )}

          
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="xl:col-span-2 space-y-6">
            {/* Product Info */}
            <div className="bg-gradient-to-br from-purple-900/30 to-purple-950/30 border border-purple-500/30 rounded-2xl p-6 hover:border-purple-400/50 transition-all duration-300 shadow-lg hover:shadow-purple-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-600/20 p-2 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold uppercase tracking-wider text-purple-300">
                  Product Information
                </h3>
              </div>

              <h4 className="text-base sm:text-xl font-semibold mb-6 text-white leading-relaxed">
                {details.title}
              </h4>

              {details.description && (
                <div className="mb-6 bg-black/40 border border-purple-500/20 rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{details.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-black/40 border border-green-500/30 rounded-xl p-4 hover:border-green-400/50 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Price</span>
                  </div>
                  <p className="text-lg font-bold text-green-400">
                    {details.currency} {details.price || 'N/A'}
                  </p>
                </div>

                {details.brand && (
                  <div className="bg-black/40 border border-purple-500/30 rounded-xl p-4 hover:border-purple-400/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Package2 className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Brand</span>
                    </div>
                    <p className="text-sm font-bold text-purple-400 uppercase">{details.brand}</p>
                  </div>
                )}

                {details.rating && (
                  <div className="bg-black/40 border border-amber-500/30 rounded-xl p-4 hover:border-amber-400/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Rating</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-amber-400">
                        {typeof details.rating === 'string' ? details.rating.split(' ')[0] : details.rating}
                      </p>
                      <span className="text-xs text-gray-500">/ 5.0</span>
                    </div>
                  </div>
                )}

                {details.reviewsCount && (
                  <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-4 hover:border-cyan-400/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Reviews</span>
                    </div>
                    <p className="text-lg font-bold text-cyan-400">
                      {typeof details.reviewsCount === 'number' ? details.reviewsCount.toLocaleString() : details.reviewsCount}
                    </p>
                  </div>
                )}

                {details.country && (
                  <div className="bg-black/40 border border-blue-500/30 rounded-xl p-4 hover:border-blue-400/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Map className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Country</span>
                    </div>
                    <p className="text-sm font-bold text-blue-400 uppercase">{details.country}</p>
                  </div>
                )}

                {details.category && (
                  <div className="bg-black/40 border border-purple-500/30 rounded-xl p-4 hover:border-purple-400/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Category</span>
                    </div>
                    <p className="text-sm font-bold text-purple-400 uppercase">{details.category}</p>
                  </div>
                )}

                <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-4 hover:border-cyan-400/50 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Compliance</span>
                  </div>
                  <p className="text-lg font-bold text-cyan-400">{product.rating}%</p>
                </div>

                {details.weight && (
                  <div className="bg-black/40 border border-orange-500/30 rounded-xl p-4 hover:border-orange-400/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Weight className="w-4 h-4 text-orange-400" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Weight</span>
                    </div>
                    <p className="text-sm font-bold text-orange-400">{details.weight}</p>
                  </div>
                )}

                {details.dimensions && (
                  <div className="bg-black/40 border border-pink-500/30 rounded-xl p-4 hover:border-pink-400/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Ruler className="w-4 h-4 text-pink-400" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Dimensions</span>
                    </div>
                    <p className="text-xs font-bold text-pink-400">{details.dimensions}</p>
                  </div>
                )}

                {details.availability && (
                  <div className="bg-black/40 border border-green-500/30 rounded-xl p-4 hover:border-green-400/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Availability</span>
                    </div>
                    <p className="text-sm font-bold text-green-400">{details.availability}</p>
                  </div>
                )}

                {details.modelNumber && (
                  <div className="bg-black/40 border border-indigo-500/30 rounded-xl p-4 hover:border-indigo-400/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Model</span>
                    </div>
                    <p className="text-xs font-bold text-indigo-400">{details.modelNumber}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Details */}
            {(details.manufacturer || details.packer || details.importer || details.dietType || details.packageInfo || details.allergenInfo || details.storageInstructions || details.ingredients || details.nutritionInfo || details.material || details.careInstructions || details.fitType || details.dateFirstAvailable || details.bestBefore || details.specialty || details.packageWeight || details.packageQuantity || details.bestSellersRank) && (
              <div className="bg-gradient-to-br from-indigo-900/20 to-indigo-950/20 border border-indigo-500/30 rounded-2xl p-6 hover:border-indigo-400/50 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-600/20 p-2 rounded-lg">
                    <FileText className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h4 className="text-lg font-bold uppercase tracking-wider text-indigo-300">
                    Complete Product Details
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {details.manufacturer && (
                    <div className="bg-black/40 border border-indigo-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Manufacturer</p>
                      <p className="text-sm text-white">{details.manufacturer}</p>
                    </div>
                  )}

                  {details.packer && (
                    <div className="bg-black/40 border border-indigo-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Packer</p>
                      <p className="text-sm text-white">{details.packer}</p>
                    </div>
                  )}

                  {details.importer && (
                    <div className="bg-black/40 border border-indigo-500/20 rounded-xl p-4 sm:col-span-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Importer</p>
                      <p className="text-sm text-white">{details.importer}</p>
                    </div>
                  )}

                  {details.dietType && (
                    <div className="bg-black/40 border border-green-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Diet Type</p>
                      <p className="text-sm text-green-300 font-semibold uppercase">{details.dietType}</p>
                    </div>
                  )}

                  {details.packageInfo && (
                    <div className="bg-black/40 border border-indigo-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Package</p>
                      <p className="text-sm text-white">{details.packageInfo}</p>
                    </div>
                  )}

                  {details.packageWeight && (
                    <div className="bg-black/40 border border-orange-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Package Weight</p>
                      <p className="text-sm text-orange-300">{details.packageWeight}</p>
                    </div>
                  )}

                  {details.packageQuantity && (
                    <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Package Quantity</p>
                      <p className="text-sm text-purple-300">{details.packageQuantity}</p>
                    </div>
                  )}

                  {details.material && (
                    <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Material</p>
                      <p className="text-sm text-cyan-300">{details.material}</p>
                    </div>
                  )}

                  {details.fitType && (
                    <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Fit Type</p>
                      <p className="text-sm text-purple-300">{details.fitType}</p>
                    </div>
                  )}

                  {details.careInstructions && (
                    <div className="bg-black/40 border border-blue-500/20 rounded-xl p-4 sm:col-span-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Care Instructions</p>
                      <p className="text-sm text-blue-300">{details.careInstructions}</p>
                    </div>
                  )}

                  {details.dateFirstAvailable && (
                    <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">First Available</p>
                      <p className="text-sm text-cyan-300">{details.dateFirstAvailable}</p>
                    </div>
                  )}

                  {details.bestBefore && (
                    <div className="bg-black/40 border border-amber-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Best Before / Expiry</p>
                      <p className="text-sm text-amber-300">{details.bestBefore}</p>
                    </div>
                  )}

                  {details.specialty && (
                    <div className="bg-black/40 border border-pink-500/20 rounded-xl p-4 sm:col-span-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Specialty</p>
                      <p className="text-sm text-pink-300">{details.specialty}</p>
                    </div>
                  )}

                  {details.bestSellersRank && (
                    <div className="bg-black/40 border border-yellow-500/20 rounded-xl p-4 sm:col-span-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Best Sellers Rank</p>
                      <p className="text-sm text-yellow-300">{details.bestSellersRank}</p>
                    </div>
                  )}

                  {details.allergenInfo && (
                    <div className="bg-black/40 border border-red-500/20 rounded-xl p-4 sm:col-span-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Allergen Information</p>
                      <p className="text-sm text-red-300">{details.allergenInfo}</p>
                    </div>
                  )}

                  {details.ingredients && (
                    <div className="bg-black/40 border border-green-500/20 rounded-xl p-4 sm:col-span-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Ingredients</p>
                      <p className="text-sm text-green-300">{details.ingredients}</p>
                    </div>
                  )}

                  {details.nutritionInfo && (
                    <div className="bg-black/40 border border-lime-500/20 rounded-xl p-4 sm:col-span-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Nutrition Information</p>
                      <p className="text-sm text-lime-300">{details.nutritionInfo}</p>
                    </div>
                  )}

                  {details.storageInstructions && (
                    <div className="bg-black/40 border border-indigo-500/20 rounded-xl p-4 sm:col-span-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Storage Instructions</p>
                      <p className="text-sm text-white">{details.storageInstructions}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Images Gallery - Same as your UI */}
            {product.images && product.images.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900/60 to-slate-950/80 border border-purple-500/30 rounded-2xl p-6 hover:border-purple-400/60 transition-all duration-300 shadow-lg hover:shadow-purple-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-600/20 p-2 rounded-lg border border-purple-500/50">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5 text-purple-300"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-3.5-3.5L13 16l-2-2-4 4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold uppercase tracking-wider text-purple-200">
                        Product Images
                      </h4>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">
                        {product.images.length} image{product.images.length > 1 ? 's' : ''} available
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                    {product.images.map((img, idx) => (
                      <div
                        key={img.image_id ?? idx}
                        className="flex-shrink-0 w-40 sm:w-52 md:w-60 group"
                      >
                        <div className="relative aspect-[4/5] rounded-xl overflow-hidden border border-purple-500/30 bg-black/60 shadow-lg">
                          <img
                            src={img.url}
                            alt={`Product image ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            onError={(e) => {
                              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23444" width="200" height="200"/%3E%3Ctext fill="%23999" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="absolute top-2 right-2 bg-black/70 border border-purple-500/60 rounded-full px-2 py-0.5">
                            <span className="text-[10px] font-semibold text-purple-200 uppercase tracking-wider">
                              #{idx + 1}
                            </span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between text-[10px] sm:text-xs">
                            <div className="flex flex-col">
                              <span className="text-gray-300 font-medium truncate uppercase tracking-wider">
                                ID: {img.image_id}
                              </span>
                              <span className="text-gray-400 text-[10px] truncate uppercase tracking-wider">
                                {new Date(img.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <a
                              href={img.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-cyan-300 hover:text-cyan-200 font-semibold bg-black/60 px-2 py-1 rounded-full border border-cyan-500/50 hover:border-cyan-400/70 transition-colors uppercase tracking-wider"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-slate-950 to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-slate-950 to-transparent" />
                </div>
              </div>
            )}

            {/* Compliance Report - Same as your UI */}
            {complianceReport && (
              <div className="bg-gradient-to-br from-green-900/20 to-green-950/20 border border-green-500/30 rounded-2xl p-6 hover:border-green-400/50 transition-all duration-300 shadow-lg hover:shadow-green-500/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-600/20 p-2 rounded-lg border border-green-500/50">
                      <Shield className="w-6 h-6 text-green-400" />
                    </div>
                    <h4 className="text-lg font-bold uppercase tracking-wider text-green-300">
                      Compliance Report
                    </h4>
                  </div>

                  <div
                    className={`px-4 py-2 rounded-xl font-bold text-lg border-2 uppercase tracking-wider ${
                      complianceReport.compliance_grade === 'A' ||
                      complianceReport.compliance_grade === 'A+'
                        ? 'bg-green-500/20 text-green-400 border-green-500/50'
                        : complianceReport.compliance_grade === 'B'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                        : 'bg-red-500/20 text-red-400 border-red-500/50'
                    }`}
                  >
                    Grade {complianceReport.compliance_grade}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-cyan-600/10 border border-cyan-500/30 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-cyan-400 mb-1">
                      {complianceReport.compliance_score}
                    </p>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Score</p>
                  </div>

                  <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-red-400 mb-1">
                      {complianceReport.violation_summary?.total || 0}
                    </p>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Violations</p>
                  </div>

                  <div
                    className={`${
                      complianceReport.is_compliant
                        ? 'bg-green-600/10 border-green-500/30'
                        : 'bg-red-600/10 border-red-500/30'
                    } border rounded-xl p-4 text-center`}
                  >
                    <div className="flex justify-center mb-1">
                      {complianceReport.is_compliant ? (
                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                      ) : (
                        <XCircle className="w-8 h-8 text-red-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">
                      {complianceReport.is_compliant ? 'Compliant' : 'Non-Compliant'}
                    </p>
                  </div>

                  <div className="bg-purple-600/10 border border-purple-500/30 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-purple-400 mb-1">
                      {product.image_count || 0}
                    </p>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Images</p>
                  </div>
                </div>

                {complianceReport.violation_summary && (
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-gradient-to-br from-red-600/20 to-red-900/20 border-2 border-red-500/40 rounded-xl p-4 hover:border-red-400/60 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <span className="text-2xl font-bold text-red-400">
                          {complianceReport.violation_summary.critical}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-red-300 uppercase tracking-wider">Critical</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-600/20 to-orange-900/20 border-2 border-orange-500/40 rounded-xl p-4 hover:border-orange-400/60 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <Zap className="w-5 h-5 text-orange-400" />
                        <span className="text-2xl font-bold text-orange-400">
                          {complianceReport.violation_summary.major}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-orange-300 uppercase tracking-wider">Major</p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-900/20 border-2 border-yellow-500/40 rounded-xl p-4 hover:border-yellow-400/60 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <AlertCircle className="w-5 h-5 text-yellow-400" />
                        <span className="text-2xl font-bold text-yellow-400">
                          {complianceReport.violation_summary.minor}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-yellow-300 uppercase tracking-wider">Minor</p>
                    </div>
                  </div>
                )}

                {violations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-5 h-5 text-purple-400" />
                      <h5 className="text-sm font-bold text-purple-400 uppercase tracking-wider">
                        Violation Breakdown
                      </h5>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                      {violations.map((violation, idx) => (
                        <div
                          key={idx}
                          className="bg-black/60 border-l-4 rounded-r-xl p-4 hover:bg-black/80 transition-all duration-300 group"
                          style={{
                            borderLeftColor:
                              violation.severity === 'critical'
                                ? '#ef4444'
                                : violation.severity === 'major'
                                ? '#f59e0b'
                                : '#facc15',
                          }}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-start gap-3 flex-1">
                              <div
                                className={`p-2 rounded-lg ${
                                  violation.severity === 'critical'
                                    ? 'bg-red-500/20'
                                    : violation.severity === 'major'
                                    ? 'bg-orange-500/20'
                                    : 'bg-yellow-500/20'
                                }`}
                              >
                                <AlertCircle
                                  className={`w-4 h-4 ${
                                    violation.severity === 'critical'
                                      ? 'text-red-400'
                                      : violation.severity === 'major'
                                      ? 'text-orange-400'
                                      : 'text-yellow-400'
                                  }`}
                                />
                              </div>
                              <div className="flex-1">
                                <h6 className="text-sm font-bold text-white mb-1 group-hover:text-purple-300 transition-colors uppercase tracking-wider">
                                  {violation.requirement}
                                </h6>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                  {violation.description}
                                </p>
                              </div>
                            </div>
                            
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider ${
                                violation.severity === 'critical'
                                  ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                                  : violation.severity === 'major'
                                  ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50'
                                  : 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                              }`}
                            >
                              {violation.severity}
                            </span>
                            <span
                              className={`text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider ${
                                violation.type === 'missing'
                                  ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                                  : 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                              }`}
                            >
                              {violation.type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {complianceReport.recommendations &&
                  complianceReport.recommendations.length > 0 && (
                    <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-5 h-5 text-blue-400" />
                        <h5 className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                          Recommendations
                        </h5>
                      </div>
                      <ul className="space-y-2">
                        {complianceReport.recommendations.map((rec, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-gray-300 flex items-start gap-2 leading-relaxed"
                          >
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {/* Feature Bullets */}
            {details.features && details.features.length > 0 && (
              <div className="bg-gradient-to-br from-indigo-900/20 to-indigo-950/20 border border-indigo-500/30 rounded-2xl p-6 hover:border-indigo-400/50 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-600/20 p-2 rounded-lg">
                    <Star className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h4 className="text-lg font-bold uppercase tracking-wider text-indigo-300">
                    Key Features
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {details.features.map((bullet, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 bg-black/40 border border-indigo-500/20 rounded-lg p-3 hover:border-indigo-400/40 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {bullet.value || bullet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>

          {/* Right Column */}
          <div className="xl:col-span-1 space-y-6">
            {/* OCR Analysis */}
            {/* OCR Analysis - Enhanced with Compliance Findings Comparison */}
{ocrAnalysis?.success && (
  <div className="bg-gradient-to-br from-cyan-900/20 to-cyan-950/20 border border-cyan-500/30 rounded-2xl p-6 hover:border-cyan-400/50 transition-all duration-300 shadow-lg hover:shadow-cyan-500/20">
    <div className="flex items-center gap-3 mb-5">
      <div className="bg-cyan-600/20 p-2 rounded-lg border border-cyan-500/50">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <h4 className="text-lg font-bold uppercase tracking-wider text-cyan-300">
        OCR Analysis
      </h4>
    </div>

    <div className="space-y-4">
      {/* Image Quality */}
      {ocrAnalysis.image_quality && (
        <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Image Quality</p>
          <p className="text-sm text-white font-semibold">{ocrAnalysis.image_quality}</p>
        </div>
      )}

      {/* Confidence Level */}
      <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Confidence Level</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-700/50 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-cyan-500 to-green-500 h-full rounded-full transition-all duration-1000"
              style={{
                width: `${((ocrAnalysis.confidence || 0) * 100).toFixed(1)}%`,
                boxShadow: '0 0 10px rgba(6, 182, 212, 0.6)'
              }}
            />
          </div>
          <span className="text-lg font-bold text-green-400">
            {((ocrAnalysis.confidence || 0) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Compliance Findings Comparison - CORRECTED VERSION */}
      {complianceReport && complianceReport.log && (
        <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-cyan-400" />
            <p className="text-sm font-bold text-cyan-300 uppercase tracking-wider">
              Compliance Findings Comparison
            </p>
          </div>

          {(() => {
            const logArray = complianceReport.log;
            const findings = [];
            
            // The log is an array, we need to find entries that start with "[SCORING DEBUG]"
            let currentFinding = null;
            
            for (let i = 0; i < logArray.length; i++) {
              const entry = logArray[i];
              
              // Check if this is a SCORING DEBUG entry for a requirement
              if (typeof entry === 'string' && entry.includes('[SCORING DEBUG]') && entry.includes(':')) {
                // Extract requirement name
                const match = entry.match(/\[SCORING DEBUG\] (HIGH|LOW): ([^:]+):/);
                if (match) {
                  currentFinding = {
                    priority: match[1],
                    name: match[2].trim(),
                    ocrStatus: null,
                    ocrValue: null,
                    dataStatus: null,
                    dataAdequacy: null,
                    dataValue: null,
                    present: null
                  };
                  findings.push(currentFinding);
                }
              }
              // Check for OCR data in next entries
              else if (currentFinding && typeof entry === 'string' && entry.includes('└─ OCR:')) {
                const ocrMatch = entry.match(/└─ OCR: (\w+) = '([^']*)'/);
                if (ocrMatch) {
                  currentFinding.ocrStatus = ocrMatch[1];
                  currentFinding.ocrValue = ocrMatch[2];
                }
              }
              // Check for Data in next entries
              else if (currentFinding && typeof entry === 'string' && entry.includes('└─ Data:')) {
                const dataMatch = entry.match(/└─ Data: (\w+)\/(\w+) = '([^']*)'/);
                if (dataMatch) {
                  currentFinding.dataStatus = dataMatch[1];
                  currentFinding.dataAdequacy = dataMatch[2];
                  currentFinding.dataValue = dataMatch[3];
                }
              }
              // Check for Present status
              else if (currentFinding && typeof entry === 'string' && entry.includes('└─ Present:')) {
                const presentMatch = entry.match(/└─ Present: (\w+)/);
                if (presentMatch) {
                  currentFinding.present = presentMatch[1];
                }
              }
            }

            return findings.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {findings.map((finding, idx) => (
                  <div 
                    key={idx} 
                    className={`border-l-4 rounded-r-xl p-3 transition-all ${
                      finding.priority === 'HIGH' 
                        ? 'bg-purple-900/20 border-purple-500' 
                        : 'bg-blue-900/20 border-blue-500'
                    }`}
                  >
                    {/* Requirement Name & Priority */}
                    <div className="flex items-center justify-between mb-3">
                      <h6 className="text-sm font-bold text-white uppercase tracking-wider">
                        {finding.name}
                      </h6>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold uppercase ${
                        finding.priority === 'HIGH' 
                          ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50' 
                          : 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                      }`}>
                        {finding.priority}
                      </span>
                    </div>

                    {/* OCR vs Data Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* OCR Finding */}
                      <div className="bg-black/60 rounded-lg p-3 border border-cyan-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">OCR Detection</p>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded uppercase font-semibold ${
                            finding.ocrStatus === 'present' 
                              ? 'bg-green-500/20 text-green-400' 
                              : finding.ocrStatus === 'partial' 
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {finding.ocrStatus || 'N/A'}
                          </span>
                        </div>
                        {finding.ocrValue && finding.ocrValue !== 'N/A' ? (
                          <p className="text-xs text-gray-300 mt-2 break-words font-mono bg-black/40 p-2 rounded line-clamp-3">
                            "{finding.ocrValue}"
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 italic mt-2">Not detected in images</p>
                        )}
                      </div>

                      {/* Scraped Data Finding */}
                      <div className="bg-black/60 rounded-lg p-3 border border-green-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-green-400" />
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Scraped Data</p>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded uppercase font-semibold ${
                            finding.dataStatus === 'present' 
                              ? 'bg-green-500/20 text-green-400' 
                              : finding.dataStatus === 'partial' 
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {finding.dataStatus || 'N/A'}
                          </span>
                          {finding.dataAdequacy && (
                            <span className="text-xs text-gray-500">
                              ({finding.dataAdequacy})
                            </span>
                          )}
                        </div>
                        {finding.dataValue && finding.dataValue !== 'N/A' ? (
                          <p className="text-xs text-gray-300 mt-2 break-words font-mono bg-black/40 p-2 rounded line-clamp-3">
                            "{finding.dataValue}"
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 italic mt-2">Not found in product data</p>
                        )}
                      </div>
                    </div>

                    {/* Final Status */}
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 uppercase">Final Status:</span>
                        <div className="flex items-center gap-2">
                          {finding.present === 'True' ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                              <span className="text-xs font-semibold text-green-400 uppercase">Present</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-400" />
                              <span className="text-xs font-semibold text-red-400 uppercase">Missing</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No compliance findings available</p>
            );
          })()}
        </div>
      )}

      {/* Symbols Detected */}
      {ocrAnalysis.symbols_found && ocrAnalysis.symbols_found.length > 0 && (
        <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Symbols Detected</p>
          <div className="flex flex-wrap gap-2">
            {ocrAnalysis.symbols_found.map((symbol, idx) => (
              <span 
                key={idx}
                className="text-xs bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-300 px-3 py-1.5 rounded-lg border border-green-500/40 font-semibold hover:border-green-400/60 transition-all uppercase tracking-wider"
              >
                {symbol}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Text */}
      {ocrAnalysis.extracted_text && (
        <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Extracted Text</p>
          <div className="bg-black/60 rounded-lg p-3 max-h-40 overflow-auto custom-scrollbar">
            <pre className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
              {ocrAnalysis.extracted_text}
            </pre>
          </div>
        </div>
      )}
    </div>
  </div>
)}


            {/* Seller Information */}
            {sellerInfo && (
              <div className="bg-gradient-to-br from-purple-900/20 to-purple-950/20 border border-purple-500/30 rounded-2xl p-6 hover:border-purple-400/50 transition-all duration-300">
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-purple-600/20 p-2 rounded-lg border border-purple-500/50">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                  <h4 className="text-lg font-bold uppercase tracking-wider text-purple-300">
                    Seller Information
                  </h4>
                </div>

                <div className="space-y-3">
                  <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Seller Name</p>
                    <p className="text-sm text-white font-semibold">{sellerInfo.name}</p>
                  </div>

                  {sellerInfo.store_url && (
                    <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Store</p>
                      <a
                        href={sellerInfo.store_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-2 transition-colors uppercase tracking-wider"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Visit Store
                      </a>
                    </div>
                  )}

                  {insights && (
                    <>
                      <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Seller Type</p>
                        <p className="text-sm text-purple-300 font-semibold uppercase tracking-wider">
                          {insights.seller_type}
                        </p>
                      </div>

                      {insights.location && (
                        <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Location</p>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-purple-400" />
                            <p className="text-sm text-white font-semibold">{insights.location}</p>
                          </div>
                        </div>
                      )}

                      {insights.reputation && insights.reputation !== 'Not specified' && (
                        <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Reputation</p>
                          <p className="text-sm text-gray-300 leading-relaxed">{insights.reputation}</p>
                        </div>
                      )}

                      {insights.description && (
                        <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">About</p>
                          <p className="text-sm text-gray-300 leading-relaxed">{insights.description}</p>
                        </div>
                      )}

                      {insights.other_notes && (
                        <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Additional Info</p>
                          <p className="text-xs text-gray-400 leading-relaxed">{insights.other_notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Specifications */}
            {specifications && Object.keys(specifications).length > 0 && (
              <div className="bg-gradient-to-br from-pink-900/20 to-pink-950/20 border border-pink-500/30 rounded-2xl p-6 hover:border-pink-400/50 transition-all duration-300">
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-pink-600/20 p-2 rounded-lg border border-pink-500/50">
                    <FileText className="w-6 h-6 text-pink-400" />
                  </div>
                  <h4 className="text-lg font-bold uppercase tracking-wider text-pink-300">
                    All Specifications
                  </h4>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {Object.entries(specifications).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-black/40 border border-pink-500/20 rounded-lg p-3 hover:border-pink-400/40 transition-all"
                    >
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{key}</p>
                      <p className="text-sm text-white font-semibold break-words">
                        {value || 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            
          </div>
        </div>
        </div>
      </div>

      {/* Optimized CSS with GPU acceleration */}
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

        /* OPTIMIZED SCROLLBAR WITH GPU ACCELERATION */
        .custom-scrollbar-optimized {
          scrollbar-width: thin;
          scrollbar-color: rgba(168, 85, 247, 0.7) rgba(0, 0, 0, 0.3);
          will-change: transform;
          transform: translateZ(0);
          -webkit-overflow-scrolling: touch;
        }

        .custom-scrollbar-optimized::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .custom-scrollbar-optimized::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 999px;
        }

        .custom-scrollbar-optimized::-webkit-scrollbar-thumb {
          background: linear-gradient(
            180deg,
            rgba(168, 85, 247, 0.9) 0%,
            rgba(6, 182, 212, 0.9) 100%
          );
          border-radius: 999px;
          will-change: background;
        }

        .custom-scrollbar-optimized::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(
            180deg,
            rgba(192, 132, 252, 1) 0%,
            rgba(34, 211, 238, 1) 100%
          );
        }
      `}</style>
    </div>
  );
};
