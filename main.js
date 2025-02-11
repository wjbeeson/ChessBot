// main.js
const { fork } = require('child_process');

const server = fork('./chess-bot.js');
const index = fork('./server.js');

server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
});

index.on('close', (code) => {
    console.log(`Index process exited with code ${code}`);
});
