import { ReactNode } from 'react';
import { Logo } from '../Logo';
import { ArrowLeft } from 'lucide-react';

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  otherPageLabel: string;
  otherPageHref: string;
  children: ReactNode;
}

export default function LegalLayout({ title, lastUpdated, otherPageLabel, otherPageHref, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--chalk)' }}>
      {/* Top nav */}
      <header className="border-b border-[rgba(42,32,24,0.08)] bg-white">
        <div className="max-w-[720px] mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo size={22} variant="wordmark" />
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-60)] hover:text-[var(--ink)] transition-colors">
            <ArrowLeft size={14} /> Back to app
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[720px] mx-auto px-6 py-10 md:py-16">
        <h1 className="text-[32px] md:text-[40px] text-[var(--ink)] mb-2" style={{ fontFamily: "'Hornbill', Georgia, serif", fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
          {title}
        </h1>
        <p className="text-[13px] text-[var(--ink-50)] mb-10">Last updated: {lastUpdated}</p>

        <div className="legal-prose">
          {children}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-[rgba(42,32,24,0.08)] flex items-center justify-between flex-wrap gap-4">
          <a href={otherPageHref} className="text-[14px] text-[var(--terra)] font-medium hover:underline">
            {otherPageLabel} →
          </a>
          <p className="text-[13px] text-[var(--ink-35)]">
            Questions? <a href="mailto:hello@nayba.app" className="text-[var(--terra)] hover:underline">hello@nayba.app</a>
          </p>
        </div>
      </main>
    </div>
  );
}
