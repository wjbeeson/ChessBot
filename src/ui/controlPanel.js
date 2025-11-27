/**
 * Control Panel UI Component
 * Creates and manages the floating control panel interface
 */

/**
 * Creates the main control panel UI injected into the Lichess page.
 * Sets up floating window with checkboxes, sliders, and controls.
 * @param {Page} page - Puppeteer page instance
 */
async function injectControls(page) {
    // Expose function to get config values from Node.js context
    await page.exposeFunction('getConfigValue', async (key) => {
        const { loadConfig } = require('../utils/configLoader');
        const config = loadConfig();
        return config[key];
    });

    await page.evaluateOnNewDocument((KEYS) => {
        window.addEventListener('DOMContentLoaded', () => {

            // ============================================================
            // CONSTANTS (Browser Context)
            // ============================================================

            const UI_COLORS = {
                BACKGROUND: 'rgba(0, 0, 0, 0.9)',
                BORDER: '#444',
                BORDER_LIGHT: '#555',
                TEXT_PRIMARY: 'white',
                TEXT_SECONDARY: '#999',
                WINS: '#4CAF50',
                DRAWS: '#FFC107',
                LOSSES: '#F44336',
                BUTTON_BG: '#444',
                BUTTON_BG_HOVER: '#555',
                BUTTON_BORDER: '#666',
                SCORE_BG: '#333',
                SCORE_BORDER: '#555',
                EVAL_WHITE: '#ffffff',
                EVAL_NEUTRAL: '#808080',
                EVAL_BLACK: '#000000',
                EVAL_INDICATOR: '#ff0000'
            };

            const UI_SIZES = {
                BORDER_RADIUS: '8px',
                BORDER_RADIUS_SMALL: '6px',
                BORDER_RADIUS_LARGE: '12px',
                FONT_SIZE_LARGE: '24px',
                FONT_SIZE_NORMAL: '16px',
                FONT_SIZE_MEDIUM: '14px',
                FONT_SIZE_SMALL: '13px',
                FONT_SIZE_TINY: '12px',
                PADDING_LARGE: '20px',
                PADDING_MEDIUM: '15px',
                PADDING_SMALL: '10px',
                PADDING_TINY: '8px',
                COLLAPSE_BUTTON_SIZE: '24px',
                CHECKBOX_SCALE: 1.5,
                WINDOW_MIN_WIDTH: '300px',
                TOGGLE_BUTTON_SIZE: '50px'
            };

            // ============================================================
            // HELPER FUNCTIONS
            // ============================================================

            /**
             * Creates a checkbox + label pair with config.json as source of truth and tooltip.
             * Automatically syncs with config.json using the configKey parameter.
             */
            function createLabeledCheckbox({
                id, labelText, windowProp, onToggle, defaultValue = true, tooltip = '', configKey = null
            }) {
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.marginRight = UI_SIZES.PADDING_MEDIUM;
                container.style.position = 'relative';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = id;
                checkbox.style.transform = `scale(${UI_SIZES.CHECKBOX_SCALE})`;
                checkbox.style.marginBottom = UI_SIZES.PADDING_SMALL;
                checkbox.checked = defaultValue;

                // Load initial value from config file if configKey is provided
                if (configKey && typeof window.getConfigValue === 'function') {
                    window.getConfigValue(configKey).then(configValue => {
                        if (configValue !== undefined) {
                            checkbox.checked = configValue;
                            window[windowProp] = configValue;
                        } else {
                            // Config doesn't have this value, use default
                            checkbox.checked = defaultValue;
                            window[windowProp] = defaultValue;
                        }
                    });
                } else {
                    window[windowProp] = defaultValue;
                }

                const label = document.createElement('label');
                label.htmlFor = id;
                label.innerText = labelText;
                label.style.color = UI_COLORS.TEXT_PRIMARY;
                label.style.fontSize = UI_SIZES.FONT_SIZE_NORMAL;
                label.style.marginLeft = '5px';
                label.style.marginBottom = UI_SIZES.PADDING_SMALL;
                label.style.cursor = 'pointer';

                // Add tooltip
                if (tooltip) {
                    const tooltipDiv = document.createElement('div');
                    Object.assign(tooltipDiv.style, {
                        position: 'absolute',
                        background: 'rgba(0, 0, 0, 0.95)',
                        color: UI_COLORS.TEXT_PRIMARY,
                        padding: `${UI_SIZES.PADDING_TINY} 12px`,
                        borderRadius: UI_SIZES.BORDER_RADIUS_SMALL,
                        fontSize: UI_SIZES.FONT_SIZE_SMALL,
                        whiteSpace: 'nowrap',
                        zIndex: '10000',
                        pointerEvents: 'none',
                        left: '0',
                        bottom: '100%',
                        marginBottom: '5px',
                        display: 'none',
                        border: `1px solid ${UI_COLORS.BORDER_LIGHT}`,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)'
                    });
                    tooltipDiv.innerText = tooltip;

                    container.addEventListener('mouseenter', () => tooltipDiv.style.display = 'block');
                    container.addEventListener('mouseleave', () => tooltipDiv.style.display = 'none');
                    container.appendChild(tooltipDiv);
                }

                checkbox.addEventListener('change', async () => {
                    const newVal = checkbox.checked;
                    window[windowProp] = newVal;

                    // Sync with config.json if configKey is provided
                    if (configKey && typeof window.updateConfigValue === 'function') {
                        try {
                            await window.updateConfigValue(configKey, newVal);
                            if (typeof window.nodeLog === 'function') {
                                window.nodeLog('info', `Config updated: ${configKey} = ${newVal}`);
                            }
                        } catch (error) {
                            if (typeof window.nodeLog === 'function') {
                                window.nodeLog('error', `Failed to update config for ${configKey}:`, error);
                            }
                        }
                    }

                    // Call custom onToggle handler if provided
                    onToggle && onToggle(newVal);
                });

                container.appendChild(checkbox);
                container.appendChild(label);
                return container;
            }

            /**
             * Creates a collapsible section with header and content (state persisted to localStorage)
             */
            function createCollapsibleSection(title, defaultCollapsed = false) {
                const storageKey = `section_${title.replace(/\s+/g, '_')}_collapsed`;
                const isCollapsed = localStorage.getItem(storageKey) === 'true' || defaultCollapsed;

                const header = document.createElement('div');
                Object.assign(header.style, {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: UI_SIZES.PADDING_SMALL,
                    cursor: 'pointer'
                });

                const titleSpan = document.createElement('span');
                titleSpan.innerText = title;
                Object.assign(titleSpan.style, {
                    color: UI_COLORS.TEXT_PRIMARY,
                    fontSize: UI_SIZES.FONT_SIZE_NORMAL,
                    fontWeight: 'bold'
                });

                const collapseButton = document.createElement('button');
                collapseButton.innerText = isCollapsed ? '+' : '−';
                Object.assign(collapseButton.style, {
                    background: 'none',
                    border: 'none',
                    color: UI_COLORS.TEXT_PRIMARY,
                    fontSize: '20px',
                    cursor: 'pointer',
                    padding: '0',
                    width: UI_SIZES.COLLAPSE_BUTTON_SIZE,
                    height: UI_SIZES.COLLAPSE_BUTTON_SIZE
                });

                header.appendChild(titleSpan);
                header.appendChild(collapseButton);

                const contentWrapper = document.createElement('div');
                Object.assign(contentWrapper.style, {
                    display: isCollapsed ? 'none' : 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease'
                });

                header.addEventListener('click', () => {
                    const isHidden = contentWrapper.style.display === 'none';
                    contentWrapper.style.display = isHidden ? 'flex' : 'none';
                    collapseButton.innerText = isHidden ? '−' : '+';
                    localStorage.setItem(storageKey, !isHidden);
                });

                return { header, contentWrapper };
            }

            /**
             * Creates a styled button
             */
            function createButton(text, onClick) {
                const button = document.createElement('button');
                button.innerText = text;
                Object.assign(button.style, {
                    padding: `${UI_SIZES.PADDING_SMALL} ${UI_SIZES.PADDING_LARGE}`,
                    backgroundColor: UI_COLORS.BUTTON_BG,
                    color: UI_COLORS.TEXT_PRIMARY,
                    border: `1px solid ${UI_COLORS.BUTTON_BORDER}`,
                    borderRadius: UI_SIZES.BORDER_RADIUS_SMALL,
                    cursor: 'pointer',
                    fontSize: UI_SIZES.FONT_SIZE_MEDIUM,
                    fontWeight: 'bold',
                    width: '100%'
                });

                button.addEventListener('click', onClick);
                button.addEventListener('mouseenter', () => button.style.backgroundColor = UI_COLORS.BUTTON_BG_HOVER);
                button.addEventListener('mouseleave', () => button.style.backgroundColor = UI_COLORS.BUTTON_BG);

                return button;
            }

            /**
             * Injects CSS styles for sliders
             */
            function injectStyles() {
                const styleEl = document.createElement('style');
                styleEl.innerHTML = `
                input[type="range"] {
                  -webkit-appearance: none;
                  margin: 0;
                  width: 100%;
                  box-sizing: border-box;
                }

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
            }

            /**
             * Sets up drag functionality for the floating window (position persisted to localStorage)
             */
            function setupDragging(floatingWindow, header, closeButton) {
                let isDragging = false;
                let currentX, currentY, initialX, initialY;

                const dragStart = (e) => {
                    // Only allow dragging from header area, not the close button
                    if (e.target === header || e.target.parentElement === header) {
                        initialX = e.clientX - parseInt(floatingWindow.style.left);
                        initialY = e.clientY - parseInt(floatingWindow.style.top);
                        isDragging = true;
                        e.preventDefault();
                    }
                };

                const drag = (e) => {
                    if (isDragging) {
                        e.preventDefault();
                        currentX = e.clientX - initialX;
                        currentY = e.clientY - initialY;
                        floatingWindow.style.left = currentX + 'px';
                        floatingWindow.style.top = currentY + 'px';
                    }
                };

                const dragEnd = () => {
                    if (isDragging) {
                        isDragging = false;
                        // Save position to localStorage
                        const x = floatingWindow.style.left.replace('px', '');
                        const y = floatingWindow.style.top.replace('px', '');
                        localStorage.setItem('botControlsX', x);
                        localStorage.setItem('botControlsY', y);
                        if (typeof window.nodeLog === 'function') {
                            window.nodeLog('debug', `Window position saved: ${x}, ${y}`);
                        }
                    }
                };

                header.addEventListener('mousedown', dragStart);
                document.addEventListener('mousemove', drag);
                document.addEventListener('mouseup', dragEnd);
            }

            // ============================================================
            // MAIN WINDOW CREATION
            // ============================================================

            // Load saved position from localStorage
            const savedX = localStorage.getItem('botControlsX') || '10';
            const savedY = localStorage.getItem('botControlsY') || '10';

            const floatingWindow = document.createElement('div');
            floatingWindow.id = 'botControlsWindow';
            Object.assign(floatingWindow.style, {
                position: 'fixed',
                left: savedX + 'px',
                top: savedY + 'px',
                zIndex: '9999',
                backgroundColor: UI_COLORS.BACKGROUND,
                padding: '0',
                borderRadius: UI_SIZES.BORDER_RADIUS_LARGE,
                border: `2px solid ${UI_COLORS.BORDER}`,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                minWidth: UI_SIZES.WINDOW_MIN_WIDTH,
                display: 'block',
                cursor: 'move'
            });

            // ============================================================
            // HEADER
            // ============================================================
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '4px',
                cursor: 'move',
                userSelect: 'none'
            });

            const closeButton = document.createElement('button');
            closeButton.innerText = '✕';
            Object.assign(closeButton.style, {
                background: 'none',
                border: 'none',
                color: UI_COLORS.TEXT_PRIMARY,
                fontSize: '16px',
                cursor: 'pointer',
                padding: '0',
                width: '20px',
                height: '20px',
                lineHeight: '20px'
            });
            closeButton.addEventListener('click', () => {
                floatingWindow.style.display = 'none';
            });

            header.appendChild(closeButton);

            setupDragging(floatingWindow, header, closeButton);

            // ============================================================
            // CONTENT CONTAINER
            // ============================================================
            const content = document.createElement('div');
            Object.assign(content.style, {
                display: 'flex',
                flexDirection: 'column',
                padding: UI_SIZES.PADDING_MEDIUM,
                paddingTop: '0',
                cursor: 'default'
            });

            injectStyles();

            // ============================================================
            // EVAL BAR SECTION (COLLAPSIBLE)
            // ============================================================
            const evalBarSection = document.createElement('div');
            Object.assign(evalBarSection.style, {
                display: 'flex',
                flexDirection: 'column'
            });

            const { header: evalBarHeader, contentWrapper: evalBarContent } =
                createCollapsibleSection('Evaluation', false);

            evalBarContent.style.alignItems = 'center';
            evalBarContent.style.gap = UI_SIZES.PADDING_SMALL;
            evalBarContent.style.paddingBottom = UI_SIZES.PADDING_SMALL;

            const evalLabel = document.createElement('span');
            evalLabel.id = 'evalLabel';
            evalLabel.textContent = '0.0';
            Object.assign(evalLabel.style, {
                fontSize: UI_SIZES.FONT_SIZE_LARGE,
                fontWeight: 'bold',
                backgroundColor: UI_COLORS.SCORE_BG,
                color: UI_COLORS.TEXT_PRIMARY,
                padding: `${UI_SIZES.PADDING_TINY} 16px`,
                borderRadius: UI_SIZES.BORDER_RADIUS,
                border: `2px solid ${UI_COLORS.SCORE_BORDER}`,
                minWidth: '60px',
                textAlign: 'center'
            });

            const evalSlider = document.createElement('input');
            evalSlider.id = 'evalSlider';
            evalSlider.type = 'range';
            evalSlider.min = '-700';
            evalSlider.max = '700';
            evalSlider.value = '0';
            Object.assign(evalSlider.style, {
                width: '100%',
                height: '12px',
                borderRadius: '6px',
                outline: 'none',
                border: `1px solid ${UI_COLORS.BORDER_LIGHT}`
            });
            evalSlider.disabled = true;

            window.evalSlider = evalSlider;
            window.evalLabel = evalLabel;

            evalBarContent.appendChild(evalLabel);
            evalBarContent.appendChild(evalSlider);

            evalBarSection.appendChild(evalBarHeader);
            evalBarSection.appendChild(evalBarContent);
            content.appendChild(evalBarSection);

            // ============================================================
            // SCOREBOARD SECTION (COLLAPSIBLE)
            // ============================================================
            const scoreboardSection = document.createElement('div');
            Object.assign(scoreboardSection.style, {
                display: 'flex',
                flexDirection: 'column',
                paddingTop: UI_SIZES.PADDING_SMALL,
                borderTop: `1px solid ${UI_COLORS.BORDER_LIGHT}`
            });

            const { header: scoreboardHeader, contentWrapper: scoreboardContentWrapper } =
                createCollapsibleSection('Scoreboard', false);

            scoreboardContentWrapper.style.paddingBottom = UI_SIZES.PADDING_SMALL;

            const scoreboardContent = document.createElement('div');
            Object.assign(scoreboardContent.style, {
                display: 'flex',
                justifyContent: 'space-around',
                backgroundColor: '#222',
                padding: UI_SIZES.PADDING_MEDIUM,
                borderRadius: UI_SIZES.BORDER_RADIUS,
                border: `1px solid ${UI_COLORS.BORDER_LIGHT}`
            });

            // Load scoreboard from localStorage or initialize
            window.botWins = parseInt(localStorage.getItem('botWins') || '0');
            window.botDraws = parseInt(localStorage.getItem('botDraws') || '0');
            window.botLosses = parseInt(localStorage.getItem('botLosses') || '0');

            // Create score columns
            const createScoreColumn = (label, value, color, valueId) => {
                const div = document.createElement('div');
                Object.assign(div.style, {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                });

                const labelSpan = document.createElement('span');
                labelSpan.innerText = label;
                Object.assign(labelSpan.style, {
                    color: color,
                    fontSize: UI_SIZES.FONT_SIZE_MEDIUM,
                    marginBottom: '5px'
                });

                const valueSpan = document.createElement('span');
                valueSpan.id = valueId;
                valueSpan.innerText = value;
                Object.assign(valueSpan.style, {
                    color: UI_COLORS.TEXT_PRIMARY,
                    fontSize: UI_SIZES.FONT_SIZE_LARGE,
                    fontWeight: 'bold'
                });

                div.appendChild(labelSpan);
                div.appendChild(valueSpan);
                return div;
            };

            scoreboardContent.appendChild(createScoreColumn('Wins', window.botWins, UI_COLORS.WINS, 'botWinsValue'));
            scoreboardContent.appendChild(createScoreColumn('Draws', window.botDraws, UI_COLORS.DRAWS, 'botDrawsValue'));
            scoreboardContent.appendChild(createScoreColumn('Losses', window.botLosses, UI_COLORS.LOSSES, 'botLossesValue'));

            scoreboardContentWrapper.appendChild(scoreboardContent);

            scoreboardSection.appendChild(scoreboardHeader);
            scoreboardSection.appendChild(scoreboardContentWrapper);
            content.appendChild(scoreboardSection);

            // Make scoreboard accessible globally for updates (persisted to localStorage)
            window.updateScoreboard = (result) => {
                if (result === 'win') {
                    window.botWins++;
                    document.getElementById('botWinsValue').innerText = window.botWins;
                    localStorage.setItem('botWins', window.botWins);
                } else if (result === 'draw') {
                    window.botDraws++;
                    document.getElementById('botDrawsValue').innerText = window.botDraws;
                    localStorage.setItem('botDraws', window.botDraws);
                } else if (result === 'loss') {
                    window.botLosses++;
                    document.getElementById('botLossesValue').innerText = window.botLosses;
                    localStorage.setItem('botLosses', window.botLosses);
                }
                if (typeof window.nodeLog === 'function') {
                    window.nodeLog('info', `Scoreboard updated: ${result}`);
                }
            };

            // ============================================================
            // TOGGLES SECTION (COLLAPSIBLE)
            // ============================================================
            const togglesSection = document.createElement('div');
            Object.assign(togglesSection.style, {
                display: 'flex',
                flexDirection: 'column',
                paddingTop: UI_SIZES.PADDING_SMALL,
                borderTop: `1px solid ${UI_COLORS.BORDER_LIGHT}`
            });

            const { header: togglesHeader, contentWrapper: togglesContent } =
                createCollapsibleSection('Controls', false);

            togglesSection.appendChild(togglesHeader);
            togglesSection.appendChild(togglesContent);

            // ============================================================
            // CHECKBOXES
            // ============================================================
            const checkboxes = [
                {
                    id: 'automoveCheckbox',
                    labelText: 'Auto Move',
                    windowProp: 'automoveEnabled',
                    configKey: 'automoveEnabled',
                    onToggle: (val) => window.nodeLog?.('info', `Automoving is now ${val ? 'enabled' : 'disabled'}.`),
                    tooltip: 'Auto-play calculated moves.'
                },
                {
                    id: 'autoStartNewGameCheckbox',
                    labelText: 'Auto Queue',
                    windowProp: 'autoStartNewGameEnabled',
                    configKey: 'autoStartNewGame',
                    onToggle: (val) => window.nodeLog?.('info', `autoStartNewGameEnabled is now ${val ? 'enabled' : 'disabled'}.`),
                    tooltip: 'Start next game automatically after a configurable delay.'
                },
                {
                    id: 'autoSendRematchCheckbox',
                    labelText: 'Auto Rematch',
                    windowProp: 'autoSendRematchEnabled',
                    configKey: 'autoSendRematch',
                    onToggle: (val) => window.nodeLog?.('info', `autoSendRematchEnabled is now ${val ? 'enabled' : 'disabled'}.`),
                    tooltip: 'Automatically send rematch offer after game ends. Rematches take priority over auto queue.'
                },
                {
                    id: 'badOpeningCheckbox',
                    labelText: 'Bongcloud Opening',
                    windowProp: 'badOpeningEnabled',
                    configKey: 'badOpeningEnabled',
                    onToggle: (val) => window.nodeLog?.('info', `DoBadOpenings is now ${val ? 'enabled' : 'disabled'}.`),
                    tooltip: 'You already know what this does.'
                },
                {
                    id: 'adjustSpeedCheckbox',
                    labelText: 'Dynamic Speed',
                    windowProp: 'adjustSpeedEnabled',
                    configKey: 'adjustSpeedEnabled',
                    onToggle: (val) => {
                        window.nodeLog?.('info', `adjustSpeedEnabled is now ${val ? 'enabled' : 'disabled'}.`);
                        const movetimeSlider = document.getElementById('movetimeSlider');
                        const movetimeIndicator = document.getElementById('movetimeIndicator');
                        if (val) {
                            movetimeSlider.disabled = true;
                            movetimeSlider.style.opacity = '0.5';
                            movetimeSlider.style.cursor = 'not-allowed';
                            if (movetimeIndicator) movetimeIndicator.style.display = 'block';
                        } else {
                            movetimeSlider.disabled = false;
                            movetimeSlider.style.opacity = '1';
                            movetimeSlider.style.cursor = 'pointer';
                            if (movetimeIndicator) movetimeIndicator.style.display = 'none';
                        }
                    },
                    tooltip: 'Vary move speed based on time remaining'
                },
                {
                    id: 'criticalTimeCheckbox',
                    labelText: 'Emergency Mode',
                    windowProp: 'criticalTimeEnabled',
                    configKey: 'criticalTimeEnabled',
                    onToggle: (val) => window.nodeLog?.('info', `criticalTimeEnabled is now ${val ? 'enabled' : 'disabled'}.`),
                    tooltip: 'Ultra fast moves when low on time (overrides everything)'
                },
                {
                    id: 'gaslightingCheckbox',
                    labelText: 'Gaslight Mode',
                    windowProp: 'gaslightingEnabled',
                    configKey: 'gaslightingEnabled',
                    onToggle: (val) => window.nodeLog?.('info', `Gaslighting is now ${val ? 'enabled' : 'disabled'}.`),
                    tooltip: 'Play bad moves, let them think they\'re winning, then crush them'
                },
                {
                    id: 'pressThankYouCheckbox',
                    labelText: 'Press Thank You',
                    windowProp: 'pressThankYouEnabled',
                    configKey: 'pressThankYou',
                    onToggle: (val) => window.nodeLog?.('info', `pressThankYouEnabled is now ${val ? 'enabled' : 'disabled'}.`),
                    tooltip: 'Click "Thank You" after winning. Rub it in.'
                },
                {
                    id: 'showArrowsCheckbox',
                    labelText: 'Show Arrows',
                    windowProp: 'showArrowsEnabled',
                    configKey: 'showArrowsEnabled',
                    onToggle: (val) => window.nodeLog?.('info', `showArrowsEnabled is now ${val ? 'enabled' : 'disabled'}.`),
                    tooltip: 'Show engine move arrows on board'
                },
                {
                    id: 'spamMoretimeCheckbox',
                    labelText: 'Mate BM',
                    windowProp: 'spamMoretimeEnabled',
                    configKey: 'spamMoretimeEnabled',
                    onToggle: (val) => window.nodeLog?.('info', `spamMoretimeEnabled is now ${val ? 'enabled' : 'disabled'}.`),
                    tooltip: 'Let your opponent appreciate the moment before mating them.'
                }
            ];

            // Create and append checkboxes in alphabetical order
            checkboxes.forEach(config => {
                togglesContent.appendChild(createLabeledCheckbox(config));
            });

            // ============================================================
            // MOVETIME SLIDER
            // ============================================================
            const sliderContainer = document.createElement('div');
            Object.assign(sliderContainer.style, {
                display: 'flex',
                alignItems: 'center',
                marginTop: UI_SIZES.PADDING_SMALL
            });

            const sliderLabel = document.createElement('label');
            sliderLabel.htmlFor = 'movetimeSlider';
            sliderLabel.innerText = 'Movetime: ';
            Object.assign(sliderLabel.style, {
                color: UI_COLORS.TEXT_PRIMARY,
                marginRight: '5px'
            });

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = 'movetimeSlider';
            slider.min = '0';
            slider.max = '5';
            slider.step = '0.1';
            const savedValue = localStorage.getItem('movetimeSliderValue') || '1.5';
            slider.value = parseFloat(savedValue).toFixed(1);
            Object.assign(slider.style, {
                width: '100%',
                boxSizing: 'border-box'
            });

            const sliderValue = document.createElement('span');
            sliderValue.id = 'movetimeSliderText';
            sliderValue.innerText = slider.value + 's';
            Object.assign(sliderValue.style, {
                color: UI_COLORS.TEXT_PRIMARY,
                marginLeft: '5px'
            });

            window.movetime = Math.round(parseFloat(slider.value) * 1000) + 1;
            slider.addEventListener('input', () => {
                window.movetime = Math.round(parseFloat(slider.value) * 1000) + 1;
                sliderValue.innerText = slider.value + 's';
                localStorage.setItem('movetimeSliderValue', slider.value);
                if (typeof window.nodeLog === 'function') {
                    window.nodeLog('info', `Movetime is now set to ${window.movetime}ms.`);
                }
            });

            sliderContainer.appendChild(sliderLabel);
            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(sliderValue);
            togglesContent.appendChild(sliderContainer);

            // Add indicator for dynamic speed control
            const movetimeIndicator = document.createElement('div');
            movetimeIndicator.id = 'movetimeIndicator';
            movetimeIndicator.innerText = '(Controlled by Dynamic Speed setting)';
            Object.assign(movetimeIndicator.style, {
                color: UI_COLORS.TEXT_SECONDARY,
                fontSize: UI_SIZES.FONT_SIZE_TINY,
                marginTop: '5px',
                marginLeft: '5px',
                display: 'none'
            });
            togglesContent.appendChild(movetimeIndicator);

            // ============================================================
            // CONFIG BUTTON (in toggles section)
            // ============================================================
            const configButton = createButton('⚙ Advanced Config', () => {
                window.open('http://localhost:3001/config', '_blank');
            });
            configButton.style.marginTop = UI_SIZES.PADDING_LARGE;
            togglesContent.appendChild(configButton);

            // Set initial state based on adjustSpeed config value
            if (typeof window.getConfigValue === 'function') {
                window.getConfigValue('adjustSpeedEnabled').then(adjustSpeedEnabled => {
                    if (adjustSpeedEnabled === true) {
                        slider.disabled = true;
                        slider.style.opacity = '0.5';
                        slider.style.cursor = 'not-allowed';
                        movetimeIndicator.style.display = 'block';
                    }
                });
            }

            content.appendChild(togglesSection);

            // ============================================================
            // ASSEMBLE & APPEND
            // ============================================================

            floatingWindow.appendChild(header);
            floatingWindow.appendChild(content);

            // Create floating toggle button (gear icon, only visible when window is hidden)
            const toggleButton = document.createElement('button');
            toggleButton.innerText = '⚙';
            Object.assign(toggleButton.style, {
                position: 'fixed',
                top: '10px',
                left: '10px',
                zIndex: '9997',
                width: UI_SIZES.TOGGLE_BUTTON_SIZE,
                height: UI_SIZES.TOGGLE_BUTTON_SIZE,
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: UI_COLORS.TEXT_PRIMARY,
                border: `2px solid ${UI_COLORS.BORDER}`,
                fontSize: '24px',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                display: 'none'
            });
            toggleButton.addEventListener('click', () => {
                floatingWindow.style.display = 'block';
                toggleButton.style.display = 'none';
            });

            closeButton.addEventListener('click', () => {
                toggleButton.style.display = 'block';
            });

            document.body.appendChild(floatingWindow);
            document.body.appendChild(toggleButton);

            if (typeof window.nodeLog === 'function') {
                window.nodeLog('info', 'Control panel initialized');
            }
        });
    });
}

module.exports = { injectControls };
