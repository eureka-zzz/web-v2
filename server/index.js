const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
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

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    ip_address TEXT UNIQUE,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS grup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    admin_id INTEGER,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admin_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pesan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    group_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    edited INTEGER DEFAULT 0,
    pinned INTEGER DEFAULT 0,
    reply_to INTEGER,
    mentions TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(group_id) REFERENCES grup(id),
    FOREIGN KEY(reply_to) REFERENCES pesan(id)
  )`);
});

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

// Helper function to get user by IP
function getUserByIP(ip, callback) {
  db.get('SELECT * FROM users WHERE ip_address = ?', [ip], (err, row) => {
    if (err) {
      callback(err);
    } else {
      callback(null, row);
    }
  });
}

// Middleware to check authentication and redirect accordingly
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (req.session && req.session.user) {
    // User session exists
    next();
  } else {
    getUserByIP(ip, (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal server error');
      }
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
    });
  }
});

// Registration route
app.post('/register', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  // Check if IP or username already registered
  db.get('SELECT * FROM users WHERE ip_address = ? OR username = ?', [ip, username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      return res.status(400).json({ error: 'IP or username already registered' });
    }
    // Insert new user
    const role = (username === 'zete' && password === 'zetedec') ? 'admin' : 'user';
    db.run('INSERT INTO users (username, password, ip_address, role) VALUES (?, ?, ?, ?)', [username, password, ip, role], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to register user' });
      }
      req.session.user = { id: this.lastID, username, role };
      res.json({ success: true, message: 'Registration successful' });
    });
  });
});

// Login route
app.post('/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.ip_address !== ip) {
      return res.status(403).json({ error: 'IP address mismatch' });
    }
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.json({ success: true, message: 'Login successful' });
  });
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

// Send message
app.post('/message', authRequired, (req, res) => {
  const userId = req.session.user.id;
  const { content, group_id, reply_to, mentions } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Message content required' });
  }
  const createdAt = new Date().toISOString();
  db.run(
    `INSERT INTO pesan (user_id, group_id, content, created_at, reply_to, mentions) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, group_id || null, content, createdAt, reply_to || null, mentions || null],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to send message' });
      }
      const messageId = this.lastID;
      // Emit message to all connected clients
      io.emit('new_message', {
        id: messageId,
        user_id: userId,
        group_id: group_id || null,
        content,
        created_at: createdAt,
        reply_to: reply_to || null,
        mentions: mentions || null,
        edited: 0,
        pinned: 0
      });
      res.json({ success: true, messageId });
    }
  );
});

// Edit message
app.put('/message/:id', authRequired, (req, res) => {
  const userId = req.session.user.id;
  const messageId = req.params.id;
  const { content } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Message content required' });
  }
  const updatedAt = new Date().toISOString();
  // Check ownership or admin
  db.get('SELECT * FROM pesan WHERE id = ?', [messageId], (err, message) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.user_id !== userId && req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to edit this message' });
    }
    db.run(
      'UPDATE pesan SET content = ?, updated_at = ?, edited = 1 WHERE id = ?',
      [content, updatedAt, messageId],
      (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update message' });
        io.emit('edit_message', { id: messageId, content, updated_at: updatedAt, edited: 1 });
        res.json({ success: true });
      }
    );
  });
});

// Delete message
app.delete('/message/:id', authRequired, (req, res) => {
  const userId = req.session.user.id;
  const messageId = req.params.id;
  db.get('SELECT * FROM pesan WHERE id = ?', [messageId], (err, message) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.user_id !== userId && req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    db.run('DELETE FROM pesan WHERE id = ?', [messageId], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to delete message' });
      io.emit('delete_message', { id: messageId });
      res.json({ success: true });
    });
  });
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
