var board = null;
var game = new Chess();
var socket = io();
var currentMode = null;
var selectedSquare = null;
var playerColor = 'w'; 

// --- Local Stats System ---
function getStats() {
    return {
        wins: parseInt(localStorage.getItem('tz_wins')) || 0,
        losses: parseInt(localStorage.getItem('tz_losses')) || 0
    };
}

function displayStats() {
    let s = getStats();
    document.getElementById('stat-wins').innerText = s.wins;
    document.getElementById('stat-losses').innerText = s.losses;
    document.getElementById('stat-total').innerText = s.wins + s.losses;
}

function saveStat(type) {
    let s = getStats();
    if (type === 'win') localStorage.setItem('tz_wins', s.wins + 1);
    else if (type === 'loss') localStorage.setItem('tz_losses', s.losses + 1);
    displayStats();
}

window.onload = displayStats;

// --- Navigation ---
function showOnlineSetup() {
    $('.screen').hide();
    $('#online-setup').fadeIn().css('display', 'flex');
}

function joinRoom() {
    var roomId = document.getElementById('room-id').value;
    if (!roomId) return alert("Room ID dalo!");
    $('.screen').hide();
    $('#waiting-screen').show().css('display', 'flex');
    $('#waiting-room-name').text("Room: " + roomId);
    socket.emit('joinRoom', roomId);
    document.getElementById('room-display').innerText = "Room: " + roomId;
}

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
    $('#game-screen').show().css('display', 'flex');
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

// --- Interaction ---
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

// --- Captured Pieces Rendering ---
function updateCapturedDisplay() {
    const history = game.history({ verbose: true });
    const whiteCaptured = []; // Pieces captured by Black
    const blackCaptured = []; // Pieces captured by White

    history.forEach(move => {
        if (move.captured) {
            // If move color is White, it means White captured a Black piece
            if (move.color === 'w') {
                blackCaptured.push('b' + move.captured.toUpperCase());
            } else {
                whiteCaptured.push('w' + move.captured.toUpperCase());
            }
        }
    });

    renderPieceImages('captured-top', blackCaptured);
    renderPieceImages('captured-bottom', whiteCaptured);
}

function renderPieceImages(elementId, pieces) {
    const container = document.getElementById(elementId);
    container.innerHTML = "";
    pieces.forEach(p => {
        const img = document.createElement('img');
        img.src = `https://chessboardjs.com/img/chesspieces/wikipedia/${p}.png`;
        container.appendChild(img);
    });
}

function updateStatus() {
    var statusEl = document.getElementById('status');
    $('.check-square').removeClass('check-square');
    statusEl.className = "";

    updateCapturedDisplay(); // Refreshes the captured lists

    if (game.in_checkmate()) {
        if (game.turn() === playerColor) {
            saveStat('loss');
            showGameOver("You Lost! Checkmate.");
        } else {
            saveStat('win');
            showGameOver("Victory! You Won.");
        }
    } else if (game.in_draw()) {
        showGameOver("It's a Draw!");
    } else {
        var turn = (game.turn() === 'w') ? "White" : "Black";
        statusEl.innerText = turn + " Turn";
        if (game.in_check()) {
            statusEl.innerText += " (CHECK)";
            statusEl.classList.add('check');
            highlightKing(game.turn());
        }
    }
}

function highlightKing(color) {
    var b = game.board();
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var p = b[i][j];
            if (p && p.type === 'k' && p.color === color) {
                var s = String.fromCharCode(97 + j) + (8 - i);
                $('.square-' + s).addClass('check-square');
            }
        }
    }
}

function highlight(square) {
    var p = game.get(square);
    if (!p || (currentMode === 'online' && p.color !== playerColor)) return;
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
