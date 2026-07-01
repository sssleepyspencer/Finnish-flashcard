import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const { message, rating, userId } = body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      INSERT INTO feedback (user_id, message, rating)
      VALUES (${userId || null}, ${message.trim()}, ${rating || null})
    `;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('feedback error:', err);
    return res.status(500).json({ error: err.message });
  }
}
