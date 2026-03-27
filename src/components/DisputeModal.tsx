import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Check, AlertTriangle, X } from 'lucide-react';

interface DisputeModalProps {
  claimId: string;
  reporterRole: 'creator' | 'business';
  onClose: () => void;
}

export default function DisputeModal({ claimId, reporterRole, onClose }: DisputeModalProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setDisputeError(null);
    try {
      const { error } = await supabase
        .from('disputes')
        .insert({
          claim_id: claimId,
          reporter_role: reporterRole,
          message: message.trim(),
        });

      if (error) throw error;
      setSubmitted(true);
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setDisputeError(err.message || 'Failed to submit dispute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(34,34,34,0.5)' }} onClick={onClose}>
      <div
        className="max-w-md w-full"
        style={{ background: 'var(--shell)', borderRadius: '24px', padding: '28px', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--card)' }}>
              <Check size={32} strokeWidth={1.5} className="text-[var(--terra)]" />
            </div>
            <h3 style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 800, fontSize: '20px', color: 'var(--ink)', marginBottom: '8px' }}>Report Submitted</h3>
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, fontSize: '15px', color: 'var(--ink-60)' }}>
              Thanks for letting us know. We'll look into this and get back to you shortly.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[var(--terra-10)] flex items-center justify-center">
                  <AlertTriangle size={20} strokeWidth={1.5} className="text-[var(--terra)]" />
                </div>
                <h3 style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 800, fontSize: '20px', color: 'var(--ink)' }}>Report an Issue</h3>
              </div>
              <button onClick={onClose} className="p-2 rounded-[12px] transition-colors" style={{ background: 'var(--card)' }}>
                <X size={20} strokeWidth={1.5} className="text-[var(--ink-35)]" />
              </button>
            </div>

            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, fontSize: '15px', color: 'var(--ink-60)', marginBottom: '16px' }}>
              Let us know if something went wrong with this collaboration. We'll review and take appropriate action.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '15px', color: 'var(--ink-60)', display: 'block', marginBottom: '8px' }}>
                  What happened?
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe the issue..."
                  rows={4}
                  className="w-full resize-none focus:outline-none transition-all"
                  style={{
                    fontFamily: "'Instrument Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: '15px',
                    color: 'var(--ink)',
                    background: 'var(--card)',
                    border: '1.5px solid var(--ink-08)',
                    borderRadius: '14px',
                    padding: '14px 16px',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--terra)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--terra-ring)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ink-08)'; e.currentTarget.style.boxShadow = 'none'; }}
                  required
                />
              </div>

              {disputeError && (
                <div className="p-3 rounded-[12px] bg-[var(--terra-10)] border border-[var(--terra-20)]">
                  <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500, fontSize: '15px', color: 'var(--terra)' }}>{disputeError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 min-h-[48px] transition-all"
                  style={{
                    fontFamily: "'Instrument Sans', sans-serif",
                    fontWeight: 600,
                    fontSize: '14px',
                    color: 'var(--ink)',
                    background: 'transparent',
                    border: '1.5px solid var(--ink-15)',
                    borderRadius: '999px',
                    padding: '13px 24px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="flex-1 min-h-[48px] text-white transition-all disabled:opacity-50"
                  style={{
                    fontFamily: "'Instrument Sans', sans-serif",
                    fontWeight: 700,
                    fontSize: '15px',
                    background: 'var(--terra)',
                    borderRadius: '999px',
                    padding: '13px 24px',
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
