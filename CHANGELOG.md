# Changelog

## Recent Updates

### Configuration System Overhaul
- **Converted config.js to config.json**
  - ✅ Hot-reloading: Changes take effect immediately without restart
  - ✅ Cleaner format: JSON instead of JavaScript module
  - ✅ Automatic reload on every move/API call

### Project Restructuring
- **Organized codebase into modular structure**
  - Created `src/` directory with clear separation:
    - `bot/` - Bot logic
    - `server/` - API server
    - `ui/` - UI components
    - `utils/` - Utility functions
  - Moved static HTML to `public/` directory
  - Added comprehensive JSDoc documentation
  - Clear section markers throughout code

### New Features
- **Config Loader Utility** (`src/utils/configLoader.js`)
  - `loadConfig()` - Always reads fresh from disk
  - `saveConfig()` - Writes to JSON file
  - Used by both bot and server for real-time updates

### Deleted Files
- ❌ `chess-bot.js` (replaced by `src/bot/lichessBot.js`)
- ❌ `server.js` (replaced by `src/server/stockfishServer.js`)
- ❌ `config.js` (replaced by `config.json`)

### Improvements
1. **Better Maintainability**
   - Each file has single responsibility
   - Clear imports and dependencies
   - Organized folder structure

2. **Hot-Reloadable Config**
   - Update settings from web UI
   - No bot restart needed
   - Changes apply to next move

3. **Documentation**
   - PROJECT_STRUCTURE.md explains organization
   - JSDoc comments on all functions
   - Clear section markers in code

## How to Use

### Starting the Bot
```bash
node main.js
```

### Updating Configuration
1. Go to `http://localhost:3001/config`
2. Change any settings
3. Click "Save Configuration"
4. Changes are now active - no restart needed!

### File Structure
```
ChessBot/
├── src/
│   ├── bot/           # Bot logic
│   ├── server/        # API server
│   ├── ui/            # UI components
│   └── utils/         # Utilities
├── public/            # Static files
├── config.json        # Configuration (hot-reloadable)
└── main.js           # Entry point
```
