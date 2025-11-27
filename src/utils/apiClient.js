/**
 * API Client for Stockfish Server
 * Functions for communicating with the local Stockfish server
 */

const { createLogger } = require('./logger');
const logger = createLogger('API');

/**
 * Fetches the best move from the local Stockfish server.
 */
async function calculateBestMove(fen, movetime) {
    const fetchValue = `http://localhost:3001/get-best-move?fen=${encodeURIComponent(fen)}&movetime=${movetime}`
    try {
        const response = await fetch(fetchValue);
        const data = await response.json();
        return data.moveInfo;
    } catch (error) {
        logger.error("Error:", error);
        return null;
    }
}

/**
 * Fetches a "gaslight" move (intentionally suboptimal) from the local Stockfish server.
 */
async function calculateGaslightMove(fen, movetime, lines) {
    const fetchValue = `http://localhost:3001/get-gaslight-move?fen=${encodeURIComponent(fen)}&movetime=${movetime}&lines=${lines}`
    try {
        const response = await fetch(fetchValue);
        const data = await response.json();
        return data.moveInfo;
    } catch (error) {
        logger.error("Error:", error);
        return null;
    }
}

module.exports = {
    calculateBestMove,
    calculateGaslightMove
};
