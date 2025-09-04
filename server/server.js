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

io.on('connection', (socket) => {
    socket.on('newmsg', (message) => {
        io.emit('newmsg', message);
    })
    socket.on('disconnect', () => {
        io.emit('disconnect');
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});