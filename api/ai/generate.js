// Strip markdown code fences that Claude sometimes wraps JSON in, even when
// asked not to. Also trims leading/trailing preamble like "Here is the JSON:".
function stripCodeFences(text) {
  if (!text) return '';
  let t = text.trim();
  // ```json ... ``` or ``` ... ```
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) t = fenced[1].trim();
  // If there is a leading preamble before a JSON object/array, slice from the first { or [
  const firstBrace = Math.min(
    ...[t.indexOf('{'), t.indexOf('[')].filter(i => i !== -1),
  );
  const lastBrace = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (Number.isFinite(firstBrace) && firstBrace > 0 && lastBrace > firstBrace) {
    t = t.slice(firstBrace, lastBrace + 1);
  }
  return t;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const { prompt, max_tokens = 2000 } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // Sonnet 4.5 — stable, capable, cost-effective for campaign copy.
        // Alternatives: 'claude-sonnet-4-6' (latest) or 'claude-haiku-4-5-20251001' (cheaper).
        model: 'claude-sonnet-4-5',
        max_tokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ai/generate] Anthropic API error:', response.status, errText);
      // Surface Anthropic's error message so the client can show something useful.
      let detail = errText;
      try { detail = JSON.parse(errText)?.error?.message || errText; } catch {}
      return res.status(502).json({ error: 'AI service error', detail });
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || '';
    const text = stripCodeFences(raw);
    return res.status(200).json({ text });
  } catch (err) {
    console.error('[ai/generate] Error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}
