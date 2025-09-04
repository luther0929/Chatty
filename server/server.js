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
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});