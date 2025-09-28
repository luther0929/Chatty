const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require("crypto");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
const { MongoClient } = require('mongodb');
const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);
let db, usersCollection, groupsCollection, messagesCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("chatApp"); // database name
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
const options = {cors:{
    origin: "*",
    methods: ["GET", "POST"],
}}
const io = require('socket.io')(server, options);

// REST API routes

// Get all groups
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await groupsCollection.find().toArray();
    res.json(groups);
  } catch (err) {
    console.error("❌ GET /api/groups failed", err);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Get single group by ID
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

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users);
  } catch (err) {
    console.error("❌ GET /api/users failed", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get all messages for a group channel
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

// Register new user
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // check uniqueness
    const existing = await usersCollection.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const newUser = {
      id: crypto.randomUUID(),
      username,
      email,
      password,
      roles: ["chatUser"], // default role
      groups: []
    };

    await usersCollection.insertOne(newUser);
    res.status(201).json(newUser);
  } catch (err) {
    console.error("❌ register failed", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Login
app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await usersCollection.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json(user);
  } catch (err) {
    console.error("❌ login failed", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

// Ensure a default super user exists
async function ensureSuperUser() {
  const superUser = await usersCollection.findOne({ username: "super" });
  if (!superUser) {
    await usersCollection.insertOne({
      id: crypto.randomUUID(),
      username: "super",
      email: "super@example.com",
      password: "123",   // 🔑 login with this password
      roles: ["superAdmin"],
      groups: []
    });
    console.log("✅ Default super user created: username=super, password=123");
  } else {
    console.log("ℹ️ Super user already exists");
  }
}

io.on('connection', (socket) => {

    socket.on('groups:getAll', async () => {
        const allGroups = await groupsCollection.find().toArray();
        socket.emit('groups:update', allGroups);
    });

    socket.on('newmsg', (message) => {
        io.emit('newmsg', message);
    })
    socket.on('disconnect', () => {
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
            // ✅ Allow if user is group admin OR super admin
            if (group.admins.includes(performedBy) || role === 'superAdmin') {
                await groupsCollection.deleteOne({ id: groupId });

                const allGroups = await groupsCollection.find().toArray();
                io.emit('groups:update', allGroups);  // broadcast updated list
            }
        } catch (err) {
            console.error("❌ groups:delete failed", err);
        }
    });

    socket.on('groups:join', async ({ groupId, username }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            // user is banned
            if (group.bannedMembers.includes(username)) {
                socket.emit('groups:joinFailed', { groupId, reason: 'banned' });
                return;
            }
            
            // add user if not already a member
            if (!group.members.includes(username)) {
                await groupsCollection.updateOne(
                    { id: groupId },
                    { $push: { members: username } }
                );
            }

            // broadcast updated state to all clients
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

            // Only promote if user is already a member and not already an admin
            if (group.members.includes(username) && !group.admins.includes(username)) {
                await groupsCollection.updateOne(
                    { id: groupId },
                    { $push: { admins: username } }
                );
            }

            // Broadcast updated groups to everyone
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
                    $pull: { members: username },   // remove from members
                    $addToSet: { admins: username } // ensure in admins (no dupes)
                    }
                );
            }

            // broadcast role change + updated groups
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

            // Only allow if performedBy is group admin OR superAdmin
            if (group.admins.includes(performedBy) || role === 'superAdmin') {
            // 1. Remove from members
            // 2. Remove from all channels inside this group
            await groupsCollection.updateOne(
                { id: groupId },
                {
                $pull: { members: username, "channels.$[].users": username }
                }
            );

            // Broadcast updated groups to all clients
            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
            }
        } catch (err) {
            console.error("❌ groups:removeMember failed", err);
        }
    });

    // 🚫 Ban user from group
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

    // ➕ Create channel
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

    // 🗑 Delete channel
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

    // 📝 Reports (still in-memory or you can persist to Mongo)
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


    // 👥 Join channel
    socket.on('channels:join', async ({ groupId, channelId, username }) => {
        try {
            await groupsCollection.updateOne(
                { id: groupId, "channels.id": channelId },
                { $addToSet: { "channels.$.users": username } }
            );

            socket.currentChannel = `${groupId}:${channelId}`;
            socket.join(socket.currentChannel);

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);

            io.to(socket.currentChannel).emit('channels:system', {
                username: 'System',
                text: `${username} joined the channel`,
                timestamp: new Date(),
            });
        } catch (err) {
            console.error("❌ channels:join failed", err);
        }
    });

    // 🚪 Leave group
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

    // 🚪 Leave channel
    socket.on('channels:leave', async ({ groupId, channelId, username }) => {
        try {
            await groupsCollection.updateOne(
                { id: groupId, "channels.id": channelId },
                { $pull: { "channels.$.users": username } }
            );

            socket.leave(`${groupId}:${channelId}`);
            socket.currentChannel = null;

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
        } catch (err) {
            console.error("❌ channels:leave failed", err);
        }
    });

    // 💬 Send message
    socket.on('channels:message', async ({ groupId, channelId, username, text }) => {
        try {
            const msg = { username, text, timestamp: new Date() };

            await groupsCollection.updateOne(
                { id: groupId, "channels.id": channelId },
                { $push: { "channels.$.messages": msg } }
            );

            io.to(`${groupId}:${channelId}`).emit('channels:message', msg);

            const allGroups = await groupsCollection.find().toArray();
            io.emit('groups:update', allGroups);
        } catch (err) {
            console.error("❌ channels:message failed", err);
        }
    });

    // 📜 Get messages
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

    // 🙋 Request join
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

    // ✅ Approve join
    socket.on('groups:approveJoin', async ({ groupId, username, actingUser }) => {
        try {
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) return;

            // TODO: add role check (super or group admin)
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

    // ❌ Decline join
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

    // 🗑 Delete user globally
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
});

server.listen(PORT, async () => {
  await connectDB();
  console.log(`Server running on port ${PORT}`);
});
