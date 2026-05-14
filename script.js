var board = null;
var board = null;
var game = new Chess();
var socket = io();
var currentMode = null;
var selectedSquare = null;
var playerColor = 'w'; 

// --- Stats Logic (Local Device) ---
function getStats() {
    return {
        wins: parseInt(localStorage.getItem('tz_chess_wins')) || 0,
        losses: parseInt(localStorage.getItem('tz_chess_losses')) || 0
    };
}

function displayStats() {
    let stats = getStats();
    document.getElementById('stat-wins').innerText = stats.wins;
    document.getElementById('stat-losses').innerText = stats.losses;
    document.getElementById('stat-total').innerText = stats.wins + stats.losses;
}

function saveStat(type) {
    let stats = getStats();
    if (type === 'win') localStorage.setItem('tz_chess_wins', stats.wins + 1);
    if (type === 'loss') localStorage.setItem('tz_chess_losses', stats.losses + 1);
    displayStats();
}

// Load stats on start
window.onload = displayStats;

// --- Navigation ---
function showOnlineSetup() {
    $('#home-screen').hide();
    $('#online-setup').fadeIn().css('display', 'flex');
}

function joinRoom() {
    var roomId = document.getElementById('room-id').value;
    if (!roomId) return alert("Room Name zaroori hai!");
    $('#online-setup').hide();
    $('#waiting-screen').fadeIn().css('display', 'flex');
    $('#waiting-room-name').innerText = "Room: " + roomId;
    socket.emit('joinRoom', roomId);
    document.getElementById('room-display').innerText = "Connected to Room: " + roomId;
}

// --- Game Events ---
socket.on('playerRole', function(role) { playerColor = role; });
socket.on('gameStart', function() { initGame('online'); });
socket.on('move', function(move) {
    game.move(move);
    board.position(game.fen());
    updateStatus();
});

function initGame(mode) {
    currentMode = mode;
    $('.screen').hide();
    $('#game-screen').fadeIn().css('display', 'flex');
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

// --- Core Game Logic ---
function onSquareClick(square) {
    if (game.game_over()) return;
    if (currentMode === 'online' && game.turn() !== playerColor) return; 

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

function updateStatus() {
    var statusEl = document.getElementById('status');
    $('.check-square').removeClass('check-square');
    statusEl.className = "";

    if (game.in_checkmate()) {
        let turn = game.turn();
        let resultMsg = "";
        
        // Stats Update Logic[span_4](start_span)[span_4](end_span)
        if (turn === playerColor) {
            saveStat('loss');
            resultMsg = "You Lost! Checkmate.";
        } else {
            saveStat('win');
            resultMsg = "Victory! You Won.";
        }
        showGameOver(resultMsg);
    } else if (game.in_draw()) {
        showGameOver("It's a Draw!");
    } else {
        var turnText = (game.turn() === 'w') ? "White" : "Black";
        statusEl.innerText = turnText + " Turn";
        if (game.in_check()) {
            statusEl.innerText += " - CHECK!";
            statusEl.classList.add('check');
            highlightKing(game.turn());
        }
    }
}

function highlightKing(color) {
    var boardState = game.board();
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var piece = boardState[i][j];
            if (piece && piece.type === 'k' && piece.color === color) {
                var square = String.fromCharCode(97 + j) + (8 - i);
                $('.square-' + square).addClass('check-square');
            }
        }
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

function showGameOver(msg) {
    document.getElementById('winner-text').innerText = msg;
    $('#game-over-overlay').fadeIn().css('display', 'flex');
}

function makeBotMove() {
    var moves = game.moves();
    game.move(moves[Math.floor(Math.random() * moves.length)]);
    board.position(game.fen());
    updateStatus();
}

function resetGame() {
    if (currentMode === 'online') return alert("Online mode mein reset disabled hai.");
    game.reset();
    board.start();
    updateStatus();
}

$(document).on('click', '[class^="square-"]', function() {
    onSquareClick($(this).attr('data-square'));
});
