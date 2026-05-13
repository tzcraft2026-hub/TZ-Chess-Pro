var board = null;
var game = new Chess();
var socket = io();
var currentMode = null;
var selectedSquare = null;
var playerColor = 'w'; 

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

// Jab dono player aa jayenge, server ye bhejega
socket.on('playerRole', function(role) {
    playerColor = role;
    console.log("Your role: " + role);
});

socket.on('gameStart', function() {
    console.log("Both players connected! Starting game...");
    initGame('online');
});

function initGame(mode) {
    currentMode = mode;
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('online-setup').style.display = 'none';
    document.getElementById('waiting-screen').style.display = 'none'; // Hide waiting
    document.getElementById('game-screen').style.display = 'flex';
    
    if (mode === 'bot') playerColor = 'w';

    setTimeout(() => {
        if(board) board.destroy();
        board = Chessboard('myBoard', {
            draggable: false,
            position: 'start',
            orientation: playerColor === 'w' ? 'white' : 'black',
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });
        game.reset();
        updateStatus();
    }, 250);
}

// Click-to-move logic wahi rahegi jo pichli baar fix ki thi[span_2](start_span)[span_2](end_span)
function onSquareClick(square) {
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
            board.position(game.fen());
            if(currentMode === 'online') socket.emit('move', move);
            selectedSquare = null;
            $('.dot').remove();
            updateStatus();
            if (currentMode === 'bot' && !game.game_over()) setTimeout(makeBotMove, 500);
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

socket.on('move', function(move) {
    game.move(move);
    board.position(game.fen());
    updateStatus();
});

function updateStatus() {
    var status = game.in_checkmate() ? "Checkmate!" : (game.turn() === 'w' ? "White Turn" : "Black Turn");
    document.getElementById('status').innerText = status;
}

function makeBotMove() {
    var moves = game.moves();
    if (moves.length > 0) {
        game.move(moves[Math.floor(Math.random() * moves.length)]);
        board.position(game.fen());
        updateStatus();
    }
}

function resetGame() {
    if (currentMode === 'online') return alert("Online mode mein reset nahi kar sakte!");
    game.reset();
    board.start();
    updateStatus();
}

$(document).on('click', '[class^="square-"]', function() {
    onSquareClick($(this).attr('data-square'));
});
            
