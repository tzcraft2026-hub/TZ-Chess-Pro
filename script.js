var board = null;
var game = new Chess();
var socket = io();
var currentMode = null;
var selectedSquare = null;

// Stats Logic
var stats = JSON.parse(localStorage.getItem('tzStats')) || { wins: 0, losses: 0, total: 0 };

function updateStatsUI() {
    document.getElementById('stat-total').innerText = stats.total;
    document.getElementById('stat-wins').innerText = stats.wins;
    document.getElementById('stat-losses').innerText = stats.losses;
}
updateStatsUI();

// Navigation Functions
function initGame(mode) {
    currentMode = mode;
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    
    if(mode === 'bot') {
        game.reset();
        board.start();
        stats.total++;
        saveStats();
    } else {
        // Online logic yahan aayega
    }
}

function goToHome() {
    document.getElementById('home-screen').style.display = 'block';
    document.getElementById('game-screen').style.display = 'none';
}

function saveStats() {
    localStorage.setItem('tzStats', JSON.stringify(stats));
    updateStatsUI();
}

// Click to Move Logic
function removeDots() {
    $('.dot').remove();
}

function addDot(square) {
    var $square = $('#myBoard .square-' + square);
    $square.append('<div class="dot"></div>');
}

function onSquareClick(square) {
    // Agar pehle se piece selected hai, toh move karo
    if (selectedSquare) {
        var move = game.move({
            from: selectedSquare,
            to: square,
            promotion: 'q'
        });

        if (move === null) {
            // Galat move, selection reset karo
            selectedSquare = null;
            removeDots();
            highlightSquare(square); // Naya piece select karo
        } else {
            // Sahi move
            board.position(game.fen());
            selectedSquare = null;
            removeDots();
            checkGameOver();
            
            if (currentMode === 'bot' && !game.game_over()) {
                window.setTimeout(makeBotMove, 250);
            }
        }
    } else {
        highlightSquare(square);
    }
}

function highlightSquare(square) {
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
    checkGameOver();
}

function checkGameOver() {
    if (game.in_checkmate()) {
        if (game.turn() === 'b') { stats.wins++; alert("You Win!"); }
        else { stats.losses++; alert("You Lose!"); }
        saveStats();
    }
}

var config = {
    draggable: false, // Drag band kar diya
    position: 'start',
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};
board = Chessboard('myBoard', config);

// Click event listener
$('#myBoard').on('click', '.square-55d63', function() {
    var square = $(this).attr('data-square');
    onSquareClick(square);
});

function resetGame() {
    game.reset();
    board.start();
    stats.total++;
    saveStats();
}
