const puppeteer = require('puppeteer');
const Stockfish = require('stockfish'); // Ensure stockfish is installed

(async () => {
    // Launch Puppeteer and navigate to Lichess
    const browser = await puppeteer.launch({ headless: false }); // Set to false to see the browser
    const page = await browser.newPage();
    await page.goto('https://lichess.org/');

    // Expose the computeBestMove function to the page context
    await page.exposeFunction('computeBestMove', async (fen) => {
        return new Promise((resolve, reject) => {
            const engine = Stockfish();
            engine.onmessage = function (event) {
                if (event && typeof event === 'string' && event.includes('bestmove')) {
                    const bestMove = event.split(' ')[1];
                    resolve(bestMove);
                    // Terminate the engine after computation
                    engine.postMessage('quit');
                }
            };
            // Send commands to Stockfish
            engine.postMessage(`position fen ${fen}`);
            engine.postMessage('go depth 15'); // You can adjust the depth as needed
        });
    });

    // Inject code into the page to intercept WebSocket messages and compute moves
    await page.evaluate(() => {
        let originalWebSocket = window.WebSocket;
        window.WebSocket = new Proxy(originalWebSocket, {
            construct(target, args) {
                const wsInstance = new target(...args);

                wsInstance.addEventListener('message', async (event) => {
                    const message = JSON.parse(event.data);

                    if (message.d && typeof message.d.fen === 'string' && typeof message.v === 'number') {
                        let currentFen = message.d.fen;
                        const isWhitesTurn = message.v % 2 === 0;
                        currentFen += isWhitesTurn ? ' w' : ' b';

                        // Call the exposed computeBestMove function
                        const bestMove = await window.computeBestMove(currentFen);

                        // Send the best move via WebSocket
                        wsInstance.send(
                            JSON.stringify({
                                t: 'move',
                                d: { u: bestMove, b: 1, l: 100, a: 1 },
                            })
                        );
                    }
                });

                return wsInstance;
            },
        });
    });

    // Keep the browser open
    // await browser.close(); // Uncomment if you want to close the browser after execution
})();
