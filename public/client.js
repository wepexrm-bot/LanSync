(() => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const fileListEl = document.getElementById('fileList');
  const editor = document.getElementById('editor');
  const currentFileName = document.getElementById('currentFileName');
  const editorActions = document.getElementById('editorActions');
  const newFileBtn = document.getElementById('newFileBtn');
  const renameBtn = document.getElementById('renameBtn');
  const copyBtn = document.getElementById('copyBtn');
  const deleteBtn = document.getElementById('deleteBtn');

  let ws;
  let files = [];
  let currentFile = null;
  let suppressNextInput = false; // true while we're programmatically updating the textarea
  let editTimer = null;

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);

    ws.addEventListener('open', () => {
      statusDot.classList.add('connected');
      statusText.textContent = 'connected — syncing live';
    });

    ws.addEventListener('close', () => {
      statusDot.classList.remove('connected');
      statusText.textContent = 'disconnected — retrying…';
      setTimeout(connect, 1500);
    });

    ws.addEventListener('error', () => ws.close());

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    });
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'file-list': {
        files = msg.files;
        renderFileList();
        // if the currently open file got deleted elsewhere, close it
        if (currentFile && !files.some((f) => f.name === currentFile)) {
          closeEditor();
        }
        if (msg.renamedFrom && currentFile === msg.renamedFrom) {
          currentFile = msg.renamedTo;
          currentFileName.textContent = currentFile;
        }
        break;
      }
      case 'file-content': {
        if (msg.name === currentFile) {
          applyRemoteContent(msg.content);
        }
        break;
      }
      case 'edit': {
        if (msg.name === currentFile) {
          applyRemoteContent(msg.content);
        }
        break;
      }
    }
  }

  function applyRemoteContent(content) {
    if (editor.value === content) return;
    const { selectionStart, selectionEnd } = editor;
    const lenDiff = content.length - editor.value.length;
    suppressNextInput = true;
    editor.value = content;
    // best-effort cursor preservation for the common "someone typed near the end" case
    const newPos = Math.max(0, selectionStart + lenDiff);
    try {
      editor.setSelectionRange(newPos, Math.max(newPos, selectionEnd + lenDiff));
    } catch {}
    suppressNextInput = false;
  }

  function renderFileList() {
    fileListEl.innerHTML = '';
    files.forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f.name;
      li.className = f.name === currentFile ? 'active' : '';
      li.addEventListener('click', () => openFile(f.name));
      fileListEl.appendChild(li);
    });
  }

  function openFile(name) {
    currentFile = name;
    currentFileName.textContent = name;
    editorActions.style.display = 'flex';
    editor.disabled = false;
    editor.value = '';
    renderFileList();
    ws.send(JSON.stringify({ type: 'request-file', name }));
  }

  function closeEditor() {
    currentFile = null;
    currentFileName.textContent = 'No file open';
    editorActions.style.display = 'none';
    editor.disabled = true;
    editor.value = '';
    renderFileList();
  }

  editor.addEventListener('input', () => {
    if (suppressNextInput || !currentFile) return;
    if (editTimer) clearTimeout(editTimer);
    editTimer = setTimeout(() => {
      ws.send(JSON.stringify({ type: 'edit', name: currentFile, content: editor.value }));
    }, 120); // small debounce so every keystroke doesn't flood the socket
  });

  newFileBtn.addEventListener('click', () => {
    const name = prompt('New file name (e.g. notes.txt):');
    if (!name) return;
    ws.send(JSON.stringify({ type: 'create', name }));
    setTimeout(() => openFile(name), 200);
  });

  renameBtn.addEventListener('click', () => {
    if (!currentFile) return;
    const to = prompt('Rename to:', currentFile);
    if (!to || to === currentFile) return;
    ws.send(JSON.stringify({ type: 'rename', from: currentFile, to }));
  });

  copyBtn.addEventListener('click', () => {
    if (!currentFile) return;
    ws.send(JSON.stringify({ type: 'copy', from: currentFile, to: currentFile }));
  });

  deleteBtn.addEventListener('click', () => {
    if (!currentFile) return;
    if (!confirm(`Delete "${currentFile}"? This removes it for everyone.`)) return;
    ws.send(JSON.stringify({ type: 'delete', name: currentFile }));
    closeEditor();
  });

  connect();
})();
