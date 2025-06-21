const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);

// Remove all messages that have receiver_id (private messages)
const removedMessages = db.get('pesan').filter(msg => msg.receiver_id).value();
console.log('Removing private messages:', removedMessages);

db.get('pesan').remove(msg => msg.receiver_id).write();

console.log('Database cleaned up. Private messages removed from general chat.');
console.log('Remaining messages:', db.get('pesan').value());
