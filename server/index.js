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

// Create two fighting bots that stay close to each other
// Define the ideal distance between fighting bots
const FIGHTING_BOTS_DISTANCE = 40;

// First fighting bot (with sound)
const fightingBot1Id = `bot-${uuidv4()}`;
// Position away from edges to ensure room for movement
const fightingBot1X = Math.random() * (worldSize.width - 300) + 150;
const fightingBot1Y = Math.random() * (worldSize.height - 300) + 150;

players[fightingBot1Id] = {
  id: fightingBot1Id,
  socketId: null,
  x: fightingBot1X,
  y: fightingBot1Y,
  velocityX: 0,
  velocityY: 0,
  color: '#00AAFF', // Blue color
  name: 'Fighting Bot 1',
  isSpeaking: true,
  isBot: true,
  customImage: '/assets/bots/fightingbots.jpg',
  botSoundFile: '/assets/bots/TwoFightingFunny.mp3',
  lastSpeakingChange: Date.now(),
  speakingDuration: 0,
  forceSpeakingChange: false,
  audioStartTime: Date.now(),
  pairedBotId: null // Will be set after creating the second bot
};

// Second fighting bot (without sound, just visual speaking)
const fightingBot2Id = `bot-${uuidv4()}`;
players[fightingBot2Id] = {
  id: fightingBot2Id,
  socketId: null,
  x: fightingBot1X + FIGHTING_BOTS_DISTANCE, // Position exactly at the ideal distance
  y: fightingBot1Y,
  velocityX: 0,
  velocityY: 0,
  color: '#FF00AA', // Pink color
  name: 'Fighting Bot 2',
  isSpeaking: true,
  isBot: true,
  customImage: '/assets/bots/fightingbots.jpg',
  botSoundFile: null, // No sound file, will just appear to be speaking
  lastSpeakingChange: Date.now(),
  speakingDuration: 0,
  forceSpeakingChange: false,
  audioStartTime: Date.now(),
  pairedBotId: fightingBot1Id // Reference to the first bot
};

// Set the paired bot reference for the first bot
players[fightingBot1Id].pairedBotId = fightingBot2Id;

// Move bot randomly
function moveBotRandomly(botId) {
  if (!players[botId]) return;
  
  // Check if this is one of the paired fighting bots
  if (players[botId].pairedBotId) {
    // This is a paired bot, handle special movement
    movePairedBot(botId);
    return;
  }
  
  // Regular bot movement logic
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

// Move paired bots (fighting bots that stay close to each other)
function movePairedBot(botId) {
  if (!players[botId] || !players[botId].pairedBotId) return;
  
  const pairedBotId = players[botId].pairedBotId;
  if (!players[pairedBotId]) return;
  
  // Determine which bot is the leader (the one with sound)
  const isLeader = players[botId].botSoundFile !== null;
  const leaderId = isLeader ? botId : pairedBotId;
  const followerId = isLeader ? pairedBotId : botId;
  
  // Define maximum allowed distance between bots
  const MAX_BOT_SEPARATION = 60; // Maximum distance in pixels
  const IDEAL_BOT_DISTANCE = 40; // Ideal distance between bots
  
  // Calculate current distance between bots
  const currentDistance = Math.sqrt(
    Math.pow(players[leaderId].x - players[followerId].x, 2) + 
    Math.pow(players[leaderId].y - players[followerId].y, 2)
  );
  
  // Only the leader bot determines movement
  if (isLeader) {
    // Check if bots are too far apart
    if (currentDistance > MAX_BOT_SEPARATION) {
      console.log(`Fighting bots too far apart (${currentDistance.toFixed(2)}px). Correcting position...`);
      
      // Calculate direction vector from follower to leader
      const dirX = players[leaderId].x - players[followerId].x;
      const dirY = players[leaderId].y - players[followerId].y;
      
      // Normalize direction vector
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      const normDirX = dirX / length;
      const normDirY = dirY / length;
      
      // Move follower towards leader to maintain maximum distance
      players[followerId].x = players[leaderId].x - (normDirX * IDEAL_BOT_DISTANCE);
      players[followerId].y = players[leaderId].y - (normDirY * IDEAL_BOT_DISTANCE);
      
      // Adjust velocities to move together
      players[followerId].velocityX = players[leaderId].velocityX;
      players[followerId].velocityY = players[leaderId].velocityY;
    } else {
      // Normal movement when distance is acceptable
      // Random movement with acceleration, but slower than regular bots
      const moveX = Math.random() > 0.5 ? 1 : -1;
      const moveY = Math.random() > 0.5 ? 1 : -1;
      
      // Apply acceleration with some randomness
      players[leaderId].velocityX += moveX * 0.1 * Math.random();
      players[leaderId].velocityY += moveY * 0.1 * Math.random();
      
      // Apply velocity cap (slower than regular bots)
      const MAX_PAIRED_BOT_VELOCITY = 2;
      players[leaderId].velocityX = Math.max(-MAX_PAIRED_BOT_VELOCITY, Math.min(MAX_PAIRED_BOT_VELOCITY, players[leaderId].velocityX));
      players[leaderId].velocityY = Math.max(-MAX_PAIRED_BOT_VELOCITY, Math.min(MAX_PAIRED_BOT_VELOCITY, players[leaderId].velocityY));
      
      // Apply velocity to position
      players[leaderId].x += players[leaderId].velocityX;
      players[leaderId].y += players[leaderId].velocityY;
      
      // Apply friction
      const PAIRED_BOT_FRICTION = 0.98;
      players[leaderId].velocityX *= PAIRED_BOT_FRICTION;
      players[leaderId].velocityY *= PAIRED_BOT_FRICTION;
      
      // Keep bot within world bounds
      const prevX = players[leaderId].x;
      const prevY = players[leaderId].y;
      
      players[leaderId].x = Math.max(50, Math.min(worldSize.width - 50, players[leaderId].x));
      players[leaderId].y = Math.max(50, Math.min(worldSize.height - 50, players[leaderId].y));
      
      // If bot hit a boundary, reverse velocity in that direction
      if (players[leaderId].x !== prevX) players[leaderId].velocityX *= -0.5;
      if (players[leaderId].y !== prevY) players[leaderId].velocityY *= -0.5;
      
      // Position the follower bot next to the leader
      // Calculate a position that's slightly offset but looks like they're facing each other
      // Use a smaller random variation to keep them closer
      const offsetX = IDEAL_BOT_DISTANCE * (Math.random() * 0.2 + 0.9); // Random offset between 36-44 pixels
      const offsetY = 8 * (Math.random() * 0.6 - 0.3); // Small random Y variation
      
      players[followerId].x = players[leaderId].x + offsetX;
      players[followerId].y = players[leaderId].y + offsetY;
      
      // Match velocities for smooth movement
      players[followerId].velocityX = players[leaderId].velocityX;
      players[followerId].velocityY = players[leaderId].velocityY;
    }
    
    // Ensure follower stays within world bounds too
    players[followerId].x = Math.max(50, Math.min(worldSize.width - 50, players[followerId].x));
    players[followerId].y = Math.max(50, Math.min(worldSize.height - 50, players[followerId].y));
  }
  
  // Get current time
  const currentTime = Date.now();
  
  // Update speaking duration for both bots
  players[botId].speakingDuration = currentTime - players[botId].lastSpeakingChange;
  
  // Ensure both bots are always speaking
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
  
  console.log(`Created new player: ${playerId} with socket ID: ${socket.id}`);
  
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
  
  // Also send the new player to themselves to ensure consistency
  socket.emit('playerJoined', players[playerId]);
  
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
    
    // Check if customImage is too large (over 1MB)
    let customImage = data.customImage;
    if (customImage && customImage.length > 1000000) {
      console.warn(`Image for player ${data.id} is too large (${customImage.length} bytes), rejecting`);
      customImage = null; // Don't store oversized images
    }
    
    if (players[data.id]) {
      // Update player properties
      if (data.name) players[data.id].name = data.name;
      if (data.color) players[data.id].color = data.color;
      if (data.customImage !== undefined) players[data.id].customImage = customImage;
      
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
      console.log(`Player ${playerId} disconnected, removing from game state`);
      
      // Remove the player from the game state
      delete players[playerId];
      
      // Broadcast player disconnection to all other players
      io.emit('playerLeft', { id: playerId });
    } else {
      console.log(`Could not find player with socket ID: ${socket.id}`);
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
    // Move the Dracula bot
    moveBotRandomly(botId);
    
    // Move the fighting bots
    movePairedBot(fightingBot1Id);
    // No need to call movePairedBot for the second bot as it's handled by the first one
  }, 100);
});

// Clean up on server shutdown
process.on('SIGINT', () => {
  clearInterval(botMovementInterval);
  process.exit();
}); 