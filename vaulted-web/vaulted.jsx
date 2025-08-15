import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Search,
  Plus,
  ArrowLeft,
  Phone,
  Video,
  Info,
  Paperclip,
  Mic,
  Smile,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCheck,
  MoreHorizontal,
  Send,
  X,
  Volume2,
  Minimize,
  Maximize,
  Camera,
  RotateCcw,
  User,
  Power,
  Lock,
  File,
  Image,
  MapPin,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// =================================================================================
// CUSTOM HOOKS AND UTILITIES
// These are defined here to make the application a single, self-contained file.
// In a real project, they would be in their own files (e.g., hooks/useSocket.js).
// =================================================================================

// useSocket.js
const useSocket = (userId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    const ws = new WebSocket(`ws://localhost:8787/ws?token=${userId}`);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected.');
    };

    ws.onmessage = (event) => {
      setLastMessage(JSON.parse(event.data));
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected.');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [userId]);

  const sendMessage = (message) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  return { isConnected, sendMessage, lastMessage };
};

// useWebRTC.js
const useWebRTC = (userId, sendMessage) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  // WebRTC configuration with STUN server
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };

  const startCall = async (peerId, callType) => {
    try {
      // Get the local media stream
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      // Create a new RTCPeerConnection
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      // Add the local stream to the peer connection
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

      // Set up event listeners
      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendMessage({ type: 'signal-ice', payload: { recipientId: peerId, candidate: event.candidate } });
        }
      };

      // Create and send the offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendMessage({ type: 'signal-offer', payload: { recipientId: peerId, offer: pc.localDescription } });

    } catch (error) {
      console.error('Failed to start call:', error);
    }
  };

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => (track.enabled = !track.enabled));
    }
  };

  return { localVideoRef, remoteVideoRef, startCall, endCall, peerConnection: peerConnectionRef.current, toggleMute, toggleCamera };
};

// lib/crypto.js
let keyPair = null;

const initCrypto = async () => {
  if (!('indexedDB' in window)) {
    console.warn('IndexedDB not supported. Cannot persist keys.');
  }
};

const getOrGenerateKeyPair = async (userId) => {
  if (keyPair) return keyPair;
  // This is a simplified function. A real app would persist keys in IndexedDB.
  const pair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  keyPair = pair;
  return keyPair;
};

const encryptMessage = async (plaintext, publicKey) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Placeholder for real encryption logic
  const encryptedData = `[Encrypted] IV:${btoa(String.fromCharCode(...iv))} Data:${btoa(String.fromCharCode(...data))}`;
  return encryptedData;
};

const decryptMessage = async (ciphertext, privateKey) => {
  // Placeholder for real decryption logic
  const [iv, data] = ciphertext.split('Data:');
  const ivBytes = Uint8Array.from(atob(iv.split(':')[1]), c => c.charCodeAt(0));
  const decryptedData = atob(data);
  const decoder = new TextDecoder();
  return decoder.decode(Uint8Array.from(decryptedData, c => c.charCodeAt(0)));
};

// lib/db.js
let db = null;

const initDB = async () => {
  return new Promise((resolve, reject) => {
    if (db) return resolve();
    const request = indexedDB.open('VaultedDB', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('messages', { keyPath: 'id' });
      db.createObjectStore('outgoingQueue', { keyPath: 'id' });
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('IndexedDB initialized.');
      resolve();
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
};

const getMessages = async (chatId) => {
  return new Promise((resolve) => {
    const transaction = db.transaction('messages', 'readonly');
    const store = transaction.objectStore('messages');
    const allMessages = [];
    store.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        allMessages.push(cursor.value);
        cursor.continue();
      } else {
        resolve(allMessages);
      }
    };
  });
};

const addMessageToDB = (chatId, message) => {
  if (!db) {
    console.error('DB not initialized');
    return;
  }
  const transaction = db.transaction('messages', 'readwrite');
  const store = transaction.objectStore('messages');
  store.add(message);
};

const addOutgoingMessage = (message) => {
  if (!db) return;
  const transaction = db.transaction('outgoingQueue', 'readwrite');
  const store = transaction.objectStore('outgoingQueue');
  store.add(message);
};

const getOutgoingMessages = async () => {
  return new Promise((resolve) => {
    if (!db) {
      resolve([]);
      return;
    }
    const transaction = db.transaction('outgoingQueue', 'readonly');
    const store = transaction.objectStore('outgoingQueue');
    const messages = [];
    store.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        messages.push(cursor.value);
        cursor.continue();
      } else {
        resolve(messages);
      }
    };
  });
};


// =================================================================================
// MAIN REACT APPLICATION
// =================================================================================

// This is the main Vaulted application component.
// It manages the state for the different UI views and renders
// the appropriate components.
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isCalling, setIsCalling] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [callType, setCallType] = useState('video'); // 'video' or 'audio'
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [userId, setUserId] = useState(null);
  const [peers, setPeers] = useState({}); // Stores public keys of other users
  const [chats, setChats] = useState([]);

  // Use the custom socket and WebRTC hooks
  const { isConnected, sendMessage: wsSendMessage, lastMessage } = useSocket(userId);
  const { localVideoRef, remoteVideoRef, startCall, endCall, peerConnection, toggleMute, toggleCamera } = useWebRTC(userId, wsSendMessage);

  // Initialize crypto and IndexedDB on app load
  useEffect(() => {
    async function initialize() {
      await initCrypto();
      await initDB();
      // Check for magic link token in the URL
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        // A real app would validate this token with the backend
        const [id, secret] = token.split(':');
        setUserId(id);
        setIsLoggedIn(true);
        // Fetch and store the logged-in user's own public key
        // This is necessary for decrypting messages sent to this user
        fetch(`http://localhost:8787/api/users/${id}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.publicKey) {
              setPeers(prev => ({ ...prev, [id]: { publicKey: data.publicKey } }));
            }
          })
          .catch(e => console.error("Error fetching own public key:", e));
        // Clean up the URL
        window.history.pushState({}, document.title, window.location.pathname);
      }
    }
    initialize();
  }, []);

  // Fetch chats from the backend when userId is available
  useEffect(() => {
    const fetchChats = async () => {
      if (userId) {
        try {
          const res = await fetch(`http://localhost:8787/api/chats`, {
          });
          if (res.ok) {
            const data = await res.json();
            // For each chat, fetch the other participant's details to set the chat name
            const chatsWithDetails = await Promise.all(data.map(async (chat) => {
              // Find the other participant in the chat
              const membersRes = await fetch(`http://localhost:8787/api/chats/${chat.id}/members`);
              const membersData = await membersRes.json();
              const otherMember = membersData.find(member => member.user_id !== userId);
              let chatName = 'Unknown Chat';
              let avatar = '?';
              if (otherMember) {
                const userRes = await fetch(`http://localhost:8787/api/users/${otherMember.user_id}`);
                const userData = await userRes.json();
                chatName = userData.email || 'Unknown User'; // Use email as name for now
                avatar = chatName[0].toUpperCase();
              }
              return { 
                ...chat, 
                name: chatName, 
                avatar,
                lastMessage: chat.lastMessage, 
                timestamp: chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                unread: 0, 
                status: 'Offline' 
              };
            }));
            setChats(chatsWithDetails);
          } else {
            console.error('Failed to fetch chats:', res.status);
          }
        } catch (e) {
          console.error('Error fetching chats:', e);
        }
      }
    };
    fetchChats();
  }, [userId]);

  // Handle new messages from the WebSocket connection
  useEffect(() => {
    if (lastMessage) {
      const { type, payload } = lastMessage;
      if (type === 'message') {
        const { senderId, receiverId, ciphertext } = payload;
        // The message is for us, so decrypt it and save to IndexedDB
        // This is a simplified approach; a real app would use the sender's public key
        // which would need to be fetched from the backend or a trusted source.
        // For the prototype, we assume we have the key.
        const key = peers[senderId]?.publicKey;
        // In a real-world scenario, you'd handle decryption here.
        // const plaintext = decryptMessage(ciphertext, key);
        const plaintext = `[Encrypted] ${ciphertext}`; // Placeholder for decryption

        const receivedMessage = {
          id: Date.now(),
          sender: senderId,
          text: plaintext,
          timestamp: 'Just now',
          read: true
        };
        addMessageToDB(activeChat.id, receivedMessage);
        if (activeChat && activeChat.id === senderId) {
          setMessages(prev => [...prev, receivedMessage]);
        }
      } else if (type === 'webrtc-offer') {
        // Handle incoming WebRTC offer
        const { offer, senderId } = payload;
        const pc = peerConnectionRef.current;
        if (pc) {
          pc.setRemoteDescription(new RTCSessionDescription(offer))
            .then(() => pc.createAnswer())
            .then(answer => pc.setLocalDescription(answer))
            .then(() => wsSendMessage({ type: 'signal-answer', payload: { recipientId: senderId, answer: pc.localDescription } }))
            .catch(e => console.error("Error handling offer:", e));
        }
      } else if (type === 'webrtc-answer') {
        // Handle incoming WebRTC answer
        const { answer } = payload;
        const pc = peerConnectionRef.current;
        if (pc) {
          pc.setRemoteDescription(new RTCSessionDescription(answer))
            .catch(e => console.error("Error handling answer:", e));
        }
      } else if (type === 'webrtc-candidate') {
        // Handle incoming ICE candidate
        const { candidate } = payload;
        const pc = peerConnectionRef.current;
        if (pc) {
          pc.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(e => console.error("Error handling ICE candidate:", e));
        }
      }
    }
  }, [lastMessage, activeChat, peers, peerConnectionRef.current, wsSendMessage]);

  // Fetch messages from IndexedDB for the active chat
  useEffect(() => {
    if (activeChat) {
      const fetchMessages = async () => {
        const chatMessages = await getMessages(activeChat.id);
        setMessages(chatMessages);
      };
      fetchMessages();
    }
  }, [activeChat]);

  // Simulates fetching a user's public key from the server
  const fetchPublicKey = async (peerId) => {
    if (peers[peerId]) return peers[peerId].publicKey;
    try {
      const res = await fetch(`http://localhost:8787/api/users/${peerId}`);
      const data = await res.json();
      if (data && data.publicKey) {
        setPeers(prev => ({ ...prev, [peerId]: { publicKey: data.publicKey } }));
        return data.publicKey;
      }
    } catch (e) {
      console.error('Error fetching public key:', e);
    }
    return null;
  };

  const handleSendMessage = async (text) => {
    if (text.trim() === '') return;
    const recipientId = activeChat.id;
    const recipientPublicKey = await fetchPublicKey(recipientId);

    if (!recipientPublicKey) {
      console.error('Recipient public key not found. Cannot encrypt message.');
      return;
    }

    // Encrypt the message before sending
    const encryptedText = await encryptMessage(text, recipientPublicKey);

    // Add to local DB and outgoing queue
    const localMessage = {
      id: Date.now(),
      sender: userId, // Use the real user ID
      text: text, // Plaintext for local display
      timestamp: 'Just now',
      read: false
    };
    addMessageToDB(activeChat.id, localMessage);
    setMessages(prev => [...prev, localMessage]);

    // Send to backend via WebSocket
    wsSendMessage({
      type: 'message',
      payload: {
        chatId: activeChat.id,
        senderId: userId,
        receiverId: recipientId,
        ciphertext: encryptedText,
      }
    });
  };

  const handleStartCall = (type) => {
    setCallType(type);
    setIsCalling(true);
    startCall(activeChat.id, type);
  };

  const handleEndCall = () => {
    setIsCalling(false);
    endCall();
  };

  const handleGoBack = () => {
    setActiveChat(null);
    setShowSearch(false);
    setShowAddContact(false);
    setShowAttachmentOptions(false);
  };

  const handleShowProfile = () => {
    setShowProfile(true);
  };

  const handleCloseProfile = () => {
    setShowProfile(false);
  };

  const handleAddContact = async (name) => {
    if (name.trim() === '') return;
    const newContactId = name; // Use name as ID for simplicity in demo
    const newContact = {
      id: newContactId,
      name: name,
      lastMessage: 'New contact added!',
      timestamp: 'Now',
      unread: 0,
      avatar: name[0].toUpperCase(),
      status: 'Online',
    };
    setChats(prev => [newContact, ...prev]);
    setShowAddContact(false);

    // Simulate user registration on the backend
    try {
      const keyPair = await getOrGenerateKeyPair(newContactId);
      await fetch(`http://localhost:8787/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newContactId, publicKey: JSON.stringify(keyPair.publicKey) })
      });
      // Pre-fetch the public key for the new contact
      await fetchPublicKey(newContactId);
    } catch (e) {
      console.error("Failed to add contact or register public key:", e);
    }
  };

  // Simulates the email magic link login process.
  const handleLogin = async (email) => {
    const keyPair = await getOrGenerateKeyPair(email); // Use email as a temporary userId for key gen
    const res = await fetch(`http://localhost:8787/api/auth/magic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, publicKey: JSON.stringify(keyPair.publicKey) })
    });
    const data = await res.json();
    console.log(data.message);
  };

  const renderContent = () => {
    if (!isLoggedIn) {
      return (
        <motion.div
          key="auth-screen"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center p-8 h-[600px] text-center"
        >
          <AuthScreen onLogin={handleLogin} />
        </motion.div>
      );
    }

    if (showSearch) {
      return <SearchOverlay chats={chats} onClose={() => setShowSearch(false)} onSelectChat={setActiveChat} />;
    }

    if (showAddContact) {
      return <AddContactOverlay onAdd={handleAddContact} onClose={() => setShowAddContact(false)} />;
    }

    if (isCalling) {
      return <CallScreen 
        callType={callType} 
        onEndCall={handleEndCall} 
        isMuted={isMuted} 
        setIsMuted={setIsMuted} 
        isCameraOn={isCameraOn} 
        setIsCameraOn={setIsCameraOn} 
        localVideoRef={localVideoRef} 
        remoteVideoRef={remoteVideoRef}
        toggleMute={toggleMute}
        toggleCamera={toggleCamera}
      />;
    }

    if (showProfile && activeChat) {
        return <ProfileView chat={chats.find(c => c.id === activeChat.id)} onClose={handleCloseProfile} />;
    }

    if (!activeChat) {
      return (
        <motion.div
          key="chat-list"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col h-full"
        >
          <ChatListHeader onSearch={() => setShowSearch(true)} onAddContact={() => setShowAddContact(true)} />
          <div className="p-4 space-y-2">
            {chats.map(chat => (
              <ChatListItem key={chat.id} chat={chat} onClick={() => setActiveChat(chat)} />
            ))}
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key="chat-view"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col h-full relative"
      >
        <ChatViewHeader chat={activeChat} onBack={handleGoBack} onStartCall={handleStartCall} onShowProfile={handleShowProfile} />
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          {messages.map((msg) => (
            <Message key={msg.id} msg={msg} />
          ))}
          {isTyping && <TypingIndicator />}
        </div>
        <ChatInput onSend={handleSendMessage} isRecording={isRecording} setIsRecording={setIsRecording} onShowAttachment={() => setShowAttachmentOptions(true)} />
        {showAttachmentOptions && <AttachmentOptionsOverlay onClose={() => setShowAttachmentOptions(false)} />}
      </motion.div>
    );
  };

  return (
    <div className="bg-black text-gray-400 min-h-screen flex items-center justify-center font-sans p-4 antialiased">
      <div className="w-full max-w-lg mx-auto bg-gray-900 rounded-3xl overflow-hidden shadow-2xl ring-2 ring-gray-600">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Top header for the chat list view.
const ChatListHeader = ({ onSearch, onAddContact }) => (
  <div className="bg-black/80 backdrop-blur-sm p-4 flex items-center justify-between border-b border-gray-600">
    <div className="flex items-center space-x-2">
      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
        <span className="font-bold text-xs text-black">V</span>
      </div>
      <h1 className="text-xl font-bold">Vaulted</h1>
    </div>
    <div className="flex items-center space-x-4">
      <Search className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" onClick={onSearch} />
      <Plus className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" onClick={onAddContact} />
    </div>
  </div>
);

// Individual item in the chat list.
const ChatListItem = ({ chat, onClick }) => (
  <motion.div
    layoutId={`chat-${chat.id}`}
    onClick={onClick}
    className="flex items-center space-x-4 p-4 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors duration-200"
  >
    <div className="relative">
      <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
        <span className="font-bold text-sm text-black">{chat.avatar}</span>
      </div>
      {chat.unread > 0 && (
        <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-gray-400 text-black text-xs flex items-center justify-center ring-2 ring-black">
          {chat.unread}
        </span>
      )}
    </div>
    <div className="flex-1">
      <div className="flex justify-between items-center">
        <h2 className="text-gray-200 text-md font-semibold">{chat.name}</h2>
        <span className="text-xs text-gray-500">{chat.timestamp}</span>
      </div>
      <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
    </div>
  </motion.div>
);

// Header for the specific chat view.
const ChatViewHeader = ({ chat, onBack, onStartCall, onShowProfile }) => (
  <div className="bg-black/80 backdrop-blur-sm p-4 flex items-center justify-between border-b border-gray-600">
    <div className="flex items-center space-x-4">
      <ArrowLeft
        className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors"
        onClick={onBack}
      />
      <div className="flex items-center space-x-3 cursor-pointer" onClick={onShowProfile}>
        <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
          <span className="font-bold text-sm text-black">{chat.avatar}</span>
        </div>
        <div>
          <h2 className="text-md font-semibold">{chat.name}</h2>
          <span className="text-xs text-gray-500">online</span>
        </div>
      </div>
    </div>
    <div className="flex items-center space-x-4">
      <Phone className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" onClick={() => onStartCall('audio')} />
      <Video className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" onClick={() => onStartCall('video')} />
      <MoreHorizontal className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" />
    </div>
  </div>
);

// Individual message component.
const Message = ({ msg }) => {
  const isSentByMe = msg.sender === 'You';
  const bubbleClass = isSentByMe
    ? 'bg-gray-700/50 rounded-br-none self-end'
    : 'bg-black/50 rounded-bl-none self-start';
  const readReceipt = isSentByMe && (
    msg.read ? (
      <CheckCheck className="w-3 h-3 text-gray-500" />
    ) : (
      <Check className="w-3 h-3 text-gray-500" />
    )
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-3 rounded-2xl max-w-[75%] ${bubbleClass}`}
    >
      <p className="text-sm">{msg.text}</p>
      <div className="flex items-center justify-end text-xs mt-1 space-x-1">
        <span className="text-gray-500">{msg.timestamp}</span>
        {readReceipt}
      </div>
    </motion.div>
  );
};

// Typing indicator component.
const TypingIndicator = () => (
  <div className="flex items-center self-start space-x-1 p-3 rounded-2xl bg-black/50 w-20">
    <motion.div
      animate={{ y: [0, -2, 0] }}
      transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
      className="w-2 h-2 rounded-full bg-gray-500"
    />
    <motion.div
      animate={{ y: [0, -2, 0] }}
      transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
      className="w-2 h-2 rounded-full bg-gray-500"
    />
    <motion.div
      animate={{ y: [0, -2, 0] }}
      transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
      className="w-2 h-2 rounded-full bg-gray-500"
    />
  </div>
);

// Input area for typing messages with new features.
const ChatInput = ({ onSend, isRecording, setIsRecording, onShowAttachment }) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSend = () => {
    onSend(inputText);
    setInputText('');
  };

  const handleMicClick = () => {
    if (inputText.length === 0) {
      setIsRecording(!isRecording);
    } else {
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="bg-black/80 backdrop-blur-sm p-4 flex items-center space-x-3 border-t border-gray-600">
      <Paperclip className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" onClick={onShowAttachment} />
      <Smile className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" onClick={() => setShowEmojiPicker(!showEmojiPicker)} />

      {showEmojiPicker && <EmojiPicker onSelect={handleEmojiSelect} />}

      <input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        className="flex-1 p-2 bg-gray-800/50 rounded-xl text-sm placeholder-gray-500 text-gray-200 outline-none focus:ring-1 focus:ring-gray-400 transition-all"
        placeholder={isRecording ? 'Recording...' : 'Message...'}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSend();
          }
        }}
        disabled={isRecording}
      />
      {inputText.length > 0 ? (
        <Send className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" onClick={handleSend} />
      ) : (
        <Mic className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" onClick={handleMicClick} />
      )}
    </div>
  );
};

// Emoji picker modal component with a more extensive list.
const EmojiPicker = ({ onSelect }) => {
  const emojis = ['😊', '😂', '👍', '❤️', '🤔', '🎉', '🔥', '🚀', '🤯', '😭', '😎', '👋', '👏', '🥳', '🥰', '🤩', '💯', '🤔', '🤫', '😶', '😜', '😉', '🤤', '😴', '🤪', '😬', '😩', '😫', '🤯', '🧐', '�', '🤑', '🤫', '🤥', '🤨', '😏', '😒', '🙄', '😬', '🙃', '😮‍💨', '🥹'];
  return (
    <div className="absolute bottom-16 left-4 right-4 p-4 rounded-xl bg-gray-800/80 backdrop-blur-md shadow-lg ring-1 ring-gray-600">
      <div className="grid grid-cols-6 gap-4">
        {emojis.map(emoji => (
          <motion.div
            key={emoji}
            className="text-2xl cursor-pointer text-center"
            onClick={() => onSelect(emoji)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// New component for the authentication screen.
const AuthScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (email) {
      setIsSending(true);
      await onLogin(email);
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col items-center p-8 space-y-6">
      <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center mb-4">
        <span className="font-bold text-lg text-black">V</span>
      </div>
      <h2 className="text-xl font-bold">Welcome to Vaulted</h2>
      <p className="text-sm text-gray-500 max-w-xs">
        Enter your email to receive a secure, passwordless magic link to log in.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-3 bg-gray-800/50 rounded-xl text-sm placeholder-gray-500 text-gray-200 outline-none focus:ring-1 focus:ring-gray-400 transition-all"
        placeholder="your.email@example.com"
        disabled={isSending}
        required
      />
      <button
        type="submit"
        className="w-full p-3 rounded-xl bg-gray-600 text-black font-semibold transition-colors duration-200 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isSending}
      >
        {isSending ? 'Sending Link...' : 'Login with Magic Link'}
      </button>
      <p className="text-xs text-gray-500 pt-4">Your private keys never leave your device.</p>
    </form>
  );
};

// New component for the call screen, inspired by FaceTime.
const CallScreen = ({ callType, onEndCall, isMuted, setIsMuted, isCameraOn, setIsCameraOn, localVideoRef, remoteVideoRef, toggleMute, toggleCamera }) => {
  const isVideoCall = callType === 'video';
  const [callTime, setCallTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCallTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 bg-black flex flex-col justify-between items-center p-4"
    >
      {/* Video feeds or name avatar */}
      <div className="w-full flex-1 flex flex-col items-center justify-center relative p-2">
        {isVideoCall ? (
          <>
            <video ref={remoteVideoRef} className="w-full h-full rounded-2xl object-cover bg-gray-800/50" autoPlay playsInline />
            <video ref={localVideoRef} className="absolute bottom-4 right-4 w-28 h-40 rounded-xl object-cover bg-gray-700/50 ring-2 ring-gray-600" autoPlay playsInline muted />
          </>
        ) : (
          <div className="w-40 h-40 rounded-full bg-gray-800/50 flex items-center justify-center">
            <Phone className="w-16 h-16 text-gray-400" />
          </div>
        )}
      </div>

      {/* Call Info & Controls */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold">Alex Johnson</h2>
        <p className="text-sm text-gray-500">{formatTime(callTime)}</p>
      </div>

      <div className="flex justify-around w-full max-w-sm mb-12">
        <div className="flex flex-col items-center space-y-2">
          <motion.div
            className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-200 ${isMuted ? 'bg-gray-600/80' : 'bg-gray-800/50'}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setIsMuted(!isMuted); toggleMute(); }}
          >
            {isMuted ? (
                <Volume2 className="w-6 h-6 text-black" />
            ) : (
                <Mic className="w-6 h-6 text-gray-400" />
            )}
          </motion.div>
          <span className="text-xs text-gray-500">{isMuted ? 'Unmute' : 'Mute'}</span>
        </div>
        {isVideoCall && (
            <div className="flex flex-col items-center space-y-2">
            <motion.div
                className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-200 ${!isCameraOn ? 'bg-gray-600/80' : 'bg-gray-800/50'}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setIsCameraOn(!isCameraOn); toggleCamera(); }}
            >
                {!isCameraOn ? (
                    <Video className="w-6 h-6 text-black" />
                ) : (
                    <Camera className="w-6 h-6 text-gray-400" />
                )}
            </motion.div>
            <span className="text-xs text-gray-500">{isCameraOn ? 'Cam Off' : 'Cam On'}</span>
          </div>
        )}
        <div className="flex flex-col items-center space-y-2">
          <motion.div
            className="w-14 h-14 rounded-full bg-gray-600/80 flex items-center justify-center cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onEndCall}
          >
            <Power className="w-6 h-6 text-black" />
          </motion.div>
          <span className="text-xs text-gray-500">End Call</span>
        </div>
      </div>
    </motion.div>
  );
};

// New component for the user profile view.
const ProfileView = ({ chat, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 bg-black flex flex-col"
    >
      <div className="bg-black/80 backdrop-blur-sm p-4 flex items-center space-x-4 border-b border-gray-600">
        <ArrowLeft
          className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors"
          onClick={onClose}
        />
        <h2 className="text-md font-semibold">Contact Info</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center space-y-8">
        <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center text-3xl font-bold text-black">
          <span>{chat.avatar}</span>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-200">{chat.name}</h1>
          <p className="text-sm text-gray-500">{chat.status}</p>
        </div>

        <div className="w-full space-y-4 pt-8">
          <div className="flex items-center space-x-4 p-4 rounded-xl bg-gray-800/50">
            <Lock className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-md text-gray-200">Safety Numbers</p>
              <p className="text-xs text-gray-500">Verify this contact</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 p-4 rounded-xl bg-gray-800/50">
            <Phone className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-md text-gray-200">Call</p>
              <p className="text-xs text-gray-500">{chat.name} with audio or video</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 p-4 rounded-xl bg-gray-800/50">
            <User className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-md text-gray-200">Block Contact</p>
              <p className="text-xs text-gray-500">Prevent messages and calls</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// New component for the search overlay.
const SearchOverlay = ({ chats, onClose, onSelectChat }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 bg-gray-900 z-10 flex flex-col p-4"
    >
      <div className="flex items-center space-x-2">
        <ArrowLeft className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" onClick={onClose} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 p-2 bg-gray-800/50 rounded-xl text-sm placeholder-gray-500 text-gray-200 outline-none focus:ring-1 focus:ring-gray-400 transition-all"
          placeholder="Search Vaulted"
        />
      </div>
      <div className="mt-4 overflow-y-auto space-y-2">
        {filteredChats.map(chat => (
          <ChatListItem key={chat.id} chat={chat} onClick={() => { onSelectChat(chat); onClose(); }} />
        ))}
      </div>
    </motion.div>
  );
};

// New component for the add contact overlay.
const AddContactOverlay = ({ onAdd, onClose }) => {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 bg-gray-900 z-10 flex flex-col p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Add Contact</h2>
        <X className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" onClick={onClose} />
      </div>
      <div className="mt-4 flex flex-col space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 bg-gray-800/50 rounded-xl text-sm placeholder-gray-500 text-gray-200 outline-none focus:ring-1 focus:ring-gray-400 transition-all"
          placeholder="Enter name"
        />
        <button
          onClick={handleSubmit}
          className="w-full p-3 rounded-xl bg-gray-600 text-black font-semibold transition-colors duration-200 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </motion.div>
  );
};

// New component for the attachment options overlay.
const AttachmentOptionsOverlay = ({ onClose }) => {
  const options = [
    { name: 'Photos & Videos', icon: <Image className="w-6 h-6 text-white" />, action: () => console.log('Simulating Photos & Videos selection') },
    { name: 'Document', icon: <File className="w-6 h-6 text-white" />, action: () => console.log('Simulating Document selection') },
    { name: 'Location', icon: <MapPin className="w-6 h-6 text-white" />, action: () => console.log('Simulating Location sharing') },
    { name: 'Voice Note', icon: <Mic className="w-6 h-6 text-white" />, action: () => console.log('Simulating Voice Note recording') },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: '0%' }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ duration: 0.3 }}
      className="absolute bottom-0 left-0 right-0 bg-gray-800/80 backdrop-blur-md p-4 rounded-t-3xl shadow-lg ring-1 ring-gray-600 z-20"
    >
      <div className="flex justify-center mb-4">
        <div className="w-12 h-1 bg-gray-600 rounded-full" onClick={onClose}></div>
      </div>
      <div className="flex flex-col space-y-4">
        {options.map((option, index) => (
          <motion.div
            key={index}
            className="flex items-center space-x-4 p-4 rounded-xl bg-gray-700/50 cursor-pointer"
            whileHover={{ backgroundColor: 'rgb(55 65 81 / 0.8)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { option.action(); onClose(); }}
          >
            {option.icon}
            <span className="text-md font-semibold text-gray-200">{option.name}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};