const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// 🔥 FIX 1: CORS Policy bypass lagaya taaki har naye device me website turant connect ho
const io = new Server(server, {
    cors: {
        origin: "*", // Yeh website aur app dono ko bina block kiye allow karega
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    socket.on('joinRoom', (roomId) => {
        // Pehle se agar koi room joda ho toh use saaf karo
        if(socket.roomId) {
            socket.leave(socket.roomId);
        }

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

    socket.on('requestRestart', () => {
        if (socket.roomId) socket.to(socket.roomId).emit('receiveRestartRequest');
    });

    socket.on('acceptRestart', () => {
        if (socket.roomId) socket.to(socket.roomId).emit('restartAccepted');
    });

    socket.on('declineRestart', () => {
        if (socket.roomId) socket.to(socket.roomId).emit('restartDeclined');
    });

    // 🔥 FIX 3: Room se completely nikalne ke liye custom leave trigger
    socket.on('leaveCurrentRoom', () => {
        const roomId = socket.roomId;
        if (roomId) {
            socket.leave(roomId);
            socket.to(roomId).emit('opponentDisconnected', { msg: "Opponent Left" });
            socket.roomId = null;
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        const roomId = socket.roomId;
        if (roomId) {
            const clients = io.sockets.adapter.rooms.get(roomId);
            const numClients = clients ? clients.size : 0;
            
            // Agar koi bacha hai toh use jeeta do
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
