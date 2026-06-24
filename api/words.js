import { neon } from '@neondatabase/serverless';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { action, userId, words: wordList, fi, en } = await req.json();

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Load all words for user
  if (action === 'load') {
    const rows = await sql`
      SELECT fi, en FROM words
      WHERE user_id = ${userId}
      ORDER BY created_at ASC
    `;
    return new Response(JSON.stringify({ ok: true, words: rows }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Save entire word list (sync)
  if (action === 'save') {
    await sql`DELETE FROM words WHERE user_id = ${userId}`;
    if (wordList && wordList.length) {
      for (const w of wordList) {
        await sql`
          INSERT INTO words (user_id, fi, en)
          VALUES (${userId}, ${w.fi}, ${w.en})
          ON CONFLICT (user_id, fi) DO UPDATE SET en = ${w.en}
        `;
      }
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Add single word
  if (action === 'add') {
    await sql`
      INSERT INTO words (user_id, fi, en)
      VALUES (${userId}, ${fi}, ${en})
      ON CONFLICT (user_id, fi) DO UPDATE SET en = ${en}
    `;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Delete single word
  if (action === 'delete') {
    await sql`DELETE FROM words WHERE user_id = ${userId} AND fi = ${fi}`;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
