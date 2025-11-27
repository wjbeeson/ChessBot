# Chess Bot Project Structure

## Overview
This project is organized into a modular structure for better maintainability and clarity.

## Directory Structure

```
ChessBot/
├── src/                      # Source code
│   ├── bot/                  # Bot-related logic
│   │   └── lichessBot.js     # Main bot logic for Lichess
│   ├── server/               # Server-related logic
│   │   └── stockfishServer.js # Express server for Stockfish API
│   ├── ui/                   # UI components
│   │   └── controlPanel.js   # Floating control panel UI
│   └── utils/                # Utility functions
│       ├── apiClient.js      # API client for Stockfish server
│       ├── arrowUtils.js     # Arrow drawing utilities
│       ├── chessUtils.js     # Chess game utilities
│       └── pageUtils.js      # Page interaction utilities
├── public/                   # Static files
│   └── config.html           # Configuration page
├── config.js                 # Bot configuration
├── main.js                   # Entry point
├── package.json              # Dependencies
└── PROJECT_STRUCTURE.md      # This file
```

## Module Descriptions

### Main Entry Point
- **main.js**: Starts both the Stockfish server and the Lichess bot as separate processes

### Bot (`src/bot/`)
- **lichessBot.js**: Main bot logic
  - WebSocket interception
  - Game state management
  - Move calculation coordination
  - Puppeteer initialization

### Server (`src/server/`)
- **stockfishServer.js**: Express server
  - Stockfish engine management
  - Move calculation endpoints
  - Configuration API
  - Static file serving

### UI (`src/ui/`)
- **controlPanel.js**: Floating control panel
  - Draggable window
  - Checkboxes for bot settings
  - Movetime slider
  - Evaluation bar
  - Config button

### Utilities (`src/utils/`)
- **apiClient.js**: Stockfish API communication
  - `calculateBestMove()` - Get best move
  - `calculateGaslightMove()` - Get suboptimal move

- **arrowUtils.js**: Chess board arrows
  - `injectArrowMarkerDef()` - SVG marker setup
  - `clearPreviousArrows()` - Clear arrows
  - `showArrow()` - Draw move arrow

- **chessUtils.js**: Chess game logic
  - `getBadOpeningMove()` - Bongcloud opening
  - `isValidMove()` - Move validation

- **pageUtils.js**: Page interaction
  - `sendWebSocketMessage()` - WebSocket communication
  - `getPlayerColor()` - Detect player color
  - `fetchPageVariable()` - Get window variables
  - `setMovetime()` - Update movetime slider
  - `updateScore()` - Update eval bar
  - `sendMove()` - Send move via WebSocket

### Public (`public/`)
- **config.html**: Configuration web page
  - Gaslighting settings
  - Smack mode settings
  - Time thresholds
  - Save/reset functionality

### Configuration
- **config.json**: Bot configuration file (hot-reloadable)
  - Engine path
  - Score thresholds
  - Time settings
  - Smack mode settings
  - **No restart required** - changes take effect immediately!

- **configLoader.js**: Configuration utility
  - `loadConfig()` - Loads fresh config from disk
  - `saveConfig()` - Saves config to disk

## Running the Bot

```bash
node main.js
```

This will start both:
1. Stockfish server on port 3001
2. Lichess bot with Puppeteer

## Configuration

Access the configuration page at: `http://localhost:3001/config`

## Key Features

- **Modular Design**: Separated concerns into logical modules
- **Easy Maintenance**: Each file has a specific purpose
- **Reusable Code**: Utilities can be used across different parts
- **Clear Structure**: Easy to navigate and understand
- **Documented**: JSDoc comments on all functions
