/**
 * Game State Manager
 * Encapsulates all game-related state for the chess bot
 */

const { createLogger } = require('../utils/logger');
const logger = createLogger('GAMESTATE');

class GameState {
    constructor() {
        this.reset();
    }

    /**
     * Resets the game state to initial values
     */
    reset() {
        this.moveCounter = 0;
        this.playerColorIsWhite = false;
        this.badOpeningOngoing = true;
        this.madeFirstMove = false;
        this.smackModeEnabled = false;
        this.evalBarAdded = false;
        this.initialGameTime = null;
        this.moretimeSpamSent = false;
        this.mateBmDelayed = false;
    }

    /**
     * Increments the move counter
     * @returns {number} The new move counter value
     */
    incrementMoveCounter() {
        return ++this.moveCounter;
    }

    /**
     * Sets the player color
     * @param {boolean} isWhite - True if player is white, false if black
     */
    setPlayerColor(isWhite) {
        this.playerColorIsWhite = isWhite;
    }

    /**
     * Gets the player color as a string
     * @returns {string} 'white' or 'black'
     */
    getPlayerColorString() {
        return this.playerColorIsWhite ? 'white' : 'black';
    }

    /**
     * Marks that the first move has been made
     */
    markFirstMoveMade() {
        this.madeFirstMove = true;
    }

    /**
     * Activates smack mode
     */
    activateSmackMode() {
        this.smackModeEnabled = true;
    }

    /**
     * Sets the initial game time
     * @param {number} time - Initial game time in milliseconds
     */
    setInitialGameTime(time) {
        if (this.initialGameTime === null) {
            this.initialGameTime = time;
        }
    }

    /**
     * Marks that the eval bar has been added
     */
    markEvalBarAdded() {
        this.evalBarAdded = true;
    }

    /**
     * Determines whose turn it is based on moveCounter
     * IMPORTANT: Always use this instead of message version numbers (messageData.v)
     * because version numbers get corrupted by clock updates during moretime spam
     * @returns {boolean} True if it's white's turn, false if black's turn
     */
    isWhitesTurn() {
        // After an even number of moves (0, 2, 4...) it's white's turn
        // After an odd number of moves (1, 3, 5...) it's black's turn
        return this.moveCounter % 2 === 0;
    }

    /**
     * Checks if it's the bot's turn based on move counter and color
     * Uses moveCounter instead of version to avoid issues with clock updates during moretime spam
     * @returns {boolean} True if it's the bot's turn to make a move
     */
    isBotsTurn() {
        const isWhitesTurn = this.isWhitesTurn();

        // Bot should move when it's the bot's color's turn:
        // - Bot is white AND it's white's turn (moveCounter is even)
        // - Bot is black AND it's black's turn (moveCounter is odd)
        const result = this.playerColorIsWhite === isWhitesTurn;
        logger.debug(`isBotsTurn - moveCounter=${this.moveCounter}, isWhitesTurn=${isWhitesTurn}, botIsWhite=${this.playerColorIsWhite}, result=${result}`);
        return result;
    }
}

module.exports = { GameState };
