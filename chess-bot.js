const puppeteer = require('puppeteer');
const Chess = require("chess.js").Chess; // For Node.js
let moveCounter = 0;
let playerColorIsWhite = false;
let gaslightOngoing = true;
let gaslightEnabled = false;
let autoMoveEnabled = false;
let madeFirstMove = false;

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

            // Retrieve stored settings or default to true
            window.automoveEnabled = localStorage.getItem('automoveEnabled') !== 'false';
            window.gaslightingEnabled = localStorage.getItem('gaslightingEnabled') !== 'false';

            // Create AutoMove checkbox
            const automoveCheckbox = document.createElement('input');
            automoveCheckbox.type = 'checkbox';
            automoveCheckbox.id = 'automoveCheckbox';
            automoveCheckbox.style.transform = 'scale(1.5)';
            automoveCheckbox.style.marginBottom = '10px';
            automoveCheckbox.checked = window.automoveEnabled;

            const automoveLabel = document.createElement('label');
            automoveLabel.htmlFor = 'automoveCheckbox';
            automoveLabel.innerText = 'AutoMove';
            automoveLabel.style.color = 'white';
            automoveLabel.style.fontSize = '16px';

            // Create Gaslight checkbox
            const gaslightCheckbox = document.createElement('input');
            gaslightCheckbox.type = 'checkbox';
            gaslightCheckbox.id = 'gaslightCheckbox';
            gaslightCheckbox.style.transform = 'scale(1.5)';
            gaslightCheckbox.style.marginBottom = '10px';
            gaslightCheckbox.checked = window.gaslightingEnabled;

            const gaslightLabel = document.createElement('label');
            gaslightLabel.htmlFor = 'gaslightCheckbox';
            gaslightLabel.innerText = 'Gaslight';
            gaslightLabel.style.color = 'white';
            gaslightLabel.style.fontSize = '16px';

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
            slider.value = '22';  // Default depth
            slider.style.width = '100px';
            slider.step = '1';

            const sliderValue = document.createElement('span');
            sliderValue.id = 'depthSliderText';
            sliderValue.innerText = slider.value;
            sliderValue.style.color = 'white';
            sliderValue.style.marginLeft = '5px';

            // Append elements to container
            // Create a row container for checkboxes
            const checkboxRow = document.createElement('div');
            checkboxRow.style.display = 'flex';
            checkboxRow.style.alignItems = 'center';
            checkboxRow.style.justifyContent = 'space-between';
            checkboxRow.style.width = '100%';

            // Create individual containers for each checkbox-label pair
            const createCheckboxContainer = (checkbox, label) => {
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';  // Align checkbox and label horizontally
                container.style.marginRight = '15px';  // Add spacing between checkboxes

                label.style.marginLeft = '5px'; // Ensures spacing between checkbox and text
                container.appendChild(checkbox);
                container.appendChild(label);

                return container;
            };

            const autoMoveContainer = createCheckboxContainer(automoveCheckbox, automoveLabel);
            const gaslightContainer = createCheckboxContainer(gaslightCheckbox, gaslightLabel);

            checkboxRow.appendChild(autoMoveContainer);
            checkboxRow.appendChild(gaslightContainer);
            container.appendChild(checkboxRow);

            sliderContainer.appendChild(sliderLabel);
            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(sliderValue);
            container.appendChild(sliderContainer);
            document.body.appendChild(container);

            // Listen for AutoMove checkbox changes
            window.automoveEnabled = automoveCheckbox.checked;
            automoveCheckbox.addEventListener('change', () => {
                window.automoveEnabled = automoveCheckbox.checked;
                localStorage.setItem('automoveEnabled', window.automoveEnabled);
                console.log(`Automoving is now ${window.automoveEnabled ? 'enabled' : 'disabled'}.`);
            });

            // Listen for Gaslight checkbox changes
            window.gaslightingEnabled = gaslightCheckbox.checked;
            gaslightCheckbox.addEventListener('change', () => {
                window.gaslightingEnabled = gaslightCheckbox.checked;
                localStorage.setItem('gaslightingEnabled', window.gaslightingEnabled);
                console.log(`Gaslighting is now ${window.gaslightingEnabled ? 'enabled' : 'disabled'}.`);
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
                    window.handleWebSocketMessage(event.data); // will declare this method later in the page context
                });

                return ws;
            }
        });
        console.log("Websocket Interception is set up. >:D");
    });
}

//TODO: Not implemented
async function createLine(bestMove) {
    const originSquare = bestMove.substring(0, 2);
    const targetSquare = bestMove.substring(2, 4);
    let x1 = originSquare.charCodeAt(0) - 96 - 4.5;
    let y1 = -1 * (parseInt(originSquare.at(1)) - 4.5);
    let x2 = targetSquare.charCodeAt(0) - 96 - 4.5;
    let y2 = -1 * (parseInt(targetSquare.at(1)) - 4.5);

    if (!playerColorIsWhite) {
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

async function calculateBestMove(fen, depth) {
    const fetchValue = `http://localhost:3001/get-best-move?fen=${encodeURIComponent(fen)}&depth=${depth}`
    //console.log(`Received request to get best move: ${fetchValue}`);
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

async function getGaslightMove(moveCounter) {
    let moveDictWhite = {
        0: "e2e4",
        2: "e1e2",
        4: "e2e3",
        6: "e3e2",
        8: "e2e1",
    }
    let moveDictBlack = {
        1: "e7e5",
        3: "e8e7",
        5: "e7e6",
        7: "e6e7",
        9: "e7e8"
    }
    let moveDict = {...moveDictBlack, ...moveDictWhite};

    if (!moveCounter in moveDict) {
        return null;
    }

    return moveDict[moveCounter];

}

async function isValidMove(fen, from, to) {
    const chess = new Chess();
    chess.load(fen);
    const move = {
        from: from,
        to: to
    }
    try {
        chess.move(move);
        return true;
    } catch {
        return false;
    }
}


async function sendMove(page, move) {
    let payload = {
        t: "move",
        d: {u: move, b: 1, l: 100, a: 1}
    }
    await sendWebSocketMessage(page, JSON.stringify(payload));
}

async function fetchPageVariable(page, variableName) {
    return await page.evaluate((varName) => {
        // Check if the property exists in the window object
        if (typeof window[varName] === "undefined") {
            return null; // If the variable doesn't exist, return null
        }

        // If it exists, return its value
        return window[varName];

    }, variableName); // Pass variableName from Node.js to the browser context
}

async function checkForThankYouButton(page) {
    //Try to click the 'Thank you' Button to be a dick
    await page.waitForFunction(
        () => {
            const thankYouButton = Array.from(document.querySelectorAll('span'))
                .find(button => button.textContent.trim() === 'ty');
            if (thankYouButton) {
                thankYouButton.click(); // Click the button once it appears
                return true; // Resolve the wait once the button is clicked
            }
            return false; // Keep waiting if not found
        },
        {timeout: 2000} // Set the timeout to 2 seconds
    );
}

async function adjustDepthBasedOnTime(page, timeLeft) {
    // Threshold mapping: { timeLeft: depthValue }
    let timeThresholds = {
        20: 16,
        10: 5,
        3: 1
    };

    // Loop through thresholds in descending order
    for (let threshold of Object.keys(timeThresholds).map(Number).sort((a, b) => b - a)) {
        if (timeLeft < threshold) {
            let depthValue = timeThresholds[threshold];

            await page.evaluate((depth) => {
                window.depth = depth;
                document.getElementById("depthSlider").value = depth;
                document.getElementById("depthSliderText").innerText = depth.toString();
                console.log(`Depth set to ${depth}. Adjusting speed...`);
            }, depthValue);

            break; // Stop after the first matching threshold
        }
    }
}

async function definePageMessageHandler(page) {
    await page.exposeFunction('handleWebSocketMessage', async (message) => {

        let messageData = JSON.parse(message);
        console.log("Message:", messageData);
        console.log("moveCounter "+ moveCounter)

        // Opponent left -> go to the next game
        if (messageData.t && (messageData.t === 'gone' || messageData.t === 'goneIn')) {
            await newGame(page);
            return;
        }

        // if the game is over, go to the next game
        if (messageData.t && messageData.t === "endData") {
            try {
                await checkForThankYouButton(page)
                console.log("Pressed 'Thank You' button.")
            } catch (e) {
                console.log("Couldn't press thank you button.")
            }
            await newGame(page);
            return;
        }

        // Get the player data
        if (messageData === 0 || messageData.t === 'crowd') {
            let tempIsWhite = await getPlayerColor(page);
            if (tempIsWhite) {
                playerColorIsWhite = tempIsWhite === "w";
            }
        }

        // Hack. System works by responding to moves, so will sit there forever as white.
        if (playerColorIsWhite && moveCounter === 0 && !madeFirstMove) {
            let move = await getGaslightMove(moveCounter)
            if (!move) {
                move = 'e2e4'; // default move
            }
            await sendMove(page, move) // No need to increment move here as message will be sent to socket after made
            madeFirstMove = true;
            console.log("making first move as white...")
            return;
        }

        // Only react to messages that contain a fen indicating opponent has moved
        if (!messageData.t || messageData.t !== 'move') {
            return;
        }

        // Increment move counter
        if (messageData.d && messageData.d['uci'] && messageData.t && messageData.t === 'move') {
            moveCounter++
        }

        // Don't calculate a move if it's not your turn
        let isWhitesTurn = messageData.v % 2 === 0;
        if (!playerColorIsWhite === isWhitesTurn) {
            return;
        }

        // Turn depth down as clock runs down to play faster
        let color = playerColorIsWhite ? "white" : "black";
        let timeLeft = messageData.d['clock'][color]
        await adjustDepthBasedOnTime(page, timeLeft)


        // Assemble the fen from the message and the current player turn indicator
        let fen = messageData.d.fen + (isWhitesTurn ? " w" : " b");

        // Update each setting by checking if changed in the window control panel
        gaslightEnabled = await page.evaluate(() => {
            return window.gaslightingEnabled;
        })
        autoMoveEnabled = await page.evaluate(() => {
            return window.automoveEnabled;
        })

        // Don't send any moves if AutoMove is disabled
        if (!autoMoveEnabled) {

            console.log("Automove not enabled. Skipping... ")
            return;
        }



        // Make a gaslight move if enabled and possible
        if (gaslightEnabled && gaslightOngoing) {
            let gaslightMove = await getGaslightMove(moveCounter)
            if (gaslightMove) {

                // Substring converts from e2e4 format
                // Gaslight move can be invalid - Ex: King walking into check
                if (await isValidMove(fen, gaslightMove.substring(0, 2), gaslightMove.substring(2, 4))) {
                    await sendMove(page, gaslightMove);
                    return;
                }
            }
            gaslightOngoing = false

        }

        const bestMove = await calculateBestMove(fen, await fetchPageVariable(page, "depth"));
        console.log("move: ", bestMove);
        //await createLine(bestMove);

        await sendMove(page, bestMove)
    });
}

async function newGame(page) {
    let newPage = "https://lichess.org/?hook_like=" + page.url().split("lichess.org/")[1]
    playerColorIsWhite = false;
    moveCounter = 0;
    gaslightOngoing = true;
    madeFirstMove = false;
    page.goto(newPage);
}

async function preparePage() {
    // Start and navigate to the Lichess website

    const browser = await puppeteer.launch({headless: false, defaultViewport: null});
    const page = await browser.newPage();


    // Inject some elements into the page to control the bot
    await injectControls(page);

    // Intercept the websocket before navigation
    await interceptWebsocket(page);

    // Disable pop-up that asks if you want to leave site after new game
    await page.evaluate(() => {
        window.onbeforeunload = null;
    });

    // Navigate to lichess
    await page.goto('https://lichess.org/', {waitUntil: 'networkidle2'});


    // Locally declare a function to call each time the intercepted websocket gets a message
    await definePageMessageHandler(page)

    // Optional: Listen for console messages from the page
    //page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
}

preparePage().catch((error) => console.error(error));
