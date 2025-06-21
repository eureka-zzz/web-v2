const express = require('express');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Initialize lowdb
const adapter = new FileSync('db.json');
const db = low(adapter);

// Set defaults if JSON file is empty
db.defaults({
  users: [],
  pesan: [],
  grup: []
}).write();

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
function getUserByIP(ip) {
  return db.get('users').find({ ip_address: ip }).value();
}

// Authentication middleware
function authRequired(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// Middleware to check authentication and redirect accordingly
app.use((req, res, next) => {
  // Skip auth check for static files and auth-related routes
  if (req.path.startsWith('/uploads/') || 
      req.path === '/register' || 
      req.path === '/login' ||
      req.path === '/register.html' ||
      req.path === '/login.html' ||
      req.path.endsWith('.js') ||
      req.path.endsWith('.css')) {
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress;
  if (req.session && req.session.user) {
    // Update last seen
    db.get('users')
      .find({ id: req.session.user.id })
      .assign({ last_seen: new Date().toISOString() })
      .write();
    next();
  } else {
    const user = getUserByIP(ip);
    if (!user) {
      res.redirect('/register.html');
    } else {
      res.redirect('/login.html');
    }
  }
});

// Registration route
app.post('/register', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const existingUser = db.get('users')
    .find(user => user.ip_address === ip || user.username === username)
    .value();

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
    profilePic: '', // default empty profile picture
    bio: '', // default empty bio
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString()
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

  // Admin bypass IP check
  if (username === 'zete' && password === 'zetedec') {
    const adminUser = db.get('users').find({ username: 'zete' }).value();
    if (!adminUser) {
      // Create admin user if not exists
      const newId = db.get('users').size().value() + 1;
      const newAdmin = {
        id: newId,
        username: 'zete',
        password: 'zetedec',
        ip_address: ip,
        role: 'admin',
        created_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
      };
      db.get('users').push(newAdmin).write();
      req.session.user = { id: newId, username: 'zete', role: 'admin' };
      return res.json({ success: true, message: 'Admin user created and logged in' });
    } else {
      req.session.user = { id: adminUser.id, username: 'zete', role: 'admin' };
      db.get('users').find({ id: adminUser.id }).assign({ last_seen: new Date().toISOString() }).write();
      return res.json({ success: true, message: 'Admin login successful' });
    }
  }

  const user = db.get('users')
    .find({ username, password })
    .value();

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.ip_address !== ip) {
    return res.status(403).json({ error: 'IP address mismatch' });
  }

  req.session.user = { id: user.id, username: user.username, role: user.role };
  
  // Update last seen
  db.get('users')
    .find({ id: user.id })
    .assign({ last_seen: new Date().toISOString() })
    .write();

  res.json({ success: true, message: 'Login successful' });
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out' });
});

// Get current user info
app.get('/me', authRequired, (req, res) => {
  const user = db.get('users').find({ id: req.session.user.id }).value();
  res.json({ user });
});

// Get all users (for contacts list)
app.get('/users', authRequired, (req, res) => {
  const users = db.get('users')
    .value()
    .map(user => {
      // Exclude sensitive information
      const { password, ip_address, ...safeUser } = user;
      return safeUser;
    });
  res.json(users);
});

// Get all groups
app.get('/groups', authRequired, (req, res) => {
  const groups = db.get('grup').value();
  res.json(groups);
});

// Create new group
app.post('/group', authRequired, (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Group name required' });
  }

  const newId = db.get('grup').size().value() + 1;
  const newGroup = {
    id: newId,
    name,
    description,
    admin_id: req.session.user.id,
    created_at: new Date().toISOString()
  };

  db.get('grup').push(newGroup).write();
  res.json({ success: true, group: newGroup });
});

// Get messages (with optional group filter or private chat)
app.get('/messages/:groupId?', authRequired, (req, res) => {
  let messages = db.get('pesan');
  const currentUserId = req.session.user.id;
  
  if (req.params.groupId) {
    // Group messages only
    messages = messages.filter({ group_id: parseInt(req.params.groupId) });
  } else {
    // General chat only - exclude private messages and group messages
    messages = messages.filter(msg => {
      return !msg.group_id && !msg.receiver_id;
    });
  }

  messages = messages.value().map(msg => {
    const user = db.get('users').find({ id: msg.user_id }).value();
    return {
      ...msg,
      username: user ? user.username : 'Unknown User'
    };
  });

  res.json(messages);
});

// Search messages
app.get('/messages/search', authRequired, (req, res) => {
  const { q, group, privateChatUser } = req.query;
  const currentUserId = req.session.user.id;
  let messages = db.get('pesan');

  if (group) {
    messages = messages.filter({ group_id: parseInt(group) });
  } else if (privateChatUser) {
    const otherUserId = parseInt(privateChatUser);
    messages = messages.filter(msg => {
      return (msg.user_id === currentUserId && msg.receiver_id === otherUserId) ||
             (msg.user_id === otherUserId && msg.receiver_id === currentUserId);
    });
  } else {
    // General chat search only - exclude private messages and group messages
    messages = messages.filter(msg => {
      return !msg.group_id && !msg.receiver_id;
    });
  }

  messages = messages
    .filter(msg => msg.content.toLowerCase().includes(q.toLowerCase()))
    .value()
    .map(msg => {
      const user = db.get('users').find({ id: msg.user_id }).value();
      return {
        ...msg,
        username: user ? user.username : 'Unknown User'
      };
    });

  res.json(messages);
});

// Send message
app.post('/message', authRequired, (req, res) => {
  const userId = req.session.user.id;
  const { content, group_id, reply_to, mentions, receiver_id } = req.body;

  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Message content required' });
  }

  const newId = db.get('pesan').size().value() + 1;
  const newMessage = {
    id: newId,
    user_id: userId,
    group_id: group_id || null,
    receiver_id: receiver_id || null,
    content,
    created_at: new Date().toISOString(),
    updated_at: null,
    edited: 0,
    pinned: 0,
    reply_to: reply_to || null,
    mentions: mentions || null
  };

  db.get('pesan').push(newMessage).write();

  // Add username to the message for socket emission
  const messageWithUser = {
    ...newMessage,
    username: req.session.user.username
  };

  io.emit('new_message', messageWithUser);
  res.json({ success: true, messageId: newId });
});

// Edit message
app.put('/message/:id', authRequired, (req, res) => {
  const userId = req.session.user.id;
  const messageId = parseInt(req.params.id);
  const { content } = req.body;

  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Message content required' });
  }

  const message = db.get('pesan').find({ id: messageId }).value();
  
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  if (message.user_id !== userId && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to edit this message' });
  }

  const updatedMessage = {
    ...message,
    content,
    updated_at: new Date().toISOString(),
    edited: 1
  };

  db.get('pesan')
    .find({ id: messageId })
    .assign(updatedMessage)
    .write();

  // Add username for socket emission
  const messageWithUser = {
    ...updatedMessage,
    username: req.session.user.username
  };

  io.emit('edit_message', messageWithUser);
  res.json({ success: true });
});

// Delete message
app.delete('/message/:id', authRequired, (req, res) => {
  const userId = req.session.user.id;
  const messageId = parseInt(req.params.id);

  const message = db.get('pesan').find({ id: messageId }).value();
  
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

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

// Get user profile by id
app.get('/user/:id', authRequired, (req, res) => {
  const userId = parseInt(req.params.id);
  const user = db.get('users').find({ id: userId }).value();
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  // Exclude password from response
  const { password, ...userData } = user;
  res.json(userData);
});

// Update profile (bio and profilePic)
app.put('/profile', authRequired, upload.single('profilePic'), (req, res) => {
  const userId = req.session.user.id;
  const { bio } = req.body;
  const user = db.get('users').find({ id: userId }).value();
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updateData = {};
  if (bio !== undefined) updateData.bio = bio;
  if (req.file) {
    updateData.profilePic = `/uploads/${req.file.filename}`;
  }

  db.get('users').find({ id: userId }).assign(updateData).write();
  res.json({ success: true, user: db.get('users').find({ id: userId }).value() });
});

// Backup chat
app.get('/backup', authRequired, (req, res) => {
  const userId = req.session.user.id;
  const user = db.get('users').find({ id: userId }).value();

  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can backup chat' });
  }

  const data = {
    messages: db.get('pesan').value(),
    groups: db.get('grup').value(),
    users: db.get('users').value().map(u => ({
      ...u,
      password: undefined // Remove passwords from backup
    }))
  };

  res.json(data);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
