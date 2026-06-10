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
        } else if (numClients === 2) {
            socket.emit('playerRole', 'b');
            io.to(roomId).emit('gameStart'); // Dono player aane par game shuru[span_0](start_span)[span_0](end_span)
        }
    });

    socket.on('move', (move) => {
        // Move ko dusre player tak pahunchana[span_1](start_span)[span_1](end_span)
        if (socket.roomId) {
            socket.to(socket.roomId).emit('move', move);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    
