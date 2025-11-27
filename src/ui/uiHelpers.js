/**
 * UI Helper Functions
 * Reusable functions for creating UI elements
 */

const { UI_COLORS, UI_SIZES, STORAGE_KEYS } = require('../utils/constants');

/**
 * Creates a checkbox with label, tooltip, and localStorage persistence
 * @param {Object} options - Configuration options
 * @param {string} options.id - Element ID
 * @param {string} options.labelText - Label text
 * @param {string} options.storageKey - LocalStorage key
 * @param {string} options.windowProp - Window property name
 * @param {Function} options.onToggle - Callback when toggled
 * @param {boolean} options.defaultValue - Default checked state
 * @param {string} options.tooltip - Tooltip text
 * @returns {HTMLElement} Container element
 */
function createLabeledCheckbox({
    id,
    labelText,
    storageKey,
    windowProp,
    onToggle,
    defaultValue = true,
    tooltip = ''
}) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.marginRight = UI_SIZES.PADDING_MEDIUM;
    container.style.position = 'relative';

    const storedValue = localStorage.getItem(storageKey);
    const isChecked = storedValue === null ? defaultValue : (storedValue !== 'false');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.style.transform = `scale(${UI_SIZES.CHECKBOX_SCALE})`;
    checkbox.style.marginBottom = UI_SIZES.PADDING_SMALL;
    checkbox.checked = isChecked;

    window[windowProp] = isChecked;

    const label = document.createElement('label');
    label.htmlFor = id;
    label.innerText = labelText;
    label.style.color = UI_COLORS.TEXT_PRIMARY;
    label.style.fontSize = UI_SIZES.FONT_SIZE_NORMAL;
    label.style.marginLeft = UI_SIZES.SMALL_MARGIN;
    label.style.marginBottom = UI_SIZES.PADDING_SMALL;
    label.style.cursor = 'pointer';

    // Add tooltip
    if (tooltip) {
        const tooltipDiv = createTooltip(tooltip);
        container.appendChild(tooltipDiv);

        container.addEventListener('mouseenter', () => {
            tooltipDiv.style.display = 'block';
        });

        container.addEventListener('mouseleave', () => {
            tooltipDiv.style.display = 'none';
        });
    }

    checkbox.addEventListener('change', () => {
        const newVal = checkbox.checked;
        window[windowProp] = newVal;
        localStorage.setItem(storageKey, newVal);
        onToggle && onToggle(newVal);
    });

    container.appendChild(checkbox);
    container.appendChild(label);

    return container;
}

/**
 * Creates a tooltip element
 * @param {string} text - Tooltip text
 * @returns {HTMLElement} Tooltip div
 */
function createTooltip(text) {
    const tooltipDiv = document.createElement('div');
    tooltipDiv.style.position = 'absolute';
    tooltipDiv.style.background = 'rgba(0, 0, 0, 0.95)';
    tooltipDiv.style.color = UI_COLORS.TEXT_PRIMARY;
    tooltipDiv.style.padding = `${UI_SIZES.PADDING_TINY} 12px`;
    tooltipDiv.style.borderRadius = UI_SIZES.BORDER_RADIUS_SMALL;
    tooltipDiv.style.fontSize = UI_SIZES.FONT_SIZE_SMALL;
    tooltipDiv.style.whiteSpace = 'nowrap';
    tooltipDiv.style.zIndex = '10000';
    tooltipDiv.style.pointerEvents = 'none';
    tooltipDiv.style.left = '0';
    tooltipDiv.style.bottom = '100%';
    tooltipDiv.style.marginBottom = UI_SIZES.SMALL_MARGIN;
    tooltipDiv.style.display = 'none';
    tooltipDiv.style.border = `1px solid ${UI_COLORS.BORDER_LIGHT}`;
    tooltipDiv.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)';
    tooltipDiv.innerText = text;
    return tooltipDiv;
}

/**
 * Creates a collapsible section header
 * @param {string} title - Section title
 * @param {string} storageKey - LocalStorage key for collapse state
 * @returns {Object} Header element, content wrapper, and collapse button
 */
function createCollapsibleSection(title, storageKey) {
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = UI_SIZES.PADDING_SMALL;
    header.style.cursor = 'pointer';

    const titleSpan = document.createElement('span');
    titleSpan.innerText = title;
    titleSpan.style.color = UI_COLORS.TEXT_PRIMARY;
    titleSpan.style.fontSize = UI_SIZES.FONT_SIZE_NORMAL;
    titleSpan.style.fontWeight = 'bold';

    const collapseButton = document.createElement('button');
    collapseButton.innerText = '−';
    collapseButton.style.background = 'none';
    collapseButton.style.border = 'none';
    collapseButton.style.color = UI_COLORS.TEXT_PRIMARY;
    collapseButton.style.fontSize = '20px';
    collapseButton.style.cursor = 'pointer';
    collapseButton.style.padding = '0';
    collapseButton.style.width = UI_SIZES.COLLAPSE_BUTTON_SIZE;
    collapseButton.style.height = UI_SIZES.COLLAPSE_BUTTON_SIZE;

    header.appendChild(titleSpan);
    header.appendChild(collapseButton);

    const contentWrapper = document.createElement('div');
    contentWrapper.style.display = 'flex';
    contentWrapper.style.flexDirection = 'column';
    contentWrapper.style.transition = 'all 0.3s ease';

    const collapsed = localStorage.getItem(storageKey) === 'true';
    if (collapsed) {
        contentWrapper.style.display = 'none';
        collapseButton.innerText = '+';
    }

    header.addEventListener('click', () => {
        const isHidden = contentWrapper.style.display === 'none';
        contentWrapper.style.display = isHidden ? 'flex' : 'none';
        collapseButton.innerText = isHidden ? '−' : '+';
        localStorage.setItem(storageKey, !isHidden);
    });

    return { header, contentWrapper, collapseButton };
}

/**
 * Creates a styled button
 * @param {string} text - Button text
 * @param {Function} onClick - Click handler
 * @param {Object} styles - Additional styles
 * @returns {HTMLElement} Button element
 */
function createButton(text, onClick, styles = {}) {
    const button = document.createElement('button');
    button.innerText = text;
    button.style.padding = `${UI_SIZES.PADDING_SMALL} ${UI_SIZES.PADDING_LARGE}`;
    button.style.backgroundColor = UI_COLORS.BUTTON_BG;
    button.style.color = UI_COLORS.TEXT_PRIMARY;
    button.style.border = `1px solid ${UI_COLORS.BUTTON_BORDER}`;
    button.style.borderRadius = UI_SIZES.BORDER_RADIUS_SMALL;
    button.style.cursor = 'pointer';
    button.style.fontSize = UI_SIZES.FONT_SIZE_MEDIUM;
    button.style.fontWeight = 'bold';
    button.style.width = '100%';

    // Apply additional styles
    Object.assign(button.style, styles);

    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = UI_COLORS.BUTTON_BG_HOVER;
    });
    button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = UI_COLORS.BUTTON_BG;
    });

    return button;
}

/**
 * Creates the CSS styles for sliders
 * @returns {HTMLStyleElement} Style element
 */
function injectSliderStyles() {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
    /* Remove default appearance */
    input[type="range"] {
      -webkit-appearance: none;
      margin: 0;
      width: 100%;
      box-sizing: border-box;
    }

    /* Movetime slider styles */
    #movetimeSlider::-webkit-slider-runnable-track {
      height: 4px;
      background: #ccc;
      border-radius: 2px;
    }
    #movetimeSlider::-webkit-slider-thumb {
      -webkit-appearance: none;
      height: 16px;
      width: 16px;
      margin-top: -6px;
      background: #fff;
      border: 1px solid #999;
      border-radius: 50%;
      cursor: pointer;
    }

    /* Eval slider styles */
    #evalSlider::-webkit-slider-runnable-track {
      height: 12px;
      background: linear-gradient(to right, ${UI_COLORS.EVAL_WHITE} 0%, ${UI_COLORS.EVAL_NEUTRAL} 50%, ${UI_COLORS.EVAL_BLACK} 100%);
      border-radius: 6px;
      border: none;
    }
    #evalSlider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 4px;
      height: 12px;
      border-radius: 2px;
      background: ${UI_COLORS.EVAL_INDICATOR};
      cursor: default;
      box-shadow: none;
      border: none;
    }
    #evalSlider::-moz-range-track {
      height: 12px;
      background: linear-gradient(to right, ${UI_COLORS.EVAL_WHITE} 0%, ${UI_COLORS.EVAL_NEUTRAL} 50%, ${UI_COLORS.EVAL_BLACK} 100%);
      border-radius: 6px;
      border: none;
    }
    #evalSlider::-moz-range-thumb {
      width: 4px;
      height: 12px;
      border-radius: 2px;
      background: ${UI_COLORS.EVAL_INDICATOR};
      cursor: default;
      border: none;
    }
    #evalSlider:focus::-webkit-slider-thumb {
      box-shadow: none;
      outline: none;
    }
    `;
    document.head.appendChild(styleEl);
    return styleEl;
}

module.exports = {
    createLabeledCheckbox,
    createTooltip,
    createCollapsibleSection,
    createButton,
    injectSliderStyles
};
