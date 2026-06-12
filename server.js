const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);

// 🔥 CLOUD DATABASE PIPELINE (Apni Atlas connection string yahan lagayein)
const MONGO_URI = "mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxx.mongodb.net/chessDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✔ MongoDB Atlas Securely Connected!"))
    .catch(err => console.log("❌ DB Connection Error: ", err));

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, minlength: 6, maxlength: 20 },
    password: { type: String, required: true },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// CORS cross origin bypass layers configuration for local mobile asset loading
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('User synchronization live: ' + socket.id);

    // SIGN UP FLOW WITH INSTANT FAIL-SAFE SYSTEM
    socket.on('authSignUp', async (data) => {
        try {
            const { username, password } = data;
            if (!username || !password) {
                return socket.emit('authResponse', { success: false, msg: "All fields are required!" });
            }

            const cleanUser = username.trim().toLowerCase();
            if (cleanUser.length < 6 || cleanUser.length > 20) {
                return socket.emit('authResponse', { success: false, msg: "Username must be 6-20 characters!" });
            }

            const existingUser = await User.findOne({ username: cleanUser });
            if (existingUser) {
                return socket.emit('authResponse', { success: false, msg: "Username already taken! Try another one." });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = new User({ username: cleanUser, password: hashedPassword });
            await newUser.save();

            socket.emit('authResponse', { 
                success: true, 
                username: newUser.username, 
                wins: newUser.wins, 
                losses: newUser.losses, 
                msg: "Account created successfully! Welcome." 
            });
        } catch (err) {
            socket.emit('authResponse', { success: false, msg: "Database connection failed during Sign Up!" });
        }
    });

    // LOGIN FLOW
    socket.on('authLogin', async (data) => {
        try {
            const { username, password } = data;
            const cleanUser = username.trim().toLowerCase();

            const user = await User.findOne({ username: cleanUser });
            if (!user) {
                return socket.emit('authResponse', { success: false, msg: "Account not found! Register instead." });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return socket.emit('authResponse', { success: false, msg: "Incorrect Password!" });
            }

            socket.emit('authResponse', { 
                success: true, 
                username: user.username, 
                wins: user.wins, 
                losses: user.losses, 
                msg: "Welcome back, Master!" 
            });
        } catch (err) {
            socket.emit('authResponse', { success: false, msg: "Server authentication engine failure!" });
        }
    });

    socket.on('cloudUpdateStats', async (data) => {
        try {
            const { username, type } = data;
            const user = await User.findOne({ username: username.toLowerCase() });
            if (user) {
                if (type === 'win') user.wins += 1;
                if (type === 'loss') user.losses += 1;
                await user.save();
                socket.emit('statsSynced', { wins: user.wins, losses: user.losses });
            }
        } catch (err) {
            console.log("Stats error");
        }
    });

    socket.on('joinRoom', (roomId) => {
        if(socket.roomId) socket.leave(socket.roomId);
        socket.join(roomId);
        socket.roomId = roomId;

        const clients = io.sockets.adapter.rooms.get(roomId);
        const numClients = clients ? clients.size : 0;

        if (numClients === 1) {
            socket.emit('playerRole', 'w');
        } else if (numClients === 2) {
            socket.emit('playerRole', 'b');
            io.to(roomId).emit('gameStart'); 
        }
    });

    socket.on('move', (move) => {
        if (socket.roomId) socket.to(socket.roomId).emit('move', move);
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

    socket.on('leaveCurrentRoom', () => {
        const roomId = socket.roomId;
        if (roomId) {
            socket.leave(roomId);
            socket.to(roomId).emit('opponentDisconnected', { msg: "Opponent Left" });
            socket.roomId = null;
        }
    });

    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (roomId) {
            const clients = io.sockets.adapter.rooms.get(roomId);
            if (clients && clients.size === 1) {
                io.to(roomId).emit('opponentDisconnected', { msg: "Opponent left" });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
                
