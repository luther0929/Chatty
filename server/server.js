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

let groups = [];

io.on('connection', (socket) => {
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
        channels: group.channels || []
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
        group.members = group.members.filter(m => m !== username);
        io.emit('groups:update', groups);
        }
    }
    });

    socket.on('groups:ban', ({ groupId, username, performedBy, role }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        if (group.admins.includes(performedBy) || role === 'superAdmin') {
        group.members = group.members.filter(m => m !== username);

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
            users: channel.users || []
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

});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});