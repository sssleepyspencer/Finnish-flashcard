import { neon } from '@neondatabase/serverless';

const cors = {
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
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS words (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    fi TEXT NOT NULL,
    en TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, fi)
  )`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sql = neon(process.env.DATABASE_URL);
  await initDB(sql);

  const { action, username, password } = req.body;

  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3–20 characters' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

  const passwordHash = await hashPassword(password);

  if (action === 'register') {
    try {
      const result = await sql`
        INSERT INTO users (username, password_hash)
        VALUES (${username.toLowerCase()}, ${passwordHash})
        RETURNING id, username
      `;
      return res.status(200).json({ ok: true, user: result[0] });
    } catch (err) {
      if (err.message.includes('unique') || err.message.includes('duplicate')) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      throw err;
    }
  }

  if (action === 'login') {
    const users = await sql`
      SELECT id, username FROM users
      WHERE username = ${username.toLowerCase()} AND password_hash = ${passwordHash}
    `;
    if (!users.length) return res.status(401).json({ error: 'Wrong username or password' });
    return res.status(200).json({ ok: true, user: users[0] });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
