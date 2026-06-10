const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sabse important line jo files ko load karegi
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
            socket.playerColor = 'w'; // Future verification ke liye color attach kiya
        } else if (numClients === 2) {
            socket.emit('playerRole', 'b');
            socket.playerColor = 'b'; // Future verification ke liye color attach kiya
            io.to(roomId).emit('gameStart'); // Dono player aane par game shuru
        }
    });

    socket.on('move', (move) => {
        // Move ko dusre player tak pahunchana
        if (socket.roomId) {
            socket.to(socket.roomId).emit('move', move);
        }
    });

    // 🔥 ABSOLUTE ANTI-CHEAT & DISCONNECT DETECTOR
    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        
        const roomId = socket.roomId;
        if (roomId) {
            // Check karo ki kya us room me abhi bhi koi bacha hai
            const clients = io.sockets.adapter.rooms.get(roomId);
            const numClients = clients ? clients.size : 0;

            // Agar room bacha hua hai aur usme abhi bhi strictly 1 player online hai
            if (numClients === 1) {
                // Bache hue player ko notification bhej do ki saamne wala bhag gaya
                io.to(roomId).emit('opponentDisconnected', {
                    msg: "Opponent left the match"
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
