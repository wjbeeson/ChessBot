/**
 * Page Interaction Utilities
 * Functions for interacting with the Lichess page
 */

const { SCORE_UNIT, EVAL_SLIDER, TIMEOUTS, WEBSOCKET_MESSAGE_TYPES } = require('./constants');

/**
 * Sends a message through the intercepted WebSocket connection.
 */
async function sendWebSocketMessage(page, message) {
    await page.evaluate((msg) => {
        if (window.activeWebSocket) {
            const wsState = window.activeWebSocket.readyState;
            const stateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
            if (typeof window.nodeLog === 'function') {
                window.nodeLog('info', `[WS SEND] State: ${stateNames[wsState]}, Msg: ${msg.substring(0, 150)}`);
            }

            if (wsState === 1) { // WebSocket.OPEN
                window.activeWebSocket.send(msg);
                if (typeof window.nodeLog === 'function') {
                    window.nodeLog('info', '[WS SEND] Successfully sent');
                }
            } else {
                if (typeof window.nodeLog === 'function') {
                    window.nodeLog('error', `[WS SEND] FAILED - WebSocket not OPEN (state: ${stateNames[wsState]})`);
                }
            }
        } else {
            if (typeof window.nodeLog === 'function') {
                window.nodeLog('error', '[WS SEND] FAILED - No active WebSocket connection');
            }
        }
    }, message);
}

/**
 * Determines which color the player is playing as (white or black).
 */
async function getPlayerColor(page) {
    return await page.evaluate(() => {
        const messageDiv = document.querySelector('.message');
        if (messageDiv) {
            const messageText = messageDiv.textContent || messageDiv.innerText;

            if (messageText.includes("white")) {
                if (typeof window.nodeLog === 'function') {
                    window.nodeLog('info', 'You play the white pieces');
                }
                return "w";
            } else if (messageText.includes("black")) {
                if (typeof window.nodeLog === 'function') {
                    window.nodeLog('info', 'You play the black pieces');
                }
                return "b";
            } else {
                if (typeof window.nodeLog === 'function') {
                    window.nodeLog('error', 'Error: Piece color not found.');
                }
                return null;
            }
        }
    })
}

/**
 * Retrieves a variable value from the page's window object.
 */
async function fetchPageVariable(page, variableName) {
    return await page.evaluate((varName) => {
        if (typeof window[varName] === "undefined") {
            return null;
        }
        return window[varName];
    }, variableName);
}

/**
 * Attempts to click the "thank you" button after a game.
 */
async function checkForThankYouButton(page) {
    await page.waitForFunction(() => {
            const thankYouButton = Array.from(document.querySelectorAll('span'))
                .find(button => button.textContent.trim() === 'ty');
            if (thankYouButton) {
                thankYouButton.click();
                return true;
            }
            return false;
        }, {timeout: TIMEOUTS.THANK_YOU_BUTTON}
    );
}

/**
 * Sends a rematch offer via WebSocket.
 */
async function sendRematchOffer(page) {
    await page.evaluate(() => {
        if (window.activeWebSocket) {
            const payload = JSON.stringify({ t: 'rematch-yes' });
            window.activeWebSocket.send(payload);
            window.nodeLog?.('info', 'Rematch offer sent via WebSocket: ' + payload);
        } else {
            window.nodeLog?.('error', 'No active WebSocket connection to send rematch offer.');
        }
    });
}

/**
 * Updates the movetime slider value in the UI.
 */
async function setMovetime(page, time) {
    await page.evaluate((movetime) => {
        if (window.movetime + 1 === movetime) {
            return;
        }
        window.movetime = movetime + 1;
        const seconds = (movetime / 1000).toFixed(1);
        document.getElementById("movetimeSlider").value = seconds;
        document.getElementById("movetimeSliderText").innerText = seconds + 's';
        if (typeof window.nodeLog === 'function') {
            window.nodeLog('debug', `Movetime set to ${movetime}ms (${seconds}s). Adjusting speed...`);
        }
    }, time);
}

/**
 * Updates the evaluation bar score display.
 * @param {Page} page - Puppeteer page instance
 * @param {number} score - Score value
 * @param {boolean} playerColorIsWhite - Player's color
 * @param {string} scoreUnit - Score unit ('cp' or 'mate')
 */
async function updateScore(page, score, playerColorIsWhite, scoreUnit = SCORE_UNIT.CENTIPAWN) {
    await page.evaluate(async (score, playerColorIsWhite, scoreUnit, SCORE_UNIT, EVAL_SLIDER) => {
        const slider = window.evalSlider;
        if (slider) {
            let displayText;
            let sliderValue;

            if (scoreUnit === SCORE_UNIT.MATE) {
                // Handle mate scores - score is always from white's perspective
                // Positive score = white has mate, negative = black has mate
                displayText = score > 0 ? `M${score}` : `-M${Math.abs(score)}`;
                // Max out slider for visual indication
                sliderValue = score > 0 ? EVAL_SLIDER.MATE_VALUE : -EVAL_SLIDER.MATE_VALUE;
            } else {
                // Handle centipawn scores
                if (playerColorIsWhite) {
                    score = -score;
                }
                sliderValue = score;
                displayText = (-score / 100).toFixed(1);
            }

            slider.value = sliderValue;
            window.evalLabel.textContent = displayText;
            if (typeof window.nodeLog === 'function') {
                window.nodeLog('debug', `Eval bar updated to: ${displayText} (unit: ${scoreUnit})`);
            }
        } else {
            if (typeof window.nodeLog === 'function') {
                window.nodeLog('warn', 'No evalSlider found on window object.');
            }
        }
    }, score, playerColorIsWhite, scoreUnit, SCORE_UNIT, EVAL_SLIDER);
}

/**
 * Sends a chess move via WebSocket.
 * @param {Page} page - Puppeteer page instance
 * @param {string} move - UCI move string
 * @param {number} score - Move score
 * @param {boolean} isWhite - Player's color
 */
async function sendMove(page, move, score, isWhite) {
    const payload = {
        t: WEBSOCKET_MESSAGE_TYPES.MOVE,
        d: {u: move, b: 1, l: 100, a: 1}
    };
    if (isWhite) {
        score = -score;
    }
    await sendWebSocketMessage(page, JSON.stringify(payload));
}

module.exports = {
    sendWebSocketMessage,
    getPlayerColor,
    fetchPageVariable,
    checkForThankYouButton,
    sendRematchOffer,
    setMovetime,
    updateScore,
    sendMove
};
