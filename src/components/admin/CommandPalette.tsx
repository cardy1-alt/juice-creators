import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Megaphone, Users, Store, BarChart3, Bell, Settings, Search, ArrowRight } from 'lucide-react';

type Tab = 'campaigns' | 'creators' | 'brands' | 'analytics' | 'notifications' | 'settings';

interface SearchResult {
  id: string;
  type: 'page' | 'creator' | 'brand' | 'campaign';
  tab: Tab;
  title: string;
  subtitle: string;
}

const PAGES: SearchResult[] = [
  { id: 'campaigns', type: 'page', tab: 'campaigns', title: 'Campaigns', subtitle: 'View all campaigns' },
  { id: 'creators', type: 'page', tab: 'creators', title: 'Creators', subtitle: 'View all creators' },
  { id: 'brands', type: 'page', tab: 'brands', title: 'Brands', subtitle: 'View all brands' },
  { id: 'analytics', type: 'page', tab: 'analytics', title: 'Analytics', subtitle: 'Platform analytics' },
  { id: 'notifications', type: 'page', tab: 'notifications', title: 'Notifications', subtitle: 'Email notifications' },
  { id: 'settings', type: 'page', tab: 'settings', title: 'Settings', subtitle: 'Platform settings' },
];

const ICONS: Record<string, React.ReactNode> = {
  campaigns: <Megaphone size={16} />,
  creators: <Users size={16} />,
  brands: <Store size={16} />,
  analytics: <BarChart3 size={16} />,
  notifications: <Bell size={16} />,
  settings: <Settings size={16} />,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: Tab, entityId?: string) => void;
}

export default function CommandPalette({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setActiveIdx(0);
      return;
    }

    const [creatorsRes, brandsRes, campaignsRes] = await Promise.all([
      supabase.from('creators').select('id, name, display_name, email, instagram_handle')
        .or(`name.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%,instagram_handle.ilike.%${q}%`)
        .limit(5),
      supabase.from('businesses').select('id, name, owner_email, category')
        .or(`name.ilike.%${q}%,owner_email.ilike.%${q}%`)
        .limit(5),
      supabase.from('campaigns').select('id, title, status, businesses(name)')
        .ilike('title', `%${q}%`)
        .limit(5),
    ]);

    const items: SearchResult[] = [];
    creatorsRes.data?.forEach(c => items.push({
      id: c.id, type: 'creator', tab: 'creators',
      title: c.display_name || c.name,
      subtitle: `${c.email} · @${(c.instagram_handle || '').replace('@', '')}`,
    }));
    brandsRes.data?.forEach(b => items.push({
      id: b.id, type: 'brand', tab: 'brands',
      title: b.name,
      subtitle: `${b.category} · ${b.owner_email}`,
    }));
    campaignsRes.data?.forEach(c => items.push({
      id: c.id, type: 'campaign', tab: 'campaigns',
      title: c.title,
      subtitle: `${(c as any).businesses?.name || '—'} · ${c.status}`,
    }));

    setResults(items);
    setActiveIdx(0);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Filtered pages
  const filteredPages = query
    ? PAGES.filter(p => p.title.toLowerCase().includes(query.toLowerCase()))
    : PAGES;

  const allItems = [...filteredPages, ...results];

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(prev => Math.min(prev + 1, allItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && allItems[activeIdx]) {
        e.preventDefault();
        const item = allItems[activeIdx];
        onNavigate(item.tab, item.type !== 'page' ? item.id : undefined);
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, activeIdx, allItems, onClose, onNavigate]);

  // Scroll active into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-cmdk-item]');
    if (items[activeIdx]) (items[activeIdx] as HTMLElement).scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  const handleSelect = (item: SearchResult) => {
    onNavigate(item.tab, item.type !== 'page' ? item.id : undefined);
    onClose();
  };

  let globalIdx = -1;

  const renderGroup = (label: string, items: SearchResult[], icon?: React.ReactNode) => {
    if (items.length === 0) return null;
    return (
      <div>
        <p className="px-3 pt-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-50)]">{label}</p>
        {items.map(item => {
          globalIdx++;
          const idx = globalIdx;
          const isActive = idx === activeIdx;
          return (
            <button
              key={`${item.type}-${item.id}`}
              data-cmdk-item
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${isActive ? 'bg-[rgba(42,32,24,0.04)]' : ''}`}
            >
              <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ background: isActive ? 'var(--terra-10)' : 'rgba(42,32,24,0.04)', color: isActive ? 'var(--terra)' : 'var(--ink-50)' }}>
                {icon || ICONS[item.tab] || <ArrowRight size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[var(--ink)] truncate">{item.title}</p>
                <p className="text-[12px] text-[var(--ink-50)] truncate">{item.subtitle}</p>
              </div>
              {isActive && (
                <span className="text-[11px] text-[var(--ink-35)] flex-shrink-0">Enter</span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // Reset global index for each render
  globalIdx = -1;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-[rgba(42,32,24,0.40)]" onClick={onClose} />
      <div className="relative w-full max-w-[520px] mx-4 bg-white rounded-[16px] overflow-hidden animate-slide-up" style={{ boxShadow: '0 16px 48px rgba(42,32,24,0.20)' }}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-[rgba(42,32,24,0.08)]">
          <Search size={16} className="text-[var(--ink-35)] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search creators, brands, campaigns..."
            className="flex-1 py-4 text-[15px] text-[var(--ink)] bg-transparent outline-none placeholder:text-[var(--ink-35)] font-['Instrument_Sans']"
          />
          <kbd className="px-1.5 py-0.5 rounded-[4px] border border-[rgba(42,32,24,0.12)] text-[10px] font-medium text-[var(--ink-35)]">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 360 }}>
          {renderGroup('Pages', filteredPages)}
          {results.length > 0 && (
            <>
              {renderGroup('Creators', results.filter(r => r.type === 'creator'), <Users size={14} />)}
              {renderGroup('Brands', results.filter(r => r.type === 'brand'), <Store size={14} />)}
              {renderGroup('Campaigns', results.filter(r => r.type === 'campaign'), <Megaphone size={14} />)}
            </>
          )}
          {query.length >= 2 && results.length === 0 && filteredPages.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[14px] text-[var(--ink-50)]">No results for "{query}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[rgba(42,32,24,0.06)] text-[11px] text-[var(--ink-35)]">
          <span className="flex items-center gap-1"><kbd className="px-1 py-px rounded border border-[rgba(42,32,24,0.10)] text-[10px]">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-px rounded border border-[rgba(42,32,24,0.10)] text-[10px]">↵</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-px rounded border border-[rgba(42,32,24,0.10)] text-[10px]">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
