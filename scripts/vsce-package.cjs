#!/usr/bin/env node

try {
  const { File, Blob } = require('node:buffer')
  if (typeof globalThis.File === 'undefined' && typeof File !== 'undefined') {
    globalThis.File = File
  }
  if (typeof globalThis.Blob === 'undefined' && typeof Blob !== 'undefined') {
    globalThis.Blob = Blob
  }
} catch (error) {
  console.warn('[vsce-package] Không thể khởi tạo File polyfill:', error)
}

const cliPath = require.resolve('vsce/out/main')
const cliArgs = process.argv.slice(2)

if (cliArgs.length === 0) {
  cliArgs.push('package')
}

process.argv = [process.argv[0], cliPath, ...cliArgs]

const runCli = require(cliPath)
runCli(process.argv)

