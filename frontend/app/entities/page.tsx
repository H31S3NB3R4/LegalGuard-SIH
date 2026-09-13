'use client';

// Activity heatmap (entities) - reskinned per design.md (tododesign Phase 5).
// ALL existing functionality is preserved: user/global views, location/product
// display modes, geocoding via OSM Nominatim, search suggestions, state/city/
// compliance filters, pagination and the Leaflet map interactions. Only the
// page chrome (stat cards, filters, legend, lists) uses the token palette.

import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Loader2,
  AlertCircle,
  MapPin,
  Building2,
  Globe,
  Package,
  Search,
  X,
  MousePointer2,
  Activity,
  Calendar,
  ShoppingBag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { geocodeAddress } from '../../lib/geocoder';
import type { Map as LeafletMap } from 'leaflet';
import AppShell from '../../components/AppShell';
import { CardHeader, EmptyState } from '../../components/ui';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const ViolationHeatmap = dynamic(() => import('../../components/ViolationHeatmap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] text-secondary">
      <Loader2 className="w-8 h-8 animate-spin mr-3" />
      Loading map...
    </div>
  ),
});

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Bengaluru, Karnataka, India': { lat: 12.9716, lng: 77.5946 },
  'Bangalore, Karnataka, India': { lat: 12.9716, lng: 77.5946 },
  'Mumbai, Maharashtra, India': { lat: 19.076, lng: 72.8777 },
  'Delhi, Delhi, India': { lat: 28.7041, lng: 77.1025 },
  'New Delhi, Delhi, India': { lat: 28.6139, lng: 77.209 },
  'Hyderabad, Telangana, India': { lat: 17.385, lng: 78.4867 },
  'Chennai, Tamil Nadu, India': { lat: 13.0827, lng: 80.2707 },
  'Kolkata, West Bengal, India': { lat: 22.5726, lng: 88.3639 },
  'Pune, Maharashtra, India': { lat: 18.5204, lng: 73.8567 },
  'Ahmedabad, Gujarat, India': { lat: 23.0225, lng: 72.5714 },
  'Jaipur, Rajasthan, India': { lat: 26.9124, lng: 75.7873 },
  'Lucknow, Uttar Pradesh, India': { lat: 26.8467, lng: 80.9462 },
  'Gurgaon, Haryana, India': { lat: 28.4595, lng: 77.0266 },
  'Gurugram, Haryana, India': { lat: 28.4595, lng: 77.0266 },
  'Kyoto, Kyoto Prefecture, Japan': { lat: 35.0116, lng: 135.7681 },
  'Rajkot, Gujarat, India': { lat: 22.3039, lng: 70.8022 },
  'Bhodani, Maharashtra, India': { lat: 19.9975, lng: 73.7898 },
  'Meerut, Uttar Pradesh, India': { lat: 28.9845, lng: 77.7064 },
};

type Product = {
  title: string;
  rating: number | null;
  created_at: string;
  product_id: number;
  compliance_score: number | null;
};

type SellerPoint = {
  location: string;
  seller_name: string;
  total_scrapes: number;
  avg_compliance_score: number | string | null;
  last_activity: string;
  products: string; // JSON string
};

const extractCity = (location: string) => {
  const parts = location.split(',').map((p) => p.trim());
  return parts[0] || '';
};

const extractState = (location: string) => {
  const parts = location.split(',').map((p) => p.trim());
  return parts.length >= 2 ? parts[1] : '';
};

// Design.md section 1 scale by value: >=80 success, 40-79 warning, <40 critical.
const getScoreColor = (score: number | null) => {
  if (score === null || score === 0) return '#6b7280'; // muted / no data
  if (score < 40) return '#DC2626'; // critical
  if (score < 80) return '#D97706'; // warning
  return '#16A34A'; // success
};

const parseProducts = (productsStr: string): Product[] => {
  try {
    return JSON.parse(productsStr);
  } catch {
    return [];
  }
};

const addOffsetToCoords = (lat: number, lng: number, index: number, total: number) => {
  if (total === 1) return { lat, lng };
  const radius = 0.002;
  const angle = (2 * Math.PI * index) / total;
  return {
    lat: lat + radius * Math.cos(angle),
    lng: lng + radius * Math.sin(angle),
  };
};

export default function HeatmapPage() {
  return (
    <Suspense fallback={null}>
      <HeatmapPageContent />
    </Suspense>
  );
}

function HeatmapPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [userId, setUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [globalHeatmapData, setGlobalHeatmapData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'user' | 'global'>('user');
  const [displayMode, setDisplayMode] = useState<'location' | 'product'>('location');

  const [focusMarker, setFocusMarker] = useState<{ seller_name: string; location: string } | null>(null);
  const [geocodedLocations, setGeocodedLocations] = useState(CITY_COORDINATES);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [totalScrapes, setTotalScrapes] = useState(0);
  const [totalLocations, setTotalLocations] = useState(0);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [complianceFilter, setComplianceFilter] = useState<string>('all');
  const PAGE_SIZE = 10;

  const mapRef = useRef<LeafletMap | null>(null);
  const locationSearchRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        locationSearchRef.current &&
        !locationSearchRef.current.contains(event.target as Node)
      ) {
        setShowLocationSuggestions(false);
      }
      if (
        productSearchRef.current &&
        !productSearchRef.current.contains(event.target as Node)
      ) {
        setShowProductSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      }
    }
  }, [searchParams, router]);

  const geocodeLocation = async (location: string) => {
    if (CITY_COORDINATES[location]) {
      return CITY_COORDINATES[location];
    }
    if (geocodedLocations[location]) {
      return geocodedLocations[location];
    }

    // Geocoding is provider-isolated in frontend/lib/geocoder.js
    // (currently OSM Nominatim - no API key required).
    const result = await geocodeAddress(location);
    if (result) {
      const coords = { lat: result.lat, lng: result.lng };
      setGeocodedLocations((prev) => ({ ...prev, [location]: coords }));
      return coords;
    }
    return null;
  };

  const fetchUserHeatmap = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_BASE_URL + '/api/heatmap', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch heatmap data');
      }

      const data = await response.json();
      setHeatmapData(data.heatmap_data || []);
      setTotalScrapes(data.total_scrapes || 0);
      setTotalLocations(data.total_locations || 0);

      for (const item of data.heatmap_data || []) {
        if (item.location) {
          await geocodeLocation(item.location);
        }
      }
    } catch (err: any) {
      console.error('[HEATMAP ERROR]', err);
      setError(err.message || 'Failed to fetch heatmap data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalHeatmap = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_BASE_URL + '/api/global-heatmap', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch global heatmap data');
      }

      const data = await response.json();
      setGlobalHeatmapData(data.global_heatmap_data || []);
      setTotalScrapes(data.total_scrapes || 0);
      setTotalLocations(data.total_locations || 0);

      for (const item of data.global_heatmap_data || []) {
        if (item.location) {
          await geocodeLocation(item.location);
        }
      }
    } catch (err: any) {
      console.error('[GLOBAL HEATMAP ERROR]', err);
      setError(err.message || 'Failed to fetch global heatmap data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (viewMode === 'user') {
        fetchUserHeatmap();
      } else {
        fetchGlobalHeatmap();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, viewMode]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const rawData: SellerPoint[] = useMemo(
    () => (viewMode === 'user' ? heatmapData : globalHeatmapData),
    [viewMode, heatmapData, globalHeatmapData]
  );

  // Extract all products across all sellers
  const allProducts = useMemo(() => {
    const products: Array<Product & { seller_name: string; location: string }> = [];
    rawData.forEach((seller) => {
      const sellerProducts = parseProducts(seller.products);
      sellerProducts.forEach((prod) => {
        products.push({
          ...prod,
          seller_name: seller.seller_name,
          location: seller.location,
        });
      });
    });
    return products;
  }, [rawData]);

  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    rawData.forEach((row) => {
      const s = extractState(row.location || '');
      if (s && s !== 'Unknown' && s !== 'Unknown State') set.add(s);
    });
    return Array.from(set).sort();
  }, [rawData]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    rawData.forEach((row) => {
      const city = extractCity(row.location || '');
      const state = extractState(row.location || '');
      if (
        city &&
        state &&
        city !== 'Unknown' &&
        city !== 'Unknown City' &&
        state !== 'Unknown' &&
        state !== 'Unknown State'
      ) {
        set.add(city + ', ' + state);
      }
    });
    return Array.from(set).sort();
  }, [rawData]);

  // Location search suggestions
  const locationSuggestions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const term = searchTerm.toLowerCase();
    const suggestions: Array<{
      type: 'seller' | 'location';
      text: string;
      subtitle: string;
      data: SellerPoint;
    }> = [];

    rawData.forEach((seller) => {
      const sellerMatch = seller.seller_name.toLowerCase().includes(term);
      const locationMatch = seller.location.toLowerCase().includes(term);

      if (sellerMatch || locationMatch) {
        suggestions.push({
          type: sellerMatch ? 'seller' : 'location',
          text: sellerMatch ? seller.seller_name : seller.location,
          subtitle: sellerMatch ? seller.location : parseProducts(seller.products).length + ' products',
          data: seller,
        });
      }
    });

    return suggestions.slice(0, 8);
  }, [searchTerm, rawData]);

  // Product search suggestions
  const productSuggestions = useMemo(() => {
    if (!productSearchTerm || productSearchTerm.length < 2) return [];

    const term = productSearchTerm.toLowerCase();
    const suggestions: Array<{
      product: Product & { seller_name: string; location: string };
    }> = [];

    allProducts.forEach((product) => {
      if (product.title.toLowerCase().includes(term)) {
        suggestions.push({ product });
      }
    });

    return suggestions.slice(0, 8);
  }, [productSearchTerm, allProducts]);

  // Filter data based on display mode (preserved behavior; the compliance
  // filter keeps the >=70 / 40-69 / <40 buckets users already know).
  const filteredData = useMemo(() => {
    if (displayMode === 'location') {
      let data = [...rawData];

      if (stateFilter !== 'all') {
        data = data.filter((item) => extractState(item.location || '') === stateFilter);
      }

      if (cityFilter !== 'all') {
        const [cityName, stateName] = cityFilter.split(', ');
        data = data.filter((item) => {
          const c = extractCity(item.location || '');
          const s = extractState(item.location || '');
          return c === cityName && s === stateName;
        });
      }

      if (searchTerm) {
        data = data.filter(
          (item) =>
            item.seller_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.location.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return data;
    } else {
      let products = [...allProducts];

      if (stateFilter !== 'all') {
        products = products.filter(
          (item) => extractState(item.location || '') === stateFilter
        );
      }

      if (cityFilter !== 'all') {
        const [cityName, stateName] = cityFilter.split(', ');
        products = products.filter((item) => {
          const c = extractCity(item.location || '');
          const s = extractState(item.location || '');
          return c === cityName && s === stateName;
        });
      }

      if (complianceFilter !== 'all') {
        if (complianceFilter === 'high') {
          products = products.filter((p) => (p.compliance_score || 0) >= 70);
        } else if (complianceFilter === 'medium') {
          products = products.filter(
            (p) => (p.compliance_score || 0) >= 40 && (p.compliance_score || 0) < 70
          );
        } else if (complianceFilter === 'low') {
          products = products.filter((p) => (p.compliance_score || 0) < 40);
        }
      }

      if (productSearchTerm) {
        products = products.filter(
          (item) =>
            item.title.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
            item.seller_name.toLowerCase().includes(productSearchTerm.toLowerCase())
        );
      }

      return products;
    }
  }, [
    displayMode,
    rawData,
    allProducts,
    stateFilter,
    cityFilter,
    complianceFilter,
    searchTerm,
    productSearchTerm,
  ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE)),
    [filteredData.length]
  );

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [stateFilter, cityFilter, complianceFilter, viewMode, displayMode, searchTerm, productSearchTerm]);

  const handleLocationSuggestionClick = (suggestion: any) => {
    setSearchTerm(suggestion.text);
    setShowLocationSuggestions(false);

    if (mapRef.current) {
      const coords = geocodedLocations[suggestion.data.location];
      if (coords) {
        mapRef.current.panTo([coords.lat, coords.lng]);
        mapRef.current.setZoom(12);
      }
    }
  };

  const handleProductSuggestionClick = (product: any) => {
    setProductSearchTerm(product.product.title);
    setShowProductSuggestions(false);

    if (mapRef.current) {
      const coords = geocodedLocations[product.product.location];
      if (coords) {
        mapRef.current.panTo([coords.lat, coords.lng]);
        mapRef.current.setZoom(12);
      }
    }
  };

  const handleLocationCardClick = (seller: SellerPoint) => {
    if (mapRef.current) {
      const coords = geocodedLocations[seller.location];
      if (coords) {
        mapRef.current.panTo([coords.lat, coords.lng]);
        mapRef.current.setZoom(13);

        const marker = markers.find(
          (m) => m.seller_name === seller.seller_name && m.location === seller.location
        );
        if (marker) {
          setFocusMarker(marker);
        }

        document.getElementById('heatmap-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  };

  const handleProductCardClick = (product: Product & { seller_name: string; location: string }) => {
    if (mapRef.current) {
      const coords = geocodedLocations[product.location];
      if (coords) {
        mapRef.current.panTo([coords.lat, coords.lng]);
        mapRef.current.setZoom(13);

        const marker = markers.find(
          (m) => m.seller_name === product.seller_name && m.location === product.location
        );
        if (marker) {
          setFocusMarker(marker);
        }

        document.getElementById('heatmap-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  };

  const mapHeatmapData = useMemo(() => {
    if (!showHeatmap) return [];

    return rawData
      .map((p) => {
        const coords = geocodedLocations[p.location];
        if (!coords) return null;
        const score = Number(p.avg_compliance_score) || 0;
        return {
          lat: coords.lat,
          lng: coords.lng,
          weight: score > 0 ? score : 50,
        };
      })
      .filter(Boolean) as Array<{ lat: number; lng: number; weight: number }>;
  }, [showHeatmap, rawData, geocodedLocations]);

  const markers = useMemo(() => {
    const locationGroups = new Map<string, SellerPoint[]>();

    rawData.forEach((p) => {
      if (!locationGroups.has(p.location)) {
        locationGroups.set(p.location, []);
      }
      locationGroups.get(p.location)!.push(p);
    });

    const allMarkers: any[] = [];

    locationGroups.forEach((stores, location) => {
      const coords = geocodedLocations[location];
      if (!coords) return;

      stores.forEach((store, index) => {
        const score = Number(store.avg_compliance_score);
        const offsetCoords = addOffsetToCoords(coords.lat, coords.lng, index, stores.length);

        allMarkers.push({
          ...store,
          ...offsetCoords,
          type: 'seller',
          markerColor: getScoreColor(score),
          score: score || 0,
        });
      });
    });

    return allMarkers;
  }, [rawData, geocodedLocations]);

  const totalProducts = useMemo(() => {
    return rawData.reduce((sum, seller) => {
      return sum + parseProducts(seller.products).length;
    }, 0);
  }, [rawData]);

  if (!isAuthenticated) {
    return (
      <AppShell title="Activity Heatmap">
        <EmptyState
          icon={AlertCircle}
          title="Authentication required"
          hint="Please log in to access this page. Redirecting to login..."
        />
      </AppShell>
    );
  }

  const legendItems = [
    { label: 'No data', color: '#6b7280' },
    { label: '< 40 critical', color: '#DC2626' },
    { label: '40-79 warning', color: '#D97706' },
    { label: '>= 80 success', color: '#16A34A' },
  ];

  return (
    <AppShell title="Activity Heatmap" wide>
      <div className="space-y-6">
        {/* View + display mode toggles + filters */}
        <section className="bg-surface border border-default rounded-card shadow-card p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="inline-flex items-center gap-1 p-1 rounded-pill bg-page">
              <button
                type="button"
                onClick={() => setViewMode('user')}
                className={
                  'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-pill text-sm font-medium transition-colors ' +
                  (viewMode === 'user'
                    ? 'bg-surface text-primary shadow-card'
                    : 'text-secondary hover:text-primary')
                }
              >
                <MapPin className="w-4 h-4" />
                My Activity
              </button>
              <button
                type="button"
                onClick={() => setViewMode('global')}
                className={
                  'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-pill text-sm font-medium transition-colors ' +
                  (viewMode === 'global'
                    ? 'bg-surface text-primary shadow-card'
                    : 'text-secondary hover:text-primary')
                }
              >
                <Globe className="w-4 h-4" />
                Global
              </button>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-pill bg-page">
              <button
                type="button"
                onClick={() => setDisplayMode('location')}
                className={
                  'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-pill text-sm font-medium transition-colors ' +
                  (displayMode === 'location'
                    ? 'bg-surface text-primary shadow-card'
                    : 'text-secondary hover:text-primary')
                }
              >
                <Building2 className="w-4 h-4" />
                By Location
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('product')}
                className={
                  'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-pill text-sm font-medium transition-colors ' +
                  (displayMode === 'product'
                    ? 'bg-surface text-primary shadow-card'
                    : 'text-secondary hover:text-primary')
                }
              >
                <Package className="w-4 h-4" />
                By Product
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col lg:flex-row gap-3 lg:items-center">
            {/* Search with suggestions (preserved) */}
            <div
              className="relative flex-1 min-w-[220px]"
              ref={displayMode === 'location' ? locationSearchRef : productSearchRef}
            >
              <div className="flex items-center bg-surface border border-default rounded-pill px-3.5 h-9 focus-within:border-accent transition-colors">
                <Search className="w-4 h-4 text-muted mr-2" />
                <input
                  value={displayMode === 'location' ? searchTerm : productSearchTerm}
                  onChange={(e) => {
                    if (displayMode === 'location') {
                      setSearchTerm(e.target.value);
                      setShowLocationSuggestions(e.target.value.length >= 2);
                    } else {
                      setProductSearchTerm(e.target.value);
                      setShowProductSuggestions(e.target.value.length >= 2);
                    }
                  }}
                  onFocus={() => {
                    if (displayMode === 'location' && searchTerm.length >= 2) {
                      setShowLocationSuggestions(true);
                    } else if (displayMode === 'product' && productSearchTerm.length >= 2) {
                      setShowProductSuggestions(true);
                    }
                  }}
                  placeholder={
                    displayMode === 'location'
                      ? 'Search locations or sellers...'
                      : 'Search products...'
                  }
                  className="bg-transparent border-none outline-none text-sm text-primary placeholder:text-muted w-full"
                />
                {((displayMode === 'location' && searchTerm) ||
                  (displayMode === 'product' && productSearchTerm)) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (displayMode === 'location') {
                        setSearchTerm('');
                        setShowLocationSuggestions(false);
                      } else {
                        setProductSearchTerm('');
                        setShowProductSuggestions(false);
                      }
                    }}
                    className="ml-2"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4 text-secondary hover:text-primary" />
                  </button>
                )}
              </div>

              {/* Location suggestions dropdown */}
              {displayMode === 'location' &&
                showLocationSuggestions &&
                locationSuggestions.length > 0 && (
                  <div className="absolute z-30 mt-2 w-full bg-surface border border-default rounded-card shadow-card max-h-80 overflow-auto thin-scrollbar">
                    {locationSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleLocationSuggestionClick(suggestion)}
                        className="w-full text-left px-4 py-3 hover:bg-page transition-colors border-b border-default last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          {suggestion.type === 'seller' ? (
                            <Building2 className="w-4 h-4 text-secondary flex-shrink-0" />
                          ) : (
                            <MapPin className="w-4 h-4 text-secondary flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-primary truncate">
                              {suggestion.text}
                            </p>
                            <p className="text-xs text-secondary truncate">
                              {suggestion.subtitle}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

              {/* Product suggestions dropdown */}
              {displayMode === 'product' &&
                showProductSuggestions &&
                productSuggestions.length > 0 && (
                  <div className="absolute z-30 mt-2 w-full bg-surface border border-default rounded-card shadow-card max-h-80 overflow-auto thin-scrollbar">
                    {productSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleProductSuggestionClick(s)}
                        className="w-full text-left px-4 py-3 hover:bg-page transition-colors border-b border-default last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <Package className="w-4 h-4 text-secondary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-primary truncate">
                              {s.product.title}
                            </p>
                            <p className="text-xs text-secondary truncate">
                              {s.product.seller_name} | {s.product.location}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
            </div>

            {/* State / city / compliance filters (preserved) */}
            <label className="relative">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="h-9 pl-3.5 pr-8 rounded-pill border border-default bg-surface text-sm text-primary focus:outline-none focus:border-accent appearance-none"
              >
                <option value="all">All States</option>
                {stateOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
            </label>

            <label className="relative">
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="h-9 pl-3.5 pr-8 rounded-pill border border-default bg-surface text-sm text-primary focus:outline-none focus:border-accent appearance-none"
              >
                <option value="all">All Cities</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
            </label>

            {displayMode === 'product' && (
              <label className="relative">
                <select
                  value={complianceFilter}
                  onChange={(e) => setComplianceFilter(e.target.value)}
                  className="h-9 pl-3.5 pr-8 rounded-pill border border-default bg-surface text-sm text-primary focus:outline-none focus:border-accent appearance-none"
                >
                  <option value="all">All Compliance</option>
                  <option value="high">High (70+)</option>
                  <option value="medium">Medium (40-69)</option>
                  <option value="low">Low (under 40)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
              </label>
            )}

            <button
              type="button"
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={
                'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-pill border text-sm font-medium transition-colors ' +
                (showHeatmap
                  ? 'bg-nav-active text-white border-nav-active'
                  : 'bg-surface text-secondary border-default hover:text-primary hover:border-muted')
              }
            >
              <Activity className="w-4 h-4" />
              {showHeatmap ? 'Hide' : 'Show'} heatmap
            </button>
          </div>
        </section>

        {/* Stat row (design.md stat card) */}
        <section
          aria-label="Activity stats"
          className="grid grid-cols-2 md:grid-cols-4 gap-5"
        >
          <div className="bg-surface border border-default rounded-card shadow-card p-5">
            <p className="text-xs font-medium text-secondary">Sellers</p>
            <p className="mt-1 text-[30px] leading-9 font-bold text-primary tabular-nums">
              {rawData.length}
            </p>
          </div>
          <div className="bg-surface border border-default rounded-card shadow-card p-5">
            <p className="text-xs font-medium text-secondary">Products</p>
            <p className="mt-1 text-[30px] leading-9 font-bold text-primary tabular-nums">
              {totalProducts}
            </p>
          </div>
          <div className="bg-surface border border-default rounded-card shadow-card p-5">
            <p className="text-xs font-medium text-secondary">Total scrapes</p>
            <p className="mt-1 text-[30px] leading-9 font-bold text-primary tabular-nums">
              {totalScrapes.toLocaleString()}
            </p>
          </div>
          <div className="bg-surface border border-default rounded-card shadow-card p-5">
            <p className="text-xs font-medium text-secondary">Locations</p>
            <p className="mt-1 text-[30px] leading-9 font-bold text-primary tabular-nums">
              {totalLocations}
            </p>
          </div>
        </section>

        {error ? (
          <div className="flex items-center gap-2 text-sm text-critical border border-critical rounded-tile p-3 bg-surface">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading heatmap data...
          </div>
        ) : null}

        {/* Map + legend (Phase 5: legend uses the token palette) */}
        <section
          id="heatmap-section"
          className="bg-surface border border-default rounded-card shadow-card p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <CardHeader
              title={'Geographic distribution (' + markers.length + ' locations)'}
            />
            <div className="flex items-center gap-4 flex-wrap -mt-2 mb-2">
              {legendItems.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-secondary">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-card">
            <ViolationHeatmap
              markers={markers}
              points={mapHeatmapData}
              showHeatmap={showHeatmap && mapHeatmapData.length > 0}
              loading={loading}
              focusMarker={focusMarker}
              onMapReady={(map: LeafletMap | null) => {
                mapRef.current = map;
              }}
              renderPopup={(marker) => (
                <div className="min-w-[240px] max-w-[300px]">
                  <h3 className="font-semibold text-sm mb-2 text-primary">
                    {marker.seller_name}
                  </h3>
                  <p className="text-xs text-secondary mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {marker.location}
                  </p>
                  <div className="space-y-1 text-xs text-secondary">
                    <p>
                      Compliance score:{' '}
                      <span className="font-semibold text-primary">
                        {marker.score ? marker.score.toFixed(1) : '0.0'} / 100
                      </span>
                    </p>
                    <p>
                      Total scrapes:{' '}
                      <span className="font-semibold text-primary">
                        {marker.total_scrapes}
                      </span>
                    </p>
                    <p>
                      Products:{' '}
                      <span className="font-semibold text-primary">
                        {parseProducts(marker.products).length}
                      </span>
                    </p>
                    <p>
                      Last activity:{' '}
                      <span className="font-medium">
                        {formatDate(marker.last_activity)}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            />
          </div>
        </section>

        {/* Details list */}
        <section className="bg-surface border border-default rounded-card shadow-card p-6">
          <CardHeader
            title={
              (displayMode === 'location' ? 'Location details' : 'Product details') +
              ' (' + filteredData.length + ')'
            }
            subtitle="Click on any card to view it on the map"
          />

          {filteredData.length === 0 && !loading ? (
            <EmptyState
              icon={displayMode === 'location' ? Building2 : Package}
              title={'No ' + (displayMode === 'location' ? 'locations' : 'products') + ' found'}
              hint="Try changing the filters or search term."
            />
          ) : null}

          <div className="divide-y divide-default">
            {displayMode === 'location'
              ? paginatedData.map((item: any, idx: number) => {
                  const globalIndex = (currentPage - 1) * PAGE_SIZE + idx;
                  const score = Number(item.avg_compliance_score) || 0;
                  const products = parseProducts(item.products);
                  const isExpanded = expandedItem === globalIndex;

                  return (
                    <div key={globalIndex} className="py-3.5">
                      <button
                        type="button"
                        className="w-full text-left flex items-center gap-4 group"
                        onClick={() => setExpandedItem(isExpanded ? null : globalIndex)}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: getScoreColor(score) }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-primary truncate group-hover:text-accent transition-colors">
                            {item.seller_name}
                          </p>
                          <p className="text-xs text-secondary truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.location}
                          </p>
                        </div>
                        <span className="text-xs text-secondary shrink-0">
                          {item.total_scrapes} scrapes
                        </span>
                        <span
                          className="text-sm font-semibold tabular-nums shrink-0 w-12 text-right"
                          style={{ color: getScoreColor(score) }}
                        >
                          {score ? score.toFixed(0) : '-'}
                        </span>
                        <ChevronDown
                          className={
                            'w-4 h-4 text-muted shrink-0 transition-transform ' +
                            (isExpanded ? 'rotate-180' : '')
                          }
                        />
                      </button>

                      {isExpanded ? (
                        <div className="mt-3 ml-7 border border-default rounded-tile p-4 bg-page">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                              <p className="text-secondary">Products</p>
                              <p className="font-semibold text-primary mt-0.5">
                                {products.length}
                              </p>
                            </div>
                            <div>
                              <p className="text-secondary">Avg compliance</p>
                              <p className="font-semibold text-primary mt-0.5">
                                {score ? score.toFixed(1) : '0.0'} / 100
                              </p>
                            </div>
                            <div>
                              <p className="text-secondary">Last activity</p>
                              <p className="font-semibold text-primary mt-0.5">
                                {formatDate(item.last_activity)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleLocationCardClick(item)}
                            className="mt-3 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-pill border border-default text-xs font-medium text-secondary hover:text-primary hover:border-muted transition-colors"
                          >
                            <MousePointer2 className="w-3.5 h-3.5" />
                            View on map
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              : null}

            {displayMode === 'product'
              ? paginatedData.map((product: any, idx: number) => {
                  const score = Number(product.compliance_score) || 0;
                  return (
                    <button
                      key={(currentPage - 1) * PAGE_SIZE + idx}
                      type="button"
                      className="w-full text-left py-3.5 flex items-center gap-4 group"
                      onClick={() => handleProductCardClick(product)}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: getScoreColor(score) }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary truncate group-hover:text-accent transition-colors">
                          {product.title}
                        </p>
                        <p className="text-xs text-secondary truncate flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3" />
                          {product.seller_name}
                        </p>
                      </div>
                      <span className="text-xs text-secondary shrink-0 hidden sm:flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(product.created_at)}
                      </span>
                      <span
                        className="text-sm font-semibold tabular-nums shrink-0 w-12 text-right"
                        style={{ color: getScoreColor(score) }}
                      >
                        {score ? score.toFixed(0) : '-'}
                      </span>
                    </button>
                  );
                })
              : null}
          </div>

          {/* Pagination (preserved) */}
          {filteredData.length > 0 ? (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-secondary">
                Page {currentPage} of {totalPages} - Showing {paginatedData.length} of{' '}
                {filteredData.length}{' '}
                {displayMode === 'location' ? 'locations' : 'products'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="w-9 h-9 rounded-pill border border-default flex items-center justify-center text-secondary hover:text-primary hover:border-muted disabled:opacity-40 transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
    </AppShell>
  );
}
