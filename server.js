const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs'); // ✅ Naya module: Files save karne ke liye
const path = require('path');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// ===================================================
// 💾 PERMANENT LOCAL FILE DATABASE SYSTEM
// ===================================================
const dbFilePath = path.join(__dirname, 'users.json');
let serverUsersDB = {}; 
let rooms = {}; // Active online chess rooms tracker

// 📁 File se purana data load karne ka system
function loadUserDataFromLocalFile() {
    try {
        if (fs.existsSync(dbFilePath)) {
            const fileData = fs.readFileSync(dbFilePath, 'utf8');
            serverUsersDB = JSON.parse(fileData);
            console.log(`[📦 Database Loaded]: Total ${Object.keys(serverUsersDB).length} accounts loaded safely from file.`);
        } else {
            // Agar file nahi bani hai, toh khali file bana do
            fs.writeFileSync(dbFilePath, JSON.stringify({}), 'utf8');
            console.log(`[📝 Database Created]: Fresh users.json file generated.`);
        }
    } catch (error) {
        console.log(`[⚠️ Database Load Error]: `, error);
    }
}

// 💾 Naya account banne par file me save karne ka system
function saveUserDataToLocalFile() {
    try {
        fs.writeFileSync(dbFilePath, JSON.stringify(serverUsersDB, null, 2), 'utf8');
        console.log(`[💾 Database Synced]: Account matrix written to disk.`);
    } catch (error) {
        console.log(`[⚠️ Database Save Error]: `, error);
    }
}

// Initialize and Boot Database on startup
loadUserDataFromLocalFile();


// Base route testing ke liye
app.get('/', (req, res) => {
    res.send('TZ Chess Pro Engine Server is Running Successfully! 🚀');
});

// ===================================================
// 📡 REALTIME WEB-SOCKET LOBBY MANAGEMENT
// ===================================================
io.on('connection', (socket) => {
    console.log(`[👤 Connection Created]: User Connected with ID -> ${socket.id}`);

    // ---------------------------------------------------
    // 🔥 1. SIGN UP/REGISTER EVENT HANDLER
    // ---------------------------------------------------
    socket.on('serverRegisterUser', (data) => {
        const username = data.username ? data.username.trim() : "";
        const password = data.password;

        if (!username || !password) {
            socket.emit('authResponse', { success: false, message: "Invalid Form Fields Data!" });
            return;
        }

        // Global server check validation (Baar-baar same name se naya account lock out rahega)
        if (serverUsersDB[username] !== undefined) {
            socket.emit('authResponse', { success: false, message: "This username is already taken on TZ Server!" });
            console.log(`[🚫 Signup Blocked]: Duplicate entry attempt for -> ${username}`);
        } else {
            // Memory matrix ke sath-sath file database me lock karega permanent!
            serverUsersDB[username] = password;
            saveUserDataToLocalFile(); // ✅ Instant disk sync write
            
            console.log(`[🔐 Account Created]: Successfully registered user -> ${username}`);
            socket.emit('authResponse', { success: true, username: username });
        }
    });

    // ---------------------------------------------------
    // 🔥 2. LOG IN EVENT HANDLER
    // ---------------------------------------------------
    socket.on('serverLoginUser', (data) => {
        const username = data.username ? data.username.trim() : "";
        const password = data.password;

        if (serverUsersDB[username] !== undefined && serverUsersDB[username] === password) {
            console.log(`[🔓 Logged In]: Identity verified for -> ${username}`);
            socket.emit('loginResponse', { success: true, username: username });
        } else {
            socket.emit('loginResponse', { success: false, message: "Invalid Username or Password!" });
            console.log(`[⚠️ Login Failed]: Invalid credentials attempt for -> ${username}`);
        }
    });

    // ---------------------------------------------------
    // 👥 3. MULTIPLAYER CHESS LOBBY MANAGEMENT
    // ---------------------------------------------------
    socket.on('joinRoom', (roomId) => {
        roomId = roomId.trim();
        socket.currentRoom = roomId;

        if (!rooms[roomId]) {
            rooms[roomId] = [socket.id];
            socket.join(roomId);
            socket.emit('playerRole', 'w');
            console.log(`[🏠 Room Created]: ${roomId} by Player (White) -> ${socket.id}`);
        } else if (rooms[roomId].length === 1) {
            rooms[roomId].push(socket.id);
            socket.join(roomId);
            socket.emit('playerRole', 'b');
            console.log(`[⚔️ Matchmaking Complete]: Player (Black) -> ${socket.id} joined Room -> ${roomId}`);
            io.to(roomId).emit('gameStart');
        } else {
            socket.emit('statusMessage', 'Room is completely full!');
            console.log(`[🚫 Room Full Alert]: Access denied on Room -> ${roomId} for -> ${socket.id}`);
        }
    });

    socket.on('move', (moveData) => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('move', moveData);
        }
    });

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
            io.to(socket.currentRoom).emit('restartDeclined');
        }
    });

    // ---------------------------------------------------
    // 🚪 4. DISCONNECT & LEAVE ROOM CONTROL FILTERS
    // ---------------------------------------------------
    function handleUserLeavingLobby() {
        const roomId = socket.currentRoom;
        if (roomId && rooms[roomId]) {
            console.log(`[🏃 Player Left]: User ${socket.id} left Room -> ${roomId}`);
            socket.to(roomId).emit('opponentDisconnected');
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
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
    console.log(`🚀 TZ CHESS PRO SERVER IS LIVE ON PORT: ${PORT}`);
    console.log(`=================================================\n`);
});
