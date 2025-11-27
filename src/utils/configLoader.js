/**
 * Configuration Loader
 * Provides hot-reloadable configuration from JSON file
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('CONFIG');
const configPath = path.join(__dirname, '../../config.json');

/**
 * Loads configuration from config.json file.
 * Always reads fresh from disk to support hot-reloading.
 */
function loadConfig() {
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        logger.error('Error loading config.json:', error);
        throw error;
    }
}

/**
 * Saves configuration to config.json file.
 */
function saveConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        logger.info('Configuration saved successfully');
        return true;
    } catch (error) {
        logger.error('Error saving config.json:', error);
        return false;
    }
}

module.exports = {
    loadConfig,
    saveConfig
};
