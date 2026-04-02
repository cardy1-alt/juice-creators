import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Eye } from 'lucide-react';

interface Campaign {
  id: string; title: string; target_city: string | null; target_county: string | null;
  businesses?: { name: string };
}
interface NotificationLog {
  id: string; message: string; email_type: string | null; campaign_id: string | null;
  created_at: string; user_type: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminNotificationsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [campRes, logRes] = await Promise.all([
      supabase.from('campaigns').select('id, title, target_city, target_county, businesses(name)').in('status', ['active', 'live']).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('user_type', 'creator').not('campaign_id', 'is', null).order('created_at', { ascending: false }).limit(100),
    ]);
    if (campRes.data) setCampaigns(campRes.data as Campaign[]);
    if (logRes.data) setLogs(logRes.data as NotificationLog[]);
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  useEffect(() => {
    if (!selectedCampaign) { setRecipientCount(0); return; }
    // Count eligible creators in target city/county
    const fetchRecipients = async () => {
      let query = supabase.from('creators').select('id', { count: 'exact', head: true }).eq('approved', true);
      if (selectedCampaign.target_city) {
        query = query.ilike('address', `%${selectedCampaign.target_city}%`);
      }
      const { count } = await query;
      setRecipientCount(count || 0);
    };
    fetchRecipients();
  }, [selectedCampaignId]);

  const handleSend = async () => {
    if (!selectedCampaign) return;
    setSending(true);

    // Fetch eligible creators
    let query = supabase.from('creators').select('id, email, display_name, name').eq('approved', true);
    if (selectedCampaign.target_city) {
      query = query.ilike('address', `%${selectedCampaign.target_city}%`);
    }
    const { data: creators } = await query;

    if (!creators || creators.length === 0) {
      setToast('No eligible creators found');
      setSending(false);
      return;
    }

    // Insert notification for each creator
    const notifications = creators.map((c: any) => ({
      user_id: c.id,
      user_type: 'creator',
      message: `New campaign just dropped — ${selectedCampaign.businesses?.name}: ${selectedCampaign.title}`,
      email_type: 'campaign_notification',
      campaign_id: selectedCampaign.id,
      email_meta: {
        campaign_id: selectedCampaign.id,
        campaign_title: selectedCampaign.title,
        brand_name: selectedCampaign.businesses?.name || '',
      },
    }));

    await supabase.from('notifications').insert(notifications);

    setToast(`Notification sent to ${creators.length} creator${creators.length !== 1 ? 's' : ''}`);
    setTimeout(() => setToast(null), 4000);
    setSending(false);
    setSelectedCampaignId('');
    setPreview(false);
    fetchData();
  };

  const thCls = 'text-left text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] py-3 px-3 border-b border-[var(--ink-10)]';
  const tdCls = 'py-3 px-3 text-[14px] text-[var(--ink)] border-b border-[var(--ink-10)]';
  const inputCls = 'w-full px-3 py-2 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)]';

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--ink)] text-white px-4 py-2.5 rounded-[var(--r-sm)] text-[14px] font-medium shadow-lg">{toast}</div>
      )}

      <h1 className="text-[24px] font-bold text-[var(--ink)] mb-5" style={{ letterSpacing: '-0.4px' }}>Notifications</h1>

      {/* Send campaign notification */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-6 mb-6">
        <h2 className="text-[18px] font-semibold text-[var(--ink)] mb-4">Send Campaign Notification</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1.5">Select campaign</label>
            <select value={selectedCampaignId} onChange={e => { setSelectedCampaignId(e.target.value); setPreview(false); }} className={inputCls}>
              <option value="">Choose a campaign...</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.businesses?.name} — {c.title}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            {selectedCampaignId && (
              <>
                <button onClick={() => setPreview(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-[var(--r-pill)] border border-[var(--border)] text-[var(--ink)] font-semibold text-[14px] hover:bg-[var(--shell)]">
                  <Eye size={15} /> Preview
                </button>
                <button onClick={handleSend} disabled={sending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[14px] hover:opacity-90 disabled:opacity-50"
                  style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
                  <Send size={15} /> {sending ? 'Sending...' : `Send to ${recipientCount} creators`}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Email preview */}
        {preview && selectedCampaign && (
          <div className="border border-[var(--border)] rounded-[var(--r-sm)] p-5 bg-[var(--shell)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-3">Email Preview</p>
            <div className="bg-white rounded-[var(--r-sm)] border border-[var(--ink-10)] p-5 max-w-lg">
              <p className="text-[13px] text-[var(--ink-35)] mb-1">Subject:</p>
              <p className="text-[15px] font-semibold text-[var(--ink)] mb-4">New campaign just dropped — {selectedCampaign.businesses?.name}</p>
              <p className="text-[13px] text-[var(--ink-35)] mb-1">Body:</p>
              <div className="text-[14px] text-[var(--ink)] space-y-2">
                <p>Hey!</p>
                <p>A new campaign is live on nayba:</p>
                <p className="font-semibold">{selectedCampaign.title}</p>
                <p className="text-[var(--ink-60)]">{selectedCampaign.target_city}</p>
                <div className="mt-3">
                  <span className="inline-block px-4 py-2 rounded-[var(--r-pill)] bg-[var(--terra)] text-white text-[14px] font-semibold">
                    View Campaign
                  </span>
                </div>
                <p className="text-[12px] text-[var(--ink-35)] mt-3">→ app.nayba.app?campaign={selectedCampaign.id}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification log */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--ink-10)]">
          <h3 className="text-[14px] font-semibold text-[var(--ink)]">Sent Notifications</h3>
        </div>
        <table className="w-full">
          <thead><tr>
            <th className={thCls}>Sent</th><th className={thCls}>Type</th><th className={thCls}>Message</th>
          </tr></thead>
          <tbody>
            {logs.map(n => (
              <tr key={n.id} className="hover:bg-[var(--shell)]">
                <td className={`${tdCls} text-[var(--ink-35)] whitespace-nowrap`}>{fmtDate(n.created_at)}</td>
                <td className={tdCls}>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--r-sm)] text-[11px] font-semibold bg-[var(--terra-light)] text-[var(--terra)]">
                    {n.email_type?.replace(/_/g, ' ') || 'notification'}
                  </span>
                </td>
                <td className={`${tdCls} text-[var(--ink-60)] max-w-md truncate`}>{n.message}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-[14px] text-[var(--ink-35)]">No notifications sent yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
