const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Include the workspace root so Metro can resolve pnpm-hoisted packages
// in the shared node_modules/.pnpm store.
config.watchFolders = [workspaceRoot];

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ],
  // Stub all @mediapipe packages — we use runtime:"tfjs", not MediaPipe.
  // Metro can't tree-shake require() so it tries to bundle mediapipe detector
  // paths even though they are never called at runtime.
  extraNodeModules: {
    "@mediapipe/face_mesh":      path.resolve(projectRoot, "mocks/empty.js"),
    "@mediapipe/face_detection": path.resolve(projectRoot, "mocks/empty.js"),
  },
  blockList: [
    // Block tmp dirs created by pnpm postinstall scripts (seedrandom, zxing-wasm, etc.)
    /node_modules\/\.pnpm\/.*_tmp_\d+\/.*/,
    /node_modules\/.*_tmp_\d+\/.*/,
  ],
};

module.exports = config;
