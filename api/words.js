import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sql = neon(process.env.DATABASE_URL);
  const { action, userId, words, fi, en } = req.body;

  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  if (action === 'load') {
    const rows = await sql`
      SELECT fi, en FROM words WHERE user_id = ${userId} ORDER BY created_at ASC
    `;
    return res.status(200).json({ ok: true, words: rows });
  }

  if (action === 'save') {
    await sql`DELETE FROM words WHERE user_id = ${userId}`;
    if (words && words.length) {
      for (const w of words) {
        await sql`
          INSERT INTO words (user_id, fi, en) VALUES (${userId}, ${w.fi}, ${w.en})
          ON CONFLICT (user_id, fi) DO UPDATE SET en = ${w.en}
        `;
      }
    }
    return res.status(200).json({ ok: true });
  }

  if (action === 'add') {
    await sql`
      INSERT INTO words (user_id, fi, en) VALUES (${userId}, ${fi}, ${en})
      ON CONFLICT (user_id, fi) DO UPDATE SET en = ${en}
    `;
    return res.status(200).json({ ok: true });
  }

  if (action === 'delete') {
    await sql`DELETE FROM words WHERE user_id = ${userId} AND fi = ${fi}`;
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
