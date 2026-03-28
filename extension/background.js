// Background service worker — agent orchestration, Codex API, CDP browser control
// Architecture: ref-based element targeting via accessibility tree (like Claude Chrome)

// ── Constants ──

const OAUTH_CONFIG = {
  authorizationUrl: 'https://auth.openai.com/oauth/authorize',
  tokenUrl: 'https://auth.openai.com/oauth/token',
  clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
  scopes: 'openid profile email offline_access',
};

const API_CONFIG = {
  baseUrl: 'https://chatgpt.com/backend-api',
  codexEndpoint: '/codex/responses',
};

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/event-stream',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://chatgpt.com/',
  'Origin': 'https://chatgpt.com',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
};

const SYSTEM_PROMPT = `You are a browser automation agent. You see a screenshot and an accessibility tree of the current web page.
Each interactive element has a ref ID like [ref_1], [ref_2], etc. Use these refs to target elements.

Return ONLY a single JSON object (no markdown, no explanation, no code fences).

Available actions:

CLICK an element by ref:
  {"action": "click", "ref": "ref_3", "description": "what you're clicking"}

TYPE text into an element by ref (clicks to focus first, then types):
  {"action": "type", "ref": "ref_5", "text": "search query", "description": "what field"}

SET a form value by ref (for selects, checkboxes, radios):
  {"action": "form_input", "ref": "ref_7", "value": "option_value"}

PRESS a keyboard key:
  {"action": "pressKey", "key": "Enter"|"Tab"|"Escape"|"Backspace"|"ArrowDown"}

NAVIGATE to a URL directly:
  {"action": "navigate", "url": "https://example.com"}

SCROLL the page:
  {"action": "scroll", "direction": "down"|"up", "amount": 400}

EXECUTE JavaScript in the page:
  {"action": "js_eval", "expression": "document.title", "description": "what to evaluate"}

WAIT for page to load:
  {"action": "wait", "seconds": 2}

DONE — task complete:
  {"action": "done", "result": "The answer or URL found"}

Guidelines:
- ALWAYS use ref IDs from the accessibility tree to click/type, not coordinates
- The accessibility tree shows: role "name" [ref_id] href="..." type="..."
- Pick the correct ref by reading the element's name and href
- After typing in a search box, press Enter to submit
- If a click didn't navigate, check if a new element appeared or try a different ref
- Use navigate with a direct URL when clicking isn't working
- Use js_eval to extract specific data from the page when needed
- When you find the answer, return done with the result
- One action at a time`;

// ── State ──

let agentTabId = null;
let debuggerAttached = false;
let isRunning = false;
let shouldStop = false;
let actionHistory = [];

// ══════════════════════════════════════════════════════════════════════
//  PKCE + OAuth (unchanged)
// ══════════════════════════════════════════════════════════════════════

function generateRandomString(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    .slice(0, length);
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const REDIRECT_URI = 'http://localhost:1455/auth/callback';

async function login() {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await sha256(codeVerifier);
  const state = generateRandomString(32);

  await chrome.storage.local.set({ _pkce_verifier: codeVerifier, _pkce_state: state });

  const authUrl = new URL(OAUTH_CONFIG.authorizationUrl);
  authUrl.searchParams.set('client_id', OAUTH_CONFIG.clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url: authUrl.toString() }, (authTab) => {
      const authTabId = authTab.id;

      function onUpdated(tabId, changeInfo) {
        if (tabId !== authTabId || !changeInfo.url) return;
        if (!changeInfo.url.startsWith(REDIRECT_URI)) return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved.removeListener(onRemoved);

        const url = new URL(changeInfo.url);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        chrome.tabs.remove(authTabId).catch(() => {});

        (async () => {
          try {
            const stored = await chrome.storage.local.get(['_pkce_verifier', '_pkce_state']);
            if (returnedState !== stored._pkce_state) throw new Error('State mismatch');

            const tokenResponse = await fetch(OAUTH_CONFIG.tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: OAUTH_CONFIG.clientId,
                code,
                redirect_uri: REDIRECT_URI,
                code_verifier: stored._pkce_verifier,
              }),
            });

            if (!tokenResponse.ok) throw new Error(`Token exchange failed: ${await tokenResponse.text()}`);
            const tokens = await tokenResponse.json();
            await chrome.storage.local.set({
              auth: {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
                account_id: tokens.account_id || '',
              }
            });
            await chrome.storage.local.remove(['_pkce_verifier', '_pkce_state']);
            resolve(true);
          } catch (err) { reject(err); }
        })();
      }

      function onRemoved(tabId) {
        if (tabId !== authTabId) return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved.removeListener(onRemoved);
        reject(new Error('Login cancelled'));
      }

      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
    });
  });
}

async function getValidToken() {
  const { auth } = await chrome.storage.local.get('auth');
  if (!auth) throw new Error('Not logged in');

  if (auth.expires_at < Date.now() + 60000) {
    if (!auth.refresh_token) throw new Error('Token expired');
    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: OAUTH_CONFIG.clientId,
        refresh_token: auth.refresh_token,
      }),
    });
    if (!response.ok) throw new Error('Token refresh failed');
    const tokens = await response.json();
    const updated = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || auth.refresh_token,
      expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      account_id: tokens.account_id || auth.account_id || '',
    };
    await chrome.storage.local.set({ auth: updated });
    return updated;
  }
  return auth;
}

async function logout() { await chrome.storage.local.remove('auth'); }
async function isLoggedIn() { const { auth } = await chrome.storage.local.get('auth'); return !!auth?.access_token; }

// ══════════════════════════════════════════════════════════════════════
//  Codex API — Multi-turn conversation
// ══════════════════════════════════════════════════════════════════════

// Conversation history: alternating user/assistant messages
let conversationMessages = [];
const MAX_IMAGES_IN_HISTORY = 5; // Keep last N screenshots, strip older ones

function buildPageContext(accessibilityTree, pageInfo, screenshotBase64) {
  const content = [];

  let text = `Page: ${pageInfo.url} — "${pageInfo.title}"\nViewport: ${pageInfo.viewport.width}x${pageInfo.viewport.height} | Scroll: ${pageInfo.scroll.y}/${pageInfo.scroll.maxY}`;

  if (accessibilityTree) {
    text += `\n\nAccessibility tree:\n${accessibilityTree}`;
  }

  content.push({ type: 'input_text', text });

  // Only include screenshot if provided (not every step)
  if (screenshotBase64) {
    content.push({
      type: 'input_image',
      image_url: `data:image/jpeg;base64,${screenshotBase64}`,
    });
  }

  return content;
}

function pruneConversationHistory() {
  // 1. Strip old images (keep last N)
  let imageCount = 0;
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i];
    if (!Array.isArray(msg.content)) continue;

    msg.content = msg.content.filter(block => {
      if (block.type === 'input_image') {
        imageCount++;
        if (imageCount > MAX_IMAGES_IN_HISTORY) return false;
      }
      return true;
    });
  }

  // 2. Strip old accessibility trees from user messages (keep last 4)
  // Accessibility trees contain "Accessibility tree:\n" — replace with summary
  let treeCount = 0;
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i];
    if (msg.role !== 'user' || !Array.isArray(msg.content)) continue;

    for (let j = 0; j < msg.content.length; j++) {
      const block = msg.content[j];
      if (block.type === 'input_text' && block.text?.includes('Accessibility tree:')) {
        treeCount++;
        if (treeCount > 4) {
          // Replace full tree with just the page URL line
          const firstLine = block.text.split('\n')[0]; // "Page: url — title"
          msg.content[j] = { type: 'input_text', text: firstLine + '\n(accessibility tree pruned)' };
        }
      }
    }
  }

  // 3. If conversation is getting very long (>40 messages), compact older entries
  if (conversationMessages.length > 40) {
    // Keep first 2 messages (task + first page) and last 20
    const head = conversationMessages.slice(0, 2);
    const tail = conversationMessages.slice(-20);
    const summary = {
      type: 'message', role: 'user',
      content: [{ type: 'input_text', text: `[${conversationMessages.length - 22} earlier messages compacted. Key context: the agent has been working on the task and tried multiple approaches.]` }],
    };
    conversationMessages = [...head, summary, ...tail];
  }
}

// ── Stuck loop detection (OpenClaw pattern) ──

function hashAction(action) {
  // Normalize action to detect repeats
  return JSON.stringify({
    a: action.action,
    r: action.ref || '',
    t: (action.text || '').substring(0, 50),
    k: action.key || '',
    u: (action.url || '').substring(0, 100),
  });
}

function detectStuckLoop(actionHistory, currentAction) {
  const currentHash = hashAction(currentAction);
  const window = actionHistory.slice(-5); // Last 5 actions

  let repeatCount = 0;
  for (const h of window) {
    if (hashAction(h.action) === currentHash) repeatCount++;
  }

  return repeatCount >= 2; // Same action appeared 2+ times in last 5 = stuck
}

async function callCodex(pageContent, isFirstMessage, task) {
  const tokens = await getValidToken();

  // First message includes the task
  if (isFirstMessage) {
    const firstContent = [
      { type: 'input_text', text: `Task: ${task}` },
      ...pageContent,
    ];
    conversationMessages.push({
      type: 'message', role: 'user', content: firstContent,
    });
  } else {
    // Subsequent messages: page context as user message (tool result equivalent)
    conversationMessages.push({
      type: 'message', role: 'user', content: pageContent,
    });
  }

  // Prune old images, accessibility trees, and compact if needed
  pruneConversationHistory();

  const body = {
    model: 'gpt-5',
    instructions: SYSTEM_PROMPT,
    input: conversationMessages,
    store: false,
    stream: true,
  };

  const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.codexEndpoint}`, {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens.access_token}`,
      'x-account-id': tokens.account_id || '',
      'openai-beta': 'codex-responses',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Codex API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const responseText = await parseSSEStream(response);

  // Add assistant response to conversation history
  conversationMessages.push({
    type: 'message', role: 'assistant',
    content: [{ type: 'output_text', text: responseText }],
  });

  return responseText;
}

async function parseSSEStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let resultText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const lines = event.trim().split('\n');
      let eventType = '';
      let eventData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) eventData = line.slice(6);
      }

      if ((eventType === 'response.completed' || eventType === 'response.done') && eventData) {
        try {
          const parsed = JSON.parse(eventData);
          const output = parsed.response?.output ?? [];
          const text = output
            .filter(item => item.type === 'message')
            .flatMap(item => item.content ?? [])
            .filter(c => c.type === 'output_text')
            .map(c => c.text ?? '')
            .join('');
          if (text) resultText = text;
        } catch {}
      }

      if (eventType === 'response.output_text.delta' && eventData) {
        try {
          const parsed = JSON.parse(eventData);
          if (parsed.delta) resultText += parsed.delta;
        } catch {}
      }
    }
  }

  return resultText || '(No response)';
}

function parseAction(responseText) {
  let text = responseText.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const start = text.indexOf('{');
  if (start === -1) throw new Error(`No JSON found: ${text.substring(0, 100)}`);

  let depth = 0, end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error(`Incomplete JSON: ${text.substring(0, 100)}`);
  return JSON.parse(text.substring(start, end + 1));
}

// ══════════════════════════════════════════════════════════════════════
//  CDP (Chrome DevTools Protocol)
// ══════════════════════════════════════════════════════════════════════

function cdp(tabId, method, params = {}) {
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

async function attachDebugger(tabId) {
  if (debuggerAttached) return;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    debuggerAttached = true;
  } catch (err) {
    if (err.message?.includes('Another debugger')) {
      debuggerAttached = true;
    } else {
      throw err;
    }
  }
}

async function detachDebugger(tabId) {
  if (!debuggerAttached) return;
  try { await chrome.debugger.detach({ tabId }); } catch {}
  debuggerAttached = false;
}

chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId === agentTabId) {
    debuggerAttached = false;
    if (isRunning) {
      shouldStop = true;
      sendToPanel({ type: 'STATUS', status: 'stopped', message: 'Debugger detached' });
    }
  }
});

// ── CDP: Screenshot (with downscaling for token efficiency) ──

async function takeScreenshot(tabId) {
  await attachDebugger(tabId);

  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });

  // Hide highlights before screenshot
  try { await chrome.tabs.sendMessage(tabId, { type: 'HIDE_HIGHLIGHT' }); } catch {}
  await new Promise(r => setTimeout(r, 150));

  // Capture at reduced resolution for token efficiency
  // Claude uses pxPerToken: 28, maxTargetPx: 1568
  const result = await cdp(tabId, 'Page.captureScreenshot', {
    format: 'jpeg',
    quality: 60, // Lower quality = fewer tokens
    captureBeyondViewport: false,
  });

  return result.data;
}

// ── CDP: Click at coordinates ──

async function cdpClick(tabId, x, y) {
  await attachDebugger(tabId);

  await cdp(tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await new Promise(r => setTimeout(r, 80));
  await cdp(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 50));
  await cdp(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

// ── CDP: Type text ──

async function cdpType(tabId, text) {
  await attachDebugger(tabId);
  for (const char of text) {
    await cdp(tabId, 'Input.insertText', { text: char });
    await new Promise(r => setTimeout(r, 12));
  }
}

// ── CDP: Press key ──

async function cdpPressKey(tabId, key) {
  await attachDebugger(tabId);

  const keyMap = {
    'Enter':     { code: 'Enter',     keyCode: 13, text: '\r' },
    'Tab':       { code: 'Tab',       keyCode: 9,  text: '' },
    'Escape':    { code: 'Escape',    keyCode: 27, text: '' },
    'Backspace': { code: 'Backspace', keyCode: 8,  text: '' },
    'ArrowDown': { code: 'ArrowDown', keyCode: 40, text: '' },
    'ArrowUp':   { code: 'ArrowUp',   keyCode: 38, text: '' },
    'Space':     { code: 'Space',     keyCode: 32, text: ' ' },
  };

  const mapped = keyMap[key] || { code: key, keyCode: 0, text: '' };

  await cdp(tabId, 'Input.dispatchKeyEvent', {
    type: 'keyDown', key, code: mapped.code,
    windowsVirtualKeyCode: mapped.keyCode, nativeVirtualKeyCode: mapped.keyCode, text: mapped.text,
  });
  await new Promise(r => setTimeout(r, 30));
  await cdp(tabId, 'Input.dispatchKeyEvent', {
    type: 'keyUp', key, code: mapped.code,
    windowsVirtualKeyCode: mapped.keyCode, nativeVirtualKeyCode: mapped.keyCode,
  });
}

// ── CDP: Scroll ──

async function cdpScroll(tabId, direction, amount = 400) {
  await attachDebugger(tabId);
  await cdp(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseWheel', x: 400, y: 400, deltaX: 0,
    deltaY: direction === 'up' ? -amount : amount,
  });
}

// ── CDP: Navigate ──

async function cdpNavigate(tabId, url) {
  await attachDebugger(tabId);
  await cdp(tabId, 'Page.navigate', { url });
  await waitForLoad(tabId);
}

// ── CDP: Execute JavaScript ──

async function cdpEval(tabId, expression) {
  await attachDebugger(tabId);
  const result = await cdp(tabId, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    return { success: false, error: result.exceptionDetails.text || 'JS evaluation error' };
  }
  return { success: true, value: result.result.value };
}

// ── Wait for page load ──

function waitForLoad(tabId, timeout = 15000) {
  return new Promise(resolve => {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 800);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, timeout);
  });
}

// ══════════════════════════════════════════════════════════════════════
//  Tab Management & Content Script Communication
// ══════════════════════════════════════════════════════════════════════

async function getOrCreateAgentTab() {
  if (agentTabId) {
    try { await chrome.tabs.get(agentTabId); return agentTabId; }
    catch { agentTabId = null; debuggerAttached = false; }
  }
  const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
  agentTabId = tab.id;
  debuggerAttached = false;
  return agentTabId;
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch {}
  await new Promise(r => setTimeout(r, 200));
}

async function getAccessibilityTree(tabId) {
  await injectContentScript(tabId);
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'GET_ACCESSIBILITY_TREE',
      filter: 'interactive',
      maxDepth: 10,
      maxChars: 25000,
    });
    return response;
  } catch {
    const tab = await chrome.tabs.get(tabId);
    return {
      tree: '',
      url: tab.url || 'about:blank',
      title: tab.title || '',
      viewport: { width: 1280, height: 800 },
      scroll: { x: 0, y: 0, maxY: 0 },
    };
  }
}

async function getRefCoordinates(tabId, ref) {
  await injectContentScript(tabId);
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'GET_REF_COORDS', ref });
  } catch {
    return null;
  }
}

async function showHighlight(tabId, opts) {
  try { await chrome.tabs.sendMessage(tabId, { type: 'SHOW_HIGHLIGHT', ...opts }); } catch {}
}

// ══════════════════════════════════════════════════════════════════════
//  Execute Action (ref-based)
// ══════════════════════════════════════════════════════════════════════

async function executeAction(tabId, action) {
  switch (action.action) {
    case 'click': {
      const coords = await getRefCoordinates(tabId, action.ref);
      if (!coords) return { success: false, error: `Element ${action.ref} not found on page` };

      await showHighlight(tabId, { ref: action.ref, description: action.description });
      await new Promise(r => setTimeout(r, 200));
      await cdpClick(tabId, coords.x, coords.y);
      return { success: true };
    }

    case 'type': {
      const coords = await getRefCoordinates(tabId, action.ref);
      if (!coords) return { success: false, error: `Element ${action.ref} not found on page` };

      await showHighlight(tabId, { ref: action.ref, description: action.description });
      await new Promise(r => setTimeout(r, 150));
      await cdpClick(tabId, coords.x, coords.y);
      await new Promise(r => setTimeout(r, 200));
      await cdpType(tabId, action.text);
      return { success: true };
    }

    case 'form_input': {
      await injectContentScript(tabId);
      const result = await chrome.tabs.sendMessage(tabId, {
        type: 'SET_FORM_VALUE',
        ref: action.ref,
        value: action.value,
      });
      return result;
    }

    case 'pressKey':
      await cdpPressKey(tabId, action.key);
      return { success: true };

    case 'navigate':
      await cdpNavigate(tabId, action.url);
      return { success: true };

    case 'scroll':
      await cdpScroll(tabId, action.direction, action.amount);
      return { success: true };

    case 'js_eval': {
      const result = await cdpEval(tabId, action.expression);
      return result;
    }

    case 'wait':
      await new Promise(r => setTimeout(r, (action.seconds || 1) * 1000));
      return { success: true };

    default:
      return { success: false, error: `Unknown action: ${action.action}` };
  }
}

// ══════════════════════════════════════════════════════════════════════
//  Agent Loop
// ══════════════════════════════════════════════════════════════════════

async function runAgent(task) {
  isRunning = true;
  shouldStop = false;
  actionHistory = [];
  conversationMessages = []; // Fresh conversation

  sendToPanel({ type: 'STATUS', status: 'running', message: 'Starting...' });

  await getOrCreateAgentTab();
  const MAX_STEPS = 30;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;
  let lastUrl = '';

  try {
    // Navigate to google.com if on blank page
    const initTab = await chrome.tabs.get(agentTabId);
    if (!initTab.url || initTab.url === 'about:blank' || initTab.url.startsWith('chrome://')) {
      sendToPanel({ type: 'LOG', step: 0, message: 'Navigating to google.com...' });
      await chrome.tabs.update(agentTabId, { url: 'https://www.google.com' });
      await waitForLoad(agentTabId, 10000);
      await new Promise(r => setTimeout(r, 500));
    }

    await attachDebugger(agentTabId);

    for (let step = 1; step <= MAX_STEPS; step++) {
      if (shouldStop) {
        sendToPanel({ type: 'STATUS', status: 'stopped', message: 'Stopped by user' });
        break;
      }

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        sendToPanel({ type: 'STATUS', status: 'error', message: `Stopped: ${MAX_CONSECUTIVE_FAILURES} consecutive failures` });
        break;
      }

      const tid = agentTabId;

      sendToPanel({ type: 'LOG', step, message: 'Capturing page...' });

      // 1. Accessibility tree (always — it's cheap)
      const pageData = await getAccessibilityTree(tid);

      // 2. Screenshot (smart: take on first step, after navigation, or every 3 steps)
      let screenshot = null;
      const urlChanged = pageData.url !== lastUrl;
      const shouldScreenshot = step === 1 || urlChanged || step % 3 === 0;
      lastUrl = pageData.url;

      if (shouldScreenshot) {
        try {
          screenshot = await takeScreenshot(tid);
          sendToPanel({ type: 'SCREENSHOT', data: screenshot });
        } catch (err) {
          sendToPanel({ type: 'LOG', step, message: `Screenshot skipped: ${err.message}`, error: true });
        }
      }

      sendToPanel({ type: 'LOG', step, message: `Analyzing: ${pageData.url}` });

      // 3. Build page context and call Codex (multi-turn)
      const pageContent = buildPageContext(pageData.tree, pageData, screenshot);
      let responseText;
      try {
        responseText = await callCodex(pageContent, step === 1, task);
      } catch (err) {
        sendToPanel({ type: 'LOG', step, message: `AI error: ${err.message}`, error: true });
        if (err.message.includes('Not logged in') || err.message.includes('401')) {
          sendToPanel({ type: 'STATUS', status: 'error', message: 'Not logged in' });
          break;
        }
        consecutiveFailures++;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      // 4. Parse action
      let action;
      try {
        action = parseAction(responseText);
      } catch (err) {
        sendToPanel({ type: 'LOG', step, message: `Parse error: ${responseText.substring(0, 150)}`, error: true });
        consecutiveFailures++;
        continue;
      }

      const desc = action.description || action.url || action.text || action.result || action.key || action.ref || '';
      sendToPanel({ type: 'LOG', step, message: `${action.action}: ${desc}` });

      // 5. Stuck loop detection — inject warning into conversation
      if (detectStuckLoop(actionHistory, action)) {
        sendToPanel({ type: 'LOG', step, message: 'Stuck detected — injecting guidance', error: true });
        consecutiveFailures++;

        // Inject a "you're stuck" message into the conversation
        conversationMessages.push({
          type: 'message', role: 'user',
          content: [{ type: 'input_text', text: `WARNING: You have attempted "${action.action}" with similar arguments multiple times and it is not working. You MUST try a COMPLETELY DIFFERENT approach. Options:\n1. Use "navigate" with a direct URL\n2. Use "js_eval" to extract data from the page programmatically\n3. Try a different element ref\n4. Use "done" if you already have enough information to answer\nDo NOT repeat the same action.` }],
        });
        continue; // Skip execution, let AI reconsider
      }

      // 6. Done?
      if (action.action === 'done') {
        sendToPanel({ type: 'STATUS', status: 'done', message: 'Task complete!', result: action.result });
        break;
      }

      // 6. Execute
      let result;
      try {
        const tabsBefore = (action.action === 'click')
          ? (await chrome.tabs.query({ windowId: (await chrome.tabs.get(tid)).windowId })).map(t => t.id)
          : null;

        result = await executeAction(tid, action);
        consecutiveFailures = 0; // Reset on success

        // Wait for settle
        const waitMs = { click: 1500, type: 400, pressKey: 1500, scroll: 600, navigate: 0, wait: 0 }[action.action] || 500;
        if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));

        // New tab detection after click
        if (action.action === 'click' && tabsBefore) {
          const tabsAfter = await chrome.tabs.query({ windowId: (await chrome.tabs.get(tid)).windowId });
          const newTabs = tabsAfter.filter(t => !tabsBefore.includes(t.id));
          if (newTabs.length > 0) {
            const newTab = newTabs[newTabs.length - 1];
            sendToPanel({ type: 'LOG', step, message: `New tab: ${newTab.url || 'loading...'}` });
            await detachDebugger(tid);
            agentTabId = newTab.id;
            await chrome.tabs.update(newTab.id, { active: true });
            await waitForLoad(newTab.id, 10000);
            await attachDebugger(newTab.id);
          }
        }
      } catch (err) {
        result = { success: false, error: err.message };
        consecutiveFailures++;
        sendToPanel({ type: 'LOG', step, message: `Failed: ${err.message}`, error: true });
      }

      // 7. Add result feedback to conversation (so AI knows what happened)
      const resultText = result?.success
        ? `Action "${action.action}" succeeded.${result.value ? ' Result: ' + JSON.stringify(result.value).substring(0, 500) : ''}`
        : `Action "${action.action}" FAILED: ${result?.error || 'unknown error'}`;

      conversationMessages.push({
        type: 'message', role: 'user',
        content: [{ type: 'input_text', text: resultText }],
      });

      actionHistory.push({ step, action, result });

      if (step === MAX_STEPS) {
        sendToPanel({ type: 'STATUS', status: 'error', message: `Max steps (${MAX_STEPS}) reached` });
      }
    }
  } catch (err) {
    sendToPanel({ type: 'STATUS', status: 'error', message: `Agent error: ${err.message}` });
  } finally {
    isRunning = false;
  }
}

// ── Communication ──

function sendToPanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

// ── Message handler ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_AGENT':
      runAgent(message.task);
      sendResponse({ ok: true });
      return false;
    case 'STOP_AGENT':
      shouldStop = true;
      sendResponse({ ok: true });
      return false;
    case 'LOGIN':
      login().then(() => sendResponse({ ok: true })).catch(err => sendResponse({ ok: false, error: err.message }));
      return true;
    case 'LOGOUT':
      logout().then(() => sendResponse({ ok: true }));
      return true;
    case 'CHECK_AUTH':
      isLoggedIn().then(loggedIn => sendResponse({ loggedIn }));
      return true;
    case 'GET_STATUS':
      sendResponse({ isRunning, historyLength: actionHistory.length });
      return false;
  }
});

// ── Extension icon → side panel ──

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.sidePanel.setOptions({ enabled: true });
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
