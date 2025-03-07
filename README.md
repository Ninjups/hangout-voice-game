# Hangout Voice Game

A web-based social game with proximity voice chat inspired by Agar.io. Players are represented as circles that can move around a 2D canvas, and they can talk to each other using proximity-based voice chat.

## Features

- Player representation as customizable circles
- Free movement around the canvas
- Real-time proximity voice chat
- Visual feedback for speaking players
- Player interaction (mute, add as friend)
- Bot players with custom images and sounds

## Tech Stack

- Frontend: HTML5 Canvas, JavaScript
- Backend: Node.js, Express
- Real-time Communication: Socket.IO, WebRTC

## Quick Start

### For Windows Users
Simply double-click the `start-simple.bat` file and the application will start automatically!

If you encounter any issues, try the simplified version:
```
node start-simple.js
```

### For Unix/Linux/Mac Users
Run the shell script:
```
chmod +x start.sh  # Make it executable (first time only)
./start.sh
```

### For All Users
Run the easy start script:
```
node start.js
```

Or use the simplified version:
```
node start-simple.js
```

These scripts will:
1. Check if dependencies are installed and install them if needed
2. Start the server
3. Automatically open your browser to the game

## Manual Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

   Or use the production server:
   ```
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000`

## How to Play

- Use WASD keys or arrow keys to move your circle
- Get closer to other players to hear them more clearly
- Customize your circle by uploading an image or selecting a color
- Click on another player to mute them or add them as a friend

## Bot Setup

The game includes a bot player with custom image and sound:

1. Place the bot image file in `public/assets/bots/GASOv75XUAAuLZq.jpg`
2. Place the bot sound file in `public/assets/bots/dracula-flow-4.mp3`

The bot will automatically appear in the game and move around randomly. When you get close to the bot, you'll hear its sound, which gets louder as you get closer. 