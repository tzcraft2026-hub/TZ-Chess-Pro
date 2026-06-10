const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId;

        const clients = io.sockets.adapter.rooms.get(roomId);
        const numClients = clients ? clients.size : 0;

        if (numClients === 1) {
            socket.emit('playerRole', 'w');
            socket.playerColor = 'w';
        } else if (numClients === 2) {
            socket.emit('playerRole', 'b');
            socket.playerColor = 'b';
            io.to(roomId).emit('gameStart'); 
        }
    });

    socket.on('move', (move) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('move', move);
        }
    });

    // Handle online features synchronization triggers
    socket.on('requestUndo', (roomId) => {
        if(socket.roomId) socket.to(socket.roomId).emit('requestUndo');
    });
    socket.on('requestRestart', (roomId) => {
        if(socket.roomId) socket.to(socket.roomId).emit('requestRestart');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        const roomId = socket.roomId;
        if (roomId) {
            const clients = io.sockets.adapter.rooms.get(roomId);
            const numClients = clients ? clients.size : 0;

            if (numClients === 1) {
                // 🔥 "Opponent Left" logic push transmission channel 
                io.to(roomId).emit('opponentDisconnected', {
                    msg: "Opponent left the match"
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
                    
