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

socket.on('playerRole', function(role) { playerColor = role; });
socket.on('gameStart', function() { initGame('online'); });

// Sync Fix: Move aate hi board update hona chahiye[span_2](start_span)[span_2](end_span)
socket.on('move', function(move) {
    game.move(move);
    board.position(game.fen());
    updateStatus();
});

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
            position: 'start',
            orientation: playerColor === 'w' ? 'white' : 'black',
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });
        game.reset();
        updateStatus();
    }, 250);
}

function onSquareClick(square) {
    if (currentMode === 'online' && game.turn() !== playerColor) return; 

    if (selectedSquare) {
        var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (move === null) {
            selectedSquare = null;
            $('.dot').remove();
            highlight(square);
        } else {
            board.position(game.fen());
            if(currentMode === 'online') socket.emit('move', move); // Move bhejna[span_3](start_span)[span_3](end_span)
            selectedSquare = null;
            $('.dot').remove();
            updateStatus();
            if (currentMode === 'bot') setTimeout(makeBotMove, 500);
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

function updateStatus() {
    var turn = game.turn() === 'w' ? "White" : "Black";
    document.getElementById('status').innerText = turn + " Turn";
}

function makeBotMove() {
    var moves = game.moves();
    game.move(moves[Math.floor(Math.random() * moves.length)]);
    board.position(game.fen());
    updateStatus();
}

$(document).on('click', '[class^="square-"]', function() {
    onSquareClick($(this).attr('data-square'));
});
        
