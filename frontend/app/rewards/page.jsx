'use client';

// Rewards - reskinned per design.md (tododesign Phase 7). Preserves ALL
// existing functionality: token balance, gift catalogue, redemption flow
// (POST /api/gifts/redeem), redemption history and copy-to-clipboard codes.
// No bespoke colors - only the token palette + dashboard card/list patterns.

import React, { useEffect, useState } from 'react';
import {
  Coins,
  Gift,
  TrendingUp,
  Check,
  Lock,
  Copy,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import { CardHeader, StatCard, EmptyState } from '../../components/ui';
import { formatMetaDate } from '../../lib/design';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function Rewards() {
  // State management (preserved)
  const [metaTokens, setMetaTokens] = useState(0);
  const [availableGifts, setAvailableGifts] = useState([]);
  const [redemptionHistory, setRedemptionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state (preserved)
  const [selectedReward, setSelectedReward] = useState(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchTokenBalance(),
        fetchAvailableGifts(),
        fetchRedemptionHistory(),
      ]);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError('Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenBalance = async () => {
    try {
      const response = await fetch(API_BASE_URL + '/api/gifts/token-balance', {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch token balance');
      }
      const data = await response.json();
      setMetaTokens(data.mt_tokens || 0);
    } catch (err) {
      console.error('Error fetching token balance:', err);
      throw err;
    }
  };

  const fetchAvailableGifts = async () => {
    try {
      const response = await fetch(API_BASE_URL + '/api/gifts/list', {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch available gifts');
      }
      const data = await response.json();
      const transformedGifts = (data.gifts || []).map(function (gift) {
        return {
          id: gift.id,
          name: gift.partner || 'Gift Card',
          tokens: gift.mt_tokens_required,
          value: gift.value,
          partner: gift.partner,
          description: (gift.partner || '') + ' gift card worth ' + gift.value,
        };
      });
      setAvailableGifts(transformedGifts);
    } catch (err) {
      console.error('Error fetching available gifts:', err);
      throw err;
    }
  };

  const fetchRedemptionHistory = async () => {
    try {
      const response = await fetch(API_BASE_URL + '/api/gifts/my-redemptions', {
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
      const transformedHistory = (data.redemptions || []).map(function (redemption) {
        return {
          id: redemption.redemption_id,
          value: redemption.value,
          tokensUsed: redemption.mt_tokens_required,
          code: redemption.gift_code,
          pin: redemption.gift_pin,
          partner: redemption.partner,
          redeemedAt: redemption.redeemed_at || new Date().toISOString(),
          status: 'completed',
        };
      });
      setRedemptionHistory(transformedHistory);
    } catch (err) {
      console.error('Error fetching redemption history:', err);
    }
  };

  // Handle gift redemption (preserved)
  const handleRedeem = function (reward) {
    if (metaTokens >= reward.tokens) {
      setSelectedReward(reward);
      setShowRedeemModal(true);
    }
  };

  const confirmRedeem = async () => {
    if (!selectedReward) return;

    setIsRedeeming(true);
    setError(null);

    try {
      const response = await fetch(API_BASE_URL + '/api/gifts/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gift_id: selectedReward.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Redemption failed');
      }

      const data = await response.json();

      setMetaTokens(data.tokens_remaining);
      setRedeemSuccess(true);

      await fetchRedemptionHistory();
      await fetchAvailableGifts();

      setTimeout(function () {
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

  const copyToClipboard = function (text, type) {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(function () {
        setCopiedCode(false);
      }, 2000);
    } else {
      setCopiedPin(true);
      setTimeout(function () {
        setCopiedPin(false);
      }, 2000);
    }
  };

  const redeemedTokens = redemptionHistory.reduce(function (sum, item) {
    return sum + item.tokensUsed;
  }, 0);

  return (
    <AppShell
      title="Rewards"
      wide
      actions={
        <button
          type="button"
          onClick={fetchInitialData}
          disabled={loading}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-pill border border-default bg-surface text-sm font-medium text-secondary hover:text-primary hover:border-muted transition-colors disabled:opacity-50"
        >
          {loading ? (
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
          <Loader2 className="w-5 h-5 animate-spin" /> Loading rewards...
        </div>
      ) : error && !metaTokens ? (
        <EmptyState
          icon={AlertCircle}
          title={error}
          hint="Check that the backend is running, then retry."
        />
      ) : (
        <div className="space-y-6">
          {/* Balance + stats (design.md stat cards) */}
          <section
            aria-label="Balance"
            className="grid grid-cols-2 md:grid-cols-4 gap-5"
          >
            <div className="bg-surface border border-default rounded-card shadow-card p-5 col-span-2 md:col-span-1">
              <p className="text-xs font-medium text-secondary">Available balance</p>
              <p className="mt-1 text-[30px] leading-9 font-bold text-primary tabular-nums">
                {metaTokens} MT
              </p>
              <p className="mt-1 text-xs text-muted">Meta-Tokens</p>
            </div>
            <StatCard label="Redeemed" value={redeemedTokens} hint="MT spent on rewards" />
            <StatCard label="Rewards claimed" value={redemptionHistory.length} />
            <StatCard
              label="Tier"
              value={metaTokens >= 100 ? 'Gold' : metaTokens >= 50 ? 'Silver' : 'Bronze'}
              hint="Based on balance"
            />
          </section>

          {/* Gift catalogue */}
          <section className="bg-surface border border-default rounded-card shadow-card p-6">
            <CardHeader
              title="Gift catalogue"
              subtitle="Redeem your Meta-Tokens for exclusive rewards"
            />
            {availableGifts.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="No rewards available yet"
                hint="Gift cards appear here once the catalogue is stocked."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {availableGifts.map(function (reward) {
                  const affordable = metaTokens >= reward.tokens;
                  return (
                    <div
                      key={reward.id}
                      className="border border-default rounded-card p-5 flex flex-col gap-3 bg-surface"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-10 h-10 rounded-tile bg-cat-generic flex items-center justify-center shrink-0">
                          <Gift className="w-5 h-5 text-white" />
                        </div>
                        <span
                          className={
                            'inline-flex items-center h-6 px-2.5 rounded-pill border text-xs font-semibold ' +
                            (affordable
                              ? 'bg-surface text-success border-success'
                              : 'bg-surface text-secondary border-default')
                          }
                        >
                          {affordable ? 'Available' : 'Locked'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary">
                          {reward.partner || reward.name}
                        </p>
                        <p className="mt-0.5 text-xs text-secondary">
                          {reward.description}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <p className="text-sm">
                          <span className="text-2xl font-bold text-primary tabular-nums">
                            {reward.tokens}
                          </span>{' '}
                          <span className="text-xs text-secondary">MT</span>
                        </p>
                        {affordable ? (
                          <button
                            type="button"
                            onClick={function () {
                              handleRedeem(reward);
                            }}
                            className="inline-flex items-center justify-center h-8 px-4 rounded-pill bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                          >
                            Redeem
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 h-8 px-4 rounded-pill border border-default text-sm font-medium text-muted">
                            <Lock className="w-3.5 h-3.5" />
                            {reward.tokens - metaTokens} MT to go
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Redemption history (design.md list pattern) */}
          <section className="bg-surface border border-default rounded-card shadow-card p-6">
            <CardHeader
              title="Redemption history"
              subtitle={
                redemptionHistory.length + ' reward' + (redemptionHistory.length === 1 ? '' : 's') + ' claimed'
              }
            />
            {redemptionHistory.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No redemptions yet"
                hint="Redeem a gift card to see it here."
              />
            ) : (
              <div className="divide-y divide-default">
                {redemptionHistory.map(function (item) {
                  return (
                    <div key={item.id} className="py-3.5 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-tile bg-cat-generic flex items-center justify-center shrink-0">
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary truncate">
                          {item.partner || 'Gift card'}
                        </p>
                        <p className="text-xs text-secondary truncate">
                          {item.tokensUsed} MT | {formatMetaDate(item.redeemedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={function () {
                          setSelectedHistoryItem(item);
                        }}
                        className="inline-flex items-center justify-center h-8 px-4 rounded-pill border border-default bg-surface text-sm font-semibold text-primary hover:border-muted transition-colors"
                      >
                        View code
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Redeem confirm modal (preserved flow) */}
      {showRedeemModal && selectedReward ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-primary/40"
            onClick={function () {
              if (!isRedeeming) setShowRedeemModal(false);
            }}
          />
          <div className="relative bg-surface border border-default rounded-card shadow-card p-6 w-full max-w-md">
            {redeemSuccess ? (
              <div className="text-center py-4">
                <Check className="w-10 h-10 text-success mx-auto mb-3" />
                <h3 className="text-base font-semibold text-primary">Redeemed!</h3>
                <p className="mt-1 text-sm text-secondary">
                  Your reward code is in the redemption history.
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-base font-semibold text-primary">
                  Confirm redemption
                </h3>
                <p className="mt-1 text-sm text-secondary">
                  Redeem{' '}
                  <span className="font-semibold text-primary">
                    {selectedReward.tokens} MT
                  </span>{' '}
                  for a {selectedReward.partner || 'gift card'} worth {selectedReward.value}?
                </p>
                {error ? (
                  <div className="mt-3 flex items-start gap-2 border border-critical rounded-tile p-3 text-xs text-critical">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {error}
                  </div>
                ) : null}
                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={function () {
                      setShowRedeemModal(false);
                    }}
                    disabled={isRedeeming}
                    className="h-9 px-4 rounded-pill border border-default text-sm font-medium text-secondary hover:text-primary hover:border-muted transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmRedeem}
                    disabled={isRedeeming}
                    className="h-9 px-5 rounded-pill bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isRedeeming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Coins className="w-4 h-4" />
                    )}
                    Redeem now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Reward code modal (preserved copy flow) */}
      {selectedHistoryItem ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-primary/40"
            onClick={function () {
              setSelectedHistoryItem(null);
            }}
          />
          <div className="relative bg-surface border border-default rounded-card shadow-card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-primary">
                {selectedHistoryItem.partner || 'Gift card'}
              </h3>
              <button
                type="button"
                onClick={function () {
                  setSelectedHistoryItem(null);
                }}
                className="w-8 h-8 rounded-pill border border-default flex items-center justify-center text-secondary hover:text-primary hover:border-muted transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-secondary mb-1.5">Gift code</p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 px-3 py-2.5 bg-page border border-default rounded-tile text-sm font-semibold text-primary break-all select-all">
                    {selectedHistoryItem.code}
                  </p>
                  <button
                    type="button"
                    onClick={function () {
                      copyToClipboard(selectedHistoryItem.code, 'code');
                    }}
                    className="w-10 h-10 rounded-tile border border-default flex items-center justify-center text-secondary hover:text-primary hover:border-muted transition-colors shrink-0"
                    aria-label="Copy code"
                  >
                    {copiedCode ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              {selectedHistoryItem.pin ? (
                <div>
                  <p className="text-xs text-secondary mb-1.5">PIN</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 px-3 py-2.5 bg-page border border-default rounded-tile text-sm font-semibold text-primary select-all">
                      {selectedHistoryItem.pin}
                    </p>
                    <button
                      type="button"
                      onClick={function () {
                        copyToClipboard(selectedHistoryItem.pin, 'pin');
                      }}
                      className="w-10 h-10 rounded-tile border border-default flex items-center justify-center text-secondary hover:text-primary hover:border-muted transition-colors shrink-0"
                      aria-label="Copy PIN"
                    >
                      {copiedPin ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
