'use client';

import React, { useState, useEffect } from 'react';
import { 
  Coins, Gift, Sparkles, TrendingUp, Award, Check, Lock, ChevronRight,
  Star, Zap, Trophy, Copy, X, AlertCircle
} from 'lucide-react';
import Navbar from '../Navbar';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function Rewards() {
  // State management
  const [metaTokens, setMetaTokens] = useState(0);
  const [availableGifts, setAvailableGifts] = useState([]);
  const [redemptionHistory, setRedemptionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI state
  const [selectedReward, setSelectedReward] = useState(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Fetch initial data on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all required data in parallel
      await Promise.all([
        fetchTokenBalance(),
        fetchAvailableGifts(),
        fetchRedemptionHistory()
      ]);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError('Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user's MT token balance
  const fetchTokenBalance = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/gifts/token-balance`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please login to view rewards');
        }
        throw new Error('Failed to fetch token balance');
      }

      const data = await response.json();
      setMetaTokens(data.mt_tokens || 0);
    } catch (err) {
      console.error('Error fetching token balance:', err);
      throw err;
    }
  };

  // Fetch all available gifts
  const fetchAvailableGifts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/gifts/list`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch available gifts');
      }

      const data = await response.json();
      
      // Transform API data to match UI requirements
      const transformedGifts = (data.gifts || []).map(gift => ({
        id: gift.id,
        name: getRewardName(gift.mt_tokens_required),
        tokens: gift.mt_tokens_required,
        value: gift.value,
        code: gift.gift_code,
        pin: gift.pin_code ?? '',
        partner: gift.partner,
        color: getColorGradient(gift.mt_tokens_required),
        borderColor: getBorderColor(gift.mt_tokens_required),
        glowColor: getGlowColor(gift.mt_tokens_required),
        icon: getRewardIcon(gift.mt_tokens_required),
        description: `${gift.partner} Gift Card`,
        discount: getDiscount(gift.mt_tokens_required)
      }));

      setAvailableGifts(transformedGifts);
    } catch (err) {
      console.error('Error fetching available gifts:', err);
      throw err;
    }
  };

  // Fetch user's redemption history
  const fetchRedemptionHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/gifts/my-redemptions`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          return; // User not logged in, skip
        }
        throw new Error('Failed to fetch redemption history');
      }

      const data = await response.json();
      console.log(data)
      // Transform redemptions for UI
      const transformedHistory = (data.redemptions || []).map(redemption => ({
        id: redemption.redemption_id,
        rewardName: getRewardName(redemption.mt_tokens_required),
        value: redemption.value,
        tokensUsed: redemption.mt_tokens_required,
        code: redemption.gift_code,
        pin: redemption.gift_pin,
        partner: redemption.partner,
        redeemedAt: new Date().toISOString(), // You can add a timestamp field in backend
        status: 'completed'
      }));

      setRedemptionHistory(transformedHistory);
    } catch (err) {
      console.error('Error fetching redemption history:', err);
    }
  };

  // Handle gift redemption
  const handleRedeem = (reward) => {
    if (metaTokens >= reward.tokens) {
      setSelectedReward(reward);
      setShowRedeemModal(true);
    }
  };

  // Confirm redemption
  const confirmRedeem = async () => {
    if (!selectedReward) return;
    
    setIsRedeeming(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/gifts/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          gift_id: selectedReward.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Redemption failed');
      }

      const data = await response.json();
      
      // Update local state
      setMetaTokens(data.tokens_remaining);
      setRedeemSuccess(true);

      // Refresh redemption history
      await fetchRedemptionHistory();
      await fetchAvailableGifts(); // Refresh available gifts
      
      setTimeout(() => {
        setShowRedeemModal(false);
        setRedeemSuccess(false);
        setSelectedReward(null);
      }, 3000);

    } catch (err) {
      console.error('Error redeeming gift:', err);
      setError(err.message);
      setRedeemSuccess(false);
    } finally {
      setIsRedeeming(false);
    }
  };

  // Helper functions for reward tier styling
  const getRewardName = (tokens) => {
    if (tokens <= 10) return 'Starter Pack';
    if (tokens <= 20) return 'Bronze Bundle';
    if (tokens <= 50) return 'Silver Special';
    return 'Gold Premium';
  };

  const getColorGradient = (tokens) => {
    if (tokens <= 10) return 'from-purple-600 to-purple-900';
    if (tokens <= 20) return 'from-amber-600 to-orange-900';
    if (tokens <= 50) return 'from-cyan-600 to-blue-900';
    return 'from-yellow-600 to-yellow-900';
  };

  const getBorderColor = (tokens) => {
    if (tokens <= 10) return 'border-purple-500/50';
    if (tokens <= 20) return 'border-amber-500/50';
    if (tokens <= 50) return 'border-cyan-500/50';
    return 'border-yellow-500/50';
  };

  const getGlowColor = (tokens) => {
    if (tokens <= 10) return 'shadow-purple-500/30';
    if (tokens <= 20) return 'shadow-amber-500/30';
    if (tokens <= 50) return 'shadow-cyan-500/30';
    return 'shadow-yellow-500/30';
  };

  const getRewardIcon = (tokens) => {
    if (tokens <= 10) return Gift;
    if (tokens <= 20) return Award;
    if (tokens <= 50) return Zap;
    return Trophy;
  };

  const getDiscount = (tokens) => {
    if (tokens >= 100) return '10% Bonus';
    if (tokens >= 50) return '5% Bonus';
    return null;
  };

  const extractValueFromCode = (code) => {
    // Extract numeric value from gift code (customize based on your code format)
    const match = code.match(/\d+/);
    return match ? parseInt(match[0]) : 10;
  };

  // Copy to clipboard function
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  // Format date helper
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-black flex items-center justify-center ml-20 lg:ml-64">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 border-r-cyan-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-300 uppercase tracking-wider text-sm">Loading Rewards...</p>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (error && !metaTokens) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-black flex items-center justify-center ml-20 lg:ml-64">
          <div className="text-center bg-red-950/50 border border-red-500/50 rounded-2xl p-8 max-w-md">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold mb-2 uppercase tracking-wider">Error Loading Rewards</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={fetchInitialData}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all font-semibold uppercase tracking-wider"
            >
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  // Calculate stats
  const earnedTokens = redemptionHistory.reduce((sum, item) => sum + item.tokensUsed, 0) + metaTokens;
  const redeemedTokens = redemptionHistory.reduce((sum, item) => sum + item.tokensUsed, 0);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black text-white p-8 ml-20 lg:ml-64">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 mt-6">
            <h2 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                Rewards Center
              </span>
            </h2>
            <div className="border-t-2 border-gradient" style={{
              borderImage: 'linear-gradient(to right, rgb(168, 85, 247), rgb(6, 182, 212)) 1'
            }} />
            <p className="mt-2 text-xs font-light tracking-wider uppercase text-gray-400">
              Redeem your Meta-tokens for exclusive rewards
            </p>
          </div>

          {/* Balance Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600/20 via-purple-900/20 to-black border border-purple-500/30 rounded-2xl p-8 mb-8 backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-900 rounded-xl">
                  <Coins className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 uppercase tracking-wider">Available Balance</p>
                  <h3 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                    {metaTokens} MT
                  </h3>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Earned</p>
                      <p className="text-xl font-bold text-green-400">{earnedTokens} MT</p>
                    </div>
                  </div>
                </div>

                <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-cyan-500/20">
                  <div className="flex items-center gap-3">
                    <Gift className="w-5 h-5 text-cyan-400" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Redeemed</p>
                      <p className="text-xl font-bold text-cyan-400">{redeemedTokens} MT</p>
                    </div>
                  </div>
                </div>

                <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-yellow-500/20">
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Tier Status</p>
                      <p className="text-xl font-bold text-yellow-400">
                        {metaTokens >= 100 ? 'Gold' : metaTokens >= 50 ? 'Silver' : 'Bronze'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rewards Grid */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                Available Rewards
              </span>
            </h3>

            {availableGifts.length === 0 ? (
              <div className="text-center py-12 bg-black/60 border border-purple-500/30 rounded-2xl backdrop-blur-sm">
                <Gift className="w-20 h-20 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-xl uppercase tracking-wider">No rewards available at this time</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {availableGifts.map((reward) => {
                  const canAfford = metaTokens >= reward.tokens;
                  const Icon = reward.icon;

                  return (
                    <div
                      key={reward.id}
                      className={`relative group overflow-hidden rounded-2xl border ${reward.borderColor} transition-all duration-300 ${
                        canAfford 
                          ? `hover:scale-105 hover:shadow-2xl ${reward.glowColor} cursor-pointer` 
                          : 'opacity-60 cursor-not-allowed'
                      }`}
                      onClick={() => canAfford && handleRedeem(reward)}
                      style={{ height: '400px' }}
                    >
                      {/* Amazon Gift Card Background */}
                      <div className="absolute inset-0">
                        <img
                          src="https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=800&auto=format&fit=crop&q=80"
                          alt={`${reward.partner} Gift Card`}
                          className="w-full h-full object-cover opacity-40"
                        />
                        <div className={`absolute inset-0 bg-gradient-to-br ${reward.color} opacity-90 mix-blend-multiply`}></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                      </div>

                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

                      {/* Lock overlay */}
                      {!canAfford && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
                          <div className="text-center">
                            <Lock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-400 uppercase tracking-wider">Insufficient Tokens</p>
                          </div>
                        </div>
                      )}

                      {/* Discount badge */}
                      {reward.discount && (
                        <div className="absolute top-4 right-4 bg-gradient-to-r from-red-500 to-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider z-10 shadow-lg">
                          {reward.discount}
                        </div>
                      )}

                      {/* Partner Logo */}
                      <div className="absolute top-4 left-4 z-10">
                        <div className="bg-white/90 px-3 py-1.5 rounded-lg">
                          <p className="text-black font-bold text-sm">{reward.partner}</p>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="relative z-10 h-full flex flex-col justify-end p-6">
                        <div className="mb-3">
                          <div className="inline-flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full mb-2">
                            <Icon className="w-4 h-4 text-white" />
                            <span className="text-xs font-semibold text-white uppercase tracking-wider">
                              Gift Card
                            </span>
                          </div>
                          <h4 className="text-2xl font-bold mb-1 text-white drop-shadow-lg">{reward.name}</h4>
                          <p className="text-sm text-white/90 drop-shadow">{reward.description}</p>
                        </div>

                        <div className="bg-black/70 backdrop-blur-md rounded-xl p-4 border border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/70 uppercase tracking-wider">Card Value</span>
                            <span className="font-bold text-2xl text-white">₹{reward.value}</span>
                          </div>
                          <div className="border-t border-white/20 my-2"></div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/70 uppercase tracking-wider">Token Cost</span>
                            <div className="flex items-center gap-1.5">
                              <Coins className="w-5 h-5 text-yellow-400" />
                              <span className="font-bold text-xl text-yellow-400">{reward.tokens} MT</span>
                            </div>
                          </div>
                        </div>

                        {canAfford && (
                          <button className="w-full mt-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 uppercase tracking-wider text-sm border border-white/20 hover:border-white/40 shadow-lg">
                            Redeem Now
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* How to Earn Section */}
          <div className="bg-gradient-to-br from-black/60 via-purple-950/20 to-black border border-purple-500/30 rounded-2xl p-8 backdrop-blur-xl mb-8">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                How to Earn Meta-Tokens
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-black/40 rounded-xl p-6 border border-purple-500/20">
                <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                  <Check className="w-6 h-6 text-purple-400" />
                </div>
                <h4 className="text-lg font-semibold mb-2 text-purple-400">Submit Reports</h4>
                <p className="text-sm text-gray-400">Earn 10-50 MT for each compliance report you submit to the platform.</p>
              </div>

              <div className="bg-black/40 rounded-xl p-6 border border-cyan-500/20">
                <div className="w-12 h-12 bg-cyan-600/20 rounded-lg flex items-center justify-center mb-4">
                  <Award className="w-6 h-6 text-cyan-400" />
                </div>
                <h4 className="text-lg font-semibold mb-2 text-cyan-400">Complete Tasks</h4>
                <p className="text-sm text-gray-400">Get bonus tokens for completing daily and weekly compliance tasks.</p>
              </div>

              <div className="bg-black/40 rounded-xl p-6 border border-yellow-500/20">
                <div className="w-12 h-12 bg-yellow-600/20 rounded-lg flex items-center justify-center mb-4">
                  <Star className="w-6 h-6 text-yellow-400" />
                </div>
                <h4 className="text-lg font-semibold mb-2 text-yellow-400">Referral Bonus</h4>
                <p className="text-sm text-gray-400">Invite others and earn 25 MT for each successful referral.</p>
              </div>
            </div>
          </div>

          {/* Redemption History Section */}
          <div className="bg-gradient-to-br from-black/60 via-cyan-950/20 to-black border border-cyan-500/30 rounded-2xl p-8 backdrop-blur-xl">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Gift className="w-6 h-6 text-cyan-400" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                Redemption History
              </span>
            </h3>

            {redemptionHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-700/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-10 h-10 text-gray-500" />
                </div>
                <p className="text-gray-400">No redemptions yet. Start earning and redeeming rewards!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {redemptionHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-black/40 rounded-xl p-6 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left Section */}
                      <div className="flex-1">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-cyan-600/20 to-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0 border border-cyan-500/30">
                            <div className="text-center">
                              <p className="text-xs text-white font-bold">{item.partner}</p>
                            </div>
                          </div>
                          
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-white mb-1">{item.rewardName}</h4>
                            <p className="text-sm text-gray-400 mb-2">
                              Redeemed on {formatDate(item.redeemedAt)}
                            </p>
                            
                            <div className="flex flex-wrap gap-3 mt-3">
                              <div className="flex items-center gap-1.5 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/30">
                                <span className="text-xs text-green-400 uppercase tracking-wider">Value: ₹{item.value}</span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/30">
                                <Coins className="w-3 h-3 text-purple-400" />
                                <span className="text-xs text-purple-400 uppercase tracking-wider">{item.tokensUsed} MT</span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">
                                <Check className="w-3 h-3 text-cyan-400" />
                                <span className="text-xs text-cyan-400 uppercase tracking-wider">{item.status}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Section */}
                      <div className="flex items-center justify-end md:justify-start">
                        <button
                          onClick={() => {
                            setSelectedHistoryItem(item);
                            setShowCodeModal(true);
                          }}
                          className="bg-gradient-to-r from-purple-600/20 to-cyan-600/20 hover:from-purple-600/40 hover:to-cyan-600/40 border border-purple-500/30 hover:border-purple-500/50 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 flex items-center gap-2 uppercase tracking-wider text-sm group-hover:shadow-lg group-hover:shadow-purple-500/20"
                        >
                          View Code & PIN
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Redeem Modal */}
        {showRedeemModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-purple-900/90 to-black border border-purple-500/50 rounded-2xl p-8 max-w-md w-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl"></div>
              
              <div className="relative z-10">
                {!redeemSuccess ? (
                  <>
                    <div className="text-center mb-6">
                      <div className="relative w-48 h-32 mx-auto mb-4 rounded-lg overflow-hidden shadow-2xl">
                        <img
                          src="https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=400&auto=format&fit=crop&q=80"
                          alt="Gift Card"
                          className="w-full h-full object-cover opacity-60"
                        />
                        <div className={`absolute inset-0 bg-gradient-to-br ${selectedReward?.color} opacity-80 mix-blend-multiply`}></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="bg-white/90 px-4 py-2 rounded-lg mb-2">
                              <p className="text-black font-bold text-lg">{selectedReward?.partner}</p>
                            </div>
                            <p className="text-white font-bold text-xl">₹{selectedReward?.value}</p>
                          </div>
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold mb-2 text-white">{selectedReward?.name}</h3>
                      <p className="text-gray-400">{selectedReward?.description}</p>
                    </div>

                    {error && (
                      <div className="mb-4 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                        <p className="text-sm text-red-400 text-center">{error}</p>
                      </div>
                    )}

                    <div className="bg-black/40 rounded-xl p-4 mb-6 border border-purple-500/20">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400">Gift Card Value</span>
                        <span className="font-bold text-xl text-white">₹{selectedReward?.value}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400">Token Cost</span>
                        <span className="font-bold text-xl text-purple-400">{selectedReward?.tokens} MT</span>
                      </div>
                      <div className="border-t border-gray-700 my-3"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Balance After</span>
                        <span className="font-bold text-xl text-cyan-400">{metaTokens - selectedReward?.tokens} MT</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowRedeemModal(false);
                          setError(null);
                        }}
                        disabled={isRedeeming}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 uppercase tracking-wider text-sm disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmRedeem}
                        disabled={isRedeeming}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 uppercase tracking-wider text-sm shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isRedeeming ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Redeeming...
                          </>
                        ) : (
                          'Confirm'
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Check className="w-12 h-12 text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-white">Redemption Successful!</h3>
                    <p className="text-gray-400 mb-6">Your gift card has been added to your redemption history.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* View Code Modal */}
        {showCodeModal && selectedHistoryItem && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-cyan-900/90 to-black border border-cyan-500/50 rounded-2xl p-8 max-w-md w-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
              
              <button
                onClick={() => {
                  setShowCodeModal(false);
                  setSelectedHistoryItem(null);
                  setCopiedCode(false);
                  setCopiedPin(false);
                }}
                className="absolute top-4 right-4 z-20 bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-all duration-300"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              
              <div className="relative z-10">
                <div className="text-center mb-6">
                  <div className="relative w-48 h-32 mx-auto mb-4 rounded-lg overflow-hidden shadow-2xl">
                    <img
                      src="https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=400&auto=format&fit=crop&q=80"
                      alt="Gift Card"
                      className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-600 to-cyan-900 opacity-80 mix-blend-multiply"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="bg-white/90 px-4 py-2 rounded-lg mb-2">
                          <p className="text-black font-bold text-lg">{selectedHistoryItem.partner}</p>
                        </div>
                        <p className="text-white font-bold text-xl">₹{selectedHistoryItem.value}</p>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-white">{selectedHistoryItem.rewardName}</h3>
                  <p className="text-gray-400 text-sm">
                    Redeemed {formatDate(selectedHistoryItem.redeemedAt)}
                  </p>
                </div>

                {/* Gift Card Code */}
                <div className="bg-black/40 rounded-xl p-5 mb-4 border border-cyan-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400 uppercase tracking-wider">Gift Card Code</p>
                    <button
                      onClick={() => copyToClipboard(selectedHistoryItem.code, 'code')}
                      className="text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {copiedCode ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-lg font-bold text-cyan-400 break-all select-all">
                    {selectedHistoryItem.code}
                  </p>
                  {copiedCode && (
                    <p className="text-xs text-green-400 mt-2">Copied to clipboard!</p>
                  )}
                </div>

                {/* PIN */}
                <div className="bg-black/40 rounded-xl p-5 mb-6 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400 uppercase tracking-wider">PIN</p>
                    <button
                      onClick={() => copyToClipboard(selectedHistoryItem.pin, 'pin')}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      {copiedPin ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-lg font-bold text-purple-400 select-all">
                    {selectedHistoryItem.pin}
                  </p>
                  {copiedPin && (
                    <p className="text-xs text-green-400 mt-2">Copied to clipboard!</p>
                  )}
                </div>

                {/* Info Box */}
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-cyan-500/20 rounded-full flex items-center justify-center">
                        <Gift className="w-4 h-4 text-cyan-400" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-cyan-300 font-semibold mb-1">How to Redeem</p>
                      <p className="text-xs text-gray-400">
                        Visit {selectedHistoryItem.partner}.in, go to "Gift Cards", click "Redeem a Gift Card", and enter the code above.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
