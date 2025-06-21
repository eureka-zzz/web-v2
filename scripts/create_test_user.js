const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);

// Create test user
const testUser = {
  id: db.get('users').size().value() + 1,
  username: 'testuser',
  password: 'testpass',
  ip_address: '127.0.0.1',
  role: 'user',
  profilePic: '',
  bio: 'Test user for private messaging',
  created_at: new Date().toISOString(),
  last_seen: new Date().toISOString()
};

// Add test user to database
db.get('users').push(testUser).write();
console.log('Test user created:', testUser);
