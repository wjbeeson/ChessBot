// config.js

// 100 = 1 point in lichess
// maxScoreLoss is the target difference between the best move and the move that is chosen
module.exports = {
    enginePath: "./stockfish_24101214_x64_avx2.exe",
    mateBoost: 10000000,
    maxScoreLoss: 200, // Maximum difference between detected best score and chosen score
    scoreFloor: -700, // Never choose suboptimal score when below this score
    port: 3001,
    gaslightLines: 20, // Number of different lines bot considers when gas-lighting. More = more time, and worse moves
    timeThresholds: // Auto adjust time thresholds. Hardcoded for bullet
        {
            61: 1500,
            50: 3500,
            40: 4500,
            30: 2500,
            5: 300,
        },
    smackModeMovetime: 300, // The amount of time for each move in smackMode
    smackModeMinScore: -900, // The minimum score to activate smackMode
    smackModeMinMoves: 20, // the minimum number of moves to allow smackMode activation
    smackModeMaxMoves: 40, // the max number of moves before smackMode activation
    smackModeMinTime: 11,
};