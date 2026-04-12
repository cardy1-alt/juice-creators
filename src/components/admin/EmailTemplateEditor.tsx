import { useState, useEffect, useRef } from 'react';
import { X, Eye, Send, Check } from 'lucide-react';
import { EmailTemplate, renderPreview, renderSubject } from '../../lib/emailPreview';
import { supabase } from '../../lib/supabase';

const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-50)] font-['Instrument_Sans']";
const labelCls = "block text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-50)] mb-1.5";

interface Props {
  template: EmailTemplate;
  onClose: () => void;
}

export default function EmailTemplateEditor({ template, onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const [subject, setSubject] = useState(template.defaultSubject);
  const [testEmail, setTestEmail] = useState('');
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sendError, setSendError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleSendTest = async () => {
    const trimmed = testEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setSendError('Enter a valid email address');
      setSendStatus('error');
      return;
    }
    setSendStatus('sending');
    setSendError('');
    // Insert a notification with test_to_email override so the edge function
    // routes it to the entered address instead of doing a DB lookup.
    const meta = {
      ...template.sampleData,
      test_to_email: trimmed,
      test_to_name: template.sampleData.name || template.sampleData.display_name || 'Test User',
    };
    const { error } = await supabase.from('notifications').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      user_type: 'admin',
      message: `[TEST] ${template.name}`,
      email_type: template.key,
      email_meta: meta,
    });
    if (error) {
      setSendError(error.message);
      setSendStatus('error');
      return;
    }
    setSendStatus('sent');
    setTimeout(() => setSendStatus('idle'), 4000);
  };

  // Write preview HTML to iframe and auto-resize
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(renderPreview(template));
        doc.close();
        // Auto-resize iframe to content height
        const resize = () => {
          if (iframeRef.current && doc.body) {
            iframeRef.current.style.height = doc.body.scrollHeight + 20 + 'px';
          }
        };
        setTimeout(resize, 50);
        setTimeout(resize, 200);
      }
    }
  }, [template]);

  const groupLabel = template.group === 'creator' ? 'Creator' : template.group === 'business' ? 'Brand' : 'Admin';

  return (
    <>
      <div className="fixed inset-0 z-40 animate-overlay" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[520px] bg-white border-l border-[rgba(42,32,24,0.08)] flex flex-col animate-slide-in-right" style={{ boxShadow: '-4px 0 24px rgba(42,32,24,0.10)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-50)]">{groupLabel} Email</p>
            <h2 className="text-[18px] font-semibold text-[var(--ink)]">{template.name}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[var(--ink-50)] hover:bg-[rgba(42,32,24,0.06)] transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Subject */}
          <div className="px-5 pt-4 pb-3">
            <label className={labelCls}>Subject Line</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} />
            <p className="text-[11px] text-[var(--ink-35)] mt-1">Preview: {renderSubject(template, { subject })}</p>
          </div>

          {/* Variables */}
          <div className="px-5 pb-4">
            <label className={labelCls}>Available Variables</label>
            <div className="flex flex-wrap gap-1.5">
              {template.variables.map(v => (
                <span key={v} className="inline-flex px-2 py-0.5 rounded-[6px] bg-[rgba(42,32,24,0.04)] text-[12px] font-mono text-[var(--ink-60)]">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[rgba(42,32,24,0.08)]" />

          {/* Preview */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-1.5 mb-3">
              <Eye size={14} className="text-[var(--ink-50)]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-50)]">Preview</span>
            </div>
          </div>

          <div className="px-5 pb-5">
            <div className="rounded-[10px] overflow-hidden border border-[rgba(42,32,24,0.08)]" style={{ background: '#FAFAF9' }}>
              <iframe
                ref={iframeRef}
                title="Email preview"
                className="w-full border-0"
                style={{ minHeight: 300, pointerEvents: 'none' }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>

          {/* Sample data reference */}
          <div className="px-5 pb-5">
            <label className={labelCls}>Sample Data Used in Preview</label>
            <div className="rounded-[10px] bg-[rgba(42,32,24,0.02)] border border-[rgba(42,32,24,0.06)] p-3">
              {Object.entries(template.sampleData).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 py-1">
                  <span className="text-[12px] font-mono text-[var(--ink-50)]">{`{{${k}}}`}</span>
                  <span className="text-[12px] text-[var(--ink)]">→ {v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Send test — footer */}
        <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <label className={labelCls}>Send test email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={e => { setTestEmail(e.target.value); if (sendStatus === 'error') { setSendStatus('idle'); setSendError(''); } }}
              placeholder="your-email@example.com"
              disabled={sendStatus === 'sending'}
              className={`flex-1 ${inputCls}`}
              onKeyDown={e => { if (e.key === 'Enter') handleSendTest(); }}
            />
            <button
              onClick={handleSendTest}
              disabled={sendStatus === 'sending' || !testEmail.trim()}
              className="flex items-center justify-center gap-1.5 px-4 min-h-[40px] rounded-[10px] bg-[var(--terra)] text-white text-[14px] font-semibold hover:opacity-[0.85] disabled:opacity-40 transition-opacity flex-shrink-0"
            >
              {sendStatus === 'sending' ? (
                <>Sending...</>
              ) : sendStatus === 'sent' ? (
                <><Check size={14} /> Sent</>
              ) : (
                <><Send size={14} /> Send test</>
              )}
            </button>
          </div>
          {sendError && (
            <p className="text-[12px] text-[var(--terra)] mt-2">{sendError}</p>
          )}
          {sendStatus === 'sent' && (
            <p className="text-[12px] text-[#0F6E56] mt-2">Test email sent to {testEmail} — check your inbox in a few seconds</p>
          )}
          {sendStatus === 'idle' && !sendError && (
            <p className="text-[11px] text-[var(--ink-35)] mt-2">Uses the sample data above. Routes to your address instead of the template's default recipient.</p>
          )}
        </div>
      </div>
    </>
  );
}
