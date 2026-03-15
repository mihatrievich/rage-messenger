const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

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

    res.json({ user: { id: user._id, username: user.username, isBetaTester: user.isBetaTester } });
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
    const { avatar, bio, banner } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { avatar, bio, banner },
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`RAGE Server running on port ${PORT}`);
});
