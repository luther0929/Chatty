const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require("crypto");
const bcrypt = require('bcrypt'); //password encryption
const SALT_ROUNDS = 10;
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
const { MongoClient } = require('mongodb');
const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);
let db, usersCollection, groupsCollection, messagesCollection;

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads/avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.body.username}${ext}`);
  }
});
const upload = multer({ storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// For chat message images
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads/messages'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const uploadMessageImg = multer({ storage: messageStorage });

function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (password.length < minLength) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!hasUpperCase || !hasLowerCase) {
    return { valid: false, message: 'Password must contain both uppercase and lowercase letters' };
  }
  if (!hasNumber) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!hasSpecialChar) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  
  return { valid: true };
}

async function connectDB() {
  try {
    await client.connect();
    db = client.db("chatApp");
    usersCollection = db.collection("users");
    groupsCollection = db.collection("groups");
    messagesCollection = db.collection("messages");
    await ensureSuperUser();

    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

const server = http.createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});

app.use('/peerjs', peerServer);

const activeVideoBroadcasts = new Map();
const activeScreenShares = new Map();

// REST API routes

app.get('/api/groups', async (req, res) => {
  try {
    const groups = await groupsCollection.find().toArray();
    res.json(groups);
  } catch (err) {
    console.error("❌ GET /api/groups failed", err);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

app.get('/api/groups/:id', async (req, res) => {
  try {
    const group = await groupsCollection.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ error: "Group not found" });
    res.json(group);
  } catch (err) {
    console.error("❌ GET /api/groups/:id failed", err);
    res.status(500).json({ error: "Failed to fetch group" });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users);
  } catch (err) {
    console.error("❌ GET /api/users failed", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get('/api/groups/:groupId/channels/:channelId/messages', async (req, res) => {
  try {
    const { groupId, channelId } = req.params;
    const group = await groupsCollection.findOne({ id: groupId });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const channel = group.channels.find(c => c.id === channelId);
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    res.json(channel.messages || []);
  } catch (err) {
    console.error("❌ GET /api/groups/:groupId/channels/:channelId/messages failed", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate password strength
    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const existing = await usersCollection.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: "Username already exists. Please choose a different username." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = {
      id: crypto.randomUUID(),
      username,
      email,
      password: hashedPassword,
      roles: ["chatUser"],
      groups: []
    };

    await usersCollection.insertOne(newUser);
    
    // Don't send password back to client
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (err) {
    console.error("❌ register failed", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await usersCollection.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Don't send password back to client
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err) {
    console.error("❌ login failed", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

app.post('/api/users/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const { username } = req.body;
    const filePath = `/uploads/avatars/${req.file.filename}`;

    await usersCollection.updateOne(
      { username },
      { $set: { avatar: filePath } }
    );

    const updatedUser = await usersCollection.findOne({ username });
    res.json(updatedUser);
  } catch (err) {
    console.error("❌ avatar upload failed", err);
    res.status(500).json({ error: "Failed to upload avatar" });
  }
});

app.post('/api/messages/upload', uploadMessageImg.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({ imageUrl: `/uploads/messages/${req.file.filename}` });
});

async function ensureSuperUser() {
  const superUser = await usersCollection.findOne({ username: "super" });
  if (!superUser) {
    const hashedPassword = await bcrypt.hash("Super@123", SALT_ROUNDS);
    await usersCollection.insertOne({
      id: crypto.randomUUID(),
      username: "super",
      email: "super@example.com",
      password: hashedPassword,
      roles: ["superAdmin"],
      groups: []
    });
    console.log("✅ Default super user created: username=super, password=Super@123");
  } else {
    console.log("ℹ️ Super user already exists");
  }
}

io.on('connection', (socket) => {

    socket.on('user:register', ({ username }) => {
        socket.username = username;
        console.log(`✅ Socket registered for user: ${username}`);
    });

    socket.on('groups:getAll', async () => {
        const allGroups = await groupsCollection.find().toArray();
        socket.emit('groups:update', allGroups);
    });

    socket.on('newmsg', (message) => {
        io.emit('newmsg', message);
    })

    socket.on('disconnect', async () => {
        if (socket.currentChannel && socket.username) {
            const [groupId, channelId] = socket.currentChannel.split(':');

            // Clean up video broadcasts
            const broadcasts = activeVideoBroadcasts.get(socket.currentChannel);
            if (broadcasts) {
                const toRemove = Array.from(broadcasts).find(b => b.username === socket.username);
                if (toRemove) {
                    broadcasts.delete(toRemove);
                    io.to(socket.currentChannel).emit('video:stop', {
                        peerId: toRemove.peerId,
                        username: socket.username
                    });
                }
                
                if (broadcasts.size === 0) {
                    activeVideoBroadcasts.delete(socket.currentChannel);
                }
            }
            
            // Clean up screenshare if this user was sharing
            const currentScreenShare = activeScreenShares.get(socket.currentChannel);
            if (currentScreenShare && currentScreenShare.username === socket.username) {
                activeScreenShares.delete(socket.currentChannel);
                io.to(socket.currentChannel).emit('screenshare:stop', {
                    peerId: currentScreenShare.peerId,
                    username: socket.username
                });
            }

            await groupsCollection.updateOne(
                { id: groupId, "channels.id": channelId },
                { $pull: { "channels.$.users": socket.username } }
            );

            io.to(socket.currentChannel).emit('channels:system', {
                username: 'System',
                text: `${socket.username} disconnected`,
                timestamp: new Date(),
            });

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
        }
    });

    socket.on('groups:create', async (group) => {
        try {
            const newGroup = {
                ...group,
                admins: group.admins || [],
                members: group.members || [],
                bannedMembers: group.bannedMembers || [],
                channels: group.channels || [],
                joinRequests: group.joinRequests || []
            };
            await groupsCollection.insertOne(newGroup);
            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
        } catch (err) {
            console.error("❌ groups:create failed", err);
        }
    });

    socket.on('groups:delete', async ({ groupId, performedBy, role }) => {
        try{
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;
            if (group.admins.includes(performedBy) || role === 'superAdmin') {
                await groupsCollection.deleteOne({ id: groupId });

                const allGroups = await groupsCollection.find().toArray();
                io.emit('groups:update', allGroups);
            }
        } catch (err) {
            console.error("❌ groups:delete failed", err);
        }
    });

    socket.on('groups:join', async ({ groupId, username }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            if (group.bannedMembers.includes(username)) {
                socket.emit('groups:joinFailed', { groupId, reason: 'banned' });
                return;
            }
            
            if (!group.members.includes(username)) {
                await groupsCollection.updateOne(
                    { id: groupId },
                    { $push: { members: username } }
                );
            }

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
            
        } catch (err) {
            console.error("❌ groups:join failed", err);
        }

    });

    socket.on('groups:promote', async ({ groupId, username }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            if (group.members.includes(username) && !group.admins.includes(username)) {
                await groupsCollection.updateOne(
                    { id: groupId },
                    { $push: { admins: username } }
                );
            }

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);

        } catch (err) {
            console.error("❌ groups:promote failed", err);
        }
    });


    socket.on('users:promote', async ({ username, role, groupId }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            if (role === 'groupAdmin') {
                await groupsCollection.updateOne(
                    { id: groupId },
                    {
                    $pull: { members: username },
                    $addToSet: { admins: username }
                    }
                );
            }

            io.emit('users:roleUpdate', { username, role });
            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);

        } catch (err) {
            console.error("❌ users:promote failed", err);
        }
    });

    socket.on('groups:removeMember', async ({ groupId, username, performedBy, role }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            if (group.admins.includes(performedBy) || role === 'superAdmin') {
            await groupsCollection.updateOne(
                { id: groupId },
                {
                $pull: { members: username, "channels.$[].users": username }
                }
            );

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
            }
        } catch (err) {
            console.error("❌ groups:removeMember failed", err);
        }
    });

    socket.on('groups:ban', async ({ groupId, username, performedBy, role }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            if (group.admins.includes(performedBy) || role === 'superAdmin') {
            await groupsCollection.updateOne(
                { id: groupId },
                {
                $pull: { members: username, "channels.$[].users": username },
                $addToSet: { bannedMembers: username }
                }
            );

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
            }
        } catch (err) {
            console.error("❌ groups:ban failed", err);
        }
    });

    socket.on('channels:create', async ({ groupId, channel, performedBy, role }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            if (group.admins.includes(performedBy) || role === 'superAdmin') {
                await groupsCollection.updateOne(
                    { id: groupId },
                    {
                    $push: {
                        channels: {
                        id: channel.id,
                        name: channel.name,
                        users: channel.users || [],
                        messages: channel.messages || []
                        }
                    }
                    }
                );

                const allGroups = await groupsCollection.find().toArray();
                io.emit('groups:update', allGroups);
            }
        } catch (err) {
            console.error("❌ channels:create failed", err);
        }
    });

    socket.on('channels:delete', async ({ groupId, channelId, performedBy, role }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            if (group.admins.includes(performedBy) || role === 'superAdmin') {
                await groupsCollection.updateOne(
                    { id: groupId },
                    { $pull: { channels: { id: channelId } } }
                );

                const allGroups = await groupsCollection.find().toArray();
                io.emit('groups:update', allGroups);
            }
        } catch (err) {
            console.error("❌ channels:delete failed", err);
        }
    });

    let reports = [];
    socket.on('reports:create', async ({ groupId, member, reportedBy, text }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            if (group.admins.includes(reportedBy)) {
                const report = {
                    id: crypto.randomUUID(),
                    groupId,
                    member,
                    reportedBy,
                    text,
                    timestamp: Date.now()
                };
                reports.push(report);
                io.emit('reports:update', reports);
            }
        } catch (err) {
            console.error("❌ reports:create failed", err);
        }
    });

   socket.on('channels:join', async ({ groupId, channelId, username }) => {
    try {
        socket.username = username;
        
        if (socket.currentChannel) {
            const [oldGroupId, oldChannelId] = socket.currentChannel.split(':');

            await groupsCollection.updateOne(
                { id: oldGroupId, "channels.id": oldChannelId },
                { $pull: { "channels.$.users": username } }
            );

            socket.leave(socket.currentChannel);

            io.to(socket.currentChannel).emit('channels:system', {
                username: 'System',
                text: `${username} left the channel`,
                timestamp: new Date(),
            });
        }

        const room = `${groupId}:${channelId}`;
        socket.currentChannel = room;
        socket.join(room);

        console.log(`✅ ${username} joined channel ${room}`);

        await groupsCollection.updateOne(
            { id: groupId, "channels.id": channelId },
            { $addToSet: { "channels.$.users": username } }
        );

        socket.emit('channels:joined', { groupId, channelId });

        io.to(room).emit('channels:system', {
            username: 'System',
            text: `${username} joined the channel`,
            timestamp: new Date(),
        });

        const existingBroadcasts = activeVideoBroadcasts.get(room) || new Set();
        existingBroadcasts.forEach(broadcast => {
            socket.emit('video:broadcast', {
                peerId: broadcast.peerId,
                username: broadcast.username,
                avatar: broadcast.avatar,
                channelId,
                groupId
            });
        });

        // Notify about existing screenshare
        const existingScreenShare = activeScreenShares.get(room);
        if (existingScreenShare) {
            socket.emit('screenshare:broadcast', {
                peerId: existingScreenShare.peerId,
                username: existingScreenShare.username,
                channelId,
                groupId
            });
        }

        const allGroups = await groupsCollection.find().toArray();
        io.emit('groups:update', allGroups);

    } catch (err) {
        console.error("❌ channels:join failed", err);
    }
});

    socket.on('groups:leave', async ({ groupId, username }) => {
        try {
            await groupsCollection.updateOne(
            { id: groupId },
            {
                $pull: { members: username, "channels.$[].users": username }
            }
            );

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
        } catch (err) {
            console.error("❌ groups:leave failed", err);
        }
    });

    socket.on('channels:leave', async ({ groupId, channelId, username }) => {
        try {
            const room = `${groupId}:${channelId}`;

            socket.leave(room);
            socket.currentChannel = null;

            console.log(`👋 ${username} left channel ${room}`);

            await groupsCollection.updateOne(
                { id: groupId, "channels.id": channelId },
                { $pull: { "channels.$.users": username } }
            );

            io.to(room).emit('channels:system', {
                username: 'System',
                text: `${username} left the channel`,
                timestamp: new Date(),
            });

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);

        } catch (err) {
            console.error("❌ channels:leave failed", err);
        }
    });

    socket.on('channels:message', async ({ groupId, channelId, username, text, avatar, image }) => {
        try {
            const msg = { username, text, avatar, image, timestamp: new Date() };

            await groupsCollection.updateOne(
                { id: groupId, "channels.id": channelId },
                { $push: { "channels.$.messages": msg } }
            );

            console.log(`💬 Message from ${username} in ${groupId}:${channelId}`);

            io.to(`${groupId}:${channelId}`).emit('channels:message', msg);

        } catch (err) {
            console.error("❌ channels:message failed", err);
        }
    });

    socket.on('channels:getMessages', async ({ groupId, channelId }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            const channel = group.channels.find(c => c.id === channelId);
            socket.emit('channels:loadMessages', channel?.messages || []);
        } catch (err) {
            console.error("❌ channels:getMessages failed", err);
        }
    });

    socket.on('groups:requestJoin', async ({ groupId, username }) => {
        try {
            await groupsCollection.updateOne(
                { id: groupId },
                { $addToSet: { joinRequests: username } }
            );

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
        } catch (err) {
            console.error("❌ groups:requestJoin failed", err);
        }
    });

    socket.on('groups:approveJoin', async ({ groupId, username, actingUser }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            await groupsCollection.updateOne(
            { id: groupId },
            {
                $pull: { joinRequests: username },
                $addToSet: { members: username }
            }
            );

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
        } catch (err) {
            console.error("❌ groups:approveJoin failed", err);
        }
    });

    socket.on('groups:declineJoin', async ({ groupId, username, actingUser }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            await groupsCollection.updateOne(
                { id: groupId },
                { $pull: { joinRequests: username } }
            );

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
        } catch (err) {
            console.error("❌ groups:declineJoin failed", err);
        }
    });

    socket.on('users:delete', async (username) => {
        try {
            await usersCollection.deleteOne({ username });

            await groupsCollection.updateMany(
            {},
            {
                $pull: {
                members: username,
                admins: username,
                bannedMembers: username,
                joinRequests: username,
                "channels.$[].users": username
                }
            }
            );

            const allUsers = await usersCollection.find().toArray();
            const allGroups = await groupsCollection.find().toArray();

            io.emit('users:update', allUsers);
            io.emit('groups:update', allGroups);
        } catch (err) {
            console.error("❌ users:delete failed", err);
        }
    });

    socket.on('video:broadcast', async ({ groupId, channelId, username, peerId, avatar }) => {
        const room = `${groupId}:${channelId}`;
        
        if (!socket.rooms.has(room)) {
            socket.join(room);
        }
        
        console.log(`📡 ${username} broadcasting video in ${room} with peer ${peerId}`);
        
        if (!activeVideoBroadcasts.has(room)) {
            activeVideoBroadcasts.set(room, new Set());
        }
        activeVideoBroadcasts.get(room).add({ peerId, username, avatar });
        
        socket.to(room).emit('video:broadcast', { peerId, username, channelId, groupId, avatar });
    });

    socket.on('video:stop', ({ groupId, channelId, username, peerId }) => {
        const room = `${groupId}:${channelId}`;
        console.log(`🛑 ${username} stopped broadcasting in ${room}`);
        
        const broadcasts = activeVideoBroadcasts.get(room);
        if (broadcasts) {
            const toRemove = Array.from(broadcasts).find(b => b.peerId === peerId);
            if (toRemove) {
                broadcasts.delete(toRemove);
            }
            
            if (broadcasts.size === 0) {
                activeVideoBroadcasts.delete(room);
            }
        }
        
        socket.to(room).emit('video:stop', { peerId, username });
    });

    socket.on('screenshare:broadcast', ({ groupId, channelId, username, peerId }) => {
        const room = `${groupId}:${channelId}`;
        
        // Check if someone is already screensharing
        if (activeScreenShares.has(room)) {
            const current = activeScreenShares.get(room);
            socket.emit('screenshare:blocked', { 
                username: current.username 
            });
            return;
        }
        
        console.log(`📺 ${username} started screensharing in ${room} with peer ${peerId}`);
        
        activeScreenShares.set(room, { peerId, username });
        
        io.to(room).emit('screenshare:broadcast', { peerId, username, channelId, groupId });
    });

    
    socket.on('screenshare:stop', ({ groupId, channelId, username, peerId }) => {
        const room = `${groupId}:${channelId}`;
        console.log(`🛑 ${username} stopped screensharing in ${room}`);
        
        const current = activeScreenShares.get(room);
        if (current && current.peerId === peerId) {
            activeScreenShares.delete(room);
        }
        
        io.to(room).emit('screenshare:stop', { peerId, username });
    });
    
});

server.listen(PORT, async () => {
  await connectDB();
  console.log(`Server running on port ${PORT}`);
  console.log(`✅ PeerJS available at http://localhost:${PORT}/peerjs`);
});