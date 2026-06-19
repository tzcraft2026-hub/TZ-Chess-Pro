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
// server.js mein add karein

const CURRENT_VERSION = "1.1.0"; // Jab bhi naya update nikalna ho, yahan version badal dena (e.g., 1.2.0)

app.get('/api/check-update', (req, res) => {
    res.json({ 
        version: CURRENT_VERSION,
        updateUrl: "https://tz-craft.blogspot.com" // Yahan apni website ya download link daal sakte ho
    });
});


io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    // JOINING ROOM STRUCT
    socket.on('joinRoom', (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        const numClients = room ? room.size : 0;

        if (numClients >= 2) {
            socket.emit('roomFull', roomId);
            return;
        }

        socket.join(roomId);
        socket.roomId = roomId;

        if (numClients === 0) {
            // Jab pehla player aayega, abhi role hold par rakhenge jab tak doosra na aa jaye
            console.log(`Player 1 (${socket.id}) joined room: ${roomId}. Waiting for opponent to flip coin...`);
        } else if (numClients === 1) {
            // Doosra player aa gaya! Ab pure 50-50% chance ke sath randomly coin flip karo
            const playerIds = Array.from(room); // Dono players ki IDs nikal li
            const isFirstPlayerWhite = Math.random() < 0.5;

            if (isFirstPlayerWhite) {
                io.to(playerIds[0]).emit('playerRole', 'w'); // Pehle join karne wale ko White
                io.to(playerIds[1]).emit('playerRole', 'b'); // Dusre join karne wale ko Black
            } else {
                io.to(playerIds[0]).emit('playerRole', 'b'); // Pehle join karne wale ko Black
                io.to(playerIds[1]).emit('playerRole', 'w'); // Dusre join karne wale ko White
            }

            // Game start signal trigger karo
            io.to(roomId).emit('gameStart'); 
        }
    });

    // TRANSMITTING MOVE BLOCKS
    socket.on('move', (move) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('move', move);
        }
    });

    // BACKEND SIGNAL: Syncing Device Request Protocols
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

        const remainingClients = io.sockets.adapter.rooms.get(roomId);
        if (!remainingClients || remainingClients.size === 0) {
            io.sockets.adapter.rooms.delete(roomId);
            console.log(`Room ${roomId} is now completely empty and deleted.`);
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
              
