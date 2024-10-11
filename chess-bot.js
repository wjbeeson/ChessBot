const puppeteer = require('puppeteer');

async function runBot() {

    // Start and navigate to the Lichess website
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Intercept the websocket before navigation
    await page.evaluateOnNewDocument(() => {
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = new Proxy(OriginalWebSocket, {
            construct(target, args) {
                const ws = new target(...args);

                // Store this WebSocket instance globally so it can be accessed for sending messages
                window.activeWebSocket = ws;

                // Add an event listener for incoming messages
                ws.addEventListener('message', (event) => {
                    window.handleWebSocketMessage(event.data);
                });

                return ws;
            }
        });
        console.log("WebSocket interception is set up.");
    });

    // Navigate to lichess
    await page.goto('https://lichess.org/', { waitUntil: 'networkidle2' });

    // Define sendWebSocketMessage within Node.js context
    async function sendWebSocketMessage(message) {
        await page.evaluate((msg) => {
            if (window.activeWebSocket) {
                window.activeWebSocket.send(msg);
                console.log("Move sent!");
            } else {
                console.error("No active WebSocket connection to send the message.");
            }
        }, message);
    }

    async function calculateBestMove(fen) {
        const depth = 30;
        const fetchValue = `http://localhost:3001/get-best-move?fen=${encodeURIComponent(fen)}&depth=${depth}`
        console.log(`Received request to get best move: ${fetchValue}`);
        try {
            const response = await fetch(fetchValue);
            const data = await response.json();
            return data.bestMove;
        } catch (error) {
            console.error("Error:", error);
            return null; // Return null if there's an error
        }
    }

    // Expose Node.js function to handle WebSocket messages
    await page.exposeFunction('handleWebSocketMessage', async (message) => {
        let messageData = JSON.parse(message);
        console.log("Received message:", messageData);

        if (messageData.d && typeof messageData.d.fen === "string" && typeof messageData.v === "number") {
            let currentFen = messageData.d.fen;

            let isWhitesTurn = messageData.v % 2 === 0;
            currentFen += isWhitesTurn ? " w" : " b";

            const bestMove = await calculateBestMove(currentFen);

            let payload = {
                t: "move",
                d: {u: bestMove, b: 1, l: 100, a: 1}
            }
            await sendWebSocketMessage(JSON.stringify(payload));
        }
    });

    // Optional: Listen for console messages from the page
    //page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
}

runBot().catch((error) => console.error(error));
