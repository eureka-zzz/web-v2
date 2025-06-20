# Local LAN Messaging Platform (web-v2)

A fullstack local messaging platform designed to run on Termux (Android) over a local WiFi network (LAN) without any internet connection. This app supports user registration, login, real-time messaging, file sharing, voice/video notes, group chats, and more — all accessible via the local IP address of the device running the server.

---

## Features

- User authentication based on device IP and credentials
- Registration and login pages with session persistence
- Admin access for user `zete` with password `zetedec`
- Real-time messaging with text, file uploads, voice and video notes
- Edit, delete, reply, mention (@username), and pin messages
- Group chat creation, user invitations, and admin management
- Voice and video note recording using MediaRecorder API
- File uploads with previews (images, videos, documents)
- Light and dark mode toggle with saved preferences
- Message drafts saved automatically in localStorage
- Search and filter messages
- Chat backup export to .txt or .json files
- Responsive, Telegram-inspired UI optimized for mobile devices

---

## Installation on Termux (Android)

### 1. Install Termux

Download and install Termux from [F-Droid](https://f-droid.org/en/packages/com.termux/) (recommended) or Google Play Store.

### 2. Update Termux packages

Open Termux and run:

```bash
pkg update && pkg upgrade -y
```

### 3. Install required packages

```bash
pkg install nodejs git sqlite -y
```

### 4. Clone the repository

```bash
git clone https://github.com/eureka-zzz/web-v2.git
cd web-v2
```

### 5. Install Node.js dependencies

```bash
npm install
```

### 6. Set permissions (if needed)

```bash
chmod +x install.sh
chmod +x server/index.js
```

---

## Running the Server

Start the server with:

```bash
npm start
```

or

```bash
node server/index.js
```

The server will start listening on port 3000.

---

## Accessing the Application

1. Find your device's local IP address by running:

```bash
ifconfig wlan0
```

Look for the `inet` address (e.g., `192.168.1.5`).

2. On any device connected to the same WiFi network, open a browser and navigate to:

```
http://YOUR_IP:3000
```

Replace `YOUR_IP` with the IP address found in the previous step.

---

## Usage Guide

### First Time Setup

- If your device IP is not registered, you will be redirected to the registration page.
- Register by choosing a username and password.
- After registration, you will be redirected to the login page.
- Login with your credentials to access the chat.

### Admin Access

- Username: `zete`
- Password: `zetedec`
- Admin users can:
  - View all users
  - Delete any user or message
  - Manage groups and pinned messages

### Sending Messages

- Type your message in the input box and press Enter or click Send.
- Use Shift+Enter for new lines.
- Long messages will show a "Read More" button to expand.

### File Sharing

- Click the paperclip icon to attach files (images, videos, documents).
- Files up to 50MB are supported.
- Uploaded files show previews in the chat.

### Voice and Video Notes

- Click the microphone or camera icon to start recording.
- Click again to stop and send the recording.

### Group Chats

- Create groups from the sidebar.
- Invite users by username.
- Set group admins and pin important messages.

### Other Features

- Reply to messages and mention users with `@username`.
- Toggle between light and dark mode.
- Draft messages are saved automatically.
- Search and filter messages.
- Backup chat history to `.txt` or `.json`.

---

## Troubleshooting

### Port 3000 already in use

Find the process using port 3000:

```bash
lsof -i :3000
```

Kill the process:

```bash
kill -9 <PID>
```

### Permission issues

Make sure the server script has execute permissions:

```bash
chmod +x server/index.js
```

### Can't access from other devices

- Ensure all devices are connected to the same WiFi network.
- Use the correct local IP address (not `localhost`).
- Check firewall settings on your device.

---

## Security Notes

- This app is designed for local network use only.
- Do not expose the server to the internet without proper security measures.
- Change admin credentials before production use.
- Files are stored locally without encryption.

---

## Development

To run the server in development mode with auto-restart:

```bash
npm run dev
```

---

## License

MIT License — feel free to modify and distribute as needed.

---

## About

This project was created to provide a lightweight, local messaging platform that works entirely offline on Android devices using Termux and a shared WiFi network.
