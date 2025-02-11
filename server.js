const express = require("express");
const cors = require("cors");
const { Engine } = require('node-uci');

const app = express();
app.use(express.json());
const port = 3001;

app.use(cors());

// Initialize Stockfish engine
const engine = new Engine("./stockfish_24101214_x64_avx2.exe"); // Replace with the actual path

// Start and initialize the engine
async function initializeEngine() {
    await engine
        .init()
        .then(() => engine.setoption('Use NNUE', true))
        .then(() => console.log('NNUE is enabled'))
        .catch((error) => console.error('Error enabling NNUE:', error));
}

initializeEngine(); // Initialize on startup

async function getBestMove(fen, depth) {
    await engine.isready();
    await engine.ucinewgame();
    await engine.position(fen);

    const result = await engine.go(
        {
            depth: depth,

        }
    );
    return result.bestmove;
}


app.get("/get-best-move", async (req, res) => {

    const fen = req.query.fen;
    const depth = req.query.depth;
    if (!fen) {
        return res.status(400).send("[SERVER] Missing required parameter: fen");
    }
    if (!depth) {
        return res.status(400).send("[SERVER] Missing required parameter: depth");
    }
    console.log("[SERVER] "+fen + ": Received request to get best move for fen");
    try {
        const bestMove = await getBestMove(fen, depth);
        console.log("[SERVER] " + fen + ": Sending back move " + bestMove);
        res.json({ bestMove });
    } catch (error) {
        console.error("[SERVER] Error generating move");
        res.status(500).send("[SERVER] Error computing best move");
    }
});

app.listen(port, () => {
    console.log(`[SERVER] Server is running on http://localhost:${port}`);
});
