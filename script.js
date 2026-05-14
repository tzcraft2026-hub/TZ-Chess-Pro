var board = null;
var game = new Chess();
var socket = io();
var currentMode = null;
var selectedSquare = null;
var playerColor = 'w'; 

// Navigation
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
}

// Socket Events
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
    $('#game-screen').show();
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

// Click to Move Logic
function onSquareClick(square) {
    if (game.game_over()) return; // Stop if game ended[span_3](start_span)[span_3](end_span)
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

function highlight(square) {
    var piece = game.get(square);
    if (!piece || (currentMode === 'online' && piece.color !== playerColor)) return;
    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;
    selectedSquare = square;
    $('.dot').remove();
    moves.forEach(m => $('.square-' + m.to).append('<div class="dot"></div>'));
}

// Status & Visual Checks
function updateStatus() {
    var statusEl = document.getElementById('status');
    $('.check-square').removeClass('check-square');
    statusEl.className = "";

    if (game.in_checkmate()) {
        var winner = (game.turn() === 'w') ? "Black" : "White";
        showGameOver(winner + " Wins by Checkmate!");
    } else if (game.in_draw()) {
        showGameOver("Game Draw!");
    } else {
        var turn = (game.turn() === 'w') ? "White" : "Black";
        statusEl.innerText = turn + " Turn";
        if (game.in_check()) {
            statusEl.innerText += " - CHECK!";
            statusEl.classList.add('check');
            highlightKing(game.turn()); // Highlight King[span_4](start_span)[span_4](end_span)
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

function showGameOver(msg) {
    document.getElementById('winner-text').innerText = msg;
    document.getElementById('game-over-overlay').style.display = 'flex';
}

function makeBotMove() {
    var moves = game.moves();
    game.move(moves[Math.floor(Math.random() * moves.length)]);
    board.position(game.fen());
    updateStatus();
}

function resetGame() {
    if (currentMode === 'online') return alert("Online mode mein reset band hai.");
    game.reset();
    board.start();
    updateStatus();
}

$(document).on('click', '[class^="square-"]', function() {
    onSquareClick($(this).attr('data-square'));
});
            
