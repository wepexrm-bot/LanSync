const readline = require('readline');
const bonjour = require('bonjour')();

function pickBestIP(addresses) {
  if (!addresses || addresses.length === 0) return null;
  const rfc1918 = addresses.filter((a) => {
    const parts = a.split('.').map(Number);
    if (parts.length !== 4) return false;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  });
  if (rfc1918.length > 0) return rfc1918[0];
  return addresses.find((a) => a !== '127.0.0.1' && a !== '::1') || addresses[0];
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

function discover() {
  const SCAN_SECONDS = 4;
  const services = [];

  console.log(`\n  Scanning for LAN Sync hosts on your network... (${SCAN_SECONDS}s)`);

  const browser = bonjour.find({ type: 'lan-sync' }, (service) => {
    const existing = services.find((s) => s.name === service.name && s.host === service.host);
    if (!existing) {
      services.push(service);
      const ip = pickBestIP(service.addresses) || service.host;
      console.log(`  Found: ${service.name} — http://${ip}:${service.port}`);
    }
  });

  setTimeout(() => {
    browser.stop();

    if (services.length === 0) {
      console.log(`\n  No LAN Sync hosts found via mDNS.`);
      console.log(`  Enter the host's IP address manually, or press Enter to exit.\n`);
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('  Host IP (e.g. 192.168.1.42 or 192.168.1.42:8080): ', (ip) => {
        rl.close();
        if (!ip.trim()) {
          console.log('  Cancelled.\n');
          bonjour.destroy();
          process.exit(0);
          return;
        }
        const parts = ip.trim().split(':');
        const host = parts[0];
        const port = parts[1] || '3000';
        const url = `http://${host}:${port}`;
        console.log(`\n  Connecting to ${url}`);
        openBrowser(url);
        bonjour.destroy();
        process.exit(0);
      });
      return;
    }

    if (services.length === 1) {
      const s = services[0];
      const ip = pickBestIP(s.addresses) || s.host;
      const url = `http://${ip}:${s.port}`;
      console.log(`\n  Connecting to "${s.name}" at ${url}`);
      openBrowser(url);
      bonjour.destroy();
      process.exit(0);
      return;
    }

    console.log(`\n  Multiple hosts found — select one:\n`);
    services.forEach((s, i) => {
      const ip = pickBestIP(s.addresses) || s.host;
      console.log(`  ${i + 1}. ${s.name} — http://${ip}:${s.port}`);
    });
    console.log(`  0. Cancel\n`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('  Select: ', (ans) => {
      rl.close();
      const idx = parseInt(ans.trim(), 10);
      if (isNaN(idx) || idx < 1 || idx > services.length) {
        console.log('  Cancelled.\n');
        bonjour.destroy();
        process.exit(0);
        return;
      }
      const s = services[idx - 1];
      const ip = pickBestIP(s.addresses) || s.host;
      const url = `http://${ip}:${s.port}`;
      console.log(`  Connecting to "${s.name}" at ${url}`);
      openBrowser(url);
      bonjour.destroy();
      process.exit(0);
    });
  }, SCAN_SECONDS * 1000);
}

module.exports = { discover };
