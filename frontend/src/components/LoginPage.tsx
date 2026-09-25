import React, { useState } from 'react';
import { Lock, Mail, User, Phone, ArrowRight, Sparkles, ShieldCheck, FileCheck, History, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { loginUser, registerUser } from '../services/api';
import type { UserProfile } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
}) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    if (isRegister) {
      const trimmedName = fullName.trim();
      if (!trimmedName || trimmedName.length < 2) {
        setError('Please enter your full name (minimum 2 characters).');
        return;
      }

      const cleanMobile = mobile.replace(/[\s\-]/g, '');
      const mobileRegex = /^(\+91)?[6-9]\d{9}$|^\+?[1-9]\d{7,14}$/;
      if (!mobileRegex.test(cleanMobile)) {
        setError('Please enter a valid 10-digit mobile number (e.g. 9876543210).');
        return;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }

      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setError('Password must contain both letters and numbers.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isRegister) {
        const res = await registerUser({
          name: fullName.trim(),
          email: trimmedEmail,
          mobile: mobile.trim(),
          password,
          confirm_password: confirmPassword,
        });
        onLoginSuccess(res.user);
      } else {
        const res = await loginUser(trimmedEmail, password);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || (isRegister ? 'Registration failed. Please check your details.' : 'Invalid email or password.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden relative z-10">
        {/* Left Side: Brand & Benefits Banner */}
        <div className="md:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-white tracking-tight">LexTitle AI</h1>
                <p className="text-[11px] text-amber-400/90 font-medium">Bank Title Opinion & Legal Scrutiny</p>
              </div>
            </div>

            <div className="space-y-4 mt-8">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200">Production-Grade Security</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">BCrypt password hashing & short-lived JWTs to safeguard client legal data.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200">Byte-Identical XML Fidelity</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Operates directly on Word OpenXML containers with zero format drift.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200">Audited Wallet & UPI Gateway</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Bank UTR verified credits with transparent double-entry balance auditing.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-[11px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Server-side AI Processing • Zero Client Key Exposure</span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="md:col-span-7 p-8 bg-slate-950/60 flex flex-col justify-center">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-900 border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isRegister
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isRegister
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-extrabold text-white">
              {isRegister ? 'Create Your Account' : 'Welcome Back'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isRegister
                ? 'Sign up for a personal account. Accounts start with ₹0.00 wallet balance.'
                : 'Sign in to access your templates, source deeds, and generation history.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Advocate K. Kandakumarraj"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="9876543210"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Used for account security and payment verification alerts.</p>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="advocate@legalopinions.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isRegister && (
                <p className="text-[10px] text-slate-500 mt-0.5">Minimum 8 characters with both letters and numbers.</p>
              )}
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{isRegister ? 'Register Account' : 'Sign In to Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
