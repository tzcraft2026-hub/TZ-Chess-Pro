const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Aapki frontend chess website ko connect karne ke liye
        methods: ["GET", "POST"]
    }
});

// 👥 Active online chess rooms tracker (Sirf dynamic rooms manage honge)
let rooms = {}; 

// Base route server status check karne ke liye
app.get('/', (req, res) => {
    res.send('TZ Chess Pro - FRESH High-Speed Server is Live! 🚀');
});

// ===================================================
// 📡 REALTIME WEB-SOCKET MULTIPLAYER ENGINE
// ===================================================
io.on('connection', (socket) => {
    console.log(`[👤 Connected]: New player connected with Session ID -> ${socket.id}`);

    // ---------------------------------------------------
    // 👥 MULTIPLAYER CHESS LOBBY MANAGEMENT (DIRECT JOIN)
    // ---------------------------------------------------
    socket.on('joinRoom', (roomId) => {
        roomId = roomId.trim();
        socket.currentRoom = roomId;

        if (!rooms[roomId]) {
            // Agar room nahi bana hai, toh naya banao aur pehle player ko White (w) allot karo
            rooms[roomId] = [socket.id];
            socket.join(roomId);
            socket.emit('playerRole', 'w');
            console.log(`[🏠 Room Created]: Room ID "${roomId}" created by Player (White) -> ${socket.id}`);
        } else if (rooms[roomId].length === 1) {
            // Agar room me ek player pehle se hai, toh doosre ko join karwao aur Black (b) allot karo
            rooms[roomId].push(socket.id);
            socket.join(roomId);
            socket.emit('playerRole', 'b');
            console.log(`[⚔️ Matchmaking Complete]: Player (Black) -> ${socket.id} joined Room -> ${roomId}`);
            
            // Dono players ko game start ka signal bhej do
            io.to(roomId).emit('gameStart');
        } else {
            // Agar room pehle se full hai (max 2 players allowed)
            socket.emit('statusMessage', 'Room is completely full!');
            console.log(`[🚫 Access Denied]: Room "${roomId}" is already full.`);
        }
    });

    // Chess pieces ki move transmit karne ka pipeline
    socket.on('move', (moveData) => {
        if (socket.currentRoom) {
            // Apne samne wale opponent player ko move pass on karo
            socket.to(socket.currentRoom).emit('move', moveData);
        }
    });

    // Match Restart Requests Matrix
    socket.on('requestRestart', () => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('receiveRestartRequest');
        }
    });

    socket.on('acceptRestart', () => {
        if (socket.currentRoom) {
            io.to(socket.currentRoom).emit('restartAccepted');
        }
    });

    socket.on('declineRestart', () => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('restartDeclined');
        }
    });

    // ---------------------------------------------------
    // 🚪 DISCONNECT & CLEAN UP FILTERS
    // ---------------------------------------------------
    function handleUserLeavingLobby() {
        const roomId = socket.currentRoom;
        if (roomId && rooms[roomId]) {
            console.log(`[🏃 Player Left]: User ${socket.id} left Room -> ${roomId}`);
            
            // Saamne wale player ko notify karo ki opponent chala gaya
            socket.to(roomId).emit('opponentDisconnected');
            
            // Array se player ko saaf karo
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
            
            // Agar room mein koi nahi bacha, toh memory se room delete karo
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
                console.log(`[🗑️ Room Destroyed]: Empty registry clean up done for -> ${roomId}`);
            }
            socket.leave(roomId);
            socket.currentRoom = null;
        }
    }

    socket.on('leaveCurrentRoom', () => {
        handleUserLeavingLobby();
    });

    socket.on('disconnect', () => {
        console.log(`[🔌 Disconnected]: Session ended for Client ID -> ${socket.id}`);
        handleUserLeavingLobby();
    });
});

// ===================================================
// ⚡ PORT ALLOCATION SYSTEM ENGINE
// ===================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 FRESH TZ FAST-SERVER IS LIVE ON PORT: ${PORT}`);
    console.log(`=================================================\n`);
});
        
