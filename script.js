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

var promotionPendingMove = null; 

// --- 🎵 ZERO-DELAY DUAL-ENGINE AUDIO BY TZ CRAFT ---
var soundEnabled = localStorage.getItem('tz_sound') !== 'false'; // Default ON
var musicEnabled = localStorage.getItem('tz_music') === 'true';   // Default OFF
var highlightEnabled = localStorage.getItem('tz_highlight') !== 'false';
var historyEnabled = localStorage.getItem('tz_history') !== 'false';
var evaluationEnabled = localStorage.getItem('tz_evaluation') !== 'false';

// Dual Engine Setup
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let moveSoundBuffer = null;

// Fallback Engine (Traditional Audio Class)
var fallbackMoveSound = new Audio('lib/move.mp3');
var captureSound = new Audio('lib/capture.mp3');
var checkSound = new Audio('lib/check.mp3');
var gameoverSound = new Audio('lib/gameover.mp3');

// Background Music setup
var bgMusic = new Audio('lib/bgm.mp3'); 
bgMusic.loop = true;
bgMusic.volume = 0.2; 

// Initializing Web Audio Context on safe side
try {
    audioCtx = new AudioContext();
} catch(e) {
    console.log("Web Audio Context not supported, using fallback.");
}

async function loadMoveSound(url) {
    if (!audioCtx) return;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error!`);
        const arrayBuffer = await response.arrayBuffer();
        moveSoundBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        console.log("TZ Chess Audio: High-speed buffer ready.");
    } catch (e) {
        console.error("Buffer load failed, fallback active:", e);
    }
}

// Pre-loading audio
loadMoveSound('lib/move.mp3'); 

function playMoveSound() {
    if (!soundEnabled) return;

    // 1. Pehle high-speed API try karein
    if (audioCtx && moveSoundBuffer) {
        try {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            const soundSource = audioCtx.createBufferSource();
            soundSource.buffer = moveSoundBuffer;
            soundSource.connect(audioCtx.destination);
            soundSource.start(0);
            return; // Agar successfully chal gaya toh yahi se return
        } catch (e) {
            console.log("Web Audio failed, running fallback...");
        }
    }

    // 2. Fallback Engine: Agar buffer block hai to direct track play hoga
    try {
        fallbackMoveSound.currentTime = 0; // Reset track to start
        fallbackMoveSound.play().catch(err => console.log("Audio play blocked:", err));
    } catch(err) {
        console.log("All audio engines blocked by browser rules:", err);
    }
}

function playBackgroundMusicForcefully() {
    if (musicEnabled) {
        bgMusic.play().then(() => {
            console.log("BGM started.");
        }).catch(e => {
            console.log("BGM pending gesture.");
        });
    }
}

function toggleSoundEffects() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('tz_sound', soundEnabled);
    updateSettingsButtons();
    if (soundEnabled && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function toggleBackgroundMusic() {
    musicEnabled = !musicEnabled;
    localStorage.setItem('tz_music', musicEnabled);
    updateSettingsButtons();
    
    if (musicEnabled) {
        bgMusic.play().catch(e => console.log("BGM needs interaction"));
    } else {
        bgMusic.pause();
    }
}

function toggleMoveHighlight() {
    highlightEnabled = !highlightEnabled;
    localStorage.setItem('tz_highlight', highlightEnabled);
    updateSettingsButtons();

    if (!highlightEnabled) {
        $(".lastmove").removeClass("lastmove");
    }
}

function toggleMoveHistory() {
    historyEnabled = !historyEnabled;
    localStorage.setItem('tz_history', historyEnabled);
    updateSettingsButtons();

    document.getElementById("move-history").style.display =
        historyEnabled ? "block" : "none";
}

function toggleEvaluation() {
    evaluationEnabled = !evaluationEnabled;
    localStorage.setItem('tz_evaluation', evaluationEnabled);
    updateSettingsButtons();

    document.getElementById("analysis-box").style.display =
        evaluationEnabled ? "block" : "none";
}

function updateSettingsButtons() {
    var soundBtn = document.getElementById('tz-sound-toggle');
    var musicBtn = document.getElementById('tz-music-toggle');
    
    var highlightBtn=document.getElementById("tz-highlight-toggle");
var historyBtn=document.getElementById("tz-history-toggle");
var evalBtn=document.getElementById("tz-analysis-toggle");

if(highlightBtn){
    highlightBtn.innerText = highlightEnabled ? "ON" : "OFF";

    if(highlightEnabled)
        highlightBtn.classList.remove("off");
    else
        highlightBtn.classList.add("off");
}

if(historyBtn){
    historyBtn.innerText = historyEnabled ? "ON" : "OFF";

    if(historyEnabled)
        historyBtn.classList.remove("off");
    else
        historyBtn.classList.add("off");
}

if(evalBtn){
    evalBtn.innerText = evaluationEnabled ? "ON" : "OFF";

    if(evaluationEnabled)
        evalBtn.classList.remove("off");
    else
        evalBtn.classList.add("off");
}
    
    if (soundBtn) {
        soundBtn.innerText = soundEnabled ? "ON" : "OFF";
        if (!soundEnabled) soundBtn.classList.add('off'); else soundBtn.classList.remove('off');
    }
    if (musicBtn) {
        musicBtn.innerText = musicEnabled ? "ON" : "OFF";
        if (!musicEnabled) musicBtn.classList.add('off'); else musicBtn.classList.remove('off');
    }
}

// --- 🤖 ULTRA-SMART ATTACKING ENGINE AI EVALUATION TABLES ---
var pawnEval = [
    [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    [5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0],
    [1.0,  1.0,  2.0,  3.5,  3.5,  2.0,  1.0,  1.0], 
    [0.5,  0.5,  1.5,  4.0,  4.0,  1.5,  0.5,  0.5], 
    [0.0,  0.0,  1.0,  3.0,  3.0,  1.0,  0.0,  0.0],
    [0.5, -0.5, -1.0,  1.0,  1.0, -1.0, -0.5,  0.5],
    [0.5,  1.0,  1.0, -2.0, -2.0,  1.0,  1.0,  0.5],
    [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
];

var knightEval = [
    [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0],
    [-4.0, -2.0,  0.0,  0.5,  0.5,  0.0, -2.0, -4.0],
    [-3.0,  0.5,  2.0,  2.5,  2.5,  2.0,  0.5, -3.0], 
    [-3.0,  1.0,  2.5,  3.5,  3.5,  2.5,  1.0, -3.0], 
    [-3.0,  1.0,  2.5,  3.5,  3.5,  2.5,  1.0, -3.0],
    [-3.0,  0.5,  2.0,  2.5,  2.5,  2.0,  0.5, -3.0],
    [-4.0, -2.0,  0.5,  1.0,  1.0,  0.5, -2.0, -4.0],
    [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0]
];

var bishopEval = [
    [-2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0],
    [-1.0,  0.5,  0.0,  0.0,  0.0,  0.0,  0.5, -1.0],
    [-1.0,  1.0,  1.0,  1.5,  1.5,  1.0,  1.0, -1.0],
    [-1.0,  0.5,  1.5,  2.0,  2.0,  1.5,  0.5, -1.0], 
    [-1.0,  1.0,  1.5,  2.0,  2.0,  1.5,  1.0, -1.0],
    [-1.0,  2.0,  1.5,  1.5,  1.5,  1.5,  2.0, -1.0], 
    [-1.0,  0.5,  0.0,  0.0,  0.0,  0.0,  0.5, -1.0],
    [-2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0]
];

var rookEval = [
    [ 0.0,  0.0,  0.0,  0.5,  0.5,  0.0,  0.0,  0.0],
    [ 1.0,  1.5,  1.5,  1.5,  1.5,  1.5,  1.5,  1.0], 
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [ 0.0,  0.0,  0.0,  0.8,  0.8,  0.0,  0.0,  0.0]
];

var queenEval = [
    [-2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0],
    [-1.0,  0.5,  0.5,  0.5,  0.5,  0.5,  0.5, -1.0],
    [-1.0,  0.5,  1.0,  1.0,  1.0,  1.0,  0.5, -1.0],
    [-0.5,  0.5,  1.0,  1.5,  1.5,  1.0,  0.5, -0.5], 
    [ 0.0,  0.5,  1.0,  1.5,  1.5,  1.0,  0.5, -0.5],
    [-1.0,  0.5,  1.0,  1.0,  1.0,  1.0,  0.5, -1.0],
    [-1.0,  0.5,  0.5,  0.5,  0.5,  0.5,  0.5, -1.0],
    [-2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0]
];

var kingEvalByColor = {
    w: [
        [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [-2.0, -3.0, -3.0, -4.0, -4.0, -3.0, -3.0, -2.0],
        [-1.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -1.0],
        [ 2.0,  2.0,  0.0,  0.0,  0.0,  0.0,  2.0,  2.0],
        [ 2.0,  3.0,  2.0,  0.0,  0.0,  2.0,  3.0,  2.0] 
    ],
    b: [
        [ 2.0,  3.0,  2.0,  0.0,  0.0,  2.0,  3.0,  2.0],
        [ 2.0,  2.0,  0.0,  0.0,  0.0,  0.0,  2.0,  2.0],
        [-1.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -1.0],
        [-2.0, -3.0, -3.0, -4.0, -4.0, -3.0, -3.0, -2.0],
        [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
        [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0]
    ]
};

// --- 🤖 HIGH-SPEED OPTIMIZED AI ENGINE (NO LAG FIX) ---
function evaluateBoard(gameObj) {
    var totalEvaluation = 0;
    if (gameObj.in_checkmate()) {
        return gameObj.turn() === 'w' ? -99999 : 99999; 
    }
    if (gameObj.in_check()) {
        totalEvaluation += gameObj.turn() === 'w' ? -10 : 10; 
    }

    var boardState = gameObj.board();
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            totalEvaluation += getPieceValue(boardState[i][j], i, j);
        }
    }
    return totalEvaluation;
}

function updateAnalysis(){

    if(!evaluationEnabled){
        document.getElementById("analysis-box").style.display="none";
        return;
    }

    document.getElementById("analysis-box").style.display="block";

    let score=evaluateBoard(game);

    document.getElementById("analysis-box").innerHTML="Evaluation : "+(score/10).toFixed(1);

}

function getPieceValue(piece, x, y) {
    if (piece === null) return 0;
    var value = 0;
    if (piece.type === 'p') value = 10 + pawnEval[x][y];
    else if (piece.type === 'r') value = 50 + rookEval[x][y];
    else if (piece.type === 'n') value = 30 + knightEval[x][y];
    else if (piece.type === 'b') value = 30 + bishopEval[x][y];
    else if (piece.type === 'q') value = 90 + queenEval[x][y];
    else if (piece.type === 'k') value = 900 + kingEvalByColor[piece.color][x][y];
    return piece.color === 'w' ? value : -value;
}

function getBasicPieceValue(type) {
    if (type === 'p') return 10;
    if (type === 'n') return 30;
    if (type === 'b') return 30;
    if (type === 'r') return 50;
    if (type === 'q') return 90;
    return 0;
}

function calculateBestMoveInstant(gameObj) {
    var newGameMoves = gameObj.moves();
    if (newGameMoves.length === 0) return null;

    var mtMove = newGameMoves.find(m => m.indexOf('#') !== -1);
    if (mtMove) return mtMove;

    var chkMove = newGameMoves.find(m => m.indexOf('+') !== -1);
    if (chkMove && Math.random() < 0.6) return chkMove; 

    var bestMove = null;
    var bestValue = (playerColor === 'b') ? -10000 : 10000;
    
    newGameMoves.sort(() => Math.random() - 0.5);

    for (var i = 0; i < newGameMoves.length; i++) {
        var move = newGameMoves[i];
        var moveValue = 0;
        
        if (move.indexOf('x') !== -1) {
            var parts = move.split('x');
            var targetSquare = parts[1] ? parts[1].substring(0, 2) : null;
            if (targetSquare) {
                var pieceOnTarget = gameObj.get(targetSquare);
                if (pieceOnTarget) {
                    moveValue += getBasicPieceValue(pieceOnTarget.type) * 10;
                }
            }
        }

        if (move.indexOf('d4') !== -1 || move.indexOf('d5') !== -1 || move.indexOf('e4') !== -1 || move.indexOf('e5') !== -1) {
            moveValue += 2;
        }

        if (move === 'O-O' || move === 'O-O-O') {
            moveValue += 5;
        }

        gameObj.move(move);
        if (playerColor === 'b') { 
            if (moveValue > bestValue) { bestValue = moveValue; bestMove = move; }
        } else { 
            if (moveValue < bestValue) { bestValue = moveValue; bestMove = move; }
        }
        gameObj.undo();
    }
    return bestMove || newGameMoves[0];
}

// 🔥 CORE BOT MOVE CALLER (FIXED: Realistic delayed response + guaranteed sound sync)
function makeBotMove() {
    if (game.game_over()) return;

    // Fixed thinking delay (800ms - 1200ms) for professional real chess feel
    var botThinkingDelay = Math.floor(Math.random() * 400) + 800; 

    setTimeout(function() {
        var bestMove = calculateBestMoveInstant(game);

if (bestMove) {

    var move = game.move(bestMove);

    board.position(game.fen());

    highlightLastMove(move);

    if(move.captured){
        captureSound.currentTime = 0;
        captureSound.play();
    }else{
        playMoveSound();
    }

    updateStatus();
}
        bindSquareClicks(); 
    }, botThinkingDelay); 
}

// --- ⚙️ UTILITIES & TOKENS GENERATORS ---
function triggerAndroidBtnHide() {
    if (typeof AndroidInterface !== 'undefined' && AndroidInterface.hideUpdateButton) {
        AndroidInterface.hideUpdateButton();
    }
}

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
    
    // Auto-trigger fallback for main screen if configuration allows
    if (musicEnabled) {
        bgMusic.play().catch(e => console.log("Click gesture pending for background track"));
    }

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

// --- ⚙️ MODAL CENTERED LAYOUT DISPLAY FIX ---
function openSettingsModal() {
    // Dynamic styling centered layout over the home layout as requested
    $('#tz-settings-modal').css({
        'display': 'flex',
        'justify-content': 'center',
        'align-items': 'center',
        'position': 'fixed',
        'top': '0',
        'left': '0',
        'width': '100%',
        'height': '100%',
        'z-index': '9999'
    }).fadeIn();
    
    updateSettingsButtons(); 
    
    if (typeof AndroidInterface !== 'undefined' && AndroidInterface.checkServerUpdateTrigger) {
        document.getElementById('update-status-text').innerText = "Checking for updates...";
        AndroidInterface.checkServerUpdateTrigger();
    } else {
        document.getElementById('update-status-text').innerText = "Your game is completely up to date.";
    }

    if (musicEnabled && bgMusic.paused) {
        bgMusic.play().catch(e => {});
    }
}

function closeSettingsModal() {
    $('#tz-settings-modal').fadeOut();
}

function showOnlineSetup() {
    if(document.getElementById('tz-settings-icon')) document.getElementById('tz-settings-icon').style.display = 'none';
    triggerAndroidBtnHide(); 
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
        
		highlightLastMove(move);
		
        // 🎵 Sound for online opponent move
        playMoveSound();
        
        updateStatus();
    });

    socket.on('opponentDisconnected', function(data) {
        if (currentMode === 'online') {
            if (!game.game_over()) {
                saveStat('win');
                showGameOver("Opponent Left the Match! You Won. 🎉");
            }
            if (socket && socket.connected) {
                socket.emit('leaveCurrentRoom');
            }
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
    if(document.getElementById('tz-settings-icon')) document.getElementById('tz-settings-icon').style.display = 'none';
    triggerAndroidBtnHide(); 
    currentMode = mode;
    $('.screen').hide();
    $('#game-screen').show().css('display', 'flex');
    
    // 🔥 FIXED: Direct user tap triggers instant song playback bypass
    playBackgroundMusicForcefully();

    // User interaction par WebAudio Engine ko explicitly active state me dalna
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    if (mode === 'bot') {
        playerColor = (Math.random() < 0.5) ? 'w' : 'b'; 
    } else if (mode === 'local') {
        playerColor = 'w'; 
    }

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

        if (mode === 'bot' && playerColor === 'b') {
            setTimeout(makeBotMove, 1000); 
        }
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
        if(game.turn() !== playerColor) return; 
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
    if (currentMode === 'bot') {
        playerColor = (Math.random() < 0.5) ? 'w' : 'b';
        if(board) board.orientation(playerColor === 'w' ? 'white' : 'black');
    }
    game.reset();
    board.start();
    updateStatus();
    bindSquareClicks();

    if (currentMode === 'bot' && playerColor === 'b') {
        setTimeout(makeBotMove, 1000);
    }
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
    if(document.getElementById('tz-settings-icon')) document.getElementById('tz-settings-icon').style.display = 'block';
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    if (socket && socket.connected) {
        socket.emit('leaveCurrentRoom');
    }

    $('#game-over-overlay').hide();
    $('#promotion-modal').hide(); 
    $('.screen').hide();
    
    $('#home-screen').fadeIn().css('display', 'flex');

    currentMode = null;
    savedRoomId = ""; 
    playerColor = 'w';
    document.getElementById('room-id').value = "";
    if (document.getElementById('room-display')) {
        document.getElementById('room-display').innerText = "";
    }
    
    location.hash = "mainmenu"; 
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

function onSquareClick(square) {
    if (game.game_over()) return;
    
    if (currentMode === 'online' && game.turn() !== playerColor) return; 
    if (currentMode === 'bot' && game.turn() !== playerColor) return;

    if (selectedSquare) {
        var piece = game.get(selectedSquare);
        var isPawn = piece && piece.type === 'p';
        var isCorrectTurn = piece && piece.color === game.turn();
        var targetRow = square.charAt(1);
        var isPromotionRow = (piece.color === 'w' && targetRow === '8') || (piece.color === 'b' && targetRow === '1');

        if (isPawn && isCorrectTurn && isPromotionRow) {
            var moves = game.moves({ square: selectedSquare, verbose: true });
            var isValidPromo = moves.some(m => m.to === square && m.flags.includes('p'));

            if (isValidPromo) {
                promotionPendingMove = { from: selectedSquare, to: square };
                
                var turnColor = game.turn(); 
                document.getElementById('promo-img-q').src = 'lib/' + turnColor + 'Q.png';
                document.getElementById('promo-img-r').src = 'lib/' + turnColor + 'R.png';
                document.getElementById('promo-img-b').src = 'lib/' + turnColor + 'B.png';
                document.getElementById('promo-img-n').src = 'lib/' + turnColor + 'N.png';

                $('#promotion-modal').fadeIn().css('display', 'flex');
                return; 
            }
        }

        var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (move === null) {
            selectedSquare = null;
            $('.dot').remove();
            highlight(square);
        } else {
            board.position(game.fen());

if(move.captured){
    if(soundEnabled){
        captureSound.currentTime = 0;
        captureSound.play();
    }
}else{
    playMoveSound();
}
			
			highlightLastMove(move);
			
            // 🎵 Dynamic Move Sound Trigger for User Move (Instant)
            

            if(currentMode === 'online') socket.emit('move', move);
            selectedSquare = null;
            $('.dot').remove();
            updateStatus();
            
            // Fixed Bot caller to await after user sound effect finishes smoothly
            if (currentMode === 'bot' && !game.game_over()) setTimeout(makeBotMove, 200);
        }
    } else {
        highlight(square);
    }
}

function selectPromotion(pieceType) {
    $('#promotion-modal').hide();

    if (promotionPendingMove) {
        var move = game.move({ 
            from: promotionPendingMove.from, 
            to: promotionPendingMove.to, 
            promotion: pieceType 
        });

        if (move !== null) {
            board.position(game.fen());
            
			highlightLastMove(move);
			
            // 🎵 Sound for Promotion Move (Instant)
            playMoveSound();

            if(currentMode === 'online' && socket && socket.connected) {
                socket.emit('move', move); 
            }
            updateStatus();
            if (currentMode === 'bot' && !game.game_over()) setTimeout(makeBotMove, 200);
        }
        
        promotionPendingMove = null;
        selectedSquare = null;
        $('.dot').remove();
        bindSquareClicks(); 
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

function updateMoveHistory(){

if(!historyEnabled){
    document.getElementById("move-history").style.display="none";
    return;
}

document.getElementById("move-history").style.display="block";

    let history=game.history();

    let txt="";

    for(let i=0;i<history.length;i+=2){

        txt+=(i/2+1)+". "+history[i];

        if(history[i+1])
            txt+=" "+history[i+1];

        txt+="<br>";
    }

    document.getElementById("move-history").innerHTML=txt;

}

function updateStatus() {
	     updateMoveHistory();
		 updateAnalysis();
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

            if(soundEnabled){
    checkSound.currentTime = 0;
    checkSound.play();
}

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

function highlightLastMove(move){

    if(!highlightEnabled) return;

    $(".lastmove").removeClass("lastmove");

    $(".square-"+move.from).addClass("lastmove");

    $(".square-"+move.to).addClass("lastmove");
}

function highlight(square) {
    var p = game.get(square);
    if (!p) return;
    if (currentMode === 'online' && p.color !== playerColor) return;
    
    if (currentMode === 'bot' && p.color !== playerColor) return;
    if (currentMode === 'local' && p.color !== game.turn()) return;

    var moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;
    selectedSquare = square;
    $('.dot').remove();
    moves.forEach(m => $('.square-' + m.to).append('<div class="dot"></div>'));
}

function showGameOver(msg) {
	
	if(soundEnabled){
    gameoverSound.currentTime = 0;
    gameoverSound.play();
}
	
    document.getElementById('winner-text').innerText = msg;
    $('#game-over-overlay').fadeIn().css('display', 'flex');
}

function onUpdateCheckResult(isAvailable, versionName, changelogText) {
    var statusText = document.getElementById('update-status-text');
    var actionBtn = document.getElementById('tz-update-action-btn');
    
    if (!navigator.onLine || changelogText === 'OFFLINE') {
        if(statusText) statusText.innerText = "Turn on internet to check available updates";
        if(actionBtn) {
            actionBtn.innerText = "RETRY";
            actionBtn.style.display = "block";
            actionBtn.onclick = function() { openSettingsModal(); };
        }
        return; 
    }
    
    serverUpdateData = { name: versionName, desc: changelogText };

    if (isAvailable) {
        if(statusText) statusText.innerText = "New Version " + versionName + " Available!";
        if(actionBtn) {
            actionBtn.innerText = "VIEW UPDATE";
            actionBtn.style.display = "block";
        }
    } else {
        if(statusText) statusText.innerText = "Your game is completely up to date.";
        if(actionBtn) actionBtn.style.display = "none";
    }
}

function triggerUpdateFlow() {
    if (serverUpdateData && serverUpdateData.name !== "") {
        closeSettingsModal();
        document.getElementById('changelog-title').innerText = "New Update Available! (" + serverUpdateData.name + ")";
        document.getElementById('changelog-body').innerHTML = serverUpdateData.desc.replace(/\n/g, "<br>");
        $('#tz-changelog-modal').css('display', 'flex').fadeIn();
    }
}

function closeChangelogModal() {
    $('#tz-changelog-modal').fadeOut();
}

function startAndroidDownload() {
    closeChangelogModal();
    if (typeof AndroidInterface !== 'undefined' && AndroidInterface.startDownloadFromJS) {
        AndroidInterface.startDownloadFromJS();
    }
}