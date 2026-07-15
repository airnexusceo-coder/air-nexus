// TypeScript's "@/*" path alias is a compile-time-only feature — plain `tsc`
// emits the `require('@/...')` call unchanged, and plain Node has no idea
// what "@/" means. This tiny require-hook rewrites it to the compiled output
// under .test-build so the standalone (bundler-free) test scripts can run
// lib/market-masters files as-is, without rewriting their imports to relative
// paths just for testability.
/* eslint-disable @typescript-eslint/no-require-imports -- this is a plain CommonJS Node require-hook, loaded via `node -r`, not a bundled/TS module */
const Module = require('node:module')
const path = require('node:path')

const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    const rewritten = path.join(__dirname, '..', '.test-build', request.slice(2))
    return originalResolve.call(this, rewritten, ...rest)
  }
  return originalResolve.call(this, request, ...rest)
}
