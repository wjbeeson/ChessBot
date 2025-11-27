/**
 * Stockfish Server
 * Express server that provides chess move calculations via Stockfish
 */

const express = require("express");
const cors = require("cors");
const {Engine} = require('node-uci');
const path = require('path');
const { loadConfig, saveConfig } = require('../utils/configLoader');
const { createLogger } = require('../utils/logger');
const logger = createLogger('SERVER');

const app = express();
app.use(express.json());
app.use(cors());

// ============================================================================
// CONFIGURATION
// ============================================================================

// Load initial config
let config = loadConfig();

// Resolve engine path relative to project root
const engine_path = path.join(__dirname, '../..', config.enginePath);
const port = config.port;

// ============================================================================
// STOCKFISH ENGINE INITIALIZATION
// ============================================================================

const engine = new Engine(engine_path);
initializeEngines();

async function initializeEngines() {
    try {
        await engine.init();
        logger.info('Engine: Initialized successfully');

        await engine.setoption('Use NNUE', true);
        logger.info('Engine: NNUE enabled');
    } catch (error) {
        logger.error('Engine: ', error);
        return;
    }
}

// ============================================================================
// STOCKFISH MOVE CALCULATION
// ============================================================================

/**
 * Gets multiple move lines from Stockfish for a given position.
 */
async function getMoves(fen, movetime, lines) {
    await engine.setoption('MultiPV', Number(lines));
    await engine.isready();
    await engine.ucinewgame();
    await engine.position(fen);
    return await engine.go(
        {
            movetime: movetime,
        }
    );
}

/**
 * Gets the best move from Stockfish for a given position.
 */
async function getBestMove(fen, movetime) {
    const result = await getMoves(fen, movetime, 1);
    return {
        "move": result.bestmove,
        "depth": result["info"][result["info"].length - 1]["depth"],
        "score": result["info"][result["info"].length - 1]["score"]["value"],
        "scoreunit": result["info"][result["info"].length - 1]["score"]["unit"]
    };
}

/**
 * Picks a suboptimal "gaslight" move from multiple lines.
 */
async function pickGaslightMove(result) {
    // Reload config for fresh values
    const cfg = loadConfig();

    const maxDepth = result.info[result.info.length-1]["depth"]
    let moveScoreDict = {}
    let numScoreMoveDict=  {}
    let moveScoreUnitDict = {}
    for (let i = result.info.length - 1; i >= 0; i--) {
        if (result.info[i]["depth"] !== maxDepth) {
            continue;
        }
        let move = result.info[i]['pv'].split(" ")[0]
        let score = result.info[i]['score'].value
        let scoreUnit = result.info[i]['score'].unit
        let numScore = score
        if (result.info[i]['score'].unit === "mate") {
            if (score > 0) {
                numScore = cfg.mateBoost - score;
            } else {
                numScore = -cfg.mateBoost - score;
            }
        }
        numScore = numScore + (result.info.length - i) / 10000
        moveScoreDict[move] = score
        moveScoreUnitDict[move] = scoreUnit
        numScoreMoveDict[numScore] = move
    }

    const sortedScoresArray = Object.keys(numScoreMoveDict)
        .map(Number)
        .sort((a, b) => a - b);

    const bestScore = sortedScoresArray[sortedScoresArray.length-1]
    const minScore = Math.max(bestScore - cfg.maxScoreLoss, cfg.scoreFloor)
    let selectedScore = bestScore

    for (let i = 0; i < sortedScoresArray.length; i++) {
        if (sortedScoresArray[i] > minScore) {
            selectedScore = sortedScoresArray[i]
            break;
        }
    }
    const selectedMove = numScoreMoveDict[selectedScore]
    const score = moveScoreDict[selectedMove]
    const scoreUnit = moveScoreUnitDict[selectedMove]
    return {
        "move": selectedMove,
        "depth": maxDepth,
        "score": score,
        "scoreunit": scoreUnit,
    };
}

/**
 * Gets a gaslight move (intentionally suboptimal) for a given position.
 */
async function getGaslightMove(fen, depth, lines) {
    const result = await getMoves(fen, depth, lines);

    return await pickGaslightMove(result);
}

// ============================================================================
// API ENDPOINTS - MOVE GENERATION
// ============================================================================

/**
 * Endpoint to get the best move for a given position.
 */
app.get("/get-best-move", async (req, res) => {

    const fen = req.query.fen;
    const movetime = req.query.movetime;
    if (!fen) {
        return res.status(400).send("[SERVER] Missing required parameter: fen");
    }
    if (!movetime) {
        return res.status(400).send("[SERVER] Missing required parameter: movetime");
    }
    logger.info("Received request to get BEST move");
    try {
        const moveInfo = await getBestMove(fen, movetime);
        logger.info(`Lines-[1] | Movetime-[${movetime}] | Depth-[${moveInfo.depth}] | Move-[${moveInfo.move}] | Score-[${moveInfo.score}]`);
        res.json({moveInfo});
    } catch (error) {
        logger.error("Error generating move");
        res.status(500).send("[SERVER] Error computing best move");
    }
});

/**
 * Endpoint to get a gaslight move for a given position.
 */
app.get("/get-gaslight-move", async (req, res) => {

    const fen = req.query.fen;
    const movetime = req.query.movetime;
    const lines = req.query.lines;
    if (!fen) {
        return res.status(400).send("[SERVER] Missing required parameter: fen");
    }
    if (!movetime) {
        return res.status(400).send("[SERVER] Missing required parameter: movetime");
    }
    if (!lines) {
        return res.status(400).send("[SERVER] Missing required parameter: lines");
    }
    logger.info("Received request to get GASLIGHT move");
    try {
        const moveInfo = await getGaslightMove(fen, movetime, lines);
        logger.info(`Lines-[${lines}] | Movetime-[${movetime}] | Depth-[${moveInfo.depth}] | Move-[${moveInfo.move}] | Score-[${moveInfo.score}]`);
        res.json({moveInfo});
    } catch (error) {
        logger.error("Error generating move");
        res.status(500).send("[SERVER] Error computing best move");
    }
});

// ============================================================================
// CONFIGURATION PAGE
// ============================================================================

/**
 * Serves the configuration page.
 */
app.get("/config", (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/config.html'));
});

// ============================================================================
// API ENDPOINTS - CONFIGURATION
// ============================================================================

/**
 * Returns the current configuration as JSON.
 */
app.get("/get-config", (req, res) => {
    // Always load fresh config
    res.json(loadConfig());
});

/**
 * Updates the configuration file with new settings.
 * No restart required - changes take effect immediately!
 */
app.post("/update-config", (req, res) => {
    const newConfig = req.body;

    try {
        if (saveConfig(newConfig)) {
            res.json({ success: true, message: 'Configuration updated! Changes are now active.' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save configuration' });
        }
    } catch (error) {
        logger.error('Error updating config:', error);
        res.status(500).json({ success: false, message: 'Failed to update configuration' });
    }
});

/**
 * Alias for /update-config (for UI compatibility)
 */
app.post("/save-config", (req, res) => {
    logger.info('Received save-config request');
    const newConfig = req.body;
    logger.info(`New config pressThankYou: ${newConfig.pressThankYou}`);

    try {
        if (saveConfig(newConfig)) {
            logger.info('Configuration saved via control panel successfully');
            res.json({ success: true, message: 'Configuration saved!' });
        } else {
            logger.error('saveConfig returned false');
            res.status(500).json({ success: false, message: 'Failed to save configuration' });
        }
    } catch (error) {
        logger.error('Error saving config:', error);
        res.status(500).json({ success: false, message: 'Failed to save configuration' });
    }
});

// ============================================================================
// SERVER START
// ============================================================================

app.listen(port, () => {
    logger.info(`Server is running on http://localhost:${port}`);
});

module.exports = { app };
