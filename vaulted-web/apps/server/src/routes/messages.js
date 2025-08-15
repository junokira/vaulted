import { Router } from 'express';
import db from '../db.js';
import { nanoid } from 'nanoid';

const r = Router();

r.get('/:chatId', (req,res)=>{
  const { chatId } = req.params;
  const rows = db.prepare('SELECT * FROM messages WHERE chat_id=? ORDER BY created_at ASC').all(chatId);
  res.json(rows);
});

r.post('/:chatId', (req,res)=>{
  const userId = req.cookies.token;
  const { chatId } = req.params;
  const { receiverId, ciphertext } = req.body;
  const id = nanoid();
  db.prepare('INSERT INTO messages (id, senderId, receiverId, ciphertext, timestamp, chat_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, userId, receiverId, ciphertext, Date.now(), chatId);
  res.json({ id });
});

export default r;
