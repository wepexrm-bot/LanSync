const readline = require('readline');
const bonjour = require('bonjour')();

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
      const addresses = service.addresses || [];
      const ip = addresses.find((a) => a !== '127.0.0.1' && a !== '::1') || addresses[0] || service.host;
      console.log(`  Found: ${service.name} — http://${ip}:${service.port}`);
    }
  });

  setTimeout(() => {
    browser.stop();

    if (services.length === 0) {
      console.log(`\n  No LAN Sync hosts found via mDNS.`);
      console.log(`  Enter the host's IP address manually, or press Enter to exit.\n`);
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('  Host IP (e.g. 192.168.1.42): ', (ip) => {
        rl.close();
        if (!ip.trim()) {
          console.log('  Cancelled.\n');
          bonjour.destroy();
          process.exit(0);
          return;
        }
        const url = `http://${ip.trim()}:3000`;
        console.log(`\n  Connecting to ${url}`);
        openBrowser(url);
        bonjour.destroy();
        process.exit(0);
      });
      return;
    }

    if (services.length === 1) {
      const s = services[0];
      const addresses = s.addresses || [];
      const ip = addresses.find((a) => a !== '127.0.0.1' && a !== '::1') || addresses[0] || s.host;
      const url = `http://${ip}:${s.port}`;
      console.log(`\n  Connecting to "${s.name}" at ${url}`);
      openBrowser(url);
      bonjour.destroy();
      process.exit(0);
      return;
    }

    console.log(`\n  Multiple hosts found — select one:\n`);
    services.forEach((s, i) => {
      const addresses = s.addresses || [];
      const ip = addresses.find((a) => a !== '127.0.0.1' && a !== '::1') || addresses[0] || s.host;
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
      const addresses = s.addresses || [];
      const ip = addresses.find((a) => a !== '127.0.0.1' && a !== '::1') || addresses[0] || s.host;
      const url = `http://${ip}:${s.port}`;
      console.log(`  Connecting to "${s.name}" at ${url}`);
      openBrowser(url);
      bonjour.destroy();
      process.exit(0);
    });
  }, SCAN_SECONDS * 1000);
}

module.exports = { discover };
