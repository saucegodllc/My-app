const { getDefaultConfig } = require("expo/metro-config");
const http = require("http");
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

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (!req.url?.startsWith("/api/")) {
        return middleware(req, res, next);
      }

      const proxyReq = http.request(
        {
          hostname: "127.0.0.1",
          port: Number(process.env.CONNECTSPHERE_API_PORT || 8080),
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            host: `127.0.0.1:${process.env.CONNECTSPHERE_API_PORT || 8080}`,
          },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );

      proxyReq.on("error", () => {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "ConnectSphere API is not running on port 8080." }));
      });

      req.pipe(proxyReq);
    };
  },
};

module.exports = config;
