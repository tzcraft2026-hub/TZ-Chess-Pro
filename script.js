var board = null;
var game = new Chess();
var socket = io();
var currentMode = null;
var selectedSquare = null;

// Navigation
function showOnlineSetup() {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('online-setup').style.display = 'flex';
}

function initGame(mode) {
    currentMode = mode;
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    
    setTimeout(() => {
        board = Chessboard('myBoard', { draggable: false, position: 'start', pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png' });
        game.reset();
        updateStatus();
    }, 200);
}

function joinRoom() {
    var roomId = document.getElementById('room-id').value;
    if (!roomId) return alert("Room Name dalo!");
    socket.emit('joinRoom', roomId);
    document.getElementById('online-setup').style.display = 'none';
    initGame('online');
}

// Click to Move Logic
function onSquareClick(square) {
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
            if (currentMode === 'bot') setTimeout(makeBotMove, 500);
        }
    } else {
        highlight(square);
    }
}

function highlight(square) {
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;
    selectedSquare = square;
    moves.forEach(m => $('.square-' + m.to).append('<div class="dot"></div>'));
}

function makeBotMove() {
    var moves = game.moves();
    game.move(moves[Math.floor(Math.random() * moves.length)]);
    board.position(game.fen());
    updateStatus();
}

function updateStatus() {
    document.getElementById('status').innerText = (game.turn() === 'w' ? "White" : "Black") + " Turn";
}

$(document).on('click', '[class^="square-"]', function() {
    onSquareClick($(this).attr('data-square'));
});
