// No config-time dependencies: avoids Vite's Windows `net use` probe in
// restricted environments. Threads also avoid spawning child processes.
module.exports = {
  resolve: { alias: {
    "@": `${process.cwd()}/src`,
    "server-only": `${process.cwd()}/node_modules/next/dist/compiled/server-only/empty.js`,
  } },
  test: { environment: "node", pool: "threads", testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
};
