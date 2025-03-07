/**
 * Simple start script for Hangout Voice Game
 * This script checks if dependencies are installed and starts the server
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("Starting Hangout Voice Game...");

// Check if node_modules directory exists
console.log("Checking dependencies...");
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log("Installing dependencies...");
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log("Dependencies installed successfully!");
  } catch (error) {
    console.error("Failed to install dependencies. Please run 'npm install' manually.");
    process.exit(1);
  }
} else {
  console.log("Dependencies already installed.");
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
      console.log(`Could not open browser automatically. Please open ${url} manually.`);
    }
  });
}

// Start the server
console.log("Starting the server...");
try {
  // Always use node directly for simplicity
  const serverProcess = require('child_process').spawn('node', ['server/index.js'], { 
    stdio: 'inherit', 
    shell: true 
  });
  
  console.log("Server started successfully!");
  console.log("Opening browser to: http://localhost:3000");
  
  // Wait a moment for the server to start before opening the browser
  setTimeout(() => {
    openBrowser('http://localhost:3000');
  }, 2000);
  
  // Handle server process events
  serverProcess.on('error', (error) => {
    console.error(`Server error: ${error.message}`);
  });
  
  serverProcess.on('close', (code) => {
    if (code !== 0) {
      console.log(`Server process exited with code ${code}`);
    }
  });
} catch (error) {
  console.error(`Failed to start the server: ${error.message}`);
  process.exit(1);
} 