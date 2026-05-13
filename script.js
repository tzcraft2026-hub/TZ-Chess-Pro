var board = null;
var game = new Chess();
var currentMode = null; 
var socket = io(); // Is line mein kuch likhne ki zarurat nahi, ye apne aap Render URL pakad lega
var roomID = null;
var playerColor = null;

// Server connection check karne ke liye
socket.on('connect', function() {
    console.log("Server se jud gaye!");
});

function startMultiplayer() {
    let inputRoom = prompt("Code TZ- se shuru karein (Ex: TZ-99):");
    if (inputRoom && inputRoom.toUpperCase().startsWith("TZ-")) {
        roomID = inputRoom.toUpperCase();
        currentMode = 'online';
        document.getElementById('status').innerText = "Dost ka intezar hai...";
        socket.emit('joinRoom', roomID);
    } else {
        alert("Galti! Code TZ- se shuru karein.");
    }
}

function startBotGame() {
    currentMode = 'bot';
    playerColor = 'w';
    game.reset();
    board.start();
    updateStatus();
}

socket.on('playerRole', function(role) {
    playerColor = role;
});

socket.on('gameStart', function(msg) {
    board.start(); 
    updateStatus();
    alert("Dost mil gaya! Aap " + (playerColor === 'w' ? "White" : "Black") + " hain.");
});

socket.on('opponentMove', function(move) {
    game.move(move);
    board.position(game.fen());
    updateStatus();
});

function onDragStart (source, piece, position, orientation) {
    if (currentMode === null) {
        alert("Pehle mode select karein!");
        return false;
    }

    if (game.game_over()) return false;

    // Baari check logic
    if (currentMode === 'online') {
        if (game.turn() !== playerColor) return false;
        if ((playerColor === 'w' && piece.search(/^b/) !== -1) ||
            (playerColor === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
    } else if (currentMode === 'bot') {
        // Bot mode mein player hamesha White hai
        if (piece.search(/^b/) !== -1) return false;
    }
}

function onDrop(source, target) {
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q' 
    });

    if (move === null) return 'snapback';

    if (currentMode === 'online') {
        socket.emit('move', {
            room: roomID,
            move: move
        });
    }

    updateStatus();

    if (currentMode === 'bot' && !game.game_over()) {
        window.setTimeout(makeRandomMove, 500);
    }
}

function makeRandomMove() {
    var possibleMoves = game.moves();
    if (possibleMoves.length === 0) return;
    var randomIdx = Math.floor(Math.random() * possibleMoves.length);
    game.move(possibleMoves[randomIdx]);
    board.position(game.fen());
    updateStatus();
}

// Ye line piece ko sahi position pe set karne ke liye zaruri hai
function onSnapEnd () {
    board.position(game.fen());
}

function updateStatus() {
    var status = (game.turn() === 'w' ? 'White' : 'Black') + ' ki baari hai';
    if (game.in_checkmate()) status = 'Game Over: Checkmate!';
    if (game.in_draw()) status = 'Game Over: Draw';
    
    if (currentMode === 'online') {
        status += " | Aap: " + (playerColor === 'w' ? "White" : "Black");
    }
    document.getElementById('status').innerText = status;
}

var config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd, // Ye line missing thi
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};

board = Chessboard('myBoard', config);

// Board ko mobile screen ke liye resize karne ke liye
$(window).resize(board.resize);

updateStatus();

