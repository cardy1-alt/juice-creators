// Instagram reels are shown as tap-to-open link cards rather than
// embedded iframes. Instagram's anonymous /embed endpoint has become
// unreliable — it often shows login walls or fails to load — so we
// keep this simple: render a branded card that opens the reel in a
// new tab. No iframe, no Instagram SDK, no auth.

import { ExternalLink, Film } from 'lucide-react';

const URL_PATTERN = /^https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(reel|p)\/([^/?#]+)/i;

interface Props {
  url: string;
  /** @deprecated retained for API compatibility — ignored. */
  height?: number;
  className?: string;
}

export default function InstagramEmbed({ url, className }: Props) {
  const match = url.match(URL_PATTERN);
  const kind = match?.[1] === 'p' ? 'Post' : 'Reel';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 px-4 py-3 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white hover:bg-[rgba(196,103,74,0.04)] hover:border-[var(--terra)] transition-colors ${className || ''}`}
    >
      <div className="w-10 h-10 rounded-full bg-[var(--terra-light)] flex items-center justify-center flex-shrink-0">
        <Film size={16} className="text-[var(--terra)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--ink)]">Watch on Instagram</p>
        <p className="text-[12px] text-[var(--ink-50)] truncate">{match ? `${kind} · ${url.replace(/^https?:\/\/(www\.)?/, '')}` : url}</p>
      </div>
      <ExternalLink size={14} className="text-[var(--ink-50)] flex-shrink-0" />
    </a>
  );
}
