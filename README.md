# Local LAN Messaging Platform

A fullstack local area network (LAN) messaging platform designed for Termux Android devices. This application enables real-time messaging, group chats, file sharing, voice notes, and more within a local WiFi network.

## Features

### Core Messaging
- ✅ Real-time messaging with Socket.IO
- ✅ Message editing and deletion
- ✅ Message search functionality
- ✅ Draft message saving
- ✅ Enter key to send messages (no Shift+Enter required)

### User Management
- ✅ IP-based user registration and authentication
- ✅ Admin user with special privileges (username: `zete`, password: `zetedec`)
- ✅ Session-based authentication
- ✅ Automatic IP address detection

### Group Chat
- ✅ Create and join multiple chat groups
- ✅ Group-specific messaging
- ✅ General chat (default) and custom groups
- ✅ Group administration

### Media & Files
- ✅ File upload and sharing
- ✅ Voice note recording and playback
- ✅ Support for various file types
- ✅ Audio/WebM voice note format

### Advanced Features
- ✅ Chat backup (admin only)
- ✅ Dark/Light mode toggle
- ✅ Responsive design for mobile and desktop
- ✅ Modern UI with Tailwind CSS
- ✅ Search messages across chats
- ✅ Real-time updates across all connected devices

## Installation

### Prerequisites
- Android device with Termux installed
- Node.js (installed via Termux)
- Git (for cloning the repository)

### Quick Setup

1. **Install Termux** from F-Droid or Google Play Store

2. **Update Termux packages:**
   ```bash
   pkg update && pkg upgrade
   ```

3. **Install required packages:**
   ```bash
   pkg install nodejs git
   ```

4. **Clone the repository:**
   ```bash
   git clone https://github.com/eureka-zzz/web-v2.git
   cd web-v2
   ```

5. **Run the installation script:**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

6. **Start the server:**
   ```bash
   npm start
   ```

### Manual Installation

If the installation script doesn't work, follow these steps:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create uploads directory:**
   ```bash
   mkdir -p uploads
   ```

3. **Initialize database:**
   ```bash
   echo '{"users":[],"pesan":[],"grup":[]}' > db.json
   ```

4. **Start the server:**
   ```bash
   node server/index.js
   ```

## Usage

### Starting the Application

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Find your device's IP address:**
   ```bash
   ip route get 1.1.1.1 | grep -oP 'src \K\S+'
   ```

3. **Access the application:**
   - On the same device: `http://localhost:3000`
   - From other devices on the same WiFi: `http://YOUR_IP_ADDRESS:3000`

### First Time Setup

1. **Register a new user:**
   - Open the application in a web browser
   - You'll be redirected to the registration page
   - Enter a username and password
   - Click "Register"

2. **Admin Access:**
   - Username: `zete`
   - Password: `zetedec`
   - Admin users can delete any message and backup chat data

### Using the Chat

#### Sending Messages
- Type your message in the input field at the bottom
- Press **Enter** to send (no need for Shift+Enter)
- Messages appear in real-time on all connected devices

#### Creating Groups
1. Click the "Create Group" button in the sidebar
2. Enter a group name and optional description
3. Click "Create" to create the group
4. The group will appear in the sidebar for all users

#### File Sharing
1. Click the attachment icon (📎) next to the message input
2. Select a file from your device
3. The file will be uploaded and shared in the chat

#### Voice Notes
1. Click the microphone icon next to the message input
2. Allow microphone permissions when prompted
3. Speak your message
4. Click the microphone icon again to stop recording
5. The voice note will be uploaded and shared

#### Search Messages
1. Click the "Search" button in the chat header
2. Type your search query
3. Messages matching your search will be displayed

#### Backup Chat (Admin Only)
1. Login as admin (zete/zetedec)
2. Click the "Backup Chat" button
3. A JSON file with all chat data will be downloaded

## Technical Details

### Architecture
- **Backend:** Node.js with Express.js
- **Database:** LowDB (JSON file-based)
- **Real-time:** Socket.IO
- **Frontend:** HTML, CSS (Tailwind), JavaScript
- **File Storage:** Local filesystem with multer

### API Endpoints

#### Authentication
- `POST /register` - Register new user
- `POST /login` - User login
- `POST /logout` - User logout
- `GET /me` - Get current user info

#### Messaging
- `GET /messages/:groupId?` - Get messages (optionally filtered by group)
- `POST /message` - Send new message
- `PUT /message/:id` - Edit message
- `DELETE /message/:id` - Delete message
- `GET /messages/search` - Search messages

#### Groups
- `GET /groups` - Get all groups
- `POST /group` - Create new group

#### Files
- `POST /upload` - Upload file
- `GET /uploads/:filename` - Download file

#### Admin
- `GET /backup` - Backup chat data (admin only)

### Database Schema

#### Users
```json
{
  "id": 1,
  "username": "string",
  "password": "string",
  "ip_address": "string",
  "role": "user|admin",
  "created_at": "ISO_DATE",
  "last_seen": "ISO_DATE"
}
```

#### Messages (pesan)
```json
{
  "id": 1,
  "user_id": 1,
  "group_id": 1,
  "content": "string",
  "created_at": "ISO_DATE",
  "updated_at": "ISO_DATE",
  "edited": 0,
  "pinned": 0,
  "reply_to": null,
  "mentions": null
}
```

#### Groups (grup)
```json
{
  "id": 1,
  "name": "string",
  "description": "string",
  "admin_id": 1,
  "created_at": "ISO_DATE"
}
```

## Configuration

### Environment Variables
- `PORT` - Server port (default: 3000)

### File Upload Limits
- Maximum file size: 50MB
- Supported formats: All file types
- Voice notes: WebM audio format

## Troubleshooting

### Common Issues

1. **Cannot access from other devices:**
   - Ensure all devices are on the same WiFi network
   - Check if the server is running on the correct IP address
   - Verify firewall settings

2. **Voice recording not working:**
   - Grant microphone permissions in your browser
   - Use HTTPS or localhost for microphone access
   - Check browser compatibility (Chrome/Firefox recommended)

3. **File upload fails:**
   - Check file size (must be under 50MB)
   - Ensure uploads directory exists and is writable
   - Verify disk space availability

4. **Messages not appearing in real-time:**
   - Check Socket.IO connection in browser console
   - Refresh the page to reconnect
   - Verify server is running properly

### Debug Mode

To run in debug mode with detailed logs:
```bash
DEBUG=* npm start
```

## Development

### Project Structure
```
web-v2/
├── server/
│   └── index.js          # Express server and API routes
├── public/
│   ├── index.html        # Main chat interface
│   ├── login.html        # Login page
│   ├── register.html     # Registration page
│   ├── app.js           # Frontend JavaScript
│   └── styles.css       # Custom CSS styles
├── uploads/             # File upload directory
├── db.json             # LowDB database file
├── package.json        # Node.js dependencies
├── install.sh          # Installation script
└── README.md           # This file
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Author

**eureka-zzz**
- GitHub: [eureka-zzz](https://github.com/eureka-zzz)
- Repository: [web-v2](https://github.com/eureka-zzz/web-v2)

## Version History

- **v1.0.0** - Initial release with full messaging platform features
  - Real-time messaging
  - Group chat support
  - File and voice note sharing
  - Admin features
  - Modern responsive UI
  - Search and backup functionality
