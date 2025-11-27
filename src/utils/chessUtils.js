/**
 * Chess Utility Functions
 * Helper functions for chess game logic
 */

const Chess = require("chess.js").Chess;

/**
 * Returns the Bongcloud opening move sequence (king walk).
 */
async function GetBongcloudOpeningMove(moveCounter) {
    let moveDictWhite = {
        0: "e2e4", 2: "e1e2", 4: "e2e3", 6: "e3e2", 8: "e2e1",
    }
    let moveDictBlack = {
        1: "e7e5", 3: "e8e7", 5: "e7e6", 7: "e6e7", 9: "e7e8"
    }
    let moveDict = {...moveDictBlack, ...moveDictWhite};

    if (!(moveCounter in moveDict)) {
        return null;
    }

    return moveDict[moveCounter];
}

/**
 * Checks if a move is valid using chess.js library.
 */
async function isValidMove(fen, from, to) {
    const chess = new Chess();
    chess.load(fen);
    const move = {
        from: from, to: to
    }
    try {
        chess.move(move);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    getBadOpeningMove: GetBongcloudOpeningMove,
    isValidMove
};
