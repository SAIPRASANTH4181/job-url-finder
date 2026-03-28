// Content script — accessibility tree, ref-based element targeting, highlights
// Modeled after Claude Chrome's approach

(() => {
  if (window.__browserAgentInjected) return;
  window.__browserAgentInjected = true;

  // ══════════════════════════════════════════════════════════════════════
  //  Element Reference Map (WeakRef — survives across tool calls)
  // ══════════════════════════════════════════════════════════════════════

  window.__agentElementMap = window.__agentElementMap || {};
  let refCounter = 0;

  function getOrCreateRef(element) {
    // Check if this element already has a ref
    for (const [ref, weakRef] of Object.entries(window.__agentElementMap)) {
      const el = weakRef.deref();
      if (el === element) return ref;
    }
    // Create new ref
    const ref = `ref_${++refCounter}`;
    window.__agentElementMap[ref] = new WeakRef(element);
    return ref;
  }

  function resolveRef(ref) {
    const weakRef = window.__agentElementMap[ref];
    if (!weakRef) return null;
    const el = weakRef.deref();
    if (!el) {
      delete window.__agentElementMap[ref];
      return null;
    }
    return el;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Accessibility Tree Builder
  // ══════════════════════════════════════════════════════════════════════

  const TAG_TO_ROLE = {
    'a': 'link',
    'button': 'button',
    'input': 'textbox',
    'textarea': 'textbox',
    'select': 'combobox',
    'img': 'img',
    'h1': 'heading',
    'h2': 'heading',
    'h3': 'heading',
    'h4': 'heading',
    'nav': 'navigation',
    'main': 'main',
    'form': 'form',
    'table': 'table',
    'li': 'listitem',
    'ul': 'list',
    'ol': 'list',
  };

  function getRole(el) {
    if (el.getAttribute('role')) return el.getAttribute('role');
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const type = el.type || 'text';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'submit' || type === 'button') return 'button';
      if (type === 'search') return 'searchbox';
      return 'textbox';
    }
    return TAG_TO_ROLE[tag] || null;
  }

  function getAccessibleName(el) {
    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.getAttribute('alt') ||
      el.getAttribute('placeholder') ||
      el.labels?.[0]?.textContent?.trim() ||
      (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.value : null) ||
      el.textContent?.trim() ||
      ''
    ).substring(0, 100);
  }

  function isInteractive(el) {
    const tag = el.tagName.toLowerCase();
    if (['a', 'button', 'input', 'textarea', 'select'].includes(tag)) return true;
    if (el.getAttribute('role') === 'button' || el.getAttribute('role') === 'link') return true;
    if (el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'menuitem') return true;
    if (el.hasAttribute('onclick') || el.hasAttribute('tabindex')) return true;
    if (el.getAttribute('contenteditable') === 'true') return true;
    return false;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  }

  function buildAccessibilityTree(filter = 'interactive', maxDepth = 10, maxChars = 30000) {
    const lines = [];
    let charCount = 0;

    function walk(el, depth) {
      if (charCount > maxChars) return;
      if (depth > maxDepth) return;
      if (!el || !el.tagName) return;

      const role = getRole(el);
      const interactive = isInteractive(el);

      // In interactive mode, only show interactive elements
      if (filter === 'interactive' && !interactive && depth > 1) {
        // Still walk children to find nested interactive elements
        for (const child of el.children) {
          walk(child, depth);
        }
        return;
      }

      if (!isVisible(el)) return;

      const name = getAccessibleName(el);
      if (!name && !interactive) {
        // Walk children anyway
        for (const child of el.children) {
          walk(child, depth);
        }
        return;
      }

      // Build the line
      const indent = '  '.repeat(depth);
      let line = '';

      if (role) {
        const ref = interactive ? getOrCreateRef(el) : null;
        line = `${indent}${role} "${name}"`;
        if (ref) line += ` [${ref}]`;

        // Add useful attributes
        const tag = el.tagName.toLowerCase();
        if (tag === 'a' && el.href) {
          try {
            const url = new URL(el.href);
            line += ` href="${url.hostname}${url.pathname.substring(0, 50)}"`;
          } catch {}
        }
        if (tag === 'input' || tag === 'textarea') {
          if (el.type && el.type !== 'text') line += ` type="${el.type}"`;
          if (el.placeholder) line += ` placeholder="${el.placeholder.substring(0, 40)}"`;
          if (el.value) line += ` value="${el.value.substring(0, 40)}"`;
        }
        if (el.getAttribute('disabled') !== null) line += ' (disabled)';
        if (el.getAttribute('checked') !== null) line += ' (checked)';

        // Select options
        if (tag === 'select') {
          lines.push(line);
          charCount += line.length;
          for (const opt of el.options) {
            const optLine = `${indent}  option "${opt.textContent.trim().substring(0, 60)}"${opt.selected ? ' (selected)' : ''} value="${opt.value}"`;
            lines.push(optLine);
            charCount += optLine.length;
          }
          return;
        }

        lines.push(line);
        charCount += line.length;
      }

      // Walk children
      for (const child of el.children) {
        walk(child, depth + (role ? 1 : 0));
      }
    }

    walk(document.body, 0);
    return lines.join('\n');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Highlight Overlay
  // ══════════════════════════════════════════════════════════════════════

  const style = document.createElement('style');
  style.id = '__agent-styles';
  style.textContent = `
    @keyframes __agent-pulse {
      0% { transform: scale(0.5); opacity: 0; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(1); opacity: 0.8; }
    }
    @keyframes __agent-ripple {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(3); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  function showHighlight(x, y, description) {
    removeHighlight();

    const overlay = document.createElement('div');
    overlay.id = '__agent-highlight';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 2147483647; pointer-events: none;
    `;

    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: absolute; left: ${x - 15}px; top: ${y - 15}px;
      width: 30px; height: 30px;
      border: 2px solid #ff6600; border-radius: 50%;
      animation: __agent-ripple 0.8s ease-out forwards;
    `;

    const dot = document.createElement('div');
    dot.style.cssText = `
      position: absolute; left: ${x - 12}px; top: ${y - 12}px;
      width: 24px; height: 24px;
      background: rgba(255, 102, 0, 0.5);
      border: 2px solid #ff6600; border-radius: 50%;
      animation: __agent-pulse 0.5s ease-out forwards;
    `;

    overlay.appendChild(ripple);
    overlay.appendChild(dot);

    if (description) {
      const label = document.createElement('div');
      label.textContent = description;
      label.style.cssText = `
        position: absolute;
        left: ${Math.min(x + 20, window.innerWidth - 220)}px;
        top: ${Math.max(y - 14, 4)}px;
        background: #ff6600; color: white;
        padding: 3px 8px; border-radius: 4px;
        font: 500 12px/1.4 system-ui, sans-serif;
        white-space: nowrap; max-width: 200px;
        overflow: hidden; text-overflow: ellipsis;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      overlay.appendChild(label);
    }

    document.body.appendChild(overlay);
    setTimeout(removeHighlight, 1200);
  }

  function showHighlightOnRef(ref, description) {
    const el = resolveRef(ref);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    showHighlight(x, y, description);
  }

  function removeHighlight() {
    document.getElementById('__agent-highlight')?.remove();
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Get element center coordinates by ref (for CDP click)
  // ══════════════════════════════════════════════════════════════════════

  function getRefCoordinates(ref) {
    const el = resolveRef(ref);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      tag: el.tagName.toLowerCase(),
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Form Input (set value by ref — select, checkbox, input)
  // ══════════════════════════════════════════════════════════════════════

  function setFormValue(ref, value) {
    const el = resolveRef(ref);
    if (!el) return { success: false, error: `Ref ${ref} not found` };

    const tag = el.tagName.toLowerCase();

    if (tag === 'select') {
      // Find option by value or text
      const option = Array.from(el.options).find(
        o => o.value === String(value) || o.textContent.trim() === String(value)
      );
      if (option) {
        el.value = option.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }
      return { success: false, error: `Option "${value}" not found` };
    }

    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = !!value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };
    }

    // Regular input/textarea
    const setter =
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set ||
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(el, String(value));
    } else {
      el.value = String(value);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Page text extraction
  // ══════════════════════════════════════════════════════════════════════

  function getPageText() {
    // Try to find main content first (article, main, etc.)
    const mainSelectors = ['article', 'main', '[role="main"]', '.content', '#content'];
    for (const sel of mainSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 200) {
        return el.innerText.substring(0, 10000);
      }
    }
    return document.body.innerText.substring(0, 10000);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Message Handler
  // ══════════════════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_ACCESSIBILITY_TREE':
        try {
          const tree = buildAccessibilityTree(
            message.filter || 'interactive',
            message.maxDepth || 10,
            message.maxChars || 30000
          );
          sendResponse({
            tree,
            url: window.location.href,
            title: document.title,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            scroll: { x: Math.round(window.scrollX), y: Math.round(window.scrollY), maxY: document.body.scrollHeight },
          });
        } catch (err) {
          sendResponse({
            tree: '',
            url: window.location.href,
            title: document.title,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            scroll: { x: 0, y: 0, maxY: 0 },
          });
        }
        return false;

      case 'GET_REF_COORDS':
        sendResponse(getRefCoordinates(message.ref));
        return false;

      case 'SHOW_HIGHLIGHT':
        if (message.ref) {
          showHighlightOnRef(message.ref, message.description);
        } else {
          showHighlight(message.x, message.y, message.description);
        }
        sendResponse({ ok: true });
        return false;

      case 'HIDE_HIGHLIGHT':
        removeHighlight();
        sendResponse({ ok: true });
        return false;

      case 'SET_FORM_VALUE':
        sendResponse(setFormValue(message.ref, message.value));
        return false;

      case 'GET_PAGE_TEXT':
        sendResponse({ text: getPageText(), url: window.location.href, title: document.title });
        return false;

      default:
        return false;
    }
  });
})();
