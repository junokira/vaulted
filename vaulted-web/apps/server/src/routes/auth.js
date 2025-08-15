import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';

const r = Router();

r.post('/magic', (req, res) => {
  const { email } = req.body;
  const token = nanoid();
  db.prepare('INSERT INTO magic_links (token,email,created_at) VALUES (?,?,?)')
    .run(token, email, Date.now());
  // Simulated email: print URL to server console
  console.log(`Magic link for ${email}: http://localhost:${process.env.PORT}/api/auth/complete?token=${token}`);
  res.json({ ok: true });
});

r.get('/complete', (req, res) => {
  const { token } = req.query;
  const row = db.prepare('SELECT email FROM magic_links WHERE token=?').get(token);
  if (!row) return res.status(400).json({ error: 'Invalid token' });
  const userId = row.email; // demo: id = email
  const { publicKey } = req.body; // Expect publicKey from the frontend
  res.cookie('token', userId, { httpOnly: false, sameSite: 'lax' });
  db.prepare('INSERT OR IGNORE INTO users (id,email,publicKey) VALUES (?,?,?)').run(userId, row.email, publicKey);
  res.json({ userId });
});

export default r;
