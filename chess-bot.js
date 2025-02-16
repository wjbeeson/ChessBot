const puppeteer = require('puppeteer');
const Chess = require("chess.js").Chess; // For Node.js
const {
    scoreFloor,
    smackModeMovetime,
    gaslightLines,
    timeThresholds,
    smackModeMinMoves,
    smackModeMaxMoves,
    smackModeMinScore,
    smackModeMinTime
} = require("./config");


let moveCounter = 0;
let playerColorIsWhite = false;
let badOpeningOngoing = true;
let madeFirstMove = false;
let smackModeEnabled = false;
let evalBarAdded = false;


async function injectControls(page) {
    await page.evaluateOnNewDocument(() => {
        window.addEventListener('DOMContentLoaded', () => {

            /**
             * Utility to create a checkbox + label pair, wire up localStorage,
             * and handle changes. Returns a container <div> that can be appended
             * to the parent.
             *
             * @param {object} options
             * @param {string} options.id - The ID for the input (checkbox).
             * @param {string} options.labelText - The visible text for the label.
             * @param {string} options.storageKey - localStorage key to persist the checked state.
             * @param {string} options.windowProp - A property name on `window` to reflect checkbox state (e.g. 'automoveEnabled').
             * @param {function} options.onToggle - A callback invoked whenever the checkbox is toggled.
             * @param {boolean} [options.defaultValue=true] - Default state if not found in localStorage.
             */
            function createLabeledCheckbox({
                                               id, labelText, storageKey, windowProp, onToggle, defaultValue = true
                                           }) {
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.marginRight = '15px';

                // Retrieve persisted state or fallback
                const storedValue = localStorage.getItem(storageKey);
                const isChecked = storedValue === null ? defaultValue : (storedValue !== 'false');

                // Create checkbox
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = id;
                checkbox.style.transform = 'scale(1.5)';
                checkbox.style.marginBottom = '10px';
                checkbox.checked = isChecked;

                // Reflect on window
                window[windowProp] = isChecked;

                // Create label
                const label = document.createElement('label');
                label.htmlFor = id;
                label.innerText = labelText;
                label.style.color = 'white';
                label.style.fontSize = '16px';
                label.style.marginLeft = '5px';
                label.style.marginBottom = '10px';

                // Handle toggles
                checkbox.addEventListener('change', () => {
                    const newVal = checkbox.checked;
                    window[windowProp] = newVal;
                    localStorage.setItem(storageKey, newVal);
                    onToggle && onToggle(newVal); // optional callback
                });

                container.appendChild(checkbox);
                container.appendChild(label);

                return container;
            }

            // Create the main container for controls
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '10px';
            container.style.left = '10px';
            container.style.zIndex = '9999';
            container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            container.style.padding = '10px';
            container.style.borderRadius = '8px';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.flexDirection = 'column';

            // Collapsible header
            let isCollapsed = localStorage.getItem('menuCollapsed') === 'true';

            const header = document.createElement('div');
            header.style.cursor = 'pointer';
            header.style.color = 'white';
            header.style.fontSize = '18px';
            header.style.fontWeight = 'bold';
            header.style.marginBottom = '10px';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.innerText = 'Bot Controls';
            const arrow = document.createElement('span');
            arrow.innerText = isCollapsed ? '▶' : '▼';
            arrow.style.marginLeft = '10px';
            header.appendChild(arrow);


            const toggleCollapse = () => {
                isCollapsed = !isCollapsed;
                localStorage.setItem('menuCollapsed', isCollapsed);
                content.style.display = isCollapsed ? 'none' : 'flex';
                arrow.innerText = isCollapsed ? '▶' : '▼';
            };

            header.addEventListener('click', toggleCollapse);

            // Content container
            const content = document.createElement('div');
            content.style.display = isCollapsed ? 'none' : 'flex';
            content.style.flexDirection = 'column';


            // Create a row container for all checkboxes
            // const checkboxRow = document.createElement('div');
            // checkboxRow.style.display = 'flex';
            // checkboxRow.style.alignItems = 'center';
            // checkboxRow.style.justifyContent = 'space-between';
            // checkboxRow.style.width = '100%';

            // Create individual checkboxes using the helper
            const automoveContainer = createLabeledCheckbox({
                id: 'automoveCheckbox',
                labelText: 'AutoMove',
                storageKey: 'automoveEnabled',
                windowProp: 'automoveEnabled',
                onToggle: (val) => console.log(`Automoving is now ${val ? 'enabled' : 'disabled'}.`)
            });

            const gaslightContainer = createLabeledCheckbox({
                id: 'gaslightingCheckbox',
                labelText: 'Gaslight',
                storageKey: 'gaslightingEnabled',
                windowProp: 'gaslightingEnabled',
                onToggle: (val) => console.log(`Gaslighting is now ${val ? 'enabled' : 'disabled'}.`)
            });

            const badOpeningContainer = createLabeledCheckbox({
                id: 'badOpeningCheckbox',
                labelText: 'Bongcloud',
                storageKey: 'badOpeningEnabled',
                windowProp: 'badOpeningEnabled',
                onToggle: (val) => console.log(`DoBadOpenings is now ${val ? 'enabled' : 'disabled'}.`),
                defaultValue: false
            });

            const showArrowsContainer = createLabeledCheckbox({
                id: 'showArrowsCheckbox',
                labelText: 'ShowArrows',
                storageKey: 'showArrowsEnabled',
                windowProp: 'showArrowsEnabled',
                onToggle: (val) => console.log(`showArrowsEnabled is now ${val ? 'enabled' : 'disabled'}.`,),
                defaultValue: false,
            });

            const adjustSpeedContainer = createLabeledCheckbox({
                id: 'adjustSpeedCheckbox',
                labelText: 'AdjustSpeed',
                storageKey: 'adjustSpeedEnabled',
                windowProp: 'adjustSpeedEnabled',
                onToggle: (val) => console.log(`adjustSpeedEnabled is now ${val ? 'enabled' : 'disabled'}.`)
            });

            content.appendChild(automoveContainer);
            content.appendChild(gaslightContainer);
            content.appendChild(badOpeningContainer);
            content.appendChild(showArrowsContainer);
            content.appendChild(adjustSpeedContainer);
            container.appendChild(header);
            container.appendChild(content);

            // Create slider styling
            const styleEl = document.createElement('style');
            styleEl.innerHTML = `
            /* Remove default appearance */
            input[type="range"] {
              -webkit-appearance: none; 
              margin: 0; /* Remove default margin */
              width: 100%;
              box-sizing: border-box;
            }
            
            /* The slider track (WebKit) */
            input[type="range"]::-webkit-slider-runnable-track {
              height: 4px;
              background: #ccc;
              border-radius: 2px;
            }
            
            /* The slider thumb (WebKit) */
            input[type="range"]::-webkit-slider-thumb {
              -webkit-appearance: none;
              height: 16px;
              width: 16px;
              margin-top: -6px; 
              background: #fff;
              border: 1px solid #999;
              border-radius: 50%;
              cursor: pointer;
            }
            `;
            document.head.appendChild(styleEl);

            // Slider container
            const sliderContainer = document.createElement('div');
            sliderContainer.style.display = 'flex';
            sliderContainer.style.alignItems = 'center';
            sliderContainer.style.marginTop = '10px';

            const sliderLabel = document.createElement('label');
            sliderLabel.innerText = 'Movetime: ';
            sliderLabel.style.color = 'white';
            sliderLabel.style.marginRight = '5px';

            // Create slider
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = 'movetimeSlider';
            slider.min = '0';
            slider.max = '5000';
            slider.value = '1500'; // Default
            slider.step = '100';
            slider.style.width = '100%';
            slider.style.boxSizing = 'border-box';

            const sliderValue = document.createElement('span');
            sliderValue.id = 'movetimeSliderText';
            sliderValue.innerText = slider.value;
            sliderValue.style.color = 'white';
            sliderValue.style.marginLeft = '5px';

            // Keep window.movetime in sync
            window.movetime = parseInt(slider.value, 10) + 1;
            slider.addEventListener('input', () => {
                window.movetime = parseInt(slider.value, 10) + 1;
                sliderValue.innerText = slider.value;
                console.log(`Movetime is now set to ${window.movetime}.`);
            });

            sliderContainer.appendChild(sliderLabel);
            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(sliderValue);
            content.appendChild(sliderContainer);

            // Finally append our container to the body (or wherever you like)
            document.body.appendChild(container);
        });
    });
}

async function addEvalBar(page) {
    // Decide the rotation value
    let rotateValue = "180deg"
    await page.evaluate(async (val) => {
        const evalBarInner = window.evalBarInner;
        if (!evalBarInner) {
            async function insertEvalBar() {

                // 1) Create a <style> element for minimal layout
                const styleEl = document.createElement('style');
                styleEl.innerHTML = `
                input[type="range"]::-webkit-slider-runnable-track {
                background: none; /* Removes the default track */
                }

                #evalBarInner {
                    margin
                    transform-origin: center;
                    display: flex;
                    flex-direction: column-reverse;
                    align-items: center;
                    justify-content: center;
                    gap: 10px; /* Adds spacing between items */
                    margin-top: 20px; /* Moves the container down */
                }

                #evalSlider {
                    width: -webkit-fill-available;
                    -webkit-appearance: none;
                    appearance: none;
                    height: 10px;
                    background: linear-gradient(to right, white, black);
                    border-radius: 5px;
                    outline: none;
                    margin: 0;
                    padding: 0;
                }

                #evalSlider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #007BFF;
                    cursor: pointer;
                    margin-top: -5px; /* Center thumb vertically */
                }

                #evalSlider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #007BFF;
                    cursor: pointer;
                }

                #evalSlider::-webkit-slider-runnable-track {
                    height: 10px;
                    background: linear-gradient(to right, white, black);
                    border-radius: 5px;
                }

                #evalSlider::-moz-range-track {
                    height: 10px;
                    background: linear-gradient(to right, white, black);
                    border-radius: 5px;
                }
            `;

                document.head.appendChild(styleEl);

                // 2) Create the container for the eval bar

                // 3) Create an inner wrapper for rotation
                const evalBarInner = document.createElement('div');
                evalBarInner.id = 'evalBarInner';

                // 4) Create the slider itself
                const evalSlider = document.createElement('input');
                evalSlider.id = 'evalSlider';
                evalSlider.type = 'range';
                evalSlider.min = '-700';
                evalSlider.max = '700';
                evalSlider.value = '0';  // Start in the middle


                // Create the label
                const evalLabel = document.createElement('span');
                evalLabel.id = 'evalLabel';
                evalLabel.textContent = evalSlider.value;  // Initialize label with slider value
                evalLabel.style.transform = 'rotate(180deg)';
                evalLabel.style.fontSize = '20px';               // Bigger font
                evalLabel.style.backgroundColor = '#555555';     // Darker gray background
                evalLabel.style.color = '#ffffff';               // White text color for contrast
                evalLabel.style.padding = '5px 10px';            // Padding inside the label
                evalLabel.style.borderRadius = '8px';            // Rounded edges
                evalLabel.style.display = 'inline-block';        // Ensure background fits content
                evalLabel.style.border = '1px solid black';      // Thin black border
                window.evalLabel = evalLabel;

                evalBarInner.appendChild(evalSlider);
                evalBarInner.appendChild(evalLabel);

                // 5) Append the slider to the inner wrapper, then to the container
                function insertBar() {
                    const boardElement = document.querySelector('.round__app__board.main-board');
                    if (boardElement && !document.getElementById('evalBarInner')) {
                        boardElement.after(evalBarInner);
                    }
                }

                // Initial insertion
                insertBar();

                // Observe DOM changes and re-insert if necessary
                const observer = new MutationObserver(() => insertBar());
                observer.observe(document.body, {childList: true, subtree: true});

                window.evalSlider = evalSlider;
                window.evalBarInner = evalBarInner;
                console.log('Eval bar inserted.');
            }

            await insertEvalBar();
        }
        window.evalBarInner.style.transform = `rotate(${val})`;

        console.log("rotated!")
    }, rotateValue);
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

async function injectArrowMarkerDef(page) {
    await page.evaluate(() => {
        let marker = document.querySelector('marker');
        if (marker) {
            return; // already defined
        }
        // Find or create <defs> within that SVG
        let defs = document.querySelector('defs');
        // Now inject the <marker> definition
        defs.insertAdjacentHTML('beforeend', `<marker id="arrowhead-g" orient="auto" overflow="visible"
            markerWidth="4" markerHeight="4" refX="2.05" refY="2" cgKey="g">
            <path d="M0,0 V4 L3,2 Z" fill="#15781B"></path>
            </marker>`);

        console.log('Marker arrowhead-g injected into <defs>.');
    })
}

async function clearPreviousArrows(page) {
    await page.evaluate(() => {
        let arrowContainer = document.querySelector('g');
        arrowContainer.innerHTML = '';
    })
}

async function showArrow(page, bestMove) {
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

    await page.evaluate((x1, y1, x2, y2, originSquare, targetSquare, boardSize) => {
        const gElement = document.querySelector('g');

        if (gElement) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("stroke", "#15781B");
            line.setAttribute("stroke-width", "0.15625");
            line.setAttribute("stroke-linecap", "round");
            line.setAttribute("marker-end", "url(#arrowhead-g)");
            line.setAttribute("opacity", "1");
            line.setAttribute("x1", x1.toString());
            line.setAttribute("y1", y1.toString());
            line.setAttribute("x2", x2.toString());
            line.setAttribute("y2", y2.toString());

            const container = document.createElementNS("http://www.w3.org/2000/svg", "g");
            container.setAttribute("cgHash", `${boardSize.replace(/;/g, "")},${boardSize.replace(/;/g, "")},${originSquare},${targetSquare},green`);

            container.appendChild(line);
            gElement.appendChild(container);
        }
    }, x1, y1, x2, y2, originSquare, targetSquare, boardSize);
}

async function calculateBestMove(fen, movetime) {
    const fetchValue = `http://localhost:3001/get-best-move?fen=${encodeURIComponent(fen)}&movetime=${movetime}`
    //console.log(`Received request to get best move: ${fetchValue}`);
    try {
        const response = await fetch(fetchValue);
        const data = await response.json();
        return data.moveInfo;
    } catch (error) {
        console.error("Error:", error);
        return null; // Return null if there's an error
    }
}

async function calculateGaslightMove(fen, movetime, lines) {
    const fetchValue = `http://localhost:3001/get-gaslight-move?fen=${encodeURIComponent(fen)}&movetime=${movetime}&lines=${lines}`
    //console.log(`Received request to get best move: ${fetchValue}`);
    try {
        const response = await fetch(fetchValue);
        const data = await response.json();
        return data.moveInfo;
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

async function getBadOpeningMove(moveCounter) {
    let moveDictWhite = {
        0: "e2e4", 2: "e1e2", 4: "e2e3", 6: "e3e2", 8: "e2e1",
    }
    let moveDictBlack = {
        1: "e7e5", 3: "e8e7", 5: "e7e6", 7: "e6e7", 9: "e7e8"
    }
    let moveDict = {...moveDictBlack, ...moveDictWhite};

    if (!(moveCounter in moveDict)) {
        return null;
    }

    return moveDict[moveCounter];

}

async function isValidMove(fen, from, to) {
    const chess = new Chess();
    chess.load(fen);
    const move = {
        from: from, to: to
    }
    try {
        chess.move(move);
        return true;
    } catch {
        return false;
    }
}

async function updateScore(page, score) {
    await page.evaluate((score) => {

        const slider = window.evalSlider;
        if (slider) {
            slider.value = score;
            score = -score;
            window.evalLabel.textContent = (score / 100).toFixed(1);
            console.log(`Eval bar updated to: ${score}`);
        } else {
            console.warn('No evalSlider found on window object.');
        }
    }, score);
}

async function sendMove(page, move, score, isWhite) {
    let payload = {
        t: "move", d: {u: move, b: 1, l: 100, a: 1}
    }
    if (isWhite) {
        score = -score;
    }
    await sendWebSocketMessage(page, JSON.stringify(payload));

    await updateScore(page, score);
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
    await page.waitForFunction(() => {
            const thankYouButton = Array.from(document.querySelectorAll('span'))
                .find(button => button.textContent.trim() === 'ty');
            if (thankYouButton) {
                thankYouButton.click(); // Click the button once it appears
                return true; // Resolve the wait once the button is clicked
            }
            return false; // Keep waiting if not found
        }, {timeout: 2000} // Set the timeout to 2 seconds
    );
}

async function setMovetime(page, time) {
    await page.evaluate((movetime) => {
        if (window.movetime + 1 === movetime) {
            return;
        }
        window.movetime = movetime + 1;
        document.getElementById("movetimeSlider").value = movetime;
        document.getElementById("movetimeSliderText").innerText = movetime.toString();
        console.log(`Movetime set to ${movetime}. Adjusting speed...`);
    }, time);
}

async function getDynamicMovetime(timeLeft) {
    // Loop through thresholds in descending order
    let movetimeValue = 1
    for (let threshold of Object.keys(timeThresholds).map(Number).sort((a, b) => a - b)) {
        if (timeLeft < threshold) {
            movetimeValue = timeThresholds[threshold];
            break; // Stop after the first matching threshold
        }
    }
    return movetimeValue
}

async function activateSmackMode(page) {
    smackModeEnabled = true
    await page.evaluate(() => {
        document.documentElement.style.setProperty('--c-bg-page', 'hsl(354 100% 19%)');
    });
}

async function updateSmackModeStatus(page, gameMoveCounter, timeLeft, score, minScore, minMoves, maxMoves, minTime) {
    // Will always toggle past this amount of moves
    if (gameMoveCounter > maxMoves || timeLeft < minTime) {
        await activateSmackMode(page)
        return
    }
    // Haven't reached the min moves to activate
    if (gameMoveCounter < minMoves) {
        return;
    }

    // Haven't reached a low enough score to activate
    if (score > minScore) {
        return
    }
    await activateSmackMode(page)
}

async function definePageMessageHandler(page) {
    await page.exposeFunction('handleWebSocketMessage', async (message) => {

        let messageData = JSON.parse(message);
        //console.log("Message:", messageData);

        // Opponent left -> go to the next game
        // TODO: double restarting probably causing crashes. Right now just commenting out and waiting.
        // if (messageData.t && (messageData.t === 'gone' || messageData.t === 'goneIn')) {
        //
        //     await newGame(page);
        //     return;
        // }

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
        let automoveEnabled = await fetchPageVariable(page, "automoveEnabled")

        if (playerColorIsWhite && moveCounter === 0 && !madeFirstMove && automoveEnabled) {
            let move = await getBadOpeningMove(moveCounter)
            if (!move) {
                move = 'd2d4'; // default move
            }
            await sendMove(page, move, 0, playerColorIsWhite) // No need to increment move here as message will be sent to socket after made
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
            console.log("moveCounter " + moveCounter)
        }

        // Don't calculate a move if it's not your turn
        let isWhitesTurn = messageData.v % 2 === 0;
        if (!playerColorIsWhite === isWhitesTurn) {
            await clearPreviousArrows(page)
            return;
        }

        // Assemble the fen from the message and the current player turn indicator
        let fen = messageData.d.fen + (isWhitesTurn ? " w" : " b");

        // Update each setting by checking if changed in the window control panel
        let badOpeningEnabled = await fetchPageVariable(page, "badOpeningEnabled")

        let showArrowEnabled = await fetchPageVariable(page, "showArrowsEnabled")

        let adjustSpeedEnabled = await fetchPageVariable(page, "adjustSpeedEnabled")

        let gaslightingEnabled = await fetchPageVariable(page, "gaslightingEnabled")

        // Turn movetime down as clock runs down to play faster
        let color = playerColorIsWhite ? "white" : "black";
        let timeLeft = messageData.d['clock'][color]
        if (adjustSpeedEnabled) {
            if (gaslightingEnabled && smackModeEnabled) {
                await setMovetime(page, smackModeMovetime)
            } else {
                await setMovetime(page, await getDynamicMovetime(timeLeft));
            }

        }

        // Make a bad opening move if enabled and possible
        if (badOpeningEnabled && badOpeningOngoing) {
            let badOpeningMove = await getBadOpeningMove(moveCounter)
            if (badOpeningMove) {

                // Substring converts from e2e4 format
                // BadOpening move can be invalid - Ex: King walking into check
                if (await isValidMove(fen, badOpeningMove.substring(0, 2), badOpeningMove.substring(2, 4))) {
                    await sendMove(page, badOpeningMove, 0, playerColorIsWhite);
                    return;
                }
            }
            badOpeningOngoing = false

        }
        let moveInfo = null
        let moveTime = await fetchPageVariable(page, "movetime")
        if (gaslightingEnabled) {
            if (smackModeEnabled) {
                moveInfo = await calculateBestMove(fen, moveTime);
            } else {
                moveInfo = await calculateGaslightMove(fen, moveTime, gaslightLines);
                await updateSmackModeStatus(page, moveCounter, timeLeft, moveInfo.score, smackModeMinScore, smackModeMinMoves, smackModeMaxMoves, smackModeMinTime);
            }

        } else {
            // If gaslighting is not enabled, just get the best move
            moveInfo = await calculateBestMove(fen, await fetchPageVariable(page, "movetime"));
        }

        //const moveInfo = await calculateGaslightMove(fen, await fetchPageVariable(page, "movetime"), gaslightLines);
        console.log("move: ", moveInfo.move);

        if (!evalBarAdded) {
            await addEvalBar(page)
            evalBarAdded = true
        }

        if (automoveEnabled) {
            await sendMove(page, moveInfo.move, moveInfo.score, playerColorIsWhite)
        }
        if (showArrowEnabled) {
            await clearPreviousArrows(page)
            await injectArrowMarkerDef(page);
            await showArrow(page, moveInfo.move);
        }

    });
}

async function newGame(page) {
    let newPage = "https://lichess.org/?hook_like=" + page.url().split("lichess.org/")[1]
    playerColorIsWhite = false;
    moveCounter = 0;
    badOpeningOngoing = true;
    madeFirstMove = false;
    smackModeEnabled = false;
    evalBarAdded = false;
    await new Promise(r => setTimeout(r, 5000));
    page.goto(newPage);
}

async function preparePage() {
    // Start and navigate to the Lichess website

    const browser = await puppeteer.launch({headless: false, defaultViewport: null});
    let pages = await browser.pages();
    const page = await pages[0];

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

    // Inject some elements into the page to control the bot
    await injectControls(page);

    // Optional: Listen for console messages from the page
    //page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
}

preparePage().catch((error) => console.error(error));
