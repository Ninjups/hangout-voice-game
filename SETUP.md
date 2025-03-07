# Setup Guide for Hangout Voice Game

This document provides detailed instructions for setting up and running the Hangout Voice Game.

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Quick Start Options

### Option 1: Using the Simplified Batch File (Windows)
If you're on Windows, simply double-click the `start-simple.bat` file in the root directory. This will:
- Check if dependencies are installed
- Install them if needed
- Start the server
- Open a browser window to the game

### Option 2: Using the Simplified Shell Script (Unix/Linux/Mac)
Run the following commands in the terminal:
```
chmod +x start-simple.sh  # Make it executable (first time only)
./start-simple.sh
```

This will start the application using the simplified start script.

### Option 3: Using the Simplified Start Script
Run the following command in the terminal:
```
node start-simple.js
```

This script will:
- Check if dependencies are installed
- Install them if needed
- Start the server
- Automatically open your browser to the game

### Option 4: Using NPM Scripts
Run the following command in the terminal:
```
npm run simple-start
```

## Manual Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd hangout-voice-game
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Running the Application Manually

1. Start the development server (with auto-reload):
   ```
   npm run dev
   ```

   Or start the production server:
   ```
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Game Controls

- **Movement**: Use WASD keys or arrow keys to move your circle around the canvas
- **Interaction**: Click on another player's circle to open the interaction menu
- **Voice Chat**: Allow microphone access when prompted to enable voice chat

## Troubleshooting

### Voice Chat Issues

If you're having issues with the voice chat functionality:

1. Make sure your browser has permission to access your microphone
2. Check that you're using a modern browser with WebRTC support (Chrome, Firefox, Edge, Safari)
3. Try refreshing the page and allowing microphone access again

### Connection Issues

If you're having trouble connecting to the server:

1. Make sure the server is running
2. Check your network connection
3. Try using a different browser

### Startup Issues

If you're having trouble starting the application:

1. Try using the simplified version: `node start-simple.js`
2. Make sure Node.js is installed correctly
3. Try running `npm install` manually before starting the server

## Development Notes

- The game uses Socket.IO for real-time communication
- WebRTC is used for peer-to-peer voice chat
- HTML5 Canvas is used for rendering the game 