// Side panel UI logic — auth flow, message passing, live updates

// ── DOM refs ──

const authStatus = document.getElementById('auth-status');
const authBtn = document.getElementById('auth-btn');
const taskInput = document.getElementById('task-input');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const resultBanner = document.getElementById('result-banner');
const resultValue = document.getElementById('result-value');
const screenshotImg = document.getElementById('screenshot-img');
const logContainer = document.getElementById('log-container');

let isAuthenticated = false;

// ── Auth ──

async function checkAuth() {
  const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' });
  isAuthenticated = response.loggedIn;
  updateAuthUI();
}

function updateAuthUI() {
  if (isAuthenticated) {
    authStatus.textContent = 'Connected to ChatGPT';
    authStatus.className = 'auth-status connected';
    authBtn.textContent = 'Logout';
    authBtn.className = 'auth-btn logout';
    startBtn.disabled = false;
  } else {
    authStatus.textContent = 'Not connected';
    authStatus.className = 'auth-status';
    authBtn.textContent = 'Login with ChatGPT';
    authBtn.className = 'auth-btn login';
    startBtn.disabled = true;
  }
}

async function handleAuth() {
  if (isAuthenticated) {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    isAuthenticated = false;
    updateAuthUI();
  } else {
    authBtn.disabled = true;
    authBtn.textContent = 'Logging in...';
    const result = await chrome.runtime.sendMessage({ type: 'LOGIN' });
    authBtn.disabled = false;
    if (result.ok) {
      isAuthenticated = true;
    } else {
      addLog(0, `Login failed: ${result.error}`, true);
    }
    updateAuthUI();
  }
}

// ── Agent control ──

function startAgent() {
  const task = taskInput.value.trim();
  if (!task) {
    taskInput.focus();
    return;
  }

  // Clear previous state
  logContainer.innerHTML = '';
  resultBanner.classList.remove('visible');
  screenshotImg.classList.remove('visible');

  // Update UI
  startBtn.disabled = true;
  stopBtn.disabled = false;
  taskInput.disabled = true;
  setStatus('running', 'Starting agent...');

  chrome.runtime.sendMessage({ type: 'START_AGENT', task });
}

function stopAgent() {
  chrome.runtime.sendMessage({ type: 'STOP_AGENT' });
  stopBtn.disabled = true;
  setStatus('stopped', 'Stopping...');
}

// ── Status & logging ──

function setStatus(state, message) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = message;
}

function addLog(step, message, isError = false) {
  const entry = document.createElement('div');
  entry.className = `log-entry${isError ? ' error' : ''}`;
  entry.innerHTML = `
    <span class="step">${step || ''}</span>
    <span class="msg">${escapeHtml(message)}</span>
  `;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showResult(result) {
  resultBanner.classList.add('visible');

  // Auto-link URLs in result
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const html = escapeHtml(result).replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
  resultValue.innerHTML = html;
}

// ── Message listener from background ──

chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'LOG':
      addLog(message.step, message.message, message.error);
      break;

    case 'SCREENSHOT':
      screenshotImg.src = `data:image/jpeg;base64,${message.data}`;
      screenshotImg.classList.add('visible');
      break;

    case 'STATUS':
      setStatus(message.status, message.message);

      if (message.status === 'done' || message.status === 'error' || message.status === 'stopped') {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        taskInput.disabled = false;
      }

      if (message.result) {
        showResult(message.result);
      }
      break;
  }
});

// ── Keyboard shortcut ──

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (!startBtn.disabled) startAgent();
  }
});

// ── Init ──

authBtn.addEventListener('click', handleAuth);
startBtn.addEventListener('click', startAgent);
stopBtn.addEventListener('click', stopAgent);

checkAuth();
