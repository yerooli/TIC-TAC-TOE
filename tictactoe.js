
// GAME STATE MANAGEMENT

const PLAYER_X = "X";
const PLAYER_O = "O";

let gameMode = "single";
let currPlayer = PLAYER_X;
let gameBoard = ["", "", "", "", "", "", "", "", ""];
let gameOver = false;
let scores = { X: 0, O: 0 };
let targetWins = 2;

const WINNING_CONDITIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// AUDIO SYNTHESIZER / SOUND EFFECTS

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "click") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    } else if (type === "win") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === "draw") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}


// DOM ELEMENTS & INITIALIZATION

let gameCells, statusMessage, player1Input, player2Input;
let player1NameDisplay, player2NameDisplay, player1Score, player2Score;
let setupSection, gameArea, maxRoundsSelect;

window.onload = function () {
    gameCells = document.getElementsByClassName("game-cell");
    statusMessage = document.getElementById("statusMessage");
    player1Input = document.getElementById("player1Input");
    player2Input = document.getElementById("player2Input");
    player1NameDisplay = document.getElementById("player1NameDisplay");
    player2NameDisplay = document.getElementById("player2NameDisplay");
    player1Score = document.getElementById("player1Score");
    player2Score = document.getElementById("player2Score");
    setupSection = document.getElementById("setup-section");
    gameArea = document.getElementById("game-area");
    maxRoundsSelect = document.getElementById("maxRoundsSelect");

    for (let cell of gameCells) {
        cell.addEventListener("click", handleCellClick);
    }

    document.getElementById("singlePlayerBtn").addEventListener("click", () => setGameMode("single"));
    document.getElementById("twoPlayerBtn").addEventListener("click", () => setGameMode("two"));
    document.getElementById("start-game-btn").addEventListener("click", startGame);
    document.getElementById("game-restart-button").addEventListener("click", restartRound);
    document.getElementById("game-reset-button").addEventListener("click", showSetupScreen);

    player1Input.addEventListener("input", updateNames);
    player2Input.addEventListener("input", updateNames);
};


// SETUP & FLOW CONTROL

function setGameMode(mode) {
    playSound("click");
    gameMode = mode;
    document.getElementById("singlePlayerBtn").classList.toggle("active", mode === "single");
    document.getElementById("twoPlayerBtn").classList.toggle("active", mode === "two");

    if (mode === "single") {
        player2Input.value = "Computer";
        player2Input.disabled = true;
    } else {
        player2Input.value = "Player 2";
        player2Input.disabled = false;
    }
}

function startGame() {
    playSound("click");
    const selectedRounds = parseInt(maxRoundsSelect.value);
    if (selectedRounds === 1) targetWins = 1;
    else if (selectedRounds === 3) targetWins = 2;
    else if (selectedRounds === 5) targetWins = 3;

    scores = { X: 0, O: 0 };
    updateScoreboard();
    
    setupSection.classList.add("hidden");
    gameArea.classList.remove("hidden");

    updateNames();
    restartRound();
}

function showSetupScreen() {
    playSound("click");
    gameArea.classList.add("hidden");
    setupSection.classList.remove("hidden");
}

// CORE GAME LOGIC

function handleCellClick() {
    if (gameOver) return;
    if (gameMode === "single" && currPlayer === PLAYER_O) return;

    const index = parseInt(this.getAttribute("data-cell-index"));

    if (gameBoard[index] !== "") {
        triggerInvalidClickAnimation(this);
        return;
    }

    playSound("click");
    makeMove(index, currPlayer);

    if (!gameOver && gameMode === "single" && currPlayer === PLAYER_O) {
        statusMessage.innerText = `${getPlayerName(PLAYER_O)} is thinking...`;
        setTimeout(() => {
            makeComputerMove();
        }, 500);
    }
}

function makeMove(index, symbol) {
    gameBoard[index] = symbol;
    gameCells[index].innerText = symbol;

    const winResult = checkWinner(gameBoard);

    if (winResult) {
        gameOver = true;
        playSound("win");
        highlightWinningCells(winResult.condition);
        scores[symbol]++;
        updateScoreboard();

        if (scores[symbol] >= targetWins) {
            statusMessage.innerText = `🏆 ${getPlayerName(symbol)} Won the Match! 🎉`;
            document.getElementById("game-restart-button").style.display = "none";
        } else {
            statusMessage.innerText = `🎉 ${getPlayerName(symbol)} Wins Round!`;
        }
    } else if (isBoardFull(gameBoard)) {
        gameOver = true;
        playSound("draw");
        statusMessage.innerText = "🟰 Round Draw!";
    } else {
        switchTurn();
    }
}

function switchTurn() {
    currPlayer = (currPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;
    statusMessage.innerText = `${getPlayerName(currPlayer)}'s Turn (${currPlayer})`;
}


// AI COMPUTER LOGIC

function makeComputerMove() {
    let bestIndex = findWinningMove(gameBoard, PLAYER_O);

    if (bestIndex === null) {
        bestIndex = findWinningMove(gameBoard, PLAYER_X);
    }

    if (bestIndex === null) {
        const priorityList = [4, 0, 2, 6, 8, 1, 3, 5, 7];
        bestIndex = priorityList.find(idx => gameBoard[idx] === "");
    }

    if (bestIndex !== null && bestIndex !== undefined) {
        playSound("click");
        makeMove(bestIndex, PLAYER_O);
    }
}

function findWinningMove(board, symbol) {
    for (let i = 0; i < board.length; i++) {
        if (board[i] === "") {
            board[i] = symbol;
            const isWin = checkWinner(board);
            board[i] = "";
            if (isWin) return i;
        }
    }
    return null;
}

function checkWinner(board) {
    for (let condition of WINNING_CONDITIONS) {
        const [a, b, c] = condition;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], condition };
        }
    }
    return null;
}

function isBoardFull(board) {
    return !board.includes("");
}


// UI INTERFACE HELPERS

function updateNames() {
    const p1 = player1Input.value.trim() || "Player 1";
    const p2 = player2Input.value.trim() || (gameMode === "single" ? "Computer" : "Player 2");

    player1NameDisplay.innerText = `${p1} (${PLAYER_X})`;
    player2NameDisplay.innerText = `${p2} (${PLAYER_O})`;

    if (!gameOver) {
        statusMessage.innerText = `${getPlayerName(currPlayer)}'s Turn (${currPlayer})`;
    }
}

function getPlayerName(symbol) {
    if (symbol === PLAYER_X) return player1Input.value.trim() || "Player 1";
    return player2Input.value.trim() || (gameMode === "single" ? "Computer" : "Player 2");
}

function highlightWinningCells(winningIndices) {
    for (let index of winningIndices) {
        gameCells[index].classList.add("winning-game-cell");
    }
}

function triggerInvalidClickAnimation(cellElement) {
    cellElement.classList.add("invalid-cell");
    setTimeout(() => cellElement.classList.remove("invalid-cell"), 300);
}

function updateScoreboard() {
    player1Score.innerText = scores[PLAYER_X];
    player2Score.innerText = scores[PLAYER_O];
}

function restartRound() {
    playSound("click");
    if (scores[PLAYER_X] >= targetWins || scores[PLAYER_O] >= targetWins) {
        showSetupScreen();
        return;
    }

    gameOver = false;
    gameBoard = ["", "", "", "", "", "", "", "", ""];
    currPlayer = PLAYER_X;
    statusMessage.innerText = `${getPlayerName(currPlayer)}'s Turn (${currPlayer})`;

    for (let cell of gameCells) {
        cell.innerText = "";
        cell.classList.remove("winning-game-cell");
    }
    document.getElementById("game-restart-button").style.display = "inline-block";
}