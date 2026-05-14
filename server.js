const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId; // Room track karne ke liye

        const clients = io.sockets.adapter.rooms.get(roomId);
        const numClients = clients ? clients.size : 0;

        if (numClients === 1) {
            socket.emit('playerRole', 'w');
        } else if (numClients === 2) {
            socket.emit('playerRole', 'b');
            io.to(roomId).emit('gameStart'); // Dono ko batana ki game shuru hai[span_3](start_span)[span_3](end_span)
        }
    });

    socket.on('move', (move) => {
        // Yeh line Browser B ko move bhejti hai[span_4](start_span)[span_4](end_span)
        if (socket.roomId) {
            socket.to(socket.roomId).emit('move', move);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(3000, () => console.log('Server running on port 3000'));

