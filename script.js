var board = null;
var game = new Chess();
var socket = io();
var currentMode = null;
var selectedSquare = null;
var playerColor = 'w';

var stats = JSON.parse(localStorage.getItem('tzStats')) || { wins: 0, losses: 0, total: 0 };

function updateStatsUI() {
    document.getElementById('stat-total').innerText = stats.total;
    document.getElementById('stat-wins').innerText = stats.wins;
    document.getElementById('stat-losses').innerText = stats.losses;
}
updateStatsUI();

function initGame(mode) {
    if (mode === 'online') {
        document.getElementById('home-screen').style.display = 'none';
        document.getElementById('online-setup').style.display = 'flex';
        return;
    }
    
    currentMode = 'bot';
    startActualGame();
}

function joinRoom() {
    var roomId = document.getElementById('room-id').value;
    if (!roomId) return alert("Room ID dalo!");
    socket.emit('joinRoom', roomId);
    currentMode = 'online';
}

socket.on('playerRole', function(role) {
    playerColor = role;
    document.getElementById('online-setup').style.display = 'none';
    startActualGame();
});

function startActualGame() {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    
    setTimeout(() => {
        if (!board) {
            board = Chessboard('myBoard', {
                draggable: false,
                position: 'start',
                orientation: playerColor === 'w' ? 'white' : 'black',
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
            });
        }
        game.reset();
        board.start();
        board.resize();
        updateStatus();
        if(currentMode === 'bot') { stats.total++; saveStats(); }
    }, 200);
}

function goToHome() {
    location.reload(); // State clean rakhne ke liye reload best hai
}

function onSquareClick(square) {
    if (currentMode === 'online' && game.turn() !== playerColor[0]) return;

    if (selectedSquare) {
        var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (move === null) {
            selectedSquare = null;
            $('.dot').remove();
            highlightMoves(square);
        } else {
            board.position(game.fen());
            if(currentMode === 'online') socket.emit('move', move);
            selectedSquare = null;
            $('.dot').remove();
            updateStatus();
            if (currentMode === 'bot' && !game.game_over()) setTimeout(makeBotMove, 500);
        }
    } else {
        highlightMoves(square);
    }
}

function highlightMoves(square) {
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

socket.on('move', function(move) {
    game.move(move);
    board.position(game.fen());
    updateStatus();
});

function updateStatus() {
    var status = game.in_checkmate() ? "Checkmate!" : (game.turn() === 'w' ? "White" : "Black") + " ki baari";
    document.getElementById('status').innerText = status;
}

$(document).on('click', '[class^="square-"]', function() {
    onSquareClick($(this).attr('data-square'));
});

function saveStats() {
    localStorage.setItem('tzStats', JSON.stringify(stats));
    updateStatsUI();
                            }
