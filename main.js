/**
 * Main Entry Point
 * Starts both the Stockfish server and the Lichess bot
 */

const { fork } = require('child_process');
const path = require('path');

// Start the Stockfish API server
const serverProcess = fork(path.join(__dirname, 'src/server/stockfishServer.js'));

// Start the Lichess bot
const botProcess = fork(path.join(__dirname, 'src/bot/lichessBot.js'));

serverProcess.on('close', (code) => {
    console.log(`Stockfish server process exited with code ${code}`);
});

botProcess.on('close', (code) => {
    console.log(`Bot process exited with code ${code}`);
});
