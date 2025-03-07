/**
 * Easy start script for Hangout Voice Game
 * This script checks if dependencies are installed and starts the server
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════╗
║                                               ║
║           HANGOUT VOICE GAME STARTER          ║
║                                               ║
╚═══════════════════════════════════════════════╝
${colors.reset}`);

// Check if node_modules directory exists
console.log(`${colors.yellow}Checking dependencies...${colors.reset}`);
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log(`${colors.yellow}Installing dependencies...${colors.reset}`);
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log(`${colors.green}Dependencies installed successfully!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Failed to install dependencies. Please run 'npm install' manually.${colors.reset}`);
    process.exit(1);
  }
} else {
  console.log(`${colors.green}Dependencies already installed.${colors.reset}`);
}

// Function to open browser
function openBrowser(url) {
  let command;
  switch (process.platform) {
    case 'darwin': // macOS
      command = `open ${url}`;
      break;
    case 'win32': // Windows
      command = `start ${url}`;
      break;
    default: // Linux and others
      command = `xdg-open ${url}`;
      break;
  }
  
  exec(command, (error) => {
    if (error) {
      console.log(`${colors.yellow}Could not open browser automatically. Please open ${url} manually.${colors.reset}`);
    }
  });
}

// Start the server
console.log(`${colors.yellow}Starting the server...${colors.reset}`);
try {
  // Use npx to run nodemon if available, otherwise use node directly
  const hasNodemon = fs.existsSync(path.join(__dirname, 'node_modules', 'nodemon'));
  
  let command, args;
  if (hasNodemon) {
    console.log(`${colors.blue}Starting in development mode with nodemon...${colors.reset}`);
    command = 'npx';
    args = ['nodemon', 'server/index.js'];
  } else {
    console.log(`${colors.blue}Starting in production mode...${colors.reset}`);
    command = 'node';
    args = ['server/index.js'];
  }
  
  // Start the server process
  const serverProcess = require('child_process').spawn(command, args, { 
    stdio: 'inherit', 
    shell: true 
  });
  
  console.log(`${colors.green}Server started successfully!${colors.reset}`);
  console.log(`${colors.magenta}Opening browser to: ${colors.bright}http://localhost:3000${colors.reset}`);
  
  // Wait a moment for the server to start before opening the browser
  setTimeout(() => {
    openBrowser('http://localhost:3000');
  }, 2000);
  
  // Handle server process events
  serverProcess.on('error', (error) => {
    console.error(`${colors.red}Server error: ${error.message}${colors.reset}`);
  });
  
  serverProcess.on('close', (code) => {
    if (code !== 0) {
      console.log(`${colors.red}Server process exited with code ${code}${colors.reset}`);
    }
  });
} catch (error) {
  console.error(`${colors.red}Failed to start the server: ${error.message}${colors.reset}`);
  process.exit(1);
} 