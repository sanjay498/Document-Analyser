import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FolderPlus,
  Trash2,
  Edit2,
  Check,
  ArrowRight,
  Table as TableIcon,
  Bookmark,
  Building2,
  Layers,
  Search
} from 'lucide-react';
import {
  listTemplates,
  renameTemplate,
  deleteTemplate,
  useTemplateInSession,
  saveTemplateToLibrary,
  listBankFolders
} from '../services/api';
import type { TemplateSummary, UseTemplateResponse } from '../types';

interface TemplateLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId?: string;
  onSelectTemplate: (res: UseTemplateResponse) => void;
}

export const TemplateLibraryModal: React.FC<TemplateLibraryModalProps> = ({
  isOpen,
  onClose,
  currentSessionId,
  onSelectTemplate,
}) => {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [bankFolders, setBankFolders] = useState<string[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try {
      return localStorage.getItem('lex_library_template_search') || '';
    } catch {
      return '';
    }
  });

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    try {
      localStorage.setItem('lex_library_template_search', val);
    } catch {}
  };
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isSavingCurrent, setIsSavingCurrent] = useState(false);
  const [saveCurrentName, setSaveCurrentName] = useState('');
  const [saveCurrentBank, setSaveCurrentBank] = useState('Default');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTemplates = async () => {
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
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const allBanks = useMemo(() => {
    const set = new Set<string>();
    bankFolders.forEach((b) => {
      if (b && b !== 'General' && b !== 'Default') set.add(b);
    });
    templates.forEach((t) => {
      if (t.bank_name && t.bank_name !== 'General' && t.bank_name !== 'Default') {
        set.add(t.bank_name);
      }
    });
    return Array.from(set);
  }, [bankFolders, templates]);

  const defaultCount = useMemo(() => {
    return templates.filter((t) => !t.bank_name || t.bank_name === 'Default' || t.bank_name === 'General').length;
  }, [templates]);

  const bankCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of allBanks) counts[b] = 0;
    for (const t of templates) {
      if (t.bank_name && t.bank_name !== 'General' && t.bank_name !== 'Default') {
        counts[t.bank_name] = (counts[t.bank_name] || 0) + 1;
      }
    }
    return counts;
  }, [allBanks, templates]);

  const DOCUMENT_CATEGORIES = [
    { id: 'all', label: 'All Types' },
    { id: 'opinion', label: 'Title Opinion / Scrutiny', keywords: ['opinion', 'scrutiny', 'search', 'report', 'clearance', 'title'] },
    { id: 'agri', label: 'Agricultural Land', keywords: ['agri', 'agricultural', '7/12', 'farm', 'cultivation', 'land'] },
    { id: 'housing', label: 'Housing & Mortgage', keywords: ['housing', 'mortgage', 'loan', 'residential', 'flat', 'apartment'] },
    { id: 'commercial', label: 'Commercial & Lease', keywords: ['commercial', 'industrial', 'lease', 'office', 'shop', 'business'] },
  ];

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.bank_name && t.bank_name.toLowerCase().includes(q));

      const isDefault = !t.bank_name || t.bank_name === 'Default' || t.bank_name === 'General';
      const matchesBank =
        selectedBank === 'all'
          ? true
          : selectedBank === 'Default'
          ? isDefault
          : (t.bank_name || 'Default') === selectedBank;

      let matchesCategory = true;
      if (selectedCategory !== 'all') {
        const catDef = DOCUMENT_CATEGORIES.find((c) => c.id === selectedCategory);
        if (catDef && catDef.keywords) {
          const fullText = `${t.name} ${t.bank_name || ''}`.toLowerCase();
          matchesCategory = catDef.keywords.some((kw) => fullText.includes(kw));
        }
      }

      return matchesSearch && matchesBank && matchesCategory;
    });
  }, [templates, searchQuery, selectedBank, selectedCategory]);

  if (!isOpen) return null;

  const handleUseTemplate = async (templateId: string) => {
    try {
      const res = await useTemplateInSession(templateId);
      onSelectTemplate(res);
      onClose();
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
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to rename template' });
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template from the library?')) return;
    try {
      await deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to delete template' });
    }
  };

  const handleSaveCurrentSession = async () => {
    if (!currentSessionId) return;
    setIsSavingCurrent(true);
    try {
      const targetBank = (!saveCurrentBank || saveCurrentBank === 'General') ? 'Default' : saveCurrentBank;
      const saved = await saveTemplateToLibrary(
        undefined,
        currentSessionId,
        saveCurrentName.trim() || undefined,
        targetBank
      );
      setTemplates((prev) => [saved, ...prev]);
      setSaveCurrentName('');
      setMessage({
        type: 'success',
        text: `Saved "${saved.name}" to folder "${saved.bank_name || targetBank}" with cached metadata!`
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save current template' });
    } finally {
      setIsSavingCurrent(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="glass-panel w-full max-w-4xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Bank & Template Library</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Instant Load
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Select an institution's scrutiny format to start your verification session without re-parsing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`px-6 py-2.5 text-xs font-medium border-b flex items-center justify-between ${
              message.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
        )}

        {/* Quick Save Current Session Template */}
        {currentSessionId && (
          <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 w-full sm:w-auto">
              <FolderPlus className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Save active document as template:</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <select
                value={saveCurrentBank}
                onChange={(e) => setSaveCurrentBank(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="Default">📁 Default (No Bank)</option>
                {allBanks.map((b) => (
                  <option key={b} value={b}>
                    🏛️ {b}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Template name (optional)..."
                value={saveCurrentName}
                onChange={(e) => setSaveCurrentName(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400 flex-1 sm:w-48"
              />
              <button
                onClick={handleSaveCurrentSession}
                disabled={isSavingCurrent}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shrink-0"
              >
                {isSavingCurrent ? 'Saving...' : 'Save to Folder'}
              </button>
            </div>
          </div>
        )}

        {/* Bank Folders Bar & Search */}
        <div className="px-6 py-3 bg-slate-900/40 border-b border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            {/* Bank Folders scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-0.5 max-w-full">
              <button
                onClick={() => setSelectedBank('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs shrink-0 transition-all ${
                  selectedBank === 'all'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>All</span>
                <span className="text-[10px] opacity-75">({templates.length})</span>
              </button>

              <button
                onClick={() => setSelectedBank('Default')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs shrink-0 transition-all ${
                  selectedBank === 'Default'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Building2 className={`w-3 h-3 ${selectedBank === 'Default' ? 'text-amber-400' : 'text-slate-500'}`} />
                <span className="whitespace-nowrap">Default</span>
                <span className="text-[10px] opacity-75">({defaultCount})</span>
              </button>

              {allBanks.map((bank) => {
                const count = bankCounts[bank] || 0;
                const isSelected = selectedBank === bank;
                return (
                  <button
                    key={bank}
                    onClick={() => setSelectedBank(bank)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs shrink-0 transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Building2 className={`w-3 h-3 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="whitespace-nowrap">{bank}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Search with explicit Clear button (Never auto-clears) */}
            <div className="relative w-56 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search formats..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-8 pr-7 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pt-2 border-t border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
              Category:
            </span>
            {DOCUMENT_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-all ${
                    isSelected
                      ? 'bg-sky-500 text-white font-semibold shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
            {(searchQuery || selectedBank !== 'all' || selectedCategory !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  handleSearchChange('');
                  setSelectedBank('all');
                  setSelectedCategory('all');
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 underline shrink-0 ml-2"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Template List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading saved templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-400">
                {selectedBank === 'all'
                  ? 'No templates found in library'
                  : `No templates found for "${selectedBank}"`}
              </p>
              <p className="text-xs text-slate-500">
                Switch bank folders or upload a new template from the Custom Template Library page.
              </p>
            </div>
          ) : (
            filteredTemplates.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                        !t.bank_name || t.bank_name === 'Default' || t.bank_name === 'General'
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-sky-500/10 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      <Building2 className="w-2.5 h-2.5 text-sky-400" />
                      <span>{!t.bank_name || t.bank_name === 'General' ? 'Default' : t.bank_name}</span>
                    </span>

                    {editingId === t.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveRename(t.id)}
                          className="p-1 text-emerald-400 hover:bg-emerald-950/40 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-white flex-1 min-w-0 break-words" title={t.name}>
                          {t.name}
                        </h4>
                        <button
                          onClick={() => handleStartRename(t)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-opacity"
                          title="Rename template"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="px-2 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                      {t.fields_count} Dynamic Fields
                    </span>
                    {t.table_groups_count > 0 && (
                      <span className="px-2 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-mono">
                        <TableIcon className="w-2.5 h-2.5" />
                        {t.table_groups_count} Tables
                      </span>
                    )}
                    <span className="text-slate-500">
                      Added {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleUseTemplate(t.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                  >
                    <span>Use Template</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing <strong className="text-slate-200">{filteredTemplates.length}</strong> of {templates.length} templates
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
