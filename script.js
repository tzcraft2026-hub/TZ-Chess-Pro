var board = null;
var game = new Chess();
var socket = io();
var currentMode = null;
var selectedSquare = null;
var playerColor = 'w'; 

// 1. Navigation & Room Join
function showOnlineSetup() {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('online-setup').style.display = 'flex';
}

function joinRoom() {
    var roomId = document.getElementById('room-id').value;
    if (!roomId) return alert("Room Name dalo!");
    
    document.getElementById('online-setup').style.display = 'none';
    document.getElementById('waiting-screen').style.display = 'flex';
    document.getElementById('waiting-room-name').innerText = "Room ID: " + roomId;
    
    socket.emit('joinRoom', roomId);
    document.getElementById('room-display').innerText = "Room: " + roomId;
}

// 2. Synchronization Events (Zaroori!)
socket.on('playerRole', function(role) {
    playerColor = role; // 'w' or 'b[span_2](start_span)'[span_2](end_span)
});

socket.on('gameStart', function() {
    initGame('online');
});

// Jab dusra player move kare, tab ye chalega
socket.on('move', function(move) {
    game.move(move); // Chess logic update[span_3](start_span)[span_3](end_span)
    board.position(game.fen()); // Board UI update
    updateStatus();
});

// 3. Game Initialization
function initGame(mode) {
    currentMode = mode;
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('online-setup').style.display = 'none';
    document.getElementById('waiting-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    
    if (mode === 'bot') playerColor = 'w';

    setTimeout(() => {
        if(board) board.destroy();
        board = Chessboard('myBoard', {
            draggable: false,
            position: game.fen(), // Hamesha current state se shuru karein
            orientation: playerColor === 'w' ? 'white' : 'black',
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });
        updateStatus();
    }, 250);
}

// 4. Move Logic (Click-to-Move)
function onSquareClick(square) {
    // Check: Kya ye is player ki turn hai?[span_4](start_span)[span_4](end_span)
    if (currentMode === 'online') {
        if (game.turn() !== playerColor) return; 
        var piece = game.get(square);
        if (selectedSquare === null && piece && piece.color !== playerColor) return;
    }

    if (selectedSquare) {
        var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
        
        if (move === null) {
            selectedSquare = null;
            $('.dot').remove();
            highlight(square);
        } else {
            // Sahi Move!
            board.position(game.fen()); // Apna board update karein
            
            if(currentMode === 'online') {
                socket.emit('move', move); // Server ko move bhejein[span_5](start_span)[span_5](end_span)
            }
            
            selectedSquare = null;
            $('.dot').remove();
            updateStatus();
            
            if (currentMode === 'bot' && !game.game_over()) {
                setTimeout(makeBotMove, 500);
            }
        }
    } else {
        highlight(square);
    }
}

function highlight(square) {
    var piece = game.get(square);
    if (!piece || (currentMode === 'online' && piece.color !== playerColor)) return;
    
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;
    
    selectedSquare = square;
    $('.dot').remove();
    moves.forEach(m => $('.square-' + m.to).append('<div class="dot"></div>'));
}

// 5. Bot & Utility
function makeBotMove() {
    var moves = game.moves();
    if (moves.length > 0) {
        game.move(moves[Math.floor(Math.random() * moves.length)]);
        board.position(game.fen());
        updateStatus();
    }
}

function updateStatus() {
    var status = "";
    if (game.in_checkmate()) {
        status = "Checkmate! Game Over.";
    } else if (game.in_draw()) {
        status = "Game Draw!";
    } else {
        status = (game.turn() === 'w' ? "White" : "Black") + " ki baari";
        if (game.in_check()) status += " (Check!)";
    }
    document.getElementById('status').innerText = status;
}

function resetGame() {
    if (currentMode === 'online') return alert("Online mode mein reset nahi kar sakte!");
    game.reset();
    board.start();
    updateStatus();
}

// Click Listener
$(document).on('click', '[class^="square-"]', function() {
    onSquareClick($(this).attr('data-square'));
});
