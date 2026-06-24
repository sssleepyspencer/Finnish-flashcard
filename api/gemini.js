export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { contents, generationConfig } = req.body;

  // Convert Gemini-style request to Groq format
  const prompt = contents?.[0]?.parts?.[0]?.text || '';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: generationConfig?.maxOutputTokens || 600,
        temperature: generationConfig?.temperature || 0.4,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq API error');

    // Convert Groq response back to Gemini-style format so frontend code doesn't need to change
    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({
      candidates: [{ content: { parts: [{ text }] } }]
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
