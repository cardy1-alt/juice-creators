import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
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
    <div className="flex min-h-screen bg-[#F7F7F5]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-[rgba(34,34,34,0.4)] z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── Sidebar ─── */}
      <aside className={`
        w-[220px] bg-white border-r border-[#E6E2DB] flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Wordmark */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div>
            <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, fontWeight: 400, color: '#1C1917', letterSpacing: '-0.5px' }}>nayba</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: 'rgba(0,0,0,0.25)' }} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', color: 'rgba(34,34,34,0.35)', textTransform: 'uppercase' as const }}>Admin</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-[rgba(34,34,34,0.35)] hover:text-[#222]">
            <X size={20} />
          </button>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 px-3 pb-3 overflow-y-auto">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-3">
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.8px', color: 'rgba(34,34,34,0.35)', textTransform: 'uppercase' as const, padding: '8px 12px 4px' }}>
                {section.label}
              </p>
              {section.items.map(item => {
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleTabClick(item.key)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-[14px] mb-0.5 transition-colors"
                    style={{
                      fontWeight: active ? 600 : 400,
                      background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
                      color: active ? '#1C1917' : 'rgba(34,34,34,0.60)',
                    }}
                  >
                    <item.icon size={18} strokeWidth={active ? 2 : 1.5} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.key === 'creators' && pendingCount > 0 && (
                      <span className="min-w-[20px] h-[20px] rounded-full bg-[#C4674A] text-white text-[11px] font-bold flex items-center justify-center px-1.5">
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
        <div className="px-3 py-3 border-t border-[#E6E2DB]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-[8px] hover:bg-[#F7F7F5] transition-colors group cursor-pointer" onClick={signOut}>
            <div className="w-8 h-8 rounded-full bg-[#C4674A] flex items-center justify-center flex-shrink-0">
              <span className="text-[13px] font-bold text-white">{adminInitial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#222] truncate">{adminName}</p>
              <p className="text-[11px] text-[rgba(34,34,34,0.35)] truncate">{user?.email}</p>
            </div>
            <LogOut size={14} className="text-[rgba(34,34,34,0.35)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* ─── Main area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 h-[56px] bg-white border-b border-[#E6E2DB]">
          <button onClick={() => setSidebarOpen(true)} className="text-[rgba(34,34,34,0.60)]">
            <Menu size={22} />
          </button>
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, fontWeight: 400, color: '#1C1917', letterSpacing: '-0.5px' }}>nayba</span>
        </div>

        {/* Desktop topbar */}
        <div className="hidden md:flex items-center justify-between h-[56px] px-8 bg-white border-b border-[#E6E2DB] flex-shrink-0">
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#1C1917', letterSpacing: '-0.2px', margin: 0 }}>
            {PAGE_TITLES[activeTab]}
          </h1>
          {cta.show && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#C4674A] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
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
