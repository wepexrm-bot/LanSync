#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const pkg = require('./package.json');
const { startServer } = require('./server');
const { discover } = require('./discover');

const HELP = `
LAN Sync v${pkg.version}

USAGE
  lan-sync host [--port <port>] [--password <pw>]
                               Start hosting files on the network
  lan-sync connect             Discover & connect to a host
  lan-sync update              Pull the latest version from GitHub
  lan-sync uninstall           Remove LAN Sync from this computer
  lan-sync --help              Show this help
  lan-sync                     Interactive menu

HOST MODE
  Advertises your shared files/ folder on the LAN.
  Other devices connect via browser — no IP typing needed.
  Use --password to require a password for access.

CONNECT MODE
  Scans the LAN for active LAN Sync hosts and lets you pick one.
`;

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === '--help' || cmd === '-h') {
  console.log(HELP);
  process.exit(0);
}

if (cmd === '--version' || cmd === '-v') {
  console.log(`v${pkg.version}`);
  process.exit(0);
}

if (cmd === 'host') {
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3000;
  const passIdx = args.indexOf('--password');
  if (passIdx !== -1) {
    startServer({ port, password: args[passIdx + 1] || null, advertise: true, openBrowser: true });
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('  Password (leave blank for no auth): ', (pw) => {
      rl.close();
      startServer({ port, password: pw || null, advertise: true, openBrowser: true });
    });
  }
} else if (cmd === 'connect') {
  discover();
} else if (cmd === 'update') {
  update();
} else if (cmd === 'uninstall') {
  uninstall();
} else if (cmd) {
  console.log(`Unknown command: ${cmd}\n`);
  console.log(HELP);
  process.exit(1);
} else {
  interactive();
}

function findGitRoot() {
  const seen = new Set();
  const raw = [
    __dirname,
    process.cwd(),
    path.dirname(require.main.filename),
    fs.realpathSync(__dirname),
  ];
  for (const start of raw) {
    const normalized = path.resolve(start);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    let dir = normalized;
    for (let i = 0; i < 10; i++) {
      if (fs.existsSync(path.join(dir, '.git'))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

function update() {
  const gitRoot = findGitRoot();
  if (!gitRoot) {
    console.log(`\n  Could not find the LanSync source folder.`);
    console.log(`  Navigate to your cloned LanSync directory and run:`);
    console.log(`    git pull && npm install && npm install -g .\n`);
    process.exit(0);
    return;
  }

  console.log(`\n  Updating LAN Sync in ${gitRoot}...\n`);

  try {
    execSync('git fetch origin', { cwd: gitRoot, stdio: 'inherit' });
    execSync('git reset --hard origin/master', { cwd: gitRoot, stdio: 'inherit' });
    console.log('');
    execSync('npm install', { cwd: gitRoot, stdio: 'inherit' });
    console.log('');

    try {
      execSync('npm install -g .', { cwd: gitRoot, stdio: 'inherit' });
      console.log(`\n  LAN Sync updated successfully.\n`);
    } catch {
      console.log(`\n  Source updated. Run "npm install -g ." to update the global command.\n`);
    }
  } catch (err) {
    console.error(`\n  Update failed: ${err.message}\n`);
  }
  process.exit(0);
}

function uninstall() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n  This will remove LAN Sync v${pkg.version} from this computer.\n`);
  rl.question('  Are you sure? (y/N): ', (ans) => {
    rl.close();
    const a = ans.trim().toLowerCase();
    if (a !== 'y' && a !== 'yes') {
      console.log('  Cancelled.\n');
      process.exit(0);
      return;
    }
    try {
      console.log('  Uninstalling...');
      execSync('npm uninstall -g lan-sync', { stdio: 'inherit' });
      console.log('  LAN Sync has been removed.\n');
    } catch (err) {
      console.error('  Uninstall failed:', err.message);
    }
    process.exit(0);
  });
}

function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n  LAN Sync v${pkg.version}`);
  console.log(`  Real-time text sync over your local network\n`);
  console.log(`  ${'1'.padEnd(4)} Host mode — Share your files on the network`);
  console.log(`  ${'2'.padEnd(4)} Connect mode — Discover & connect to a host`);
  console.log(`  ${'3'.padEnd(4)} Update — Pull the latest version from GitHub`);
  console.log(`  ${'4'.padEnd(4)} Uninstall — Remove LAN Sync from this computer`);
  console.log(`  ${'0'.padEnd(4)} Exit\n`);
  rl.question('  Choose: ', (ans) => {
    switch (ans.trim()) {
      case '1': {
        rl.question('  Password (leave blank for no auth): ', (pw) => {
          rl.close();
          startServer({ password: pw || null, advertise: true, openBrowser: true });
        });
        break;
      }
      case '2': rl.close(); return discover();
      case '3': rl.close(); return update();
      case '4': rl.close(); return uninstall();
      default: rl.close(); process.exit(0);
    }
  });
}
