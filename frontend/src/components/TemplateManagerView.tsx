import React, { useState, useEffect, useMemo } from 'react';
import {
  Bookmark,
  Plus,
  Search,
  Upload,
  Trash2,
  Edit3,
  Download,
  ArrowRight,
  Eye,
  Check,
  X,
  FileText,
  Table as TableIcon,
  Highlighter,
  Building2,
  Folder,
  FolderPlus,
  Layers
} from 'lucide-react';
import {
  listTemplates,
  renameTemplate,
  deleteTemplate,
  deleteAllTemplates,
  useTemplateInSession,
  saveTemplateToLibrary,
  getTemplateDetail,
  getTemplateDownloadUrl,
  updateTemplateBank,
  listBankFolders,
  createTemplateGroup,
  deleteTemplateGroup,
} from '../services/api';
import type { TemplateSummary, UseTemplateResponse, HighlightedField, DynamicTableGroup } from '../types';
import { FolderEmptyIllustration } from './illustrations/LegalIllustrations';

interface TemplateManagerViewProps {
  currentSessionId?: string;
  onSelectTemplate: (res: UseTemplateResponse) => void;
  onNavigateToWorkspace: () => void;
  onOpenInStudio?: (templateId: string) => void;
}

export const TemplateManagerView: React.FC<TemplateManagerViewProps> = ({
  onSelectTemplate,
  onNavigateToWorkspace,
  onOpenInStudio,
}) => {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [bankFolders, setBankFolders] = useState<string[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [inspectTemplate, setInspectTemplate] = useState<{
    id: string;
    name: string;
    bank_name?: string;
    fields: HighlightedField[];
    table_groups: DynamicTableGroup[];
  } | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCustomName, setUploadCustomName] = useState('');
  const [uploadBank, setUploadBank] = useState<string>('General');
  const [isCustomUploadBank, setIsCustomUploadBank] = useState(false);
  const [customUploadBankName, setCustomUploadBankName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // New bank modal state
  const [showNewBankModal, setShowNewBankModal] = useState(false);
  const [newBankInput, setNewBankInput] = useState('');
  const [templateToMoveToNewBank, setTemplateToMoveToNewBank] = useState<string | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTemplatesAndBanks = async () => {
    setIsLoading(true);
    try {
      const [list, banks] = await Promise.all([
        listTemplates(),
        listBankFolders().catch(() => [])
      ]);
      setTemplates(list);
      setBankFolders(banks);
    } catch (err: any) {
      console.error('Failed to list templates', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplatesAndBanks();
  }, []);

  const allBanks = useMemo(() => {
    const set = new Set<string>();
    bankFolders.forEach((b) => set.add(b));
    templates.forEach((t) => {
      if (t.bank_name) set.add(t.bank_name);
    });
    return Array.from(set);
  }, [bankFolders, templates]);

  const bankCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of allBanks) {
      counts[b] = 0;
    }
    for (const t of templates) {
      const b = t.bank_name || 'General';
      counts[b] = (counts[b] || 0) + 1;
    }
    return counts;
  }, [allBanks, templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.bank_name && t.bank_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesBank = selectedBank === 'all' || (t.bank_name || 'General') === selectedBank;
      return matchesSearch && matchesBank;
    });
  }, [templates, searchQuery, selectedBank]);

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all templates and groups from your library?')) return;
    setIsLoading(true);
    try {
      await deleteAllTemplates();
      setTemplates([]);
      setBankFolders([]);
      setSelectedBank('all');
      setMessage({ type: 'success', text: 'All templates and custom groups have been deleted from your library.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete templates' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    try {
      const res = await useTemplateInSession(templateId);
      onSelectTemplate(res);
      onNavigateToWorkspace();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to use template' });
    }
  };

  const handleStartRename = (t: TemplateSummary) => {
    setEditingId(t.id);
    setEditName(t.name);
  };

  const handleSaveRename = async (templateId: string) => {
    if (!editName.trim()) return;
    try {
      const updated = await renameTemplate(templateId, editName.trim());
      setTemplates((prev) => prev.map((t) => (t.id === templateId ? updated : t)));
      setEditingId(null);
      setMessage({ type: 'success', text: `Template renamed to "${updated.name}"` });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to rename template' });
    }
  };

  const handleMoveBank = async (templateId: string, bankName: string) => {
    if (bankName === '__NEW__') {
      setTemplateToMoveToNewBank(templateId);
      setNewBankInput('');
      setShowNewBankModal(true);
      return;
    }
    try {
      const updated = await updateTemplateBank(templateId, bankName);
      setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, bank_name: bankName } : t)));
      setMessage({ type: 'success', text: `Moved "${updated.name}" to folder "${bankName}"` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to move template' });
    }
  };

  const handleCreateNewBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBankInput.trim();
    if (!trimmed) return;
    try {
      await createTemplateGroup(trimmed);
      if (!bankFolders.includes(trimmed)) {
        setBankFolders((prev) => [...prev, trimmed]);
      }
      if (templateToMoveToNewBank) {
        await handleMoveBank(templateToMoveToNewBank, trimmed);
        setTemplateToMoveToNewBank(null);
      }
      setSelectedBank(trimmed);
      setShowNewBankModal(false);
      setNewBankInput('');
      setMessage({ type: 'success', text: `Created template group "${trimmed}"` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create template group' });
    }
  };

  const handleDeleteGroup = async (groupName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Are you sure you want to delete template group "${groupName}" and all templates inside it?`)) return;
    try {
      await deleteTemplateGroup(groupName, true);
      setBankFolders((prev) => prev.filter((b) => b !== groupName));
      setTemplates((prev) => prev.filter((t) => t.bank_name !== groupName));
      if (selectedBank === groupName) {
        setSelectedBank('all');
      }
      setMessage({ type: 'success', text: `Template group "${groupName}" deleted.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete template group' });
    }
  };

  const handleDelete = async (templateId: string, templateName: string) => {
    if (!confirm(`Are you sure you want to delete "${templateName}" from your template library?`)) return;
    try {
      await deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setMessage({ type: 'success', text: `Template "${templateName}" deleted` });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to delete template' });
    }
  };

  const handleInspect = async (templateId: string) => {
    try {
      const detail = await getTemplateDetail(templateId);
      setInspectTemplate(detail);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to inspect template fields' });
    }
  };

  const handleOpenUploadForBank = (bankName?: string) => {
    const target = bankName || (selectedBank !== 'all' ? selectedBank : 'General');
    setUploadBank(target);
    setIsCustomUploadBank(false);
    setCustomUploadBankName('');
    setShowUploadModal(true);
  };

  const handleUploadNewTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      const targetBank = isCustomUploadBank ? customUploadBankName.trim() || 'General' : uploadBank;
      const saved = await saveTemplateToLibrary(
        uploadFile,
        undefined,
        uploadCustomName.trim() || undefined,
        targetBank
      );
      setTemplates((prev) => [saved, ...prev]);
      if (!bankFolders.includes(targetBank)) {
        setBankFolders((prev) => [...prev, targetBank]);
      }
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadCustomName('');
      setIsCustomUploadBank(false);
      setCustomUploadBankName('');
      setMessage({
        type: 'success',
        text: `Created template "${saved.name}" in folder "${saved.bank_name || targetBank}" with ${saved.fields_count} yellow highlighted dynamic fields!`
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create template' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Top Banner & Actions */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Custom Template Library</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Custom Groups
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Create your own template groups and folders. Upload multiple custom formats per group.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {(templates.length > 0 || allBanks.length > 0) && (
            <button
              onClick={handleDeleteAll}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 transition-all shadow-sm cursor-pointer"
              title="Delete all templates and groups from library"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Delete All</span>
            </button>
          )}

          <button
            onClick={() => {
              setTemplateToMoveToNewBank(null);
              setNewBankInput('');
              setShowNewBankModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm cursor-pointer"
            title="Create a new template group / folder"
          >
            <FolderPlus className="w-4 h-4 text-amber-400" />
            <span>+ Create Template Group</span>
          </button>

          <button
            onClick={() => handleOpenUploadForBank()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Template</span>
          </button>
        </div>
      </div>

      {/* Alert / Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between animate-slide-up ${
            message.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white text-xs">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TEMPLATE GROUPS & FOLDERS BAR */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Folder className="w-4 h-4 text-amber-400" />
            <span>Template Groups & Folders</span>
          </div>
          <span className="text-[11px] text-slate-500">
            {allBanks.length === 0
              ? 'Create your first template group to categorize formats'
              : 'Select a group to filter formats or upload templates'}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {/* All Templates Tab */}
          <button
            onClick={() => setSelectedBank('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium shrink-0 transition-all cursor-pointer ${
              selectedBank === 'all'
                ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30 border border-indigo-500'
                : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Templates</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                selectedBank === 'all' ? 'bg-indigo-500/40 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {templates.length}
            </span>
          </button>

          {/* Individual Template Groups */}
          {allBanks.map((bank) => {
            const count = bankCounts[bank] || 0;
            const isSelected = selectedBank === bank;
            return (
              <div
                key={bank}
                className="group/bank relative shrink-0 flex items-center"
              >
                <button
                  onClick={() => setSelectedBank(bank)}
                  className={`flex items-center gap-2 pl-3.5 pr-2 py-2 rounded-xl text-xs font-medium shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/50 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span className="whitespace-nowrap">{bank}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                      isSelected
                        ? 'bg-amber-500/30 text-amber-200'
                        : count > 0
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-slate-850 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                  <span
                    onClick={(e) => handleDeleteGroup(bank, e)}
                    className="opacity-0 group-hover/bank:opacity-100 hover:text-rose-400 p-0.5 ml-1 transition-opacity cursor-pointer rounded"
                    title={`Delete group "${bank}"`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </span>
                </button>
              </div>
            );
          })}

          {/* New Group Quick Button */}
          <button
            onClick={() => {
              setTemplateToMoveToNewBank(null);
              setNewBankInput('');
              setShowNewBankModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-amber-300 border border-dashed border-slate-700 hover:border-amber-500/50 shrink-0 transition-all hover:bg-amber-500/5 cursor-pointer"
            title="Create a new template group"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Group</span>
          </button>
        </div>
      </div>

      {/* Active Folder Header + Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {selectedBank === 'all' ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Folder className="w-4 h-4 text-slate-500" />
              <span>Showing all templates across custom groups</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Folder className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-white">{selectedBank}</span>
              <span className="text-slate-500">
                ({filteredTemplates.length} {filteredTemplates.length === 1 ? 'template' : 'templates'} in this group)
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search in ${selectedBank === 'all' ? 'all templates' : selectedBank}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {selectedBank !== 'all' && (
            <button
              onClick={() => handleOpenUploadForBank(selectedBank)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all shrink-0 cursor-pointer"
              title={`Upload a new template directly to ${selectedBank}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload to {selectedBank.split(' ')[0]}</span>
            </button>
          )}
        </div>
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading templates library...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-2xl p-12 text-center border border-slate-800 bg-[#0b0f19] space-y-4">
          <FolderEmptyIllustration size={100} className="mx-auto opacity-80" />
          <div>
            <h3 className="text-sm font-bold text-white">
              {allBanks.length === 0 && templates.length === 0
                ? 'Your Template Library is Empty'
                : selectedBank === 'all'
                ? 'No Templates Found'
                : `No Templates in Group "${selectedBank}"`}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              {allBanks.length === 0 && templates.length === 0
                ? 'Upload your first Word (.docx) legal opinion template to organize by bank or transaction type.'
                : selectedBank === 'all'
                ? "No templates match your search. Upload a Word (.docx) template or create a new group."
                : `No templates have been added to "${selectedBank}" yet. You can upload multiple distinct templates under this group.`}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setTemplateToMoveToNewBank(null);
                setNewBankInput('');
                setShowNewBankModal(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-amber-400" />
              <span>+ Create Template Group</span>
            </button>
            <button
              onClick={() => handleOpenUploadForBank(selectedBank !== 'all' ? selectedBank : (allBanks[0] || 'General'))}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Template</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((t) => (
            <div
              key={t.id}
              className="glass-panel rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                {/* Bank Folder Badge & Format Pill */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/30 flex items-center gap-1.5 shrink-0">
                      <Building2 className="w-3 h-3 text-sky-400" />
                      <span>{t.bank_name || 'General'}</span>
                    </span>

                    {/* Quick Move to Bank Folder dropdown */}
                    <div className="relative inline-block">
                      <select
                        value={t.bank_name || 'General'}
                        onChange={(e) => handleMoveBank(t.id, e.target.value)}
                        className="bg-slate-900 hover:bg-slate-850 border border-slate-700/70 hover:border-slate-600 rounded-md px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                        title="Move this template to another bank folder"
                      >
                        <optgroup label="Move to Bank Folder:">
                          {allBanks.map((b) => (
                            <option key={b} value={b}>
                              📁 {b}
                            </option>
                          ))}
                        </optgroup>
                        <option value="__NEW__">+ New Bank Folder...</option>
                      </select>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700 uppercase shrink-0">
                    {t.name.split('.').pop() || 'DOCX'}
                  </span>
                </div>

                {/* Template Name & Details */}
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {editingId === t.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none w-full"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(t.id)}
                          className="p-1 text-emerald-400 hover:bg-emerald-950/40 rounded shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-bold text-white truncate max-w-[280px]" title={t.name}>
                          {t.name}
                        </h3>
                        <button
                          onClick={() => handleStartRename(t)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-white transition-opacity"
                          title="Edit template name"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Added on {new Date(t.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Metadata Pills */}
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-semibold">
                    {t.fields_count} Yellow Highlight Runs
                  </span>
                  {t.table_groups_count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-mono font-semibold">
                      <TableIcon className="w-3 h-3" />
                      {t.table_groups_count} Dynamic Tables
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleInspect(t.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="Preview detected fields & table columns"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>

                  <a
                    href={getTemplateDownloadUrl(t.id)}
                    download={t.name}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="Download template document"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>

                  {onOpenInStudio && (
                    <button
                      onClick={() => onOpenInStudio(t.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-300 hover:bg-amber-500/20 bg-amber-500/10 border border-amber-500/30 transition-colors"
                      title="Open this template in Highlight Studio to mark new highlights or edit"
                    >
                      <Highlighter className="w-3.5 h-3.5 text-amber-400" />
                      <span>Studio</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => handleUseTemplate(t.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                >
                  <span>Use Template</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspect Template Drawer / Modal */}
      {inspectTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{inspectTemplate.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                      <Building2 className="w-2.5 h-2.5" />
                      {inspectTemplate.bank_name || 'General'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Detected {inspectTemplate.fields.length} yellow highlighted fields and {inspectTemplate.table_groups.length} dynamic table structures
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectTemplate(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <h4 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                Detected Highlighted Field Runs ({inspectTemplate.fields.length})
              </h4>
              <div className="space-y-2.5">
                {inspectTemplate.fields.map((f, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-500">Field #{idx + 1}</span>
                      <span className="px-2 py-0.5 rounded yellow-badge font-mono font-bold text-[11px]">
                        {f.original_text}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      {f.context_with_marker.split('[FIELD:').map((part, pIdx) => {
                        if (pIdx === 0) return part;
                        const [fieldTxt, rest] = part.split(']');
                        return (
                          <React.Fragment key={pIdx}>
                            <span className="font-bold text-amber-300 bg-amber-500/20 px-1 py-0.2 rounded">
                              {fieldTxt}
                            </span>
                            {rest}
                          </React.Fragment>
                        );
                      })}
                    </p>
                  </div>
                ))}
              </div>

              {inspectTemplate.table_groups.length > 0 && (
                <div className="pt-4 space-y-3">
                  <h4 className="font-bold text-purple-400 uppercase tracking-wider text-[11px]">
                    Dynamic Table Groups ({inspectTemplate.table_groups.length})
                  </h4>
                  {inspectTemplate.table_groups.map((tg, tgIdx) => (
                    <div key={tgIdx} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                      <div className="flex items-center gap-2">
                        <TableIcon className="w-3.5 h-3.5 text-purple-400" />
                        <span className="font-bold text-slate-200">Table #{tg.table_index + 1} Columns</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tg.columns.map((c, cIdx) => (
                          <span key={cIdx} className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                            {c.header}: <span className="text-amber-300 font-mono">"{c.sample_text}"</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <a
                href={getTemplateDownloadUrl(inspectTemplate.id)}
                download={inspectTemplate.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template (.docx)</span>
              </a>
              <button
                onClick={() => {
                  handleUseTemplate(inspectTemplate.id);
                  setInspectTemplate(null);
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <span>Use This Template</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload New Template Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl p-6 relative animate-scale-up space-y-4">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Upload New Template</h3>
                <p className="text-[11px] text-slate-400">Upload a .docx, .pptx, or .pdf with yellow highlight placeholders</p>
              </div>
            </div>

            <form onSubmit={handleUploadNewTemplate} className="space-y-4 text-xs">
              {/* Bank Selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                  <span>Template Group / Folder</span>
                  <span className="text-[10px] text-slate-500 font-normal">Organizes templates under this group</span>
                </label>
                <div className="space-y-2">
                  <select
                    value={isCustomUploadBank || allBanks.length === 0 ? '__CUSTOM__' : uploadBank}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setIsCustomUploadBank(true);
                      } else {
                        setIsCustomUploadBank(false);
                        setUploadBank(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {allBanks.map((b) => (
                      <option key={b} value={b}>
                        📁 {b}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Create New Template Group...</option>
                  </select>

                  {(isCustomUploadBank || allBanks.length === 0) && (
                    <input
                      type="text"
                      placeholder="Enter new template group name (e.g. State Bank of India, Commercial Loan)..."
                      value={customUploadBankName}
                      onChange={(e) => setCustomUploadBankName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/50 text-slate-200 focus:outline-none focus:border-amber-400"
                      autoFocus
                      required
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Template Title / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Bank Housing Loan Legal Scrutiny Report.docx"
                  value={uploadCustomName}
                  onChange={(e) => setUploadCustomName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select File (.docx, .pptx, .pdf)</label>
                <input
                  type="file"
                  accept=".docx,.pptx,.pdf"
                  required
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setUploadFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUploading ? (
                    <span>Parsing & Saving...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save to Template Group</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Template Group Modal */}
      {showNewBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6 relative animate-scale-up space-y-4">
            <button
              onClick={() => {
                setShowNewBankModal(false);
                setTemplateToMoveToNewBank(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <FolderPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Create Custom Template Group</h3>
                <p className="text-[11px] text-slate-400">
                  {templateToMoveToNewBank
                    ? 'Create a custom group and move the selected template into it'
                    : 'Add a new group or folder to organize your templates'}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateNewBank} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Template Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. State Bank of India, Commercial Loan, HDFC Mortgage..."
                  value={newBankInput}
                  onChange={(e) => setNewBankInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400"
                  autoFocus
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewBankModal(false);
                    setTemplateToMoveToNewBank(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newBankInput.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Template Group</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
