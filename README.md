# RAGE Messenger

Modern real-time messenger with a futuristic dark theme.

## Features

- 💬 Real-time messaging with Socket.io
- 👥 Friend system
- 🔐 Secure authentication (register/login)
- 📱 Profile management with avatar and bio
- 🟣 Purple neon theme
- ✓ Message status (sent, delivered, read)
- β Beta tester badge

## Tech Stack

- **Frontend**: React + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: MongoDB
- **Real-time**: Socket.io

## Prerequisites

1. **Node.js** (v14 or higher)
2. **MongoDB** (local installation or MongoDB Atlas)

## Installation

### 1. Install MongoDB

**Option A: Local MongoDB**
- Download MongoDB from https://www.mongodb.com/try/download/community
- Install and start MongoDB service

**Option B: MongoDB Atlas (Cloud)**
- Create free account at https://www.mongodb.com/cloud/atlas
- Create cluster and get connection string

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

Or use the convenience script:
```bash
npm run install-all
```

## Running the Application

### Start both server and client:
```bash
npm start
```

### Or run separately:

**Terminal 1 - Server:**
```bash
cd server
npm start
```

**Terminal 2 - Client:**
```bash
cd client
npm start
```

The application will open at: http://localhost:3000

## Connecting from Other Devices

To connect from other devices on your network:

1. **Find your local IP address:**
   - Windows: `ipconfig` in cmd
   - Look for IPv4 Address (e.g., `192.168.1.x`)

2. **Update client configuration:**
   
   Edit `client/src/App.js` and change:
   ```javascript
   const API_URL = 'http://localhost:3000';
   const SOCKET_URL = 'http://localhost:3000';
   ```
   
   To your IP address:
   ```javascript
   const API_URL = 'http://192.168.1.x:3000';
   const SOCKET_URL = 'http://192.168.1.x:3000';
   ```

3. **Connect from other devices:**
   
   Other users can access the app at: `http://192.168.1.x:3001`

## Usage

### Registration
1. Click "Register" tab
2. Enter username (3-20 characters)
3. Enter password (minimum 6 characters)
4. Click Register
5. All users are automatically BETA TESTERS

### Adding Friends
1. Type in the search box to find users
2. Click "Add" to send friend request
3. Friends appear in the left sidebar

### Messaging
1. Click on a friend in the sidebar
2. Type message and press Enter or click Send
3. Messages appear in real-time
4. Message status shown with checkmarks:
   - ✓ sent
   - ✓✓ delivered
   - ✓✓ (purple) - read

### Profile
- Click on your profile at top-left to edit bio
- Click on any username in chat to view their profile

## Project Structure

```
rage/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   ├── index.js       # Entry point
│   │   └── index.css      # TailwindCSS styles
│   ├── package.json
│   └── tailwind.config.js
├── server/                 # Node.js backend
│   ├── models/
│   │   ├── User.js        # User model
│   │   ├── Message.js     # Message model
│   │   └── Friend.js      # Friend model
│   ├── index.js           # Server entry point
│   └── package.json
├── package.json           # Root package.json
└── README.md              # This file
```

## Troubleshooting

### MongoDB Connection Error
- Make sure MongoDB is running
- Check connection string in `server/index.js`

### Port Already in Use
- Server uses port 3000
- Client uses port 3001
- Stop other applications using these ports

### WebSocket Connection Error
- Check firewall settings
- Ensure you're using correct IP address

## License

MIT
