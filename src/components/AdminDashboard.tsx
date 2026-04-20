import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import NaybaLogo from '../assets/logomark.svg';
import { Megaphone, Users, Store, BarChart3, Bell, Activity, Settings, LogOut, Menu, X, Plus, PanelLeftClose, PanelLeftOpen, UserCheck, Newspaper } from 'lucide-react';
import AdminCampaignsTab from './admin/AdminCampaignsTab';
import AdminCreatorsTab from './admin/AdminCreatorsTab';
import AdminBrandsTab from './admin/AdminBrandsTab';
import AdminApplicantsTab from './admin/AdminApplicantsTab';
import AdminAnalyticsTab from './admin/AdminAnalyticsTab';
import AdminActivityTab from './admin/AdminActivityTab';
import AdminNotificationsTab from './admin/AdminNotificationsTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminBuryJuiceTab from './admin/AdminBuryJuiceTab';
import CommandPalette from './admin/CommandPalette';

type Tab = 'campaigns' | 'applicants' | 'creators' | 'brands' | 'bury-juice' | 'analytics' | 'activity' | 'broadcasts' | 'settings';

const NAV_SECTIONS = [
  {
    label: 'Platform',
    items: [
      { key: 'campaigns' as Tab, label: 'Campaigns', icon: Megaphone },
      { key: 'applicants' as Tab, label: 'Applicants', icon: UserCheck },
      { key: 'creators' as Tab, label: 'Creators', icon: Users },
      { key: 'brands' as Tab, label: 'Brands', icon: Store },
      { key: 'bury-juice' as Tab, label: 'Bury Juice', icon: Newspaper },
    ],
  },
  {
    label: 'Insights',
    items: [
      { key: 'analytics' as Tab, label: 'Analytics', icon: BarChart3 },
      { key: 'activity' as Tab, label: 'Activity', icon: Activity },
    ],
  },
  {
    label: 'Tools',
    items: [
      { key: 'broadcasts' as Tab, label: 'Broadcasts', icon: Bell },
      { key: 'settings' as Tab, label: 'Settings', icon: Settings },
    ],
  },
];

const PAGE_TITLES: Record<Tab, string> = {
  campaigns: 'Campaigns',
  applicants: 'Applicants',
  creators: 'Creators',
  brands: 'Brands',
  'bury-juice': 'Bury Juice',
  analytics: 'Analytics',
  activity: 'Activity',
  broadcasts: 'Broadcasts',
  settings: 'Settings',
};

const CTA_CONFIG: Record<Tab, { label: string; show: boolean }> = {
  campaigns: { label: 'New Campaign', show: true },
  applicants: { label: '', show: false },
  creators: { label: 'Create Creator', show: true },
  brands: { label: 'Create Brand', show: true },
  'bury-juice': { label: '', show: false },
  analytics: { label: '', show: false },
  activity: { label: '', show: false },
  broadcasts: { label: '', show: false },
  settings: { label: '', show: false },
};

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('campaigns');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingApplicantCount, setPendingApplicantCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [peekTarget, setPeekTarget] = useState<{ tab: Tab; entityId: string } | null>(null);

  const refreshPendingCounts = () => {
    // Pending = awaiting review. Denied rows have denied_at set and should
    // not be counted here, otherwise the sidebar badge sticks after denial.
    supabase.from('creators').select('id', { count: 'exact', head: true })
      .eq('approved', false).is('denied_at', null)
      .then(({ count }) => setPendingCount(count || 0));
    supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'interested')
      .then(({ count }) => setPendingApplicantCount(count || 0));
  };

  useEffect(() => {
    refreshPendingCounts();
  }, []);

  // Refresh counts when leaving applicants tab (after decisions made)
  useEffect(() => {
    if (activeTab !== 'applicants') refreshPendingCounts();
  }, [activeTab]);

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleCmdKNavigate = (tab: Tab, entityId?: string) => {
    setActiveTab(tab);
    setCmdkOpen(false);
    if (entityId) setPeekTarget({ tab, entityId });
  };

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
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-40 md:hidden animate-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── Sidebar ─── */}
      <aside className={`
        flex flex-col flex-shrink-0 transition-all duration-200
        fixed inset-y-0 left-0 z-50 md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ width: collapsed ? 64 : 240, background: 'var(--stone)', borderRight: '1px solid rgba(42,32,24,0.08)' }}>
        {/* Wordmark + collapse toggle */}
        <div className="flex items-center justify-between" style={{ padding: collapsed ? '20px 12px 16px' : '20px 20px 16px' }}>
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} title="Expand sidebar"
              className="flex justify-center w-full hover:opacity-70 transition-opacity">
              <Logo size={22} variant="icon" />
            </button>
          ) : (
            <>
              <Logo size={24} variant="wordmark" />
              <button onClick={() => setCollapsed(true)} title="Collapse sidebar"
                className="hidden md:flex items-center justify-center w-7 h-7 rounded-[8px] text-[var(--ink-35)] hover:text-[var(--ink-60)] hover:bg-[rgba(42,32,24,0.04)] transition-colors flex-shrink-0">
                <PanelLeftClose size={16} />
              </button>
            </>
          )}
          <button onClick={() => setSidebarOpen(false)} className="md:hidden flex-shrink-0" style={{ color: 'var(--ink-50)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: collapsed ? '0 8px 12px' : '0 12px 12px' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-3">
              {!collapsed && (
                <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', color: 'var(--ink-60)', textTransform: 'uppercase' as const, padding: '8px 12px 4px' }}>
                  {section.label}
                </p>
              )}
              {collapsed && <div className="h-2" />}
              {section.items.map(item => {
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleTabClick(item.key)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-[12px] mb-1 text-[14px] transition-colors relative ${collapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'}`}
                    style={{
                      fontWeight: active ? 700 : 500,
                      background: active ? 'var(--terra-10)' : 'transparent',
                      color: active ? 'var(--terra)' : 'var(--ink-60)',
                    }}
                  >
                    <item.icon size={18} strokeWidth={active ? 2 : 1.5} />
                    {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                    {(() => {
                      const badgeCount = item.key === 'creators' ? pendingCount : item.key === 'applicants' ? pendingApplicantCount : 0;
                      if (badgeCount === 0) return null;
                      if (collapsed) return <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: 'var(--terra)' }} />;
                      return (
                        <span className="flex items-center justify-center text-[12px] font-bold rounded-[6px]" style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)', padding: '2px 6px', minWidth: 20 }}>
                          {badgeCount}
                        </span>
                      );
                    })()}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User row */}
        <div style={{ borderTop: '1px solid rgba(42,32,24,0.08)', padding: collapsed ? '12px 8px 16px' : '12px 8px 16px' }}>
          <div
            className={`flex items-center rounded-[10px] hover:bg-[rgba(42,32,24,0.04)] transition-colors group cursor-pointer ${collapsed ? 'justify-center py-2' : 'gap-3 px-2 py-2'}`}
            onClick={() => setShowSignOutModal(true)}
            title={collapsed ? `${adminName} — Sign out` : undefined}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--terra-15)' }}>
              <span className="text-[12px] text-[var(--terra)]" style={{ fontWeight: 700 }}>{adminInitial}</span>
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium text-[var(--ink)] truncate">{adminName}</p>
                    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-[5px] flex-shrink-0" style={{ background: 'var(--terra-10)' }}>
                      <span className="w-[4px] h-[4px] rounded-full" style={{ background: 'var(--terra)' }} />
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--terra)', textTransform: 'uppercase' as const }}>Admin</span>
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--ink-50)] truncate">{user?.email}</p>
                </div>
                <LogOut size={14} className="text-[var(--ink-35)] group-hover:text-[var(--ink-60)] transition-colors flex-shrink-0" />
              </>
            )}
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
          {cta.show && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-[10px] bg-[var(--terra)] text-white text-[13px] font-semibold flex-shrink-0">
              <Plus size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">{cta.label}</span>
            </button>
          )}
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
          {activeTab === 'campaigns' && <AdminCampaignsTab showModal={showModal} onCloseModal={() => setShowModal(false)} onOpenModal={() => setShowModal(true)} initialPeekId={peekTarget?.tab === 'campaigns' ? peekTarget.entityId : undefined} onPeekHandled={() => setPeekTarget(null)} />}
          {activeTab === 'applicants' && <AdminApplicantsTab />}
          {activeTab === 'creators' && <AdminCreatorsTab showModal={showModal} onCloseModal={() => setShowModal(false)} initialPeekId={peekTarget?.tab === 'creators' ? peekTarget.entityId : undefined} onPeekHandled={() => setPeekTarget(null)} />}
          {activeTab === 'brands' && <AdminBrandsTab showModal={showModal} onCloseModal={() => setShowModal(false)} initialPeekId={peekTarget?.tab === 'brands' ? peekTarget.entityId : undefined} onPeekHandled={() => setPeekTarget(null)} />}
          {activeTab === 'bury-juice' && <AdminBuryJuiceTab />}
          {activeTab === 'analytics' && <AdminAnalyticsTab />}
          {activeTab === 'activity' && <AdminActivityTab />}
          {activeTab === 'broadcasts' && <AdminNotificationsTab />}
          {activeTab === 'settings' && <AdminSettingsTab />}
        </main>
      </div>

      {/* Cmd-K command palette */}
      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} onNavigate={handleCmdKNavigate} />

      {/* Sign-out confirmation modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-50 flex items-center justify-center animate-overlay">
          <div className="bg-white rounded-[12px] max-w-[340px] w-full mx-4 p-6 text-center animate-slide-up">
            <h3 className="nayba-h3">Sign out?</h3>
            <p className="text-[14px] text-[var(--ink-50)] mt-2 mb-5">You'll need to sign in again to access your account.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSignOutModal(false)} className="flex-1 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.15)] text-[var(--ink)] font-medium text-[14px]">Cancel</button>
              <button onClick={signOut} className="flex-1 py-2.5 rounded-[10px] bg-[var(--terra)] text-white font-semibold text-[14px]">Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
