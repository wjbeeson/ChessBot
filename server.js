const express = require("express");
const cors = require("cors");
const {Engine} = require('node-uci');
const app = express();
app.use(express.json());

const config = require('./config');

const engine_path = config.enginePath;
const port = config.port;
const mateBoost = config.mateBoost;
const maxScoreLoss = config.maxScoreLoss;
const scoreFloor = config.scoreFloor;


app.use(cors());

// Initialize Stockfish engines
const engine = new Engine(engine_path);
initializeEngines();

async function initializeEngines() {
    try {
        await engine.init();
        console.log('[SERVER] Engine: Initialized successfully');

        await engine.setoption('Use NNUE', true);
        console.log('[SERVER] Engine: NNUE enabled');
    } catch (error) {
        console.error('[SERVER] Engine: ', error);
        return;
    }
}

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

async function getBestMove(fen, movetime) {
    const result = await getMoves(fen, movetime, 1);
    return {
        "move": result.bestmove,
        "depth": result["info"][result["info"].length - 1]["depth"],
        "score": result["info"][result["info"].length - 1]["score"]["value"],
        "scoreunit": result["info"][result["info"].length - 1]["score"]["unit"]
    };
}

app.get("/get-best-move", async (req, res) => {

    const fen = req.query.fen;
    const movetime = req.query.movetime;
    if (!fen) {
        return res.status(400).send("[SERVER] Missing required parameter: fen");
    }
    if (!movetime) {
        return res.status(400).send("[SERVER] Missing required parameter: movetime");
    }
    console.log("[SERVER] " + fen + ": Received request to get BEST move for fen");
    try {
        const moveInfo = await getBestMove(fen, movetime);
        console.log(`[SERVER] ${fen} Lines-[1] | Movetime-[${movetime}] | Depth-[${moveInfo.depth}] | Move-[${moveInfo.move}] | Score-[${moveInfo.score}]`);
        res.json({moveInfo});
    } catch (error) {
        console.error("[SERVER] Error generating move");
        res.status(500).send("[SERVER] Error computing best move");
    }
});

async function pickGaslightMove(result) {

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
                // 10 - 1 = 9 | 10 - 2 = 8
                numScore = mateBoost - score;
            } else {
                // -10 - - 1 = -9 | -10 - - 2 = -8
                numScore = -mateBoost - score;
            }
        }
        numScore = numScore + (result.info.length - i) / 10000 // Ensure the score is a unique key
        moveScoreDict[move] = score
        moveScoreUnitDict[move] = scoreUnit
        numScoreMoveDict[numScore] = move
    }

    // Convert to array and sort by keys numerically
    const sortedScoresArray = Object.keys(numScoreMoveDict)
        .map(Number)          // Convert keys to numbers
        .sort((a, b) => a - b);  // Sort numerically

    // Ensures will never pick suboptimal score when losing by certain amount
    const bestScore = sortedScoresArray[sortedScoresArray.length-1]
    const minScore = Math.max(bestScore - maxScoreLoss,scoreFloor)
    let selectedScore = bestScore

    // Select suboptimal score if possible
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
async function getGaslightMove(fen, depth, lines) {
    const result = await getMoves(fen, depth, lines);

    return await pickGaslightMove(result);
}

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
    console.log("[SERVER] " + fen + ": Received request to get GASLIGHT move");
    try {
        const moveInfo = await getGaslightMove(fen, movetime, lines);
        console.log(`[SERVER] ${fen} Lines-[${lines}] | Movetime-[${movetime}] | Depth-[${moveInfo.depth}] | Move-[${moveInfo.move}] | Score-[${moveInfo.score}]`);
        res.json({moveInfo});
    } catch (error) {
        console.error("[SERVER] Error generating move");
        res.status(500).send("[SERVER] Error computing best move");
    }
});

app.listen(port, () => {
    console.log(`[SERVER] Server is running on http://localhost:${port}`);
});
