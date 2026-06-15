const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose'); // ✅ Permanent Cloud Storage ke liye

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
// 🌐 MONGOOSE (CLOUD DATABASE) CONNECTION
// ===================================================
// Yahan aap apna permanent Mongo URI string lagayenge
const MONGO_URI = process.env.MONGO_URI || "YOUR_MONGODB_ATLAS_CONNECTION_STRING_HERE";

mongoose.connect(MONGO_URI)
    .then(() => console.log('===> [📡 Database Connected]: MongoDB Atlas Connected Safely! 🎉'))
    .catch((err) => console.log('===> [⚠️ Database Error]: Connection Failed! ', err));

// Accounts ke liye Database Schema (Structure)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Active online chess rooms tracker (RAM memory mein hi rahega)
let rooms = {}; 

// Base route status check karne ke liye
app.get('/', (req, res) => {
    res.send('TZ Chess Pro - FRESH Engine Server is Live! 🚀');
});

// ===================================================
// 📡 REALTIME WEB-SOCKET MULTIPLAYER LOBBY
// ===================================================
io.on('connection', (socket) => {
    console.log(`[👤 Connected]: New client connected -> ${socket.id}`);

    // ---------------------------------------------------
    // 🔥 1. SIGN UP / REGISTER HANDLER (With Permanent Lock)
    // ---------------------------------------------------
    socket.on('serverRegisterUser', async (data) => {
        const username = data.username ? data.username.trim() : "";
        const password = data.password;

        if (!username || !password) {
            socket.emit('authResponse', { success: false, message: "Invalid Form Fields Data!" });
            return;
        }

        try {
            // Check kya ye username cloud DB mein pehle se hai?
            const existingUser = await User.findOne({ username: username });
            
            if (existingUser) {
                socket.emit('authResponse', { success: false, message: "This username is already taken on TZ Server!" });
                console.log(`[🚫 Signup Blocked]: Duplicate entry for -> ${username}`);
            } else {
                // Agar nahi hai, toh permanent cloud storage mein save karo
                const newUser = new User({ username: username, password: password });
                await newUser.save();
                
                console.log(`[🔐 Account Created]: Saved permanently in Cloud -> ${username}`);
                socket.emit('authResponse', { success: true, username: username });
            }
        } catch (error) {
            socket.emit('authResponse', { success: false, message: "Database Error. Try again!" });
        }
    });

    // ---------------------------------------------------
    // 🔥 2. LOG IN EVENT HANDLER (Verify From Cloud Database)
    // ---------------------------------------------------
    socket.on('serverLoginUser', async (data) => {
        const username = data.username ? data.username.trim() : "";
        const password = data.password;

        try {
            // Cloud Database se account dhoondo
            const user = await User.findOne({ username: username });

            if (user && user.password === password) {
                console.log(`[🔓 Logged In]: Identity verified for -> ${username}`);
                socket.emit('loginResponse', { success: true, username: username });
            } else {
                socket.emit('loginResponse', { success: false, message: "Invalid Username or Password!" });
                console.log(`[⚠️ Login Failed]: Invalid credentials for -> ${username}`);
            }
        } catch (error) {
            socket.emit('loginResponse', { success: false, message: "Database Verification Error!" });
        }
    });

    // ---------------------------------------------------
    // 👥 3. CHESS LOBBY MANAGEMENT
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
        }
    });

    socket.on('move', (moveData) => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('move', moveData);
        }
    });

    socket.on('requestRestart', () => {
        if (socket.currentRoom) socket.to(socket.currentRoom).emit('receiveRestartRequest');
    });

    socket.on('acceptRestart', () => {
        if (socket.currentRoom) io.to(socket.currentRoom).emit('restartAccepted');
    });

    socket.on('declineRestart', () => {
        if (socket.currentRoom) socket.to(socket.currentRoom).emit('restartDeclined');
    });

    // ---------------------------------------------------
    // 🚪 4. DISCONNECT & CLEAN UP FILTERS
    // ---------------------------------------------------
    function handleUserLeavingLobby() {
        const roomId = socket.currentRoom;
        if (roomId && rooms[roomId]) {
            console.log(`[🏃 Player Left]: User ${socket.id} left Room -> ${roomId}`);
            socket.to(roomId).emit('opponentDisconnected');
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
            }
            socket.leave(roomId);
            socket.currentRoom = null;
        }
    }

    socket.on('leaveCurrentRoom', () => {
        handleUserLeavingLobby();
    });

    socket.on('disconnect', () => {
        handleUserLeavingLobby();
    });
});

// ===================================================
// ⚡ PORT SYSTEM ENGINE
// ===================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 FRESH TZ SERVER IS LIVE ON PORT: ${PORT}`);
    console.log(`=================================================\n`);
});
