import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { Megaphone, Users, Store, BarChart3, Bell, Settings, LogOut } from 'lucide-react';
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

  return (
    <div className="flex min-h-screen bg-[var(--shell)]">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[var(--card)] border-r border-[var(--border)] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[var(--border)]">
          <Logo size={28} variant="wordmark" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--ink-35)] mt-1">Admin</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3">
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
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
      <main className="flex-1 p-8 overflow-auto">
        {activeTab === 'campaigns' && <AdminCampaignsTab />}
        {activeTab === 'creators' && <AdminCreatorsTab />}
        {activeTab === 'brands' && <AdminBrandsTab />}
        {activeTab === 'analytics' && <AdminAnalyticsTab />}
        {activeTab === 'notifications' && <AdminNotificationsTab />}
        {activeTab === 'settings' && <AdminSettingsTab />}
      </main>
    </div>
  );
}
