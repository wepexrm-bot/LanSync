#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const os = require('os');

const pkg = require('./package.json');
const { startServer } = require('./server');
const { discover } = require('./discover');

const HELP = `
LAN Sync v${pkg.version}

USAGE
  lan-sync host [--port <port>]     Start hosting files on the network
  lan-sync connect                  Discover & connect to a host
  lan-sync --help                   Show this help
  lan-sync                          Interactive menu

HOST MODE
  Advertises your shared files/ folder on the LAN.
  Other devices can connect via browser — no IP typing needed.

CONNECT MODE
  Scans the LAN for active LAN Sync hosts and lets you pick one.
`;

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === '--help' || cmd === '-h') {
  console.log(HELP);
  process.exit(0);
}

if (cmd === 'host') {
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3000;
  startServer({ port, advertise: true, openBrowser: true });
} else if (cmd === 'connect') {
  discover();
} else if (cmd) {
  console.log(`Unknown command: ${cmd}\n`);
  console.log(HELP);
  process.exit(1);
} else {
  interactive();
}

function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n  LAN Sync v${pkg.version}`);
  console.log(`  Real-time text sync over your local network\n`);
  console.log(`  ${'1'.padEnd(4)} Host mode — Share your files on the network`);
  console.log(`  ${'2'.padEnd(4)} Connect mode — Discover & connect to a host`);
  console.log(`  ${'0'.padEnd(4)} Exit\n`);
  rl.question('  Choose: ', (ans) => {
    rl.close();
    switch (ans.trim()) {
      case '1': return startServer({ advertise: true, openBrowser: true });
      case '2': return discover();
      default: process.exit(0);
    }
  });
}
