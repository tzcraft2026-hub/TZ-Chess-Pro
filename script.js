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
var savedRoomId = "";

// Authentication & Account State System Variables
var isLoggedIn = false;
var currentUsername = "";
var currentAuthMode = 'signup'; 

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
    sScript.src = "https://tz-chess-pro.onrender.com/socket.io/socket.io.js";
    sScript.onload = function() {
        if (typeof io !== 'undefined') {
            isScriptLoaded = true;
            socket = io("https://tz-chess-pro.onrender.com");
            setupSocketListeners();
        }
    };
    sScript.onerror = function() {
        isScriptLoaded = false;
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

// SIGN IN VALIDATOR CONDITION FOR FRIEND BUTTON MOVEMENT
function checkFriendModeTrigger() {
    if (isLoggedIn) {
        showOnlineSetup();
    } else {
        $('.screen').hide();
        switchAuthMode('signup'); 
        $('#auth-screen').fadeIn().css('display', 'flex');
    }
}

// AUTH INTERFACE LINK TOGGLER SWITCHER SYSTEM
function switchAuthMode(mode) {
    currentAuthMode = mode;
    var submitBtn = document.getElementById('auth-submit-btn');
    var switchLink = document.getElementById('auth-switch-link-container');
    var authHeader = document.getElementById('auth-header');
    
    document.getElementById('auth-username').value = "";
    document.getElementById('auth-password').value = "";
    $('#auth-error-msg').hide();

    if(!submitBtn || !switchLink || !authHeader) return;

    if (mode === 'login') {
        authHeader.innerText = "Log in to play Friend Mode";
        submitBtn.innerText = "LOG IN";
        submitBtn.style.background = "#6b8e23"; 
        switchLink.innerHTML = 'Have not any account? <span onclick="switchAuthMode(\'signup\')">Sign In</span>';
    } else {
        authHeader.innerText = "Sign up to play Friend Mode";
        submitBtn.innerText = "CREATE NEW ACCOUNT";
        submitBtn.style.background = "#0288d1"; 
        switchLink.innerHTML = 'Already have an account? <span onclick="switchAuthMode(\'login\')">Log In</span>';
    }
}

// 🔥 GLOBAL FORM VALIDATION & SERVER TRANSMISSION PIPELINE
function performAuthSubmit() {
    var uField = document.getElementById('auth-username');
    var pField = document.getElementById('auth-password');
    var errEl = document.getElementById('auth-error-msg');

    if(!uField || !pField || !errEl) return;

    var username = uField.value.trim();
    var password = pField.value;

    // Validation: 6 to 20 characters
    if (username.length < 6 || username.length > 20) {
        errEl.innerText = "Username must be 6 to 20 characters!";
        $(errEl).show();
        return;
    }

    // Validation: 8+ characters
    if (password.length < 8) {
        errEl.innerText = "Password must be at least 8 characters long!";
        $(errEl).show();
        return;
    }

    $(errEl).hide();

    // Internet Connection Check
    if (!socket || !socket.connected) {
        errEl.innerText = "Connecting to TZ Server... Check your Internet!";
        $(errEl).show();
        return;
    }

    if (currentAuthMode === 'signup') {
        // 🔥 Server ko signup data bhej rahe hain validation ke liye
        socket.emit('serverRegisterUser', { username: username, password: password });
        errEl.innerText = "Creating account on cloud server...";
        $(errEl).show();
    } else {
        // 🔥 Server ko login validation data bhej rahe hain
        socket.emit('serverLoginUser', { username: username, password: password });
        errEl.innerText = "Verifying credentials...";
        $(errEl).show();
    }
}

function showOnlineSetup() {
    $('.screen').hide();
    $('#online-setup').fadeIn().css('display', 'flex');
    document.getElementById('room-id').value = ""; 
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
    
    if (ready) {
        clearInterval(countdownInterval);
        countdownInterval = null; 
        if(timerDiv) timerDiv.style.display = 'none';
        
        statusText.innerText = "● Server Connected (Ready)";
        statusText.style.color = "#8cb302";
        joinBtn.disabled = false;
        joinBtn.style.background = "#6b8e23";
    } else {
        statusText.innerText = "Please wait... Waking up Render Cloud Server.";
        statusText.style.color = "#ffeb3b";
        joinBtn.disabled = true;
        joinBtn.style.background = "#444";
        
        if(timerDiv && !countdownInterval && navigator.onLine) {
            timerDiv.style.display = 'block';
            countdownValue = 50;
            document.getElementById('timer-sec').innerText = countdownValue;
            
            countdownInterval = setInterval(function() {
                if (socket && socket.connected) {
                    updateServerStatus(true);
                    return;
                }
                countdownValue--;
                document.getElementById('timer-sec').innerText = countdownValue;
                
                if(countdownValue <= 0) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                    statusText.innerText = "Connecting... (Checking status)";
                }
            }, 1000);
        } else if (!navigator.onLine) {
            statusText.innerText = "⚠️ Please Turn On Your Internet Connection!";
            statusText.style.color = "#ff5252";
            if(timerDiv) timerDiv.style.display = 'none';
        }
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

    // 🔥 SERVER RESPONSE: SIGN UP SYSTEM HANDLER
    socket.on('authResponse', function(data) {
        var errEl = document.getElementById('auth-error-msg');
        if (data.success) {
            // Problem 1 Fix: Account bante hi direct dynamic login, no second steps!
            isLoggedIn = true;
            currentUsername = data.username;
            alert("Account Created & Logged In successfully as " + data.username + "! 🎉");
            $(errEl).hide();
            showOnlineSetup();
        } else {
            // Problem 2 Fix: Server check fail hone par (Username already exists) error alert trigger
            errEl.innerText = data.message || "Username already exists on server database!";
            $(errEl).show();
        }
    });

    // 🔥 SERVER RESPONSE: LOG IN SYSTEM HANDLER
    socket.on('loginResponse', function(data) {
        var errEl = document.getElementById('auth-error-msg');
        if (data.success) {
            isLoggedIn = true;
            currentUsername = data.username;
            alert("Welcome back " + data.username + "!");
            $(errEl).hide();
            showOnlineSetup();
        } else {
            errEl.innerText = data.message || "Invalid Username or Password!";
            $(errEl).show();
        }
    });

    socket.on('playerRole', function(role) { playerColor = role; });
    socket.on('gameStart', function() { initGame('online'); });
    socket.on('move', function(move) {
        game.move(move);
        board.position(game.fen());
        updateStatus();
    });

    socket.on('opponentDisconnected', function(data) {
        if (currentMode === 'online' && !game.game_over()) {
            saveStat('win'); 
            showGameOver("Opponent Left the Match! You Won. 🎉");
        }
    });

    socket.on('receiveRestartRequest', function() {
        if (currentMode === 'online' && !game.game_over()) {
            showOnlineRestartModal("Opponent restart the match?", function() {
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
        statusEl.innerText = "Opponent can not restart the match";
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
    
    clearInterval(countdownInterval);
    countdownInterval = null;

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
    noBtn.innerText = "NO";
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

function goBackToHome() {
    clearInterval(countdownInterval);
    countdownInterval = null;
    $('#game-over-overlay').hide();
    $('.screen').hide();
    $('#home-screen').fadeIn().css('display', 'flex');
    currentMode = null;
    savedRoomId = ""; 
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
    } else if ($('#online-setup').is(':visible') || $('#waiting-screen').is(':visible') || $('#auth-screen').is(':visible')) {
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
        
