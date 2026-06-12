import { neon } from '@neondatabase/serverless';

export const config = { runtime: 'edge' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

async function getDb() {
  const sql = neon(process.env.DATABASE_URL);
  // Create table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS words (
      id        SERIAL PRIMARY KEY,
      fi        TEXT NOT NULL,
      en        TEXT NOT NULL DEFAULT '',
      notes     TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  return sql;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const sql = await getDb();

    // GET /api/words — fetch all words
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM words ORDER BY created_at DESC`;
      return json(rows);
    }

    // POST /api/words — add a word { fi, en, notes }
    if (req.method === 'POST') {
      const { fi, en = '', notes = '' } = await req.json();
      if (!fi) return json({ error: 'fi is required' }, 400);
      const [row] = await sql`
        INSERT INTO words (fi, en, notes) VALUES (${fi}, ${en}, ${notes})
        RETURNING *
      `;
      return json(row, 201);
    }

    // DELETE /api/words?id=123 — remove a word
    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'id is required' }, 400);
      await sql`DELETE FROM words WHERE id = ${id}`;
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
