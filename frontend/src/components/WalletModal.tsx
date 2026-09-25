import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  QrCode,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Wallet as WalletIcon,
  Clock,
  AlertCircle,
  FileCheck,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import type {
  UserProfile,
  WalletSummary,
  PaymentConfig,
  PaymentVerificationItem,
  PaymentItem,
  DepositResponse,
  PaymentStatusResponse
} from '../types';
import {
  getWalletSummary,
  getPaymentConfig,
  submitPaymentVerification,
  getUserVerifications,
  createDeposit,
  getPaymentStatus,
  getPaymentHistory
} from '../services/api';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onBalanceUpdated?: (newBalance: number) => void;
  onRequireLogin?: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  user,
  onBalanceUpdated,
  onRequireLogin,
}) => {
  const [activeTab, setActiveTab] = useState<'add_money' | 'manual_utr' | 'payments' | 'transactions'>('add_money');
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const selectedProvider = 'upi';
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [verifications, setVerifications] = useState<PaymentVerificationItem[]>([]);
  const [paymentsHistory, setPaymentsHistory] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedVpa, setCopiedVpa] = useState<boolean>(false);
  const [copiedPaymentId, setCopiedPaymentId] = useState<boolean>(false);

  // Active Payment Creation & Polling State
  const [isInitiatingPayment, setIsInitiatingPayment] = useState<boolean>(false);
  const [activePayment, setActivePayment] = useState<DepositResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Manual Bank UTR verification form inputs
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [userNotes, setUserNotes] = useState<string>('');
  const [isSubmittingUtr, setIsSubmittingUtr] = useState<boolean>(false);
  const [utrSuccess, setUtrSuccess] = useState<any | null>(null);
  const [utrError, setUtrError] = useState<string | null>(null);

  const pollingIntervalRef = useRef<any>(null);

  const presetAmounts = [250, 500, 1000, 2500, 5000];

  const fetchSummary = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getWalletSummary();
      setSummary(data);
      if (onBalanceUpdated) {
        onBalanceUpdated(data.wallet_balance);
      }
    } catch (err) {
      console.error('Failed to load wallet summary', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const cfg = await getPaymentConfig();
      setPaymentConfig(cfg);
    } catch (err) {
      console.error('Failed to load payment config', err);
    }
  };

  const fetchHistoryData = async () => {
    if (!user) return;
    try {
      const [vList, pList] = await Promise.all([
        getUserVerifications().catch(() => []),
        getPaymentHistory(50).catch(() => [])
      ]);
      setVerifications(vList);
      setPaymentsHistory(pList);
    } catch (err) {
      console.error('Failed to load history data', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      setPaymentError(null);
      setUtrError(null);
      setUtrSuccess(null);
      if (user) {
        fetchSummary();
        fetchHistoryData();
      }
    } else {
      // Clear polling when modal closes
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsPolling(false);
    }
  }, [isOpen, user]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const currentAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;
  const activeVpa = paymentConfig?.upi_vpa || 'lextitle.billing@icici';
  const activePayeeName = paymentConfig?.upi_payee_name || 'LexTitle AI Legal Systems';

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(activeVpa);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleCopyPaymentId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedPaymentId(true);
    setTimeout(() => setCopiedPaymentId(false), 2000);
  };

  // ---------------- Initiate Payment Flow ----------------
  const handleStartDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    setPaymentStatus(null);

    if (!user) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    if (currentAmount < 10) {
      setPaymentError('Minimum deposit amount is ₹10.00.');
      return;
    }

    setIsInitiatingPayment(true);
    try {
      const deposit = await createDeposit(currentAmount, selectedProvider, selectedProvider);
      setActivePayment(deposit);
      setIsInitiatingPayment(false);

      // Begin background verification polling
      startPollingPaymentStatus(deposit.payment_id);
    } catch (err: any) {
      setIsInitiatingPayment(false);
      setPaymentError(err.message || 'Failed to initiate payment.');
    }
  };

  // Polls backend status endpoint until verified by provider/backend
  const startPollingPaymentStatus = (paymentId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setIsPolling(true);
    let attempts = 0;
    const maxAttempts = 120; // 5 minutes at 2.5s interval

    pollingIntervalRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await getPaymentStatus(paymentId);
        setPaymentStatus(res);

        if (res.status === 'SUCCESS') {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          setIsPolling(false);
          // Refresh user wallet summary and inform parent
          await fetchSummary();
          await fetchHistoryData();
          if (onBalanceUpdated) {
            onBalanceUpdated(res.wallet_balance);
          }
        } else if (res.status === 'FAILED' || res.status === 'CANCELLED') {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          setIsPolling(false);
        } else if (attempts >= maxAttempts) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          setIsPolling(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2500);
  };

  const handleResetActivePayment = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    setActivePayment(null);
    setPaymentStatus(null);
    setPaymentError(null);
  };

  // ---------------- Manual Bank UTR Submission ----------------
  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setUtrError(null);

    if (!user) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    if (currentAmount < 10) {
      setUtrError('Minimum deposit amount is ₹10.00');
      return;
    }

    const trimmedUtr = utrNumber.trim();
    if (!trimmedUtr || trimmedUtr.length < 6) {
      setUtrError('Please enter a valid Bank UTR / Transaction Reference (minimum 6 digits).');
      return;
    }

    setIsSubmittingUtr(true);
    try {
      const res = await submitPaymentVerification(
        currentAmount,
        'upi',
        trimmedUtr,
        userNotes.trim() || undefined
      );

      setUtrSuccess({
        amount: currentAmount,
        method: 'upi',
        utr_number: res.utr_number || trimmedUtr,
        status: res.status,
        message: res.message || 'Payment submitted successfully. Your balance will update immediately upon admin confirmation.',
      });

      setUtrNumber('');
      setUserNotes('');
      await fetchHistoryData();
    } catch (err: any) {
      setUtrError(err.message || 'Failed to submit payment verification');
    } finally {
      setIsSubmittingUtr(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <WalletIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Legal Workspace Wallet</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Exact Ledger
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Deposit funds to process automated bank title scrutiny & OCR analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Card Banner */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Available Balance</span>
            <div className="text-2xl font-black text-white flex items-baseline gap-1 mt-0.5">
              <span className="text-amber-400 font-serif">₹</span>
              <span>
                {summary ? summary.wallet_balance.toFixed(2) : user?.wallet_balance !== undefined ? Number(user.wallet_balance).toFixed(2) : '0.00'}
              </span>
              <span className="text-xs font-semibold text-slate-400 ml-1">INR</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchSummary();
                fetchHistoryData();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh Balance"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('add_money')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'add_money'
                ? 'border-amber-400 text-amber-300 bg-amber-400/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4 text-amber-400" />
            <span>UPI Instant Pay</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'payments'
                ? 'border-indigo-400 text-indigo-300 bg-indigo-400/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Payment History</span>
            {paymentsHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {paymentsHistory.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'transactions'
                ? 'border-purple-400 text-purple-300 bg-purple-400/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Wallet Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('manual_utr')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'manual_utr'
                ? 'border-slate-400 text-slate-200 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Manual UTR</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: ADD MONEY (VERIFIED PAYMENT GATEWAY) */}
          {activeTab === 'add_money' && (
            <div className="space-y-6">
              {!activePayment ? (
                /* Step 1: Amount & Gateway Selection */
                <form onSubmit={handleStartDeposit} className="space-y-6">
                  {/* Amount Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">Select Top-Up Amount</label>
                    <div className="grid grid-cols-5 gap-2">
                      {presetAmounts.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setSelectedAmount(amt);
                            setCustomAmount('');
                          }}
                          className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            !customAmount && selectedAmount === amt
                              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/20 font-black'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700/80'
                          }`}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>

                    <div className="relative mt-2">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-serif text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="Or enter custom amount (e.g. 750)"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        min={10}
                        max={100000}
                        className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Payment Channel Selection: Strictly UPI */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">Payment Method</label>
                    <div className="p-4 rounded-2xl border bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-950 border-amber-400/50 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
                          <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">Unified Payments Interface (UPI)</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Instant &bull; Zero Fee
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Google Pay, PhonePe, Paytm, BHIM, CRED, or scan QR code
                          </p>
                        </div>
                      </div>
                      <div className="hidden sm:block text-right">
                        <span className="text-[10px] font-bold text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                          Only UPI Accepted
                        </span>
                      </div>
                    </div>
                  </div>

                  {paymentError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isInitiatingPayment || currentAmount < 10}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isInitiatingPayment ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Generating Secure UPI QR...</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4 text-slate-950" />
                        <span>Generate UPI QR Code & Pay ₹{currentAmount.toFixed(2)}</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>256-bit encrypted • Independent backend provider verification</span>
                  </div>
                </form>
              ) : (
                /* Step 2: Payment Processing & Live Verification */
                <div className="space-y-6">
                  {/* Order Overview Header */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">{activePayment.payment_id}</span>
                        <button
                          onClick={() => handleCopyPaymentId(activePayment.payment_id)}
                          className="text-slate-400 hover:text-white"
                          title="Copy Payment ID"
                        >
                          {copiedPaymentId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-400">Order ID: {activePayment.provider_order_id || 'N/A'}</span>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-amber-400 font-serif">₹{activePayment.amount.toFixed(2)}</div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{activePayment.provider}</span>
                    </div>
                  </div>

                  {/* Verification Status Display */}
                  {paymentStatus?.status === 'SUCCESS' ? (
                    <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-white">Payment Verified & Credited!</h3>
                      <p className="text-xs text-slate-300">
                        ₹{activePayment.amount.toFixed(2)} has been independently verified by the payment provider and added to your wallet.
                      </p>
                      <div className="inline-block px-4 py-2 bg-slate-900 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-300">
                        New Balance: ₹{paymentStatus.wallet_balance.toFixed(2)}
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={handleResetActivePayment}
                          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : paymentStatus?.status === 'FAILED' ? (
                    <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-white">Payment Could Not Be Verified</h3>
                      <p className="text-xs text-rose-300">
                        {paymentStatus.error_message || 'The payment provider reported an error. Your wallet has NOT been credited.'}
                      </p>
                      <button
                        onClick={handleResetActivePayment}
                        className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    /* In-Progress / Awaiting Confirmation */
                    <div className="space-y-6">
                      <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center gap-3">
                        <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-indigo-200">Payment Processing...</h4>
                          <p className="text-[11px] text-indigo-300/80">
                            Do not close this window. We are actively polling the provider for independent payment verification.
                          </p>
                        </div>
                      </div>

                      {/* Payment Action: Strictly UPI */}
                      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                        <p className="text-xs font-bold text-slate-300">
                          Scan with Google Pay, PhonePe, Paytm, BHIM, or CRED:
                        </p>

                        {/* Dynamic QR Display */}
                        <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl flex items-center justify-center shadow-xl">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                              activePayment.qr_data || `upi://pay?pa=${activeVpa}&pn=${activePayeeName}&am=${activePayment.amount}&tr=${activePayment.payment_id}&cu=INR`
                            )}`}
                            alt="UPI QR Code"
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-3">
                          {activePayment.checkout_url && (
                            <a
                              href={activePayment.checkout_url}
                              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open UPI App</span>
                            </a>
                          )}
                          <button
                            onClick={handleCopyVpa}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            {copiedVpa ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedVpa ? 'Copied VPA' : 'Copy UPI ID'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <button
                          onClick={handleResetActivePayment}
                          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Cancel Order</span>
                        </button>
                        <span className="text-[11px] text-slate-500">
                          {isPolling ? 'Listening for webhook confirmation...' : 'Status checks paused'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: USER PAYMENT HISTORY */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Payment Gateway Records</span>
                <span className="text-[11px] text-slate-400">Total: {paymentsHistory.length}</span>
              </div>

              {paymentsHistory.length === 0 ? (
                <div className="p-8 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-2">
                  <QrCode className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">No UPI payment records found yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentsHistory.map((pmt) => (
                    <div
                      key={pmt.id}
                      className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            pmt.status === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : pmt.status === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {pmt.status === 'SUCCESS' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : pmt.status === 'FAILED' ? (
                            <AlertCircle className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">₹{pmt.amount.toFixed(2)}</span>
                            <span className="text-[10px] font-mono text-slate-400">{pmt.id}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            {new Date(pmt.created_at).toLocaleString()} • {pmt.provider.toUpperCase()} ({pmt.method})
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            pmt.status === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : pmt.status === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {pmt.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WALLET LEDGER TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Auditable Balance Ledger</span>
                <span className="text-[11px] text-slate-400">
                  Total Transactions: {summary?.transactions_count || 0}
                </span>
              </div>

              {!summary?.recent_transactions || summary.recent_transactions.length === 0 ? (
                <div className="p-8 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-2">
                  <WalletIcon className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">No transactions recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {summary.recent_transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            tx.type === 'WALLET_CREDIT'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {tx.type === 'WALLET_CREDIT' ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <span className="text-xs font-bold text-white block">{tx.description}</span>
                          <span className="text-[10px] text-slate-500 block">
                            {new Date(tx.created_at).toLocaleString()} • Ref: {tx.reference_id || tx.id}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-bold block ${
                            tx.type === 'WALLET_CREDIT' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {tx.type === 'WALLET_CREDIT' ? '+' : '-'}₹{Math.abs(tx.amount).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Bal: ₹{tx.balance_after.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MANUAL BANK UTR VERIFICATION */}
          {activeTab === 'manual_utr' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-slate-300 block">Bank Direct Transfer Coordinates</span>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>UPI ID / VPA:</span>
                  <div className="flex items-center gap-1 font-mono text-white">
                    <span>{activeVpa}</span>
                    <button onClick={handleCopyVpa} className="text-slate-400 hover:text-white">
                      {copiedVpa ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Payee Name:</span>
                  <span className="text-white font-medium">{activePayeeName}</span>
                </div>
              </div>

              {utrSuccess ? (
                <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Proof Submitted for Review</h4>
                  <p className="text-xs text-slate-300">{utrSuccess.message}</p>
                  <button
                    onClick={() => setUtrSuccess(null)}
                    className="mt-3 px-4 py-1.5 bg-slate-800 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Submit Another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitVerification} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">12-Digit Bank UTR / Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. 425182910394"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      required
                      minLength={6}
                      maxLength={100}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">Optional Sender Remarks</label>
                    <input
                      type="text"
                      placeholder="e.g. Transferred via HDFC netbanking"
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      maxLength={255}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {utrError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{utrError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmittingUtr}
                    className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isSubmittingUtr ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting Proof...</span>
                      </>
                    ) : (
                      <span>Submit Bank Reference for Verification</span>
                    )}
                  </button>
                </form>
              )}

              {verifications.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-300 block">Submitted Bank References</span>
                  <div className="space-y-2">
                    {verifications.map((v) => (
                      <div key={v.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono text-white block">UTR: {v.utr_number}</span>
                          <span className="text-[10px] text-slate-400">₹{v.amount.toFixed(2)} • {new Date(v.created_at).toLocaleDateString()}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          v.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : v.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {v.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
