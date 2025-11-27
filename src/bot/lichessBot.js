/**
 * Lichess Chess Bot
 * Main bot logic for playing on Lichess
 *
 * ⚠️ CRITICAL: VERSION NUMBER CORRUPTION WARNING ⚠️
 *
 * Lichess WebSocket message version numbers (messageData.v) are UNRELIABLE!
 * They increment for ALL messages, not just moves:
 * - Clock updates (moretime/clockInc)
 * - Chat messages
 * - Presence updates
 * - Other non-move events
 *
 * NEVER use messageData.v for game logic. ALWAYS use:
 * - gameState.moveCounter (actual moves only)
 * - gameState.isWhitesTurn() (turn detection)
 * - gameState.isBotsTurn() (bot's turn detection)
 *
 * Using messageData.v causes the bot to generate moves for the wrong color!
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
let rematchAccepted = false;

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
 * Activates "smack mode" by lerping the background color to red.
 * @param {Page} page - Puppeteer page instance
 */
async function activateSmackMode(page) {
    const config = loadConfig();
    gameState.activateSmackMode();
    await page.evaluate((targetColor) => {
        // Get current background color
        const currentColor = getComputedStyle(document.documentElement).getPropertyValue('--c-bg-page').trim();

        // Parse hex colors to RGB
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };

        const rgbToHex = (r, g, b) => {
            return '#' + [r, g, b].map(x => {
                const hex = Math.round(x).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
        };

        const start = hexToRgb(currentColor);
        const end = hexToRgb(targetColor);

        if (!start || !end) return;

        // Lerp over 2 seconds
        const duration = 2000;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);

            const r = start.r + (end.r - start.r) * eased;
            const g = start.g + (end.g - start.g) * eased;
            const b = start.b + (end.b - start.b) * eased;

            document.documentElement.style.setProperty('--c-bg-page', rgbToHex(r, g, b));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
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

    // Reset moretime spam flag if running
    await page.evaluate(() => {
        if (window.moretimeSpamInProgress) {
            window.moretimeSpamInProgress = false;
            if (typeof window.nodeLog === 'function') {
                window.nodeLog('info', '[SPAM MORETIME] Reset moretime spam flag (game ended)');
            }
        }
    });

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

    // Send rematch offer if enabled (non-blocking)
    logger.info(`[REMATCH] config.autoSendRematch = ${config.autoSendRematch}`);
    if (config.autoSendRematch) {
        logger.info("[REMATCH] Sending rematch offer...");
        try {
            await sendRematchOffer(page);
            logger.info("[REMATCH] Rematch offer sent. If opponent accepts, will rematch. Otherwise will auto-queue.");
        } catch (e) {
            logger.error("[REMATCH] Error sending rematch offer:", e.message);
        }
    } else {
        logger.info("[REMATCH] Skipped: autoSendRematch is disabled in config");
    }

    // Always call newGame() - if rematch is accepted, the page navigation will be overridden naturally
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
 * @param {boolean} automoveEnabled - Whether automove is enabled
 * @returns {Promise<boolean>} True if bad opening move was made
 */
async function tryBadOpeningMove(page, fen, badOpeningEnabled, automoveEnabled) {
    if (!badOpeningEnabled || !gameState.badOpeningOngoing) {
        return false;
    }

    const badOpeningMove = await getBadOpeningMove(gameState.moveCounter);
    if (badOpeningMove) {
        // Validate move (converts from e2e4 format)
        if (await isValidMove(fen, badOpeningMove.substring(0, 2), badOpeningMove.substring(2, 4))) {
            if (automoveEnabled) {
                await sendMove(page, badOpeningMove, 0, gameState.playerColorIsWhite);
                logger.info(`Bongcloud move sent: ${badOpeningMove}`);
            } else {
                logger.info(`Bongcloud move calculated but not sent (automove disabled): ${badOpeningMove}`);
            }
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
 * Handles rematch detection from WebSocket messages
 */
function handleRematchDetection(messageData) {
    const isRematchTaken = messageData.t === 'reload' && messageData.d?.t === 'rematchTaken';
    if (!isRematchTaken) return;

    rematchAccepted = true;
    logger.info(`[REMATCH] Rematch accepted! Game ID: ${messageData.d.d}`);
}

/**
 * Attempts to detect and set player color from the page
 * Only detects at the start of the game (moveCounter === 0) to avoid
 * false detection from messages like "White + 15 seconds" during moretime
 */
async function detectPlayerColor(page, messageData) {
    const shouldDetectColor = messageData === 0 || messageData.t === WEBSOCKET_MESSAGE_TYPES.CROWD;
    if (!shouldDetectColor) return;

    // Only detect color at the start of the game
    if (gameState.moveCounter !== 0) {
        return;
    }

    const colorCode = await getPlayerColor(page);
    if (colorCode) {
        gameState.setPlayerColor(colorCode === "w");
        logger.info(`[COLOR DETECT] Player color set to: ${colorCode === "w" ? "WHITE" : "BLACK"}`);
    }
}

/**
 * Handles first move as white if conditions are met
 * @returns {boolean} True if first move was handled
 */
async function handleFirstMoveAsWhite(page, isAutomoveEnabled) {
    const shouldMakeFirstMove = gameState.playerColorIsWhite
        && gameState.moveCounter === 0
        && !gameState.madeFirstMove
        && isAutomoveEnabled;

    if (!shouldMakeFirstMove) return false;

    const config = loadConfig();
    const openingMove = await getBadOpeningMove(gameState.moveCounter) || config.defaultWhiteOpeningMove;

    await sendMove(page, openingMove, 0, gameState.playerColorIsWhite);
    gameState.markFirstMoveMade();
    logger.info("Making first move as white...");
    return true;
}

/**
 * Processes a move message and handles bot's turn
 *
 * IMPORTANT: Never use messageData.v (version number) for game logic!
 * Version numbers get corrupted by moretime clock updates and other non-move messages.
 * Always use gameState.moveCounter and gameState.isWhitesTurn() instead.
 *
 * Why this matters:
 * - When moretime is sent, Lichess sends back clockInc, message, and bare version updates
 * - These increment the version counter without actual moves happening
 * - Using messageData.v for turn detection causes the bot to:
 *   1. Think it's the wrong player's turn
 *   2. Generate moves for the opponent's pieces
 *   3. Send illegal moves that get rejected by Lichess
 */
async function processMoveMessage(page, messageData) {
    logger.info(`[PROCESS MSG] Received move message - version:${messageData.v}, hasUCI:${!!messageData.d?.uci}, uci:${messageData.d?.uci || 'NONE'}`);

    // Only process if there's an actual move (not just a clock update from moretime)
    if (!messageData.d?.uci) {
        logger.info('[PROCESS MSG] No UCI in message, skipping (likely clock update)');
        return;
    }

    // Increment move counter
    gameState.incrementMoveCounter();
    logger.info(`[PROCESS MSG] moveCounter incremented to ${gameState.moveCounter}`);

    // Check if it's bot's turn (uses moveCounter instead of version to avoid clock update issues)
    const isBotTurn = gameState.isBotsTurn();
    logger.info(`[PROCESS MSG] isBotsTurn check: ${isBotTurn}`);

    if (!isBotTurn) {
        logger.info('[PROCESS MSG] Not bot\'s turn, clearing arrows and returning');
        await clearPreviousArrows(page);
        return;
    }

    logger.info('[PROCESS MSG] Bot\'s turn confirmed, proceeding with move calculation');

    // Assemble FEN notation
    // CRITICAL: Use gameState.isWhitesTurn() NOT messageData.v
    // messageData.v gets corrupted by moretime clock updates, causing wrong moves
    const isWhitesTurn = gameState.isWhitesTurn();
    const fen = messageData.d.fen + (isWhitesTurn ? " w" : " b");
    logger.info(`[PROCESS MSG] Assembled FEN with turn indicator: ${isWhitesTurn ? 'white' : 'black'} (moveCounter: ${gameState.moveCounter})`);

    // Fetch UI settings in parallel
    const [
        isAutomoveEnabled,
        isBadOpeningEnabled,
        isShowArrowEnabled,
        isAdjustSpeedEnabled,
        isGaslightingEnabled
    ] = await Promise.all([
        fetchPageVariable(page, "automoveEnabled"),
        fetchPageVariable(page, "badOpeningEnabled"),
        fetchPageVariable(page, "showArrowsEnabled"),
        fetchPageVariable(page, "adjustSpeedEnabled"),
        fetchPageVariable(page, "gaslightingEnabled")
    ]);

    // Get time remaining
    const botColor = gameState.playerColorIsWhite ? COLORS.WHITE : COLORS.BLACK;
    const timeLeftSeconds = messageData.d.clock?.[botColor];

    // Capture initial game time on first move
    if (gameState.initialGameTime === null && timeLeftSeconds) {
        gameState.setInitialGameTime(timeLeftSeconds);
        logger.info(`Initial game time captured: ${timeLeftSeconds} seconds`);
    }

    // Adjust movetime based on time remaining
    await processMovetimeSettings(page, timeLeftSeconds, isAdjustSpeedEnabled, isGaslightingEnabled);

    // Try bad opening move (Bongcloud)
    const badOpeningMoveHandled = await tryBadOpeningMove(page, fen, isBadOpeningEnabled, isAutomoveEnabled);
    if (badOpeningMoveHandled) return;

    // Calculate best move
    const currentMovetime = await fetchPageVariable(page, "movetime");
    const moveInfo = await calculateNextMove(fen, currentMovetime, isGaslightingEnabled, page, timeLeftSeconds);

    logger.info("move: " + moveInfo.move);
    logger.info(`automoveEnabled: ${isAutomoveEnabled}`);

    // Spam moretime if bot has mate (non-blocking, once per game)
    const isSpamMoretimeEnabled = await fetchPageVariable(page, "spamMoretimeEnabled");
    if (isSpamMoretimeEnabled && moveInfo.scoreunit === 'mate' && moveInfo.score > 0 && !gameState.moretimeSpamSent) {
        gameState.moretimeSpamSent = true;
        const config = loadConfig();
        const timesToSpam = Math.floor(config.spamMoretimeSeconds / 15);
        logger.info(`[SPAM MORETIME] Bot has mate! Sending ${timesToSpam} moretime requests (${config.spamMoretimeSeconds} seconds)...`);

        // Send moretime requests asynchronously (non-blocking)
        page.evaluate((count) => {
            if (window.activeWebSocket && !window.moretimeSpamInProgress) {
                window.moretimeSpamInProgress = true;
                let sentCount = 0;

                const sendMoretime = () => {
                    if (sentCount < count) {
                        try {
                            const wsState = window.activeWebSocket.readyState;
                            if (wsState === 1) { // WebSocket.OPEN
                                window.activeWebSocket.send(JSON.stringify({ t: 'moretime' }));
                                sentCount++;
                                if (typeof window.nodeLog === 'function') {
                                    window.nodeLog('debug', `[SPAM MORETIME] Sent moretime request ${sentCount}/${count}`);
                                }
                                setTimeout(sendMoretime, 100);
                            } else {
                                if (typeof window.nodeLog === 'function') {
                                    window.nodeLog('error', `[SPAM MORETIME] WebSocket not OPEN (state: ${wsState}), stopping spam`);
                                }
                                window.moretimeSpamInProgress = false;
                            }
                        } catch (e) {
                            if (typeof window.nodeLog === 'function') {
                                window.nodeLog('error', `[SPAM MORETIME] Error: ${e.message}`);
                            }
                            window.moretimeSpamInProgress = false;
                        }
                    } else {
                        window.moretimeSpamInProgress = false;
                        if (typeof window.nodeLog === 'function') {
                            window.nodeLog('info', `[SPAM MORETIME] Completed sending ${count} moretime requests`);
                        }
                    }
                };

                sendMoretime();
            }
        }, timesToSpam).catch(err => {
            logger.error('[SPAM MORETIME] Error:', err.message);
        });
    }

    // Mark eval bar as initialized
    if (!gameState.evalBarAdded) {
        gameState.markEvalBarAdded();
    }

    // Send move if automove is enabled
    if (isAutomoveEnabled) {
        // If mate was detected and we haven't delayed yet, delay once at the beginning
        // This gives time for moretime spam to start while opponent watches
        if (gameState.moretimeSpamSent && !gameState.mateBmDelayed) {
            const config = loadConfig();
            const delaySeconds = config.mateBmDelaySeconds || 10;
            const minimumTimeLeft = config.mateBmMinimumTimeLeft || 3;

            // Account for movetime that will be used on future moves
            const movetimeSeconds = currentMovetime / 1000;
            const safetyBuffer = minimumTimeLeft + movetimeSeconds;

            // Check if we have enough time to safely delay
            // Need: safety buffer + delay time
            if (timeLeftSeconds && timeLeftSeconds > safetyBuffer + delaySeconds) {
                logger.info(`[MATE BM] Delaying first move of mate sequence by ${delaySeconds} seconds (${timeLeftSeconds.toFixed(1)}s left, need ${(safetyBuffer + delaySeconds).toFixed(1)}s [safety: ${minimumTimeLeft}s + movetime: ${movetimeSeconds.toFixed(1)}s + delay: ${delaySeconds}s])`);
                gameState.mateBmDelayed = true;
                await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
                logger.info(`[MATE BM] Delay complete, starting mate sequence now`);
            } else {
                logger.info(`[MATE BM] Skipping delay - insufficient time (${timeLeftSeconds?.toFixed(1)}s left, need ${(safetyBuffer + delaySeconds).toFixed(1)}s)`);
                gameState.mateBmDelayed = true; // Mark as delayed even if skipped, so we don't try again
            }
        }

        await sendMove(page, moveInfo.move, moveInfo.score, gameState.playerColorIsWhite);
        logger.info(`[MOVE SEND] Move sent: ${moveInfo.move}`);
    } else {
        logger.info("Automove is disabled, move not sent");
    }

    // Show move arrow on board
    if (isShowArrowEnabled) {
        await clearPreviousArrows(page);
        await injectArrowMarkerDef(page);
        await showArrow(page, moveInfo.move, gameState.playerColorIsWhite);
    }

    // Update evaluation bar
    await updateScore(page, moveInfo.score, gameState.playerColorIsWhite, moveInfo.scoreunit);
}

/**
 * Defines the main WebSocket message handler that processes game events and makes moves.
 * @param {Page} page - Puppeteer page instance
 */
async function definePageMessageHandler(page) {
    // Handler for outgoing WebSocket messages
    await page.exposeFunction('handleWebSocketOutgoing', async (message) => {
        try {
            const messageData = JSON.parse(message);
            logger.debug("Websocket Traffic (OUT): " + JSON.stringify(messageData));
        } catch (e) {
            // Some messages might not be JSON (like numbers)
            logger.debug("Websocket Traffic (OUT): " + message);
        }
    });

    // Handler for incoming WebSocket messages
    await page.exposeFunction('handleWebSocketMessage', async (message) => {
        const messageData = JSON.parse(message);
        logger.debug(`Websocket Traffic (IN): ${JSON.stringify(messageData)} | botIsWhite: ${gameState.playerColorIsWhite} | moveCounter: ${gameState.moveCounter}`);

        // Detect rematch acceptance
        handleRematchDetection(messageData);

        // Detect opponent left - claim victory by forcing their resignation
        if (messageData.t === 'gone' && messageData.d === true) {
            logger.info('[OPPONENT LEFT] Opponent has left. Claiming victory...');
            await page.evaluate(() => {
                if (window.activeWebSocket) {
                    const payload = JSON.stringify({ t: 'resign-force' });
                    window.activeWebSocket.send(payload);
                    if (typeof window.nodeLog === 'function') {
                        window.nodeLog('info', 'Claimed victory - opponent left');
                    }
                }
            });
            return;
        }

        // Handle game end
        if (messageData.t === WEBSOCKET_MESSAGE_TYPES.END_DATA) {
            await handleGameEnd(page, messageData);
            return;
        }

        // Detect player color
        await detectPlayerColor(page, messageData);

        // Handle first move as white
        const isAutomoveEnabled = await fetchPageVariable(page, "automoveEnabled");
        const firstMoveHandled = await handleFirstMoveAsWhite(page, isAutomoveEnabled);
        if (firstMoveHandled) return;

        // Only process move messages from this point
        if (messageData.t !== WEBSOCKET_MESSAGE_TYPES.MOVE) {
            logger.debug(`[MSG FILTER] Ignoring message type: ${messageData.t || 'undefined'}`);
            return;
        }

        logger.info(`[MSG FILTER] Processing MOVE message - version:${messageData.v}, hasUCI:${!!messageData.d?.uci}, uci:${messageData.d?.uci || 'NONE'}`);

        // Process move and make bot's move
        await processMoveMessage(page, messageData);
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

    // Reset rematch flag at the start
    rematchAccepted = false;

    const delay = config.autoStartDelay || 5000;
    logger.info(`Starting new game in ${delay}ms...`);
    await new Promise(r => setTimeout(r, delay));

    // Check if rematch was accepted during the delay
    if (rematchAccepted) {
        logger.info('[AUTO-QUEUE] Rematch accepted during delay. Skipping auto-queue.');
        return;
    }

    logger.info('[AUTO-QUEUE] No rematch detected. Queueing for new game...');
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
