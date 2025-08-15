// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import cookieParser from 'cookie-parser';

import db, { migrate } from './src/db.js';
import { startSignaling } from './signaling.js';
import auth from './src/routes/auth.js';
import chats from './src/routes/chats.js';
import messages from './src/routes/messages.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8787;

app.use(express.json());
app.use(cors());
app.use(cookieParser());

app.get('/api/me', (req,res)=> res.json({ userId: req.cookies.token || null }));
app.use('/api/auth', auth);
app.use('/api/chats', chats);
app.use('/api/messages', messages);

migrate();
startSignaling(server);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('WebSocket server is ready.');
});
