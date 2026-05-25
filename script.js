// =================================================================
// TZ CHESS PRO - 100% OFFLINE REPLACEABLE SCRIPT.JS (LOCAL ASSETS)
// =================================================================

var board = null;
var game = new Chess();
var socket = io();
var currentMode = null;
var selectedSquare = null;
var playerColor = 'w'; 

// Bot (Black) ke liye Pieces ki Matrix Value (Evaluation)
const PIECE_VALUES = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 9000 };

const PAWN_EVAL = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5,  5,  5,  5,  5,  5,  5,  5],
    [1,  1,  2,  3,  3,  2,  1,  1],
    [0.5,  0.5,  1,  2.5,  2.5,  1,  0.5,  0.5],
    [0,  0,  0,  2,  2,  0,  0,  0],
    [0.5, -0.5, -1,  0,  0, -1, -0.5,  0.5],
    [0.5,  1, 1,  -2, -2,  1,  1,  0.5],
    [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_EVAL = [
    [-5, -4, -3, -3, -3, -3, -4, -5],
    [-4, -2,  0,  0,  0,  0, -2, -4],
    [-3,  0,  1,  1.5, 1.5,  1,  0, -3],
    [-3,  0.5, 1.5,  2,  2, 1.5,  0.5, -3],
    [-3,  0, 1.5,  2,  2, 1.5,  0, -3],
    [-3,  0.5,  1,  1.5, 1.5,  1,  0.5, -3],
    [-4, -2,  0,  0.5,  0.5,  0, -2, -4],
    [-5, -4, -3, -3, -3, -3, -4, -5]
];

const BISHOP_EVAL = [
    [-2, -1, -1, -1, -1, -1, -1, -2],
    [-1,  0,  0,  0,  0,  0,  0, -1],
    [-1,  0,  0.5,  1,  1,  0.5,  0, -1],
    [-1,  0.5,  0.5,  1,  1,  0.5,  0.5, -1],
    [-1,  0,  1,  1,  1,  1,  0, -1],
    [-1,  1,  1,  1,  1,  1,  1, -1],
    [-1,  0.5,  0,  0,  0,  0,  0.5, -1],
    [-2, -1, -1, -1, -1, -1, -1, -2]
];

const ROOK_EVAL = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [0.5,  1,  1,  1,  1,  1,  1,  0.5],
    [-0.5,  0,  0,  0,  0,  0,  0, -0.5],
    [-0.5,  0,  0,  0,  0,  0,  0, -0.5],
    [-0.5,  0,  0,  0,  0,  0,  0, -0.5],
    [-0.5,  0,  0,  0,  0,  0,  0, -0.5],
    [-0.5,  0,  0,  0,  0,  0,  0, -0.5],
    [0,  0,  0,  0.5,  0.5,  0,  0,  0]
];

const EVAL_TABLES = { p: PAWN_EVAL, n: KNIGHT_EVAL, b: BISHOP_EVAL, r: ROOK_EVAL, q: PAWN_EVAL, k: PAWN_EVAL };

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
            // 🔥 FIXED FOR OFFLINE: Local lib folder se images uthane ke liye theme setup
            pieceTheme: 'lib/{piece}.png'
        });
        game.reset();
        updateStatus();
    }, 250);
}

// --- Interaction ---
function onSquareClick(square) {
    if (game.game_over()) return;
    if (currentMode === 'online' && game.turn() !== playerColor) return; 
    if (currentMode === 'bot' && game.turn() === 'b') return; 

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
            
            if (currentMode === 'bot' && !game.game_over()) {
                setTimeout(makeBotMove, 1200); 
            }
        }
    } else {
        highlight(square);
    }
}

// --- Captured Pieces Rendering ---
function updateCapturedDisplay() {
    const history = game.history({ verbose: true });
    const blackCapturedByWhite = []; 
    const whiteCapturedByBlack = []; 

    history.forEach(move => {
        if (move.captured) {
            if (move.color === 'w') {
                blackCapturedByWhite.push('b' + move.captured.toUpperCase());
            } else {
                whiteCapturedByBlack.push('w' + move.captured.toUpperCase());
            }
        }
    });

    if (playerColor === 'w') {
        renderPieceImages('captured-top', blackCapturedByWhite);
        renderPieceImages('captured-bottom', whiteCapturedByBlack);
    } else {
        renderPieceImages('captured-top', whiteCapturedByBlack);
        renderPieceImages('captured-bottom', blackCapturedByWhite);
    }
}

function renderPieceImages(elementId, pieces) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = "";
    pieces.forEach(p => {
        const img = document.createElement('img');
        // 🔥 FIXED FOR OFFLINE: Captured pieces ki image bhi ab aapke local lib folder se aayegi
        img.src = `lib/${p}.png`;
        img.style.width = '24px';
        img.style.height = '24px';
        img.style.margin = '2px';
        container.appendChild(img);
    });
}

function updateStatus() {
    var statusEl = document.getElementById('status');
    if (!statusEl) return;
    $('.check-square').removeClass('check-square');
    statusEl.className = "";

    updateCapturedDisplay(); 

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
    if (currentMode === 'bot' && p.color === 'b') return; 
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

// --- 🧠 FAST ORIGINAL BOT AI LOGIC ---

function evaluateBoard(boardState) {
    let totalEvaluation = 0;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let piece = boardState[i][j];
            if (piece) {
                let value = PIECE_VALUES[piece.type];
                let table = EVAL_TABLES[piece.type];
                let positionValue = table ? table[i][j] : 0;
                
                if (piece.color === 'w') {
                    totalEvaluation -= (value + positionValue);
                } else {
                    totalEvaluation += (value + positionValue);
                }
            }
        }
    }
    return totalEvaluation;
}

function makeBotMove() {
    let moves = game.moves({ verbose: true });
    if (moves.length === 0) return;

    let bestMove = null;
    let bestScore = -Infinity;

    for (let i = 0; i < moves.length; i++) {
        let move = moves[i];
        game.move(move);
        
        let score = evaluateBoard(game.board());
        
        if (game.in_checkmate()) {
            game.undo();
            bestMove = move;
            break;
        }
        
        game.undo();

        if (move.captured) {
            score += (15 + PIECE_VALUES[move.captured]); 
        }
        if (move.promotion) {
            score += 90;
        }

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    if (!bestMove) bestMove = moves[Math.floor(Math.random() * moves.length)];

    game.move(bestMove);
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
                     
