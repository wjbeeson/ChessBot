const puppeteer = require('puppeteer');
async function injectControls(page) {
    page.evaluateOnNewDocument(() => {
        // Add the checkbox to the page when it loads
        window.addEventListener('DOMContentLoaded', () => {

            // Create container
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '10px';
            container.style.left = '10px';
            container.style.zIndex = '9999';
            container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent black
            container.style.padding = '10px';
            container.style.borderRadius = '8px';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.flexDirection = 'column';

            // Create AutoMove checkbox
            const automoveCheckbox = document.createElement('input');
            automoveCheckbox.type = 'checkbox';
            automoveCheckbox.id = 'automoveCheckbox';
            automoveCheckbox.style.transform = 'scale(1.5)';
            automoveCheckbox.style.marginBottom = '10px';
            automoveCheckbox.checked = true;

            const automoveLabel = document.createElement('label');
            automoveLabel.htmlFor = 'automoveCheckbox';
            automoveLabel.innerText = 'AutoMove';
            automoveLabel.style.color = 'white';
            automoveLabel.style.fontSize = '16px';

            // Create slider
            const sliderContainer = document.createElement('div');
            sliderContainer.style.display = 'flex';
            sliderContainer.style.alignItems = 'center';
            sliderContainer.style.marginTop = '10px';

            const sliderLabel = document.createElement('label');
            sliderLabel.innerText = 'Depth: ';
            sliderLabel.style.color = 'white';
            sliderLabel.style.marginRight = '5px';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = 'depthSlider';
            slider.min = '1';
            slider.max = '31';
            slider.value = '20';  // Default depth
            slider.style.width = '100px';
            slider.step = '5';

            const sliderValue = document.createElement('span');
            sliderValue.innerText = slider.value;
            sliderValue.style.color = 'white';
            sliderValue.style.marginLeft = '5px';

            // Append elements to container
            container.appendChild(automoveCheckbox);
            container.appendChild(automoveLabel);
            sliderContainer.appendChild(sliderLabel);
            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(sliderValue);
            container.appendChild(sliderContainer);
            document.body.appendChild(container);

            // Listen for AutoMove checkbox changes
            window.automoveEnabled = automoveCheckbox.checked;
            automoveCheckbox.addEventListener('change', () => {
                window.automoveEnabled = automoveCheckbox.checked;
                console.log(`Automoving is now ${window.automoveEnabled ? 'enabled' : 'disabled'}.`);
            });

            // Listen for slider changes
            window.depth = parseInt(slider.value, 10);
            slider.addEventListener('input', () => {
                window.depth = parseInt(slider.value, 10);
                sliderValue.innerText = slider.value;
                console.log(`Depth is now set to ${window.depth}.`);
            });
        });
    })
}

async function interceptWebsocket(page) {
    page.evaluateOnNewDocument(() => {
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
}
//TODO: Not implemented
async function createLine(bestMove) {
    const originSquare = bestMove.substring(0, 2);
    const targetSquare = bestMove.substring(2, 4);
    let x1 = originSquare.charCodeAt(0)-96-4.5;
    let y1 = -1 * (parseInt(originSquare.at(1))-4.5);
    let x2 = targetSquare.charCodeAt(0)-96-4.5;
    let y2 = -1 * (parseInt(targetSquare.at(1))-4.5);

    if (!isWhite) {
        x1 = -1 * x1
        y1 = -1 * y1
        x2 = -1 * x2
        y2 = -1 * y2

    }

    const boardSize = await page.evaluate(() => {
        return document.querySelector('cg-container').getAttribute('style')
            .split("height: ")[1]
            .replace('px', '')
            .replace('px', '');
    });

    await page.evaluate(
        (x1, y1, x2, y2, originSquare, targetSquare, boardSize) => {
            const gElement = document.querySelector('g');

            if (gElement) {
                const line = document.createElement('line');
                line.setAttribute("stroke", "#15781B");
                line.setAttribute("stroke-width", "0.15625");
                line.setAttribute("stroke-linecap", "round");
                line.setAttribute("marker-end", "url(#arrowhead-g)");
                line.setAttribute("opacity", "1");
                line.setAttribute("x1", x1.toString());
                line.setAttribute("y1", y1.toString());
                line.setAttribute("x2", x2.toString());
                line.setAttribute("y2", y2.toString());

                const container = document.createElement('g');
                container.setAttribute("cgHash", `${boardSize},${boardSize},${originSquare},${targetSquare},green`);

                container.appendChild(line);
                gElement.appendChild(container);
            }
        },
        x1, y1, x2, y2, originSquare, targetSquare, boardSize
    );
}
//TODO: Not implemented
async function checkForNextOpponentButton(message) {

}
async function calculateBestMove(fen, depth) {
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
// Define sendWebSocketMessage within Node.js context
async function sendWebSocketMessage(page, message) {
    await page.evaluate((msg) => {
        if (window.activeWebSocket) {
            window.activeWebSocket.send(msg);
            console.log("Move sent!");
        } else {
            console.error("No active WebSocket connection to send the message.");
        }
    }, message);
}
async function getPlayerColor(page) {
    // calculate the player color

    return await page.evaluate(() => {
        const messageDiv = document.querySelector('.message');
        if (messageDiv) {
            // Get the text content of the div
            const messageText = messageDiv.textContent || messageDiv.innerText;

            // Check if the message contains "white" or "black"
            if (messageText.includes("white")) {
                console.log("You play the white pieces")
                return "w";
            } else if (messageText.includes("black")) {
                console.log("You play the black pieces")
                return "b";
            } else {
                console.log("Error: Piece color not found.");
                return null;
            }
        }
    })

}
async function runBot() {
    // Start and navigate to the Lichess website
    let isWhite = false;
    let autoMoveEnabled = true;
    const browser = await puppeteer.launch({headless: false, defaultViewport: null});
    const page = await browser.newPage();

    // Inject some elements into the page to control the bot
    await injectControls(page);

    // Intercept the websocket before navigation
    await interceptWebsocket(page);

    // Navigate to lichess
    await page.goto('https://lichess.org/', {waitUntil: 'networkidle2'});


    // Expose Node.js function to handle WebSocket messages
    await page.exposeFunction('handleWebSocketMessage', async (message) => {
        let messageData = JSON.parse(message);
        console.log("Received message:", messageData);

        // Get the player data
        if (messageData === 0 || messageData.t === 'crowd') {
            let tempIsWhite = await getPlayerColor(page);
            if (tempIsWhite) {
                isWhite = tempIsWhite === "w";
            }
        }

        // Only parse messages that contain a fen
        if (!messageData.t || messageData.t !== 'move') {
            return;
        }
        let currentFen = messageData.d.fen;

        // Don't calculate the best move if it's not your turn
        let isWhitesTurn = messageData.v % 2 === 0;
        if (!isWhite === isWhitesTurn) {
            console.log("It's not your turn");
            return;
        }

        // Complete the fen based on the current turn
        currentFen += isWhitesTurn ? " w" : " b";

        // Get the current depth
        const depth = await page.evaluate(() => {
            return window.depth;
        })
        const bestMove = await calculateBestMove(currentFen, depth);
        console.log("move: ", bestMove);
        //await createLine(bestMove);

        // Don't send the move to the server unless autoMove is enabled
        autoMoveEnabled = await page.evaluate(() => {
            return window.automoveEnabled;
        })
        if (!autoMoveEnabled) {
            console.log("Automove not enabled. Skipping... ")
            return;
        }

        // Assemble the payload and send the message
        let payload = {
            t: "move",
            d: {u: bestMove, b: 1, l: 100, a: 1}
        }

        await sendWebSocketMessage(page, JSON.stringify(payload));

    });

    // Optional: Listen for console messages from the page
    //page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
}

runBot().catch((error) => console.error(error));
