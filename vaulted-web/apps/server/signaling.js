import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';
const socketsByUser = new Map();

export function startSignaling(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/ws')) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const userId = params.get('token'); // (demo) use token as user id
    socketsByUser.set(userId, ws);
    ws.on('message', (msg) => {
      try {
        const { type, payload } = JSON.parse(msg);
        if (type === 'signal-offer' || type === 'signal-answer' || type === 'signal-ice') {
          const { recipientId, ...rest } = payload;
          const recipientSocket = socketsByUser.get(recipientId);
          if (recipientSocket && recipientSocket.readyState === ws.OPEN) {
            recipientSocket.send(JSON.stringify({ type, payload: { ...rest, senderId: userId } }));
          } else {
            // Handle case where recipient is not online or not found
            console.log(`Recipient ${recipientId} not found or offline for signal type ${type}`);
          }
        }
      } catch {}
    });
    ws.on('close', () => socketsByUser.delete(userId));
  });

  // minimal in-memory chat membership for signaling
  const chatMembers = new Map(); // chatId -> [userIds]
  return {
    registerChat(chatId, members) { chatMembers.set(chatId, members); },
    announce(userId, data) { socketsByUser.get(userId)?.send(JSON.stringify(data)); }
  };
}
