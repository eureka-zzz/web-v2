const express = require('express');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const session = require('express-session');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const DB_PATH = path.join(__dirname, '..', 'db.sqlite');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Use timestamp + original name to avoid collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Initialize better-sqlite3 database
const adapter = new FileSync('db.json');
const db = low(adapter);

db.defaults({ users: [], pesan: [], grup: [] }).write();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'local-lan-messaging-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

function getUserByIP(ip) {
  return db.get('users').find({ ip_address: ip }).value();
}

// Middleware to check authentication and redirect accordingly
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (req.session && req.session.user) {
    // User session exists
    next();
  } else {
    const user = getUserByIP(ip);
    if (!user) {
      // IP not registered, redirect to register page
      if (req.path === '/register' || req.path === '/register.html' || req.path.startsWith('/register')) {
        next();
      } else {
        res.redirect('/register.html');
      }
    } else {
      // IP registered, redirect to login page
      if (req.path === '/login' || req.path === '/login.html' || req.path.startsWith('/login')) {
        next();
      } else {
        res.redirect('/login.html');
      }
    }
  }
});

app.post('/register', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const existingUser = db.get('users').find(user => user.ip_address === ip || user.username === username).value();
  if (existingUser) {
    return res.status(400).json({ error: 'IP or username already registered' });
  }
  const newId = db.get('users').size().value() + 1;
  const role = (username === 'zete' && password === 'zetedec') ? 'admin' : 'user';
  const newUser = {
    id: newId,
    username,
    password,
    ip_address: ip,
    role,
    created_at: new Date().toISOString(),
    last_seen: null
  };
  db.get('users').push(newUser).write();
  req.session.user = { id: newUser.id, username, role };
  res.json({ success: true, message: 'Registration successful' });
});

app.post('/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = db.get('users').find({ username, password }).value();
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.ip_address !== ip) {
    return res.status(403).json({ error: 'IP address mismatch' });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ success: true, message: 'Login successful' });
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out' });
});

// Middleware to protect routes after login
function authRequired(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// Get current user info
app.get('/me', authRequired, (req, res) => {
  res.json({ user: req.session.user });
});

app.post('/message', authRequired, (req, res) => {
  const userId = req.session.user.id;
  const { content, group_id, reply_to, mentions } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Message content required' });
  }
  const createdAt = new Date().toISOString();
  const newMessageId = db.get('pesan').size().value() + 1;
  const newMessage = {
    id: newMessageId,
    user_id: userId,
    group_id: group_id || null,
    content,
    created_at: createdAt,
    updated_at: null,
    edited: 0,
    pinned: 0,
    reply_to: reply_to || null,
    mentions: mentions || null
  };
  db.get('pesan').push(newMessage).write();
  io.emit('new_message', newMessage);
  res.json({ success: true, messageId: newMessageId });
});

app.put('/message/:id', authRequired, (req, res) => {
  const userId = req.session.user.id;
  const messageId = Number(req.params.id);
  const { content } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Message content required' });
  }
  let message = db.get('pesan').find({ id: messageId }).value();
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (message.user_id !== userId && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to edit this message' });
  }
  const updatedAt = new Date().toISOString();
  message.content = content;
  message.updated_at = updatedAt;
  message.edited = 1;
  db.get('pesan').find({ id: messageId }).assign(message).write();
  io.emit('edit_message', { id: messageId, content, updated_at: updatedAt, edited: 1 });
  res.json({ success: true });
});

app.delete('/message/:id', authRequired, (req, res) => {
  const userId = req.session.user.id;
  const messageId = Number(req.params.id);
  let message = db.get('pesan').find({ id: messageId }).value();
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (message.user_id !== userId && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to delete this message' });
  }
  db.get('pesan').remove({ id: messageId }).write();
  io.emit('delete_message', { id: messageId });
  res.json({ success: true });
});

// Upload file
app.post('/upload', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, fileUrl });
});

// Serve frontend files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});
