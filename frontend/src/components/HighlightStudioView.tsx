import React, { useState, useRef, useEffect } from 'react';
import {
  Highlighter,
  Plus,
  Trash2,
  Download,
  Bookmark,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Eye,
  Check,
  X,
  Table as TableIcon,
  RotateCcw,
  RotateCw,
  Eraser,
  Upload,
  FileText,
  Edit3
} from 'lucide-react';
import {
  convertEditorToDocx,
  saveEditorAsTemplate,
  useEditorInSession,
  importFileToEditor,
  importTemplateToEditor,
  updateTemplateInLibrary,
  type EditorDocumentPayload,
  type EditorParagraph,
  type EditorTextRun,
  type EditorDynamicTable,
  type EditorElement,
  type EditorTableColumn
} from '../services/api';
import type { UseTemplateResponse } from '../types';

interface HighlightStudioViewProps {
  onSelectTemplate: (res: UseTemplateResponse) => void;
  onNavigateToWorkspace: () => void;
  initialTemplateId?: string | null;
}

export const HighlightStudioView: React.FC<HighlightStudioViewProps> = ({
  onSelectTemplate,
  onNavigateToWorkspace,
  initialTemplateId,
}) => {
  const [docTitle, setDocTitle] = useState('');
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(initialTemplateId || null);
  const [isLoadingInitialTemplate, setIsLoadingInitialTemplate] = useState<boolean>(false);
  const [rawDocxBase64, setRawDocxBase64] = useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<EditorElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const pushHistoryState = (newElements: EditorElement[]) => {
    setHistory((prev) => {
      const updated = prev.slice(0, historyIndex + 1);
      return [...updated, newElements];
    });
    setHistoryIndex((prev) => prev + 1);
    setElements(newElements);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      const targetElements = history[targetIndex];
      setHistoryIndex(targetIndex);
      setElements(targetElements);
      setMessage({ type: 'success', text: 'Undid last action' });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      const targetElements = history[targetIndex];
      setHistoryIndex(targetIndex);
      setElements(targetElements);
      setMessage({ type: 'success', text: 'Redid action' });
    }
  };

  // Keyboard shortcut listener: Cmd/Ctrl+Z (Undo) and Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (historyIndex < history.length - 1) {
            const targetIndex = historyIndex + 1;
            const targetElements = history[targetIndex];
            setHistoryIndex(targetIndex);
            setElements(targetElements);
            setMessage({ type: 'success', text: 'Redid action' });
          }
        } else {
          if (historyIndex > 0) {
            const targetIndex = historyIndex - 1;
            const targetElements = history[targetIndex];
            setHistoryIndex(targetIndex);
            setElements(targetElements);
            setMessage({ type: 'success', text: 'Undid last action' });
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
          const targetIndex = historyIndex + 1;
          const targetElements = history[targetIndex];
          setHistoryIndex(targetIndex);
          setElements(targetElements);
          setMessage({ type: 'success', text: 'Redid action' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // View Mode: 'visual' or 'fulltext'
  const [viewMode, setViewMode] = useState<'visual' | 'fulltext'>('visual');
  const [paperMode, setPaperMode] = useState<boolean>(true);
  const [fullTextContent, setFullTextContent] = useState('');

  const [activeSelectionRange, setActiveSelectionRange] = useState<{
    paragraphIdx: number;
    start: number;
    end: number;
    text: string;
  } | null>(null);

  const [floatingPos, setFloatingPos] = useState<{ top: number; left: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableTitle, setNewTableTitle] = useState('Schedule Table');
  const [newTableCols, setNewTableCols] = useState('Item, Description, Amount, Due Date');

  // Sync fullTextContent whenever switching into fulltext mode
  useEffect(() => {
    if (viewMode === 'fulltext') {
      const textLines = elements.map((elem) => {
        if (elem.type === 'paragraph' && elem.paragraph) {
          return elem.paragraph.runs
            .map((r: EditorTextRun) => (r.is_highlighted ? `[FIELD: ${r.text}]` : r.text))
            .join('');
        }
        if (elem.type === 'table' && elem.table) {
          return `[TABLE: ${elem.table.title || 'Dynamic Table'}]`;
        }
        return '';
      }).filter((l) => l.length > 0);
      setFullTextContent(textLines.join('\n\n'));
    }
  }, [viewMode, elements]);

  // Count total highlighted fields
  const totalHighlights = elements.reduce((acc, elem) => {
    if (elem.type === 'paragraph' && elem.paragraph) {
      return acc + elem.paragraph.runs.filter((r: EditorTextRun) => r.is_highlighted && r.text.trim().length > 0).length;
    }
    if (elem.type === 'table' && elem.table) {
      const colHl = elem.table.columns.filter((c: EditorTableColumn) => c.is_highlighted).length;
      const rowHl = (elem.table.rows || []).reduce(
        (rAcc: number, row: EditorTextRun[]) => rAcc + row.filter((c: EditorTextRun) => c.is_highlighted && c.text.trim().length > 0).length,
        0
      );
      return acc + colHl + rowHl;
    }
    return acc;
  }, 0);

  // Quick Reset: Clear all yellow markings across entire document
  const handleResetAllHighlights = () => {
    const cleared = elements.map((elem) => {
      if (elem.type === 'paragraph' && elem.paragraph) {
        const p = { ...elem.paragraph };
        const fullText = p.runs.map((r: EditorTextRun) => r.text).join('');
        p.runs = [{ text: fullText, is_highlighted: false, bold: p.runs[0]?.bold, italic: p.runs[0]?.italic }];
        return { ...elem, paragraph: p };
      }
      if (elem.type === 'table' && elem.table) {
        const t = { ...elem.table };
        const cols = t.columns.map((c) => ({ ...c, is_highlighted: false }));
        const rows = (t.rows || []).map((row) =>
          row.map((cell) => ({ ...cell, is_highlighted: false }))
        );
        return { ...elem, table: { ...t, columns: cols, rows } };
      }
      return elem;
    });

    pushHistoryState(cleared);
    setMessage({
      type: 'success',
      text: 'All yellow markings removed! You can now mark dynamic variables from the start. (Click Undo or press ⌘Z to restore anytime).'
    });
  };

  // Process uploaded document file (.docx, .pdf, .txt)
  const processUploadedFile = async (file: File) => {
    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await importFileToEditor(file);
      const newElems = res.elements && res.elements.length > 0 ? res.elements : (
        res.paragraphs ? res.paragraphs.map((p: EditorParagraph) => ({ type: 'paragraph' as const, paragraph: p })) : []
      );
      setDocTitle(res.title || file.name);
      setRawDocxBase64(res.raw_docx_base64);
      setHistory([newElems]);
      setHistoryIndex(0);
      setElements(newElems);
      setMessage({
        type: 'success',
        text: `Uploaded "${file.name}"! Table structures and paragraphs preserved in exact layout. Click any word or cell to toggle yellow highlights.`
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || `Failed to parse "${file.name}"`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Load existing template into Highlight Studio if initialTemplateId provided
  useEffect(() => {
    if (initialTemplateId) {
      setEditingTemplateId(initialTemplateId);
      setIsLoadingInitialTemplate(true);
      setMessage(null);
      importTemplateToEditor(initialTemplateId)
        .then((res) => {
          const newElems = res.elements && res.elements.length > 0 ? res.elements : (
            res.paragraphs ? res.paragraphs.map((p: EditorParagraph) => ({ type: 'paragraph' as const, paragraph: p })) : []
          );
          setDocTitle(res.title || 'Opinion_Template.docx');
          setRawDocxBase64(res.raw_docx_base64);
          setHistory([newElems]);
          setHistoryIndex(0);
          setElements(newElems);
          setMessage({
            type: 'success',
            text: `Loaded "${res.title || 'template'}" for editing in Highlight Studio. Click words or table cells to add or remove yellow highlights.`
          });
        })
        .catch((err: any) => {
          setMessage({
            type: 'error',
            text: err.message || 'Failed to load template into Highlight Studio'
          });
        })
        .finally(() => {
          setIsLoadingInitialTemplate(false);
        });
    } else {
      setEditingTemplateId(null);
    }
  }, [initialTemplateId]);

  // Handle file input change
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
    if (e.target) e.target.value = '';
  };

  // Handle drag and drop files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  // Handle selection inside editable paragraph
  const handleMouseUp = (elemIdx: number) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setActiveSelectionRange(null);
      setFloatingPos(null);
      return;
    }

    const text = sel.toString().trim();
    if (text.length > 0) {
      setActiveSelectionRange({
        paragraphIdx: elemIdx,
        start: 0,
        end: text.length,
        text: text
      });

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setFloatingPos({
        top: Math.max(10, rect.top - 46),
        left: Math.max(10, rect.left + rect.width / 2 - 80)
      });
    }
  };

  // Highlight the selected text in the active element
  const handleHighlightSelection = () => {
    if (!activeSelectionRange) return;
    const { paragraphIdx: elemIdx, text } = activeSelectionRange;

    const next = [...elements];
    const elem = next[elemIdx];
    if (!elem || elem.type !== 'paragraph' || !elem.paragraph) return;

    const p = { ...elem.paragraph };
    const fullPText = p.runs.map((r: EditorTextRun) => r.text).join('');
    const targetIdx = fullPText.indexOf(text);
    if (targetIdx === -1) return;

    const beforeText = fullPText.slice(0, targetIdx);
    const afterText = fullPText.slice(targetIdx + text.length);

    const newRuns: EditorTextRun[] = [];
    if (beforeText) newRuns.push({ text: beforeText, is_highlighted: false });
    newRuns.push({ text: text, is_highlighted: true, bold: false });
    if (afterText) newRuns.push({ text: afterText, is_highlighted: false });

    p.runs = newRuns;
    next[elemIdx] = { ...elem, paragraph: p };

    pushHistoryState(next);
    setActiveSelectionRange(null);
    setFloatingPos(null);
    setMessage({ type: 'success', text: `Highlighted "${text}" as dynamic template variable!` });
  };

  // 1-Click: Highlight Entire Paragraph
  const handleHighlightWholeParagraphInElement = (elemIdx: number) => {
    const next = [...elements];
    const elem = next[elemIdx];
    if (!elem || elem.type !== 'paragraph' || !elem.paragraph) return;

    const p = { ...elem.paragraph };
    const fullText = p.runs.map((r: EditorTextRun) => r.text).join(' ');
    p.runs = [{ text: fullText, is_highlighted: true, bold: p.runs[0]?.bold }];
    next[elemIdx] = { ...elem, paragraph: p };

    pushHistoryState(next);
    setMessage({ type: 'success', text: `Highlighted full paragraph as dynamic template variable!` });
  };

  // 1-Click: Clear Highlights in Paragraph
  const handleClearParagraphHighlightsInElement = (elemIdx: number) => {
    const next = [...elements];
    const elem = next[elemIdx];
    if (!elem || elem.type !== 'paragraph' || !elem.paragraph) return;

    const p = { ...elem.paragraph };
    const fullText = p.runs.map((r: EditorTextRun) => r.text).join(' ');
    p.runs = [{ text: fullText, is_highlighted: false, bold: p.runs[0]?.bold }];
    next[elemIdx] = { ...elem, paragraph: p };

    pushHistoryState(next);
  };

  // Toggle highlight for a specific run in paragraph
  const handleToggleRunHighlightInElement = (elemIdx: number, rIdx: number) => {
    const next = [...elements];
    const elem = next[elemIdx];
    if (!elem || elem.type !== 'paragraph' || !elem.paragraph) return;

    const p = { ...elem.paragraph };
    const runs = [...p.runs];
    runs[rIdx] = { ...runs[rIdx], is_highlighted: !runs[rIdx].is_highlighted };
    p.runs = runs;
    next[elemIdx] = { ...elem, paragraph: p };

    pushHistoryState(next);
  };

  // Toggle highlight for table cell
  const handleToggleTableCellHighlight = (elemIdx: number, rIdx: number, cIdx: number) => {
    const next = [...elements];
    const elem = next[elemIdx];
    if (!elem || elem.type !== 'table' || !elem.table || !elem.table.rows) return;

    const t = { ...elem.table };
    const rows = [...(t.rows as EditorTextRun[][])];
    const row = [...rows[rIdx]];
    row[cIdx] = { ...row[cIdx], is_highlighted: !row[cIdx].is_highlighted };
    rows[rIdx] = row;
    t.rows = rows;
    next[elemIdx] = { ...elem, table: t };

    pushHistoryState(next);
  };

  // Toggle highlight for table column sample
  const handleToggleColumnHighlightInElement = (elemIdx: number, cIdx: number) => {
    const next = [...elements];
    const elem = next[elemIdx];
    if (!elem || elem.type !== 'table' || !elem.table) return;

    const t = { ...elem.table };
    const cols = [...t.columns];
    cols[cIdx] = { ...cols[cIdx], is_highlighted: !cols[cIdx].is_highlighted };
    t.columns = cols;
    next[elemIdx] = { ...elem, table: t };

    pushHistoryState(next);
  };

  const handleDeleteElement = (elemIdx: number) => {
    if (elements.length <= 1) return;
    const next = elements.filter((_, idx) => idx !== elemIdx);
    pushHistoryState(next);
  };

  // In Full Text Mode: Apply [FIELD: ...] to selection
  const handleHighlightInFullText = () => {
    const textarea = fullTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = fullTextContent.slice(start, end).trim();

    if (!selected) {
      setMessage({ type: 'error', text: 'Please select text inside the editor first to highlight it.' });
      return;
    }

    const before = fullTextContent.slice(0, start);
    const after = fullTextContent.slice(end);
    const newText = `${before}[FIELD: ${selected}]${after}`;
    setFullTextContent(newText);
    setMessage({ type: 'success', text: `Highlighted "${selected}" as [FIELD: ${selected}]!` });
  };

  // Save Full Text Changes back into elements
  const handleApplyFullTextChanges = () => {
    const blocks = fullTextContent.split(/\n\s*\n+/);
    const newElements: EditorElement[] = [];

    for (const block of blocks) {
      const cleanBlock = block.trim();
      if (!cleanBlock) continue;

      const regex = /\[(?:FIELD|DYNAMIC):\s*([^\]]+)\]|\{\{([^}]+)\}\}/g;
      if (regex.test(cleanBlock)) {
        const parts = cleanBlock.split(/(\[(?:FIELD|DYNAMIC):\s*[^\]]+\]|\{\{[^}]+\}\})/);
        const runs: EditorTextRun[] = [];
        for (const part of parts) {
          if (!part) continue;
          const isHl = /^(\[(?:FIELD|DYNAMIC):\s*[^\]]+\]|\{\{[^}]+\}\})$/.test(part);
          const cleanPart = isHl ? part.replace(/^\[(?:FIELD|DYNAMIC):\s*|\]$|^\{\{|\}\}$/g, '') : part;
          runs.push({ text: cleanPart, is_highlighted: isHl });
        }
        newElements.push({ type: 'paragraph' as const, paragraph: { alignment: 'left' as const, runs } });
      } else {
        newElements.push({
          type: 'paragraph' as const,
          paragraph: {
            alignment: 'left' as const,
            runs: [{ text: cleanBlock, is_highlighted: false }]
          }
        });
      }
    }

    const next: EditorElement[] = newElements.length > 0 ? newElements : [
      { type: 'paragraph' as const, paragraph: { alignment: 'left' as const, runs: [{ text: 'Type or paste template text here...', is_highlighted: false }] } }
    ];
    pushHistoryState(next);
    setViewMode('visual');
    setMessage({ type: 'success', text: 'Applied full text edits and updated highlighted variables!' });
  };

  // Add a new empty paragraph
  const handleAddParagraph = (headingLevel: number | null = null) => {
    const next = [
      ...elements,
      {
        type: 'paragraph' as const,
        paragraph: {
          heading_level: headingLevel,
          alignment: 'left' as const,
          runs: [{ text: headingLevel ? 'New Section Heading' : 'Type or paste template text here...', is_highlighted: false }]
        }
      }
    ];
    pushHistoryState(next);
  };

  // Add Dynamic Table
  const handleConfirmAddTable = () => {
    const colNames = newTableCols.split(',').map((c) => c.trim()).filter((c) => c.length > 0);
    if (colNames.length === 0) return;

    const newTable: EditorDynamicTable = {
      title: newTableTitle || 'Dynamic Schedule Table',
      columns: colNames.map((name) => ({
        header: name,
        sample_text: `Sample ${name}`,
        is_highlighted: false
      }))
    };

    const next = [...elements, { type: 'table' as const, table: newTable }];
    pushHistoryState(next);
    setShowAddTableModal(false);
    setMessage({ type: 'success', text: `Added structured table "${newTable.title}" with ${colNames.length} columns!` });
  };

  // Action 1: Use in Workspace / Scrutiny
  const handleUseInWorkspace = async () => {
    setIsProcessing(true);
    const currParagraphs = elements.filter(e => e.type === 'paragraph' && e.paragraph).map(e => e.paragraph!);
    const currTables = elements.filter(e => e.type === 'table' && e.table).map(e => e.table!);

    const payload: EditorDocumentPayload = {
      title: docTitle.trim() || 'Custom_Highlighted_Template.docx',
      paragraphs: currParagraphs,
      tables: currTables,
      elements: elements,
      raw_docx_base64: rawDocxBase64
    };

    try {
      if (editingTemplateId) {
        // Save updates to library first
        await updateTemplateInLibrary(editingTemplateId, payload).catch((e) => console.warn('Silent update:', e));
      } else {
        // Save as new template in library
        const saved = await saveEditorAsTemplate(payload).catch((e) => {
          console.warn('Silent save:', e);
          return null;
        });
        if (saved?.id) {
          setEditingTemplateId(saved.id);
        }
      }
      const res = await useEditorInSession(payload);
      onSelectTemplate(res);
      onNavigateToWorkspace();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to initialize session from editor' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Action 2: Save to Template Library
  const handleSaveToLibrary = async (asNewCopy: boolean = false) => {
    setIsProcessing(true);
    const currParagraphs = elements.filter(e => e.type === 'paragraph' && e.paragraph).map(e => e.paragraph!);
    const currTables = elements.filter(e => e.type === 'table' && e.table).map(e => e.table!);

    const payload: EditorDocumentPayload = {
      title: docTitle.trim() || 'Custom_Highlighted_Template.docx',
      paragraphs: currParagraphs,
      tables: currTables,
      elements: elements,
      raw_docx_base64: rawDocxBase64
    };

    try {
      if (editingTemplateId && !asNewCopy) {
        const res = await updateTemplateInLibrary(editingTemplateId, payload);
        setMessage({
          type: 'success',
          text: `Template "${res.name}" updated successfully with ${res.fields_count} yellow highlighted dynamic fields!`
        });
      } else {
        const res = await saveEditorAsTemplate(payload);
        setEditingTemplateId(res.id);
        setMessage({
          type: 'success',
          text: `Template "${res.name}" saved to library with ${res.fields_count} yellow highlighted dynamic fields!`
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save template to library' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Action 3: Download .docx
  const handleDownloadDocx = async () => {
    setIsProcessing(true);
    const currParagraphs = elements.filter(e => e.type === 'paragraph' && e.paragraph).map(e => e.paragraph!);
    const currTables = elements.filter(e => e.type === 'table' && e.table).map(e => e.table!);

    const payload: EditorDocumentPayload = {
      title: docTitle.trim() || 'Custom_Highlighted_Template.docx',
      paragraphs: currParagraphs,
      tables: currTables,
      elements: elements,
      raw_docx_base64: rawDocxBase64
    };

    try {
      const blob = await convertEditorToDocx(payload);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docTitle.endsWith('.docx') ? docTitle : `${docTitle}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setMessage({ type: 'success', text: 'Downloaded .docx file with true Word XML yellow highlights!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to download docx' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Floating Highlight Toolbar on Selection */}
      {floatingPos && activeSelectionRange && (
        <div
          style={{ top: `${floatingPos.top}px`, left: `${floatingPos.left}px` }}
          className="fixed z-50 flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900 border border-amber-500/60 shadow-2xl backdrop-blur-md animate-bounce-subtle"
        >
          <button
            onClick={handleHighlightSelection}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>Highlight in Yellow</span>
          </button>
          <button
            onClick={() => {
              setActiveSelectionRange(null);
              setFloatingPos(null);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner & Action Controls */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Highlighter className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-white tracking-tight">Highlight Studio & Template Builder</h1>
                  {editingTemplateId ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span>Editing: {docTitle || 'Template'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold">
                      <span>New Template</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload any Word document or build online. All tables, schedules, and paragraphs are preserved in exact sequence.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Back to Template Selection Button */}
            <button
              type="button"
              onClick={onNavigateToWorkspace}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer shadow-sm"
              title="Return to Step 1: Choose Template"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Template Selection</span>
            </button>

            {/* Upload Existing Document */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".docx,.pdf,.txt"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all shadow-sm cursor-pointer"
              title="Upload existing .docx or .pdf template"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Upload Document</span>
            </button>
          </div>
        </div>

        {/* Loading Indicator for Initial Template */}
        {isLoadingInitialTemplate && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300 animate-fade-in">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <span>Loading template from database into Highlight Studio...</span>
          </div>
        )}

        {/* Message Banner */}
        {message && (
          <div
            className={`p-3 rounded-xl flex items-center justify-between gap-3 text-xs animate-slide-up ${
              message.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Two-Column Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left 3 Columns: Interactive Document Canvas */}
        <div className="lg:col-span-3 space-y-4">
          {/* Document Title Header & Formatting Toolbar */}
          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3 shadow-lg">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-amber-400 focus:outline-none px-1 py-0.5 w-full"
                  placeholder="Template_Filename.docx"
                />
              </div>

              {/* View Mode Toggle: Visual vs Full Text vs Paper Mode */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaperMode(!paperMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    paperMode
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  title="Toggle between Clean Paper Document View (matching physical legal opinion) and Canvas View"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{paperMode ? '📄 Legal Paper Sheet' : '🌌 Canvas View'}</span>
                </button>

                <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setViewMode('visual')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                      viewMode === 'visual'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visual Layout</span>
                  </button>
                  <button
                    onClick={() => setViewMode('fulltext')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                      viewMode === 'fulltext'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Text Clauses</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Editing Controls Bar */}
            {viewMode === 'visual' ? (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleAddParagraph(null)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Paragraph</span>
                  </button>

                  <button
                    onClick={() => setShowAddTableModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors shadow-sm"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Add Table</span>
                  </button>

                  <div className="h-4 w-px bg-slate-800 mx-1" />

                  {/* Undo Button */}
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all border ${
                      canUndo
                        ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white shadow-sm'
                        : 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed'
                    }`}
                    title="Undo last action (Ctrl/Cmd + Z)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </button>

                  {/* Redo Button */}
                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all border ${
                      canRedo
                        ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white shadow-sm'
                        : 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed'
                    }`}
                    title="Redo action (Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y)"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Redo</span>
                  </button>

                  <div className="h-4 w-px bg-slate-800 mx-1" />

                  {/* Reset All Yellow Markings */}
                  <button
                    onClick={handleResetAllHighlights}
                    disabled={totalHighlights === 0}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all border ${
                      totalHighlights > 0
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25 hover:text-rose-200 shadow-sm'
                        : 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed'
                    }`}
                    title="Clear all yellow markings to start marking from scratch"
                  >
                    <Eraser className="w-3.5 h-3.5 text-rose-400" />
                    <span>Reset Markings</span>
                    {totalHighlights > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 bg-rose-500/30 text-rose-200 text-[10px] rounded-full">
                        {totalHighlights}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="hidden sm:inline italic">
                    Tip: Click words or cells to toggle yellow markers • <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">⌘Z</kbd> to undo
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleHighlightInFullText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 shadow"
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                    <span>Mark Selected as [FIELD: ...]</span>
                  </button>

                  <button
                    onClick={handleApplyFullTextChanges}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply to Visual View</span>
                  </button>
                </div>
                <span className="text-[11px] text-slate-400">
                  Use <code className="text-amber-400 font-mono">[FIELD: text]</code> to mark dynamic replacement variables.
                </span>
              </div>
            )}
          </div>

          {/* Interactive Document Page Canvas (Sequential Interleaved Elements) */}
          {viewMode === 'visual' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`transition-all ${
                isDragging ? 'ring-2 ring-amber-400 bg-amber-500/5' : ''
              } ${
                paperMode
                  ? 'bg-white text-black border border-slate-300 shadow-2xl rounded-sm p-14 max-w-4xl mx-auto space-y-4 font-serif text-[13.5px] leading-[1.75] relative'
                  : 'glass-panel rounded-2xl p-8 border border-slate-800 min-h-[500px] space-y-4 bg-slate-950/60 shadow-2xl relative'
              }`}
            >
              {elements.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center py-20 px-6 text-center border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl bg-slate-900/40 hover:bg-slate-900/60 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">Upload a Document Template to Begin</h3>
                  <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                    Drag & drop your <span className="text-amber-400 font-mono font-semibold">.docx</span> or <span className="text-amber-400 font-mono font-semibold">.pdf</span> template here, or click to browse files. The studio will preserve your exact document layout, tables, and clauses.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-md flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Browse Document</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddParagraph(null);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Start with Blank Page</span>
                    </button>
                  </div>
                </div>
              ) : (
                elements.map((elem, elemIdx) => {
                if (elem.type === 'paragraph' && elem.paragraph) {
                  const p = elem.paragraph;
                  return (
                    <div
                      key={elemIdx}
                      onMouseUp={() => handleMouseUp(elemIdx)}
                      className={`group relative p-1.5 rounded transition-all ${
                        paperMode
                          ? activeSelectionRange?.paragraphIdx === elemIdx
                            ? 'bg-amber-50 ring-1 ring-amber-400'
                            : 'hover:bg-slate-50/80'
                          : activeSelectionRange?.paragraphIdx === elemIdx
                            ? 'border border-amber-500/40 bg-slate-900/60'
                            : 'border border-transparent hover:border-slate-800 hover:bg-slate-900/30'
                      }`}
                    >
                      {/* Paragraph Toolbar on hover */}
                      <div
                        className={`absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 rounded-lg p-1 z-10 shadow-lg ${
                          paperMode ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-slate-900 border border-slate-700'
                        }`}
                      >
                        <button
                          onClick={() => handleHighlightWholeParagraphInElement(elemIdx)}
                          className="px-2 py-1 text-[11px] font-semibold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 rounded flex items-center gap-1 transition-colors"
                          title="Highlight entire paragraph as a dynamic variable in 1 click"
                        >
                          <Highlighter className="w-3 h-3" />
                          <span>Highlight Paragraph</span>
                        </button>

                        {p.runs.some((r: EditorTextRun) => r.is_highlighted) && (
                          <button
                            onClick={() => handleClearParagraphHighlightsInElement(elemIdx)}
                            className="px-2 py-1 text-[11px] text-slate-300 hover:text-white rounded transition-colors"
                            title="Clear highlights in this paragraph"
                          >
                            Clear
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteElement(elemIdx)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                          title="Delete Paragraph"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Paragraph Content */}
                      <div
                        className={`${
                          p.alignment === 'center' ? 'text-center' : p.alignment === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {p.heading_level === 1 ? (
                          <h1
                            className={`font-serif text-[15px] font-bold tracking-normal mb-2 ${
                              paperMode ? 'text-black' : 'text-white'
                            }`}
                          >
                            {p.runs.map((r: EditorTextRun, rIdx: number) => (
                              <span
                                key={rIdx}
                                onClick={() => handleToggleRunHighlightInElement(elemIdx, rIdx)}
                                className={`cursor-pointer transition-all ${
                                  r.is_highlighted
                                    ? paperMode
                                      ? 'bg-[#fef08a] text-black px-0.5'
                                      : 'bg-amber-500/40 text-white font-bold'
                                    : paperMode ? 'text-black' : 'text-white'
                                } ${r.bold ? 'font-bold' : ''} ${r.italic ? 'italic' : ''}`}
                                title="Click to toggle yellow highlight"
                              >
                                {r.text}
                              </span>
                            ))}
                          </h1>
                        ) : p.heading_level === 2 ? (
                          <h2
                            className={`font-serif text-[14px] font-bold mt-3 mb-1.5 ${
                              paperMode ? 'text-black' : 'text-slate-200'
                            }`}
                          >
                            {p.runs.map((r: EditorTextRun, rIdx: number) => (
                              <span
                                key={rIdx}
                                onClick={() => handleToggleRunHighlightInElement(elemIdx, rIdx)}
                                className={`cursor-pointer transition-all ${
                                  r.is_highlighted
                                    ? paperMode
                                      ? 'bg-[#fef08a] text-black px-0.5'
                                      : 'bg-amber-500/40 text-slate-100 font-bold'
                                    : paperMode ? 'text-black' : 'text-slate-200'
                                } ${r.bold ? 'font-bold' : ''} ${r.italic ? 'italic' : ''}`}
                                title="Click to toggle yellow highlight"
                              >
                                {r.text}
                              </span>
                            ))}
                          </h2>
                        ) : (
                          <p className={paperMode ? 'font-serif text-black text-[13.5px] whitespace-pre-wrap leading-[1.65]' : 'text-slate-300 whitespace-pre-wrap'}>
                            {p.runs.map((r: EditorTextRun, rIdx: number) => (
                              <span
                                key={rIdx}
                                onClick={() => handleToggleRunHighlightInElement(elemIdx, rIdx)}
                                className={`cursor-pointer transition-all select-text ${
                                  r.is_highlighted
                                    ? paperMode
                                      ? 'bg-[#fef08a] text-black px-0.5'
                                      : 'bg-amber-500/40 text-slate-100 font-semibold'
                                    : paperMode
                                      ? 'text-black hover:bg-yellow-100/50'
                                      : 'text-slate-300 hover:text-white'
                                } ${r.bold ? 'font-bold ' + (paperMode ? 'text-black' : 'text-white') : ''} ${
                                  r.italic ? 'italic' : ''
                                }`}
                                title={
                                  r.is_highlighted
                                    ? 'Highlighted dynamic variable (click to remove)'
                                    : 'Click or select text to highlight'
                                }
                              >
                                {r.text}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                if (elem.type === 'table' && elem.table) {
                  const tbl = elem.table;
                  return (
                    <div
                      key={elemIdx}
                      className={`relative group ${
                        paperMode
                          ? 'my-3 space-y-1'
                          : 'p-4 rounded-xl bg-slate-900/80 border border-purple-500/30 space-y-3'
                      }`}
                    >
                      {/* Table Header Controls */}
                      {!paperMode ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TableIcon className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-white">
                              {tbl.title}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                              Table ({tbl.rows?.length || 1} rows)
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteElement(elemIdx)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Table"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDeleteElement(elemIdx)}
                            className="p-1 text-slate-500 hover:text-rose-600 rounded transition-colors text-xs flex items-center gap-1"
                            title="Delete Table"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove Table</span>
                          </button>
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table
                          className={`w-full text-left border-collapse ${
                            paperMode
                              ? 'border border-black font-serif text-[12.5px] leading-normal text-black bg-white'
                              : 'border border-slate-700 text-xs'
                          }`}
                        >
                          <thead>
                            <tr
                              className={
                                paperMode
                                  ? 'border-b border-black bg-white'
                                  : 'bg-slate-950/80 border-b border-slate-700'
                              }
                            >
                              {tbl.columns.map((col: EditorTableColumn, colIdx: number) => (
                                <th
                                  key={colIdx}
                                  className={`p-2 font-serif font-bold text-left align-top ${
                                    paperMode
                                      ? 'border border-black text-black'
                                      : 'border border-slate-800 text-slate-300'
                                  }`}
                                >
                                  {col.header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tbl.rows && tbl.rows.length > 0 ? (
                              tbl.rows.map((row: EditorTextRun[], rIdx: number) => (
                                <tr
                                  key={rIdx}
                                  className={
                                    paperMode
                                      ? 'border-b border-black'
                                      : 'border-b border-slate-800/60 hover:bg-slate-900/30'
                                  }
                                >
                                  {row.map((cell: EditorTextRun, cIdx: number) => (
                                    <td
                                      key={cIdx}
                                      onClick={() => handleToggleTableCellHighlight(elemIdx, rIdx, cIdx)}
                                      className={`p-2 align-top transition-colors cursor-pointer ${
                                        paperMode
                                          ? 'border border-black text-black'
                                          : 'border border-slate-800/80 text-slate-300'
                                      } ${
                                        cell.is_highlighted
                                          ? paperMode
                                            ? 'bg-[#fef08a]'
                                            : 'bg-amber-400/20 text-amber-200 font-semibold'
                                          : paperMode
                                            ? 'hover:bg-yellow-50/50'
                                            : 'hover:bg-slate-800/40'
                                      }`}
                                      title="Click to toggle yellow highlight on this cell"
                                    >
                                      {cell.text}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            ) : (
                              <tr className={paperMode ? 'border-b border-black' : 'bg-slate-900/50'}>
                                {tbl.columns.map((c: EditorTableColumn, cIdx: number) => (
                                  <td
                                    key={cIdx}
                                    onClick={() => handleToggleColumnHighlightInElement(elemIdx, cIdx)}
                                    className={`p-2 align-top cursor-pointer transition-colors ${
                                      paperMode
                                        ? 'border border-black text-black hover:bg-yellow-50/50'
                                        : 'border border-slate-700 hover:bg-slate-800/60'
                                    }`}
                                    title="Click to toggle yellow highlight on this column's values"
                                  >
                                    <span
                                      className={
                                        c.is_highlighted
                                          ? paperMode
                                            ? 'bg-[#fef08a] text-black px-0.5'
                                            : 'bg-amber-500/40 text-white font-bold'
                                          : paperMode
                                            ? 'text-black'
                                            : 'text-slate-400 bg-slate-800'
                                      }
                                    >
                                      {c.sample_text}
                                    </span>
                                  </td>
                                ))}
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <p className={`text-[10px] italic ${paperMode ? 'text-slate-500' : 'text-slate-500'}`}>
                        Click on any table cell or column sample to toggle yellow dynamic extraction.
                      </p>
                    </div>
                  );
                }

                return null;
              }))}
            </div>
          ) : (
            /* Direct Text Editor Mode */
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-3 bg-slate-950/80 shadow-2xl">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Direct Full Document Text / Clause View:</span>
                <span>Select text and click "Mark Selected as [FIELD: ...]"</span>
              </div>
              <textarea
                ref={fullTextareaRef}
                value={fullTextContent}
                onChange={(e) => setFullTextContent(e.target.value)}
                rows={18}
                className="w-full p-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-amber-400 resize-y"
                placeholder="Paste or type your entire document here. Use [FIELD: placeholder] around values you want to extract..."
              />
            </div>
          )}
        </div>

        {/* Right 1 Column: Live Highlight Variables Inspector & Actions */}
        <div className="space-y-4">
          {/* Live Highlight Variables Inspector */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Live Variables Inspector</h3>
                  <p className="text-[10px] text-slate-400">Real-time detected highlights</p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {totalHighlights} Fields
              </span>
            </div>

            {/* List of Detected Highlight Variables */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {elements.map((elem, elemIdx) => {
                if (elem.type === 'paragraph' && elem.paragraph) {
                  return elem.paragraph.runs
                    .filter((r: EditorTextRun) => r.is_highlighted && r.text.trim().length > 0)
                    .map((r: EditorTextRun, rIdx: number) => (
                      <div
                        key={`${elemIdx}-${rIdx}`}
                        className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 group hover:border-amber-500/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-bold text-amber-300 block truncate max-w-[190px]">
                            "{r.text}"
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {elem.paragraph?.heading_level ? `Heading ${elem.paragraph.heading_level}` : `Paragraph #${elemIdx + 1}`}
                          </span>
                        </div>
                        <button
                          onClick={() => handleToggleRunHighlightInElement(elemIdx, elem.paragraph!.runs.indexOf(r))}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                          title="Remove highlight"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ));
                }
                if (elem.type === 'table' && elem.table) {
                  return (
                    <div key={`tbl-${elemIdx}`} className="space-y-1">
                      {elem.table.columns.filter((c: EditorTableColumn) => c.is_highlighted).map((c: EditorTableColumn, cIdx: number) => (
                        <div
                          key={`tc-${elemIdx}-${cIdx}`}
                          className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-bold text-purple-300 block truncate max-w-[190px]">
                              Col: {c.header} ("{c.sample_text}")
                            </span>
                            <span className="text-[10px] text-slate-500">{elem.table?.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              })}

              {totalHighlights === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">
                  No yellow highlights detected. Drag cursor over text or click words/cells on the left to highlight!
                </div>
              )}
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Save & Continue</h4>

            {/* Use in Workspace */}
            <button
              onClick={handleUseInWorkspace}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <span>Use Template & Continue</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Save Actions: Existing Template vs New Template */}
            {editingTemplateId ? (
              <>
                <button
                  onClick={() => handleSaveToLibrary(false)}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  title="Overwrite existing template in library with current highlights"
                >
                  <Bookmark className="w-4 h-4" />
                  <span>Save Changes to Template</span>
                </button>

                <button
                  onClick={() => handleSaveToLibrary(true)}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
                  title="Save as a separate new template copy in library"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Save as New Copy</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => handleSaveToLibrary(false)}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Bookmark className="w-4 h-4" />
                <span>Save to Template Library</span>
              </button>
            )}

            {/* Download .docx */}
            <button
              onClick={handleDownloadDocx}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Download .docx</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TableIcon className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Add Dynamic Table</h3>
              </div>
              <button onClick={() => setShowAddTableModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Table Title / Heading</label>
                <input
                  type="text"
                  value={newTableTitle}
                  onChange={(e) => setNewTableTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-medium focus:outline-none focus:border-purple-400"
                  placeholder="e.g. Description of Documents Scrutinized"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Column Names (comma separated)</label>
                <input
                  type="text"
                  value={newTableCols}
                  onChange={(e) => setNewTableCols(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
                  placeholder="e.g. Milestone, Description, Date, Fee"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTableModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddTable}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Insert Table</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
