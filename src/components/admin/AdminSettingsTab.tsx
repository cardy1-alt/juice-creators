import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { Eye, EyeOff } from 'lucide-react';
import EmailTemplateEditor from './EmailTemplateEditor';
import { EMAIL_TEMPLATES, EmailTemplate } from '../../lib/emailPreview';

const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-50)] font-['Instrument_Sans']";
const labelCls = "block text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1.5";

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className="relative w-[44px] h-[24px] rounded-full transition-colors duration-200 flex-shrink-0"
      style={{ background: enabled ? 'var(--terra)' : 'rgba(42,32,24,0.10)' }}>
      <span className="absolute top-[2px] left-[2px] w-[20px] h-[20px] bg-white rounded-full transition-transform duration-200"
        style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)', boxShadow: '0 1px 3px rgba(42,32,24,0.12)' }} />
    </button>
  );
}

export default function AdminSettingsTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [instagramEnabled, setInstagramEnabled] = useState(() => {
    try { return localStorage.getItem('nayba_flag_instagram_api') === 'true'; } catch { return false; }
  });
  const [naybahoodEnabled, setNaybahoodEnabled] = useState(() => {
    try { return localStorage.getItem('nayba_flag_naybahood') !== 'false'; } catch { return true; }
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword.length < 8) { setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters' }); return; }
    if (newPassword !== confirmPassword) { setPasswordMessage({ type: 'error', text: 'New passwords do not match' }); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (verifyError) { setPasswordMessage({ type: 'error', text: 'Current password is incorrect' }); setSaving(false); return; }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      setPasswordMessage({ type: 'error', text: friendlyError(error.message) });
    } else {
      setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
  };

  const toggleFlag = (key: string, value: boolean, setter: (v: boolean) => void) => {
    try { localStorage.setItem(`nayba_flag_${key}`, String(value)); } catch {}
    setter(value);
  };

  const NOTIFICATION_GROUPS = [
    {
      label: 'Creator Emails',
      items: [
        { key: 'creator_welcome', name: 'Welcome email', desc: 'Sent when a creator signs up' },
        { key: 'creator_approved', name: 'Account approved', desc: 'Sent when admin approves a creator' },
        { key: 'creator_denied', name: 'Account denied', desc: 'Sent when admin denies a creator' },
        { key: 'creator_selected', name: 'Selected for campaign', desc: 'Sent when a creator is selected by admin' },
        { key: 'creator_confirmed', name: 'Spot confirmed', desc: 'Sent when creator confirms — includes perk details and brand address' },
        { key: 'creator_deadline_reminder', name: 'Deadline reminder', desc: 'Sent 48 hours before content deadline' },
        { key: 'creator_content_received', name: 'Content received', desc: 'Sent when creator submits their Reel' },
        { key: 'creator_campaign_complete', name: 'Campaign complete', desc: 'Sent when campaign is marked complete' },
        { key: 'weekly_digest', name: 'Weekly digest', desc: 'Weekly roundup of new campaigns in their area' },
      ],
    },
    {
      label: 'Brand Emails',
      items: [
        { key: 'business_welcome', name: 'Welcome email', desc: 'Sent when a brand account is created' },
        { key: 'business_approved', name: 'Account approved', desc: 'Sent when admin approves a brand' },
        { key: 'business_campaign_live', name: 'Campaign live', desc: 'Sent when a campaign is published' },
        { key: 'business_creator_confirmed', name: 'Creator confirmed', desc: 'Sent when a creator confirms — includes creator name and Instagram' },
      ],
    },
    {
      label: 'Admin Emails',
      items: [
        { key: 'admin_signup', name: 'New signup', desc: 'Notified when a new creator or brand signs up' },
        { key: 'admin_approval_request', name: 'Approval request', desc: 'Notified when a creator needs approval' },
        { key: 'admin_interest_expressed', name: 'Interest expressed', desc: 'Notified when a creator applies to a campaign' },
        { key: 'admin_creator_confirmed', name: 'Creator confirmed', desc: 'Notified when a creator confirms their spot' },
        { key: 'admin_content_submitted', name: 'Content submitted', desc: 'Notified when a creator submits a Reel' },
        { key: 'feedback', name: 'Feedback received', desc: 'Notified when a user submits feedback' },
      ],
    },
  ];

  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('nayba_notification_settings');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const isNotifEnabled = (key: string) => notifSettings[key] !== false; // default on

  const toggleNotif = (key: string) => {
    const updated = { ...notifSettings, [key]: !isNotifEnabled(key) };
    setNotifSettings(updated);
    try { localStorage.setItem('nayba_notification_settings', JSON.stringify(updated)); } catch {}
  };

  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  return (
    <div className="max-w-[520px]">
      {/* Change Password */}
      <div className="bg-white rounded-[12px] p-6 mb-4">
        <h2 className="text-[20px] font-semibold text-[var(--ink)] mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className={labelCls}>Current Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputCls} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-50)]">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>New Password</label>
            <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} placeholder="At least 8 characters" required />
          </div>
          <div>
            <label className={labelCls}>Confirm New Password</label>
            <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} required />
          </div>
          {passwordMessage && (
            <p className={`text-[14px] ${passwordMessage.type === 'success' ? 'text-[#2D7A4F]' : 'text-[var(--terra)]'}`}>{passwordMessage.text}</p>
          )}
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] hover:opacity-[0.85] disabled:opacity-50"
            style={{ fontWeight: 700 }}>
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Feature Flags */}
      <div className="bg-white rounded-[12px] p-6">
        <h2 className="text-[20px] font-semibold text-[var(--ink)] mb-4">Feature Flags</h2>
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-medium text-[var(--ink)]">Instagram API</p>
              <p className="text-[14px] text-[var(--ink-60)] leading-[1.5]">Enable Instagram OAuth and automatic reach/engagement data</p>
            </div>
            <Toggle enabled={instagramEnabled} onToggle={() => toggleFlag('instagram_api', !instagramEnabled, setInstagramEnabled)} />
          </div>
          <div className="border-t border-t-[rgba(42,32,24,0.08)]" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-medium text-[var(--ink)]">The Naybahood</p>
              <p className="text-[14px] text-[var(--ink-60)] leading-[1.5]">Show the Naybahood tab in the creator app</p>
            </div>
            <Toggle enabled={naybahoodEnabled} onToggle={() => toggleFlag('naybahood', !naybahoodEnabled, setNaybahoodEnabled)} />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-[12px] p-6 mt-4">
        <h2 className="text-[20px] font-semibold text-[var(--ink)] mb-1">Email Notifications</h2>
        <p className="text-[13px] text-[var(--ink-50)] mb-5">Control which emails are sent across the platform</p>

        {NOTIFICATION_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-6' : ''}>
            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-50)] mb-3">{group.label}</p>
            <div className="space-y-0">
              {group.items.map((item, i) => (
                <div key={item.key}>
                  {i > 0 && <div className="border-t border-[rgba(42,32,24,0.06)]" />}
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-[var(--ink)]">{item.name}</p>
                      <p className="text-[12px] text-[var(--ink-50)] leading-[1.5]">{item.desc}</p>
                    </div>
                    {(() => { const tmpl = EMAIL_TEMPLATES.find(t => t.key === item.key); return tmpl ? (
                      <button onClick={() => setEditingTemplate(tmpl)}
                        className="flex items-center gap-1 px-2 py-1 rounded-[8px] text-[12px] font-medium text-[var(--ink-50)] hover:bg-[rgba(42,32,24,0.04)] hover:text-[var(--ink)] transition-colors flex-shrink-0">
                        <Eye size={12} /> Preview
                      </button>
                    ) : null; })()}
                    <Toggle enabled={isNotifEnabled(item.key)} onToggle={() => toggleNotif(item.key)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Email template editor peek panel */}
      {editingTemplate && (
        <EmailTemplateEditor
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
        />
      )}
    </div>
  );
}
