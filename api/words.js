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

  const sql = neon(process.env.DATABASE_URL);
  const { action, userId, words, fi, en, listName } = body;
  const list = listName || 'Default';

  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // Get all lists for user
    if (action === 'getLists') {
      const rows = await sql`
        SELECT DISTINCT list_name FROM words
        WHERE user_id = ${userId}
        ORDER BY list_name ASC
      `;
      const lists = rows.map(r => r.list_name);
      if (!lists.includes('Default')) lists.unshift('Default');
      return res.status(200).json({ ok: true, lists });
    }

    // Load words for a specific list
    if (action === 'load') {
      const rows = await sql`
        SELECT fi, en, list_name FROM words
        WHERE user_id = ${userId} AND list_name = ${list}
        ORDER BY created_at ASC
      `;
      return res.status(200).json({ ok: true, words: rows });
    }

    // Load ALL words across all lists
    if (action === 'loadAll') {
      const rows = await sql`
        SELECT fi, en, list_name FROM words
        WHERE user_id = ${userId}
        ORDER BY list_name ASC, created_at ASC
      `;
      return res.status(200).json({ ok: true, words: rows });
    }

    // Save entire list (replace)
    if (action === 'save') {
      await sql`DELETE FROM words WHERE user_id = ${userId} AND list_name = ${list}`;
      if (words && words.length) {
        for (const w of words) {
          await sql`
            INSERT INTO words (user_id, fi, en, list_name)
            VALUES (${userId}, ${w.fi}, ${w.en}, ${list})
            ON CONFLICT (user_id, fi) DO UPDATE SET en = ${w.en}, list_name = ${list}
          `;
        }
      }
      return res.status(200).json({ ok: true });
    }

    // Add single word to a list
    if (action === 'add') {
      await sql`
        INSERT INTO words (user_id, fi, en, list_name)
        VALUES (${userId}, ${fi}, ${en}, ${list})
        ON CONFLICT (user_id, fi) DO UPDATE SET en = ${en}, list_name = ${list}
      `;
      return res.status(200).json({ ok: true });
    }

    // Delete single word
    if (action === 'delete') {
      await sql`DELETE FROM words WHERE user_id = ${userId} AND fi = ${fi}`;
      return res.status(200).json({ ok: true });
    }

    // Rename a list
    if (action === 'renameList') {
      const { newName } = body;
      await sql`
        UPDATE words SET list_name = ${newName}
        WHERE user_id = ${userId} AND list_name = ${list}
      `;
      return res.status(200).json({ ok: true });
    }

    // Delete entire list
    if (action === 'deleteList') {
      await sql`DELETE FROM words WHERE user_id = ${userId} AND list_name = ${list}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('words.js error:', err);
    return res.status(500).json({ error: err.message });
  }
}
