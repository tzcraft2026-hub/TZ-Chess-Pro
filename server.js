const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);

// 🔥 DATABASE CONNECTION (Apni MongoDB Connection String yahan dalein)
const MONGO_URI = "mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxx.mongodb.net/chessDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✔ MongoDB Cloud Connected Safely!"))
    .catch(err => console.log("❌ DB Connection Error: ", err));

// User Schema Blueprint
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, minlength: 6, maxlength: 20 },
    password: { type: String, required: true },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    // SIGN UP PIPELINE
    socket.on('authSignUp', async (data) => {
        try {
            const { username, password } = data;
            
            if (username.length < 6 || username.length > 20) {
                return socket.emit('authResponse', { success: false, msg: "Username must be 6 to 20 characters!" });
            }
            if (password.length < 8) {
                return socket.emit('authResponse', { success: false, msg: "Password must be at least 8 characters long!" });
            }

            const existingUser = await User.findOne({ username: username.toLowerCase() });
            if (existingUser) {
                return socket.emit('authResponse', { success: false, msg: "Username already taken! Please Login instead." });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = new User({ username: username.toLowerCase(), password: hashedPassword });
            await newUser.save();

            socket.emit('authResponse', { 
                success: true, 
                action: "signup", 
                username: newUser.username, 
                wins: newUser.wins, 
                losses: newUser.losses, 
                msg: "Account created successfully! Enjoy Friend Mode." 
            });
        } catch (err) {
            socket.emit('authResponse', { success: false, msg: "Server error during registration!" });
        }
    });

    // LOGIN PIPELINE
    socket.on('authLogin', async (data) => {
        try {
            const { username, password } = data;
            const user = await User.findOne({ username: username.toLowerCase() });
            
            if (!user) {
                return socket.emit('authResponse', { success: false, msg: "Account not found! Register as a new user." });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return socket.emit('authResponse', { success: false, msg: "Incorrect Password! Try again." });
            }

            socket.emit('authResponse', { 
                success: true, 
                action: "login", 
                username: user.username, 
                wins: user.wins, 
                losses: user.losses, 
                msg: "Welcome back, Master!" 
            });
        } catch (err) {
            socket.emit('authResponse', { success: false, msg: "Server authentication failed!" });
        }
    });

    // SYNC STATS UPDATE IN CLOUD
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
            console.log("Stats syncing failed");
        }
    });

    // MULTIPLAYER MATCHMAKING MECHANICS
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
        
