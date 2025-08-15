import { Router } from 'express';
import db from '../db.js';
import { nanoid } from 'nanoid';

const r = Router();

r.get('/', (req,res)=>{
  const userId = req.cookies.token;
  const rows = db.prepare(`
    SELECT c.id, MAX(m.created_at) as last_ts
    FROM chats c
    JOIN memberships ms ON ms.chat_id=c.id
    LEFT JOIN messages m ON m.chat_id=c.id
    WHERE ms.user_id=? GROUP BY c.id ORDER BY last_ts DESC NULLS LAST
  `).all(userId);
  const chatsWithLastMessage = rows.map(chat => {
    const lastMessage = db.prepare('SELECT ciphertext, created_at FROM messages WHERE chat_id=? ORDER BY created_at DESC LIMIT 1').get(chat.id);
    return { 
      id: chat.id, 
      last_ts: chat.last_ts,
      lastMessage: lastMessage ? lastMessage.ciphertext : '',
      lastMessageTimestamp: lastMessage ? lastMessage.created_at : null,
    };
  });
  res.json(chatsWithLastMessage);
});

r.post('/create', (req,res)=>{
  const userId = req.cookies.token;
  const { peerId } = req.body;
  const id = nanoid();
  db.prepare('INSERT INTO chats (id,created_at) VALUES (?,?)').run(id, Date.now());
  db.prepare('INSERT INTO memberships (chat_id,user_id) VALUES (?,?)').run(id, userId);
  db.prepare('INSERT INTO memberships (chat_id,user_id) VALUES (?,?)').run(id, peerId);
  res.json({ id });
});

r.get('/:chatId/members', (req, res) => {
  const { chatId } = req.params;
  const members = db.prepare('SELECT user_id FROM memberships WHERE chat_id=?').all(chatId);
  res.json(members);
});

export default r;
