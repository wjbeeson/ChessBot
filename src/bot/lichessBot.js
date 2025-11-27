/**
 * Lichess Chess Bot
 * Main bot logic for playing on Lichess
 */

const puppeteer = require('puppeteer');
const { loadConfig, saveConfig } = require('../utils/configLoader');
const { createLogger } = require('../utils/logger');
const { injectControls } = require('../ui/controlPanel');
const { getBadOpeningMove, isValidMove } = require('../utils/chessUtils');
const { sendWebSocketMessage, getPlayerColor, fetchPageVariable, checkForThankYouButton, sendRematchOffer, setMovetime, updateScore, sendMove } = require('../utils/pageUtils');
const { injectArrowMarkerDef, clearPreviousArrows, showArrow } = require('../utils/arrowUtils');
const { calculateBestMove, calculateGaslightMove } = require('../utils/apiClient');
const { GameState } = require('./GameState');
const {
    GAME_STATUS,
    COLORS,
    WEBSOCKET_MESSAGE_TYPES,
    GAME_RESULT,
    COUNTED_WIN_STATUSES,
    COUNTED_LOSS_STATUSES
} = require('../utils/constants');

const logger = createLogger('BOT');

// ============================================================================
// GAME STATE
// ============================================================================

const gameState = new GameState();

// ============================================================================
// WEBSOCKET INTERCEPTION
// ============================================================================

/**
 * Intercepts WebSocket connections to monitor and send chess moves.
 * @param {Page} page - Puppeteer page instance
 */
async function interceptWebsocket(page) {
    page.evaluateOnNewDocument(() => {
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = new Proxy(OriginalWebSocket, {
            construct(target, args) {
                const ws = new target(...args);
                window.activeWebSocket = ws;
                ws.addEventListener('message', (event) => {
                    window.handleWebSocketMessage(event.data);
                });
                return ws;
            }
        });
    });
    logger.info("WebSocket interception is set up");
}

// ============================================================================
// DYNAMIC SETTINGS ADJUSTMENT
// ============================================================================

/**
 * Calculates appropriate movetime based on remaining clock time as a percentage of initial time.
 * Applies random variance to make timing less predictable.
 * @param {number} timeLeft - Remaining time in milliseconds
 * @param {number} initialTime - Initial game time in milliseconds
 * @returns {Promise<number>} Calculated movetime in milliseconds
 */
async function getDynamicMovetime(timeLeft, initialTime) {
    const config = loadConfig();

    if (!initialTime) {
        return config.defaultMovetime;
    }

    const percentRemaining = (timeLeft / initialTime) * 100;
    let movetimeValue = config.defaultMovetime;
    let variance = 0;

    const sortedThresholds = Object.keys(config.timeThresholds)
        .map(Number)
        .sort((a, b) => b - a);

    for (let threshold of sortedThresholds) {
        if (percentRemaining >= threshold) {
            const thresholdConfig = config.timeThresholds[threshold];
            movetimeValue = thresholdConfig.movetime;
            variance = thresholdConfig.variance || 0;
            break;
        }
    }

    const randomVariance = Math.floor(Math.random() * (variance * 2 + 1)) - variance;
    const finalMovetime = Math.max(config.minimumMovetime, movetimeValue + randomVariance);

    return finalMovetime;
}

// ============================================================================
// SMACK MODE
// ============================================================================

/**
 * Activates "smack mode" by changing the background color.
 * @param {Page} page - Puppeteer page instance
 */
async function activateSmackMode(page) {
    const config = loadConfig();
    gameState.activateSmackMode();
    await page.evaluate((bgColor) => {
        document.documentElement.style.setProperty('--c-bg-page', bgColor);
    }, config.smackModeBackgroundColor);
}

/**
 * Checks if smack mode should be activated based on game conditions.
 * @param {Page} page - Puppeteer page instance
 * @param {number} gameMoveCounter - Current move number
 * @param {number} timeLeft - Remaining time
 * @param {number} score - Current position score
 * @param {number} minScore - Minimum score threshold
 * @param {number} minMoves - Minimum moves before activation
 * @param {number} maxMoves - Maximum moves threshold
 * @param {number} minTime - Minimum time threshold
 */
async function updateSmackModeStatus(page, gameMoveCounter, timeLeft, score, minScore, minMoves, maxMoves, minTime) {
    const config = loadConfig();
    if (gameMoveCounter > maxMoves || timeLeft < minTime || score > config.smackModeMaxScore) {
        await activateSmackMode(page);
        return;
    }
    if (gameMoveCounter < minMoves) {
        return;
    }
    if (score > minScore) {
        return;
    }
    await activateSmackMode(page);
}

// ============================================================================
// GAME RESULT HANDLING
// ============================================================================

/**
 * Determines game result for scoreboard tracking
 * @param {string} winner - Winner color ('white', 'black', or undefined)
 * @param {string} statusName - Game ending status
 * @param {string} botColor - Bot's color
 * @returns {string|null} Game result ('win', 'draw', 'loss', or null if not counted)
 */
function determineGameResult(winner, statusName, botColor) {
    if (!winner) {
        // No winner - only count as draw if not aborted
        return statusName !== GAME_STATUS.ABORT ? GAME_RESULT.DRAW : null;
    } else if (winner === botColor) {
        // Bot won - only count if opponent lost by counted statuses
        return COUNTED_WIN_STATUSES.includes(statusName) ? GAME_RESULT.WIN : null;
    } else {
        // Bot lost - only count if lost by counted statuses
        return COUNTED_LOSS_STATUSES.includes(statusName) ? GAME_RESULT.LOSS : null;
    }
}

/**
 * Handles game end logic including scoreboard updates and thank you button
 * @param {Page} page - Puppeteer page instance
 * @param {Object} messageData - WebSocket message data
 */
async function handleGameEnd(page, messageData) {
    const config = loadConfig();

    // Update scoreboard based on game outcome
    try {
        const winner = messageData.d?.winner;
        const statusName = messageData.d?.status?.name;
        const botColor = gameState.getPlayerColorString();

        logger.info(`End game - Winner: ${winner}, Status: ${statusName}, Bot: ${botColor}`);
        logger.info(`GAME_STATUS.ABORT = ${GAME_STATUS.ABORT}, statusName = ${statusName}, match: ${statusName === GAME_STATUS.ABORT}`);

        const gameResult = determineGameResult(winner, statusName, botColor);

        if (gameResult) {
            await page.evaluate((result) => {
                if (typeof window.updateScoreboard === 'function') {
                    window.updateScoreboard(result);
                }
            }, gameResult);
            logger.info(`Game ended: ${gameResult}`);
        } else {
            logger.info(`Game ended but not counted (status: ${statusName})`);
        }
    } catch (e) {
        logger.info("Couldn't update scoreboard:", e.message);
    }

    // Press thank you button if enabled
    logger.info(`[THANK YOU] config.pressThankYou = ${config.pressThankYou}`);
    if (config.pressThankYou) {
        logger.info("[THANK YOU] Attempting to press thank you button...");
        try {
            await checkForThankYouButton(page);
            logger.info("[THANK YOU] Successfully pressed 'Thank You' button.");
        } catch (e) {
            logger.error("[THANK YOU] Error pressing thank you button:", e.message);
        }
    } else {
        logger.info("[THANK YOU] Skipped: pressThankYou is disabled in config");
    }

    // Send rematch offer if enabled
    logger.info(`[REMATCH] config.autoSendRematch = ${config.autoSendRematch}`);
    if (config.autoSendRematch) {
        logger.info("[REMATCH] Attempting to send rematch offer...");
        try {
            await sendRematchOffer(page);
            logger.info("[REMATCH] Successfully sent rematch offer.");
        } catch (e) {
            logger.error("[REMATCH] Error sending rematch offer:", e.message);
        }
    } else {
        logger.info("[REMATCH] Skipped: autoSendRematch is disabled in config");
    }

    await newGame(page);
}

// ============================================================================
// MOVE PROCESSING
// ============================================================================

/**
 * Processes move time settings based on game state and configuration
 * @param {Page} page - Puppeteer page instance
 * @param {number} timeLeft - Remaining time
 * @param {boolean} adjustSpeedEnabled - Whether dynamic speed is enabled
 * @param {boolean} gaslightingEnabled - Whether gaslighting mode is enabled
 */
async function processMovetimeSettings(page, timeLeft, adjustSpeedEnabled, gaslightingEnabled) {
    const config = loadConfig();

    if (!adjustSpeedEnabled) {
        return;
    }

    if (gaslightingEnabled && gameState.smackModeEnabled) {
        if (config.criticalTimeEnabled && timeLeft < config.criticalTimeThreshold) {
            await setMovetime(page, config.criticalTimeMovetime);
        } else {
            const variance = config.smackModeVariance || 0;
            const randomVariance = Math.floor(Math.random() * (variance * 2 + 1)) - variance;
            const smackMovetime = Math.max(config.minimumMovetime, config.smackModeMovetime + randomVariance);
            await setMovetime(page, smackMovetime);
        }
    } else {
        await setMovetime(page, await getDynamicMovetime(timeLeft, gameState.initialGameTime));
    }
}

/**
 * Attempts to make a bad opening move if enabled
 * @param {Page} page - Puppeteer page instance
 * @param {string} fen - Current position FEN
 * @param {boolean} badOpeningEnabled - Whether bad opening is enabled
 * @returns {Promise<boolean>} True if bad opening move was made
 */
async function tryBadOpeningMove(page, fen, badOpeningEnabled) {
    if (!badOpeningEnabled || !gameState.badOpeningOngoing) {
        return false;
    }

    const badOpeningMove = await getBadOpeningMove(gameState.moveCounter);
    if (badOpeningMove) {
        // Validate move (converts from e2e4 format)
        if (await isValidMove(fen, badOpeningMove.substring(0, 2), badOpeningMove.substring(2, 4))) {
            await sendMove(page, badOpeningMove, 0, gameState.playerColorIsWhite);
            return true;
        }
    }

    gameState.badOpeningOngoing = false;
    return false;
}

/**
 * Calculates the next move based on game mode
 * @param {string} fen - Current position FEN
 * @param {number} moveTime - Time allocated for move calculation
 * @param {boolean} gaslightingEnabled - Whether gaslighting mode is enabled
 * @param {Page} page - Puppeteer page instance
 * @param {number} timeLeft - Remaining time
 * @returns {Promise<Object>} Move information object
 */
async function calculateNextMove(fen, moveTime, gaslightingEnabled, page, timeLeft) {
    const config = loadConfig();
    let moveInfo = null;

    if (gaslightingEnabled) {
        if (gameState.smackModeEnabled) {
            moveInfo = await calculateBestMove(fen, moveTime);
        } else {
            moveInfo = await calculateGaslightMove(fen, moveTime, config.gaslightLines);
            await updateSmackModeStatus(
                page,
                gameState.moveCounter,
                timeLeft,
                moveInfo.score,
                config.smackModeMinScore,
                config.smackModeMinMoves,
                config.smackModeMaxMoves,
                config.smackModeMinTime
            );
        }
    } else {
        moveInfo = await calculateBestMove(fen, moveTime);
    }

    return moveInfo;
}

// ============================================================================
// MAIN GAME LOGIC
// ============================================================================

/**
 * Exposes logging functions to the browser context
 * @param {Page} page - Puppeteer page instance
 */
async function exposeBrowserLogger(page) {
    const browserLogger = createLogger('BROWSER');

    await page.exposeFunction('nodeLog', (level, ...args) => {
        const message = args.join(' ');
        switch(level) {
            case 'debug':
                browserLogger.debug(message);
                break;
            case 'info':
                browserLogger.info(message);
                break;
            case 'warn':
                browserLogger.warn(message);
                break;
            case 'error':
                browserLogger.error(message);
                break;
            default:
                browserLogger.info(message);
        }
    });
}

/**
 * Exposes a function to the browser context that updates config.json values
 * @param {Page} page - Puppeteer page instance
 */
async function exposeConfigUpdater(page) {
    await page.exposeFunction('updateConfigValue', async (key, value) => {
        try {
            logger.info(`[CONFIG UPDATE] Received request to update ${key} to ${value}`);
            const config = loadConfig();
            logger.info(`[CONFIG UPDATE] Current ${key} value: ${config[key]}`);
            config[key] = value;
            const saved = saveConfig(config);
            logger.info(`[CONFIG UPDATE] Save result: ${saved}, new ${key} value: ${value}`);

            // Verify the save worked
            const reloaded = loadConfig();
            logger.info(`[CONFIG UPDATE] Verification - reloaded ${key} value: ${reloaded[key]}`);

            return true;
        } catch (error) {
            logger.error(`[CONFIG UPDATE] Failed to update config: ${error.message}`);
            return false;
        }
    });
}

/**
 * Defines the main WebSocket message handler that processes game events and makes moves.
 * @param {Page} page - Puppeteer page instance
 */
async function definePageMessageHandler(page) {
    await page.exposeFunction('handleWebSocketMessage', async (message) => {
        const messageData = JSON.parse(message);
        logger.debug("Websocket Traffic: " + JSON.stringify(messageData));

        // Handle game end
        if (messageData.t === WEBSOCKET_MESSAGE_TYPES.END_DATA) {
            await handleGameEnd(page, messageData);
            return;
        }

        // Get player color
        if (messageData === 0 || messageData.t === WEBSOCKET_MESSAGE_TYPES.CROWD) {
            const tempIsWhite = await getPlayerColor(page);
            if (tempIsWhite) {
                gameState.setPlayerColor(tempIsWhite === "w");
            }
        }

        // Handle first move as white
        const automoveEnabled = await fetchPageVariable(page, "automoveEnabled");
        if (gameState.playerColorIsWhite && gameState.moveCounter === 0 && !gameState.madeFirstMove && automoveEnabled) {
            const config = loadConfig();
            let move = await getBadOpeningMove(gameState.moveCounter);
            if (!move) {
                move = config.defaultWhiteOpeningMove;
            }
            await sendMove(page, move, 0, gameState.playerColorIsWhite);
            gameState.markFirstMoveMade();
            logger.info("Making first move as white...");
            return;
        }

        // Only react to move messages
        if (messageData.t !== WEBSOCKET_MESSAGE_TYPES.MOVE) {
            return;
        }

        // Increment move counter
        if (messageData.d?.uci) {
            gameState.incrementMoveCounter();
            logger.info("moveCounter " + gameState.moveCounter);
        }

        // Check if it's bot's turn
        if (!gameState.isBotsTurn(messageData.v)) {
            await clearPreviousArrows(page);
            return;
        }

        // Assemble FEN
        const isWhitesTurn = messageData.v % 2 === 0;
        const fen = messageData.d.fen + (isWhitesTurn ? " w" : " b");

        // Fetch UI settings
        const badOpeningEnabled = await fetchPageVariable(page, "badOpeningEnabled");
        const showArrowEnabled = await fetchPageVariable(page, "showArrowsEnabled");
        const adjustSpeedEnabled = await fetchPageVariable(page, "adjustSpeedEnabled");
        const gaslightingEnabled = await fetchPageVariable(page, "gaslightingEnabled");

        // Get time left
        const color = gameState.playerColorIsWhite ? COLORS.WHITE : COLORS.BLACK;
        const timeLeft = messageData.d.clock?.[color];

        // Capture initial game time
        if (gameState.initialGameTime === null && timeLeft) {
            gameState.setInitialGameTime(timeLeft);
            logger.info(`Initial game time captured: ${timeLeft} seconds`);
        }

        // Process movetime settings
        await processMovetimeSettings(page, timeLeft, adjustSpeedEnabled, gaslightingEnabled);

        // Try bad opening move
        if (await tryBadOpeningMove(page, fen, badOpeningEnabled)) {
            return;
        }

        // Calculate move
        const moveTime = await fetchPageVariable(page, "movetime");
        const moveInfo = await calculateNextMove(fen, moveTime, gaslightingEnabled, page, timeLeft);

        logger.info("move: " + moveInfo.move);
        logger.info(`automoveEnabled: ${automoveEnabled}`);

        // Mark eval bar as added
        if (!gameState.evalBarAdded) {
            gameState.markEvalBarAdded();
        }

        // Send move if automove enabled
        if (automoveEnabled) {
            await sendMove(page, moveInfo.move, moveInfo.score, gameState.playerColorIsWhite);
            logger.info(`Move sent: ${moveInfo.move}`);
        } else {
            logger.info("Automove is disabled, move not sent");
        }

        // Show arrow if enabled
        if (showArrowEnabled) {
            await clearPreviousArrows(page);
            await injectArrowMarkerDef(page);
            await showArrow(page, moveInfo.move, gameState.playerColorIsWhite);
        }

        // Update score display
        await updateScore(page, moveInfo.score, gameState.playerColorIsWhite, moveInfo.scoreunit);
    });
}

/**
 * Starts a new game by resetting state and navigating to a new game URL.
 * @param {Page} page - Puppeteer page instance
 */
async function newGame(page) {
    const config = loadConfig();

    // Check if auto-start is enabled
    const autoStartEnabled = await fetchPageVariable(page, 'autoStartNewGameEnabled');
    if (autoStartEnabled === false) {
        logger.info('Auto-start new game is disabled. Not starting new game.');
        return;
    }

    const newPage = "https://lichess.org/?hook_like=" + page.url().split("lichess.org/")[1];
    gameState.reset();

    const delay = config.autoStartDelay || 5000;
    logger.info(`Starting new game in ${delay}ms...`);
    await new Promise(r => setTimeout(r, delay));
    page.goto(newPage);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes Puppeteer and sets up the bot on Lichess.
 */
async function preparePage() {
    const config = loadConfig();
    const browser = await puppeteer.launch({
        headless: config.headlessMode,
        defaultViewport: null
    });
    const pages = await browser.pages();
    const page = pages[0];

    // Expose functions BEFORE navigation so they're available to evaluateOnNewDocument
    await exposeBrowserLogger(page);
    await exposeConfigUpdater(page);

    // Inject UI controls BEFORE navigation
    await injectControls(page);

    // Intercept the websocket before navigation
    await interceptWebsocket(page);

    // Disable pop-up that asks if you want to leave site after new game
    await page.evaluate(() => {
        window.onbeforeunload = null;
    });

    // Navigate to lichess
    await page.goto(config.lichessBaseUrl, {waitUntil: 'networkidle2'});

    // Set up message handler
    await definePageMessageHandler(page);
}

preparePage().catch((error) => logger.error(error));

module.exports = { preparePage };
