/**
 * Arrow Drawing Utilities
 * Functions for drawing move arrows on the chess board
 */

const { createLogger } = require('./logger');
const logger = createLogger('ARROW');

/**
 * Injects SVG arrow marker definition for drawing move arrows on the board.
 */
async function injectArrowMarkerDef(page) {
    await page.evaluate(() => {
        let marker = document.querySelector('marker');
        if (marker) {
            return;
        }
        let defs = document.querySelector('defs');
        defs.insertAdjacentHTML('beforeend', `<marker id="arrowhead-g" orient="auto" overflow="visible"
            markerWidth="4" markerHeight="4" refX="2.05" refY="2" cgKey="g">
            <path d="M0,0 V4 L3,2 Z" fill="#15781B"></path>
            </marker>`);
    })
    logger.info('Marker arrowhead-g injected into <defs>.');
}

/**
 * Clears all previously drawn arrows from the board.
 */
async function clearPreviousArrows(page) {
    await page.evaluate(() => {
        let arrowContainer = document.querySelector('g');
        arrowContainer.innerHTML = '';
    })
}

/**
 * Draws an arrow on the chess board showing the best move.
 */
async function showArrow(page, bestMove, playerColorIsWhite) {
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

module.exports = {
    injectArrowMarkerDef,
    clearPreviousArrows,
    showArrow
};
