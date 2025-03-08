// Game constants
const PLAYER_RADIUS = 30;
const MOVEMENT_SPEED = 5;
const ACCELERATION = 0.5; // New acceleration constant
const FRICTION = 0.9; // New friction constant (0-1, where 1 is no friction)
const MAX_VELOCITY = 8; // Maximum velocity cap
const VOICE_MAX_DISTANCE = 250; // Reduced to half the original distance (was 500)
const VOICE_MIN_VOLUME = 0; // Minimum volume set to 0 for complete silence at max distance
const MINIMAP_SIZE = 200; // Size of the mini-map in pixels
const MINIMAP_PADDING = 20; // Padding from the edge of the screen
const JOYSTICK_MAX_DISTANCE = 40; // Maximum distance the joystick thumb can move

// Map regions
const MAP_REGIONS = [
  // North West quadrant
  { x: 0, y: 0, width: 3333, height: 3333, color: '#f0f8ff', name: 'North West' }, // Light blue
  // North quadrant
  { x: 3333, y: 0, width: 3334, height: 3333, color: '#f0fff0', name: 'North' }, // Light mint
  // North East quadrant
  { x: 6667, y: 0, width: 3333, height: 3333, color: '#fff0f8', name: 'North East' }, // Light pink
  // West quadrant
  { x: 0, y: 3333, width: 3333, height: 3334, color: '#fffff0', name: 'West' }, // Light yellow
  // Center quadrant
  { x: 3333, y: 3333, width: 3334, height: 3334, color: '#f8f8f8', name: 'Center' }, // Light gray
  // East quadrant
  { x: 6667, y: 3333, width: 3333, height: 3334, color: '#f0f0ff', name: 'East' }, // Light lavender
  // South West quadrant
  { x: 0, y: 6667, width: 3333, height: 3333, color: '#fff8f0', name: 'South West' }, // Light peach
  // South quadrant
  { x: 3333, y: 6667, width: 3334, height: 3333, color: '#f0ffff', name: 'South' }, // Light cyan
  // South East quadrant
  { x: 6667, y: 6667, width: 3333, height: 3333, color: '#f8f0ff', name: 'South East' } // Light purple
];

// Game state
let canvas, ctx;
let minimapCanvas, minimapCtx;
let whiteboardCanvas, whiteboardCtx;
let playerId;
let players = {};
let worldSize = { width: 10000, height: 10000 }; // This will be updated from server
let camera = { x: 0, y: 0 };
let keys = {};
let friends = [];
let mutedPlayers = [];
let selectedPlayer = null;
let customImage = null;
let hideUserInfo = false; // Track whether user info is hidden
let currentRegion = null; // Track the player's current region

// Background particles
let particles = [];
const PARTICLE_COUNT = 50;

// Whiteboard state
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentTool = 'pen';
let penColor = '#000000';
let penSize = 5;
let whiteboardData = []; // Store drawing data to send to server

// Emote state
let activeEmote = null;
let emoteTimeout = null;

// WebRTC variables
let localStream;
let peerConnections = {};
let audioContexts = {};
let audioElements = {};
let audioAnalysers = {};
let isMicEnabled = false;
let isSpeaking = false;

// Bot variables
let botSounds = {};

// Global variables
let socket;
let audioContext;
let analyzer;
let isMobileDevice = false;
let joystickActive = false;
let joystickPosition = { x: 0, y: 0 };

// Initialize the game
function init() {
  // Detect touch devices
  detectTouchDevice();
  
  // Set up canvas
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  
  // Set up mini-map canvas
  minimapCanvas = document.getElementById('mini-map-canvas');
  minimapCtx = minimapCanvas.getContext('2d');
  minimapCanvas.width = MINIMAP_SIZE;
  minimapCanvas.height = MINIMAP_SIZE;
  
  // Set up whiteboard canvas
  whiteboardCanvas = document.getElementById('whiteboard-canvas');
  whiteboardCtx = whiteboardCanvas.getContext('2d');
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Initialize background particles
  initParticles();

  // Set up input handlers
  setupInputHandlers();

  // Set up login screen
  setupLoginScreen();
  
  // Set up whiteboard
  setupWhiteboard();
  
  // Set up emotes
  setupEmotes();
  
  // Set up mobile controls if on a touch device
  if (isMobileDevice) {
    setupMobileControls();
  }

  // Connect to server
  connectToServer();
}

// Initialize background particles
function initParticles() {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * worldSize.width,
      y: Math.random() * worldSize.height,
      size: Math.random() * 3 + 1,
      speedX: Math.random() * 0.5 - 0.25,
      speedY: Math.random() * 0.5 - 0.25,
      opacity: Math.random() * 0.5 + 0.1
    });
  }
}

// Resize canvas to fit window
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  // Resize whiteboard canvas to fit its container
  if (whiteboardCanvas) {
    const container = document.getElementById('whiteboard-container');
    const header = document.querySelector('.whiteboard-header');
    if (container && header) {
      const headerHeight = header.offsetHeight;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      whiteboardCanvas.width = containerWidth;
      whiteboardCanvas.height = containerHeight - headerHeight;
      
      // Redraw whiteboard content after resize
      redrawWhiteboard();
    }
  }
}

// Set up input handlers
function setupInputHandlers() {
  // Keyboard input
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
  });
  
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  
  // Mouse input for player interaction
  canvas.addEventListener('click', handleCanvasClick);
  
  // Mini-map click handler
  minimapCanvas.addEventListener('click', handleMinimapClick);
  
  // Mini-map toggle button
  document.getElementById('toggle-map').addEventListener('click', toggleMiniMap);
  
  // UI button handlers
  document.getElementById('mic-toggle').addEventListener('click', toggleMicrophone);
  document.getElementById('mute-player').addEventListener('click', muteSelectedPlayer);
  document.getElementById('add-friend').addEventListener('click', addSelectedPlayerAsFriend);
  document.getElementById('close-menu').addEventListener('click', closePlayerMenu);
  document.getElementById('close-friends').addEventListener('click', () => {
    document.getElementById('friends-list').classList.add('hidden');
  });
  
  // Toggle user info (hide/show names and images)
  document.getElementById('toggle-user-info').addEventListener('click', toggleUserInfo);
  
  // Whiteboard and emotes
  document.getElementById('open-whiteboard').addEventListener('click', () => {
    document.getElementById('whiteboard-container').classList.remove('hidden');
  });
  
  document.getElementById('open-emotes').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event propagation
    document.getElementById('emote-menu').classList.toggle('hidden');
  });
  
  // Player menu buttons
  document.getElementById('mute-player').addEventListener('click', muteSelectedPlayer);
  document.getElementById('add-friend').addEventListener('click', addSelectedPlayerAsFriend);
  document.getElementById('close-menu').addEventListener('click', closePlayerMenu);
  
  // See More Dracula button
  document.getElementById('see-more-dracula').addEventListener('click', () => {
    window.open('https://www.youtube.com/@plummcorpaudiovisual', '_blank');
    closePlayerMenu();
  });
}

// Set up login screen
function setupLoginScreen() {
  const startButton = document.getElementById('start-button');
  const playerNameInput = document.getElementById('player-name');
  const playerColorInput = document.getElementById('player-color');
  const playerImageInput = document.getElementById('player-image');
  const imagePreview = document.getElementById('image-preview');

  // Set default color
  playerColorInput.value = '#' + Math.floor(Math.random() * 16777215).toString(16);

  // Handle image upload
  playerImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if the file is a GIF
      const isGif = file.type === 'image/gif';
      
      if (isGif) {
        console.log('GIF detected, preserving animation');
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        // For GIFs, we'll use the original file to preserve animation
        if (isGif) {
          // Check file size for GIFs
          if (file.size > 1000000) { // 1MB limit
            alert('GIF is too large! Please use a smaller file (max 1MB).');
            customImage = null;
            imagePreview.innerHTML = '<p>Image too large</p>';
            return;
          }
          
          // Use the original GIF data
          customImage = event.target.result;
          
          // Clear previous preview and show the image
          imagePreview.innerHTML = '';
          
          // Create a preview with proper styling
          const previewImg = document.createElement('img');
          previewImg.src = event.target.result;
          previewImg.style.maxWidth = '100px';
          previewImg.style.maxHeight = '100px';
          previewImg.style.borderRadius = '50%';
          previewImg.style.objectFit = 'cover';
          imagePreview.appendChild(previewImg);
          
          console.log(`GIF processed: Original size ${Math.round(file.size / 1024)}KB, preserved animation`);
        } else {
          // For non-GIFs, continue with the existing resize and compress logic
          // Create an image element to get dimensions and process the image
          const img = new Image();
          img.onload = () => {
            // Create a canvas to resize and compress the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set maximum dimensions for the image (to reduce file size)
            const MAX_WIDTH = 256;
            const MAX_HEIGHT = 256;
            
            // Calculate new dimensions while maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round(height * (MAX_WIDTH / width));
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width = Math.round(width * (MAX_HEIGHT / height));
                height = MAX_HEIGHT;
              }
            }
            
            // Set canvas dimensions and draw resized image
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to compressed JPEG format with quality 0.8
            const compressedImage = canvas.toDataURL('image/jpeg', 0.8);
            
            // Store the compressed image data
            customImage = compressedImage;
            
            // Clear previous preview and show the image
            imagePreview.innerHTML = '';
            
            // Create a preview with proper styling
            const previewImg = document.createElement('img');
            previewImg.src = compressedImage;
            previewImg.style.maxWidth = '100px';
            previewImg.style.maxHeight = '100px';
            previewImg.style.borderRadius = '50%';
            previewImg.style.objectFit = 'cover';
            imagePreview.appendChild(previewImg);
            
            console.log(`Image processed: Original ${img.width}x${img.height}, Compressed to ${width}x${height}`);
          };
          img.onerror = () => {
            console.error('Failed to load the image');
            imagePreview.innerHTML = '<p>Failed to load image</p>';
            customImage = null;
          };
          img.src = event.target.result;
        }
      };
      
      // Use readAsDataURL for all image types
      reader.readAsDataURL(file);
    }
  });

  // Handle start button click
  startButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim() || 'Player';
    const playerColor = playerColorInput.value;

    // Hide login screen
    document.getElementById('login-screen').style.display = 'none';

    // Wait for player ID to be assigned before customizing
    const waitForPlayerId = setInterval(() => {
      if (playerId) {
        clearInterval(waitForPlayerId);
        
        console.log(`Customizing player ${playerId} with name: ${playerName}, color: ${playerColor}, image: ${customImage ? 'provided' : 'none'}`);
        
        // Update local player object first
        if (players[playerId]) {
          players[playerId].name = playerName;
          players[playerId].color = playerColor;
          players[playerId].customImage = customImage;
        }
        
        // Then send to server
        socket.emit('customize', {
          id: playerId,
          name: playerName,
          color: playerColor,
          customImage: customImage
        });
      }
    }, 100);

    // Start game loop
    requestAnimationFrame(gameLoop);

    // Request microphone access
    requestMicrophoneAccess();
  });
}

// Connect to server
function connectToServer() {
  // Connect to Socket.IO server
  socket = io();

  // Handle connection events
  socket.on('connect', () => {
    console.log('Connected to server');
  });

  // Handle initialization
  socket.on('init', (data) => {
    playerId = data.id;
    players = data.players;
    worldSize = data.worldSize;

    // Initialize velocity for all players if not present
    for (const id in players) {
      if (players[id].velocityX === undefined) {
        players[id].velocityX = 0;
        players[id].velocityY = 0;
      }
    }

    // Center camera on player
    if (players[playerId]) {
      camera.x = players[playerId].x - canvas.width / 2;
      camera.y = players[playerId].y - canvas.height / 2;
    }

    // Update player count
    updatePlayerCount();
    
    // Set up bot sounds
    setupBotSounds();
    
    console.log(`Initialized with player ID: ${playerId}`);
  });

  // Handle player joined
  socket.on('playerJoined', (player) => {
    console.log(`Player joined: ${player.id}`);
    players[player.id] = player;
    
    // Initialize velocity if not present
    if (players[player.id].velocityX === undefined) {
      players[player.id].velocityX = 0;
      players[player.id].velocityY = 0;
    }
    
    updatePlayerCount();
    
    // Set up WebRTC connection for the new player if not a bot
    if (isMicEnabled && !player.isBot) {
      setupPeerConnection(player.id);
    }
    
    // Set up bot sound if it's a bot
    if (player.isBot && player.botSoundFile) {
      setupBotSound(player.id, player.botSoundFile);
    }
  });

  // Handle player left
  socket.on('playerLeft', (data) => {
    console.log(`Player left: ${data.id}`);
    delete players[data.id];
    updatePlayerCount();
    
    // Clean up WebRTC connection
    cleanupPeerConnection(data.id);
    
    // Clean up bot sound
    if (botSounds[data.id]) {
      botSounds[data.id].audio.pause();
      delete botSounds[data.id];
    }
  });

  // Handle player moved
  socket.on('playerMoved', (data) => {
    if (players[data.id]) {
      players[data.id].x = data.x;
      players[data.id].y = data.y;
      
      // Update velocity information if provided
      if (data.velocityX !== undefined) players[data.id].velocityX = data.velocityX;
      if (data.velocityY !== undefined) players[data.id].velocityY = data.velocityY;
      
      // Update audio volume based on distance
      if (players[data.id].isBot) {
        updateBotSoundVolume(data.id);
      } else {
        updateAudioVolume(data.id);
      }
    }
  });

  // Handle player speaking
  socket.on('playerSpeaking', (data) => {
    if (players[data.id]) {
      players[data.id].isSpeaking = data.isSpeaking;
      
      // Handle bot speaking with timestamp for synchronization
      if (players[data.id].isBot) {
        // Store the server timestamp for synchronization
        if (data.timestamp) {
          players[data.id].audioStartTime = data.timestamp;
        }
        handleBotSpeaking(data.id, data.isSpeaking, data.timestamp);
      }
    }
  });

  // Handle player customized
  socket.on('playerCustomized', (data) => {
    console.log(`Player customized: ${data.id}`, data);
    
    if (players[data.id]) {
      // Update player properties
      if (data.name) players[data.id].name = data.name;
      if (data.color) players[data.id].color = data.color;
      
      // Handle custom image
      if (data.customImage !== undefined) {
        players[data.id].customImage = data.customImage;
        
        // Clear any existing image object to force reload
        if (players[data.id].imageObj) {
          players[data.id].imageObj = null;
        }
      }
      
      console.log(`Updated player ${data.id}:`, {
        name: players[data.id].name,
        color: players[data.id].color,
        hasImage: !!players[data.id].customImage
      });
    }
  });

  // Handle WebRTC signaling
  socket.on('webrtc-offer', handleWebRTCOffer);
  socket.on('webrtc-answer', handleWebRTCAnswer);
  socket.on('webrtc-ice-candidate', handleWebRTCIceCandidate);
  
  // Handle whiteboard events
  socket.on('whiteboard-draw', (data) => {
    // Add to local data
    whiteboardData.push(data);
    
    // Draw the line
    whiteboardCtx.lineJoin = 'round';
    whiteboardCtx.lineCap = 'round';
    
    if (data.tool === 'pen') {
      whiteboardCtx.strokeStyle = data.color;
      whiteboardCtx.lineWidth = data.size;
      whiteboardCtx.globalCompositeOperation = 'source-over';
    } else if (data.tool === 'eraser') {
      whiteboardCtx.strokeStyle = '#ffffff';
      whiteboardCtx.lineWidth = data.size * 2;
      whiteboardCtx.globalCompositeOperation = 'destination-out';
    }
    
    whiteboardCtx.beginPath();
    whiteboardCtx.moveTo(data.from.x, data.from.y);
    whiteboardCtx.lineTo(data.to.x, data.to.y);
    whiteboardCtx.stroke();
  });
  
  socket.on('whiteboard-clear', () => {
    whiteboardData = [];
    whiteboardCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
  });
  
  socket.on('whiteboard-init', (data) => {
    whiteboardData = data;
    redrawWhiteboard();
  });
  
  // Handle emote events
  socket.on('player-emote', (data) => {
    if (data.id !== playerId) {
      showEmote(data.id, data.symbol);
    }
  });

  // Handle player disconnection
  socket.on('playerDisconnect', (id) => {
    if (players[id]) {
      // Clean up any GIF animation intervals
      if (players[id].gifAnimationInterval) {
        console.log(`Cleaning up GIF animation for player ${id}`);
        clearInterval(players[id].gifAnimationInterval);
        players[id].gifAnimationInterval = null;
        players[id].gifAnimator = null;
      }
      
      delete players[id];
      updatePlayerCount();
      updateFriendsList();
    }
  });
}

// Set up bot sounds
function setupBotSounds() {
  // Check for bots in the initial player list
  for (const id in players) {
    if (players[id].isBot && players[id].botSoundFile) {
      setupBotSound(id, players[id].botSoundFile);
    }
  }
}

// Set up bot sound
function setupBotSound(botId, soundFile) {
  console.log(`Setting up bot sound for ${botId} with file ${soundFile}`);
  
  // Create audio context for more reliable audio playback
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Create audio element for bot
  const audio = new Audio();
  audio.src = soundFile;
  audio.crossOrigin = "anonymous";
  audio.loop = true;
  audio.preload = 'auto';
  
  // Create audio source from element
  const source = audioContext.createMediaElementSource(audio);
  
  // Create gain node for volume control
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 1.0; // Default volume
  
  // Connect the source to the gain node and the gain node to the destination
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Add event listeners for debugging
  audio.addEventListener('play', () => {
    console.log(`Bot ${botId} audio started playing`);
  });
  
  audio.addEventListener('pause', () => {
    console.log(`Bot ${botId} audio paused`);
  });
  
  audio.addEventListener('ended', () => {
    console.log(`Bot ${botId} audio ended (should not happen with loop=true)`);
    // Restart immediately if it somehow ends despite loop=true
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error('Error restarting bot sound:', error);
        // Try again after a short delay
        setTimeout(() => {
          audio.play().catch(e => console.error('Retry failed:', e));
        }, 1000);
      });
    }
  });
  
  audio.addEventListener('error', (e) => {
    console.error(`Bot ${botId} audio error:`, e);
    // Try to recover from error
    setTimeout(() => {
      audio.load();
      audio.play().catch(err => console.error('Recovery failed:', err));
    }, 2000);
  });
  
  // Store bot sound with all components
  botSounds[botId] = {
    audio: audio,
    audioContext: audioContext,
    gainNode: gainNode,
    isPlaying: true, // Always set to true since bot always speaks
    actuallyPlaying: false,
    lastPlayAttempt: 0,
    playbackTimer: null
  };
  
  // Load the audio
  audio.load();
  
  // Set up periodic check to ensure audio is playing
  botSounds[botId].playbackTimer = setInterval(() => {
    ensureBotAudioPlaying(botId);
  }, 5000);
  
  console.log(`Bot sound setup complete for ${botId}`);
}

// Function to ensure bot audio is playing
function ensureBotAudioPlaying(botId) {
  if (!botSounds[botId]) return;
  
  const now = Date.now();
  const timeSinceLastAttempt = now - botSounds[botId].lastPlayAttempt;
  
  // Check if audio should be playing but isn't
  if (players[botId] && 
      (!botSounds[botId].actuallyPlaying || 
       (botSounds[botId].audio.paused && timeSinceLastAttempt > 3000))) {
    
    console.log(`Ensuring bot ${botId} audio is playing`);
    
    // Resume audio context if it's suspended
    if (botSounds[botId].audioContext.state === 'suspended') {
      botSounds[botId].audioContext.resume().catch(err => {
        console.error('Failed to resume audio context:', err);
      });
    }
    
    // Only try to play if we're close enough to hear it
    if (shouldPlayBotSound(botId)) {
      botSounds[botId].lastPlayAttempt = now;
      
      // Calculate time offset based on server timestamp
      let timeOffset = 0;
      if (players[botId].audioStartTime) {
        // Calculate how much time has passed since the server started the audio
        const serverTimeElapsed = now - players[botId].audioStartTime;
        // Convert to seconds for audio currentTime
        timeOffset = (serverTimeElapsed / 1000) % botSounds[botId].audio.duration;
        console.log(`Recovery: Setting time offset to ${timeOffset}s based on server timestamp`);
      }
      
      // Set the current time to sync with other clients
      try {
        botSounds[botId].audio.currentTime = timeOffset;
      } catch (e) {
        console.warn('Could not set audio currentTime, audio may not be in sync:', e);
      }
      
      // Try to play the audio
      const playPromise = botSounds[botId].audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log(`Bot ${botId} audio playing successfully (recovery) at time offset ${timeOffset}s`);
          botSounds[botId].actuallyPlaying = true;
          
          // Make sure volume is set correctly
          updateBotSoundVolume(botId);
        }).catch(error => {
          console.error(`Error playing bot ${botId} sound:`, error);
          
          // Try again after a short delay
          setTimeout(() => {
            if (botSounds[botId]) {
              console.log(`Retrying bot ${botId} audio playback after error`);
              botSounds[botId].audio.play().catch(e => {
                console.error('Retry failed:', e);
              });
            }
          }, 1000);
        });
      }
    }
  } else if (botSounds[botId].actuallyPlaying) {
    // Audio is playing, just make sure volume is correct
    updateBotSoundVolume(botId);
  }
}

// Handle bot speaking
function handleBotSpeaking(botId, isSpeaking, timestamp) {
  if (!botSounds[botId]) {
    console.error(`Bot sound not found for ${botId}`);
    return;
  }
  
  console.log(`Bot ${botId} speaking state changed to: ${isSpeaking}`);
  
  // Update the bot's speaking state
  botSounds[botId].isPlaying = isSpeaking;
  
  if (isSpeaking) {
    // Only actually play the sound if we're close enough to hear it
    if (shouldPlayBotSound(botId)) {
      console.log(`Starting bot ${botId} sound playback`);
      
      // Resume audio context if it's suspended (browser autoplay policy)
      if (botSounds[botId].audioContext.state === 'suspended') {
        botSounds[botId].audioContext.resume().then(() => {
          console.log('Audio context resumed');
        }).catch(err => {
          console.error('Failed to resume audio context:', err);
        });
      }
      
      botSounds[botId].lastPlayAttempt = Date.now();
      
      // Calculate time offset based on server timestamp
      let timeOffset = 0;
      if (timestamp) {
        // Calculate how much time has passed since the server started the audio
        const serverTimeElapsed = Date.now() - timestamp;
        // Convert to seconds for audio currentTime
        timeOffset = (serverTimeElapsed / 1000) % botSounds[botId].audio.duration;
        console.log(`Setting time offset to ${timeOffset}s based on server timestamp`);
      }
      
      // Set the current time to sync with other clients
      try {
        botSounds[botId].audio.currentTime = timeOffset;
      } catch (e) {
        console.warn('Could not set audio currentTime, audio may not be in sync:', e);
      }
      
      // Play the audio with error handling
      const playPromise = botSounds[botId].audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log(`Bot ${botId} audio playing successfully at time offset ${timeOffset}s`);
          botSounds[botId].actuallyPlaying = true;
        }).catch(error => {
          console.error(`Error playing bot ${botId} sound:`, error);
          // Try to recover by retrying after a short delay
          setTimeout(() => {
            if (botSounds[botId]) {
              console.log(`Retrying bot ${botId} audio playback`);
              botSounds[botId].audio.play().catch(e => {
                console.error('Retry failed:', e);
              });
            }
          }, 1000);
        });
      }
    } else {
      console.log(`Bot ${botId} is speaking but too far to hear`);
      botSounds[botId].actuallyPlaying = false;
    }
  } else {
    // We should never reach this code now, but keep it for safety
    console.warn(`Bot ${botId} speaking state set to false - this should not happen`);
    
    // Instead of pausing, just lower the volume to zero
    if (botSounds[botId].gainNode) {
      botSounds[botId].gainNode.gain.value = 0;
    }
  }
}

// Helper function to determine if bot sound should be playing based on distance
function shouldPlayBotSound(botId) {
  if (!players[playerId] || !players[botId]) return false;
  
  // Calculate distance between player and bot
  const dx = players[playerId].x - players[botId].x;
  const dy = players[playerId].y - players[botId].y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Calculate volume based on distance (using the same quadratic falloff)
  const volume = 1 - Math.pow(distance / VOICE_MAX_DISTANCE, 2);
  
  // Should play if volume would be audible and not muted
  return volume > 0 && !mutedPlayers.includes(botId);
}

// Update bot sound volume based on distance
function updateBotSoundVolume(botId) {
  if (!players[playerId] || !players[botId] || !botSounds[botId]) return;
  
  // Calculate distance between player and bot
  const dx = players[playerId].x - players[botId].x;
  const dy = players[playerId].y - players[botId].y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Calculate volume based on distance (quadratic falloff for more natural sound attenuation)
  // This creates a steeper volume drop-off as distance increases
  let volume = 1 - Math.pow(distance / VOICE_MAX_DISTANCE, 2);
  volume = Math.max(0, Math.min(1, volume));
  
  // Check if the bot should be audible
  const shouldBeAudible = volume > 0 && !mutedPlayers.includes(botId);
  
  // Apply volume using the gain node for smoother transitions
  if (!mutedPlayers.includes(botId)) {
    // Use exponential ramp for more natural volume changes
    const now = botSounds[botId].audioContext.currentTime;
    botSounds[botId].gainNode.gain.setValueAtTime(botSounds[botId].gainNode.gain.value, now);
    botSounds[botId].gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.2);
  } else {
    // If muted, set volume to 0 but don't pause
    botSounds[botId].gainNode.gain.value = 0;
  }
  
  // Handle playback state based on distance
  if (shouldBeAudible && !botSounds[botId].actuallyPlaying) {
    // We're close enough to hear it but it's not playing - start it
    console.log(`Player moved in range of bot ${botId}, starting playback`);
    
    // Resume audio context if it's suspended
    if (botSounds[botId].audioContext.state === 'suspended') {
      botSounds[botId].audioContext.resume();
    }
    
    // Calculate time offset based on server timestamp
    let timeOffset = 0;
    if (players[botId].audioStartTime) {
      // Calculate how much time has passed since the server started the audio
      const serverTimeElapsed = Date.now() - players[botId].audioStartTime;
      // Convert to seconds for audio currentTime
      timeOffset = (serverTimeElapsed / 1000) % botSounds[botId].audio.duration;
      console.log(`Distance update: Setting time offset to ${timeOffset}s based on server timestamp`);
    }
    
    // Set the current time to sync with other clients
    try {
      botSounds[botId].audio.currentTime = timeOffset;
    } catch (e) {
      console.warn('Could not set audio currentTime, audio may not be in sync:', e);
    }
    
    // Play with error handling
    botSounds[botId].lastPlayAttempt = Date.now();
    const playPromise = botSounds[botId].audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        botSounds[botId].actuallyPlaying = true;
        console.log(`Bot ${botId} audio playing successfully (distance update) at time offset ${timeOffset}s`);
      }).catch(error => {
        console.error('Error playing bot sound:', error);
        
        // Try again after a short delay
        setTimeout(() => {
          if (botSounds[botId]) {
            console.log(`Retrying bot ${botId} audio playback after distance error`);
            botSounds[botId].audio.play().catch(e => {
              console.error('Distance retry failed:', e);
            });
          }
        }, 1000);
      });
    }
  } else if (!shouldBeAudible && botSounds[botId].actuallyPlaying) {
    // We're too far to hear it - don't pause, just set volume to 0
    console.log(`Bot ${botId} is too far to hear, setting volume to 0`);
    botSounds[botId].gainNode.gain.value = 0;
  }
}

// Game loop
function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

// Update game state
function update() {
  // Handle player movement
  handlePlayerMovement();
  
  // Update camera position to follow player
  if (players[playerId]) {
    camera.x = players[playerId].x - canvas.width / 2;
    camera.y = players[playerId].y - canvas.height / 2;
    
    // Check if player has entered a new region
    checkPlayerRegion();
  }
  
  // Update particles
  updateParticles();
  
  // Check if player is speaking
  checkSpeakingStatus();
}

// Update particles
function updateParticles() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    
    // Move particles
    p.x += p.speedX;
    p.y += p.speedY;
    
    // Wrap particles around the world
    if (p.x < 0) p.x = worldSize.width;
    if (p.x > worldSize.width) p.x = 0;
    if (p.y < 0) p.y = worldSize.height;
    if (p.y > worldSize.height) p.y = 0;
    
    // Slightly vary opacity for a twinkling effect
    p.opacity += Math.random() * 0.02 - 0.01;
    p.opacity = Math.max(0.1, Math.min(0.6, p.opacity));
  }
}

// Render game
function render() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw world background (grid)
  drawGrid();
  
  // Draw particles
  drawParticles();

  // Draw players in two passes: first regular players, then bots
  // This ensures bots are always on top and visible
  
  // First pass: Draw regular players
  for (const id in players) {
    if (!players[id].isBot) {
      drawPlayer(players[id]);
    }
  }
  
  // Second pass: Draw bots on top
  for (const id in players) {
    if (players[id].isBot) {
      drawPlayer(players[id]);
    }
  }
  
  // Update mini-map
  updateMiniMap();
}

// Draw grid
function drawGrid() {
  // Define map regions with different colors
  const regions = MAP_REGIONS;
  
  // Draw background regions
  for (const region of regions) {
    // Calculate screen coordinates
    const screenX = region.x - camera.x;
    const screenY = region.y - camera.y;
    
    // Only draw if region is visible on screen
    if (screenX < canvas.width && 
        screenY < canvas.height && 
        screenX + region.width > 0 && 
        screenY + region.height > 0) {
      
      ctx.fillStyle = region.color;
      ctx.fillRect(
        Math.max(0, screenX), 
        Math.max(0, screenY), 
        Math.min(canvas.width - screenX, region.width), 
        Math.min(canvas.height - screenY, region.height)
      );
      
      // Draw region name in the center
      const centerX = screenX + region.width / 2;
      const centerY = screenY + region.height / 2;
      
      // Only draw text if center is visible
      if (centerX > 0 && centerX < canvas.width && 
          centerY > 0 && centerY < canvas.height) {
        ctx.font = '24px Arial';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(region.name, centerX, centerY);
      }
    }
  }
  
  const gridSize = 100;
  const offsetX = -camera.x % gridSize;
  const offsetY = -camera.y % gridSize;

  // Draw main grid lines
  ctx.strokeStyle = 'rgba(200, 215, 230, 0.5)'; // Soft blue, semi-transparent
  ctx.lineWidth = 1;

  // Draw vertical lines
  for (let x = offsetX; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Draw horizontal lines
  for (let y = offsetY; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // Draw accent lines (thicker lines every 5 grid cells)
  ctx.strokeStyle = 'rgba(180, 200, 220, 0.7)'; // Slightly darker blue, more opaque
  ctx.lineWidth = 2;
  
  const accentGridSize = gridSize * 5;
  const accentOffsetX = -camera.x % accentGridSize;
  const accentOffsetY = -camera.y % accentGridSize;
  
  // Draw vertical accent lines
  for (let x = accentOffsetX; x < canvas.width; x += accentGridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  
  // Draw horizontal accent lines
  for (let y = accentOffsetY; y < canvas.height; y += accentGridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // Draw region borders (thicker lines at region boundaries)
  ctx.strokeStyle = 'rgba(100, 120, 140, 0.8)'; // Darker blue, more opaque
  ctx.lineWidth = 3;
  
  // Vertical region borders
  for (let i = 1; i < 3; i++) {
    const x = (worldSize.width / 3) * i - camera.x;
    if (x > 0 && x < canvas.width) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  }
  
  // Horizontal region borders
  for (let i = 1; i < 3; i++) {
    const y = (worldSize.height / 3) * i - camera.y;
    if (y > 0 && y < canvas.height) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }
  
  // Draw ambient elements (dots at grid intersections)
  ctx.fillStyle = 'rgba(150, 180, 210, 0.3)'; // Soft blue dots
  
  for (let x = offsetX; x < canvas.width; x += gridSize) {
    for (let y = offsetY; y < canvas.height; y += gridSize) {
      // Only draw dots at some intersections for a more organic feel
      if ((Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 3 === 0) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// Draw particles
function drawParticles() {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const screenX = p.x - camera.x;
    const screenY = p.y - camera.y;
    
    // Only draw particles that are visible on screen
    if (
      screenX > -p.size && 
      screenX < canvas.width + p.size && 
      screenY > -p.size && 
      screenY < canvas.height + p.size
    ) {
      ctx.globalAlpha = p.opacity;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Reset global alpha
  ctx.globalAlpha = 1;
}

// Draw player
function drawPlayer(player) {
  const screenX = player.x - camera.x;
  const screenY = player.y - camera.y;

  // Check if player is visible on screen
  if (
    screenX + PLAYER_RADIUS < 0 ||
    screenX - PLAYER_RADIUS > canvas.width ||
    screenY + PLAYER_RADIUS < 0 ||
    screenY - PLAYER_RADIUS > canvas.height
  ) {
    return;
  }

  // Draw player circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(screenX, screenY, PLAYER_RADIUS, 0, Math.PI * 2);
  
  // Draw player image or color
  if (player.customImage && !hideUserInfo) {
    // Create image if it doesn't exist yet
    if (!player.imageObj) {
      player.imageObj = new Image();
      player.imageObj.crossOrigin = 'Anonymous'; // Handle CORS issues
      player.imageLoadAttempts = player.imageLoadAttempts || 0;
      
      // Check if this is a GIF by looking at the data URL header
      player.isGif = player.customImage && player.customImage.startsWith('data:image/gif');
      
      player.imageObj.onload = () => {
        console.log(`Image loaded for player ${player.id}${player.isGif ? ' (GIF)' : ''}`);
        player.imageLoadAttempts = 0; // Reset attempts on success
        
        // For GIFs, we need to trigger redraws to animate them
        if (player.isGif && !player.gifAnimationInterval) {
          console.log(`Setting up GIF animation for player ${player.id}`);
          
          // Create a new image element for the GIF that will be constantly reloaded
          // This forces the browser to re-render the GIF animation
          player.gifAnimator = new Image();
          player.gifAnimator.crossOrigin = 'Anonymous';
          
          // Force a redraw every 50ms to ensure GIF animation plays
          player.gifAnimationInterval = setInterval(() => {
            // Only create the interval if the player is still in the game
            if (players[player.id]) {
              // Reload the GIF with a cache-busting parameter to force animation
              const timestamp = Date.now();
              player.gifAnimator.src = player.customImage + '?t=' + timestamp;
              
              // When the animator loads, update the main image
              player.gifAnimator.onload = () => {
                // This will trigger a redraw of the player, advancing the GIF animation
                player.imageObj.src = player.gifAnimator.src;
                player.lastGifUpdate = timestamp;
              };
            } else {
              // Clean up the interval if the player is gone
              clearInterval(player.gifAnimationInterval);
              player.gifAnimationInterval = null;
              player.gifAnimator = null;
            }
          }, 100); // Slightly slower refresh rate to reduce performance impact
        }
      };
      
      player.imageObj.onerror = (e) => {
        player.imageLoadAttempts++;
        console.error(`Error loading image for player ${player.id} (attempt ${player.imageLoadAttempts}):`, e);
        
        if (player.imageLoadAttempts < 3) {
          // Try again with a cache-busting parameter
          setTimeout(() => {
            if (player.imageObj) {
              player.imageObj.src = player.customImage + '?retry=' + new Date().getTime();
            }
          }, 1000);
        } else {
          // After 3 attempts, fall back to color
          console.warn(`Giving up on loading image for player ${player.id} after ${player.imageLoadAttempts} attempts`);
          player.imageObj = null;
          player.customImage = null; // Clear the custom image to prevent further attempts
          
          // Clean up any GIF animation interval
          if (player.gifAnimationInterval) {
            console.log(`Cleaning up GIF animation for player ${player.id} due to load failure`);
            clearInterval(player.gifAnimationInterval);
            player.gifAnimationInterval = null;
            player.gifAnimator = null;
            player.isGif = false;
          }
        }
      };
      
      player.imageObj.src = player.customImage;
    }
    
    // If image is loaded, draw it
    if (player.imageObj && player.imageObj.complete && player.imageObj.naturalWidth > 0) {
      try {
        // Create circular clipping path
        ctx.clip();
        
        // Calculate dimensions to maintain aspect ratio
        let drawWidth, drawHeight, offsetX, offsetY;
        const imgAspect = player.imageObj.width / player.imageObj.height;
        
        if (imgAspect >= 1) {
          // Image is wider than tall or square
          drawHeight = PLAYER_RADIUS * 2;
          drawWidth = drawHeight * imgAspect;
          offsetX = (drawWidth - PLAYER_RADIUS * 2) / 2;
          offsetY = 0;
        } else {
          // Image is taller than wide
          drawWidth = PLAYER_RADIUS * 2;
          drawHeight = drawWidth / imgAspect;
          offsetX = 0;
          offsetY = (drawHeight - PLAYER_RADIUS * 2) / 2;
        }
        
        // Draw the image centered
        ctx.drawImage(
          player.imageObj, 
          screenX - PLAYER_RADIUS - offsetX, 
          screenY - PLAYER_RADIUS - offsetY, 
          drawWidth, 
          drawHeight
        );
        
        // For GIFs, we need to track the last update time to ensure animation continues
        if (player.isGif) {
          player.lastGifUpdate = Date.now();
        }
      } catch (err) {
        console.error(`Error drawing player image for ${player.id}:`, err);
        // Fall back to color on drawing error
        ctx.fillStyle = hideUserInfo ? '#cccccc' : (player.color || '#cccccc');
        ctx.fill();
      }
    } else {
      // Fall back to color while image is loading
      ctx.fillStyle = hideUserInfo ? '#cccccc' : (player.color || '#cccccc');
      ctx.fill();
    }
  } else {
    // Fill with player color or default if hiding user info
    ctx.fillStyle = hideUserInfo ? '#cccccc' : (player.color || '#cccccc');
    ctx.fill();
  }
  
  ctx.restore();

  // Add a highlight border for the current player
  if (player.id === playerId) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(screenX, screenY, PLAYER_RADIUS + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#00FFFF'; // Bright cyan to match minimap
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Add a black outer stroke for contrast
    ctx.beginPath();
    ctx.arc(screenX, screenY, PLAYER_RADIUS + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Draw movement direction indicator if player has velocity
  if (player.velocityX !== undefined && player.velocityY !== undefined) {
    const velocityMagnitude = Math.sqrt(player.velocityX * player.velocityX + player.velocityY * player.velocityY);
    if (velocityMagnitude > 0.5) {
      const directionX = player.velocityX / velocityMagnitude;
      const directionY = player.velocityY / velocityMagnitude;
      const indicatorLength = PLAYER_RADIUS * (0.5 + velocityMagnitude / 8); // Scale with velocity
      
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(screenX + directionX * indicatorLength, screenY + directionY * indicatorLength);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // Draw speaking indicator
  if (player.isSpeaking && !mutedPlayers.includes(player.id)) {
    ctx.beginPath();
    ctx.arc(screenX, screenY, PLAYER_RADIUS + 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Draw muted indicator
  if (mutedPlayers.includes(player.id)) {
    ctx.beginPath();
    ctx.moveTo(screenX - PLAYER_RADIUS / 2, screenY);
    ctx.lineTo(screenX + PLAYER_RADIUS / 2, screenY);
    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Draw bot indicator if it's a bot
  if (player.isBot) {
    // Add pulsing glow effect for bots
    if (!player.pulseValue) {
      player.pulseValue = 0;
      player.pulseDirection = 1;
    }
    
    // Update pulse animation
    player.pulseValue += 0.05 * player.pulseDirection;
    if (player.pulseValue >= 1) {
      player.pulseDirection = -1;
    } else if (player.pulseValue <= 0) {
      player.pulseDirection = 1;
    }
    
    // Draw outer glow BEHIND the player (not on top of it)
    ctx.save();
    const glowSize = 8 + 4 * player.pulseValue; // Pulsing effect
    
    // Create a clipping path that excludes the player circle
    ctx.beginPath();
    ctx.arc(screenX, screenY, PLAYER_RADIUS + glowSize + 2, 0, Math.PI * 2);
    ctx.arc(screenX, screenY, PLAYER_RADIUS, 0, Math.PI * 2, true); // Counter-clockwise to create hole
    ctx.clip();
    
    // Draw the glow in the clipped area (ring around player)
    ctx.beginPath();
    ctx.arc(screenX, screenY, PLAYER_RADIUS + glowSize, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      screenX, screenY, PLAYER_RADIUS,
      screenX, screenY, PLAYER_RADIUS + glowSize
    );
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.9)'); // Gold color
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
    
    // Draw bot text with improved visibility
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#FF5733';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.strokeText('BOT', screenX, screenY - PLAYER_RADIUS - 12);
    ctx.fillText('BOT', screenX, screenY - PLAYER_RADIUS - 12);
    
    // Draw crown icon above bot
    ctx.beginPath();
    const crownSize = 10;
    const crownY = screenY - PLAYER_RADIUS - 30;
    
    // Draw crown base
    ctx.moveTo(screenX - crownSize, crownY);
    ctx.lineTo(screenX + crownSize, crownY);
    ctx.lineTo(screenX + crownSize * 0.8, crownY - crownSize * 0.6);
    ctx.lineTo(screenX + crownSize * 0.4, crownY);
    ctx.lineTo(screenX, crownY - crownSize * 0.8);
    ctx.lineTo(screenX - crownSize * 0.4, crownY);
    ctx.lineTo(screenX - crownSize * 0.8, crownY - crownSize * 0.6);
    ctx.closePath();
    
    // Fill crown with gold color
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Draw player name if not hiding user info
  if (!hideUserInfo) {
    ctx.font = '14px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText(player.name || 'Player', screenX, screenY + PLAYER_RADIUS + 20);
  }

  // Draw friend indicator if player is in friends list
  if (friends.includes(player.id)) {
    // Position the dot above the player, adjusting for bots
    const dotY = screenY - PLAYER_RADIUS - (player.isBot ? 25 : 15);
    const dotX = screenX;
    
    // Draw a slightly larger green dot with a white border for visibility
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#4CAF50'; // Green color
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// Handle canvas click
function handleCanvasClick(e) {
  const mouseX = e.clientX + camera.x;
  const mouseY = e.clientY + camera.y;

  // Check if clicked on a player
  for (const id in players) {
    if (id === playerId) continue; // Skip self

    const player = players[id];
    const distance = Math.sqrt(
      Math.pow(mouseX - player.x, 2) + Math.pow(mouseY - player.y, 2)
    );

    if (distance <= PLAYER_RADIUS) {
      // Show player menu
      selectedPlayer = player;
      showPlayerMenu(player, e.clientX, e.clientY);
      return;
    }
  }

  // Hide player menu if clicked elsewhere
  closePlayerMenu();
}

// Show player menu
function showPlayerMenu(player, x, y) {
  const menu = document.getElementById('player-menu');
  const menuPlayerName = document.getElementById('menu-player-name');
  const muteButton = document.getElementById('mute-player');
  const addFriendButton = document.getElementById('add-friend');
  const seeMoreDraculaButton = document.getElementById('see-more-dracula');
  
  // Set player name in menu
  menuPlayerName.textContent = player.name + (player.isBot ? ' (BOT)' : '');
  
  // Update mute button text based on mute status
  if (mutedPlayers.includes(player.id)) {
    muteButton.textContent = 'Unmute Player';
    muteButton.classList.add('muted');
  } else {
    muteButton.textContent = 'Mute Player';
    muteButton.classList.remove('muted');
  }
  
  // Update add friend button text based on friend status
  if (friends.includes(player.id)) {
    addFriendButton.textContent = 'Remove Friend';
    addFriendButton.classList.add('friend-added');
  } else {
    addFriendButton.textContent = 'Add Friend';
    addFriendButton.classList.remove('friend-added');
  }
  
  // Show "See More Dracula" button only for the bot
  if (player.isBot) {
    seeMoreDraculaButton.classList.remove('hidden');
  } else {
    seeMoreDraculaButton.classList.add('hidden');
  }
  
  // Position menu
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  
  // Show menu
  menu.classList.remove('hidden');
}

// Close player menu
function closePlayerMenu() {
  document.getElementById('player-menu').classList.add('hidden');
  selectedPlayer = null;
}

// Mute selected player
function muteSelectedPlayer() {
  if (!selectedPlayer) return;

  const index = mutedPlayers.indexOf(selectedPlayer.id);
  if (index === -1) {
    // Mute player
    mutedPlayers.push(selectedPlayer.id);
    
    // Mute audio element or bot sound
    if (selectedPlayer.isBot) {
      if (botSounds[selectedPlayer.id]) {
        botSounds[selectedPlayer.id].audio.volume = 0;
      }
    } else if (audioElements[selectedPlayer.id]) {
      audioElements[selectedPlayer.id].muted = true;
    }
    
    document.getElementById('mute-player').textContent = 'Unmute Player';
    document.getElementById('mute-player').classList.add('muted');
  } else {
    // Unmute player
    mutedPlayers.splice(index, 1);
    
    // Unmute audio element or bot sound
    if (selectedPlayer.isBot) {
      if (botSounds[selectedPlayer.id]) {
        updateBotSoundVolume(selectedPlayer.id);
      }
    } else if (audioElements[selectedPlayer.id]) {
      audioElements[selectedPlayer.id].muted = false;
      updateAudioVolume(selectedPlayer.id);
    }
    
    document.getElementById('mute-player').textContent = 'Mute Player';
    document.getElementById('mute-player').classList.remove('muted');
  }
}

// Add selected player as friend
function addSelectedPlayerAsFriend() {
  if (!selectedPlayer) return;

  // Check if already a friend
  if (!friends.includes(selectedPlayer.id)) {
    friends.push(selectedPlayer.id);
    
    // Update friends list
    updateFriendsList();
    
    // Update button text
    document.getElementById('add-friend').textContent = 'Remove Friend';
    document.getElementById('add-friend').classList.add('friend-added');
    
    // Show toast notification instead of alert
    showToast(`${selectedPlayer.name}${selectedPlayer.isBot ? ' (BOT)' : ''} added to friends!`);
  } else {
    // Remove from friends
    const index = friends.indexOf(selectedPlayer.id);
    if (index !== -1) {
      friends.splice(index, 1);
      updateFriendsList();
      
      // Update button text
      document.getElementById('add-friend').textContent = 'Add Friend';
      document.getElementById('add-friend').classList.remove('friend-added');
      
      // Show toast notification
      showToast(`${selectedPlayer.name}${selectedPlayer.isBot ? ' (BOT)' : ''} removed from friends.`);
    }
  }
}

// Show a toast notification
function showToast(message) {
  // Create toast element if it doesn't exist
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    document.body.appendChild(toast);
  }
  
  // Set message and show toast
  toast.textContent = message;
  toast.classList.add('show');
  
  // Hide toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Update friends list
function updateFriendsList() {
  const friendsList = document.getElementById('friends');
  friendsList.innerHTML = '';

  if (friends.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No friends added yet';
    friendsList.appendChild(li);
    return;
  }

  for (const friendId of friends) {
    if (players[friendId]) {
      const li = document.createElement('li');
      li.textContent = players[friendId].name + (players[friendId].isBot ? ' (BOT)' : '');
      
      // Add remove button
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => {
        const index = friends.indexOf(friendId);
        if (index !== -1) {
          friends.splice(index, 1);
          updateFriendsList();
        }
      });
      
      li.appendChild(removeButton);
      friendsList.appendChild(li);
    }
  }
}

// Update player count
function updatePlayerCount() {
  document.getElementById('player-count').textContent = `Players: ${Object.keys(players).length}`;
}

// Request microphone access
async function requestMicrophoneAccess() {
  try {
    // Special handling for iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // Different audio constraints for mobile vs desktop
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };
    
    // iOS Safari needs special handling
    if (isIOS) {
      console.log("iOS device detected, using special audio handling");
      
      // Force audio context to initialize first (iOS requirement)
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Resume audio context - needed for iOS
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
      }
    }
    
    console.log("Requesting microphone access with constraints:", audioConstraints);
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: audioConstraints, 
      video: false 
    });
    
    console.log("Microphone access granted");
    
    // Enable microphone
    isMicEnabled = true;
    document.getElementById('mic-toggle').textContent = 'Disable Microphone';
    document.getElementById('mic-toggle').classList.remove('disabled');
    
    // Set up audio analysis for speaking detection
    setupAudioAnalysis();
    
    // Set up WebRTC connections with existing players
    for (const id in players) {
      if (id !== playerId && !players[id].isBot) {
        setupPeerConnection(id);
      }
    }
  } catch (error) {
    console.error('Error accessing microphone:', error);
    alert('Could not access microphone. Voice chat will be disabled.');
  }
}

// Toggle microphone
function toggleMicrophone() {
  if (isMicEnabled) {
    // Disable microphone
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log(`Stopping track: ${track.kind}`);
        track.stop();
      });
    }
    isMicEnabled = false;
    document.getElementById('mic-toggle').textContent = 'Enable Microphone';
    document.getElementById('mic-toggle').classList.add('disabled');
    
    // Update mobile UI if it exists
    const mobileMicBtn = document.getElementById('mobile-mic-btn');
    if (mobileMicBtn) {
      mobileMicBtn.classList.add('disabled');
    }
    
    // Clean up WebRTC connections
    for (const id in peerConnections) {
      cleanupPeerConnection(id);
    }
    
    console.log("Microphone disabled");
  } else {
    // Re-enable microphone
    requestMicrophoneAccess().then(() => {
      // Update mobile UI if it exists
      const mobileMicBtn = document.getElementById('mobile-mic-btn');
      if (mobileMicBtn) {
        mobileMicBtn.classList.remove('disabled');
      }
    }).catch(error => {
      console.error('Failed to enable microphone:', error);
    });
  }
}

// Set up audio analysis for speaking detection
function setupAudioAnalysis() {
  try {
    // Create audio context if it doesn't exist
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(err => console.error('Failed to resume audio context:', err));
    }
    
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(localStream);
    
    microphone.connect(analyser);
    analyser.fftSize = 256;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Check speaking status periodically
    setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      // Determine if speaking (adjust threshold as needed)
      const newIsSpeaking = average > 30;
      
      // Update speaking status if changed
      if (newIsSpeaking !== isSpeaking) {
        isSpeaking = newIsSpeaking;
        
        // Update UI
        document.getElementById('mic-indicator').classList.toggle('active', isSpeaking);
        
        // Update mobile UI if it exists
        const mobileMicIndicator = document.getElementById('mobile-mic-indicator');
        if (mobileMicIndicator) {
          mobileMicIndicator.classList.toggle('active', isSpeaking);
        }
        
        // Update player state
        if (players[playerId]) {
          players[playerId].isSpeaking = isSpeaking;
          
          // Emit speaking status to server
          socket.emit('speaking', {
            id: playerId,
            isSpeaking
          });
        }
      }
    }, 100);
  } catch (error) {
    console.error('Error setting up audio analysis:', error);
  }
}

// Set up WebRTC peer connection
function setupPeerConnection(peerId) {
  // Skip if it's a bot
  if (players[peerId] && players[peerId].isBot) return;
  
  console.log(`Setting up WebRTC connection with peer: ${peerId}`);
  
  // Create new RTCPeerConnection with more STUN/TURN servers for better connectivity
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  });
  
  // Log connection state changes for debugging
  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state with ${peerId}: ${peerConnection.iceConnectionState}`);
  };
  
  peerConnection.onconnectionstatechange = () => {
    console.log(`Connection state with ${peerId}: ${peerConnection.connectionState}`);
  };
  
  peerConnection.onsignalingstatechange = () => {
    console.log(`Signaling state with ${peerId}: ${peerConnection.signalingState}`);
  };
  
  // Add local stream
  try {
    localStream.getTracks().forEach(track => {
      console.log(`Adding track to peer connection: ${track.kind}`);
      peerConnection.addTrack(track, localStream);
    });
  } catch (error) {
    console.error('Error adding tracks to peer connection:', error);
  }
  
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`Sending ICE candidate to ${peerId}`);
      socket.emit('webrtc-ice-candidate', {
        candidate: event.candidate,
        to: peerId
      });
    }
  };
  
  // Handle incoming tracks
  peerConnection.ontrack = (event) => {
    console.log(`Received track from ${peerId}: ${event.track.kind}`);
    
    // Create audio element for remote stream
    const audio = document.createElement('audio');
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    
    // iOS Safari requires user interaction to play audio
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      // Add to DOM to make it work on iOS
      audio.style.display = 'none';
      document.body.appendChild(audio);
      
      // Try to play with error handling
      audio.play().catch(err => {
        console.warn('Auto-play failed (expected on iOS):', err);
        
        // iOS requires user interaction, we'll try to play when user interacts
        const resumeAudio = () => {
          audio.play().then(() => {
            console.log('Audio playback started after user interaction');
            document.removeEventListener('touchstart', resumeAudio);
            document.removeEventListener('click', resumeAudio);
          }).catch(e => console.error('Still failed to play audio:', e));
        };
        
        document.addEventListener('touchstart', resumeAudio, { once: true });
        document.addEventListener('click', resumeAudio, { once: true });
      });
    }
    
    // Store audio element
    audioElements[peerId] = audio;
    
    // Set initial volume based on distance
    updateAudioVolume(peerId);
  };
  
  // Store peer connection
  peerConnections[peerId] = peerConnection;
  
  // Create and send offer
  peerConnection.createOffer({
    offerToReceiveAudio: true,
    voiceActivityDetection: true
  })
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => {
      console.log(`Sending WebRTC offer to ${peerId}`);
      socket.emit('webrtc-offer', {
        offer: peerConnection.localDescription,
        to: peerId
      });
    })
    .catch(error => console.error('Error creating offer:', error));
}

// Handle WebRTC offer
function handleWebRTCOffer(data) {
  if (!isMicEnabled) {
    console.log(`Received offer from ${data.from} but mic is disabled, ignoring`);
    return;
  }
  
  // Skip if it's from a bot
  if (players[data.from] && players[data.from].isBot) return;
  
  console.log(`Received WebRTC offer from ${data.from}`);
  
  // Create new peer connection if it doesn't exist
  if (!peerConnections[data.from]) {
    setupPeerConnection(data.from);
  }
  
  const peerConnection = peerConnections[data.from];
  
  // Set remote description
  peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
    .then(() => {
      console.log(`Creating answer for ${data.from}`);
      return peerConnection.createAnswer({
        offerToReceiveAudio: true,
        voiceActivityDetection: true
      });
    })
    .then(answer => {
      console.log(`Setting local description (answer) for ${data.from}`);
      return peerConnection.setLocalDescription(answer);
    })
    .then(() => {
      console.log(`Sending WebRTC answer to ${data.from}`);
      socket.emit('webrtc-answer', {
        answer: peerConnection.localDescription,
        to: data.from
      });
    })
    .catch(error => console.error('Error handling offer:', error));
}

// Handle WebRTC answer
function handleWebRTCAnswer(data) {
  // Skip if it's from a bot
  if (players[data.from] && players[data.from].isBot) return;
  
  const peerConnection = peerConnections[data.from];
  
  if (peerConnection) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
      .catch(error => console.error('Error handling answer:', error));
  }
}

// Handle WebRTC ICE candidate
function handleWebRTCIceCandidate(data) {
  // Skip if it's from a bot
  if (players[data.from] && players[data.from].isBot) return;
  
  console.log(`Received ICE candidate from ${data.from}`);
  
  const peerConnection = peerConnections[data.from];
  
  if (peerConnection) {
    try {
      peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
        .then(() => {
          console.log(`Added ICE candidate for ${data.from}`);
        })
        .catch(error => {
          console.error(`Error adding ICE candidate for ${data.from}:`, error);
        });
    } catch (error) {
      console.error(`Error processing ICE candidate for ${data.from}:`, error);
    }
  } else {
    console.warn(`Received ICE candidate for unknown peer: ${data.from}`);
  }
}

// Clean up WebRTC peer connection
function cleanupPeerConnection(peerId) {
  console.log(`Cleaning up peer connection with ${peerId}`);
  
  // Close peer connection
  if (peerConnections[peerId]) {
    try {
      // Remove all tracks
      const senders = peerConnections[peerId].getSenders();
      if (senders && senders.length) {
        senders.forEach(sender => {
          try {
            peerConnections[peerId].removeTrack(sender);
          } catch (e) {
            console.warn(`Error removing track from peer ${peerId}:`, e);
          }
        });
      }
      
      // Close the connection
      peerConnections[peerId].close();
    } catch (e) {
      console.error(`Error closing peer connection with ${peerId}:`, e);
    }
    
    delete peerConnections[peerId];
  }
  
  // Remove audio element
  if (audioElements[peerId]) {
    try {
      if (audioElements[peerId].parentNode) {
        audioElements[peerId].parentNode.removeChild(audioElements[peerId]);
      }
      audioElements[peerId].srcObject = null;
    } catch (e) {
      console.warn(`Error cleaning up audio element for ${peerId}:`, e);
    }
    
    delete audioElements[peerId];
  }
  
  console.log(`Peer connection with ${peerId} cleaned up`);
}

// Update audio volume based on distance
function updateAudioVolume(peerId) {
  if (!players[playerId] || !players[peerId] || !audioElements[peerId]) return;
  
  // Calculate distance between players
  const dx = players[playerId].x - players[peerId].x;
  const dy = players[playerId].y - players[peerId].y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Calculate volume based on distance (quadratic falloff for more natural sound attenuation)
  // This creates a steeper volume drop-off as distance increases
  let volume = 1 - Math.pow(distance / VOICE_MAX_DISTANCE, 2);
  volume = Math.max(0, Math.min(1, volume));
  
  // Apply volume if not muted
  if (!mutedPlayers.includes(peerId)) {
    audioElements[peerId].volume = volume;
  }
}

// Check speaking status
function checkSpeakingStatus() {
  if (!isMicEnabled || !localStream) return;
  
  // Speaking status is updated in the setupAudioAnalysis function
}

// Clean up bot sounds when leaving the game
function cleanupBotSounds() {
  for (const botId in botSounds) {
    if (botSounds[botId]) {
      // Clear any timers
      if (botSounds[botId].playbackTimer) {
        clearInterval(botSounds[botId].playbackTimer);
      }
      
      // Stop audio
      botSounds[botId].audio.pause();
      
      // Close audio context
      if (botSounds[botId].audioContext) {
        botSounds[botId].audioContext.close();
      }
      
      delete botSounds[botId];
    }
  }
}

// Add cleanup to window unload event
window.addEventListener('beforeunload', cleanupBotSounds);

// Start the game
window.addEventListener('load', init);

// Update mini-map
function updateMiniMap() {
  // Clear mini-map
  minimapCtx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  
  // Calculate scale factor
  const scaleX = MINIMAP_SIZE / worldSize.width;
  const scaleY = MINIMAP_SIZE / worldSize.height;
  
  // Draw map regions on mini-map
  for (const region of MAP_REGIONS) {
    const miniX = region.x * scaleX;
    const miniY = region.y * scaleY;
    const miniWidth = region.width * scaleX;
    const miniHeight = region.height * scaleY;
    
    minimapCtx.fillStyle = region.color;
    minimapCtx.fillRect(miniX, miniY, miniWidth, miniHeight);
  }
  
  // Draw region borders
  minimapCtx.strokeStyle = 'rgba(100, 120, 140, 0.8)';
  minimapCtx.lineWidth = 1;
  
  // Vertical region borders
  for (let i = 1; i < 3; i++) {
    const x = (worldSize.width / 3) * i * scaleX;
    minimapCtx.beginPath();
    minimapCtx.moveTo(x, 0);
    minimapCtx.lineTo(x, MINIMAP_SIZE);
    minimapCtx.stroke();
  }
  
  // Horizontal region borders
  for (let i = 1; i < 3; i++) {
    const y = (worldSize.height / 3) * i * scaleY;
    minimapCtx.beginPath();
    minimapCtx.moveTo(0, y);
    minimapCtx.lineTo(MINIMAP_SIZE, y);
    minimapCtx.stroke();
  }
  
  // Draw mini-map border
  minimapCtx.strokeStyle = '#fff';
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  
  // Draw all players on mini-map
  for (const id in players) {
    const player = players[id];
    const miniX = player.x * scaleX;
    const miniY = player.y * scaleY;
    
    // Draw player dot with border for better visibility
    if (id === playerId) {
      // Current player gets a larger dot with a black border
      minimapCtx.beginPath();
      minimapCtx.arc(miniX, miniY, 6, 0, Math.PI * 2);
      minimapCtx.fillStyle = '#00FFFF'; // Bright cyan for high visibility
      minimapCtx.fill();
      minimapCtx.strokeStyle = '#000000';
      minimapCtx.lineWidth = 2;
      minimapCtx.stroke();
    } else {
      // Other players
      minimapCtx.beginPath();
      minimapCtx.arc(miniX, miniY, 3, 0, Math.PI * 2);
      
      // Friends are green, bots are orange, others are their color or default if hiding user info
      if (friends.includes(id)) {
        minimapCtx.fillStyle = '#4CAF50';
      } else if (player.isBot) {
        minimapCtx.fillStyle = '#FF5733';
      } else {
        minimapCtx.fillStyle = hideUserInfo ? '#cccccc' : (player.color || '#cccccc');
      }
      
      minimapCtx.fill();
    }
  }
  
  // Draw viewport rectangle
  const viewX = camera.x * scaleX;
  const viewY = camera.y * scaleY;
  const viewWidth = canvas.width * scaleX;
  const viewHeight = canvas.height * scaleY;
  
  minimapCtx.strokeStyle = '#ffffff';
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(viewX, viewY, viewWidth, viewHeight);
  
  // Draw region name for player's current location
  if (players[playerId]) {
    const playerX = players[playerId].x;
    const playerY = players[playerId].y;
    
    // Find which region the player is in
    for (const region of MAP_REGIONS) {
      if (playerX >= region.x && playerX < region.x + region.width &&
          playerY >= region.y && playerY < region.y + region.height) {
        
        // Draw region name at the top of the mini-map
        minimapCtx.font = '12px Arial';
        minimapCtx.fillStyle = '#ffffff';
        minimapCtx.textAlign = 'center';
        minimapCtx.textBaseline = 'top';
        minimapCtx.fillText(`Location: ${region.name}`, MINIMAP_SIZE / 2, 5);
        break;
      }
    }
  }
}

// Handle mini-map click
function handleMinimapClick(e) {
  // Get click position relative to mini-map
  const rect = minimapCanvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  // Convert mini-map coordinates to world coordinates
  const worldX = (clickX / MINIMAP_SIZE) * worldSize.width;
  const worldY = (clickY / MINIMAP_SIZE) * worldSize.height;
  
  // Move player to that location (with some easing)
  if (players[playerId]) {
    // Calculate direction vector
    const dirX = worldX - players[playerId].x;
    const dirY = worldY - players[playerId].y;
    
    // Normalize and store as target direction
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    
    // Only move if the click is far enough away
    if (length > PLAYER_RADIUS * 2) {
      // Set a target position for smooth movement
      players[playerId].targetX = worldX;
      players[playerId].targetY = worldY;
      
      // Show a toast notification
      showToast("Moving to selected location");
    }
  }
}

// Toggle mini-map visibility
function toggleMiniMap() {
  const miniMap = document.getElementById('mini-map');
  const toggleButton = document.getElementById('toggle-map');
  
  if (miniMap.classList.contains('hidden')) {
    miniMap.classList.remove('hidden');
    toggleButton.textContent = 'Hide Map';
  } else {
    miniMap.classList.add('hidden');
    toggleButton.textContent = 'Show Map';
  }
}

// Set up whiteboard
function setupWhiteboard() {
  const whiteboardContainer = document.getElementById('whiteboard-container');
  const openWhiteboardBtn = document.getElementById('open-whiteboard');
  const closeWhiteboardBtn = document.getElementById('close-whiteboard');
  const clearWhiteboardBtn = document.getElementById('clear-whiteboard');
  const penToolBtn = document.getElementById('pen-tool');
  const eraserToolBtn = document.getElementById('eraser-tool');
  const penColorInput = document.getElementById('pen-color');
  const penSizeSelect = document.getElementById('pen-size');
  
  // Open whiteboard
  openWhiteboardBtn.addEventListener('click', () => {
    whiteboardContainer.classList.remove('hidden');
    resizeCanvas(); // Ensure whiteboard canvas is sized correctly
  });
  
  // Close whiteboard
  closeWhiteboardBtn.addEventListener('click', () => {
    whiteboardContainer.classList.add('hidden');
  });
  
  // Clear whiteboard
  clearWhiteboardBtn.addEventListener('click', () => {
    whiteboardCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    whiteboardData = [];
    
    // Broadcast clear action to all players
    socket.emit('whiteboard-clear');
  });
  
  // Tool selection
  penToolBtn.addEventListener('click', () => {
    currentTool = 'pen';
    penToolBtn.classList.add('active');
    eraserToolBtn.classList.remove('active');
  });
  
  eraserToolBtn.addEventListener('click', () => {
    currentTool = 'eraser';
    eraserToolBtn.classList.add('active');
    penToolBtn.classList.remove('active');
  });
  
  // Color selection
  penColorInput.addEventListener('change', (e) => {
    penColor = e.target.value;
  });
  
  // Size selection
  penSizeSelect.addEventListener('change', (e) => {
    penSize = parseInt(e.target.value);
  });
  
  // Drawing events
  whiteboardCanvas.addEventListener('mousedown', startDrawing);
  whiteboardCanvas.addEventListener('mousemove', draw);
  whiteboardCanvas.addEventListener('mouseup', stopDrawing);
  whiteboardCanvas.addEventListener('mouseout', stopDrawing);
  
  // Touch events for mobile
  whiteboardCanvas.addEventListener('touchstart', handleTouchStart);
  whiteboardCanvas.addEventListener('touchmove', handleTouchMove);
  whiteboardCanvas.addEventListener('touchend', handleTouchEnd);
}

// Set up emotes
function setupEmotes() {
  const emoteMenu = document.getElementById('emote-menu');
  const openEmotesBtn = document.getElementById('open-emotes');
  const emoteButtons = document.querySelectorAll('.emote-btn');
  
  // Hide emote menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!emoteMenu.contains(e.target) && e.target !== openEmotesBtn) {
      emoteMenu.classList.add('hidden');
    }
  });
  
  // Handle emote selection
  emoteButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Stop event propagation
      
      const emote = button.getAttribute('data-emote');
      const emoteSymbol = button.textContent;
      
      // Send emote to server
      socket.emit('player-emote', {
        id: playerId,
        emote: emote,
        symbol: emoteSymbol
      });
      
      // Show emote locally
      showEmote(playerId, emoteSymbol);
      
      // Hide menu after selection
      emoteMenu.classList.add('hidden');
    });
  });
}

// Start drawing on whiteboard
function startDrawing(e) {
  isDrawing = true;
  const rect = whiteboardCanvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
}

// Draw on whiteboard
function draw(e) {
  if (!isDrawing) return;
  
  const rect = whiteboardCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  whiteboardCtx.lineJoin = 'round';
  whiteboardCtx.lineCap = 'round';
  
  if (currentTool === 'pen') {
    whiteboardCtx.strokeStyle = penColor;
    whiteboardCtx.lineWidth = penSize;
    whiteboardCtx.globalCompositeOperation = 'source-over';
  } else if (currentTool === 'eraser') {
    whiteboardCtx.strokeStyle = '#ffffff';
    whiteboardCtx.lineWidth = penSize * 2;
    whiteboardCtx.globalCompositeOperation = 'destination-out';
  }
  
  whiteboardCtx.beginPath();
  whiteboardCtx.moveTo(lastX, lastY);
  whiteboardCtx.lineTo(x, y);
  whiteboardCtx.stroke();
  
  // Store drawing data
  const drawData = {
    tool: currentTool,
    color: penColor,
    size: penSize,
    from: { x: lastX, y: lastY },
    to: { x, y }
  };
  
  // Add to local data
  whiteboardData.push(drawData);
  
  // Send to server
  socket.emit('whiteboard-draw', drawData);
  
  lastX = x;
  lastY = y;
}

// Stop drawing on whiteboard
function stopDrawing() {
  isDrawing = false;
}

// Handle touch start for whiteboard
function handleTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    isDrawing = true;
    const touch = e.touches[0];
    const rect = whiteboardCanvas.getBoundingClientRect();
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
    
    // Create initial dot at touch point
    whiteboardCtx.lineJoin = 'round';
    whiteboardCtx.lineCap = 'round';
    
    if (currentTool === 'pen') {
      whiteboardCtx.strokeStyle = penColor;
      whiteboardCtx.lineWidth = penSize;
      whiteboardCtx.globalCompositeOperation = 'source-over';
    } else if (currentTool === 'eraser') {
      whiteboardCtx.strokeStyle = '#ffffff';
      whiteboardCtx.lineWidth = penSize * 2;
      whiteboardCtx.globalCompositeOperation = 'destination-out';
    }
    
    whiteboardCtx.beginPath();
    whiteboardCtx.arc(lastX, lastY, whiteboardCtx.lineWidth / 2, 0, Math.PI * 2);
    whiteboardCtx.fill();
    
    // Store drawing data for the initial dot
    const drawData = {
      tool: currentTool,
      color: penColor,
      size: penSize,
      dot: { x: lastX, y: lastY }
    };
    
    // Add to local data
    whiteboardData.push(drawData);
    
    // Send to server
    socket.emit('whiteboard-draw', drawData);
  }
}

// Handle touch move for whiteboard
function handleTouchMove(e) {
  e.preventDefault();
  if (!isDrawing) return;
  
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    const rect = whiteboardCanvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    whiteboardCtx.lineJoin = 'round';
    whiteboardCtx.lineCap = 'round';
    
    if (currentTool === 'pen') {
      whiteboardCtx.strokeStyle = penColor;
      whiteboardCtx.lineWidth = penSize;
      whiteboardCtx.globalCompositeOperation = 'source-over';
    } else if (currentTool === 'eraser') {
      whiteboardCtx.strokeStyle = '#ffffff';
      whiteboardCtx.lineWidth = penSize * 2;
      whiteboardCtx.globalCompositeOperation = 'destination-out';
    }
    
    whiteboardCtx.beginPath();
    whiteboardCtx.moveTo(lastX, lastY);
    whiteboardCtx.lineTo(x, y);
    whiteboardCtx.stroke();
    
    // Store drawing data
    const drawData = {
      tool: currentTool,
      color: penColor,
      size: penSize,
      from: { x: lastX, y: lastY },
      to: { x, y }
    };
    
    // Add to local data
    whiteboardData.push(drawData);
    
    // Send to server
    socket.emit('whiteboard-draw', drawData);
    
    lastX = x;
    lastY = y;
  }
}

// Handle touch end for whiteboard
function handleTouchEnd(e) {
  e.preventDefault();
  isDrawing = false;
}

// Redraw whiteboard from stored data
function redrawWhiteboard() {
  whiteboardCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
  
  for (const data of whiteboardData) {
    whiteboardCtx.lineJoin = 'round';
    whiteboardCtx.lineCap = 'round';
    
    if (data.tool === 'pen') {
      whiteboardCtx.strokeStyle = data.color;
      whiteboardCtx.lineWidth = data.size;
      whiteboardCtx.globalCompositeOperation = 'source-over';
    } else if (data.tool === 'eraser') {
      whiteboardCtx.strokeStyle = '#ffffff';
      whiteboardCtx.lineWidth = data.size * 2;
      whiteboardCtx.globalCompositeOperation = 'destination-out';
    }
    
    whiteboardCtx.beginPath();
    whiteboardCtx.moveTo(data.from.x, data.from.y);
    whiteboardCtx.lineTo(data.to.x, data.to.y);
    whiteboardCtx.stroke();
  }
}

// Show emote above player
function showEmote(playerId, emoteSymbol) {
  if (!players[playerId]) return;
  
  // Create emote element
  const emoteElement = document.createElement('div');
  emoteElement.className = 'player-emote';
  emoteElement.textContent = emoteSymbol;
  
  // Position emote above player
  const player = players[playerId];
  const screenX = player.x - camera.x;
  const screenY = player.y - camera.y;
  
  emoteElement.style.left = `${screenX}px`;
  emoteElement.style.top = `${screenY - PLAYER_RADIUS - 30}px`;
  
  // Add to DOM
  document.body.appendChild(emoteElement);
  
  // Remove after animation completes
  setTimeout(() => {
    if (emoteElement.parentNode) {
      emoteElement.parentNode.removeChild(emoteElement);
    }
  }, 2000);
}

// Toggle user info (hide/show names and images)
function toggleUserInfo() {
  hideUserInfo = !hideUserInfo;
  const button = document.getElementById('toggle-user-info');
  
  if (hideUserInfo) {
    button.textContent = 'Show User Info';
    button.classList.add('active');
  } else {
    button.textContent = 'Hide User Info';
    button.classList.remove('active');
  }
}

// Handle player movement
function handlePlayerMovement() {
  if (players[playerId]) {
    let moved = false;
    const player = players[playerId];
    const prevX = player.x;
    const prevY = player.y;
    
    // Initialize velocity if not present
    if (player.velocityX === undefined) {
      player.velocityX = 0;
      player.velocityY = 0;
    }
    
    // Check if we have a target position from mini-map click
    if (player.targetX !== undefined && player.targetY !== undefined) {
      // Calculate direction to target
      const dirX = player.targetX - player.x;
      const dirY = player.targetY - player.y;
      const distance = Math.sqrt(dirX * dirX + dirY * dirY);
      
      // If we're close enough to the target, clear it
      if (distance < MOVEMENT_SPEED) {
        player.targetX = undefined;
        player.targetY = undefined;
      } else {
        // Move towards target with acceleration
        const normalizedDirX = dirX / distance;
        const normalizedDirY = dirY / distance;
        
        player.velocityX += normalizedDirX * ACCELERATION;
        player.velocityY += normalizedDirY * ACCELERATION;
        moved = true;
      }
    } else {
      // Handle keyboard input
      if (keys['w'] || keys['arrowup']) {
        player.velocityY -= ACCELERATION;
        moved = true;
        // Clear any target when using manual movement
        player.targetX = undefined;
        player.targetY = undefined;
      }
      if (keys['s'] || keys['arrowdown']) {
        player.velocityY += ACCELERATION;
        moved = true;
        // Clear any target when using manual movement
        player.targetX = undefined;
        player.targetY = undefined;
      }
      if (keys['a'] || keys['arrowleft']) {
        player.velocityX -= ACCELERATION;
        moved = true;
        // Clear any target when using manual movement
        player.targetX = undefined;
        player.targetY = undefined;
      }
      if (keys['d'] || keys['arrowright']) {
        player.velocityX += ACCELERATION;
        moved = true;
        // Clear any target when using manual movement
        player.targetX = undefined;
        player.targetY = undefined;
      }
      
      // Handle joystick input for mobile
      if (joystickActive && (Math.abs(joystickPosition.x) > 0.1 || Math.abs(joystickPosition.y) > 0.1)) {
        player.velocityX += joystickPosition.x * ACCELERATION * 2; // Slightly stronger for mobile
        player.velocityY += joystickPosition.y * ACCELERATION * 2;
        moved = true;
        // Clear any target when using manual movement
        player.targetX = undefined;
        player.targetY = undefined;
      }
    }
    
    // Apply velocity cap
    player.velocityX = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, player.velocityX));
    player.velocityY = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, player.velocityY));
    
    // Apply velocity to position
    player.x += player.velocityX;
    player.y += player.velocityY;
    
    // Apply friction
    player.velocityX *= FRICTION;
    player.velocityY *= FRICTION;
    
    // Stop completely if velocity is very small
    if (Math.abs(player.velocityX) < 0.01) player.velocityX = 0;
    if (Math.abs(player.velocityY) < 0.01) player.velocityY = 0;
    
    // Keep player within world bounds and handle collisions
    const prevBoundX = player.x;
    const prevBoundY = player.y;
    
    player.x = Math.max(PLAYER_RADIUS, Math.min(worldSize.width - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(worldSize.height - PLAYER_RADIUS, player.y));
    
    // If player hit a boundary, zero out the velocity in that direction
    if (player.x !== prevBoundX) player.velocityX = 0;
    if (player.y !== prevBoundY) player.velocityY = 0;
    
    // Update camera position
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    
    // Emit movement to server if player moved
    if (moved || Math.abs(player.velocityX) > 0.01 || Math.abs(player.velocityY) > 0.01) {
      socket.emit('move', {
        id: playerId,
        x: player.x,
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY
      });
      
      // Update audio volumes for all players
      for (const id in players) {
        if (id !== playerId) {
          if (players[id].isBot) {
            updateBotSoundVolume(id);
          } else {
            updateAudioVolume(id);
          }
        }
      }
    }
  }
}

// Detect if the device supports touch
function detectTouchDevice() {
  isMobileDevice = ('ontouchstart' in window) || 
                   (navigator.maxTouchPoints > 0) || 
                   (navigator.msMaxTouchPoints > 0);
  
  if (isMobileDevice) {
    document.body.classList.add('touch-device');
    document.getElementById('mobile-controls').classList.remove('hidden');
  }
}

// Set up mobile controls
function setupMobileControls() {
  const joystickBase = document.getElementById('joystick-base');
  const joystickThumb = document.getElementById('joystick-thumb');
  
  // Joystick touch events
  joystickBase.addEventListener('touchstart', handleJoystickStart);
  joystickBase.addEventListener('touchmove', handleJoystickMove);
  joystickBase.addEventListener('touchend', handleJoystickEnd);
  
  // Mobile action buttons
  document.getElementById('mobile-emote-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    document.getElementById('emote-menu').classList.remove('hidden');
  });
  
  document.getElementById('mobile-interact-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleMobileInteract();
  });
  
  document.getElementById('mobile-menu-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    toggleMobileMenu();
  });
  
  // Add mobile mic button if not present
  if (!document.getElementById('mobile-mic-btn')) {
    const mobileActionButtons = document.getElementById('mobile-action-buttons');
    const mobileMicBtn = document.createElement('button');
    mobileMicBtn.id = 'mobile-mic-btn';
    mobileMicBtn.className = 'mobile-btn disabled';
    mobileMicBtn.innerHTML = '🎤';
    mobileMicBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      toggleMicrophone();
      
      // On iOS, we need to ensure audio context is resumed on user interaction
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS && audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('Audio context resumed from mobile mic button');
        }).catch(err => {
          console.error('Failed to resume audio context:', err);
        });
      }
    });
    mobileActionButtons.appendChild(mobileMicBtn);
    
    // Add mobile mic status indicator
    const mobileMicIndicator = document.createElement('div');
    mobileMicIndicator.id = 'mobile-mic-indicator';
    mobileMicIndicator.className = 'mobile-mic-indicator';
    document.body.appendChild(mobileMicIndicator);
  }
}

// Handle joystick touch start
function handleJoystickStart(e) {
  e.preventDefault();
  joystickActive = true;
  updateJoystickPosition(e.touches[0]);
}

// Handle joystick touch move
function handleJoystickMove(e) {
  e.preventDefault();
  if (joystickActive) {
    updateJoystickPosition(e.touches[0]);
  }
}

// Handle joystick touch end
function handleJoystickEnd(e) {
  e.preventDefault();
  joystickActive = false;
  resetJoystick();
}

// Update joystick position based on touch
function updateJoystickPosition(touch) {
  const joystickBase = document.getElementById('joystick-base');
  const joystickThumb = document.getElementById('joystick-thumb');
  
  // Get joystick base position and dimensions
  const baseRect = joystickBase.getBoundingClientRect();
  const centerX = baseRect.width / 2;
  const centerY = baseRect.height / 2;
  
  // Calculate touch position relative to joystick base center
  const touchX = touch.clientX - baseRect.left;
  const touchY = touch.clientY - baseRect.top;
  
  // Calculate distance from center
  const deltaX = touchX - centerX;
  const deltaY = touchY - centerY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  // Normalize and limit distance
  if (distance > JOYSTICK_MAX_DISTANCE) {
    const angle = Math.atan2(deltaY, deltaX);
    const limitedX = Math.cos(angle) * JOYSTICK_MAX_DISTANCE;
    const limitedY = Math.sin(angle) * JOYSTICK_MAX_DISTANCE;
    
    joystickThumb.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
    joystickPosition = {
      x: limitedX / JOYSTICK_MAX_DISTANCE,
      y: limitedY / JOYSTICK_MAX_DISTANCE
    };
  } else {
    joystickThumb.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    joystickPosition = {
      x: deltaX / JOYSTICK_MAX_DISTANCE,
      y: deltaY / JOYSTICK_MAX_DISTANCE
    };
  }
}

// Reset joystick to center position
function resetJoystick() {
  const joystickThumb = document.getElementById('joystick-thumb');
  joystickThumb.style.transform = 'translate(0px, 0px)';
  joystickPosition = { x: 0, y: 0 };
}

// Handle mobile interact button
function handleMobileInteract() {
  // Find the closest player to interact with
  if (players[playerId]) {
    let closestPlayer = null;
    let closestDistance = Infinity;
    
    for (const id in players) {
      if (id !== playerId) {
        const dx = players[id].x - players[playerId].x;
        const dy = players[id].y - players[playerId].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < closestDistance && distance < 100) {
          closestDistance = distance;
          closestPlayer = players[id];
        }
      }
    }
    
    if (closestPlayer) {
      selectedPlayer = closestPlayer;
      showPlayerMenu(closestPlayer, window.innerWidth / 2, window.innerHeight / 2);
    }
  }
}

// Toggle mobile menu
function toggleMobileMenu() {
  const gameUI = document.getElementById('game-ui');
  gameUI.classList.toggle('show-mobile-menu');
}

// Check if player has entered a new region
function checkPlayerRegion() {
  if (!players[playerId]) return;
  
  const playerX = players[playerId].x;
  const playerY = players[playerId].y;
  
  // Find which region the player is in
  for (const region of MAP_REGIONS) {
    if (playerX >= region.x && playerX < region.x + region.width &&
        playerY >= region.y && playerY < region.y + region.height) {
      
      // If player has entered a new region, show a notification
      if (!currentRegion || currentRegion.name !== region.name) {
        showToast(`Entered: ${region.name}`);
        currentRegion = region;
      }
      
      return;
    }
  }
} 