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
        groups.push(group); // store in memory or DB
        io.emit('groups:update', groups); // broadcast to all clients
    });

    socket.on('groups:delete', (groupId) => {
        groups = groups.filter(g => g.id !== groupId);
        io.emit('groups:update', groups);
    });

    socket.on('groups:join', ({ groupId, username }) => {
        const group = groups.find(g => g.id === groupId);
        if (group && !group.members.includes(username)) {
            group.members.push(username);
            io.emit('groups:update', groups);
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

    socket.on('groups:removeMember', ({ groupId, username }) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        // Remove from members list
        group.members = group.members.filter(m => m !== username);

        io.emit('groups:update', groups);  // broadcast update
    }
    });

});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});