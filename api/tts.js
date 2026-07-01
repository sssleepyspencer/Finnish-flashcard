export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GOOGLE_TTS_KEY;
  if (!apiKey) return res.status(500).json({ error: 'TTS key not configured' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body) {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch { return res.status(400).json({ error: 'Failed to parse body' }); }
  }

  const { text } = body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'fi-FI',
            name: 'fi-FI-Standard-A',
            ssmlGender: 'FEMALE'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.9,
            pitch: 0
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'TTS error');

    return res.status(200).json({ audioContent: data.audioContent });
  } catch (err) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: err.message });
  }
}
