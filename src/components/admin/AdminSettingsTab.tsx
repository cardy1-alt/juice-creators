import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { Eye, EyeOff } from 'lucide-react';

const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-35)] font-['Instrument_Sans']";
const labelCls = "block text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-35)] mb-1.5";

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
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-35)]">
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
    </div>
  );
}
