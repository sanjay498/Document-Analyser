import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  FileText,
  Phone,
  Mail,
  ArrowRight,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Download,
  X
} from 'lucide-react';
import type { Client, ClientDetailResponse } from '../types';
import { getClients, getClientDetail, createClient, checkExistingClient } from '../services/api';

interface ClientsViewProps {
  onStartScrutinyForClient: (client: Client) => void;
  onNavigateToWorkspace: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  onStartScrutinyForClient,
  onNavigateToWorkspace,
  showToast,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected client for detail view
  const [selectedClient, setSelectedClient] = useState<ClientDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Add client modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newTitle, setNewTitle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Existing client prompt modal
  const [existingMatch, setExistingMatch] = useState<Client | null>(null);

  const fetchClients = async (query?: string) => {
    setIsLoading(true);
    try {
      const data = await getClients(query);
      setClients(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load clients', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchClients(val);
  };

  const handleOpenDetail = async (client: Client) => {
    setIsLoadingDetail(true);
    try {
      const detail = await getClientDetail(client.id);
      setSelectedClient(detail);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch client details', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent, forceNew: boolean = false) => {
    e.preventDefault();
    setAddError(null);

    if (!newName.trim() || !newPhone.trim() || !newEmail.trim() || !newTitle.trim()) {
      setAddError('All fields (Name, Phone, Email, Title) are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!forceNew) {
        // Check for duplicates first
        const check = await checkExistingClient(newPhone.trim(), newEmail.trim());
        if (check.exists && check.client) {
          setExistingMatch(check.client);
          setIsSubmitting(false);
          return;
        }
      }

      const created = await createClient({
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        title: newTitle.trim(),
      });

      showToast(`Client "${created.name}" created successfully`, 'success');
      setIsAddModalOpen(false);
      setExistingMatch(null);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewTitle('');
      fetchClients();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Clients & Scrutiny Records
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {clients.length} {clients.length === 1 ? 'Client' : 'Clients'}
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Permanently registered title scrutiny clients and their associated property records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAddError(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 shadow-md shadow-amber-400/10 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>

          <button
            onClick={onNavigateToWorkspace}
            className="px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            Open Workspace
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search clients by name, phone, email, or title..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-[#070a13] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>
        <button
          onClick={() => fetchClients(searchQuery)}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Refresh client list"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Client List Table or Empty State */}
      {isLoading ? (
        <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-16 text-center">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium text-slate-300">Loading clients from database...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-14 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-bold text-white">
              {searchQuery ? 'No matching clients found' : 'No clients in database'}
            </h2>
            <p className="text-xs text-slate-400">
              {searchQuery
                ? 'Try refining your search query across name, phone, or title.'
                : 'Clients are permanently created when you start a scrutiny from the main page, or you can register one directly.'}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              Add Client
            </button>
            <button
              onClick={onNavigateToWorkspace}
              className="px-4 py-2.5 text-xs font-medium rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Go to Workspace
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0e1424] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Title / Matter</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white group-hover:text-amber-300 transition-colors">
                            {c.name}
                          </p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ID: {c.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{c.phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span className="truncate max-w-[180px]">{c.email}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-200 border border-slate-700 text-xs font-medium max-w-[240px] truncate" title={c.title}>
                        {c.title}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenDetail(c)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="View scrutiny history and details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>
                        <button
                          onClick={() => onStartScrutinyForClient(c)}
                          className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                          title="Start new scrutiny for this client"
                        >
                          <span>Start Scrutiny</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Client Loading Detail Indicator */}
      {isLoadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-xs text-white shadow-xl">
            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
            <span>Loading client scrutiny records...</span>
          </div>
        </div>
      )}

      {/* Client Detail Drawer / Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#0e1424]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  {selectedClient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{selectedClient.name}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Client ID: {selectedClient.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Client Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-[#070a13] border border-slate-800 rounded-xl p-4">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Phone</span>
                  <p className="text-white font-mono mt-0.5">{selectedClient.phone}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Email</span>
                  <p className="text-white mt-0.5 truncate">{selectedClient.email}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Matter Title</span>
                  <p className="text-amber-300 font-medium mt-0.5">{selectedClient.title}</p>
                </div>
                <div className="col-span-2 pt-1 text-[11px] text-slate-500">
                  Registered: {formatDate(selectedClient.created_at)}
                </div>
              </div>

              {/* Scrutiny Relationship Trace */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-white text-xs flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Scrutiny History ({selectedClient.scrutinies.length})
                  </h4>
                  <button
                    onClick={() => {
                      const c = selectedClient;
                      setSelectedClient(null);
                      onStartScrutinyForClient(c);
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    + New Scrutiny for this Client
                  </button>
                </div>

                {selectedClient.scrutinies.length === 0 ? (
                  <div className="p-6 rounded-xl border border-slate-800 bg-[#070a13] text-center text-slate-400">
                    <p>No scrutiny sessions recorded yet for this client.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedClient.scrutinies.map((s, idx) => (
                      <div
                        key={s.session_id}
                        className="rounded-xl border border-slate-800 bg-[#070a13] p-4 space-y-2 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                              Scrutiny #{idx + 1}
                            </span>
                            <h5 className="font-bold text-white text-xs mt-0.5">
                              {s.template_filename}
                            </h5>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                            s.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {s.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3">
                          <span>Date: {formatDate(s.created_at)}</span>
                          <span>•</span>
                          <span>{s.sources_count} Uploaded Source Documents</span>
                        </div>

                        {s.sources_names && s.sources_names.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {s.sources_names.map((name, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700 text-[10px]"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        )}

                        {s.final_document_ready && (
                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-emerald-400 text-[11px] flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Final Report Generated
                            </span>
                            <a
                              href={`/api/sessions/${s.session_id}/download`}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 transition-colors"
                              download
                            >
                              <Download className="w-3 h-3 text-amber-400" />
                              Download (.docx)
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#0e1424] flex items-center justify-end">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#0e1424]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Users className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-white text-sm">Register New Client</h3>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setExistingMatch(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {existingMatch ? (
              /* Existing Client Found Prompt */
              <div className="p-6 space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Existing Client Found
                  </div>
                  <p className="text-xs text-slate-300">
                    A client matching this phone number or email already exists in the database:
                  </p>
                  <div className="bg-[#070a13] p-3 rounded-lg border border-amber-500/20 text-xs space-y-1">
                    <p className="font-bold text-white">{existingMatch.name}</p>
                    <p className="text-slate-400">Phone: {existingMatch.phone}</p>
                    <p className="text-slate-400">Email: {existingMatch.email}</p>
                    <p className="text-amber-300">Title: {existingMatch.title}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      const c = existingMatch;
                      setIsAddModalOpen(false);
                      setExistingMatch(null);
                      onStartScrutinyForClient(c);
                    }}
                    className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Use Existing Client & Start Scrutiny
                  </button>
                  <button
                    onClick={(e) => handleAddSubmit(e, true)}
                    className="w-full py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Create New Client Anyway
                  </button>
                  <button
                    onClick={() => setExistingMatch(null)}
                    className="w-full py-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Minimal Form */
              <form onSubmit={(e) => handleAddSubmit(e, false)} className="p-6 space-y-4 text-xs">
                {addError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">Client Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. K. Muthulakshmi"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-[#070a13] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9842112345"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-[#070a13] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. muthulakshmi@property.org"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-[#070a13] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">Title / Matter Reference *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Title Scrutiny for S.F. No. 245/1B"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-[#070a13] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Registering...' : 'Register Client'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
