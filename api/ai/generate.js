// Retry with exponential backoff on transient Anthropic errors.
// Anthropic returns 529 / overloaded_error during peak hours; a short retry
// loop usually clears it before the user notices.
async function callAnthropicWithRetry({ apiKey, prompt, max_tokens }) {
  const delays = [0, 1000, 2500]; // three attempts total
  let lastStatus = 0;
  let lastErrText = '';
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
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
    if (response.ok) return { ok: true, response };
    lastStatus = response.status;
    lastErrText = await response.text();
    // Only retry on overloaded (529) or 5xx. 4xx (auth, bad request) won't
    // improve with a retry — fail fast.
    const isTransient = response.status === 529 || (response.status >= 500 && response.status < 600)
      || lastErrText.includes('overloaded_error');
    if (!isTransient) break;
    console.warn(`[ai/generate] Transient error ${response.status} on attempt ${attempt + 1}/${delays.length}, retrying…`);
  }
  return { ok: false, status: lastStatus, errText: lastErrText };
}

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

    const result = await callAnthropicWithRetry({ apiKey, prompt, max_tokens });

    if (!result.ok) {
      console.error('[ai/generate] Anthropic API error after retries:', result.status, result.errText);
      const isOverloaded = result.status === 529 || result.errText.includes('overloaded_error');
      // Give the client a user-friendly message for the most common case.
      const error = isOverloaded
        ? 'AI is temporarily overloaded — please retry in a moment'
        : `AI service error (${result.status})`;
      return res.status(502).json({
        error,
        detail: result.errText.slice(0, 300),
        retryable: isOverloaded,
      });
    }

    const data = await result.response.json();
    const text = data.content?.[0]?.text || '';
    const stopReason = data.stop_reason || null;

    if (!text) {
      console.error('[ai/generate] Empty response from Anthropic:', JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: 'AI returned an empty response', stopReason });
    }

    return res.status(200).json({ text, stopReason, truncated: stopReason === 'max_tokens' });
  } catch (err) {
    console.error('[ai/generate] Error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: String(err).slice(0, 200) });
  }
}
