module.exports = function (api) {
  api.cache(true);
  // Resolve from this package so Metro's Babel worker (often using the monorepo root)
  // still finds babel-preset-expo under pnpm's layout.
  const preset = require.resolve("babel-preset-expo", { paths: [__dirname] });
  return {
    presets: [[preset, { unstable_transformImportMeta: true }]],
  };
};
