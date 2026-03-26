import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
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
          className="fixed bottom-[90px] right-[16px] z-[100] w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all active:scale-95"
          style={{ background: 'var(--terra)', boxShadow: 'var(--shadow-lg)' }}
          aria-label="Send feedback"
        >
          <MessageCircle size={18} strokeWidth={1.5} className="text-white" />
        </button>
      )}

      {/* Feedback bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={() => { setOpen(false); setSent(false); }}>
          <div className="absolute inset-0" style={{ background: 'rgba(34,34,34,0.5)' }} />
          <div
            className="relative w-full max-w-md mx-4 mb-4 overflow-hidden"
            style={{ background: 'var(--shell)', borderRadius: '24px 24px 0 0', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-[20px] pt-[18px] pb-[10px]">
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '18px', color: 'var(--ink)' }}>Send feedback</h3>
              <button
                onClick={() => { setOpen(false); setSent(false); }}
                className="w-[32px] h-[32px] flex items-center justify-center rounded-full transition-colors"
                style={{ background: 'var(--card)' }}
              >
                <X size={16} strokeWidth={1.5} className="text-[var(--ink-35)]" />
              </button>
            </div>

            {sent ? (
              <div className="px-[20px] pb-[20px] text-center py-[24px]">
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '17px', color: 'var(--terra)' }}>Thanks for your feedback!</p>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: '15px', color: 'var(--ink-60)', marginTop: '4px' }}>We'll take a look.</p>
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
                  className="w-full resize-none focus:outline-none"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
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
                />
                <div className="flex items-center justify-between mt-[12px]">
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: '13px', color: 'var(--ink-35)' }}>{text.length}/500</span>
                  <button
                    onClick={handleSubmit}
                    disabled={!text.trim() || sending}
                    className="transition-all disabled:opacity-40"
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 700,
                      fontSize: '15px',
                      color: 'white',
                      background: 'var(--terra)',
                      borderRadius: '999px',
                      padding: '13px 24px',
                    }}
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
