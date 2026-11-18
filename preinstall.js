#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Remove package-lock.json and yarn.lock
const filesToRemove = ['package-lock.json', 'yarn.lock'];
filesToRemove.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Removed ${file}`);
  }
});

// Check if pnpm is being used
const userAgent = process.env.npm_config_user_agent;
if (!userAgent || !userAgent.startsWith('pnpm/')) {
  console.error('Please use pnpm instead of npm or yarn');
  process.exit(1);
}
