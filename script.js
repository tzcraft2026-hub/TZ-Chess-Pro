var board = null;
var game = new Chess();
var socket = io();
var currentMode = null;
var selectedSquare = null;

// Stats Logic (LocalStorage)
var stats = JSON.parse(localStorage.getItem('tzStats')) || { wins: 0, losses: 0, total: 0 };

function updateStatsUI() {
    document.getElementById('stat-total').innerText = stats.total;
    document.getElementById('stat-wins').innerText = stats.wins;
    document.getElementById('stat-losses').innerText = stats.losses;
}
updateStatsUI();

function saveStats() {
    localStorage.setItem('tzStats', JSON.stringify(stats));
    updateStatsUI();
}

// Navigation
function initGame(mode) {
    currentMode = mode;
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';

    setTimeout(function() {
        if (board === null) {
            board = Chessboard('myBoard', config);
        }
        board.start();
        game.reset();
        board.resize();
        updateStatus();
        
        if(mode === 'bot') {
            stats.total++;
            saveStats();
        }
    }, 150);
}

function goToHome() {
    document.getElementById('home-screen').style.display = 'flex';
    document.getElementById('game-screen').style.display = 'none';
}

// Click to Move Logic
function removeDots() {
    $('.dot').remove();
}

function addDot(square) {
    $('.square-' + square).append('<div class="dot"></div>');
}

function onSquareClick(square) {
    if (selectedSquare) {
        var move = game.move({
            from: selectedSquare,
            to: square,
            promotion: 'q'
        });

        if (move === null) {
            selectedSquare = null;
            removeDots();
            highlightPossibleMoves(square);
        } else {
            board.position(game.fen());
            selectedSquare = null;
            removeDots();
            updateStatus();
            checkGameOver();
            
            if (currentMode === 'bot' && !game.game_over()) {
                window.setTimeout(makeBotMove, 400);
            }
        }
    } else {
        highlightPossibleMoves(square);
    }
}

function highlightPossibleMoves(square) {
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;

    selectedSquare = square;
    removeDots();
    moves.forEach(m => addDot(m.to));
}

function makeBotMove() {
    var moves = game.moves();
    if (moves.length === 0) return;
    var move = moves[Math.floor(Math.random() * moves.length)];
    game.move(move);
    board.position(game.fen());
    updateStatus();
    checkGameOver();
}

function updateStatus() {
    var status = (game.turn() === 'w' ? 'White' : 'Black') + ' ki baari';
    if (game.in_checkmate()) status = 'Checkmate!';
    document.getElementById('status').innerText = status;
}

function checkGameOver() {
    if (game.in_checkmate()) {
        if (game.turn() === 'b') stats.wins++; else stats.losses++;
        saveStats();
    }
}

var config = {
    draggable: false,
    position: 'start',
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};

// Event listener for clicks on squares
$(document).on('click', '[class^="square-"]', function() {
    var square = $(this).attr('data-square');
    onSquareClick(square);
});

function resetGame() {
    game.reset();
    board.start();
    updateStatus();
        }
        
