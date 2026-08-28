import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  ShieldCheck,
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
  Globe,
  Sparkles,
} from 'lucide-react';
import { api, UserDetail } from '../services/api';

export const UserManagementPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: api.getAdminUsers,
  });

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const googleUsersCount = users.filter((u) => u.auth_provider === 'google').length;
  const emailUsersCount = users.filter((u) => u.auth_provider === 'email').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-400" /> User Logins & Account Management
          </h1>
          <p className="text-slate-400 text-sm">
            Inspect all registered user accounts, authentication providers, and last login timestamps.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Users</span>
            <Users className="w-5 h-5 text-brand-400" />
          </div>
          <div className="text-3xl font-bold text-white">{users.length}</div>
          <p className="text-xs text-slate-500">Registered platform accounts</p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Google OAuth</span>
            <Globe className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-white">{googleUsersCount}</div>
          <p className="text-xs text-slate-500">Signed in via Google</p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Email & Password</span>
            <Lock className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white">{emailUsersCount}</div>
          <p className="text-xs text-slate-500">Password authenticated</p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Status</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white">100%</div>
          <p className="text-xs text-slate-500">Secured with JWT tokens</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="glass-card p-6 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">User Accounts & Login Activity</h2>
            <p className="text-xs text-slate-400">View exact registration dates and recent login timestamps</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2 border border-slate-800 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading user login details...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No user accounts found matching query.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Auth Provider</th>
                  <th className="py-3 px-4">Last Login Timestamp</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.email} className="w-8 h-8 rounded-full border border-slate-700" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-300 font-bold text-xs">
                            {u.full_name ? u.full_name.slice(0, 2).toUpperCase() : u.email.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-white">{u.full_name || 'User Account'}</p>
                          <p className="text-[10px] text-slate-500">ID: {u.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-200">{u.email}</td>

                    <td className="py-3.5 px-4">
                      {u.auth_provider === 'google' ? (
                        <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold inline-flex items-center gap-1.5">
                          <Globe className="w-3 h-3" /> Google OAuth
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold inline-flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-emerald-400" /> Password
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {u.last_login_at ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-brand-400" />
                          {new Date(u.last_login_at).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-500">First session active</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
