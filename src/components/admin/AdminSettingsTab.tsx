import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { Eye, EyeOff } from 'lucide-react';

export default function AdminSettingsTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Feature flags (stored in localStorage for now — no server config table at pilot)
  const [instagramEnabled, setInstagramEnabled] = useState(() => {
    try { return localStorage.getItem('nayba_flag_instagram_api') === 'true'; } catch { return false; }
  });
  const [naybahoodEnabled, setNaybahoodEnabled] = useState(() => {
    try { return localStorage.getItem('nayba_flag_naybahood') !== 'false'; } catch { return true; }
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setSaving(true);

    // Verify current password
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        setPasswordMessage({ type: 'error', text: 'Current password is incorrect' });
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      if (error.message.includes('same')) {
        setPasswordMessage({ type: 'error', text: 'New password must be different from current password' });
      } else {
        setPasswordMessage({ type: 'error', text: friendlyError(error.message) });
      }
    } else {
      setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const toggleFlag = (key: string, value: boolean, setter: (v: boolean) => void) => {
    try { localStorage.setItem(`nayba_flag_${key}`, String(value)); } catch {}
    setter(value);
  };

  const inputCls = 'w-full px-3 py-2 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)]';
  const labelCls = 'block text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1.5';

  return (
    <div>
      <h1 className="text-[24px] font-bold text-[var(--ink)] mb-5" style={{ letterSpacing: '-0.4px' }}>Settings</h1>

      {/* Change Password */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-6 mb-6 max-w-lg">
        <h2 className="text-[18px] font-semibold text-[var(--ink)] mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className={labelCls}>Current password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)} className={inputCls} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-35)] hover:text-[var(--ink)]">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>New password</label>
            <input type={showPassword ? 'text' : 'password'} value={newPassword}
              onChange={e => setNewPassword(e.target.value)} className={inputCls} placeholder="At least 8 characters" required />
          </div>
          <div>
            <label className={labelCls}>Confirm new password</label>
            <input type={showPassword ? 'text' : 'password'} value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} className={inputCls} required />
          </div>
          {passwordMessage && (
            <p className={`text-[14px] ${passwordMessage.type === 'success' ? 'text-[var(--success)]' : 'text-[var(--terra)]'}`}>
              {passwordMessage.text}
            </p>
          )}
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Feature Flags */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-6 max-w-lg">
        <h2 className="text-[18px] font-semibold text-[var(--ink)] mb-4">Feature Flags</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-[15px] font-medium text-[var(--ink)]">Instagram API</p>
              <p className="text-[13px] text-[var(--ink-35)]">Enable Instagram OAuth and automatic reach/engagement data</p>
            </div>
            <button onClick={() => toggleFlag('instagram_api', !instagramEnabled, setInstagramEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${instagramEnabled ? 'bg-[var(--terra)]' : 'bg-[var(--ink-10)]'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${instagramEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="border-t border-[var(--ink-10)]" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-[15px] font-medium text-[var(--ink)]">The Naybahood</p>
              <p className="text-[13px] text-[var(--ink-35)]">Show the Naybahood tab in the creator app</p>
            </div>
            <button onClick={() => toggleFlag('naybahood', !naybahoodEnabled, setNaybahoodEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${naybahoodEnabled ? 'bg-[var(--terra)]' : 'bg-[var(--ink-10)]'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${naybahoodEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
