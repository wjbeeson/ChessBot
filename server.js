const express = require("express");
const cors = require("cors");
const { Engine } = require('node-uci');

const app = express();
app.use(express.json());
const port = 3001;

app.use(cors());

// Initialize Stockfish engine
const engine = new Engine("C:\\Program Files\\stockfish\\stockfish-windows-x86-64-avx2.exe"); // Replace with the actual path

// Start and initialize the engine
async function initializeEngine() {
    await engine.init();
}

initializeEngine(); // Initialize on startup

async function getBestMove(fen, depth) {
    await engine.isready();
    await engine.ucinewgame();
    await engine.position(fen);

    const result = await engine.go({ depth: depth });
    return result.bestmove;
}

app.get("/get-best-move", async (req, res) => {

    const fen = req.query.fen;
    const depth = req.query.depth;
    console.log("Received request to get best move:");
    if (!fen) {
        return res.status(400).send("Missing required parameter: fen");
    }
    if (!depth) {
        return res.status(400).send("Missing required parameter: depth");
    }

    console.log(`Parameter received: fen = ${fen}`);

    try {
        const bestMove = await getBestMove(fen, depth);
        res.json({ bestMove });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error computing best move");
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
