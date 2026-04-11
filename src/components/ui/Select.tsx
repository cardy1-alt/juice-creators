import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function Select({ value, onChange, options, placeholder = 'Select...', className = '', disabled = false }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  // Calculate dropdown position from trigger
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && listRef.current && !listRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightIdx(options.findIndex(o => o.value === value));
      } else if (highlightIdx >= 0) {
        onChange(options[highlightIdx].value);
        setOpen(false);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightIdx(options.findIndex(o => o.value === value));
      } else {
        setHighlightIdx(prev => Math.min(prev + 1, options.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || highlightIdx < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[highlightIdx]) {
      (items[highlightIdx] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx, open]);

  const dropdown = open && pos ? createPortal(
    <div
      ref={listRef}
      className="fixed z-[100] bg-white rounded-[12px] border border-[rgba(42,32,24,0.08)] overflow-hidden overflow-y-auto"
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 240, boxShadow: '0 4px 16px rgba(42,32,24,0.10)' }}
    >
      {options.map((opt, i) => {
        const isSelected = opt.value === value;
        const isHighlighted = i === highlightIdx;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); setOpen(false); }}
            onMouseEnter={() => setHighlightIdx(i)}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-[14px] text-left transition-colors font-['Instrument_Sans'] ${
              isHighlighted ? 'bg-[rgba(42,32,24,0.04)]' : ''
            }`}
            style={{ color: isSelected ? 'var(--terra)' : 'var(--ink)', fontWeight: isSelected ? 600 : 400 }}
          >
            <span className="truncate">{opt.label}</span>
            {isSelected && <Check size={14} className="text-[var(--terra)] flex-shrink-0 ml-2" />}
          </button>
        );
      })}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { updatePosition(); setOpen(!open); } }}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between px-3 min-h-[40px] rounded-[10px] bg-white border text-[14px] text-left transition-colors focus:outline-none font-['Instrument_Sans'] ${
          disabled ? 'opacity-60 cursor-not-allowed border-[rgba(42,32,24,0.15)]' :
          open ? 'border-[var(--terra)]' : 'border-[rgba(42,32,24,0.15)]'
        }`}
      >
        <span className={selected ? 'text-[var(--ink)]' : 'text-[var(--ink-50)]'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className={`text-[var(--ink-35)] transition-transform flex-shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </div>
  );
}
