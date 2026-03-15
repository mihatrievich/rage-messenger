import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

// API URL - change this to your server IP for external connections
const API_URL = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3000';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
});

// Create socket instance
let socket;

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); // login, register, chat
  const [friends, setFriends] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBanner, setEditBanner] = useState('');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const messagesEndRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    socket = io(SOCKET_URL);

    socket.on('message:receive', (message) => {
      if (selectedChat && (
        message.senderId === selectedChat.id || 
        message.receiverId === selectedChat.id
      )) {
        setMessages(prev => [...prev, message]);
        // Mark as read
        socket.emit('message:read', { 
          messageIds: [message._id], 
          readerId: user.id 
        });
      }
    });

    socket.on('message:status', ({ messageId, status }) => {
      setMessages(prev => prev.map(msg => 
        msg._id === messageId ? { ...msg, status } : msg
      ));
    });

    socket.on('user:status', ({ userId, isOnline }) => {
      setFriends(prev => prev.map(f => 
        f.id === userId ? { ...f, isOnline } : f
      ));
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedChat, user]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when chat is selected
  useEffect(() => {
    if (selectedChat && user) {
      loadMessages(selectedChat.id);
    }
  }, [selectedChat, user]);

  const loadMessages = async (friendId) => {
    try {
      const res = await api.get(`/api/messages/${user.id}/${friendId}`);
      setMessages(res.data.messages);
      
      // Mark messages as read
      const unreadMessages = res.data.messages.filter(
        m => m.senderId !== user.id && m.status !== 'read'
      );
      if (unreadMessages.length > 0) {
        socket.emit('message:read', { 
          messageIds: unreadMessages.map(m => m._id), 
          readerId: user.id 
        });
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const loadFriends = async () => {
    try {
      const res = await api.get(`/api/friends/${user.id}`);
      setFriends(res.data.friends);
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadFriends();
      socket.emit('user:login', user.id);
    }
  }, [user]);

  const handleLogin = async (username, password) => {
    try {
      const res = await api.post('/api/auth/login', { username, password });
      setUser(res.data.user);
      setView('chat');
    } catch (err) {
      alert(err.response?.data?.error || 'Login failed');
    }
  };

  const handleRegister = async (username, password) => {
    try {
      const res = await api.post('/api/auth/register', { username, password });
      setUser(res.data.user);
      setView('chat');
    } catch (err) {
      alert(err.response?.data?.error || 'Registration failed');
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;

    const messageData = {
      senderId: user.id,
      receiverId: selectedChat.id,
      content: newMessage
    };

    socket.emit('message:send', messageData);
    setNewMessage('');
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/api/users/search/${query}`);
      setSearchResults(res.data.users.filter(u => u.id !== user.id));
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleAddFriend = async (friendId) => {
    try {
      await api.post('/api/friends', { userId: user.id, friendId });
      loadFriends();
      setShowAddFriend(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add friend');
    }
  };

  const handleViewProfile = async (userId) => {
    try {
      const res = await api.get(`/api/users/${userId}`);
      setViewingProfile(res.data.user);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const res = await api.put(`/api/users/${user.id}`, {
        avatar: editAvatar,
        banner: editBanner,
        bio: editBio
      });
      setUser(res.data.user);
      setEditingProfile(false);
    } catch (err) {
      alert('Failed to update profile');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('login');
    setSelectedChat(null);
    setMessages([]);
    setFriends([]);
  };

  const getMessageStatus = (status) => {
    switch (status) {
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return '✓✓';
      default:
        return '';
    }
  };

  const getMessageStatusColor = (status) => {
    return status === 'read' ? 'text-rage-primary-hover' : 'text-rage-text-secondary';
  };

  // Render login/register views
  if (!user) {
    return (
      <div className="min-h-screen bg-rage-bg flex items-center justify-center p-4">
        <AuthForm 
          view={view} 
          setView={setView}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rage-bg flex">
      {/* Left Sidebar */}
      <div className="w-80 bg-rage-bg-secondary flex flex-col border-r border-gray-800">
        {/* User Profile */}
        <div 
          className="p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => {
            setViewingProfile(user);
            setEditingProfile(true);
            setEditBio(user.bio || '');
            setEditAvatar(user.avatar || '');
            setEditBanner(user.banner || '');
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-rage-primary flex items-center justify-center text-white font-bold text-lg overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                user.username.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{user.username}</span>
                {user.isBetaTester && (
                  <span className="beta-badge" title="BETA TEST">β</span>
                )}
              </div>
              <span className="text-sm text-green-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Online
              </span>
            </div>
          </div>
        </div>

        {/* Search / Add Friend */}
        <div className="p-3 border-b border-gray-800">
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-rage-bg border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-rage-primary"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-rage-bg-secondary border border-gray-700 rounded-lg mt-1 max-h-60 overflow-y-auto z-10">
                {searchResults.map(result => (
                  <div 
                    key={result.id}
                    className="p-3 hover:bg-gray-800 cursor-pointer flex items-center gap-3"
                    onClick={() => handleAddFriend(result.id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-rage-primary flex items-center justify-center text-white text-sm">
                      {result.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white">{result.username}</span>
                        {result.isBetaTester && (
                          <span className="beta-badge">β</span>
                        )}
                      </div>
                      <span className={`text-xs ${result.isOnline ? 'text-green-500' : 'text-gray-500'}`}>
                        {result.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <span className="text-rage-primary text-sm">Add</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-gray-500 text-sm font-semibold mb-2">Friends</h3>
            {friends.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No friends yet. Search to add!</p>
            ) : (
              friends.map(friend => (
                <div
                  key={friend.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${
                    selectedChat?.id === friend.id 
                      ? 'bg-rage-primary bg-opacity-20' 
                      : 'hover:bg-gray-800'
                  }`}
                  onClick={() => {
                    setSelectedChat(friend);
                    handleViewProfile(friend.id);
                  }}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-rage-primary flex items-center justify-center text-white font-semibold overflow-hidden">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt={friend.username} className="w-full h-full object-cover" />
                      ) : (
                        friend.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-rage-bg-secondary ${
                      friend.isOnline ? 'bg-green-500' : 'bg-gray-500'
                    }`}></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">{friend.username}</span>
                      {friend.isBetaTester && (
                        <span className="beta-badge">β</span>
                      )}
                    </div>
                    <span className={`text-xs ${friend.isOnline ? 'text-green-500' : 'text-gray-500'}`}>
                      {friend.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Logout Button */}
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-800 bg-rage-bg-secondary flex items-center justify-between">
              <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => handleViewProfile(selectedChat.id)}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-rage-primary flex items-center justify-center text-white font-semibold overflow-hidden">
                    {selectedChat.avatar ? (
                      <img src={selectedChat.avatar} alt={selectedChat.username} className="w-full h-full object-cover" />
                    ) : (
                      selectedChat.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-rage-bg-secondary ${
                    selectedChat.isOnline ? 'bg-green-500' : 'bg-gray-500'
                  }`}></span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{selectedChat.username}</span>
                    {selectedChat.isBetaTester && (
                      <span className="beta-badge" title="BETA TEST">β</span>
                    )}
                  </div>
                  <span className={`text-xs ${selectedChat.isOnline ? 'text-green-500' : 'text-gray-500'}`}>
                    {selectedChat.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => {
                const isOwn = msg.senderId === user.id;
                return (
                  <div
                    key={msg._id || index}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} message-enter`}
                  >
                    <div className={`max-w-xs lg:max-w-md ${
                      isOwn 
                        ? 'bg-rage-primary text-white rounded-2xl rounded-br-sm' 
                        : 'bg-gray-700 text-white rounded-2xl rounded-bl-sm'
                    } px-4 py-2`}>
                      <p className="break-words">{msg.content}</p>
                      <div className={`text-xs mt-1 flex items-center justify-end gap-1 ${
                        isOwn ? getMessageStatusColor(msg.status) : 'text-gray-400'
                      }`}>
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isOwn && (
                          <span>{getMessageStatus(msg.status)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-800 bg-rage-bg-secondary">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-rage-bg border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-rage-primary"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-6 bg-rage-primary hover:bg-rage-primary-hover text-white rounded-lg font-semibold transition-colors btn-primary"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-rage-primary mb-2">RAGE</h2>
              <p className="text-gray-500">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => { setViewingProfile(null); setEditingProfile(false); }}>
          <div className="bg-rage-bg-secondary rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Banner */}
            <div className="h-32 relative">
              {viewingProfile.banner ? (
                <img src={viewingProfile.banner} alt="banner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full profile-banner"></div>
              )}
            </div>
            
            <div className="px-6 pb-6">
              {/* Avatar */}
              <div className="relative -mt-12 mb-4">
                <div className="w-24 h-24 rounded-full bg-rage-primary mx-auto flex items-center justify-center text-white text-4xl font-bold overflow-hidden border-4 border-rage-bg-secondary">
                  {viewingProfile.avatar ? (
                    <img src={viewingProfile.avatar} alt={viewingProfile.username} className="w-full h-full object-cover" />
                  ) : (
                    viewingProfile.username.charAt(0).toUpperCase()
                  )}
                </div>
              </div>
              
              {editingProfile ? (
                <>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <h3 className="text-2xl font-bold text-white">{viewingProfile.username}</h3>
                    {viewingProfile.isBetaTester && (
                      <span className="beta-badge" title="BETA TEST">β</span>
                    )}
                  </div>
                  
                  {/* URL Inputs */}
                  <div className="space-y-3 mb-4">
                    <input
                      type="text"
                      value={editAvatar}
                      onChange={(e) => setEditAvatar(e.target.value)}
                      placeholder="Avatar URL (https://...)"
                      className="w-full bg-rage-bg border border-gray-700 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-500"
                    />
                    <input
                      type="text"
                      value={editBanner}
                      onChange={(e) => setEditBanner(e.target.value)}
                      placeholder="Banner URL (https://...)"
                      className="w-full bg-rage-bg border border-gray-700 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-500"
                    />
                  </div>
                  
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Write something about yourself..."
                    className="w-full bg-rage-bg border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 mb-4 resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingProfile(null)}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateProfile}
                      className="flex-1 py-2 bg-rage-primary hover:bg-rage-primary-hover text-white rounded-lg transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <h3 className="text-2xl font-bold text-white">{viewingProfile.username}</h3>
                    {viewingProfile.isBetaTester && (
                      <span className="beta-badge" title="BETA TEST">β</span>
                    )}
                  </div>
                  <p className="text-gray-400 mb-4">{viewingProfile.bio || 'No bio yet'}</p>
                  <span className={`inline-flex items-center gap-1 ${viewingProfile.isOnline ? 'text-green-500' : 'text-gray-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${viewingProfile.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                    {viewingProfile.isOnline ? 'Online' : 'Offline'}
                  </span>
                  <button
                    onClick={() => setViewingProfile(null)}
                    className="w-full mt-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Auth Form Component
function AuthForm({ view, setView, onLogin, onRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      alert('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    try {
      if (view === 'login') {
        await onLogin(username, password);
      } else {
        await onRegister(username, password);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
      {/* Animated background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-64 h-64 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ top: '10%', left: '10%' }}></div>
        <div className="absolute w-96 h-96 bg-purple-800/10 rounded-full blur-3xl animate-pulse" style={{ bottom: '10%', right: '10%', animationDelay: '1s' }}></div>
      </div>
      
      <div className="w-full max-w-md z-10">
        {/* Beautiful Logo */}
        <div className="text-center mb-8">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-purple-600 blur-2xl opacity-30 rounded-full"></div>
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 logo-glow px-6 py-3 relative">
            RAGE
          </h1>
        </div>
        <p className="text-gray-400 mt-3 text-sm font-medium tracking-widest">REAL-TIME MESSENGER</p>
      </div>

      {/* Toggle */}
      <div className="flex mb-8 bg-rage-bg/50 backdrop-blur-sm rounded-xl p-1.5 w-full max-w-md z-10">
            <button
              onClick={() => setView('login')}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${
                view === 'login' 
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setView('register')}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${
                view === 'register' 
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-gray-400 text-sm mb-2 font-medium">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all backdrop-blur-sm"
                  placeholder="Enter your username"
                  minLength={3}
                  maxLength={20}
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2 font-medium">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-rage-bg border border-gray-700 rounded-xl px-12 py-3.5 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  placeholder="Enter your password"
                  minLength={6}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Please wait...
                </span>
              ) : (view === 'login' ? 'Welcome Back' : 'Create Account')}
            </button>
          </form>

          {view === 'register' && (
            <div className="mt-6 p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <p className="text-center text-purple-400 text-sm">
                🎉 All registered users become <span className="font-bold">BETA TESTERS</span>
              </p>
            </div>
          )}
        </div>
      </div>
  );
}

export default App;
