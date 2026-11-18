const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Workaround for Windows lightningcss binary issue
// Treat CSS files as static assets to skip transformation
if (config.resolver && config.resolver.assetExts) {
  config.resolver.assetExts.push("css", "scss", "sass");
}

// Workaround for native modules (better-sqlite3, @noble/ciphers, react-native-ble-plx, expo-av)
// Metro file watcher tries to monitor temporary build directories, which causes crashes
if (config.watchman && config.watchman.ignoredPatterns) {
  // Ignore all temporary build directories from native modules
  config.watchman.ignoredPatterns.push(
    ".*_tmp_.*",
    ".*\\.tmp.*",
    ".*/node_modules/.*\\.o$",
    ".*/node_modules/.*\\.a$",
    ".*/node_modules/better-sqlite3.*",
    ".*/node_modules/@noble.*",
    ".*/node_modules/expo-av.*",
    ".*/node_modules/react-native-nitro-sound.*",
  );
} else if (!config.watchman) {
  config.watchman = {
    ignoredPatterns: [
      ".*_tmp_.*",
      ".*\\.tmp.*",
      ".*/node_modules/.*\\.o$",
      ".*/node_modules/.*\\.a$",
      ".*/node_modules/better-sqlite3.*",
      ".*/node_modules/@noble.*",
      ".*/node_modules/expo-av.*",
      ".*/node_modules/react-native-nitro-sound.*",
    ],
  };
}

module.exports = config;

