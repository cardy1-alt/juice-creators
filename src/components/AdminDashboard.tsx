import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { Megaphone, Users, Store, BarChart3, Bell, Settings, LogOut, Menu, X } from 'lucide-react';
import AdminCampaignsTab from './admin/AdminCampaignsTab';
import AdminCreatorsTab from './admin/AdminCreatorsTab';
import AdminBrandsTab from './admin/AdminBrandsTab';
import AdminAnalyticsTab from './admin/AdminAnalyticsTab';
import AdminNotificationsTab from './admin/AdminNotificationsTab';
import AdminSettingsTab from './admin/AdminSettingsTab';

type Tab = 'campaigns' | 'creators' | 'brands' | 'analytics' | 'notifications' | 'settings';

const TABS: { key: Tab; label: string; icon: typeof Megaphone }[] = [
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { key: 'creators', label: 'Creators', icon: Users },
  { key: 'brands', label: 'Brands', icon: Store },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('campaigns');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-[var(--shell)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-[rgba(34,34,34,0.4)] z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — hidden on mobile by default, overlay when open */}
      <aside className={`
        w-[240px] bg-[var(--card)] border-r border-[var(--border)] flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <Logo size={28} variant="wordmark" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--ink-35)] mt-1">Admin</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-[var(--ink-35)] hover:text-[var(--ink)]">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3">
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-sm)] text-[14px] font-medium mb-0.5 transition-colors ${
                  active
                    ? 'bg-[var(--terra-light)] text-[var(--terra)]'
                    : 'text-[var(--ink-60)] hover:bg-[var(--shell)] hover:text-[var(--ink)]'
                }`}
              >
                <tab.icon size={18} strokeWidth={active ? 2 : 1.5} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-[var(--border)]">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-sm)] text-[14px] font-medium text-[var(--ink-35)] hover:bg-[var(--shell)] hover:text-[var(--ink)] transition-colors"
          >
            <LogOut size={18} strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[var(--card)] border-b border-[var(--border)]">
          <button onClick={() => setSidebarOpen(true)} className="text-[var(--ink-60)] hover:text-[var(--ink)]">
            <Menu size={22} />
          </button>
          <Logo size={22} variant="wordmark" />
        </div>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          {activeTab === 'campaigns' && <AdminCampaignsTab />}
          {activeTab === 'creators' && <AdminCreatorsTab />}
          {activeTab === 'brands' && <AdminBrandsTab />}
          {activeTab === 'analytics' && <AdminAnalyticsTab />}
          {activeTab === 'notifications' && <AdminNotificationsTab />}
          {activeTab === 'settings' && <AdminSettingsTab />}
        </main>
      </div>
    </div>
  );
}
