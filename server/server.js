const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());

const server = http.createServer(app);
const options = {cors:{
    origin: "*",
    methods: ["GET", "POST"],
}}
const io = require('socket.io')(server, options);
let users = [];
let groups = [];

io.on('connection', (socket) => {

    socket.on('groups:getAll', () => {
        socket.emit('groups:update', groups);
    });

    socket.on('newmsg', (message) => {
        io.emit('newmsg', message);
    })
    socket.on('disconnect', () => {
    });

    socket.on('groups:create', (group) => {
    const newGroup = {
        ...group,
        admins: group.admins || [],
        members: group.members || [],
        bannedMembers: group.bannedMembers || [],
        channels: group.channels || [],
        joinRequests: group.joinRequests || []
    };
    groups.push(newGroup);
    io.emit('groups:update', groups);
    });

    socket.on('groups:delete', ({ groupId, performedBy, role }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        // ✅ Allow if user is group admin OR super admin
        if (group.admins.includes(performedBy) || role === 'superAdmin') {
        groups = groups.filter(g => g.id !== groupId);
        io.emit('groups:update', groups);
        }
    }
    });

    socket.on('groups:join', ({ groupId, username }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        if (group.bannedMembers.includes(username)) {
        socket.emit('groups:joinFailed', { groupId, reason: 'banned' });
        return;
        }

        if (!group.members.includes(username)) {
        group.members.push(username);
        io.emit('groups:update', groups);
        }
    }
    });

    socket.on('groups:promote', ({ groupId, username }) => {
        const group = groups.find(g => g.id === groupId);
        if (group) {
            // make sure user is a member first
            if (group.members.includes(username) && !group.admins.includes(username)) {
            group.admins.push(username);
            io.emit('groups:update', groups);  // broadcast to all clients
            }
        }
    });

    socket.on('users:promote', ({ username, role, groupId }) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (role === 'groupAdmin') {
        // Remove from members if exists
        group.members = group.members.filter(m => m !== username);

        // Add to admins if not already
        if (!group.admins.includes(username)) {
        group.admins.push(username);
        }
    }

    io.emit('users:roleUpdate', { username, role });
    io.emit('groups:update', groups);
    });

    socket.on('groups:removeMember', ({ groupId, username, performedBy, role }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        if (group.admins.includes(performedBy) || role === 'superAdmin') {
        // ✅ Remove from group members
        group.members = group.members.filter(m => m !== username);

        // ✅ Also remove from all channels of this group
        if (group.channels) {
            group.channels.forEach(channel => {
            channel.users = channel.users.filter(u => u !== username);
            });
        }

        io.emit('groups:update', groups);
        }
    }
    });


    socket.on('groups:ban', ({ groupId, username, performedBy, role }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        if (group.admins.includes(performedBy) || role === 'superAdmin') {
        // ✅ Remove from group members
        group.members = group.members.filter(m => m !== username);

        // ✅ Also remove from all channels of this group
        if (group.channels) {
            group.channels.forEach(channel => {
            channel.users = channel.users.filter(u => u !== username);
            });
        }

        // ✅ Add to banned list
        group.bannedMembers = group.bannedMembers || [];
        if (!group.bannedMembers.includes(username)) {
            group.bannedMembers.push(username);
        }

        io.emit('groups:update', groups);
        }
    }
    });


    socket.on('channels:create', ({ groupId, channel, performedBy, role }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        // Only group admins or super admins can create channels
        if (group.admins.includes(performedBy) || role === 'superAdmin') {
        group.channels = group.channels || [];
        group.channels.push({
            id: channel.id,
            name: channel.name,
            users: channel.users || [],
            messages: channel.messages || []
        });
        io.emit('groups:update', groups);
        }
    }
    });

    socket.on('channels:delete', ({ groupId, channelId, performedBy, role }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        if (group.admins.includes(performedBy) || role === 'superAdmin') {
        group.channels = group.channels.filter(c => c.id !== channelId);
        io.emit('groups:update', groups);
        }
    }
    });

    let reports = []; // store all reports in memory for now

    socket.on('reports:create', ({ groupId, member, reportedBy, text }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        // Ensure only group admins or super admins can report
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

        // Send reports to super admins only
        io.emit('reports:update', reports);
        }
    }
    });

    // Track which channel each socket is in
    socket.currentChannel = null;

    socket.on('channels:join', ({ groupId, channelId, username }) => {
        if (socket.currentChannel) {
            const [oldGroupId, oldChannelId] = socket.currentChannel.split(':');
            const oldGroup = groups.find(g => g.id === oldGroupId);
            if (oldGroup) {
                const oldChannel = oldGroup.channels.find(c => c.id === oldChannelId);
                if (oldChannel && oldChannel.users) {
                    oldChannel.users = oldChannel.users.filter(u => u !== username);
                }
            }
            socket.leave(socket.currentChannel);
        }

        socket.currentChannel = `${groupId}:${channelId}`;
        socket.join(socket.currentChannel);

        // Update group object in memory
        const group = groups.find(g => g.id === groupId);
        if (group) {
            const channel = group.channels.find(c => c.id === channelId);
            if (channel) {
                if (!channel.users) channel.users = [];
                if (!channel.users.includes(username)) {
                    channel.users.push(username);
                }
            }
        }

        // Broadcast updated groups to everyone (so dashboards update)
        io.emit('groups:update', groups);

        // Send system message into channel
        io.to(socket.currentChannel).emit('channels:system', {
            username: 'System',
            text: `${username} joined the channel`,
            timestamp: new Date(),
        });
    });

    socket.on('groups:leave', ({ groupId, username }) => {
        const group = groups.find(g => g.id === groupId);
        if (group) {
            // Remove from group members
            group.members = group.members.filter(m => m !== username);

            // Also remove from channels
            if (group.channels) {
            group.channels.forEach(channel => {
                channel.users = channel.users.filter(u => u !== username);
            });
            }

            io.emit('groups:update', groups);
        }
    });

    socket.on('channels:leave', ({ groupId, channelId, username }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        const channel = group.channels.find(c => c.id === channelId);
        if (channel && channel.users) {
        channel.users = channel.users.filter(u => u !== username);
        }
    }

    socket.leave(`${groupId}:${channelId}`);
    socket.currentChannel = null;

    // notify all dashboards
    io.emit('groups:update', groups);
    });

    socket.on('channels:message', ({ groupId, channelId, username, text }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        const channel = group.channels.find(c => c.id === channelId);
        if (channel) {
        const msg = { username, text, timestamp: new Date() };
        if (!channel.messages) channel.messages = [];
        channel.messages.push(msg);

        // broadcast to channel
        io.to(`${groupId}:${channelId}`).emit('channels:message', msg);

        // broadcast groups:update so dashboards see latest messages
        io.emit('groups:update', groups);
        }
    }
    });

    socket.on('channels:getMessages', ({ groupId, channelId }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        const channel = group.channels.find(c => c.id === channelId);
        if (channel) {
        socket.emit('channels:loadMessages', channel.messages || []);
        }
    }
    });

    socket.on('groups:requestJoin', ({ groupId, username }) => {
        const group = groups.find(g => g.id === groupId);
        if (group && !group.joinRequests.includes(username)) {
            group.joinRequests.push(username);
            io.emit('groups:update', groups); // broadcast updated state
        }
    });

    socket.on('groups:approveJoin', ({ groupId, username, actingUser }) => {
        const group = groups.find(g => g.id === groupId);
        const isSuper = users.find(u => u.username === actingUser)?.roles.includes('superAdmin');
        const isAdmin = group?.admins.includes(actingUser);

        if (group && (isSuper || isAdmin)) {
            // ✅ authorized
            group.members.push(username);
            group.joinRequests = group.joinRequests.filter(r => r !== username);
            io.emit('groups:update', groups);
        }
    });

    socket.on('groups:declineJoin', ({ groupId, username, actingUser }) => {
        const group = groups.find(g => g.id === groupId);
        const isSuper = users.find(u => u.username === actingUser)?.roles.includes('superAdmin');
        const isAdmin = group?.admins.includes(actingUser);

        if (group && (isSuper || isAdmin)) {
            // ✅ authorized
            group.joinRequests = group.joinRequests.filter(r => r !== username);
            io.emit('groups:update', groups);
        }
    });

    socket.on('users:delete', (username) => {
        // Remove user globally
        users = users.filter(u => u.username !== username);

        // Remove them from all groups
        groups.forEach(group => {
            group.members = (group.members || []).filter(m => m !== username);
            group.admins = (group.admins || []).filter(a => a !== username);
            group.bannedMembers = (group.bannedMembers || []).filter(b => b !== username);
            group.joinRequests = (group.joinRequests || []).filter(r => r !== username);

            if (group.channels) {
            group.channels.forEach(channel => {
                channel.users = (channel.users || []).filter(u => u !== username);
            });
            }
        });

        // Emit updates
        io.emit('users:update', users);
        io.emit('groups:update', groups);
    });


});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});