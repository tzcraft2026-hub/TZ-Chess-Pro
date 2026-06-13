const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Sabhi origins ko allow karne ke liye (Aapki frontend web hosting)
        methods: ["GET", "POST"]
    }
});

// ===================================================
// 💾 PERMANENT SERVER-SIDE DATABASE BANKS
// ===================================================
// Jab tak aapka server live rahega, ye data global rahega.
// Kisi bhi device se request aaye, ye duplication block karega.
let serverUsersDB = {}; 
let rooms = {}; // Active online chess rooms tracker

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

        // PROBLEM 2 FIX: Global server check validation (Duplication block across all devices)
        if (serverUsersDB[username] !== undefined) {
            socket.emit('authResponse', { success: false, message: "This username is already taken on TZ Server!" });
            console.log(`[🚫 Signup Blocked]: Duplicate entry attempt for -> ${username}`);
        } else {
            // Account locking down permanently inside the server cloud memory matrix
            serverUsersDB[username] = password;
            console.log(`[🔐 Account Created]: Successfully registered user -> ${username}`);
            
            // PROBLEM 1 FIX: Account bante hi direct response dispatch with success flag!
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
            // Agar room nahi bana hai, toh naya banao aur is player ko White allot karo
            rooms[roomId] = [socket.id];
            socket.join(roomId);
            socket.emit('playerRole', 'w');
            console.log(`[🏠 Room Created]: ${roomId} by Player (White) -> ${socket.id}`);
        } else if (rooms[roomId].length === 1) {
            // Agar room me ek player hai, toh join karwao aur use Black allot karo
            rooms[roomId].push(socket.id);
            socket.join(roomId);
            socket.emit('playerRole', 'b');
            console.log(`[⚔️ Matchmaking Complete]: Player (Black) -> ${socket.id} joined Room -> ${roomId}`);
            
            // Dono players ko game start ka event trigger bhejdo
            io.to(roomId).emit('gameStart');
        } else {
            // Agar room pehle se full hai (max 2 players allowable rules)
            socket.emit('statusMessage', 'Room is completely full!');
            console.log(`[🚫 Room Full Alert]: Access denied on Room -> ${roomId} for -> ${socket.id}`);
        }
    });

    // Move transmission router handler
    socket.on('move', (moveData) => {
        if (socket.currentRoom) {
            // Apne opponent player ko move pass on karo broadcast pipe se
            socket.to(socket.currentRoom).emit('move', moveData);
        }
    });

    // Match Restart Handler Pipeline Matrix
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
    // 🚪 4. DISCONNECT & LEAVE ROOM CONTROL FILTERS
    // ---------------------------------------------------
    function handleUserLeavingLobby() {
        const roomId = socket.currentRoom;
        if (roomId && rooms[roomId]) {
            console.log(`[🏃 Player Left]: User ${socket.id} left Room -> ${roomId}`);
            
            // Opponent ko notify karein tab closure ya manual leave trigger hone par
            socket.to(roomId).emit('opponentDisconnected');
            
            // Array node filter out process
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
// Render Cloud variable engine port parse karne ke liye process.env use hoga
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 TZ CHESS PRO SERVER IS LIVE ON PORT: ${PORT}`);
    console.log(`=================================================\n`);
});
