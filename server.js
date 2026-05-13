const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.on('joinRoom', (room) => {
        socket.join(room);
        const clients = io.sockets.adapter.rooms.get(room);
        const numClients = clients ? clients.size : 0;

        // Jo pehle join karega wo White ('w'), jo doosra wo Black ('b')
        let role = (numClients === 1) ? 'w' : 'b';
        socket.emit('playerRole', role);

        if (numClients === 2) {
            io.to(room).emit('gameStart', "Match Shuru!");
        }
    });

    socket.on('move', (data) => {
        socket.to(data.room).emit('opponentMove', data.move);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
