const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Game state
const players = {};
const worldSize = { width: 10000, height: 10000 };
let botMovementInterval;
let whiteboardData = []; // Store whiteboard drawing data

// Create a bot with a random ID
const botId = `bot-${uuidv4()}`;
players[botId] = {
  id: botId,
  socketId: null,
  x: Math.random() * (worldSize.width - 60) + 30,
  y: Math.random() * (worldSize.height - 60) + 30,
  velocityX: 0, // Initialize velocity
  velocityY: 0, // Initialize velocity
  color: '#FF0000', // Red color for the bot
  name: 'Dracula Bot',
  isSpeaking: true, // Always start speaking
  isBot: true,
  customImage: '/assets/bots/GASOv75XUAAuLZq.jpg', // Path to the bot image
  botSoundFile: '/assets/bots/DraculaFlowa.mp3', // Path to the bot sound file
  lastSpeakingChange: Date.now(), // Track when the bot last changed speaking state
  speakingDuration: 0, // Track how long the bot has been in the current speaking state
  forceSpeakingChange: false, // Flag to force a speaking state change
  audioStartTime: Date.now() // Timestamp when audio started playing
};

// Move bot randomly
function moveBotRandomly(botId) {
  if (!players[botId]) return;
  
  // Random movement with acceleration
  const moveX = Math.random() > 0.5 ? 1 : -1;
  const moveY = Math.random() > 0.5 ? 1 : -1;
  
  // Apply acceleration with some randomness
  players[botId].velocityX += moveX * 0.2 * Math.random();
  players[botId].velocityY += moveY * 0.2 * Math.random();
  
  // Apply velocity cap
  const MAX_BOT_VELOCITY = 4;
  players[botId].velocityX = Math.max(-MAX_BOT_VELOCITY, Math.min(MAX_BOT_VELOCITY, players[botId].velocityX));
  players[botId].velocityY = Math.max(-MAX_BOT_VELOCITY, Math.min(MAX_BOT_VELOCITY, players[botId].velocityY));
  
  // Apply velocity to position
  players[botId].x += players[botId].velocityX;
  players[botId].y += players[botId].velocityY;
  
  // Apply friction
  const BOT_FRICTION = 0.95;
  players[botId].velocityX *= BOT_FRICTION;
  players[botId].velocityY *= BOT_FRICTION;
  
  // Keep bot within world bounds
  const prevX = players[botId].x;
  const prevY = players[botId].y;
  
  players[botId].x = Math.max(30, Math.min(worldSize.width - 30, players[botId].x));
  players[botId].y = Math.max(30, Math.min(worldSize.height - 30, players[botId].y));
  
  // If bot hit a boundary, reverse velocity in that direction
  if (players[botId].x !== prevX) players[botId].velocityX *= -0.5;
  if (players[botId].y !== prevY) players[botId].velocityY *= -0.5;
  
  // Get current time
  const currentTime = Date.now();
  
  // Update speaking duration
  players[botId].speakingDuration = currentTime - players[botId].lastSpeakingChange;
  
  // Ensure the bot is always speaking
  if (!players[botId].isSpeaking) {
    players[botId].isSpeaking = true;
    players[botId].lastSpeakingChange = currentTime;
    players[botId].audioStartTime = currentTime;
    
    // Broadcast bot speaking status with timestamp
    io.emit('playerSpeaking', {
      id: botId,
      isSpeaking: true,
      timestamp: players[botId].audioStartTime
    });
    
    console.log(`Bot ${botId} was silent, forcing to speak`);
  }
  
  // Occasionally restart the audio to prevent any sync issues (every 37.5 minutes)
  if (players[botId].isSpeaking && players[botId].speakingDuration > 2250000) {
    // Just update the timestamp and notify clients to restart audio
    players[botId].lastSpeakingChange = currentTime;
    players[botId].audioStartTime = currentTime;
    
    // Broadcast bot speaking status with new timestamp
    io.emit('playerSpeaking', {
      id: botId,
      isSpeaking: true,
      timestamp: players[botId].audioStartTime
    });
    
    console.log(`Bot ${botId} audio restarted after ${Math.floor(players[botId].speakingDuration/1000)} seconds`);
  }
  
  // Broadcast bot movement to all players
  io.emit('playerMoved', {
    id: botId,
    x: players[botId].x,
    y: players[botId].y,
    velocityX: players[botId].velocityX,
    velocityY: players[botId].velocityY
  });
}

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  // Generate a random position within the world bounds
  const x = Math.floor(Math.random() * worldSize.width);
  const y = Math.floor(Math.random() * worldSize.height);
  
  // Create a new player
  const playerId = uuidv4();
  players[playerId] = {
    id: playerId,
    socketId: socket.id,
    x,
    y,
    velocityX: 0, // Initialize velocity
    velocityY: 0, // Initialize velocity
    color: '#' + Math.floor(Math.random() * 16777215).toString(16), // Random color
    name: `Player ${Object.keys(players).length + 1}`,
    isSpeaking: false,
    customImage: null
  };
  
  // Send the player their ID and initial state
  socket.emit('init', {
    id: playerId,
    players,
    worldSize
  });
  
  // Send current whiteboard state
  socket.emit('whiteboard-init', whiteboardData);
  
  // Broadcast new player to all other players
  socket.broadcast.emit('playerJoined', players[playerId]);
  
  // Handle player movement
  socket.on('move', (data) => {
    if (players[data.id]) {
      players[data.id].x = data.x;
      players[data.id].y = data.y;
      
      // Update velocity information
      if (data.velocityX !== undefined) players[data.id].velocityX = data.velocityX;
      if (data.velocityY !== undefined) players[data.id].velocityY = data.velocityY;
      
      // Broadcast player movement to all other players
      socket.broadcast.emit('playerMoved', {
        id: data.id,
        x: data.x,
        y: data.y,
        velocityX: players[data.id].velocityX,
        velocityY: players[data.id].velocityY
      });
    }
  });
  
  // Handle player speaking status
  socket.on('speaking', (data) => {
    if (players[data.id]) {
      players[data.id].isSpeaking = data.isSpeaking;
      
      // Broadcast speaking status to all other players
      socket.broadcast.emit('playerSpeaking', {
        id: data.id,
        isSpeaking: data.isSpeaking
      });
    }
  });
  
  // Handle player customization
  socket.on('customize', (data) => {
    console.log(`Received customization for player ${data.id}:`, {
      name: data.name,
      color: data.color,
      hasImage: !!data.customImage
    });
    
    if (players[data.id]) {
      // Update player properties
      if (data.name) players[data.id].name = data.name;
      if (data.color) players[data.id].color = data.color;
      if (data.customImage !== undefined) players[data.id].customImage = data.customImage;
      
      console.log(`Player ${data.id} customized:`, {
        name: players[data.id].name,
        color: players[data.id].color,
        hasImage: !!players[data.id].customImage
      });
      
      // Broadcast customization to all other players
      socket.broadcast.emit('playerCustomized', {
        id: data.id,
        name: players[data.id].name,
        color: players[data.id].color,
        customImage: players[data.id].customImage
      });
      
      // Also send back to the player to confirm changes
      socket.emit('playerCustomized', {
        id: data.id,
        name: players[data.id].name,
        color: players[data.id].color,
        customImage: players[data.id].customImage
      });
    } else {
      console.log(`Player ${data.id} not found for customization`);
    }
  });
  
  // Handle WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    // Find the socket ID of the target player
    const targetPlayer = Object.values(players).find(player => player.id === data.to);
    
    if (targetPlayer) {
      // Forward the offer to the target player
      io.to(targetPlayer.socketId).emit('webrtc-offer', {
        offer: data.offer,
        from: findPlayerIdBySocketId(socket.id)
      });
    }
  });
  
  socket.on('webrtc-answer', (data) => {
    // Find the socket ID of the target player
    const targetPlayer = Object.values(players).find(player => player.id === data.to);
    
    if (targetPlayer) {
      // Forward the answer to the target player
      io.to(targetPlayer.socketId).emit('webrtc-answer', {
        answer: data.answer,
        from: findPlayerIdBySocketId(socket.id)
      });
    }
  });
  
  // Handle WebRTC ICE candidate
  socket.on('webrtc-ice-candidate', (data) => {
    // Find the socket ID of the target player
    const targetPlayer = Object.values(players).find(player => player.id === data.to);
    
    if (targetPlayer) {
      // Forward the ICE candidate to the target player
      io.to(targetPlayer.socketId).emit('webrtc-ice-candidate', {
        candidate: data.candidate,
        from: findPlayerIdBySocketId(socket.id)
      });
    }
  });
  
  // Handle whiteboard drawing
  socket.on('whiteboard-draw', (data) => {
    // Store drawing data
    whiteboardData.push(data);
    
    // Limit whiteboard data size to prevent memory issues
    if (whiteboardData.length > 10000) {
      whiteboardData = whiteboardData.slice(whiteboardData.length - 10000);
    }
    
    // Broadcast to all other players
    socket.broadcast.emit('whiteboard-draw', data);
  });
  
  // Handle whiteboard clear
  socket.on('whiteboard-clear', () => {
    whiteboardData = [];
    socket.broadcast.emit('whiteboard-clear');
  });
  
  // Handle player emotes
  socket.on('player-emote', (data) => {
    // Broadcast emote to all other players
    socket.broadcast.emit('player-emote', {
      id: data.id,
      emote: data.emote,
      symbol: data.symbol
    });
  });
  
  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // Find the player with this socket ID
    const playerId = findPlayerIdBySocketId(socket.id);
    
    if (playerId) {
      // Remove the player from the game state
      delete players[playerId];
      
      // Broadcast player disconnection to all other players
      socket.broadcast.emit('playerLeft', { id: playerId });
    }
  });
});

// Helper function to find player ID by socket ID
function findPlayerIdBySocketId(socketId) {
  for (const id in players) {
    if (players[id].socketId === socketId) {
      return id;
    }
  }
  return null;
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start bot movement
  botMovementInterval = setInterval(() => {
    moveBotRandomly(botId);
  }, 1000); // Move bot every second
});

// Clean up on server shutdown
process.on('SIGINT', () => {
  clearInterval(botMovementInterval);
  process.exit();
}); 