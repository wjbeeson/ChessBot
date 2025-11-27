/**
 * Logger Utility
 * Centralized logging with timestamps and log levels
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const CURRENT_LOG_LEVEL = LOG_LEVELS.DEBUG;

/**
 * Formats a log message with timestamp and level
 */
function formatMessage(level, component, message) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    return `[${timestamp}] [${level}] [${component}] ${message}`;
}

/**
 * Logger class with different log levels
 */
class Logger {
    constructor(component) {
        this.component = component;
    }

    debug(message) {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
            console.log(formatMessage('DEBUG', this.component, message));
        }
    }

    info(message) {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
            console.log(formatMessage('INFO', this.component, message));
        }
    }

    warn(message) {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
            console.warn(formatMessage('WARN', this.component, message));
        }
    }

    error(message) {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
            console.error(formatMessage('ERROR', this.component, message));
        }
    }
}

/**
 * Creates a logger for a specific component
 */
function createLogger(component) {
    return new Logger(component);
}

module.exports = { createLogger };
