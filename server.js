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

    // JOINING ROOM STRUCT
    socket.on('joinRoom', (roomId) => {
        const clients = io.sockets.adapter.rooms.get(roomId);
        const numClients = clients ? clients.size : 0;

        if (numClients >= 2) {
            socket.emit('roomFull', roomId);
            return;
        }

        socket.join(roomId);
        socket.roomId = roomId;

        if (numClients === 0) {
            socket.emit('playerRole', 'w'); 
        } else if (numClients === 1) {
            socket.emit('playerRole', 'b'); 
            io.to(roomId).emit('gameStart'); 
        }
    });

    // TRANSMITTING MOVE BLOCKS
    socket.on('move', (move) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('move', move);
        }
    });

    // 🔥 BACKEND SIGNAL: Syncing Device Request Protocols
    socket.on('requestRestart', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('receiveRestartRequest');
        }
    });

    socket.on('acceptRestart', () => {
        if (socket.roomId) {
            io.to(socket.roomId).emit('restartAccepted');
        }
    });

    socket.on('declineRestart', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('restartDeclined');
        }
    });

    // SAFELY REMOVING SESSIONS ON LEAVE/DISCONNECT
    socket.on('leaveCurrentRoom', () => {
        handlePlayerExit(socket);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        handlePlayerExit(socket);
    });
});

function handlePlayerExit(socket) {
    if (socket.roomId) {
        const roomId = socket.roomId;
        socket.leave(roomId);
        socket.roomId = null;
        io.to(roomId).emit('opponentDisconnected');
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
