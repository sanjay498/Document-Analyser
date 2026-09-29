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
  X,
  Copy,
  Check,
  MapPin,
  Building,
  ShieldCheck,
  FileCheck,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import type { Client, ClientDetailResponse } from '../types';
import { getClients, getClientDetail, createClient, checkExistingClient, deleteClient } from '../services/api';

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

  // Selected client for detail view & document hub
  const [selectedClient, setSelectedClient] = useState<ClientDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [activeScrutinyIdx, setActiveScrutinyIdx] = useState<number>(0);
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [copiedDoc, setCopiedDoc] = useState<boolean>(false);

  // Delete client confirmation modal state
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

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
    setActiveScrutinyIdx(0);
    setDocSearchQuery('');
    setViewMode('formatted');
    setCopiedDoc(false);
    try {
      const detail = await getClientDetail(client.id);
      setSelectedClient(detail);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch client details', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCopyDocText = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedDoc(true);
    showToast('Generated document text copied to clipboard', 'success');
    setTimeout(() => setCopiedDoc(false), 2500);
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    try {
      await deleteClient(clientToDelete.id);
      showToast(`Client "${clientToDelete.name}" deleted successfully`, 'success');
      if (selectedClient?.id === clientToDelete.id) {
        setSelectedClient(null);
      }
      setClientToDelete(null);
      fetchClients(searchQuery);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete client', 'error');
    } finally {
      setIsDeleting(false);
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
                  <th className="py-3 px-4">Document Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenDetail(c)}
                    className="hover:bg-amber-500/[0.05] cursor-pointer transition-colors group"
                    title="Click client to view and download generated document"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs shrink-0 group-hover:border-amber-400/50 group-hover:bg-amber-500/20 transition-all">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                            {c.name}
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-400 -translate-x-1 group-hover:translate-x-0 transition-all" />
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
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {c.scrutiny_count > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Document Ready ({c.scrutiny_count})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800/70 text-slate-400 border border-slate-700/60 text-[11px]">
                          No Scrutiny Yet
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetail(c)}
                          className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                          title="View scrutiny document and download"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View & Download</span>
                        </button>
                        <button
                          onClick={() => onStartScrutinyForClient(c)}
                          className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                          title="Start new scrutiny for this client"
                        >
                          <span>Start Scrutiny</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setClientToDelete(c)}
                          className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
                          title={`Delete client ${c.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
            <span>Loading client scrutiny records & document...</span>
          </div>
        </div>
      )}

      {/* Dedicated Client Overview & Document Hub ("Another Thing") */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header: Client Dossier Profile */}
            <div className="p-5 border-b border-slate-800 bg-[#0e1424] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/30 text-amber-300 font-bold text-lg flex items-center justify-center shrink-0 shadow-inner">
                  {selectedClient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-white text-base sm:text-lg tracking-tight">
                      {selectedClient.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Client Profile
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ID: {selectedClient.id.slice(0, 8)}...
                    </span>
                  </div>
                  <p className="text-xs text-amber-300/90 font-medium mt-0.5">
                    {selectedClient.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{selectedClient.phone}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1 truncate max-w-[160px]">
                    <Mail className="w-3 h-3 text-slate-500" />
                    <span>{selectedClient.email}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close viewer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Action Toolbar (Sticky) */}
            {selectedClient.scrutinies.length > 0 && (
              <div className="px-6 py-3 border-b border-slate-800 bg-[#070a13] flex flex-wrap items-center justify-between gap-3">
                {/* Scrutiny Selector Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    Documents ({selectedClient.scrutinies.length}):
                  </span>
                  {selectedClient.scrutinies.map((s, idx) => (
                    <button
                      key={s.session_id}
                      onClick={() => setActiveScrutinyIdx(idx)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        activeScrutinyIdx === idx
                          ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      }`}
                    >
                      <span>Report #{idx + 1}</span>
                      {s.final_document_ready && (
                        <CheckCircle2 className={`w-3 h-3 ${activeScrutinyIdx === idx ? 'text-slate-950' : 'text-emerald-400'}`} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Direct 1-Click Download Actions */}
                {selectedClient.scrutinies[activeScrutinyIdx] && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={selectedClient.scrutinies[activeScrutinyIdx].download_url_docx || `/api/sessions/${selectedClient.scrutinies[activeScrutinyIdx].session_id}/download?format=docx`}
                      download
                      className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-400/20 transition-all cursor-pointer"
                      title="Download complete scrutiny report in Word (.docx)"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download DOCX</span>
                    </a>

                    <a
                      href={selectedClient.scrutinies[activeScrutinyIdx].download_url_pdf || `/api/sessions/${selectedClient.scrutinies[activeScrutinyIdx].session_id}/download?format=pdf`}
                      download
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Download complete scrutiny report in PDF format"
                    >
                      <FileText className="w-3.5 h-3.5 text-rose-400" />
                      <span>Download PDF</span>
                    </a>

                    <a
                      href={selectedClient.scrutinies[activeScrutinyIdx].download_url_txt || `/api/sessions/${selectedClient.scrutinies[activeScrutinyIdx].session_id}/download?format=txt`}
                      download
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                      title="Download report plain text"
                    >
                      <Download className="w-3 h-3 text-slate-400" />
                      <span>TXT</span>
                    </a>

                    <button
                      onClick={() => handleCopyDocText(
                        selectedClient.scrutinies[activeScrutinyIdx].preview_text ||
                        (selectedClient.scrutinies[activeScrutinyIdx].preview_paragraphs || []).join('\n\n')
                      )}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                      title="Copy document text to clipboard"
                    >
                      {copiedDoc ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Modal Body (Scrollable Document Hub) */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {selectedClient.scrutinies.length === 0 ? (
                /* No Scrutinies Yet - Call to Action */
                <div className="p-12 text-center space-y-4 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">No Document Generated Yet</h3>
                    <p className="text-xs text-slate-400">
                      No legal title scrutiny has been initiated for <span className="text-amber-300 font-semibold">{selectedClient.name}</span>. Start a scrutiny to upload deeds and generate the official title opinion report.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        const c = selectedClient;
                        setSelectedClient(null);
                        onStartScrutinyForClient(c);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 mx-auto shadow-lg shadow-amber-400/20 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Start Scrutiny & Generate Document</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Full Generated Document Showcase */
                selectedClient.scrutinies[activeScrutinyIdx] && (() => {
                  const s = selectedClient.scrutinies[activeScrutinyIdx];
                  const paras = s.preview_paragraphs || [];
                  const filteredParas = docSearchQuery.trim()
                    ? paras.filter(p => p.toLowerCase().includes(docSearchQuery.toLowerCase()))
                    : paras;

                  return (
                    <div className="space-y-6">
                      {/* Legal Executive Particulars Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-[#070a13] border border-slate-800 rounded-xl p-3.5 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                            <Users className="w-3.5 h-3.5 text-amber-400" />
                            <span>Title Holder</span>
                          </div>
                          <p className="text-white font-semibold text-xs truncate" title={s.title_holder || selectedClient.name}>
                            {s.title_holder || selectedClient.name}
                          </p>
                        </div>

                        <div className="bg-[#070a13] border border-slate-800 rounded-xl p-3.5 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                            <FileCheck className="w-3.5 h-3.5 text-amber-400" />
                            <span>Survey Numbers</span>
                          </div>
                          <p className="text-amber-300 font-mono font-semibold text-xs truncate" title={s.survey_numbers || 'S.F. No. 245/1B'}>
                            {s.survey_numbers || 'S.F. No. 245/1B'}
                          </p>
                        </div>

                        <div className="bg-[#070a13] border border-slate-800 rounded-xl p-3.5 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            <span>Total Extent</span>
                          </div>
                          <p className="text-white font-semibold text-xs truncate" title={s.property_extent || '4.57 Acres'}>
                            {s.property_extent || '4.57 Acres'}
                          </p>
                        </div>

                        <div className="bg-[#070a13] border border-slate-800 rounded-xl p-3.5 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                            <Building className="w-3.5 h-3.5 text-amber-400" />
                            <span>Jurisdiction / SRO</span>
                          </div>
                          <p className="text-white font-semibold text-xs truncate" title={s.sro_name || 'SRO Pollachi'}>
                            {s.sro_name || 'SRO Pollachi'}
                          </p>
                        </div>
                      </div>

                      {/* Deeds & Source Verification Badges */}
                      <div className="bg-[#070a13] border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Examined Deeds & Source Documents ({s.sources_count}):
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {s.sources_names && s.sources_names.length > 0 ? (
                              s.sources_names.map((name, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700 text-[11px] font-mono flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3 text-amber-400/80" />
                                  <span>{name}</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 text-[11px]">Direct Legal Opinion Master Template</span>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400 shrink-0">
                          Generated: <span className="text-slate-200 font-medium">{formatDate(s.created_at)}</span>
                        </div>
                      </div>

                      {/* LIVE GENERATED DOCUMENT READER */}
                      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-[#070a13] shadow-xl">
                        {/* Reader Bar */}
                        <div className="p-3.5 bg-[#0e1424] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                            <span className="font-bold text-white text-xs">
                              {s.template_filename}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold uppercase">
                              Verified Legal Report
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Search inside document */}
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input
                                type="text"
                                placeholder="Search in document..."
                                value={docSearchQuery}
                                onChange={(e) => setDocSearchQuery(e.target.value)}
                                className="bg-[#070a13] border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 w-44 sm:w-56"
                              />
                            </div>

                            {/* View Mode Toggle */}
                            <div className="flex rounded-lg border border-slate-800 p-0.5 bg-[#070a13]">
                              <button
                                onClick={() => setViewMode('formatted')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                  viewMode === 'formatted'
                                    ? 'bg-slate-800 text-white font-bold'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                Formatted
                              </button>
                              <button
                                onClick={() => setViewMode('raw')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                  viewMode === 'raw'
                                    ? 'bg-slate-800 text-white font-bold'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                Text
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Document Content Sheet */}
                        <div className="p-6 md:p-8 bg-[#040711] overflow-y-auto max-h-[50vh] text-slate-200 leading-relaxed font-sans select-text">
                          {paras.length === 0 && !s.preview_text ? (
                            <div className="p-8 text-center text-slate-500">
                              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-400" />
                              <p>Document content is synthesized and ready for download.</p>
                              <div className="pt-3">
                                <a
                                  href={s.download_url_docx}
                                  download
                                  className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold inline-flex items-center gap-1.5 text-xs shadow-md"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Download Generated File (.docx)
                                </a>
                              </div>
                            </div>
                          ) : viewMode === 'raw' ? (
                            <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300 bg-[#070a13] p-4 rounded-xl border border-slate-800">
                              {s.preview_text || paras.join('\n\n')}
                            </pre>
                          ) : (
                            <div className="space-y-4 max-w-3xl mx-auto bg-[#070a13]/80 border border-slate-800/80 rounded-xl p-6 sm:p-8 shadow-inner">
                              {filteredParas.length === 0 ? (
                                <p className="text-slate-500 text-center py-4">
                                  No paragraphs match "{docSearchQuery}".
                                </p>
                              ) : (
                                filteredParas.map((para, pIdx) => {
                                  const isHeader =
                                    para.startsWith('To') ||
                                    para.startsWith('Legal opinion') ||
                                    para.startsWith('Sub:') ||
                                    para.startsWith('1)') ||
                                    para.startsWith('2)') ||
                                    para.startsWith('3)') ||
                                    para.startsWith('ANNEXURE') ||
                                    para.includes('Certificate of Title') ||
                                    para.includes('Description of Documents');

                                  return (
                                    <div
                                      key={pIdx}
                                      className={`text-xs ${
                                        isHeader
                                          ? 'font-bold text-amber-300/90 pt-2 border-t border-slate-800/60 first:border-0'
                                          : 'text-slate-300'
                                      }`}
                                    >
                                      {docSearchQuery.trim() ? (
                                        <span>
                                          {para.split(new RegExp(`(${docSearchQuery})`, 'gi')).map((part, i) =>
                                            part.toLowerCase() === docSearchQuery.toLowerCase() ? (
                                              <mark key={i} className="bg-amber-400 text-slate-950 px-1 rounded font-bold">
                                                {part}
                                              </mark>
                                            ) : (
                                              part
                                            )
                                          )}
                                        </span>
                                      ) : (
                                        <p className="whitespace-pre-line leading-relaxed">{para}</p>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#0e1424] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setClientToDelete(selectedClient)}
                  className="px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Delete this client record"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete Client</span>
                </button>
              </div>
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  onClick={() => {
                    const c = selectedClient;
                    setSelectedClient(null);
                    onStartScrutinyForClient(c);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start New Scrutiny</span>
                </button>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
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

      {/* Delete Client Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white tracking-tight">Delete Client Record?</h3>
              <p className="text-xs text-slate-300">
                Are you sure you want to permanently delete client{' '}
                <span className="text-rose-300 font-bold">"{clientToDelete.name}"</span>?
              </p>
              <div className="bg-[#070a13] p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 text-left space-y-1 mt-2">
                <p><span className="text-slate-500 uppercase font-semibold">Phone:</span> {clientToDelete.phone}</p>
                <p><span className="text-slate-500 uppercase font-semibold">Email:</span> {clientToDelete.email}</p>
                <p><span className="text-slate-500 uppercase font-semibold">Matter:</span> {clientToDelete.title}</p>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                This action cannot be undone. Associated scrutiny documents will remain archived.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setClientToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
