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

    // 🔥 1. RESTART REQUEST: Sender bhejega, Server opponent ko transfer karega
    socket.on('requestRestart', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('receiveRestartRequest');
        }
    });

    // 🔥 2. RESTART ACCEPTED: Opponent ne 'RESTART' click kiya
    socket.on('acceptRestart', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('restartAccepted');
        }
    });

    // 🔥 3. RESTART DECLINED: Opponent ne 'NO' click kiya
    socket.on('declineRestart', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('restartDeclined');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        const roomId = socket.roomId;
        if (roomId) {
            const clients = io.sockets.adapter.rooms.get(roomId);
            const numClients = clients ? clients.size : 0;

            if (numClients === 1) {
                io.to(roomId).emit('opponentDisconnected', {
                    msg: "Opponent left the match"
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
                
