/**
 * TabContextMenu — Right-click context menu for tabs
 */

import { useState, useEffect, useRef } from 'react';
import { Pin, Tag, MessageSquare } from 'lucide-react';
import { useMetadataStore } from '@/store';
import { useT } from '@/shared/i18n';
import { stringToColor } from '@/shared/utils/color';

interface TabContextMenuProps {
  x: number;
  y: number;
  url: string;
  onClose: () => void;
}

export function TabContextMenu({ x, y, url, onClose }: TabContextMenuProps) {
  const { t } = useT();
  const addTag = useMetadataStore((s) => s.addTag);
  const removeTag = useMetadataStore((s) => s.removeTag);
  const setNote = useMetadataStore((s) => s.setNote);
  const togglePin = useMetadataStore((s) => s.togglePin);
  const isPinned = useMetadataStore((s) => s.isPinned);
  const tags = useMetadataStore((s) => s.getTags(url));
  const note = useMetadataStore((s) => s.getNote(url));
  const [showTagInput, setShowTagInput] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [tagValue, setTagValue] = useState('');
  const [noteValue, setNoteValue] = useState(note);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    if (showTagInput) tagInputRef.current?.focus();
    if (showNoteInput) noteInputRef.current?.focus();
  }, [showTagInput, showNoteInput]);

  const handleAddTag = () => {
    if (tagValue.trim()) {
      addTag(url, tagValue.trim());
      setTagValue('');
      setShowTagInput(false);
    }
  };

  const handleSaveNote = () => {
    setNote(url, noteValue);
    setShowNoteInput(false);
  };

  const pinned = isPinned(url);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] py-1.5 rounded-[var(--radius-md)] bg-surface backdrop-blur-xl border border-border shadow-xl"
      style={{ left: x, top: y }}
    >
      {/* Pin/Unpin */}
      <button
        onClick={() => { togglePin(url); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-hover cursor-pointer text-left"
      >
        <Pin className={`w-4 h-4 ${pinned ? 'text-text' : 'text-text-muted'}`} />
        {pinned ? t('context.unpin') : t('context.pin')}
      </button>

      {/* Add Tag */}
      <button
        onClick={() => setShowTagInput(true)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-hover cursor-pointer text-left"
      >
        <Tag className="w-4 h-4 text-text-muted" />
        {t('context.addTag')}
      </button>

      {/* Existing tags */}
      {tags.map((tag) => (
        <div key={tag} className="flex items-center gap-2 px-3 py-1.5 text-sm">
          <span
            className="px-1.5 py-0.5 rounded text-xs font-medium text-white"
            style={{ backgroundColor: stringToColor(tag) }}
          >
            {tag}
          </span>
          <button
            onClick={() => removeTag(url, tag)}
            className="text-text-muted hover:text-red-300 text-xs cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}

      {/* Tag input */}
      {showTagInput && (
        <div className="px-3 py-1.5">
          <input
            ref={tagInputRef}
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setShowTagInput(false); }}
            placeholder={t('context.tagPlaceholder')}
            className="w-full px-2 py-1 rounded bg-surface border border-border text-text text-xs outline-none"
          />
        </div>
      )}

      {/* Note */}
      <button
        onClick={() => { setShowNoteInput(true); setNoteValue(note); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-hover cursor-pointer text-left"
      >
        <MessageSquare className="w-4 h-4 text-text-muted" />
        {note ? t('context.editNote') : t('context.addNote')}
      </button>

      {showNoteInput && (
        <div className="px-3 py-1.5">
          <textarea
            ref={noteInputRef}
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder={t('context.notePlaceholder')}
            className="w-full px-2 py-1 rounded bg-surface border border-border text-text text-xs outline-none resize-none"
            rows={3}
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={handleSaveNote}
              className="px-2 py-1 rounded bg-badge text-text text-xs cursor-pointer"
            >
              {t('context.save')}
            </button>
            <button
              onClick={() => setShowNoteInput(false)}
              className="px-2 py-1 rounded text-text-muted text-xs cursor-pointer"
            >
              {t('context.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
