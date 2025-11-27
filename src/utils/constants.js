/**
 * Application Constants
 * Centralized constants for the chess bot application
 */

// ============================================================================
// GAME CONSTANTS
// ============================================================================

const GAME_STATUS = {
    MATE: 'mate',
    OUTOFTIME: 'outoftime',
    RESIGN: 'resign',
    ABORT: 'aborted',  // Note: Lichess sends "aborted" not "abort"
    DRAW: 'draw'
};

const COLORS = {
    WHITE: 'white',
    BLACK: 'black'
};

const WEBSOCKET_MESSAGE_TYPES = {
    MOVE: 'move',
    END_DATA: 'endData',
    CROWD: 'crowd'
};

// ============================================================================
// SCORE CONSTANTS
// ============================================================================

const SCORE_UNIT = {
    CENTIPAWN: 'cp',
    MATE: 'mate'
};

const EVAL_SLIDER = {
    MIN: -700,
    MAX: 700,
    MATE_VALUE: 700
};

// ============================================================================
// UI CONSTANTS
// ============================================================================

const UI_COLORS = {
    BACKGROUND: 'rgba(0, 0, 0, 0.9)',
    BORDER: '#444',
    BORDER_LIGHT: '#555',
    SEPARATOR: '#555',
    TEXT_PRIMARY: 'white',
    TEXT_SECONDARY: '#90a4ae',
    TEXT_MUTED: '#999',

    // Scoreboard colors
    WINS: '#4CAF50',
    DRAWS: '#FFC107',
    LOSSES: '#F44336',

    // Button colors
    BUTTON_BG: '#444',
    BUTTON_BG_HOVER: '#555',
    BUTTON_BORDER: '#666',

    // Eval bar gradient
    EVAL_WHITE: '#ffffff',
    EVAL_NEUTRAL: '#808080',
    EVAL_BLACK: '#000000',
    EVAL_INDICATOR: '#ff0000',

    // Score display
    SCORE_BG: '#333',
    SCORE_BORDER: '#555'
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

const UI_SPACING = {
    SECTION_PADDING: '15px',
    ELEMENT_MARGIN: '10px',
    SMALL_MARGIN: '5px'
};

const UI_TRANSITIONS = {
    STANDARD: 'all 0.3s ease'
};

// ============================================================================
// TIMEOUTS
// ============================================================================

const TIMEOUTS = {
    THANK_YOU_BUTTON: 2000
};

// ============================================================================
// GAME RESULT TYPES
// ============================================================================

const GAME_RESULT = {
    WIN: 'win',
    DRAW: 'draw',
    LOSS: 'loss'
};

// ============================================================================
// WIN/LOSS COUNTING RULES
// ============================================================================

const COUNTED_WIN_STATUSES = [GAME_STATUS.MATE, GAME_STATUS.OUTOFTIME, GAME_STATUS.RESIGN];
const COUNTED_LOSS_STATUSES = [GAME_STATUS.MATE, GAME_STATUS.OUTOFTIME];

module.exports = {
    GAME_STATUS,
    COLORS,
    WEBSOCKET_MESSAGE_TYPES,
    SCORE_UNIT,
    EVAL_SLIDER,
    UI_COLORS,
    UI_SIZES,
    UI_SPACING,
    UI_TRANSITIONS,
    TIMEOUTS,
    GAME_RESULT,
    COUNTED_WIN_STATUSES,
    COUNTED_LOSS_STATUSES
};
