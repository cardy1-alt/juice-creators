import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, AlertTriangle, Check } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-[16px] max-w-md w-full p-6 border border-[var(--faint)] shadow-[0_2px_12px_rgba(26,26,26,0.08)]" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[var(--bg)] flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-[var(--terra)]" />
            </div>
            <h3 className="text-xl font-display font-normal text-[var(--near-black)] mb-2">Report Submitted</h3>
            <p className="text-[var(--mid)] text-sm">
              Thanks for letting us know. We'll look into this and get back to you shortly.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[var(--terra-10)] flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[var(--terra)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--near-black)]">Report an Issue</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg)] rounded-[12px] transition-colors">
                <X className="w-5 h-5 text-[var(--soft)]" />
              </button>
            </div>

            <p className="text-sm text-[var(--mid)] mb-4">
              Let us know if something went wrong with this collaboration. We'll review and take appropriate action.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--near-black)] mb-2">
                  What happened?
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe the issue..."
                  rows={4}
                  className="w-full px-[14px] py-3 rounded-[12px] bg-[var(--bg)] text-[13px] text-[var(--near-black)] placeholder:text-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] transition-all resize-none"
                  required
                />
              </div>

              {disputeError && (
                <div className="p-3 rounded-[12px] bg-[var(--terra-10)] border border-[var(--terra-20)]">
                  <p className="text-[13px] font-medium text-[var(--terra)]">{disputeError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-full min-h-[48px] text-[var(--near-black)] font-semibold bg-[var(--bg)] hover:bg-[var(--pressed)] transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="flex-1 py-3 rounded-full min-h-[48px] text-white font-semibold bg-[var(--terra)] hover:bg-[var(--terra-hover)] disabled:opacity-50 transition-all text-sm"
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
