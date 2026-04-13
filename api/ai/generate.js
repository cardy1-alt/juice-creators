export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
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
        model: 'claude-sonnet-4-5',
        max_tokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ai/generate] Anthropic API error:', response.status, errText);
      // Surface a useful chunk of the upstream error so the client can display
      // it — makes it possible to debug "why did it fail" without reading logs.
      return res.status(502).json({
        error: `AI service error (${response.status})`,
        detail: errText.slice(0, 300),
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const stopReason = data.stop_reason || null;

    // An empty response usually means the model returned no text part (e.g.
    // refusal, empty tool call, or server hiccup). Surface this explicitly
    // so the client can distinguish it from a transport error.
    if (!text) {
      console.error('[ai/generate] Empty response from Anthropic:', JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: 'AI returned an empty response', stopReason });
    }

    // If we hit the token cap the JSON is almost certainly truncated and
    // unparseable. Flag that clearly so retry can bump the cap if needed.
    return res.status(200).json({ text, stopReason, truncated: stopReason === 'max_tokens' });
  } catch (err) {
    console.error('[ai/generate] Error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: String(err).slice(0, 200) });
  }
}
