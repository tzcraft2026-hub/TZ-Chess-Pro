const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Static files ko load karne ke liye important line
app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    // 1. JOIN ROOM LOGIC (With Max 2 Players Limit Lock)
    socket.on('joinRoom', (roomId) => {
        const clients = io.sockets.adapter.rooms.get(roomId);
        const numClients = clients ? clients.size : 0;

        // Agar room mein pehle se 2 log hain, toh teesre ko rok do
        if (numClients >= 2) {
            socket.emit('roomFull', roomId);
            return;
        }

        socket.join(roomId);
        socket.roomId = roomId;

        if (numClients === 0) {
            socket.emit('playerRole', 'w'); // Pehla player White
        } else if (numClients === 1) {
            socket.emit('playerRole', 'b'); // Dusra player Black
            io.to(roomId).emit('gameStart'); // Dono player aane par game shuru
        }
    });

    // 2. MOVE TRANSFER LOGIC
    socket.on('move', (move) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('move', move);
        }
    });

    // 3. RESTART MATCH SYSTEM
    // Ek player jab restart ki request bhejega
    socket.on('requestRestart', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('receiveRestartRequest');
        }
    });

    // Jab samne wala restart accept karega
    socket.on('acceptRestart', () => {
        if (socket.roomId) {
            io.to(socket.roomId).emit('restartAccepted');
        }
    });

    // Jab samne wala restart decline (reject) karega
    socket.on('declineRestart', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('restartDeclined');
        }
    });

    // 4. LEAVE ROOM / EXIT BUTTON HANDLING
    socket.on('leaveCurrentRoom', () => {
        handlePlayerExit(socket);
    });

    // 5. DISCONNECT HANDLING (Tab band karne ya network jane par)
    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        handlePlayerExit(socket);
    });
});

// Helper function jo ek player ke jane par dusre ko automatic jita deta hai
function handlePlayerExit(socket) {
    if (socket.roomId) {
        const roomId = socket.roomId;
        socket.leave(roomId);
        socket.roomId = null;

        // Samne wale player ko notify karo ki opponent chala gaya hai
        io.to(roomId).emit('opponentDisconnected');
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
