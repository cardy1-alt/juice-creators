import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Send } from 'lucide-react';

interface Campaign {
  id: string; title: string; target_city: string | null; target_county: string | null;
  perk_description: string | null; perk_value: number | null; expression_deadline: string | null;
  businesses?: { name: string };
}
interface NotificationLog {
  id: string; message: string; email_type: string | null; campaign_id: string | null;
  created_at: string; user_type: string;
}

const thCls = "text-left text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] py-[10px] px-4 bg-[rgba(42,32,24,0.02)]";
const tdCls = "py-0 px-4 text-[14px] text-[var(--ink)] border-b border-[rgba(42,32,24,0.06)]";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtShort(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function AdminNotificationsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [campRes, logRes] = await Promise.all([
      supabase.from('campaigns').select('id, title, target_city, target_county, perk_description, perk_value, expression_deadline, businesses(name)').in('status', ['active', 'live']).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('user_type', 'creator').not('campaign_id', 'is', null).order('created_at', { ascending: false }).limit(100),
    ]);
    if (campRes.data) setCampaigns(campRes.data as Campaign[]);
    if (logRes.data) setLogs(logRes.data as NotificationLog[]);
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  useEffect(() => {
    if (!selectedCampaign) { setRecipientCount(0); return; }
    const fetchRecipients = async () => {
      let query = supabase.from('creators').select('id', { count: 'exact', head: true }).eq('approved', true);
      // Note: ilike substring match can be broad (e.g. "Bury" matches "Sudbury").
      // Acceptable for pilot — creator addresses are short city names. For scale,
      // add a dedicated city column with normalized values.
      if (selectedCampaign.target_city) {
        const escaped = selectedCampaign.target_city.replace(/[%_]/g, '\\$&');
        query = query.ilike('address', `%${escaped}%`);
      }
      const { count } = await query;
      setRecipientCount(count || 0);
    };
    fetchRecipients();
  }, [selectedCampaignId]);

  const handleSend = async () => {
    if (!selectedCampaign) return;
    setSending(true);
    let query = supabase.from('creators').select('id, email, display_name, name').eq('approved', true);
    if (selectedCampaign.target_city) {
      const escaped = selectedCampaign.target_city.replace(/[%_]/g, '\\$&');
      query = query.ilike('address', `%${escaped}%`);
    }
    const { data: creators } = await query;
    if (!creators || creators.length === 0) { setToast('No eligible creators found'); setSending(false); return; }
    const notifications = creators.map((c: any) => ({
      user_id: c.id, user_type: 'creator',
      message: `New campaign just dropped — ${selectedCampaign.businesses?.name}: ${selectedCampaign.title}`,
      email_type: 'campaign_notification', campaign_id: selectedCampaign.id,
      email_meta: { campaign_id: selectedCampaign.id, campaign_title: selectedCampaign.title, brand_name: selectedCampaign.businesses?.name || '' },
    }));
    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) { setToast('Failed to send notifications — try again'); setSending(false); return; }
    setToast(`Sent to ${creators.length} creator${creators.length !== 1 ? 's' : ''}`);
    setTimeout(() => setToast(null), 4000);
    setSending(false);
    setSelectedCampaignId('');
    fetchData();
  };

  const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-35)] font-['Instrument_Sans']";

  return (
    <div>
      {toast && (
        <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[999px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>{toast}</div>
      )}

      {/* Send notification card */}
      <div className="bg-white rounded-[12px] p-6 mb-6">
        <h2 className="text-[18px] font-semibold text-[var(--ink)] mb-4">Send Campaign Notification</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1.5">Select Campaign</label>
            <select value={selectedCampaignId} onChange={e => setSelectedCampaignId(e.target.value)} className={inputCls}>
              <option value="">Choose a campaign...</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.businesses?.name} — {c.title}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            {selectedCampaignId && (
              <button onClick={handleSend} disabled={sending}
                disabled={sending || recipientCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--terra)] text-white text-[14px] hover:opacity-[0.85] disabled:opacity-50"
                style={{ fontWeight: 700 }}>
                <Send size={14} /> {sending ? 'Sending...' : `Send to ${recipientCount} creators`}
              </button>
            )}
          </div>
        </div>
        {selectedCampaignId && recipientCount > 0 && (
          <p className="text-[14px] text-[var(--ink-60)] mb-4">{recipientCount} approved creator{recipientCount !== 1 ? 's' : ''} in {selectedCampaign?.target_city || 'all locations'}</p>
        )}

        {/* Email preview */}
        {selectedCampaign && (
          <div className="border border-[rgba(42,32,24,0.08)] rounded-[10px] bg-[rgba(42,32,24,0.02)] p-5">
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.6px', color: 'var(--ink-60)', textTransform: 'uppercase' as const, marginBottom: 12 }}>Email Preview</p>
            <div className="bg-white rounded-[10px] border border-[rgba(42,32,24,0.08)] p-5 max-w-lg">
              <p className="text-[12px] text-[var(--ink-35)] mb-1">Subject</p>
              <p className="text-[15px] font-semibold text-[var(--ink)] mb-4">New campaign just dropped — {selectedCampaign.businesses?.name}</p>
              <div className="text-[14px] text-[var(--ink)] space-y-2 leading-[1.65]">
                <p>Hey [creator name]!</p>
                <p>A new campaign is live on nayba:</p>
                <p className="font-semibold text-[16px]">{selectedCampaign.title}</p>
                {selectedCampaign.perk_description && <p className="text-[var(--ink-60)]">{selectedCampaign.perk_description.slice(0, 80)}{selectedCampaign.perk_value ? ` — worth £${selectedCampaign.perk_value}` : ''}</p>}
                {selectedCampaign.expression_deadline && <p className="text-[var(--ink-60)]">Apply by {fmtShort(selectedCampaign.expression_deadline)}</p>}
                <div className="pt-3">
                  <span className="inline-block px-5 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px]" style={{ fontWeight: 700 }}>
                    See the campaign →
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {logs.map(n => (
          <div key={n.id} className="bg-white rounded-[12px] p-4" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] text-[var(--ink-35)]">{fmtDate(n.created_at)}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-[999px] text-[12px] font-semibold" style={{ background: 'rgba(196,103,74,0.08)', color: 'var(--terra)' }}>
                {n.email_type?.replace(/_/g, ' ') || 'notification'}
              </span>
            </div>
            <p className="text-[14px] text-[var(--ink)] line-clamp-2">{n.message}</p>
          </div>
        ))}
        {logs.length === 0 && <p className="py-12 text-center text-[14px] text-[var(--ink-60)]">No notifications sent yet</p>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-[12px] overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead><tr>
            <th className={thCls}>Sent</th><th className={thCls}>Campaign</th><th className={thCls}>Recipients</th><th className={thCls}>Type</th>
          </tr></thead>
          <tbody>
            {logs.map(n => (
              <tr key={n.id} className="hover:bg-[rgba(42,32,24,0.03)] transition-colors" style={{ height: 44 }}>
                <td className={`${tdCls} text-[var(--ink-35)] whitespace-nowrap`}>{fmtDate(n.created_at)}</td>
                <td className={`${tdCls} text-[var(--ink-60)] max-w-[300px] truncate`}>{n.message}</td>
                <td className={tdCls}>1</td>
                <td className={tdCls}>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-[10px] text-[12px] font-semibold" style={{ background: 'rgba(196,103,74,0.08)', color: 'var(--terra)' }}>
                    {n.email_type?.replace(/_/g, ' ') || 'notification'}
                  </span>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="py-12 text-center text-[14px] text-[var(--ink-60)]">No notifications sent yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
