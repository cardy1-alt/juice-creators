import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, UserPlus, CheckCircle2, XCircle, Megaphone, Video, MessageSquare, Mail, Clock, AlertCircle } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────
interface NotificationRow {
  id: string;
  user_id: string;
  user_type: 'creator' | 'business' | 'admin';
  message: string;
  email_type: string | null;
  email_sent: boolean | null;
  email_meta: Record<string, string> | null;
  campaign_id: string | null;
  created_at: string;
}

type Filter = 'all' | 'signups' | 'approvals' | 'campaigns' | 'content' | 'feedback';

// Short, human-readable label per email_type. Keeps the feed scannable.
const EVENT_LABELS: Record<string, string> = {
  admin_signup: 'New signup',
  admin_approval_request: 'Awaiting approval',
  creator_welcome: 'Creator welcomed',
  business_welcome: 'Brand welcomed',
  creator_approved: 'Creator approved',
  business_approved: 'Brand approved',
  creator_denied: 'Creator denied',
  business_denied: 'Brand denied',
  creator_selected: 'Creator selected for campaign',
  creator_confirmed: 'Spot confirmed',
  creator_deadline_reminder: 'Deadline reminder',
  creator_content_received: 'Content received',
  creator_campaign_complete: 'Campaign complete',
  admin_content_submitted: 'Reel submitted',
  content_overdue: 'Content overdue',
  weekly_digest: 'Weekly digest',
  feedback: 'Feedback submitted',
  offer_claimed_creator: 'Offer claimed',
  visit_confirmed_creator: 'Visit confirmed',
  reel_due_reminder: 'Reel due reminder',
};

// Group families so the filter chips are manageable.
const FAMILY: Record<string, Filter> = {
  admin_signup: 'signups',
  admin_approval_request: 'signups',
  creator_welcome: 'signups',
  business_welcome: 'signups',
  creator_approved: 'approvals',
  business_approved: 'approvals',
  creator_denied: 'approvals',
  business_denied: 'approvals',
  creator_selected: 'campaigns',
  creator_confirmed: 'campaigns',
  creator_deadline_reminder: 'campaigns',
  creator_campaign_complete: 'campaigns',
  creator_content_received: 'content',
  admin_content_submitted: 'content',
  content_overdue: 'content',
  feedback: 'feedback',
};

function iconFor(emailType: string | null): { Icon: typeof UserPlus; color: string } {
  const fam = FAMILY[emailType || ''] || 'all';
  if (fam === 'signups') return { Icon: UserPlus, color: 'var(--terra)' };
  if (fam === 'approvals') {
    if (emailType === 'creator_denied' || emailType === 'business_denied') return { Icon: XCircle, color: '#DC2626' };
    return { Icon: CheckCircle2, color: '#2D7A4F' };
  }
  if (fam === 'campaigns') return { Icon: Megaphone, color: '#3D5A7A' };
  if (fam === 'content') return { Icon: Video, color: '#7A5A3D' };
  if (fam === 'feedback') return { Icon: MessageSquare, color: '#5A3D7A' };
  return { Icon: Mail, color: 'var(--ink-60)' };
}

function fmtRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtAbs(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Tab ───────────────────────────────────────────────────────────────
export default function AdminActivityTab() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [businessNames, setBusinessNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  const fetchActivity = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    const list = (data as NotificationRow[]) || [];
    setRows(list);

    // Resolve user display names in batch — keeps the feed readable without N+1 queries.
    const creatorIds = new Set<string>();
    const businessIds = new Set<string>();
    list.forEach(r => {
      if (r.user_type === 'creator' && r.user_id !== '00000000-0000-0000-0000-000000000000') creatorIds.add(r.user_id);
      if (r.user_type === 'business' && r.user_id !== '00000000-0000-0000-0000-000000000000') businessIds.add(r.user_id);
    });
    if (creatorIds.size > 0) {
      const { data: c } = await supabase.from('creators').select('id, display_name, name, email').in('id', Array.from(creatorIds));
      const map: Record<string, string> = {};
      (c || []).forEach((row: any) => { map[row.id] = row.display_name || row.name || row.email || row.id.slice(0, 8); });
      setCreatorNames(map);
    }
    if (businessIds.size > 0) {
      const { data: b } = await supabase.from('businesses').select('id, name, owner_email').in('id', Array.from(businessIds));
      const map: Record<string, string> = {};
      (b || []).forEach((row: any) => { map[row.id] = row.name || row.owner_email || row.id.slice(0, 8); });
      setBusinessNames(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchActivity(); }, []);

  const resolveName = (r: NotificationRow): string => {
    if (r.user_type === 'admin') {
      // Admin rows usually carry the subject in email_meta.display_name (e.g. new signup)
      const meta = r.email_meta || {};
      return meta.display_name || meta.creator_name || 'System';
    }
    if (r.user_type === 'creator') return creatorNames[r.user_id] || r.user_id.slice(0, 8);
    if (r.user_type === 'business') return businessNames[r.user_id] || r.user_id.slice(0, 8);
    return '—';
  };

  const filtered = rows.filter(r => {
    if (filter === 'all') return true;
    return FAMILY[r.email_type || ''] === filter;
  });

  const filterChips: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'signups', label: 'Signups' },
    { key: 'approvals', label: 'Approvals' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'content', label: 'Content' },
    { key: 'feedback', label: 'Feedback' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterChips.map(chip => {
            const active = filter === chip.key;
            return (
              <button key={chip.key} onClick={() => setFilter(chip.key)}
                className="px-3 py-1.5 rounded-[999px] text-[12px] transition-colors"
                style={{
                  fontWeight: active ? 700 : 500,
                  background: active ? 'var(--terra)' : 'white',
                  color: active ? 'white' : 'var(--ink-60)',
                  border: active ? '1px solid var(--terra)' : '1px solid rgba(42,32,24,0.12)',
                }}>
                {chip.label}
              </button>
            );
          })}
        </div>
        <button onClick={fetchActivity} disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[rgba(42,32,24,0.08)] text-[13px] font-semibold text-[var(--ink-60)] hover:bg-white disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="bg-white border border-[rgba(42,32,24,0.08)] rounded-[12px] overflow-hidden">
        {filtered.length === 0 && !loading && (
          <div className="py-16 text-center">
            <AlertCircle size={20} className="text-[var(--ink-35)] mx-auto mb-2" />
            <p className="text-[14px] text-[var(--ink-35)]">No activity yet</p>
          </div>
        )}
        {loading && rows.length === 0 && (
          <div className="py-16 text-center text-[14px] text-[var(--ink-35)]">Loading activity…</div>
        )}
        <ul className="divide-y divide-[rgba(42,32,24,0.06)]">
          {filtered.map(r => {
            const { Icon, color } = iconFor(r.email_type);
            const label = EVENT_LABELS[r.email_type || ''] || r.email_type || 'Notification';
            const who = resolveName(r);
            return (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[rgba(42,32,24,0.02)] transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(42,32,24,0.04)' }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-[var(--ink)]">{label}</span>
                    <span className="text-[13px] text-[var(--ink-60)]">· {who}</span>
                    {r.email_sent === false && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[999px] text-[10px] font-semibold" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
                        <AlertCircle size={10} /> email not sent
                      </span>
                    )}
                    {r.email_sent === true && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[999px] text-[10px] font-medium" style={{ background: 'rgba(45,122,79,0.08)', color: '#2D7A4F' }}>
                        <Mail size={10} /> sent
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[var(--ink-60)] leading-[1.5] mt-0.5 break-words">{r.message}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 ml-2">
                  <span className="inline-flex items-center gap-1 text-[12px] text-[var(--ink-35)]" title={fmtAbs(r.created_at)}>
                    <Clock size={11} /> {fmtRelative(r.created_at)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {rows.length >= 200 && (
        <p className="text-[12px] text-[var(--ink-35)] text-center mt-3">Showing the last 200 events</p>
      )}
    </div>
  );
}
