const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Import models
const User = require('./models/User');
const Message = require('./models/Message');
const Friend = require('./models/Friend');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Serve React static files
const buildPath = path.join(__dirname, '../client/build');
console.log('Serving static files from:', buildPath);
app.use(express.static(buildPath));

// Maintenance mode - set to true to show maintenance page
// Secret should be set via environment variable MAINTENANCE_SECRET
let maintenanceMode = false;
const getMaintenanceSecret = () => process.env.MAINTENANCE_SECRET;

// Simple in-memory rate limiter for maintenance endpoint
const maintenanceRequests = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = maintenanceRequests.get(ip);
  
  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    maintenanceRequests.set(ip, { timestamp: now, count: 1 });
    return true;
  }
  
  if (record.count >= MAX_REQUESTS) {
    return false;
  }
  
  record.count++;
  return true;
}

// Maintenance mode toggle endpoint (protected endpoint)
// Only accessible from localhost or when MAINTENANCE_SECRET is properly set
app.post('/api/maintenance', (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const { enabled, secret } = req.body;
  const maintenanceSecret = getMaintenanceSecret();
  
  // Apply rate limiting
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }
  
  // Validate secret - require environment variable in production
  if (!maintenanceSecret) {
    console.error('MAINTENANCE_SECRET environment variable not set!');
    return res.status(500).json({ error: 'Maintenance endpoint not configured' });
  }
  
  if (secret !== maintenanceSecret) {
    return res.status(403).json({ error: 'Invalid secret' });
  }
  
  // Additional security: only allow from localhost in production
  const isLocalhost = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
  const isPrivateNetwork = clientIP.startsWith('192.168.') || clientIP.startsWith('10.') || clientIP.startsWith('172.');
  
  // In production (when secret is set), restrict to local networks
  if (process.env.NODE_ENV === 'production' && !isLocalhost && !isPrivateNetwork) {
    return res.status(403).json({ error: 'Maintenance endpoint only available from local network' });
  }
  
  maintenanceMode = enabled;
  res.json({ maintenanceMode });
});

// Maintenance file path
const maintenancePath = path.join(__dirname, '../client/public/maintenance.html');

// Check maintenance mode middleware
app.use((req, res, next) => {
  if (maintenanceMode && !req.path.startsWith('/api')) {
    return res.sendFile(maintenancePath);
  }
  next();
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rageadmin:rageadmin119330@rageme.wwx2e96.mongodb.net/?appName=rageme';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.io connection handling
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user:login', async (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    
    // Update user status to online
    await User.findByIdAndUpdate(userId, { isOnline: true });
    
    // Notify friends about online status
    const friends = await Friend.find({ $or: [{ user1: userId }, { user2: userId }] });
    friends.forEach(friend => {
      const friendId = friend.user1.toString() === userId ? friend.user2.toString() : friend.user1.toString();
      const friendSocket = onlineUsers.get(friendId);
      if (friendSocket) {
        io.to(friendSocket).emit('user:status', { userId, isOnline: true });
      }
    });
  });

  socket.on('message:send', async (data) => {
    const { senderId, receiverId, content } = data;
    
    // Create message
    const message = new Message({
      senderId,
      receiverId,
      content,
      status: 'sent'
    });
    await message.save();

    // Send to receiver if online
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('message:receive', message);
      
      // Update status to delivered
      message.status = 'delivered';
      await message.save();
      io.to(receiverSocket).emit('message:status', { messageId: message._id, status: 'delivered' });
    }

    // Send back to sender with sent status
    socket.emit('message:status', { messageId: message._id, status: 'sent' });
  });

  socket.on('message:read', async ({ messageIds, readerId }) => {
    // Update message status to read
    await Message.updateMany(
      { _id: { $in: messageIds } },
      { status: 'read' }
    );

    // Notify sender
    const messages = await Message.find({ _id: { $in: messageIds } });
    messages.forEach(msg => {
      const senderSocket = onlineUsers.get(msg.senderId.toString());
      if (senderSocket) {
        io.to(senderSocket).emit('message:status', { 
          messageId: msg._id, 
          status: 'read' 
        });
      }
    });
  });

  socket.on('disconnect', async () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      
      // Update user status to offline
      await User.findByIdAndUpdate(socket.userId, { isOnline: false });
      
      // Notify friends about offline status
      const friends = await Friend.find({ $or: [{ user1: socket.userId }, { user2: socket.userId }] });
      friends.forEach(friend => {
        const friendId = friend.user1.toString() === socket.userId ? friend.user2.toString() : friend.user1.toString();
        const friendSocket = onlineUsers.get(friendId);
        if (friendSocket) {
          io.to(friendSocket).emit('user:status', { userId: socket.userId, isOnline: false });
        }
      });
    }
    console.log('User disconnected:', socket.id);
  });
});

// REST API Routes

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      password: hashedPassword,
      isBetaTester: true // All users are beta testers
    });
    await user.save();

    res.json({ user: { id: user._id, username: user.username, isBetaTester: user.isBetaTester, isDeveloper: user.isDeveloper } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    res.json({ 
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: user.avatar,
        banner: user.banner,
        bio: user.bio,
        isBetaTester: user.isBetaTester,
        isDeveloper: user.isDeveloper,
        isOnline: user.isOnline
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ 
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: user.avatar,
        banner: user.banner,
        bio: user.bio,
        isBetaTester: user.isBetaTester,
        isDeveloper: user.isDeveloper,
        isOnline: user.isOnline
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/users/:id', async (req, res) => {
  try {
    const { avatar, bio, banner, isDeveloper } = req.body;
    const updateData = { avatar, bio, banner };
    
    // Only allow setting isDeveloper if provided (for development)
    if (isDeveloper !== undefined) {
      updateData.isDeveloper = isDeveloper;
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    res.json({ 
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: user.avatar,
        banner: user.banner,
        bio: user.bio,
        isBetaTester: user.isBetaTester,
        isDeveloper: user.isDeveloper,
        isOnline: user.isOnline
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add friend
app.post('/api/friends', async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    
    // Check if already friends
    const existing = await Friend.findOne({
      $or: [
        { user1: userId, user2: friendId },
        { user1: friendId, user2: userId }
      ]
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Already friends' });
    }

    const friend = new Friend({ user1: userId, user2: friendId });
    await friend.save();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get friends list
app.get('/api/friends/:userId', async (req, res) => {
  try {
    const friends = await Friend.find({
      $or: [{ user1: req.params.userId }, { user2: req.params.userId }]
    });

    const friendList = await Promise.all(
      friends.map(async (f) => {
        const friendId = f.user1.toString() === req.params.userId ? f.user2 : f.user1;
        const user = await User.findById(friendId);
        return {
          id: user._id,
          username: user.username,
          avatar: user.avatar,
          isOnline: user.isOnline,
          isBetaTester: user.isBetaTester
        };
      })
    );

    res.json({ friends: friendList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages between two users
app.get('/api/messages/:userId/:friendId', async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { senderId: req.params.userId, receiverId: req.params.friendId },
        { senderId: req.params.friendId, receiverId: req.params.userId }
      ]
    }).sort({ createdAt: 1 });

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search users
app.get('/api/users/search/:query', async (req, res) => {
  try {
    const users = await User.find({
      username: { $regex: req.params.query, $options: 'i' }
    }).limit(10);

    res.json({ 
      users: users.map(u => ({ 
        id: u._id, 
        username: u.username, 
        avatar: u.avatar,
        isOnline: u.isOnline,
        isBetaTester: u.isBetaTester
      })) 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete chat history between two users
app.delete('/api/messages/:userId/:friendId', async (req, res) => {
  try {
    const { userId, friendId } = req.params;
    
    // Validate userId is a valid MongoDB ObjectId format
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Note: In a production app, you'd verify the requester is authorized
    // For now, we allow deletion if userId matches a logged-in user
    // The client should send the authenticated user's ID in the request
    await Message.deleteMany({
      $or: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId }
      ]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`RAGE Server running on port ${PORT}`);
});
