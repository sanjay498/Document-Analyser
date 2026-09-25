import React, { useState, useEffect } from 'react';
import {
  Wallet as WalletIcon,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  FileCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import type {
  UserProfile,
  WalletSummary,
  PaymentConfig,
  PaymentVerificationItem
} from '../types';
import {
  getWalletSummary,
  getPaymentConfig,
  submitPaymentVerification,
  getUserVerifications
} from '../services/api';
import { HistoryEmptyIllustration } from './illustrations/LegalIllustrations';

interface WalletViewProps {
  user: UserProfile | null;
  onNavigateToWorkspace: () => void;
  onBalanceUpdated?: (newBalance: number) => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  user,
  onNavigateToWorkspace,
  onBalanceUpdated,
}) => {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [verifications, setVerifications] = useState<PaymentVerificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [copiedVpa, setCopiedVpa] = useState<boolean>(false);

  // Manual Bank UTR Form State
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [utrAmount, setUtrAmount] = useState<string>('500');
  const [userNotes, setUserNotes] = useState<string>('');
  const [isSubmittingUtr, setIsSubmittingUtr] = useState<boolean>(false);
  const [utrSuccessMsg, setUtrSuccessMsg] = useState<string | null>(null);
  const [utrErrorMsg, setUtrErrorMsg] = useState<string | null>(null);

  const presetAmounts = [250, 500, 1000, 2500, 5000];

  const fetchWalletData = async () => {
    setIsLoading(true);
    try {
      const [sum, cfg, verifs] = await Promise.all([
        getWalletSummary().catch(() => null),
        getPaymentConfig().catch(() => null),
        getUserVerifications().catch(() => [])
      ]);

      if (sum) {
        setSummary(sum);
        if (onBalanceUpdated) onBalanceUpdated(sum.wallet_balance);
      }
      if (cfg) setPaymentConfig(cfg);
      if (verifs) setVerifications(verifs);
    } catch (err) {
      console.error('Failed to load wallet data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const effectiveAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;
  const upiVpa = paymentConfig?.upi_vpa || 'lextitle.billing@icici';
  const upiPayee = paymentConfig?.upi_payee_name || 'LexTitle AI Legal Systems';

  // Construct standard UPI intent link
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(upiPayee)}&am=${effectiveAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('LexTitle Scrutiny Credits')}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiIntentUri)}`;

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(upiVpa);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setUtrErrorMsg(null);
    setUtrSuccessMsg(null);

    const amt = parseFloat(utrAmount);
    if (!amt || amt <= 0) {
      setUtrErrorMsg('Please enter a valid deposit amount (e.g. ₹500)');
      return;
    }
    if (!utrNumber || utrNumber.trim().length < 8) {
      setUtrErrorMsg('Please enter a valid 12-digit Bank UTR / Transaction Reference number');
      return;
    }

    setIsSubmittingUtr(true);
    try {
      const res = await submitPaymentVerification(amt, 'upi', utrNumber.trim(), userNotes.trim());
      setUtrSuccessMsg(res.message || 'UTR reference submitted successfully. Balance will update once verified.');
      setUtrNumber('');
      setUserNotes('');
      fetchWalletData();
    } catch (err: any) {
      setUtrErrorMsg(err.message || 'Failed to submit UTR verification.');
    } finally {
      setIsSubmittingUtr(false);
    }
  };

  const balance = summary?.wallet_balance ?? user?.wallet_balance ?? 0.0;
  const transactions = summary?.recent_transactions || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToWorkspace}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Workspace</span>
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-xs text-amber-400 font-semibold">User Wallet</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <WalletIcon className="w-6 h-6 text-amber-400" />
            <span>Account Wallet & Billing</span>
          </h1>
          <p className="text-xs text-slate-400">
            Institutional UPI top-ups, zero-fee trial status, and real-time transaction ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWalletData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-[#0b0f19] hover:bg-slate-800/60 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            title="Refresh balance and ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onNavigateToWorkspace}
            className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
          >
            Back to Workspace
          </button>
        </div>
      </div>

      {/* Free Mode Notice Banner */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs">
          <div className="font-semibold text-emerald-300">
            Free Beta Access Active — No Payment Required
          </div>
          <p className="text-slate-400 leading-relaxed">
            All AI title scrutiny extractions, conflict comparisons, and Word (.docx) / PDF opinion generations are currently set to <strong className="text-emerald-400">₹0.00</strong> fee. You will never be blocked by a paywall or asked for money right now.
          </p>
        </div>
      </div>

      {/* Balance Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Main Balance Card */}
        <div className="rounded-2xl border border-slate-800 bg-[#0b0f19] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Available Balance</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Account active" />
          </div>
          <div className="text-3xl font-bold font-mono text-white tracking-tight">
            ₹{balance.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Live verified balance</span>
          </div>
        </div>

        {/* Total Lifetime Scrutinies */}
        <div className="rounded-2xl border border-slate-800 bg-[#0b0f19] p-5 space-y-2">
          <div className="text-xs text-slate-400 font-medium">Total Lifetime Scrutinies</div>
          <div className="text-2xl font-bold font-mono text-slate-200">
            {summary?.transactions_count ?? transactions.length}
          </div>
          <div className="text-[11px] text-slate-400">
            Audited ledger transactions
          </div>
        </div>

        {/* Current Fee */}
        <div className="rounded-2xl border border-slate-800 bg-[#0b0f19] p-5 space-y-2">
          <div className="text-xs text-slate-400 font-medium">Current Scrutiny Fee</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            ₹0.00 <span className="text-xs font-normal text-slate-400">/ doc</span>
          </div>
          <div className="text-[11px] text-emerald-400/80">
            100% Free during test preview
          </div>
        </div>
      </div>

      {/* Main Two-Column Payment Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: UPI QR & VPA */}
        <div className="rounded-2xl border border-slate-800 bg-[#0b0f19] p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Instant UPI Top-Up</span>
            </h2>
            <p className="text-xs text-slate-400">
              Scan with any UPI app (Google Pay, PhonePe, Paytm, BHIM)
            </p>
          </div>

          {/* Amount Preset Chips */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Select Amount</label>
            <div className="flex flex-wrap gap-2">
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amt);
                    setCustomAmount('');
                    setUtrAmount(String(amt));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    selectedAmount === amt && !customAmount
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm shadow-amber-400/20'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic QR Display */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border border-slate-800/80 bg-[#070a13]">
            <div className="p-2 bg-white rounded-lg shadow shrink-0">
              <img
                src={qrCodeUrl}
                alt="UPI QR Code"
                className="w-36 h-36 object-contain"
              />
            </div>
            <div className="space-y-3 text-center sm:text-left">
              <div>
                <div className="text-xs text-slate-400">Payee UPI ID</div>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                  <span className="font-mono text-xs font-semibold text-amber-300 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                    {upiVpa}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyVpa}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title="Copy UPI ID"
                  >
                    {copiedVpa ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-slate-400">
                Amount: <strong className="text-white font-mono">₹{effectiveAmount.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Manual Bank UTR Submission */}
        <div className="rounded-2xl border border-slate-800 bg-[#0b0f19] p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Verify Bank UTR / Reference</span>
            </h2>
            <p className="text-xs text-slate-400">
              Already made a UPI transfer? Enter the 12-digit reference for credit.
            </p>
          </div>

          <form onSubmit={handleSubmitUtr} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                12-Digit Bank UTR / Transaction Ref No.
              </label>
              <input
                type="text"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="e.g. 523489120491"
                className="w-full px-3 py-2 rounded-lg bg-[#070a13] border border-slate-800 focus:border-amber-400 text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Amount Transferred (₹ INR)
              </label>
              <input
                type="number"
                value={utrAmount}
                onChange={(e) => setUtrAmount(e.target.value)}
                placeholder="500"
                className="w-full px-3 py-2 rounded-lg bg-[#070a13] border border-slate-800 focus:border-amber-400 text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Notes / Remitter Name (Optional)
              </label>
              <input
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="e.g. Paid via GPay from Adv. Ramesh"
                className="w-full px-3 py-2 rounded-lg bg-[#070a13] border border-slate-800 focus:border-amber-400 text-xs text-white placeholder-slate-600 focus:outline-none"
              />
            </div>

            {utrErrorMsg && (
              <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{utrErrorMsg}</span>
              </div>
            )}

            {utrSuccessMsg && (
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{utrSuccessMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingUtr}
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmittingUtr ? 'Submitting UTR Verification...' : 'Submit UTR for Verification'}
            </button>
          </form>
        </div>
      </div>

      {/* Pending UTR Verifications (if any) */}
      {verifications.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-[#0b0f19] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Submitted Bank UTR Verifications</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">{verifications.length} submitted</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 bg-[#070a13]">
                <tr>
                  <th className="py-2 px-3">UTR Reference</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {verifications.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-mono text-amber-300">{v.utr_number}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">₹{v.amount.toFixed(2)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        v.status === 'verified'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : v.status === 'rejected'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                      {new Date(v.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom Section: Transaction Ledger */}
      <div className="rounded-2xl border border-slate-800 bg-[#0b0f19] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Audited Transactions & Ledger</span>
            </h2>
            <p className="text-xs text-slate-400">
              Complete verifiable history of deposits and scrutiny operations
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {transactions.length} entries
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
            <HistoryEmptyIllustration size={70} className="opacity-70" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-300">No Transactions Yet</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Deposits, UTR submissions, and document scrutiny activities will be permanently audited here.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 bg-[#070a13]">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Type</th>
                  <th className="py-2.5 px-3 font-medium">Description</th>
                  <th className="py-2.5 px-3 font-medium">Amount</th>
                  <th className="py-2.5 px-3 font-medium">Balance After</th>
                  <th className="py-2.5 px-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {transactions.map((tx: any) => {
                  const isCredit = tx.amount > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 font-semibold ${
                          isCredit ? 'text-emerald-400' : 'text-slate-300'
                        }`}>
                          {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3 text-slate-500" />}
                          {isCredit ? 'Deposit' : 'Spend'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {tx.description || 'Document Synthesis'}
                      </td>
                      <td className={`py-2.5 px-3 font-mono font-bold ${
                        isCredit ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {isCredit ? `+₹${Math.abs(tx.amount).toFixed(2)}` : `-₹${Math.abs(tx.amount).toFixed(2)}`}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        ₹{(tx.balance_after ?? 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        {tx.created_at ? new Date(tx.created_at).toLocaleString() : 'Recent'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
