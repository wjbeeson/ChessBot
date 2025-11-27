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
     * Checks if it's the bot's turn based on move version and color
     * @param {number} moveVersion - The move version number from WebSocket
     * @returns {boolean} True if it's the bot's turn to make a move
     */
    isBotsTurn(moveVersion) {
        // Version is ODD after white moves (1, 3, 5...) - black's turn
        // Version is EVEN after black moves (2, 4, 6...) - white's turn
        const isWhitesTurn = moveVersion % 2 === 0;

        // Bot should move when it's the bot's color's turn:
        // - Bot is white AND it's white's turn (version is even)
        // - Bot is black AND it's black's turn (version is odd / isWhitesTurn is false)
        const result = this.playerColorIsWhite === isWhitesTurn;
        logger.debug(`isBotsTurn - version=${moveVersion}, isWhitesTurn=${isWhitesTurn}, botIsWhite=${this.playerColorIsWhite}, result=${result}`);
        return result;
    }
}

module.exports = { GameState };
