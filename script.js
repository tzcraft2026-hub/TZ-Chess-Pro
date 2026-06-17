var board = null;
var game = new Chess();
var socket = null;
var currentMode = null;
var selectedSquare = null;
var playerColor = 'w'; 
var isOnlineReady = false;
var countdownInterval = null;
var countdownValue = 50;
var isScriptLoaded = false;
var savedRoomId = ""; // Purani room memory trace ko clean karne ke liye

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

function tryLoadingSocketEngine() {
    if (!navigator.onLine || isScriptLoaded) return;

    var sScript = document.createElement('script');
    
    if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        sScript.src = "https://tz-chess-pro.onrender.com/socket.io/socket.io.js";
    } else {
        sScript.src = window.location.origin + "/socket.io/socket.io.js";
    }
    
    sScript.onload = function() {
        if (typeof io !== 'undefined') {
            isScriptLoaded = true;
            if (window.location.protocol === 'file:') {
                socket = io("https://tz-chess-pro.onrender.com");
            } else {
                socket = io(); 
            }
            setupSocketListeners();
        }
    };
    sScript.onerror = function() {
        sScript.src = "https://tz-chess-pro.onrender.com/socket.io/socket.io.js";
        socket = io("https://tz-chess-pro.onrender.com");
    };
    document.head.appendChild(sScript);
}

window.onload = function() {
    displayStats();
    tryLoadingSocketEngine();
    
    setInterval(function() {
        if (!isScriptLoaded) {
            tryLoadingSocketEngine();
        } else if (socket && !socket.connected && navigator.onLine) {
            socket.connect();
        }
    }, 3000);
};

window.onbeforeunload = function() {
    if (socket && socket.connected && currentMode === 'online') {
        socket.emit('leaveCurrentRoom');
    }
};

function toggleMenuDropdown() {
    document.getElementById("myDropdown").classList.toggle("show");
}

window.onclick = function(event) {
    if (!event.target.matches('.btn-menu-dots')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

function showOnlineSetup() {
    $('.screen').hide();
    $('#online-setup').fadeIn().css('display', 'flex');
    document.getElementById('room-id').value = ""; 
    
    var timerDiv = document.getElementById('countdown-timer');
    if (timerDiv) timerDiv.style.display = 'none';

    if (socket && socket.connected) {
        updateServerStatus(true);
    } else {
        updateServerStatus(false);
    }
}

function updateServerStatus(ready) {
    var statusText = document.getElementById('server-status');
    var joinBtn = document.getElementById('btn-join');
    var timerDiv = document.getElementById('countdown-timer');
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    if (timerDiv) timerDiv.style.display = 'none';

    if (!navigator.onLine) {
        statusText.innerText = "⚠️ Please Turn On Your Internet Connection!";
        statusText.style.color = "#ff5252";
        joinBtn.disabled = true;
        joinBtn.style.background = "#444";
    } else if (ready) {
        statusText.innerText = "● Server Connected (Ready)";
        statusText.style.color = "#8cb302";
        joinBtn.disabled = false;
        joinBtn.style.background = "#6b8e23";
    } else {
        statusText.innerText = "Connecting to Server...";
        statusText.style.color = "#ffeb3b";
        joinBtn.disabled = true;
        joinBtn.style.background = "#444";
    }
}

function joinRoom() {
    var roomId = document.getElementById('room-id').value;
    if (!roomId) return alert("Room ID required!");
    savedRoomId = roomId; 
    $('.screen').hide();
    $('#waiting-screen').show().css('display', 'flex');
    $('#waiting-room-name').text("Room: " + roomId);
    socket.emit('joinRoom', roomId);
    document.getElementById('room-display').innerText = "Room: " + roomId;
}

function setupSocketListeners() {
    socket.on('connect', function() {
        isOnlineReady = true;
        if($('#online-setup').is(':visible')) updateServerStatus(true);
    });
    socket.on('disconnect', function() {
        isOnlineReady = false;
        if($('#online-setup').is(':visible')) updateServerStatus(false);
    });
    socket.on('playerRole', function(role) { playerColor = role; });
    socket.on('gameStart', function() { initGame('online'); });
    socket.on('move', function(move) {
        game.move(move);
        board.position(game.fen());
        updateStatus();
    });

    // 🔥 BUG FIX: Jab opponent disconnect ho, toh variables completely clean ho jayein
    socket.on('opponentDisconnected', function(data) {
        if (currentMode === 'online' && !game.game_over()) {
            saveStat('win'); 
            showGameOver("Opponent Left the Match! You Won. 🎉");
            // Soft reset fields to prevent auto-rejoin bug
            savedRoomId = "";
            currentMode = null;
        }
    });

    socket.on('receiveRestartRequest', function() {
        if (currentMode === 'online' && !game.game_over()) {
            showOnlineRestartModal("Opponent wants to restart the match?", function() {
                socket.emit('acceptRestart');
                executeLocalReset();
            }, function() {
                socket.emit('declineRestart');
            });
        }
    });

    socket.on('restartAccepted', function() {
        executeLocalReset();
    });

    socket.on('restartDeclined', function() {
        var statusEl = document.getElementById('status');
        statusEl.innerText = "Opponent does not want to restart the match";
        statusEl.style.color = "#ff5252"; 
        setTimeout(() => {
            updateStatus();
            statusEl.style.color = "#fff"; 
        }, 4000);
    });
}

function initGame(mode) {
    currentMode = mode;
    $('.screen').hide();
    $('#game-screen').show().css('display', 'flex');
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    if (mode === 'bot' || mode === 'local') playerColor = 'w';

    if (mode === 'online') {
        document.getElementById('menu-undo-btn').style.display = 'none';
        document.getElementById('btn-play-again').style.display = 'none';
    } else {
        document.getElementById('menu-undo-btn').style.display = 'block';
        document.getElementById('btn-play-again').style.display = 'block';
    }

    setTimeout(() => {
        if(board) board.destroy();
        board = Chessboard('myBoard', {
            draggable: false, 
            position: 'start',
            orientation: playerColor === 'w' ? 'white' : 'black',
            pieceTheme: 'lib/{piece}.png'
        });
        game.reset();
        updateStatus();
        bindSquareClicks(); 
    }, 300);
}

function showConfirmModal(message, yesCallback) {
    document.getElementById('confirm-message').innerText = message;
    document.getElementById('confirm-yes-btn').innerText = "YES";
    document.getElementById('confirm-no-btn').innerText = "NO";
    document.getElementById('custom-confirm-box').style.display = 'flex';
    
    document.getElementById('confirm-yes-btn').onclick = function() {
        closeConfirmModal();
        yesCallback();
    };
    document.getElementById('confirm-no-btn').onclick = function() {
        closeConfirmModal();
    };
}

function showOnlineRestartModal(message, restartCallback, noCallback) {
    document.getElementById('confirm-message').innerText = message;
    var yesBtn = document.getElementById('confirm-yes-btn');
    var noBtn = document.getElementById('confirm-no-btn');
    
    yesBtn.innerText = "RESTART";
    noBtn.innerText = "CANCEL"; 
    document.getElementById('custom-confirm-box').style.display = 'flex';
    
    yesBtn.onclick = function() {
        closeConfirmModal();
        restartCallback();
    };
    noBtn.onclick = function() {
        closeConfirmModal();
        noCallback();
    };
}

function closeConfirmModal() {
    document.getElementById('custom-confirm-box').style.display = 'none';
}

function triggerUndo() {
    if (game.game_over() || currentMode === 'online') return;
    
    if (currentMode === 'bot') {
        game.undo(); game.undo();
        board.position(game.fen());
        updateStatus();
    } else if (currentMode === 'local') {
        game.undo();
        board.position(game.fen());
        updateStatus();
    }
}

function triggerRestart() {
    showConfirmModal("You want to restart the match?", function() {
        if (currentMode === 'online') {
            if (socket && socket.connected) {
                socket.emit('requestRestart');
            }
        } else {
            executeLocalReset();
        }
    });
}

function executeLocalReset() {
    game.reset();
    board.start();
    updateStatus();
    bindSquareClicks();
}

function triggerExitMatch() {
    showConfirmModal("You want to exit the match?", function() {
        if (currentMode === 'online' && socket && socket.connected) {
            socket.emit('leaveCurrentRoom');
        }
        goBackToHome();
    });
}

// 🔥 BUG FIX: Room memory strings aur Mode state variables ko fully zero state par lana
function goBackToHome() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // Forcefully remove socket listening room state inside client engine
    if (currentMode === 'online' && socket && socket.connected) {
        socket.emit('leaveCurrentRoom');
    }

    $('#game-over-overlay').hide();
    $('.screen').hide();
    $('#home-screen').fadeIn().css('display', 'flex');
    
    // Sab variables ko clean aur reset kar diya taaki auto-join glitch na ho
    currentMode = null;
    savedRoomId = ""; 
    document.getElementById('room-id').value = "";
    document.getElementById('room-display').innerText = "";
}

function triggerPlayAgain() {
    $('#game-over-overlay').hide();
    if (currentMode === 'bot' || currentMode === 'local') {
        initGame(currentMode);
    }
}

function handleAndroidBackButton() {
    if ($('#game-screen').is(':visible')) {
        triggerExitMatch();
    } else if ($('#online-setup').is(':visible') || $('#waiting-screen').is(':visible')) {
        goBackToHome();
    } else if ($('#home-screen').is(':visible')) {
        showConfirmModal("You want to exit the game?", function() {
            if (typeof AndroidInterface !== 'undefined' && AndroidInterface.exitApp) {
                AndroidInterface.exitApp();
            } else {
                location.reload(); 
            }
        });
    }
}

function bindSquareClicks() {
    $(document).off('click touchend', '[class^="square-"]');
    $(document).on('click touchend', '[class^="square-"]', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var square = $(this).attr('data-square');
        if (!square) {
            var classes = $(this).attr('class').split(' ');
            var sqClass = classes.find(c => c.indexOf('square-') === 0);
            if (sqClass) square = sqClass.split('-')[1];
        }
        if (square) onSquareClick(square);
    });
}

// ... rest of code stays exactly same ...

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
            if (currentMode === 'bot' && !game.game_over()) setTimeout(makeBotMove, 500);
        }
    } else {
        highlight(square);
    }
}

function updateCapturedDisplay() {
    const history = game.history({ verbose: true });
    const blackCapturedByWhite = [];
    const whiteCapturedByBlack = [];
    history.forEach(move => {
        if (move.captured) {
            if (move.color === 'w') blackCapturedByWhite.push('b' + move.captured.toUpperCase());
            else whiteCapturedByBlack.push('w' + move.captured.toUpperCase());
        }
    });
    if (currentMode === 'local' || playerColor === 'w') {
        renderPieceImages('captured-top', whiteCapturedByBlack);
        renderPieceImages('captured-bottom', blackCapturedByWhite);
    } else {
        renderPieceImages('captured-top', blackCapturedByWhite);
        renderPieceImages('captured-bottom', whiteCapturedByBlack);
    }
}

// ... keeping render and logic states as is ...
function renderPieceImages(elementId, pieces) {
    const container = document.getElementById(elementId);
    container.innerHTML = "";
    pieces.forEach(p => {
        const img = document.createElement('img');
        img.src = `lib/${p}.png`;
        container.appendChild(img);
    });
}

function updateStatus() {
    var statusEl = document.getElementById('status');
    $('.check-square').removeClass('check-square');
    statusEl.className = "";
    updateCapturedDisplay();

    if (game.in_checkmate()) {
        if (currentMode === 'local') {
            var winner = (game.turn() === 'w') ? "Black" : "White";
            showGameOver("Checkmate! " + winner + " Wins.");
        } else {
            if (game.turn() === playerColor) { saveStat('loss'); showGameOver("You Lost! Checkmate."); }
            else { saveStat('win'); showGameOver("Victory! You Won."); }
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
    if (!p) return;
    if (currentMode === 'online' && p.color !== playerColor) return;
    if (currentMode === 'bot' && p.color === 'b') return;
    if (currentMode === 'local' && p.color !== game.turn()) return;

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
    if (moves.length === 0) return;
    game.move(moves[Math.floor(Math.random() * moves.length)]);
    board.position(game.fen());
    updateStatus();
    bindSquareClicks(); 
    }
    
