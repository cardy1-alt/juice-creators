import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import NaybaLogo from '../assets/logomark.svg';
import { Megaphone, Users, Store, BarChart3, Bell, Settings, LogOut, Menu, X, Plus } from 'lucide-react';
import AdminCampaignsTab from './admin/AdminCampaignsTab';
import AdminCreatorsTab from './admin/AdminCreatorsTab';
import AdminBrandsTab from './admin/AdminBrandsTab';
import AdminAnalyticsTab from './admin/AdminAnalyticsTab';
import AdminNotificationsTab from './admin/AdminNotificationsTab';
import AdminSettingsTab from './admin/AdminSettingsTab';

type Tab = 'campaigns' | 'creators' | 'brands' | 'analytics' | 'notifications' | 'settings';

const NAV_SECTIONS = [
  {
    label: 'Platform',
    items: [
      { key: 'campaigns' as Tab, label: 'Campaigns', icon: Megaphone },
      { key: 'creators' as Tab, label: 'Creators', icon: Users },
      { key: 'brands' as Tab, label: 'Brands', icon: Store },
    ],
  },
  {
    label: 'Insights',
    items: [
      { key: 'analytics' as Tab, label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Tools',
    items: [
      { key: 'notifications' as Tab, label: 'Notifications', icon: Bell },
      { key: 'settings' as Tab, label: 'Settings', icon: Settings },
    ],
  },
];

const PAGE_TITLES: Record<Tab, string> = {
  campaigns: 'Campaigns',
  creators: 'Creators',
  brands: 'Brands',
  analytics: 'Analytics',
  notifications: 'Notifications',
  settings: 'Settings',
};

const CTA_CONFIG: Record<Tab, { label: string; show: boolean }> = {
  campaigns: { label: 'New Campaign', show: true },
  creators: { label: 'Create Creator', show: true },
  brands: { label: 'Create Brand', show: true },
  analytics: { label: '', show: false },
  notifications: { label: '', show: false },
  settings: { label: '', show: false },
};

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('campaigns');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    supabase.from('creators').select('id', { count: 'exact', head: true }).eq('approved', false)
      .then(({ count }) => setPendingCount(count || 0));
  }, []);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const adminInitial = (user?.email?.[0] || 'A').toUpperCase();
  const adminName = user?.email?.split('@')[0] || 'Admin';
  const cta = CTA_CONFIG[activeTab];

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--chalk)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── Sidebar ─── */}
      <aside className={`
        w-[240px] flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ background: 'var(--stone)', borderRight: '1px solid rgba(42,32,24,0.08)' }}>
        {/* Wordmark */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div>
            <Logo size={28} variant="wordmark" />
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: 'var(--terra)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', color: 'var(--ink-60)', textTransform: 'uppercase' as const }}>Admin</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden" style={{ color: 'var(--ink-50)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 px-3 pb-3 overflow-y-auto">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-3">
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', color: 'var(--ink-60)', textTransform: 'uppercase' as const, padding: '8px 12px 4px' }}>
                {section.label}
              </p>
              {section.items.map(item => {
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleTabClick(item.key)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] mb-1 text-[14px] transition-colors"
                    style={{
                      fontWeight: active ? 700 : 500,
                      background: active ? 'var(--terra-10)' : 'transparent',
                      color: active ? 'var(--terra)' : 'var(--ink-60)',
                    }}
                  >
                    <item.icon size={18} strokeWidth={active ? 2 : 1.5} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.key === 'creators' && pendingCount > 0 && (
                      <span className="flex items-center justify-center text-[12px] font-bold rounded-[999px]" style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)', padding: '2px 6px', minWidth: 20 }}>
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User row */}
        <div style={{ borderTop: '1px solid rgba(42,32,24,0.08)', padding: '12px 8px 16px' }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-[10px] hover:bg-[rgba(42,32,24,0.04)] transition-colors group cursor-pointer" onClick={signOut}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--terra-15)' }}>
              <span className="text-[12px] text-[var(--terra)]" style={{ fontWeight: 700 }}>{adminInitial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-[var(--ink)] truncate">{adminName}</p>
              <p className="text-[12px] text-[var(--ink-50)] truncate">{user?.email}</p>
            </div>
            <LogOut size={14} className="text-[var(--ink-50)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* ─── Main area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 h-[56px] bg-white" style={{ borderBottom: '1px solid rgba(42,32,24,0.08)' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: 'var(--ink-60)' }}>
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Logo size={20} variant="icon" />
            <span className="text-[15px] font-semibold text-[var(--ink)] truncate">{PAGE_TITLES[activeTab]}</span>
          </div>
        </div>

        {/* Desktop topbar */}
        <div className="hidden md:flex items-center justify-between h-[56px] bg-white flex-shrink-0" style={{ borderBottom: '1px solid rgba(42,32,24,0.08)' }}>
          <h1 className="text-[20px] font-semibold text-[var(--ink)]" style={{ fontSize: 20, margin: 0, paddingLeft: 24, color: 'var(--ink)' }}>
            {PAGE_TITLES[activeTab]}
          </h1>
          {cta.show && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-[10px] text-white text-[14px] transition-opacity mr-6"
              style={{ padding: '8px 20px', background: 'var(--terra)', fontWeight: 700 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.90')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <Plus size={15} strokeWidth={2} />
              {cta.label}
            </button>
          )}
        </div>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 lg:px-6 lg:pt-6 lg:pb-8 overflow-auto">
          {activeTab === 'campaigns' && <AdminCampaignsTab showModal={showModal} onCloseModal={() => setShowModal(false)} onOpenModal={() => setShowModal(true)} />}
          {activeTab === 'creators' && <AdminCreatorsTab showModal={showModal} onCloseModal={() => setShowModal(false)} />}
          {activeTab === 'brands' && <AdminBrandsTab showModal={showModal} onCloseModal={() => setShowModal(false)} />}
          {activeTab === 'analytics' && <AdminAnalyticsTab />}
          {activeTab === 'notifications' && <AdminNotificationsTab />}
          {activeTab === 'settings' && <AdminSettingsTab />}
        </main>
      </div>
    </div>
  );
}
