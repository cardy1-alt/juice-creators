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
      <div className="bg-white rounded-[20px] max-w-md w-full p-6 shadow-[0_1px_4px_rgba(44,44,44,0.06),0_4px_16px_rgba(44,44,44,0.04)]" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[#E8EDE8] flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-[#C4674A]" />
            </div>
            <h3 className="text-xl font-bold text-[#2C2C2C] mb-2">Report Submitted</h3>
            <p className="text-[rgba(44,44,44,0.45)] text-sm">
              Thanks for letting us know. We'll look into this and get back to you shortly.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-[#2C2C2C]">Report an Issue</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[#E8EDE8] rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Let us know if something went wrong with this collaboration. We'll review and take appropriate action.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#2C2C2C] mb-2">
                  What happened?
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe the issue..."
                  rows={4}
                  className="w-full px-[14px] py-3 rounded-[11px] bg-[#E8EDE8] text-[13px] text-[#2C2C2C] placeholder:text-[rgba(44,44,44,0.25)] focus:outline-none focus:ring-2 focus:ring-[#C4674A]/30 transition-all resize-none"
                  required
                />
              </div>

              {disputeError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <p className="text-sm text-rose-700">{disputeError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-[12px] text-[#2C2C2C] font-semibold bg-[#E8EDE8] hover:bg-[#dce3dc] transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="flex-1 py-2.5 rounded-[12px] text-white font-semibold bg-[#C4674A] hover:bg-[#b35a3f] disabled:opacity-50 transition-all text-sm"
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
