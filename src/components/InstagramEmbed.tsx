// Renders an Instagram reel/post inline using the platform's anonymous
// embed URL pattern (https://www.instagram.com/{kind}/{id}/embed). No auth,
// no API, no token. If the URL can't be parsed as an Instagram reel/post,
// falls back to a plain "View on Instagram" link so the panel never crashes
// on legacy or malformed data.

const URL_PATTERN = /^https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(reel|p)\/([^/?#]+)/i;

interface Props {
  url: string;
  height?: number;
  className?: string;
}

export default function InstagramEmbed({ url, height = 480, className }: Props) {
  const match = url.match(URL_PATTERN);

  if (!match) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 text-[13px] text-[var(--terra)] font-medium hover:underline ${className || ''}`}
      >
        View on Instagram →
      </a>
    );
  }

  const [, kind, id] = match;
  const embedSrc = `https://www.instagram.com/${kind}/${id}/embed`;

  return (
    <div className={`rounded-[10px] overflow-hidden border border-[rgba(42,32,24,0.08)] bg-white ${className || ''}`}>
      <iframe
        src={embedSrc}
        width="100%"
        height={height}
        loading="lazy"
        frameBorder={0}
        scrolling="no"
        allowTransparency
        allow="encrypted-media"
        title="Instagram embed"
        style={{ display: 'block' }}
      />
    </div>
  );
}
