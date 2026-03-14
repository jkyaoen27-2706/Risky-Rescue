// Game Configuration
// Can be overridden by config.js or URL parameters
let CONFIG = {
    GOOGLE_CLIENT_ID: '', // Set this in config.js or URL params
    GOOGLE_API_KEY: '', // Set this in config.js or URL params
    SHEET_ID: '', // Set this in config.js or URL params
    MAZE_SIZE: 12, // 12x12 grid
    QUESTIONS_PER_MAZE: 8,
    BONUS_QUESTIONS: 1,
    DEAD_ENDS: 3,
    WRONG_ANSWER_PENALTY: 5, // seconds
    BONUS_REWARD: 10 // seconds
};

// Load config from config.js or URL parameters
function loadConfig() {
    // First, try to load from window.CONFIG (set by config.js)
    if (typeof window !== 'undefined' && window.CONFIG) {
        if (window.CONFIG.GOOGLE_CLIENT_ID && window.CONFIG.GOOGLE_CLIENT_ID !== 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
            CONFIG.GOOGLE_CLIENT_ID = window.CONFIG.GOOGLE_CLIENT_ID;
        }
        if (window.CONFIG.GOOGLE_API_KEY && window.CONFIG.GOOGLE_API_KEY !== 'YOUR_API_KEY_HERE') {
            CONFIG.GOOGLE_API_KEY = window.CONFIG.GOOGLE_API_KEY;
        }
        if (window.CONFIG.SHEET_ID && window.CONFIG.SHEET_ID !== 'YOUR_SHEET_ID_HERE') {
            CONFIG.SHEET_ID = window.CONFIG.SHEET_ID;
        }
    }
    
    // Override with URL parameters if present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('clientId')) CONFIG.GOOGLE_CLIENT_ID = urlParams.get('clientId');
    if (urlParams.get('apiKey')) CONFIG.GOOGLE_API_KEY = urlParams.get('apiKey');
    if (urlParams.get('sheetId')) CONFIG.SHEET_ID = urlParams.get('sheetId');
}

// Game State
let gameState = {
    playerName: '',
    currentMaze: 1,
    startTime: null,
    elapsedTime: 0,
    penaltyTime: 0,
    timerStarted: false,
    timerPaused: false,
    pauseStartTime: null,
    totalPausedTime: 0,
    questions: [],
    googleSignedIn: false,
    token: null,
    maze: null,
    playerPos: { row: 0, col: 0 },
    revealed: new Set(),
    traversed: new Set(),
    deadEnds: new Set(),
    questionSquares: new Map(),
    bonusSquares: new Set(),
    answeredQuestions: new Set(),
    questionAttempts: new Map()
};

// Initialize Google APIs
let gapiLoaded = false;
let gisLoaded = false;

// Callbacks for Google API loading
function gapiLoadedCallback() {
    gapiLoaded = true;
}

function gisLoadedCallback() {
    gisLoaded = true;
    // Initialize sign-in button on starting screen if it exists and Google Identity is ready
    const startingScreen = document.getElementById('startingScreen');
    if (startingScreen && (startingScreen.classList.contains('active') || startingScreen.style.display !== 'none')) {
        if (CONFIG.GOOGLE_CLIENT_ID && !CONFIG.GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
            // Use the improved initialization
            const signInDiv = document.getElementById('googleSignInButtonStart');
            if (signInDiv && signInDiv.children.length === 0) {
                if (window.google && window.google.accounts && window.google.accounts.id) {
                    try {
                        window.google.accounts.id.initialize({
                            client_id: CONFIG.GOOGLE_CLIENT_ID,
                            callback: handleCredentialResponse
                        });
                        
                        window.google.accounts.id.renderButton(
                            signInDiv,
                            { theme: 'dark', size: 'large', text: 'signin_with' }
                        );
                    } catch (error) {
                        console.error('Error rendering Google Sign-In button:', error);
                    }
                }
            }
        }
    }
}

// Set up callbacks if Google APIs are loaded
if (typeof window !== 'undefined') {
    window.gapiLoaded = gapiLoadedCallback;
    window.gisLoaded = gisLoadedCallback;
}

// Initialize Google Sign-In
function initializeGoogleSignIn(buttonId) {
    if (!window.google || !window.google.accounts) {
        // Retry after a delay
        setTimeout(() => initializeGoogleSignIn(buttonId), 200);
        return;
    }
    
    if (!CONFIG.GOOGLE_CLIENT_ID || CONFIG.GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
        // Hide sign-in button if not configured
        const signInDiv = document.getElementById(buttonId);
        if (signInDiv) signInDiv.style.display = 'none';
        return;
    }
    
    try {
        window.google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse
        });

        window.google.accounts.id.renderButton(
            document.getElementById(buttonId),
            { theme: 'dark', size: 'large', text: 'signin_with' }
        );
    } catch (error) {
        console.error('Error initializing Google Sign-In:', error);
        const signInDiv = document.getElementById(buttonId);
        if (signInDiv) signInDiv.style.display = 'none';
    }
}

async function handleCredentialResponse(response) {
    gameState.googleSignedIn = true;
    gameState.token = response.credential;
    
    // Initialize Google API after sign-in
    const apiInitialized = await initGoogleAPI();
    
    if (apiInitialized) {
        // Check dates and load questions
        try {
            const dates = await readSheetDates();
            const today = new Date().toISOString().split('T')[0];
            
            if (today < dates.openDate || today > dates.closeDate) {
                showScreen('closedScreen');
                return;
            }
            
            // Load questions
            await loadQuestions();
        } catch (error) {
            console.error('Error loading game data:', error);
            // Continue with default questions
            gameState.questions = getDefaultQuestions();
        }
    }
    
    // Show success message and proceed to intro
    const errorDiv = document.getElementById('startError') || document.getElementById('introError');
    if (errorDiv) {
        errorDiv.textContent = 'Signed in successfully!';
        setTimeout(() => {
            errorDiv.textContent = '';
            showIntroScreen1();
        }, 1000);
    } else {
        showIntroScreen1();
    }
}

function playAsGuestFromStart() {
    // Use default questions, no Google API needed
    gameState.questions = getDefaultQuestions();
    gameState.googleSignedIn = false;
    showIntroScreen1();
}

function playAsGuest() {
    const name = document.getElementById('playerName').value.trim();
    if (!name) {
        const errorDiv = document.getElementById('introError');
        if (errorDiv) {
            errorDiv.textContent = 'Please enter your name';
        }
        return;
    }
    startGame();
}

// Show starting screen
function showStartingScreen() {
    // Hide loading screen
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    // Make sure starting screen is visible
    const startingScreen = document.getElementById('startingScreen');
    if (startingScreen) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
            screen.style.display = 'none';
        });
        startingScreen.classList.add('active');
        startingScreen.style.display = 'block';
    }
    
    // Initialize Google Sign-In button immediately if Google Identity is ready
    const signInDiv = document.getElementById('googleSignInButtonStart');
    
    if (!CONFIG.GOOGLE_CLIENT_ID || CONFIG.GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
        // Hide sign-in button if not configured
        if (signInDiv) signInDiv.style.display = 'none';
        return;
    }
    
    // Try to initialize Google Sign-In button
    function tryInitSignIn(attempts = 0) {
        if (window.google && window.google.accounts && window.google.accounts.id) {
            // Google Identity Services is ready, initialize button
            try {
                window.google.accounts.id.initialize({
                    client_id: CONFIG.GOOGLE_CLIENT_ID,
                    callback: handleCredentialResponse
                });
                
                window.google.accounts.id.renderButton(
                    signInDiv,
                    { theme: 'dark', size: 'large', text: 'signin_with' }
                );
            } catch (error) {
                console.error('Error rendering Google Sign-In button:', error);
                // Fallback: show manual button
                signInDiv.innerHTML = '<button onclick="manualGoogleSignIn()" style="min-width: 200px;">Sign in with Google</button>';
            }
        } else if (attempts < 20) {
            // Keep trying for up to 4 seconds (20 * 200ms)
            setTimeout(() => tryInitSignIn(attempts + 1), 200);
        } else {
            // Timeout: show fallback button
            if (signInDiv && signInDiv.children.length === 0) {
                signInDiv.innerHTML = '<button onclick="manualGoogleSignIn()" style="min-width: 200px;">Sign in with Google</button>';
            }
        }
    }
    
    // Start trying immediately
    tryInitSignIn();
}

// Intro screen navigation
function showIntroScreen1() {
    showScreen('introScreen1');
}

function showIntroScreen2() {
    showScreen('introScreen2');
}

function showIntroScreen3() {
    showScreen('introScreen3');
}

// Read dates from Google Sheet
async function readSheetDates() {
    if (!CONFIG.SHEET_ID || CONFIG.SHEET_ID.includes('YOUR_SHEET_ID') || !window.gapi || !window.gapi.client) {
        // Fallback: allow game to proceed if sheet ID not configured
        return { openDate: '2000-01-01', closeDate: '2099-12-31' };
    }

    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SHEET_ID,
            range: 'Sheet1!C4:C5'
        });

        const values = response.result.values;
        return {
            openDate: values[0]?.[0] || '2000-01-01',
            closeDate: values[1]?.[0] || '2099-12-31'
        };
    } catch (error) {
        console.error('Error reading dates:', error);
        // Fallback: allow game to proceed
        return { openDate: '2000-01-01', closeDate: '2099-12-31' };
    }
}

// Load questions from Google Sheet
async function loadQuestions() {
    if (!CONFIG.SHEET_ID || CONFIG.SHEET_ID.includes('YOUR_SHEET_ID') || !window.gapi || !window.gapi.client) {
        // Use default questions if sheet not configured
        gameState.questions = getDefaultQuestions();
        return;
    }

    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SHEET_ID,
            range: 'Sheet1!C:H'
        });

        const rows = response.result.values || [];
        gameState.questions = rows
            .filter(row => row.length >= 6 && row[0]) // Has question and at least 4 options + answer
            .map(row => ({
                question: row[0],
                options: [row[1], row[2], row[3], row[4]],
                correctAnswer: row[5]
            }));
        
        if (gameState.questions.length === 0) {
            gameState.questions = getDefaultQuestions();
        }
    } catch (error) {
        console.error('Error loading questions:', error);
        gameState.questions = getDefaultQuestions();
    }
}

function getDefaultQuestions() {
    return [
        { question: 'What is the capital of France?', options: ['London', 'Berlin', 'Paris', 'Madrid'], correctAnswer: 'Paris' },
        { question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correctAnswer: '4' },
        { question: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], correctAnswer: 'Mercury' },
        { question: 'What is the largest ocean?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctAnswer: 'Pacific' },
        { question: 'How many continents are there?', options: ['5', '6', '7', '8'], correctAnswer: '7' },
        { question: 'What is the chemical symbol for water?', options: ['H2O', 'CO2', 'O2', 'NaCl'], correctAnswer: 'H2O' },
        { question: 'Which year did World War II end?', options: ['1943', '1944', '1945', '1946'], correctAnswer: '1945' },
        { question: 'What is the speed of light?', options: ['300,000 km/s', '150,000 km/s', '450,000 km/s', '600,000 km/s'], correctAnswer: '300,000 km/s' },
        { question: 'Who wrote Romeo and Juliet?', options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], correctAnswer: 'William Shakespeare' },
        { question: 'What is the smallest prime number?', options: ['0', '1', '2', '3'], correctAnswer: '2' },
        { question: 'Which gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], correctAnswer: 'Carbon Dioxide' },
        { question: 'What is the largest mammal?', options: ['Elephant', 'Blue Whale', 'Giraffe', 'Hippopotamus'], correctAnswer: 'Blue Whale' },
        { question: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], correctAnswer: '6' },
        { question: 'What is the freezing point of water in Celsius?', options: ['-10°C', '0°C', '10°C', '100°C'], correctAnswer: '0°C' }
    ];
}

// Screen Management
function showScreen(screenId) {
    // Hide loading screen if it exists
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    // Hide all screens first
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    // Show the requested screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.style.display = 'block';
    }
}

// Start Game
function startGame() {
    const name = document.getElementById('playerName').value.trim();
    if (!name) {
        const errorDiv = document.getElementById('introError');
        if (errorDiv) {
            errorDiv.textContent = 'Please enter your name';
        }
        return;
    }
    
    gameState.playerName = name;
    gameState.currentMaze = 1;
    gameState.startTime = null;
    gameState.elapsedTime = 0;
    gameState.penaltyTime = 0;
    gameState.timerStarted = false;
    gameState.timerPaused = false;
    gameState.pauseStartTime = null;
    gameState.totalPausedTime = 0;
    gameState.revealed = new Set();
    gameState.traversed = new Set();
    gameState.deadEnds = new Set();
    gameState.questionSquares = new Map();
    gameState.bonusSquares = new Set();
    gameState.answeredQuestions = new Set();
    gameState.questionAttempts = new Map();
    
    generateMaze();
    renderMaze();
    updateTimer(); // Initialize timer display but don't start counting
    showScreen('gameScreen');
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyPress);
}

function handleKeyPress(event) {
    if (!document.getElementById('gameScreen').classList.contains('active')) return;
    
    const keyMap = {
        'ArrowUp': 'up',
        'ArrowDown': 'down',
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
        'w': 'up',
        'W': 'up',
        's': 'down',
        'S': 'down',
        'a': 'left',
        'A': 'left',
        'd': 'right',
        'D': 'right'
    };
    
    if (keyMap[event.key]) {
        event.preventDefault();
        movePlayer(keyMap[event.key]);
    }
}

// Maze Generation
function generateMaze() {
    const size = CONFIG.MAZE_SIZE;
    const maze = Array(size).fill(null).map(() => Array(size).fill(false));
    const visited = Array(size).fill(null).map(() => Array(size).fill(false));
    
    // Generate a valid path from start to end
    const correctPath = generateCorrectPath(size);
    
    // Mark correct path
    correctPath.forEach(({ row, col }) => {
        maze[row][col] = true;
    });
    
    // Place questions on correct path (ensuring at least 6 are on the path)
    const questionIndices = selectQuestionSquares(correctPath);
    questionIndices.forEach((idx, i) => {
        const pos = correctPath[idx];
        const key = `${pos.row},${pos.col}`;
        gameState.questionSquares.set(key, i);
    });
    
    // Randomly select 1 bonus square from the question squares
    const questionKeys = Array.from(gameState.questionSquares.keys());
    const bonusKeys = questionKeys
        .sort(() => Math.random() - 0.5)
        .slice(0, CONFIG.BONUS_QUESTIONS);
    bonusKeys.forEach(key => gameState.bonusSquares.add(key));
    
    // Add branches and dead ends
    addBranchesAndDeadEnds(maze, correctPath, size);
    
    gameState.maze = maze;
    gameState.playerPos = { row: 0, col: 0 };
    gameState.revealed.clear();
    gameState.traversed.clear();
    gameState.deadEnds.clear();
    
    // Reveal starting position
    revealSquare(0, 0);
}

function generateCorrectPath(size) {
    const path = [{ row: 0, col: 0 }];
    const visited = new Set(['0,0']);
    let current = { row: 0, col: 0 };
    
    while (current.row !== size - 1 || current.col !== size - 1) {
        const neighbors = getValidNeighbors(current.row, current.col, size)
            .filter(n => !visited.has(`${n.row},${n.col}`));
        
        if (neighbors.length === 0) {
            // Backtrack if stuck
            path.pop();
            if (path.length === 0) break;
            current = path[path.length - 1];
            continue;
        }
        
        // Prefer moving towards end
        const towardsEnd = neighbors.filter(n => 
            n.row >= current.row && n.col >= current.col
        );
        
        const candidates = towardsEnd.length > 0 ? towardsEnd : neighbors;
        const next = candidates[Math.floor(Math.random() * candidates.length)];
        
        path.push(next);
        visited.add(`${next.row},${next.col}`);
        current = next;
    }
    
    return path;
}

function selectQuestionSquares(path) {
    // Ensure at least 6 questions are on the path
    const minQuestions = 6;
    const totalQuestions = CONFIG.QUESTIONS_PER_MAZE;
    
    // Select indices ensuring good distribution
    const indices = [];
    const step = Math.floor(path.length / totalQuestions);
    
    for (let i = 1; i < path.length - 1; i += step) {
        if (indices.length < totalQuestions) {
            indices.push(Math.min(i, path.length - 2));
        }
    }
    
    // Fill remaining spots randomly
    while (indices.length < totalQuestions) {
        const idx = Math.floor(Math.random() * (path.length - 2)) + 1;
        if (!indices.includes(idx)) {
            indices.push(idx);
        }
    }
    
    return indices.slice(0, totalQuestions).sort((a, b) => a - b);
}

function addBranchesAndDeadEnds(maze, correctPath, size) {
    const correctPathSet = new Set(correctPath.map(p => `${p.row},${p.col}`));
    let deadEndCount = 0;
    const branches = [];
    const allMazeCells = new Set();
    
    // Track all maze cells
    correctPath.forEach(p => allMazeCells.add(`${p.row},${p.col}`));
    
    // Add branches from correct path (max 2 branches per cell)
    for (const cell of correctPath) {
        const neighbors = getValidNeighbors(cell.row, cell.col, size)
            .filter(n => {
                const key = `${n.row},${n.col}`;
                return !correctPathSet.has(key) && !maze[n.row][n.col];
            });
        
        // Limit to max 2 branches per cell
        const branchCount = Math.min(2, neighbors.length);
        if (branchCount > 0 && Math.random() < 0.5) {
            const selectedNeighbors = neighbors
                .sort(() => Math.random() - 0.5)
                .slice(0, Math.min(branchCount, Math.floor(Math.random() * 2) + 1));
            
            selectedNeighbors.forEach(branch => {
                maze[branch.row][branch.col] = true;
                allMazeCells.add(`${branch.row},${branch.col}`);
                branches.push(branch);
            });
        }
    }
    
    // Create dead ends with mini paths (at least 3-5 squares long)
    for (const branch of branches) {
        if (deadEndCount >= CONFIG.DEAD_ENDS) break;
        
        // Create a mini path leading to dead end (3-5 squares)
        const pathLength = Math.floor(Math.random() * 3) + 3; // 3 to 5 squares
        let current = branch;
        const deadEndPath = [branch];
        let pathCreated = false;
        
        for (let i = 0; i < pathLength; i++) {
            const neighbors = getValidNeighbors(current.row, current.col, size)
                .filter(n => {
                    const key = `${n.row},${n.col}`;
                    return !correctPathSet.has(key) && !allMazeCells.has(key);
                });
            
            if (neighbors.length === 0) {
                // Can't continue path, mark current as dead end
                pathCreated = true;
                break;
            }
            
            // Choose a neighbor to continue the path
            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            maze[next.row][next.col] = true;
            allMazeCells.add(`${next.row},${next.col}`);
            deadEndPath.push(next);
            current = next;
        }
        
        // Mark the last cell in the path as the dead end
        if (deadEndPath.length > 0) {
            const deadEndCell = deadEndPath[deadEndPath.length - 1];
            gameState.deadEnds.add(`${deadEndCell.row},${deadEndCell.col}`);
            deadEndCount++;
            pathCreated = true;
        }
    }
    
    // Ensure we have exactly 3 dead ends by creating additional paths if needed
    while (deadEndCount < CONFIG.DEAD_ENDS) {
        // Find a cell on the maze that can branch
        const availableCells = [];
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const key = `${row},${col}`;
                if (maze[row][col] && !correctPathSet.has(key) && !gameState.deadEnds.has(key)) {
                    const neighbors = getValidNeighbors(row, col, size)
                        .filter(n => {
                            const nKey = `${n.row},${n.col}`;
                            return !allMazeCells.has(nKey);
                        });
                    if (neighbors.length > 0) {
                        availableCells.push({ row, col, neighbors });
                    }
                }
            }
        }
        
        if (availableCells.length === 0) break;
        
        // Pick a random cell to branch from
        const branchCell = availableCells[Math.floor(Math.random() * availableCells.length)];
        const pathLength = Math.floor(Math.random() * 3) + 3; // 3 to 5 squares
        let current = branchCell;
        let pathCreated = false;
        
        for (let i = 0; i < pathLength; i++) {
            const neighbors = getValidNeighbors(current.row, current.col, size)
                .filter(n => {
                    const key = `${n.row},${n.col}`;
                    return !correctPathSet.has(key) && !allMazeCells.has(key);
                });
            
            if (neighbors.length === 0) {
                pathCreated = true;
                break;
            }
            
            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            maze[next.row][next.col] = true;
            allMazeCells.add(`${next.row},${next.col}`);
            current = next;
        }
        
        // Mark the last cell as dead end
        gameState.deadEnds.add(`${current.row},${current.col}`);
        deadEndCount++;
    }
}

function getValidNeighbors(row, col, size) {
    const neighbors = [];
    const directions = [
        { row: -1, col: 0 }, // up
        { row: 1, col: 0 },  // down
        { row: 0, col: -1 }, // left
        { row: 0, col: 1 }   // right
    ];
    
    for (const dir of directions) {
        const newRow = row + dir.row;
        const newCol = col + dir.col;
        if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
            neighbors.push({ row: newRow, col: newCol });
        }
    }
    
    return neighbors;
}

// Reveal squares
function revealSquare(row, col) {
    const key = `${row},${col}`;
    gameState.revealed.add(key);
    
    // Reveal adjacent valid paths
    const neighbors = getValidNeighbors(row, col, CONFIG.MAZE_SIZE);
    neighbors.forEach(n => {
        if (gameState.maze[n.row][n.col]) {
            gameState.revealed.add(`${n.row},${n.col}`);
        }
    });
}

// Render Maze
function renderMaze() {
    const grid = document.getElementById('mazeGrid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${CONFIG.MAZE_SIZE}, 1fr)`;
    
    for (let row = 0; row < CONFIG.MAZE_SIZE; row++) {
        for (let col = 0; col < CONFIG.MAZE_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'maze-cell';
            const key = `${row},${col}`;
            const isRevealed = gameState.revealed.has(key);
            
            // Start position
            if (row === 0 && col === 0) {
                cell.classList.add('start');
                if (row !== gameState.playerPos.row || col !== gameState.playerPos.col) {
                    cell.textContent = 'S';
                }
            }
            
            // Check if this is the end position
            const isEndTile = (row === CONFIG.MAZE_SIZE - 1 && col === CONFIG.MAZE_SIZE - 1);
            
            // End position - handle separately
            if (isEndTile) {
                cell.classList.add('end');
                // Show castle if the tile is revealed (not hidden by fog of war)
                if (isRevealed && gameState.maze[row][col]) {
                    const castleImg = document.createElement('img');
                    castleImg.src = 'castle.png';
                    castleImg.alt = 'Castle';
                    castleImg.style.width = '100%';
                    castleImg.style.height = '100%';
                    castleImg.style.objectFit = 'contain';
                    castleImg.style.imageRendering = 'pixelated';
                    castleImg.onerror = function() { 
                        this.style.display = 'none'; 
                        cell.textContent = 'E'; 
                    };
                    cell.appendChild(castleImg);
                }
                // If not revealed, fog of war will hide it below
            }
            
            // Fog of war logic - apply after end tile setup
            if (!gameState.maze[row][col]) {
                cell.classList.add('hidden');
            } else if (!isRevealed) {
                cell.classList.add('hidden');
            } else if (gameState.deadEnds.has(key) && gameState.traversed.has(key)) {
                cell.classList.add('dead-end');
            } else if (gameState.traversed.has(key)) {
                cell.classList.add('traversed');
            } else if (isRevealed && isPossibleMove(row, col) && !isEndTile) {
                cell.classList.add('possible');
            } else if (isRevealed && !isEndTile) {
                cell.classList.add('revealed');
            }
            
            // Player position - show knight image
            if (row === gameState.playerPos.row && col === gameState.playerPos.col) {
                cell.classList.add('player');
                const knightImg = document.createElement('img');
                knightImg.src = 'knight.png';
                knightImg.alt = 'Knight';
                knightImg.onerror = function() { this.style.display = 'none'; cell.textContent = 'P'; };
                cell.appendChild(knightImg);
            }
            
            // Question and bonus squares - only show when revealed
            if (isRevealed && gameState.questionSquares.has(key)) {
                cell.classList.add('question');
                if (gameState.bonusSquares.has(key)) {
                    cell.classList.add('bonus');
                }
            }
            
            grid.appendChild(cell);
        }
    }
}

function isPossibleMove(row, col) {
    const key = `${row},${col}`;
    if (!gameState.maze[row][col] || gameState.traversed.has(key)) {
        return false;
    }
    
    // Check if adjacent to player
    const neighbors = getValidNeighbors(gameState.playerPos.row, gameState.playerPos.col, CONFIG.MAZE_SIZE);
    return neighbors.some(n => n.row === row && n.col === col);
}

// Move Player
function movePlayer(direction) {
    if (document.getElementById('questionModal').classList.contains('active')) {
        return; // Can't move while question is open
    }
    
    // Start timer on first move
    if (!gameState.timerStarted) {
        gameState.timerStarted = true;
        gameState.startTime = Date.now();
        startTimer();
    } else if (gameState.timerPaused && gameState.currentMaze === 2) {
        // Resume timer on first move of maze 2
        if (gameState.pauseStartTime) {
            gameState.totalPausedTime += Date.now() - gameState.pauseStartTime;
            gameState.pauseStartTime = null;
        }
        gameState.timerPaused = false;
        startTimer();
    }
    
    const { row, col } = gameState.playerPos;
    let newRow = row;
    let newCol = col;
    
    switch (direction) {
        case 'up': newRow--; break;
        case 'down': newRow++; break;
        case 'left': newCol--; break;
        case 'right': newCol++; break;
    }
    
    const key = `${newRow},${newCol}`;
    
    // Check if move is valid
    if (newRow < 0 || newRow >= CONFIG.MAZE_SIZE || 
        newCol < 0 || newCol >= CONFIG.MAZE_SIZE) {
        return;
    }
    
    if (!gameState.maze[newRow][newCol]) {
        return;
    }
    
    if (!gameState.revealed.has(key) && !isPossibleMove(newRow, newCol)) {
        return;
    }
    
    // Check if it's a dead end
    if (gameState.deadEnds.has(key)) {
        gameState.traversed.add(key);
        renderMaze();
        return;
    }
    
    // Move player
    gameState.playerPos = { row: newRow, col: newCol };
    gameState.traversed.add(key);
    revealSquare(newRow, newCol);
    
    // Check if reached end
    if (newRow === CONFIG.MAZE_SIZE - 1 && newCol === CONFIG.MAZE_SIZE - 1) {
        if (gameState.currentMaze === 1) {
            // Pause timer when maze 1 ends
            if (gameState.timerStarted && !gameState.timerPaused) {
                pauseTimer();
            }
            showScreen('midPointScreen');
        } else {
            // Stop timer when maze 2 ends
            stopTimer();
            endGame();
        }
        return;
    }
    
    // Check if landed on question square
    if (gameState.questionSquares.has(key) && !gameState.answeredQuestions.has(key)) {
        showQuestion(key);
        return;
    }
    
    renderMaze();
}

// Question Handling
function showQuestion(squareKey) {
    const questionIndex = gameState.questionSquares.get(squareKey);
    const questionPool = gameState.currentMaze === 1 
        ? gameState.questions.slice(0, Math.ceil(gameState.questions.length / 2))
        : gameState.questions.slice(Math.ceil(gameState.questions.length / 2));
    
    const question = questionPool[questionIndex % questionPool.length];
    const isBonus = gameState.bonusSquares.has(squareKey);
    const isFirstAttempt = !gameState.questionAttempts.has(squareKey);
    
    document.getElementById('questionText').textContent = question.question;
    document.getElementById('questionTitle').textContent = isBonus ? '★ Bonus Question ★' : 'Question';
    document.getElementById('penaltyNotice').textContent = '';
    document.getElementById('bonusNotice').textContent = '';
    
    const optionsDiv = document.getElementById('questionOptions');
    optionsDiv.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'option-button';
        button.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
        button.onclick = () => handleAnswer(squareKey, option, question.correctAnswer, isBonus, isFirstAttempt);
        optionsDiv.appendChild(button);
    });
    
    document.getElementById('questionModal').classList.add('active');
}

function handleAnswer(squareKey, selectedAnswer, correctAnswer, isBonus, isFirstAttempt) {
    const attempts = gameState.questionAttempts.get(squareKey) || 0;
    gameState.questionAttempts.set(squareKey, attempts + 1);
    
    if (selectedAnswer === correctAnswer) {
        gameState.answeredQuestions.add(squareKey);
        
        if (isBonus && isFirstAttempt) {
            gameState.penaltyTime -= CONFIG.BONUS_REWARD;
            document.getElementById('bonusNotice').textContent = `Bonus! -${CONFIG.BONUS_REWARD} seconds!`;
            // Update timer immediately to show bonus
            updateTimer();
        }
        
        document.getElementById('questionModal').classList.remove('active');
        renderMaze();
    } else {
        gameState.penaltyTime += CONFIG.WRONG_ANSWER_PENALTY;
        document.getElementById('penaltyNotice').textContent = `Wrong answer! +${CONFIG.WRONG_ANSWER_PENALTY} seconds penalty. Try again.`;
        // Update timer immediately to show penalty
        updateTimer();
    }
}

// Timer
function startTimer() {
    if (!gameState.startTime) {
        gameState.startTime = Date.now();
    }
    updateTimer();
}

function pauseTimer() {
    if (gameState.timerStarted && !gameState.timerPaused) {
        // Calculate elapsed time up to this point
        if (gameState.startTime) {
            const now = Date.now();
            const elapsed = Math.floor((now - gameState.startTime - gameState.totalPausedTime) / 1000) + gameState.penaltyTime;
            gameState.elapsedTime = elapsed;
        }
        gameState.timerPaused = true;
        gameState.pauseStartTime = Date.now();
    }
}

function stopTimer() {
    if (gameState.timerStarted) {
        gameState.timerPaused = false;
        if (gameState.pauseStartTime) {
            gameState.totalPausedTime += Date.now() - gameState.pauseStartTime;
            gameState.pauseStartTime = null;
        }
        // Calculate final elapsed time
        if (gameState.startTime) {
            const now = Date.now();
            const elapsed = Math.floor((now - gameState.startTime - gameState.totalPausedTime) / 1000) + gameState.penaltyTime;
            gameState.elapsedTime = elapsed;
        }
        // Final update
        updateTimer();
    }
}

function updateTimer() {
    if (!gameState.timerStarted || gameState.timerPaused) {
        // Show current elapsed time even when paused
        if (gameState.elapsedTime > 0) {
            const minutes = Math.floor(gameState.elapsedTime / 60);
            const seconds = gameState.elapsedTime % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            document.getElementById('timer').textContent = `Time: ${timeString}`;
        } else {
            document.getElementById('timer').textContent = `Time: 00:00`;
        }
        return;
    }
    
    if (!gameState.startTime) {
        document.getElementById('timer').textContent = `Time: 00:00`;
        return;
    }
    
    const now = Date.now();
    // Calculate elapsed time: (current time - start time - total paused time) / 1000 + penalty time
    const elapsed = Math.floor((now - gameState.startTime - gameState.totalPausedTime) / 1000) + gameState.penaltyTime;
    gameState.elapsedTime = elapsed;
    
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('timer').textContent = `Time: ${timeString}`;
    
    if (document.getElementById('gameScreen').classList.contains('active') && !gameState.timerPaused) {
        setTimeout(updateTimer, 1000);
    }
}

// Game Flow
function startMaze2() {
    gameState.currentMaze = 2;
    gameState.revealed = new Set();
    gameState.traversed = new Set();
    gameState.deadEnds = new Set();
    gameState.questionSquares = new Map();
    gameState.bonusSquares = new Set();
    gameState.answeredQuestions = new Set();
    gameState.questionAttempts = new Map();
    
    // Timer remains paused - will resume on first move of maze 2
    generateMaze();
    renderMaze();
    updateTimer(); // Show current time but don't start counting until first move
    showScreen('gameScreen');
}

function endGame() {
    document.removeEventListener('keydown', handleKeyPress);
    showScreen('outroScreen');
}

function showCertificate() {
    const minutes = Math.floor(gameState.elapsedTime / 60);
    const seconds = gameState.elapsedTime % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('certName').textContent = gameState.playerName;
    document.getElementById('certTime').textContent = timeString;
    document.getElementById('certDate').textContent = new Date().toLocaleDateString();
    
    showScreen('certificateScreen');
    
    // Save to Google Sheets
    saveToGoogleSheets();
}

function backToStart() {
    // Reset game state
    gameState.playerName = '';
    gameState.currentMaze = 1;
    gameState.startTime = null;
    gameState.elapsedTime = 0;
    gameState.penaltyTime = 0;
    gameState.timerStarted = false;
    gameState.timerPaused = false;
    gameState.pauseStartTime = null;
    gameState.totalPausedTime = 0;
    gameState.revealed = new Set();
    gameState.traversed = new Set();
    gameState.deadEnds = new Set();
    gameState.questionSquares = new Map();
    gameState.bonusSquares = new Set();
    gameState.answeredQuestions = new Set();
    gameState.questionAttempts = new Map();
    gameState.googleSignedIn = false;
    gameState.token = null;
    
    // Clear name input
    const nameInput = document.getElementById('playerName');
    if (nameInput) {
        nameInput.value = '';
    }
    
    // Clear error messages
    const errorDiv = document.getElementById('introError');
    if (errorDiv) {
        errorDiv.textContent = '';
    }
    
    // Remove keyboard event listener
    document.removeEventListener('keydown', handleKeyPress);
    
    // Go back to starting screen
    showStartingScreen();
}

function saveCertificateAsPDF() {
    const element = document.getElementById('certificateContent');
    const opt = {
        margin: 1,
        filename: `The_Risky_Rescue_Certificate_${gameState.playerName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
}

// Save to Google Sheets
async function saveToGoogleSheets() {
    if (!CONFIG.SHEET_ID || CONFIG.SHEET_ID.includes('YOUR_SHEET_ID') || !gameState.googleSignedIn || !window.gapi || !window.gapi.client) {
        console.log('Not saving to sheets - guest mode or sheet not configured');
        return;
    }
    
    try {
        const minutes = Math.floor(gameState.elapsedTime / 60);
        const seconds = gameState.elapsedTime % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Find next empty row in Results sheet
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SHEET_ID,
            range: 'Results!B:D'
        });
        
        const nextRow = (response.result.values?.length || 0) + 1;
        
        await window.gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SHEET_ID,
            range: `Results!B${nextRow}:D${nextRow}`,
            valueInputOption: 'RAW',
            values: [[gameState.playerName, '2', timeString]]
        });
        
        console.log('Data saved to Google Sheets');
    } catch (error) {
        console.error('Error saving to sheets:', error);
    }
}

// Initialize Google API (only when user chooses to sign in)
async function initGoogleAPI() {
    if (!CONFIG.GOOGLE_CLIENT_ID || !CONFIG.GOOGLE_API_KEY || 
        CONFIG.GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID') ||
        CONFIG.GOOGLE_API_KEY.includes('YOUR_API_KEY')) {
        console.log('Google API not configured - game will run in guest mode');
        return false;
    }
    
    try {
        // Wait for gapi to be available
        let attempts = 0;
        while (!window.gapi && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (!window.gapi) {
            console.log('Google API not loaded - game will run in guest mode');
            return false;
        }
        
        await window.gapi.load('client');
        
        await window.gapi.client.init({
            apiKey: CONFIG.GOOGLE_API_KEY,
            clientId: CONFIG.GOOGLE_CLIENT_ID,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
            scope: 'https://www.googleapis.com/auth/spreadsheets'
        });
        
        console.log('Google API initialized');
        return true;
    } catch (error) {
        console.error('Error initializing Google API:', error);
        console.log('Game will continue in guest mode');
        return false;
    }
}

// Manual Google Sign-In (fallback if button doesn't render)
async function manualGoogleSignIn() {
    const errorDiv = document.getElementById('startError');
    
    if (!CONFIG.GOOGLE_CLIENT_ID || CONFIG.GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
        if (errorDiv) errorDiv.textContent = 'Google Sign-In not configured';
        return;
    }
    
    // Try to use Google Identity Services popup
    if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
            window.google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/spreadsheets',
                callback: async (tokenResponse) => {
                    gameState.googleSignedIn = true;
                    gameState.token = tokenResponse.access_token;
                    
                    // Initialize Google API
                    const apiInitialized = await initGoogleAPI();
                    if (apiInitialized) {
                        // Load dates and questions
                        try {
                            const dates = await readSheetDates();
                            const today = new Date().toISOString().split('T')[0];
                            
                            if (today < dates.openDate || today > dates.closeDate) {
                                showScreen('closedScreen');
                                return;
                            }
                            
                            await loadQuestions();
                        } catch (error) {
                            console.error('Error loading game data:', error);
                            gameState.questions = getDefaultQuestions();
                        }
                    }
                    
                    if (errorDiv) errorDiv.textContent = 'Signed in successfully!';
                    setTimeout(() => {
                        if (errorDiv) errorDiv.textContent = '';
                        showIntroScreen1();
                    }, 1000);
                }
            }).requestAccessToken();
        } catch (error) {
            console.error('Error with manual sign-in:', error);
            if (errorDiv) errorDiv.textContent = 'Sign-in failed. Please try again or play as guest.';
        }
    } else {
        if (errorDiv) errorDiv.textContent = 'Google Sign-In is loading. Please wait a moment and try again.';
    }
}

// Initialize immediately when script loads (non-blocking)
loadConfig();

// Show starting screen and initialize button when DOM is ready
(function initStartingScreen() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            showStartingScreen();
        });
    } else {
        // DOM already loaded - show immediately
        showStartingScreen();
    }
})();
