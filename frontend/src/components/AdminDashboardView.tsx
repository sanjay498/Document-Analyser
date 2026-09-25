import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  QrCode,
  FileText,
  Shield,
  Settings,
  LogOut,
  Search,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  Download,
  Eye,
  Sliders,
  Menu,
  X,
  Wallet,
  Activity,
  Lock,
  Key,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

import type {
  UserProfile,
  AdminMetrics,
  AdminUserItem,
  AdminUserDetail,
  AdminDocumentItem,
  AdminDocumentDetail,
  PricingConfig,
  PaymentVerificationItem,
  UpiSettings,
  AuditLogItem
} from '../types';
import {
  getAdminMetrics,
  getAdminUsers,
  getAdminUserDetail,
  adjustUserWallet,
  toggleUserStatus,
  getAdminPricing,
  updateAdminPricing,
  getAdminVerifications,
  verifyPayment,
  rejectPayment,
  getAdminUpiSettings,
  updateAdminUpiSettings,
  uploadQrCode,
  removeQrCode,
  getAuditLogs,
  switchToAdmin,
  adminLogout,
  getAdminDocuments,
  getAdminDocumentDetail,
  downloadAdminDocument
} from '../services/api';

interface AdminDashboardViewProps {
  user: UserProfile | null;
  onNavigateToWorkspace: () => void;
  onLoginSuccess?: (user: UserProfile) => void;
  onSwitchToUser?: () => void;
  showToast?: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  onNavigateToWorkspace,
  onLoginSuccess,
  onSwitchToUser,
  showToast,
}) => {
  // Navigation Section (Sidebar)
  const [activeSection, setActiveSection] = useState<
    'overview' | 'users' | 'wallet' | 'payments' | 'upi' | 'documents' | 'audit' | 'settings'
  >('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // General Loading & Metrics
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);

  // Section 1: Overview Chart
  const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(null);

  // Section 2: Users Management
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [usersFilter, setUsersFilter] = useState<'clients' | 'all' | 'active' | 'suspended'>('clients');
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<AdminUserDetail | null>(null);
  const [statusModalUser, setStatusModalUser] = useState<AdminUserItem | null>(null);
  const [statusModalReason, setStatusModalReason] = useState<string>('');
  const [isProcessingStatus, setIsProcessingStatus] = useState<boolean>(false);

  // Section 3: Wallet Management
  const [walletTargetUser, setWalletTargetUser] = useState<AdminUserItem | null>(null);
  const [walletUserSearch, setWalletUserSearch] = useState<string>('');
  const [walletAction, setWalletAction] = useState<'add' | 'deduct'>('add');
  const [walletAmount, setWalletAmount] = useState<string>('');
  const [walletReason, setWalletReason] = useState<string>('');
  const [walletReference, setWalletReference] = useState<string>('');
  const [isWalletConfirmOpen, setIsWalletConfirmOpen] = useState<boolean>(false);
  const [isProcessingWallet, setIsProcessingWallet] = useState<boolean>(false);

  // Section 4: Payments
  const [verifications, setVerifications] = useState<PaymentVerificationItem[]>([]);
  const [verificationsFilter, setVerificationsFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending');
  const [selectedVerificationForAction, setSelectedVerificationForAction] = useState<PaymentVerificationItem | null>(null);
  const [verificationActionType, setVerificationActionType] = useState<'verify' | 'reject' | null>(null);
  const [verificationActionReason, setVerificationActionReason] = useState<string>('');
  const [isProcessingVerAction, setIsProcessingVerAction] = useState<boolean>(false);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Section 5: Payment Configuration (UPI / QR)
  const [upiSettings, setUpiSettings] = useState<UpiSettings>({
    upi_vpa: 'lextitle.billing@icici',
    upi_payee_name: 'LexTitle AI Legal Systems',
    upi_qr_image_url: '',
    payment_verification_mode: 'manual_admin',
    min_deposit_amount: 10,
    max_deposit_amount: 100000
  });
  const [isSavingUpi, setIsSavingUpi] = useState<boolean>(false);
  const [isUploadingQr, setIsUploadingQr] = useState<boolean>(false);

  // Section 6: Document History
  const [documents, setDocuments] = useState<AdminDocumentItem[]>([]);
  const [documentSearch, setDocumentSearch] = useState<string>('');
  const [documentStatusFilter, setDocumentStatusFilter] = useState<'all' | 'completed' | 'failed'>('all');
  const [selectedDocumentDetail, setSelectedDocumentDetail] = useState<AdminDocumentDetail | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Section 7: Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [selectedLogDetail, setSelectedLogDetail] = useState<AuditLogItem | null>(null);

  // Section 8: Settings (Pricing)
  const [pricingForm, setPricingForm] = useState<Partial<PricingConfig>>({});
  const [isSavingPricing, setIsSavingPricing] = useState<boolean>(false);

  // Admin Login Form State
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  // Load all admin data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [m, u, p, vList, upi, aLogs, docs] = await Promise.all([
        getAdminMetrics().catch(() => null),
        getAdminUsers(userSearchQuery || undefined, usersFilter === 'active' || usersFilter === 'suspended' ? usersFilter : undefined).catch(() => []),
        getAdminPricing().catch(() => null),
        getAdminVerifications().catch(() => []),
        getAdminUpiSettings().catch(() => null),
        getAuditLogs(100).catch(() => []),
        getAdminDocuments({ search: documentSearch, status: documentStatusFilter }).catch(() => [])
      ]);

      if (m) setMetrics(m);
      if (u) setUsersList(u);
      if (p) {
        setPricingForm({
          doc_generation_fee: p.doc_generation_fee,
          ocr_per_page_fee: p.ocr_per_page_fee,
          signup_bonus: p.signup_bonus,
        });
      }
      if (vList) setVerifications(vList);
      if (upi) setUpiSettings(upi);
      if (aLogs) setAuditLogs(aLogs);
      if (docs) setDocuments(docs);
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to load admin management data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.is_admin) {
      loadData();
    }
  }, [user?.is_admin]);

  // Handle dedicated Admin Login or Password-only Switch
  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adminPassword) return;
    setAdminLoginError(null);
    setIsAdminLoggingIn(true);
    try {
      const res = await switchToAdmin(adminPassword);
      if (!res.user.is_admin) {
        setAdminLoginError('This account does not have administrative privileges.');
        return;
      }
      if (onLoginSuccess) {
        onLoginSuccess(res.user);
      }
      if (showToast) showToast('Authenticated as Administrator.', 'success');
      await loadData();
    } catch (err: any) {
      setAdminLoginError(err.message || 'Authentication failed. Please verify administrator password.');
    } finally {
      setIsAdminLoggingIn(false);
    }
  };

  // Handle Admin Logout
  const handleAdminLogout = async () => {
    if (!confirm('Are you sure you want to log out of the Administrator Portal?')) return;
    try {
      await adminLogout();
      if (showToast) showToast('Administrator session invalidated.', 'info');
      window.location.href = '/management';
    } catch (err: any) {
      window.location.reload();
    }
  };

  // Section 2: User Status (Suspend/Activate)
  const handleOpenStatusModal = (u: AdminUserItem) => {
    setStatusModalUser(u);
    setStatusModalReason('');
  };

  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalUser) return;
    if (!statusModalReason.trim() || statusModalReason.trim().length < 3) {
      if (showToast) showToast('Please enter an audit reason (minimum 3 characters).', 'error');
      return;
    }
    const newStatus = !statusModalUser.is_active;
    const actionLabel = newStatus ? 'activated' : 'suspended';
    setIsProcessingStatus(true);
    try {
      await toggleUserStatus(statusModalUser.id, newStatus, statusModalReason.trim());
      if (showToast) showToast(`User account ${actionLabel} successfully.`, 'success');
      setStatusModalUser(null);
      setStatusModalReason('');
      await loadData();
    } catch (err: any) {
      if (showToast) showToast(err.message || `Failed to update user status`, 'error');
    } finally {
      setIsProcessingStatus(false);
    }
  };

  // View User Full Details
  const handleViewUserDetails = async (userId: string) => {
    try {
      const detail = await getAdminUserDetail(userId);
      setSelectedUserForDetails(detail);
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to load user details', 'error');
    }
  };

  // Section 3: Wallet Management Flow
  const handleSelectUserForWallet = (u: AdminUserItem) => {
    setWalletTargetUser(u);
    setWalletAmount('');
    setWalletReason('');
    setWalletReference('');
    setActiveSection('wallet');
  };

  // Pre-validate before opening confirmation modal
  const handlePrepareWalletAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletTargetUser) {
      if (showToast) showToast('Please select a target user.', 'error');
      return;
    }
    const amt = parseFloat(walletAmount);
    if (isNaN(amt) || amt <= 0) {
      if (showToast) showToast('Please enter a valid amount greater than ₹0.00.', 'error');
      return;
    }
    if (!walletReason.trim() || walletReason.trim().length < 5) {
      if (showToast) showToast('An audit reason of at least 5 characters is mandatory.', 'error');
      return;
    }

    // Negative balance check
    if (walletAction === 'deduct') {
      const curBal = walletTargetUser.wallet_balance ?? 0;
      if (curBal < amt) {
        if (showToast) showToast(`Insufficient wallet balance. Cannot debit ₹${amt.toFixed(2)}; available balance is ₹${curBal.toFixed(2)}.`, 'error');
        return;
      }
    }

    setIsWalletConfirmOpen(true);
  };

  // Execute confirmed wallet adjustment
  const handleConfirmWalletAdjustment = async () => {
    if (!walletTargetUser) return;
    const amt = parseFloat(walletAmount);
    setIsProcessingWallet(true);
    try {
      await adjustUserWallet(
        walletTargetUser.id,
        walletAction,
        amt,
        walletReason.trim(),
        walletReference.trim() || undefined
      );
      if (showToast) showToast(`Successfully adjusted wallet for ${walletTargetUser.email}.`, 'success');
      setIsWalletConfirmOpen(false);
      setWalletAmount('');
      setWalletReason('');
      setWalletReference('');
      await loadData();
      // Refresh target user balance
      const updatedUser = usersList.find((u) => u.id === walletTargetUser.id);
      if (updatedUser) setWalletTargetUser(updatedUser);
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to apply wallet adjustment.', 'error');
    } finally {
      setIsProcessingWallet(false);
    }
  };

  // Section 4: Payment Verification & Rejection
  const handleVerifyPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVerificationForAction) return;
    setIsProcessingVerAction(true);
    try {
      await verifyPayment(selectedVerificationForAction.id, verificationActionReason.trim() || undefined);
      if (showToast) showToast(`Payment of ₹${selectedVerificationForAction.amount.toFixed(2)} verified and credited!`, 'success');
      setSelectedVerificationForAction(null);
      setVerificationActionType(null);
      setVerificationActionReason('');
      await loadData();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to verify payment', 'error');
    } finally {
      setIsProcessingVerAction(false);
    }
  };

  const handleRejectPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVerificationForAction) return;
    if (!verificationActionReason.trim() || verificationActionReason.trim().length < 3) {
      if (showToast) showToast('Please enter a rejection reason (minimum 3 characters).', 'error');
      return;
    }
    setIsProcessingVerAction(true);
    try {
      await rejectPayment(selectedVerificationForAction.id, verificationActionReason.trim());
      if (showToast) showToast('Payment verification marked as rejected.', 'info');
      setSelectedVerificationForAction(null);
      setVerificationActionType(null);
      setVerificationActionReason('');
      await loadData();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to reject payment', 'error');
    } finally {
      setIsProcessingVerAction(false);
    }
  };

  // Copy UTR helper
  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  // Section 5: Payment Settings & QR
  const handleSaveUpiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const vpa = upiSettings.upi_vpa.trim();
    if (!/^[\w\.\-]+@[\w\.\-]+$/.test(vpa)) {
      if (showToast) showToast('Invalid UPI VPA format (e.g. merchant@icici or user@upi).', 'error');
      return;
    }
    if (!upiSettings.upi_payee_name.trim()) {
      if (showToast) showToast('Payee name is required.', 'error');
      return;
    }
    setIsSavingUpi(true);
    try {
      await updateAdminUpiSettings(upiSettings);
      if (showToast) showToast('Payment configuration updated successfully.', 'success');
      await loadData();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to save UPI settings', 'error');
    } finally {
      setIsSavingUpi(false);
    }
  };

  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      if (showToast) showToast('QR image exceeds 5MB size limit', 'error');
      return;
    }
    setIsUploadingQr(true);
    try {
      const res = await uploadQrCode(file);
      setUpiSettings((prev) => ({ ...prev, upi_qr_image_url: res.qr_image_url }));
      if (showToast) showToast('QR Code uploaded and configured successfully', 'success');
      await loadData();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to upload QR image', 'error');
    } finally {
      setIsUploadingQr(false);
    }
  };

  const handleRemoveQrCode = async () => {
    if (!confirm('Revert to dynamic QR code and remove uploaded image?')) return;
    try {
      await removeQrCode();
      setUpiSettings((prev) => ({ ...prev, upi_qr_image_url: '' }));
      if (showToast) showToast('Custom QR code removed', 'success');
      await loadData();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to remove QR code', 'error');
    }
  };

  // Section 6: Document Details & Download
  const handleViewDocDetail = async (docId: string) => {
    try {
      const detail = await getAdminDocumentDetail(docId);
      setSelectedDocumentDetail(detail);
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to load document details', 'error');
    }
  };

  const handleDownloadDoc = async (docId: string, filename: string) => {
    setDownloadingDocId(docId);
    try {
      await downloadAdminDocument(docId, filename);
      if (showToast) showToast(`Downloaded ${filename}`, 'success');
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to download document', 'error');
    } finally {
      setDownloadingDocId(null);
    }
  };

  // Section 8: Platform Pricing Settings
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPricing(true);
    try {
      await updateAdminPricing(pricingForm);
      if (showToast) showToast('Platform fee configuration updated successfully.', 'success');
      await loadData();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to update pricing rules', 'error');
    } finally {
      setIsSavingPricing(false);
    }
  };

  // ---------------- SEPARATE ADMIN LOGIN SCREEN ----------------
  if (!user?.is_admin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gradient-to-b from-[#0f172a] via-[#090d16] to-[#040711] border border-slate-700/80 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 p-0.5 shadow-xl shadow-amber-500/20 mx-auto flex items-center justify-center text-amber-400">
              <Shield className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Switch to Admin Portal</h2>
            <p className="text-xs text-slate-400">
              Enter your master administrator password to unlock management privileges.
            </p>
          </div>

          {/* Error Message */}
          {adminLoginError && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{adminLoginError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Administrator Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoFocus
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900/90 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAdminLoggingIn || !adminPassword}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isAdminLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Password...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Switch to Admin Mode
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onNavigateToWorkspace}
              className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to User Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- AUTHENTICATED PRODUCTION ADMIN PORTAL ----------------
  const chartData = metrics?.charts?.daily_trends || [];
  const maxVal = Math.max(...chartData.map((d) => Math.max(d.deposits, d.spends)), 10);
  const pendingCount = metrics?.counts?.pending_verifications ?? verifications.filter((v) => v.status === 'PENDING' || v.status === 'pending').length;

  const filteredUsers = usersList.filter((u) => {
    if (usersFilter === 'clients' && (u.is_admin || u.role === 'ADMIN')) return false;
    if (usersFilter === 'active' && (u.is_active === false || u.is_admin || u.role === 'ADMIN')) return false;
    if (usersFilter === 'suspended' && (u.is_active !== false || u.is_admin || u.role === 'ADMIN')) return false;
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase().trim();
      const match =
        (u.name || u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.mobile || '').includes(q);
      if (!match) return false;
    }
    return true;
  });

  const filteredVerifications = verifications.filter((v) => {
    if (verificationsFilter === 'all') return true;
    return (v.status || '').toLowerCase() === verificationsFilter.toLowerCase();
  });

  const filteredDocs = documents.filter((d) => {
    if (documentStatusFilter === 'all') return true;
    return (d.status || '').toLowerCase() === documentStatusFilter.toLowerCase();
  });

  const filteredLogs = auditLogs.filter((l) => {
    if (auditActionFilter !== 'all' && l.action !== auditActionFilter) return false;
    if (auditSearch) {
      const q = auditSearch.toLowerCase();
      const match =
        l.action.toLowerCase().includes(q) ||
        (l.admin_email || '').toLowerCase().includes(q) ||
        (l.target_type || '').toLowerCase().includes(q) ||
        (l.ip_address || '').includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[85vh] animate-fadeIn pb-12">
      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-bold text-white">Admin Management</span>
        </div>
        <button
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="p-2 bg-slate-800 rounded-lg text-slate-300"
        >
          {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ---------------- SIDEBAR NAVIGATION (Section 28) ---------------- */}
      <aside
        className={`w-full md:w-64 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shrink-0 shadow-xl ${
          isMobileSidebarOpen ? 'block' : 'hidden md:flex'
        }`}
      >
        <div className="space-y-6">
          {/* Admin Identity Header */}
          <div className="pb-4 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-md">
              <div className="w-full h-full bg-[#0b0f19] rounded-[9px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-white truncate">LexTitle Admin</h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => { setActiveSection('overview'); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'overview'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${activeSection === 'overview' ? 'text-white' : ''}`} />
            </button>

            <button
              onClick={() => { setActiveSection('users'); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'users'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>Users</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {metrics?.counts?.regular_users ?? usersList.filter((u) => !u.is_admin && u.role !== 'ADMIN').length}
              </span>
            </button>

            <button
              onClick={() => { setActiveSection('wallet'); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'wallet'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4" />
                <span>Wallet Management</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${activeSection === 'wallet' ? 'text-white' : ''}`} />
            </button>

            <button
              onClick={() => { setActiveSection('payments'); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'payments'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Receipt className="w-4 h-4" />
                <span>Payments</span>
              </div>
              {pendingCount > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                  {pendingCount}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => { setActiveSection('upi'); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'upi'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <QrCode className="w-4 h-4" />
                <span>Payment Configuration</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${activeSection === 'upi' ? 'text-white' : ''}`} />
            </button>

            <button
              onClick={() => { setActiveSection('documents'); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'documents'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4" />
                <span>Document History</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {metrics?.counts?.total_documents ?? documents.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveSection('audit'); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'audit'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4" />
                <span>Audit Logs</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${activeSection === 'audit' ? 'text-white' : ''}`} />
            </button>

            <button
              onClick={() => { setActiveSection('settings'); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'settings'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${activeSection === 'settings' ? 'text-white' : ''}`} />
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
          {onSwitchToUser ? (
            <button
              onClick={onSwitchToUser}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 hover:text-white transition-all cursor-pointer shadow-sm"
              title="Switch back to User Workspace"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" /> Switch to User Workspace
            </button>
          ) : (
            <button
              onClick={onNavigateToWorkspace}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Workspace
            </button>
          )}
          <button
            onClick={handleAdminLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Logout Administrator
          </button>
        </div>
      </aside>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <main className="flex-1 space-y-6 min-w-0">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <div>
            <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              {activeSection === 'overview' && 'System Overview & Platform Telemetry'}
              {activeSection === 'users' && 'User Management & Authorization'}
              {activeSection === 'wallet' && 'Audited User Wallet Adjustments'}
              {activeSection === 'payments' && 'Payment Verification Queue'}
              {activeSection === 'upi' && 'Payment & UPI Scanner Configuration'}
              {activeSection === 'documents' && 'Persistent Document Generation History'}
              {activeSection === 'audit' && 'Immutable Platform Audit Ledger'}
              {activeSection === 'settings' && 'Platform Fee & Pricing Configuration'}
            </h1>
            <p className="text-xs text-slate-400">
              {activeSection === 'overview' && 'Real-time telemetry, user statistics, financial float liabilities, and generation throughput'}
              {activeSection === 'users' && 'Manage registered accounts, view wallet balances, inspect document activity, and adjust active status'}
              {activeSection === 'wallet' && 'Perform explicit, audited balance credits or debits with mandatory pre-confirmation'}
              {activeSection === 'payments' && 'Audit incoming Bank UTR numbers and confirm or reject user payment claims'}
              {activeSection === 'upi' && 'Configure merchant UPI VPA, Payee Name, deposit limits, and custom QR scan asset'}
              {activeSection === 'documents' && 'Complete audit history of legal documents generated with metadata and docx download'}
              {activeSection === 'audit' && 'Cryptographically recorded security, authentication, and management actions'}
              {activeSection === 'settings' && 'Configure document synthesis fee and OCR per-page pricing rules'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToUser && (
              <button
                onClick={onSwitchToUser}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 hover:text-white transition-all shadow-sm cursor-pointer"
                title="Exit Administrator mode and switch back to User Workspace"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>Switch to User Mode</span>
              </button>
            )}
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ---------------- SECTION 1: OVERVIEW (DASHBOARD) ---------------- */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Top 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Users Stat Card */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Total Client Users</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">
                    {metrics?.counts?.regular_users ?? 0}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400">
                    {Math.max(0, (metrics?.counts?.regular_users ?? 0) - (metrics?.counts?.suspended_users ?? 0))} Active
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{metrics?.counts?.suspended_users ?? 0} Suspended</span>
                  <span>{metrics?.counts?.admin_users ?? 1} Admin Account</span>
                </div>
              </div>

              {/* Total User Wallet Float (System Liability) */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-purple-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Total User Wallet Float</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">
                    ₹{(metrics?.financials?.total_outstanding_float ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] text-amber-400/90 mt-1 font-medium">
                  Aggregate User Liability • Admin has NO wallet
                </p>
              </div>

              {/* Payments Stat Card */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Payments Status</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">
                    {metrics?.counts?.successful_payments ?? 0}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400">
                    Verified
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
                  <span className="text-amber-400 font-semibold">{metrics?.counts?.pending_payments ?? pendingCount} Pending</span>
                  <span className="text-rose-400">{metrics?.counts?.failed_payments ?? 0} Failed/Rejected</span>
                </div>
              </div>

              {/* Documents Generated Stat Card */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-blue-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Documents Synthesized</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">
                    {metrics?.counts?.total_documents ?? 0}
                  </span>
                  <span className="text-[11px] font-bold text-blue-400">
                    Total
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">{metrics?.counts?.docs_today ?? 0} Today</span>
                  <span className="text-slate-400">{metrics?.counts?.docs_this_month ?? 0} This Month</span>
                </div>
              </div>
            </div>

            {/* Daily Trends Chart & Inflow/Spend summary */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" /> 7-Day Financial Flow Telemetry
                  </h3>
                  <p className="text-xs text-slate-400">Deposits (Platform Revenue Inflow) vs User Wallet Deductions</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-300">Deposits (Inflow)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="text-slate-300">Spends (Synthesis)</span>
                  </div>
                </div>
              </div>

              {chartData.length > 0 ? (
                <div className="relative pt-6 pb-2">
                  <div className="flex items-end justify-between gap-2 h-44 border-b border-slate-800 px-2">
                    {chartData.map((d, idx) => {
                      const depHeight = Math.max((d.deposits / maxVal) * 100, 4);
                      const spHeight = Math.max((d.spends / maxVal) * 100, 4);
                      const isHovered = hoveredChartIndex === idx;

                      return (
                        <div
                          key={idx}
                          onMouseEnter={() => setHoveredChartIndex(idx)}
                          onMouseLeave={() => setHoveredChartIndex(null)}
                          className="flex-1 flex flex-col items-center justify-end h-full gap-1 relative cursor-pointer group"
                        >
                          {isHovered && (
                            <div className="absolute -top-14 bg-slate-950 border border-slate-700 p-2 rounded-xl text-[10px] text-white shadow-2xl z-20 whitespace-nowrap pointer-events-none">
                              <div className="font-bold text-slate-200">{d.full_date}</div>
                              <div className="text-emerald-400 font-semibold">Deposits: ₹{d.deposits.toFixed(2)}</div>
                              <div className="text-amber-400 font-semibold">Spends: ₹{d.spends.toFixed(2)}</div>
                            </div>
                          )}

                          <div className="w-full flex items-end justify-center gap-1.5 h-full">
                            <div
                              style={{ height: `${depHeight}%` }}
                              className="w-1/2 max-w-[18px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t group-hover:brightness-125 transition-all shadow-sm"
                            ></div>
                            <div
                              style={{ height: `${spHeight}%` }}
                              className="w-1/2 max-w-[18px] bg-gradient-to-t from-amber-600 to-amber-400 rounded-t group-hover:brightness-125 transition-all shadow-sm"
                            ></div>
                          </div>

                          <span className="text-[10px] font-semibold text-slate-400 mt-2 truncate w-full text-center">
                            {d.date}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">No transaction telemetry records found</div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- SECTION 2: USERS MANAGEMENT (Section 7) ---------------- */}
        {activeSection === 'users' && (
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search users by name, email, or mobile..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700 p-1 rounded-xl">
                {(['clients', 'all', 'active', 'suspended'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setUsersFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer ${
                      usersFilter === filter ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter === 'clients' ? 'Clients' : filter === 'all' ? 'All (inc. Staff)' : filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Wallet Balance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{u.name || u.full_name || 'Unnamed User'}</div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                          {u.mobile || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {u.is_admin ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              Admin (No Wallet)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              Standard User
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {u.is_admin ? (
                            <span className="text-slate-500 italic">No Wallet</span>
                          ) : (
                            <span className="font-black text-emerald-400 text-sm">
                              ₹{(u.wallet_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {u.is_active === false ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                              Suspended
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleViewUserDetails(u.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Details
                          </button>

                          {!u.is_admin && (
                            <button
                              onClick={() => handleSelectUserForWallet(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Adjust
                            </button>
                          )}

                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleOpenStatusModal(u)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer ${
                                u.is_active === false
                                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30'
                                  : 'bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30'
                              }`}
                            >
                              {u.is_active === false ? 'Activate' : 'Suspend'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : usersList.filter((u) => !u.is_admin && u.role !== 'ADMIN').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                            <Users className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-white">No Client Accounts Registered Yet</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Your production platform is active and ready for client onboarding. When clients register on your application, their account details, mobile verification, and wallet balances will appear here in real-time.
                          </p>
                          <div className="pt-2 flex items-center justify-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              Ready for Client Onboarding
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                        No user accounts match "{userSearchQuery || usersFilter}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- SECTION 3: WALLET MANAGEMENT (Section 8, 9, 10, 11) ---------------- */}
        {activeSection === 'wallet' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Selector Card */}
            <div className="lg:col-span-1 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-3">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider">
                Select Target User
              </h3>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={walletUserSearch}
                  onChange={(e) => setWalletUserSearch(e.target.value)}
                  placeholder="Filter users..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                {usersList.filter((u) => !u.is_admin && u.role !== 'ADMIN').length === 0 ? (
                  <div className="py-12 text-center px-4 space-y-2">
                    <Wallet className="w-8 h-8 text-slate-700 mx-auto" />
                    <p className="text-xs font-semibold text-slate-400">No client wallets yet</p>
                    <p className="text-[11px] text-slate-500">
                      Client wallets will appear here automatically upon user registration.
                    </p>
                  </div>
                ) : (
                  usersList
                    .filter((u) => !u.is_admin && u.role !== 'ADMIN')
                    .filter((u) =>
                      walletUserSearch
                        ? u.email.toLowerCase().includes(walletUserSearch.toLowerCase()) ||
                          (u.name || '').toLowerCase().includes(walletUserSearch.toLowerCase())
                        : true
                    )
                    .map((u) => {
                      const isSelected = walletTargetUser?.id === u.id;
                      return (
                        <div
                          key={u.id}
                          onClick={() => setWalletTargetUser(u)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500/50 shadow-md'
                              : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-white text-xs truncate">{u.name || u.email}</div>
                            <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-black text-emerald-400">
                              ₹{(u.wallet_balance ?? 0).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-500">Balance</div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Wallet Adjustment Form */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-5">
              {walletTargetUser ? (
                <form onSubmit={handlePrepareWalletAdjustment} className="space-y-5">
                  {/* Selected User Header */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">Target User Wallet</span>
                      <h3 className="text-sm font-bold text-white">{walletTargetUser.name || 'User'} ({walletTargetUser.email})</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Current Balance</span>
                      <div className="text-xl font-black text-emerald-400">
                        ₹{(walletTargetUser.wallet_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Action Selector: Credit vs Debit */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Adjustment Action
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setWalletAction('add')}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          walletAction === 'add'
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md'
                            : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                        <span>Credit Wallet (Add Funds)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWalletAction('deduct')}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          walletAction === 'deduct'
                            ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-md'
                            : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <ArrowDownLeft className="w-4 h-4 text-rose-400" />
                        <span>Debit Wallet (Deduct Funds)</span>
                      </button>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Adjustment Amount (INR ₹)
                    </label>
                    <div className="relative">
                      <span className="text-slate-400 font-bold absolute left-3.5 top-1/2 -translate-y-1/2">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={walletAmount}
                        onChange={(e) => setWalletAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        className="w-full pl-8 pr-4 py-2.5 bg-slate-950/80 border border-slate-700 focus:border-indigo-500 rounded-xl text-sm font-bold text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Mandatory Reason */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Audit Reason <span className="text-rose-400">*</span> (Minimum 5 characters)
                    </label>
                    <input
                      type="text"
                      value={walletReason}
                      onChange={(e) => setWalletReason(e.target.value)}
                      placeholder="e.g. Payment verified manually via HDFC Bank reference #..."
                      required
                      minLength={5}
                      className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  {/* Optional Reference */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Reference / External Tracking Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={walletReference}
                      onChange={(e) => setWalletReference(e.target.value)}
                      placeholder="e.g. REF-MANUAL-UTR-8982"
                      className="w-full px-4 py-2 bg-slate-950/80 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  {/* Calculation Preview & Negative Balance Guard */}
                  {(() => {
                    const cur = walletTargetUser.wallet_balance ?? 0;
                    const amt = parseFloat(walletAmount) || 0;
                    const nextBal = walletAction === 'add' ? cur + amt : cur - amt;
                    const isNegative = walletAction === 'deduct' && nextBal < 0;

                    return (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-500">Current Balance</div>
                            <div className="text-xs font-black text-slate-300">₹{cur.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-500">Adjustment</div>
                            <div className={`text-xs font-black ${walletAction === 'add' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {walletAction === 'add' ? `+₹${amt.toFixed(2)}` : `-₹${amt.toFixed(2)}`}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-500">New Balance</div>
                            <div className={`text-sm font-black ${isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>
                              ₹{nextBal.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {isNegative && (
                          <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>
                              <strong>Insufficient wallet balance:</strong> Cannot debit ₹{amt.toFixed(2)}; available balance is only ₹{cur.toFixed(2)}. Negative balances are strictly disallowed.
                            </span>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isNegative || amt <= 0 || walletReason.trim().length < 5}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                        >
                          <ShieldAlert className="w-4 h-4" /> Review & Confirm Wallet Adjustment
                        </button>
                      </div>
                    );
                  })()}
                </form>
              ) : (
                <div className="py-20 text-center space-y-2">
                  <Wallet className="w-12 h-12 text-slate-700 mx-auto" />
                  <p className="text-sm font-bold text-slate-400">No user selected</p>
                  <p className="text-xs text-slate-500">Please pick a user from the list on the left to adjust their balance.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- SECTION 4: PAYMENTS QUEUE (Section 20) ---------------- */}
        {activeSection === 'payments' && (
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700 p-1 rounded-xl">
                {(['pending', 'verified', 'rejected', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setVerificationsFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer flex items-center gap-1.5 ${
                      verificationsFilter === filter ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{filter}</span>
                    {filter === 'pending' && pendingCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Payment ID / Date</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Bank UTR / Proof</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredVerifications.length > 0 ? (
                    filteredVerifications.map((v) => {
                      const isPending = (v.status || '').toLowerCase() === 'pending';
                      return (
                        <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                            <div>{v.id.substring(0, 8)}...</div>
                            <div className="text-[10px] text-slate-500 font-sans">
                              {v.created_at ? new Date(v.created_at).toLocaleString() : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{v.user_name || 'User'}</div>
                            <div className="text-[11px] text-slate-400">{v.user_email}</div>
                          </td>
                          <td className="py-3 px-4 font-black text-emerald-400 text-sm">
                            ₹{v.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-200 text-xs font-bold">{v.utr_number}</span>
                              <button
                                onClick={() => handleCopyUtr(v.utr_number)}
                                className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title="Copy UTR"
                              >
                                {copiedUtr === v.utr_number ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {v.user_notes && (
                              <div className="text-[10px] text-slate-500 italic mt-0.5 max-w-[200px] truncate">
                                Note: {v.user_notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isPending ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                Pending Audit
                              </span>
                            ) : (v.status || '').toLowerCase() === 'verified' || (v.status || '').toLowerCase() === 'success' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                Verified
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5">
                            {isPending ? (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedVerificationForAction(v);
                                    setVerificationActionType('verify');
                                    setVerificationActionReason('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                                >
                                  Verify
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedVerificationForAction(v);
                                    setVerificationActionType('reject');
                                    setVerificationActionReason('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">Audited</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : verifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                            <Receipt className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-white">No Payment Records Yet</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Payment transactions, UPI manual claims, and instant UPI confirmations will appear in this ledger once users initiate deposit transactions.
                          </p>
                          <div className="pt-2 flex items-center justify-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              Gateway Webhooks Listening
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                        No payment requests match filter "{verificationsFilter}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- SECTION 5: PAYMENT CONFIGURATION (Section 15-19) ---------------- */}
        {activeSection === 'upi' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* UPI ID Configuration */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400" /> UPI Merchant Configuration
              </h3>
              <p className="text-xs text-slate-400">
                Configure the merchant UPI ID (VPA) and Payee Name displayed on dynamic user payment screens.
              </p>

              <form onSubmit={handleSaveUpiSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Merchant UPI VPA / ID <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={upiSettings.upi_vpa}
                    onChange={(e) => setUpiSettings({ ...upiSettings, upi_vpa: e.target.value })}
                    placeholder="merchant@bank"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs text-white focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Must match standard VPA format (e.g. business@icici or user@upi)</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Merchant Payee Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={upiSettings.upi_payee_name}
                    onChange={(e) => setUpiSettings({ ...upiSettings, upi_payee_name: e.target.value })}
                    placeholder="LexTitle AI Legal Systems"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Min Deposit (₹)</label>
                    <input
                      type="number"
                      value={upiSettings.min_deposit_amount ?? 10}
                      onChange={(e) => setUpiSettings({ ...upiSettings, min_deposit_amount: parseFloat(e.target.value) })}
                      min="1"
                      className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Max Deposit (₹)</label>
                    <input
                      type="number"
                      value={upiSettings.max_deposit_amount ?? 100000}
                      onChange={(e) => setUpiSettings({ ...upiSettings, max_deposit_amount: parseFloat(e.target.value) })}
                      min="100"
                      className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingUpi}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingUpi ? 'Saving Changes...' : 'Save UPI Settings'}
                </button>
              </form>
            </div>

            {/* QR / Scanner Configuration */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-400" /> QR Code Scanner Asset
              </h3>
              <p className="text-xs text-slate-400">
                Upload custom merchant QR code (PNG, JPEG, WebP up to 5MB) or revert to the dynamic vector SVG QR generator.
              </p>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col items-center justify-center space-y-3">
                {upiSettings.upi_qr_image_url ? (
                  <div className="space-y-2 text-center">
                    <img
                      src={upiSettings.upi_qr_image_url}
                      alt="Merchant QR"
                      className="w-40 h-40 object-contain rounded-lg border border-slate-700 bg-white p-2 mx-auto"
                    />
                    <div className="text-[11px] text-emerald-400 font-bold">Custom QR Code Active</div>
                  </div>
                ) : (
                  <div className="space-y-2 text-center py-4">
                    <div className="w-24 h-24 rounded-xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <QrCode className="w-12 h-12 text-slate-500" />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Dynamic SVG Generator Active (Generates live UPI deep-link QR codes per deposit amount)
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 w-full pt-2">
                  <label className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl text-center cursor-pointer transition-all">
                    {isUploadingQr ? 'Uploading...' : 'Upload Custom QR'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleQrFileUpload}
                      disabled={isUploadingQr}
                      className="hidden"
                    />
                  </label>

                  {upiSettings.upi_qr_image_url && (
                    <button
                      onClick={handleRemoveQrCode}
                      className="py-2 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      Remove QR
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- SECTION 6: DOCUMENT HISTORY (Section 12-14) ---------------- */}
        {activeSection === 'documents' && (
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={documentSearch}
                  onChange={(e) => setDocumentSearch(e.target.value)}
                  placeholder="Search persistent documents by template, user email, or ID..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700 p-1 rounded-xl">
                {(['all', 'completed', 'failed'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDocumentStatusFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer ${
                      documentStatusFilter === filter ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Document ID</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Template / Type</th>
                    <th className="py-3 px-4">Generated Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDocs.length > 0 ? (
                    filteredDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-indigo-300 font-bold">
                          {doc.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{doc.user_name}</div>
                          <div className="text-[11px] text-slate-400">{doc.user_email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-white font-medium">{doc.document_type}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{doc.template_filename}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-[11px]">
                          {doc.generated_at ? new Date(doc.generated_at).toLocaleString() : ''}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 capitalize">
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleViewDocDetail(doc.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Details
                          </button>
                          <button
                            onClick={() => handleDownloadDoc(doc.id, doc.template_filename)}
                            disabled={downloadingDocId === doc.id}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            {downloadingDocId === doc.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            Download
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : documents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                            <FileText className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-white">No Generated Legal Documents Yet</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            When clients synthesize bank title scrutinies, legal opinion drafts, or fill custom templates, persistent generated files will be indexed and downloadable here.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                        No documents match filter "{documentStatusFilter}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- SECTION 7: AUDIT LOGS (Section 21) ---------------- */}
        {activeSection === 'audit' && (
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search audit trail by admin, action, target, or IP address..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all">All Actions</option>
                  <option value="ADMIN_LOGIN">ADMIN_LOGIN</option>
                  <option value="ADMIN_LOGOUT">ADMIN_LOGOUT</option>
                  <option value="WALLET_ADJUSTMENT">WALLET_ADJUSTMENT</option>
                  <option value="PAYMENT_VERIFIED">PAYMENT_VERIFIED</option>
                  <option value="PAYMENT_REJECTED">PAYMENT_REJECTED</option>
                  <option value="USER_SUSPENSION">USER_SUSPENSION</option>
                  <option value="USER_ACTIVATION">USER_ACTIVATION</option>
                  <option value="UPI_SETTINGS_CHANGED">UPI_SETTINGS_CHANGED</option>
                  <option value="QR_CODE_UPLOADED">QR_CODE_UPLOADED</option>
                  <option value="DOCUMENT_DOWNLOADED">DOCUMENT_DOWNLOADED</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Timestamp (UTC)</th>
                    <th className="py-3 px-4">Admin</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-sans font-bold">
                          {log.admin_email || 'SYSTEM'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {log.target_type}: {log.target_id?.substring(0, 12)}...
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {log.ip_address || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedLogDetail(log)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-sans font-semibold transition-all cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans text-xs">
                        No audit records match the query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- SECTION 8: SETTINGS (PRICING) ---------------- */}
        {activeSection === 'settings' && (
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4 max-w-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" /> Platform Pricing Configuration
            </h3>
            <p className="text-xs text-slate-400">
              Set the per-document synthesis fee and OCR per-page rate. Changes are immediately recorded in the audit log.
            </p>

            <form onSubmit={handleSavePricing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Document Synthesis Fee (INR ₹)
                </label>
                <div className="relative">
                  <span className="text-slate-400 font-bold absolute left-3.5 top-1/2 -translate-y-1/2">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingForm.doc_generation_fee ?? 50}
                    onChange={(e) => setPricingForm({ ...pricingForm, doc_generation_fee: parseFloat(e.target.value) })}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950/80 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs font-bold text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  OCR Per-Page Processing Fee (INR ₹)
                </label>
                <div className="relative">
                  <span className="text-slate-400 font-bold absolute left-3.5 top-1/2 -translate-y-1/2">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingForm.ocr_per_page_fee ?? 5}
                    onChange={(e) => setPricingForm({ ...pricingForm, ocr_per_page_fee: parseFloat(e.target.value) })}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950/80 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs font-bold text-white focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingPricing}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingPricing ? 'Saving Settings...' : 'Save Pricing Configuration'}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* ---------------- MODAL 1: WALLET ADJUSTMENT CONFIRMATION (Section 10) ---------------- */}
      {isWalletConfirmOpen && walletTargetUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" /> Confirm Wallet Adjustment
              </h3>
              <button
                onClick={() => setIsWalletConfirmOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target User:</span>
                  <span className="font-bold text-white">{walletTargetUser.name || 'User'} ({walletTargetUser.email})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Balance:</span>
                  <span className="font-mono text-slate-200">₹{(walletTargetUser.wallet_balance ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Action:</span>
                  <span className={`font-black uppercase ${walletAction === 'add' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {walletAction === 'add' ? 'Credit (+)' : 'Debit (-)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount:</span>
                  <span className="font-black text-white text-sm">₹{parseFloat(walletAmount || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800/80 pt-2">
                  <span className="font-bold text-slate-300">New Balance:</span>
                  <span className="font-black text-emerald-400 text-sm">
                    ₹{(
                      walletAction === 'add'
                        ? (walletTargetUser.wallet_balance ?? 0) + (parseFloat(walletAmount) || 0)
                        : (walletTargetUser.wallet_balance ?? 0) - (parseFloat(walletAmount) || 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Reason:</span>
                <p className="p-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-slate-300 italic text-[11px]">
                  {walletReason}
                </p>
              </div>

              {walletReference && (
                <div>
                  <span className="text-slate-400 block mb-1">Reference:</span>
                  <span className="font-mono text-indigo-300 text-[11px]">{walletReference}</span>
                </div>
              )}

              <p className="text-[11px] text-amber-400/90 font-medium">
                This operation is irreversible and will be permanently recorded in the immutable audit ledger with your Admin ID and IP address.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsWalletConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWalletAdjustment}
                disabled={isProcessingWallet}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                {isProcessingWallet ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing...
                  </>
                ) : (
                  'Confirm Adjustment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: USER STATUS CHANGE MODAL ---------------- */}
      {statusModalUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                {statusModalUser.is_active === false ? 'Activate User Account' : 'Suspend User Account'}
              </h3>
              <button onClick={() => setStatusModalUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {statusModalUser.is_active === false
                ? `Activate account access for ${statusModalUser.email}.`
                : `Suspend ${statusModalUser.email}. The user will be blocked from logging into the portal.`}
            </p>

            <form onSubmit={handleConfirmStatusChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mandatory Audit Reason (Min 3 characters)
                </label>
                <input
                  type="text"
                  value={statusModalReason}
                  onChange={(e) => setStatusModalReason(e.target.value)}
                  placeholder="e.g. Account suspended due to payment dispute..."
                  required
                  minLength={3}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStatusModalUser(null)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingStatus || statusModalReason.trim().length < 3}
                  className={`flex-1 py-2 text-white text-xs font-bold rounded-xl ${
                    statusModalUser.is_active === false ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {isProcessingStatus ? 'Updating...' : statusModalUser.is_active === false ? 'Activate' : 'Suspend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 3: USER FULL DETAILS MODAL ---------------- */}
      {selectedUserForDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedUserForDetails.name || 'User Profile'}</h3>
                <p className="text-xs text-slate-400">{selectedUserForDetails.email} • Mobile: {selectedUserForDetails.mobile || '—'}</p>
              </div>
              <button onClick={() => setSelectedUserForDetails(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Wallet Balance</div>
                <div className="text-base font-black text-emerald-400">
                  {selectedUserForDetails.wallet_balance !== null
                    ? `₹${selectedUserForDetails.wallet_balance.toFixed(2)}`
                    : 'No Wallet'}
                </div>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Role</div>
                <div className="text-xs font-bold text-white capitalize">{selectedUserForDetails.role}</div>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Status</div>
                <div className={`text-xs font-bold ${selectedUserForDetails.is_active ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedUserForDetails.is_active ? 'Active' : 'Suspended'}
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 mb-2">Recent Transactions</h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-800 rounded-xl p-2 bg-slate-950/60">
                {selectedUserForDetails.recent_transactions && selectedUserForDetails.recent_transactions.length > 0 ? (
                  selectedUserForDetails.recent_transactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-800/40">
                      <div>
                        <div className="font-medium text-white truncate max-w-[280px]">{tx.description}</div>
                        <div className="text-[10px] text-slate-500">{new Date(tx.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tx.amount > 0 ? `+₹${tx.amount.toFixed(2)}` : `-₹${Math.abs(tx.amount).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-slate-500 text-xs">No transactions recorded</div>
                )}
              </div>
            </div>

            {/* Generated Documents */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 mb-2">Generated Documents</h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-800 rounded-xl p-2 bg-slate-950/60">
                {selectedUserForDetails.recent_documents && selectedUserForDetails.recent_documents.length > 0 ? (
                  selectedUserForDetails.recent_documents.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-800/40">
                      <div className="text-white font-medium truncate">{d.template_filename}</div>
                      <div className="text-[10px] text-slate-400">{new Date(d.generated_at).toLocaleDateString()}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-slate-500 text-xs">No documents generated yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 4: PAYMENT VERIFY / REJECT ACTION MODAL ---------------- */}
      {selectedVerificationForAction && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                {verificationActionType === 'verify' ? 'Confirm Payment & Credit Wallet' : 'Reject Payment Request'}
              </h3>
              <button
                onClick={() => {
                  setSelectedVerificationForAction(null);
                  setVerificationActionType(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">User:</span>
                <span className="font-bold text-white">{selectedVerificationForAction.user_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-bold text-emerald-400 text-sm">₹{selectedVerificationForAction.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bank UTR:</span>
                <span className="font-mono text-slate-200">{selectedVerificationForAction.utr_number}</span>
              </div>
            </div>

            <form
              onSubmit={verificationActionType === 'verify' ? handleVerifyPaymentSubmit : handleRejectPaymentSubmit}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {verificationActionType === 'verify' ? 'Admin Verification Notes (Optional)' : 'Rejection Reason *'}
                </label>
                <input
                  type="text"
                  value={verificationActionReason}
                  onChange={(e) => setVerificationActionReason(e.target.value)}
                  placeholder={
                    verificationActionType === 'verify'
                      ? 'e.g. Bank statement checked'
                      : 'e.g. Invalid UTR / Funds not credited'
                  }
                  required={verificationActionType === 'reject'}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVerificationForAction(null);
                    setVerificationActionType(null);
                  }}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingVerAction}
                  className={`flex-1 py-2 text-white text-xs font-bold rounded-xl ${
                    verificationActionType === 'verify'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {isProcessingVerAction ? 'Processing...' : verificationActionType === 'verify' ? 'Confirm & Credit' : 'Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 5: DOCUMENT METADATA MODAL (Section 13) ---------------- */}
      {selectedDocumentDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedDocumentDetail.document_type}</h3>
                <p className="text-xs text-slate-400">ID: {selectedDocumentDetail.id}</p>
              </div>
              <button onClick={() => setSelectedDocumentDetail(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">User</span>
                <span className="font-bold text-white">{selectedDocumentDetail.user_email}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Generated At</span>
                <span className="font-mono text-slate-300">{new Date(selectedDocumentDetail.generated_at).toLocaleString()}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Template Filename</span>
                <span className="font-mono text-slate-300 truncate block">{selectedDocumentDetail.template_filename}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Persistent Storage</span>
                <span className="font-mono text-indigo-300 text-[10px] block truncate">{selectedDocumentDetail.storage_key}</span>
              </div>
            </div>

            {/* Extracted Fields Summary */}
            <div>
              <span className="text-xs font-bold text-slate-300 block mb-2">
                Field Extractions ({Object.keys(selectedDocumentDetail.field_values || {}).length} fields)
              </span>
              <div className="max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] space-y-1 text-slate-300">
                {Object.entries(selectedDocumentDetail.field_values || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-slate-900 pb-1">
                    <span className="text-indigo-400 font-semibold">{k}:</span>
                    <span className="text-slate-200 truncate max-w-[280px]">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleDownloadDoc(selectedDocumentDetail.id, selectedDocumentDetail.template_filename)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download Generated .docx
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 6: AUDIT LOG INSPECTION MODAL ---------------- */}
      {selectedLogDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" /> Audit Log Event
              </h3>
              <button onClick={() => setSelectedLogDetail(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-slate-950 rounded-lg">
                <span className="text-slate-400">Action:</span>
                <span className="font-bold text-indigo-300 font-mono">{selectedLogDetail.action}</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-950 rounded-lg">
                <span className="text-slate-400">Admin:</span>
                <span className="font-bold text-white">{selectedLogDetail.admin_email}</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-950 rounded-lg">
                <span className="text-slate-400">Target:</span>
                <span className="font-mono text-slate-300">{selectedLogDetail.target_type} ({selectedLogDetail.target_id})</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-950 rounded-lg">
                <span className="text-slate-400">IP Address:</span>
                <span className="font-mono text-slate-300">{selectedLogDetail.ip_address}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-300 block mb-1">Metadata (JSON):</span>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                {JSON.stringify(selectedLogDetail.metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};