import { neon } from '@neondatabase/serverless';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'sanasto_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function initDB(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS words (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      fi TEXT NOT NULL,
      en TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, fi)
    )
  `;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const sql = neon(process.env.DATABASE_URL);
  await initDB(sql);

  const { action, username, password } = await req.json();

  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (username.length < 3 || username.length > 20) {
    return new Response(JSON.stringify({ error: 'Username must be 3–20 characters' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (password.length < 4) {
    return new Response(JSON.stringify({ error: 'Password must be at least 4 characters' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const passwordHash = await hashPassword(password);

  if (action === 'register') {
    try {
      const result = await sql`
        INSERT INTO users (username, password_hash)
        VALUES (${username.toLowerCase()}, ${passwordHash})
        RETURNING id, username
      `;
      return new Response(JSON.stringify({ ok: true, user: result[0] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      if (err.message.includes('unique')) {
        return new Response(JSON.stringify({ error: 'Username already taken' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw err;
    }
  }

  if (action === 'login') {
    const users = await sql`
      SELECT id, username FROM users
      WHERE username = ${username.toLowerCase()} AND password_hash = ${passwordHash}
    `;
    if (!users.length) {
      return new Response(JSON.stringify({ error: 'Wrong username or password' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ ok: true, user: users[0] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
