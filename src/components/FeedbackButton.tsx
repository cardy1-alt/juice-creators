import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { sendFeedbackEmail } from '../lib/notifications';

interface FeedbackButtonProps {
  userId: string;
  userType: 'creator' | 'business';
  displayName: string;
  currentPage: string;
}

export default function FeedbackButton({ userId, userType, displayName, currentPage }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendFeedbackEmail({
        userId,
        userType,
        displayName,
        page: currentPage,
        feedback: text.trim(),
      });
      setSent(true);
      setText('');
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 2000);
    } catch {
      // Silently fail — feedback is non-critical
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating feedback button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-[90px] right-[16px] z-[100] w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all active:scale-95"
          style={{ background: 'var(--forest)', boxShadow: '0 2px 12px rgba(26,60,52,0.25)' }}
          aria-label="Send feedback"
        >
          <MessageSquare className="w-[18px] h-[18px] text-white" />
        </button>
      )}

      {/* Feedback modal */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => { setOpen(false); setSent(false); }}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-md mx-4 mb-4 bg-white rounded-[20px] overflow-hidden"
            style={{ boxShadow: '0 4px 24px rgba(34,34,34,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-[20px] pt-[18px] pb-[10px]">
              <h3 className="text-[16px] font-bold text-[var(--near-black)]">Send feedback</h3>
              <button
                onClick={() => { setOpen(false); setSent(false); }}
                className="w-[32px] h-[32px] flex items-center justify-center rounded-full hover:bg-[var(--bg)] transition-colors"
              >
                <X className="w-[16px] h-[16px] text-[var(--soft)]" />
              </button>
            </div>

            {sent ? (
              <div className="px-[20px] pb-[20px] text-center py-[24px]">
                <p className="text-[15px] font-semibold text-[var(--forest)]">Thanks for your feedback!</p>
                <p className="text-[13px] text-[var(--mid)] mt-[4px]">We'll take a look.</p>
              </div>
            ) : (
              <div className="px-[20px] pb-[20px]">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 500))}
                  placeholder="What's on your mind? Bug reports, ideas, anything..."
                  rows={4}
                  maxLength={500}
                  autoFocus
                  className="w-full px-[14px] py-[12px] rounded-[12px] bg-[var(--bg)] text-[14px] text-[var(--near-black)] placeholder:text-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] resize-none"
                />
                <div className="flex items-center justify-between mt-[12px]">
                  <span className="text-[11px] text-[var(--soft)]">{text.length}/500</span>
                  <button
                    onClick={handleSubmit}
                    disabled={!text.trim() || sending}
                    className="px-[20px] py-[10px] rounded-[50px] text-[13px] font-bold text-white transition-all disabled:opacity-40"
                    style={{ background: 'var(--terra)' }}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
