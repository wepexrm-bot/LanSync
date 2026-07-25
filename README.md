# LAN Sync

Real-time synced text files across multiple devices on the same local network — no internet, no cloud account, and no Bluetooth needed. Just your WiFi/Ethernet.

One computer runs a small server. Every device — laptops, phones, tablets — opens a web page pointed at that computer's local IP address, and from then on every edit, new file, delete, copy, or rename made on one device appears on all the others within a fraction of a second. The files also live as real `.txt` files on disk, so you can open the `files/` folder directly in a file manager, drag files in or out, or edit with another program — the app picks that up too.

## Requirements

- [Node.js](https://nodejs.org) version 18 or newer, installed on **one** computer (this becomes the "host"). Other devices just need a web browser — nothing to install on them.
- All devices connected to the same WiFi network or router.

## Setup

1. Unzip this folder and open a terminal inside it.
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. You'll see output like:
   ```
   LAN Sync running.
   On this computer:  http://localhost:3000
   From other devices on the same WiFi/network, open:
      http://192.168.1.42:3000
   ```

## Connecting other devices

- On the host computer itself, open `http://localhost:3000`.
- On any other phone, tablet, or laptop **on the same network**, open the `http://192.168.x.x:3000` address shown in the terminal, in any browser.
- That's it — no app install, no pairing, no Bluetooth. As long as a device is on the same WiFi/router, it can connect.

If a firewall prompt appears the first time you run `npm start`, allow the connection — that's what lets other devices on your network reach the server.

## Using it

- **New file** — click "+ New file" in the sidebar, give it a name.
- **Edit** — click a file, start typing. Every other connected device sees your keystrokes live and the file is saved to disk automatically.
- **Duplicate** — copies the currently open file.
- **Rename** — renames the currently open file everywhere.
- **Delete** — removes it for everyone.
- **Copying files in from outside the app** — just drag a `.txt` file into the `files/` folder using your normal file manager (Finder/Explorer). It'll show up in every connected device's file list automatically.

## Notes on how syncing works

- Edits are sent as full file content with a short debounce (~120ms), so two people can type in the same file and both versions merge in near real time. If two people type the exact same region at the exact same instant, the last save wins for that region — this is a lightweight sync model, not full operational-transform collaborative editing.
- The server also watches the `files/` folder on disk directly, so changes made outside the browser (another text editor, a script, copying files in) are detected and pushed to everyone too.
- Everything is local — no data leaves your network, and nothing here talks to Bluetooth or the internet.

## Changing the port

By default the server runs on port 3000. To use a different one:

```
PORT=8080 npm start
```

## Folder structure

```
lan-sync/
  server.js       — the sync server (Node.js/Express/WebSocket + file watcher)
  package.json
  public/         — the web app served to every device
    index.html
    style.css
    client.js
  files/          — your actual synced text files live here
```
