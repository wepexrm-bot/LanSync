const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');
const os = require('os');
const bonjour = require('bonjour')();

const FILES_DIR = path.join(process.cwd(), 'files');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

function safeName(name) {
  const base = path.basename(String(name || ''));
  if (!base || base === '.' || base === '..') return null;
  return base;
}

function filePath(name) {
  return path.join(FILES_DIR, name);
}

async function listFiles() {
  const entries = await fsp.readdir(FILES_DIR, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isFile()) {
      const stat = await fsp.stat(filePath(e.name));
      files.push({ name: e.name, mtime: stat.mtimeMs, size: stat.size });
    }
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}

function broadcast(wss, msg, exclude) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === 1 && client.authenticated !== false) {
      client.send(data);
    }
  });
}

const recentWrites = new Map();
function markOwnWrite(name) {
  recentWrites.set(name, Date.now());
}
function wasOwnWrite(name) {
  const t = recentWrites.get(name);
  if (t && Date.now() - t < 1500) return true;
  return false;
}

const writeTimers = new Map();
function scheduleWrite(name, content) {
  markOwnWrite(name);
  if (writeTimers.has(name)) clearTimeout(writeTimers.get(name));
  const t = setTimeout(async () => {
    writeTimers.delete(name);
    try {
      markOwnWrite(name);
      await fsp.writeFile(filePath(name), content, 'utf8');
    } catch (err) {
      console.error('write error', name, err.message);
    }
  }, 250);
  writeTimers.set(name, t);
}

function localIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

function openBrowser(url) {
  const { execSync } = require('child_process');
  try {
    if (process.platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore', timeout: 5000 });
    } else if (process.platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore', timeout: 5000 });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore', timeout: 5000 });
    }
  } catch {}
}

function startServer(opts = {}) {
  const PORT = opts.port || parseInt(process.env.PORT, 10) || 3000;
  const password = opts.password || null;
  const doAdvertise = opts.advertise !== false;
  const doOpenBrowser = opts.openBrowser === true;

  const app = express();
  app.use(express.static(PUBLIC_DIR));
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    ws.id = Math.random().toString(36).slice(2, 9);
    ws.authenticated = !password;
    console.log(`+ device connected (${ws.id}) from ${req.socket.remoteAddress}`);

    if (password) {
      ws.send(JSON.stringify({ type: 'auth-required' }));
    } else {
      listFiles().then((files) => ws.send(JSON.stringify({ type: 'file-list', files })));
    }

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (!ws.authenticated) {
        if (msg.type === 'auth' && msg.password === password) {
          ws.authenticated = true;
          ws.send(JSON.stringify({ type: 'auth-ok' }));
          const files = await listFiles();
          ws.send(JSON.stringify({ type: 'file-list', files }));
        } else {
          ws.send(JSON.stringify({ type: 'auth-error', message: 'Wrong password' }));
          ws.close();
        }
        return;
      }

      try {
        switch (msg.type) {
          case 'request-file': {
            const name = safeName(msg.name);
            if (!name) return;
            let content = '';
            try {
              content = await fsp.readFile(filePath(name), 'utf8');
            } catch {
              content = '';
            }
            ws.send(JSON.stringify({ type: 'file-content', name, content }));
            break;
          }

          case 'edit': {
            const name = safeName(msg.name);
            if (!name) return;
            scheduleWrite(name, msg.content ?? '');
            broadcast(wss, { type: 'edit', name, content: msg.content ?? '', from: ws.id }, ws);
            break;
          }

          case 'create': {
            const name = safeName(msg.name);
            if (!name) return;
            const p = filePath(name);
            if (!fs.existsSync(p)) {
              markOwnWrite(name);
              await fsp.writeFile(p, '', 'utf8');
            }
            const files = await listFiles();
            broadcast(wss, { type: 'file-list', files });
            break;
          }

          case 'delete': {
            const name = safeName(msg.name);
            if (!name) return;
            const p = filePath(name);
            markOwnWrite(name);
            if (fs.existsSync(p)) await fsp.unlink(p);
            const files = await listFiles();
            broadcast(wss, { type: 'file-list', files });
            break;
          }

          case 'copy': {
            const from = safeName(msg.from);
            let to = safeName(msg.to);
            if (!from || !to) return;
            const fromPath = filePath(from);
            if (!fs.existsSync(fromPath)) return;
            let candidate = to;
            let i = 1;
            while (fs.existsSync(filePath(candidate))) {
              const ext = path.extname(to);
              const base = path.basename(to, ext);
              candidate = `${base} (${i})${ext}`;
              i++;
            }
            markOwnWrite(candidate);
            await fsp.copyFile(fromPath, filePath(candidate));
            const files = await listFiles();
            broadcast(wss, { type: 'file-list', files });
            break;
          }

          case 'rename': {
            const from = safeName(msg.from);
            const to = safeName(msg.to);
            if (!from || !to) return;
            const fromPath = filePath(from);
            const toPath = filePath(to);
            if (!fs.existsSync(fromPath) || fs.existsSync(toPath)) return;
            markOwnWrite(from);
            markOwnWrite(to);
            await fsp.rename(fromPath, toPath);
            const files = await listFiles();
            broadcast(wss, { type: 'file-list', files, renamedFrom: from, renamedTo: to });
            break;
          }
        }
      } catch (err) {
        console.error('message handling error:', err.message);
      }
    });

    ws.on('close', () => {
      console.log(`- device disconnected (${ws.id})`);
    });
  });

  const watcher = chokidar.watch(FILES_DIR, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  watcher.on('add', async (fullPath) => {
    const name = path.basename(fullPath);
    if (wasOwnWrite(name)) return;
    console.log('external add:', name);
    const files = await listFiles();
    broadcast(wss, { type: 'file-list', files });
  });

  watcher.on('change', async (fullPath) => {
    const name = path.basename(fullPath);
    if (wasOwnWrite(name)) return;
    console.log('external change:', name);
    try {
      const content = await fsp.readFile(fullPath, 'utf8');
      broadcast(wss, { type: 'edit', name, content, from: 'external' });
    } catch (err) {
      console.error(err.message);
    }
  });

  watcher.on('unlink', async (fullPath) => {
    const name = path.basename(fullPath);
    if (wasOwnWrite(name)) return;
    console.log('external delete:', name);
    const files = await listFiles();
    broadcast(wss, { type: 'file-list', files });
  });

  let bonjourService = null;

  server.listen(PORT, '0.0.0.0', () => {
    const hostname = os.hostname();
    const ips = localIPs();

    console.log(`\n  LAN Sync v${require('./package.json').version}`);
    console.log(`  Hosting on port ${PORT}`);
    if (password) console.log(`  Auth:     Password required`);
    console.log(`  Local:    http://localhost:${PORT}`);
    ips.forEach((ip) => console.log(`  Network:  http://${ip}:${PORT}`));

    if (doAdvertise) {
      const serviceName = `LAN Sync — ${hostname}`;
      bonjourService = bonjour.publish({
        name: serviceName,
        type: 'lan-sync',
        port: PORT,
        protocol: 'tcp',
        txt: { hostname },
      });
      console.log(`  mDNS:     Advertised as "${serviceName}"`);
      console.log(`  Others can now discover you via "lan-sync connect"`);
    }

    if (doOpenBrowser) {
      openBrowser(`http://localhost:${PORT}`);
    }

    console.log(`\n  Connected devices: 0`);
  });

  let countInterval = setInterval(() => {
    const count = wss.clients.size;
    process.stdout.write(`\r  Connected devices: ${count}    `);
  }, 1000);

  process.on('SIGINT', () => {
    console.log('\n  Shutting down...');
    clearInterval(countInterval);
    watcher.close();
    if (bonjourService) bonjourService.stop();
    bonjour.destroy();
    server.close(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    clearInterval(countInterval);
    watcher.close();
    if (bonjourService) bonjourService.stop();
    bonjour.destroy();
    server.close(() => process.exit(0));
  });

  return server;
}

module.exports = { startServer };

if (require.main === module) {
  startServer({ advertise: true, openBrowser: true });
}
