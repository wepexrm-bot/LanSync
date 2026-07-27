# LAN Sync

> **If devices can't connect:** check your firewall — it must allow inbound TCP connections on port 3000 (or the port you're using). On Windows, allow Node.js through the firewall when prompted, or add a rule manually. On Linux, run `sudo ufw allow 3000`.

Real-time synced text files across multiple devices on the same local network — no internet, no cloud account, and no Bluetooth needed. Just your WiFi/Ethernet.

One computer runs a small server. Every device — laptops, phones, tablets — opens the web page and from then on every edit, new file, delete, copy, or rename made on one device appears on all the others within a fraction of a second. The files also live as real `.txt` files on disk, so you can open the `files/` folder directly in a file manager, drag files in or out, or edit with another program — the app picks that up too.

## Requirements

- [Node.js](https://nodejs.org) version 18 or newer, installed on **one** computer (this becomes the "host"). Other devices just need a web browser — nothing to install on them.
- All devices connected to the same WiFi network or router.

## Install

### Option 1 — Global CLI install (recommended)

Lets you run `lan-sync` from any terminal.

```
git clone https://github.com/wepexrm-bot/LanSync.git
cd LanSync
npm install
npm install -g .
```

Now `lan-sync` is available everywhere:

```
lan-sync              interactive menu
lan-sync host         host mode
lan-sync connect      connect mode
```

> **Windows users:** npm creates a `lan-sync.cmd` wrapper automatically. Run PowerShell as Administrator if you get permission errors.

### Option 2 — Run locally (no global install)

```
git clone https://github.com/wepexrm-bot/LanSync.git
cd LanSync
npm install
node cli.js host
```

## Usage

### Host mode (Computer A)

```
lan-sync host [--password <pw>]
```

- Starts the server and advertises itself on the network via mDNS (zero-config).
- Use `--password` to require a password for access (recommended on shared networks).
- Your browser opens automatically to `http://localhost:3000`.
- Other devices on the same network can now discover and connect to you.

```
  LAN Sync v2.1.0
  Hosting on port 3000
  Local:    http://localhost:3000
  Network:  http://192.168.1.42:3000
  mDNS:     Advertised as "LAN Sync — My-Computer"
  Connected devices: 0
```

### Connect mode (Computer B, C, etc.)

```
lan-sync connect
```

- Scans the LAN for active LAN Sync hosts (4-second scan).
- If one host is found, it auto-connects and opens the browser.
- If multiple hosts are found, shows a picker.

```
  Scanning for LAN Sync hosts on your network... (4s)
  Found: LAN Sync — My-Computer — http://192.168.1.42:3000
  Connecting to "LAN Sync — My-Computer"...
```

### Browser only (no CLI needed)

If you don't have Node.js on the client device, just open the host's URL in any browser — works on phones, tablets, laptops, etc.

### Interactive menu

```
lan-sync
```

Shows a numbered menu where you can pick host, connect, or uninstall.

## Using the web app

- **New file** — click "+ New file" in the sidebar, give it a name.
- **Edit** — click a file, start typing. Every other connected device sees your keystrokes live, and the file is saved to disk automatically.
- **Duplicate** — copies the currently open file.
- **Rename** — renames the currently open file everywhere.
- **Delete** — removes it for everyone.
- **Drag files from your OS** — drag a `.txt` file into the `files/` folder using your file manager. It shows up on every connected device instantly.

## Update

Pull the latest version from GitHub from anywhere:

```
lan-sync update
```

It finds your cloned repo automatically (checks the script location and current directory), then runs `git pull`, `npm install`, and re-registers the global command.

> **Note:** `lan-sync update` runs `git reset --hard origin/master` which discards any local changes in the cloned repo. Make sure you don't have uncommitted work there before running it.

> **First-time update from an older version:** if `lan-sync update` doesn't exist yet on your machine, update manually once:
> ```
> cd LanSync
> git pull && npm install && npm install -g .
> ```
> After that, `lan-sync update` works for all future updates.

## Uninstall

```
lan-sync uninstall
```

Or manually:

```
npm uninstall -g lan-sync
```

## Changing the port

```
lan-sync host --port 8080
```

Or with an environment variable:

```
PORT=8080 lan-sync host
```

## Security notes

- **Password is sent in plaintext** over WebSocket (`ws://`) with no TLS encryption. Anyone on the same network with a packet sniffer (Wireshark) can read it. The password is meant for **casual access control** on shared WiFi, not for security against a determined attacker.
- **No authentication** when running without `--password` — anyone on the LAN can access all files.
- **Only use on trusted networks** — home WiFi or a dedicated LAN. Avoid public/cafe WiFi unless you have a firewall isolating your devices.

## How it works

- **Edits** are sent as full file content with a short debounce (~120ms), so edits merge in near real time. If two people type in the same region at the same instant, the last save wins — this is a lightweight sync model, not operational-transform.
- **mDNS (Bonjour)** is used for zero-config discovery on the LAN — no need to type IP addresses.
- The server also watches the `files/` folder on disk directly, so changes made outside the browser (another text editor, a script, copying files in) are detected and pushed to everyone.
- **Everything is local** — no data leaves your network.

## Folder structure

```
lan-sync/
  cli.js          — CLI entry point (lan-sync command)
  server.js       — Express + WebSocket + file watcher
  discover.js     — mDNS discovery for connect mode
  package.json
  public/         — web app served to every device
    index.html
    style.css
    client.js
  files/          — your synced text files live here (created in current directory)
```

## License

This project is dedicated to the public domain under the [Unlicense](https://unlicense.org). See `LICENSE` for details.
