/**
 * Returns the full HTML for the Job URL Finder dashboard.
 * Single-file, no external dependencies — vanilla HTML/CSS/JS.
 */
export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job URL Finder</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a1a;
      color: #e0e0e0;
      min-height: 100vh;
      line-height: 1.6;
    }

    /* ─── Navbar ──────────────────────────────────────────────── */
    .navbar {
      background: linear-gradient(135deg, #0f0f2a 0%, #1a1a3e 100%);
      border-bottom: 1px solid rgba(233, 69, 96, 0.2);
      padding: 0 32px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(20px);
    }
    .navbar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .navbar-logo {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #e94560, #c73650);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 700;
      color: white;
      box-shadow: 0 4px 15px rgba(233, 69, 96, 0.3);
    }
    .navbar-title {
      font-size: 18px;
      font-weight: 600;
      background: linear-gradient(135deg, #fff, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .auth-badges {
      display: flex;
      gap: 8px;
    }
    .auth-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .auth-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }
    .auth-dot.green { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.5); }
    .auth-dot.red { background: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.5); }
    .auth-dot.yellow { background: #eab308; box-shadow: 0 0 8px rgba(234,179,8,0.5); }
    .auth-dot.loading { background: #64748b; animation: pulse-dot 1.5s infinite; }
    @keyframes pulse-dot { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
    .auth-btn {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      border: 1px solid rgba(255,255,255,0.12);
      transition: all 0.2s;
      margin-left: 4px;
    }
    .auth-btn.login-btn {
      background: rgba(34,197,94,0.15);
      color: #4ade80;
      border-color: rgba(34,197,94,0.3);
    }
    .auth-btn.login-btn:hover { background: rgba(34,197,94,0.25); }
    .auth-btn.logout-btn {
      background: rgba(239,68,68,0.1);
      color: #f87171;
      border-color: rgba(239,68,68,0.2);
    }
    .auth-btn.logout-btn:hover { background: rgba(239,68,68,0.2); }
    .auth-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ─── Main Container ─────────────────────────────────────── */
    .main {
      max-width: 1280px;
      margin: 0 auto;
      padding: 32px;
    }

    /* ─── Hero / Scan Section ────────────────────────────────── */
    .hero {
      background: linear-gradient(135deg, #111133 0%, #1a1a3e 50%, #0f1f3e 100%);
      border: 1px solid rgba(233, 69, 96, 0.15);
      border-radius: 16px;
      padding: 40px;
      margin-bottom: 32px;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(233,69,96,0.08) 0%, transparent 70%);
      pointer-events: none;
    }
    .hero-title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #fff, #cbd5e1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-subtitle {
      color: #64748b;
      font-size: 15px;
      margin-bottom: 28px;
    }
    .scan-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .input-group {
      display: flex;
      align-items: center;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 4px;
      gap: 0;
    }
    .input-group label {
      font-size: 13px;
      color: #64748b;
      padding: 0 12px;
      white-space: nowrap;
    }
    .input-group input[type="number"] {
      width: 70px;
      padding: 10px 12px;
      border: none;
      border-radius: 8px;
      background: rgba(255,255,255,0.05);
      color: #e0e0e0;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      outline: none;
      text-align: center;
    }
    .input-group input[type="number"]:focus {
      background: rgba(233, 69, 96, 0.1);
    }
    .input-group input[type="date"] {
      padding: 10px 12px;
      border: none;
      border-radius: 8px;
      background: rgba(255,255,255,0.05);
      color: #e0e0e0;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      color-scheme: dark;
    }
    .input-group input[type="date"]:focus {
      background: rgba(233, 69, 96, 0.1);
    }
    .email-count-hint {
      font-size: 12px;
      color: #475569;
      margin-left: 4px;
    }
    .btn-scan {
      padding: 12px 32px;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      background: linear-gradient(135deg, #e94560, #c73650);
      color: white;
      box-shadow: 0 4px 20px rgba(233, 69, 96, 0.3);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-scan:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(233, 69, 96, 0.4);
    }
    .btn-scan:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .btn-scan svg { width: 18px; height: 18px; }

    /* ─── Progress Bar ───────────────────────────────────────── */
    .progress-section {
      display: none;
      margin-top: 24px;
    }
    .progress-section.visible { display: block; }
    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background: rgba(255,255,255,0.05);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #e94560, #ff6b81);
      border-radius: 3px;
      width: 0%;
      transition: width 0.5s ease;
    }
    .progress-bar-fill.indeterminate {
      width: 30%;
      animation: indeterminate 1.5s ease-in-out infinite;
    }
    @keyframes indeterminate {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }
    .progress-text {
      font-size: 13px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .progress-text .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(233,69,96,0.2);
      border-top-color: #e94560;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ─── Error ──────────────────────────────────────────────── */
    .error-banner {
      display: none;
      padding: 16px 20px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      margin-bottom: 24px;
      font-size: 14px;
      color: #fca5a5;
    }
    .error-banner.visible { display: flex; align-items: center; gap: 10px; }
    .error-banner svg { flex-shrink: 0; width: 20px; height: 20px; color: #ef4444; }

    /* ─── Stats Cards ────────────────────────────────────────── */
    .stats-grid {
      display: none;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }
    .stats-grid.visible { display: grid; }
    .stat-card {
      background: linear-gradient(135deg, #111133, #1a1a3e);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 24px;
      text-align: center;
      transition: transform 0.2s, border-color 0.2s;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      border-color: rgba(233, 69, 96, 0.2);
    }
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(135deg, #e94560, #ff6b81);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1.2;
    }
    .stat-label {
      font-size: 12px;
      font-weight: 500;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 6px;
    }

    /* ─── Jobs Table Section ──────────────────────────────────── */
    .jobs-section {
      display: none;
      margin-bottom: 28px;
    }
    .jobs-section.visible { display: block; }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .section-count {
      font-size: 13px;
      color: #475569;
      background: rgba(255,255,255,0.05);
      padding: 4px 12px;
      border-radius: 20px;
    }

    .table-container {
      background: linear-gradient(135deg, #111133, #141436);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead {
      background: rgba(0,0,0,0.3);
    }
    th {
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.8px;
      padding: 14px 16px;
      text-align: left;
      white-space: nowrap;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    td {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.03);
      vertical-align: middle;
    }
    tbody tr {
      transition: background 0.15s;
    }
    tbody tr:hover {
      background: rgba(233, 69, 96, 0.04);
    }
    tbody tr:last-child td { border-bottom: none; }

    .company-cell {
      font-weight: 600;
      color: #f1f5f9;
    }
    .role-cell {
      color: #94a3b8;
    }
    .job-id-cell {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 12px;
      color: #64748b;
      background: rgba(255,255,255,0.03);
      padding: 3px 8px;
      border-radius: 4px;
    }
    .location-cell {
      color: #94a3b8;
      font-size: 12px;
    }
    .source-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      background: rgba(99, 102, 241, 0.12);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.2);
    }
    .url-link {
      color: #60a5fa;
      text-decoration: none;
      font-size: 12px;
      word-break: break-all;
      transition: color 0.2s;
    }
    .url-link:hover { color: #93c5fd; text-decoration: underline; }
    .url-missing {
      color: #ef4444;
      font-size: 12px;
      font-style: italic;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .url-search {
      display: inline-block;
      margin-top: 4px;
      font-size: 11px;
      color: #f59e0b;
      text-decoration: none;
    }
    .url-search:hover { text-decoration: underline; color: #fbbf24; }

    /* ─── Export Buttons ─────────────────────────────────────── */
    .export-btns {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }
    .export-btn {
      padding: 5px 14px;
      border: 1px solid rgba(96,165,250,0.3);
      border-radius: 8px;
      background: rgba(96,165,250,0.08);
      color: #60a5fa;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
    }
    .export-btn:hover { background: rgba(96,165,250,0.18); border-color: #60a5fa; }

    /* ─── Feedback Input ─────────────────────────────────────── */
    .feedback-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
    }
    .feedback-input {
      flex: 1;
      padding: 5px 8px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      background: rgba(0,0,0,0.3);
      color: #e0e0e0;
      font-size: 11px;
      font-family: inherit;
      outline: none;
      min-width: 120px;
    }
    .feedback-input:focus { border-color: #e94560; }
    .feedback-input::placeholder { color: #475569; }
    .feedback-btn {
      padding: 4px 10px;
      border: 1px solid rgba(34,197,94,0.3);
      border-radius: 6px;
      background: rgba(34,197,94,0.1);
      color: #4ade80;
      font-size: 11px;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .feedback-btn:hover { background: rgba(34,197,94,0.2); }
    .feedback-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .verified-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      background: rgba(34,197,94,0.1);
      color: #4ade80;
      border: 1px solid rgba(34,197,94,0.2);
      margin-top: 4px;
    }
    .btn-load-scan {
      padding: 12px 24px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      background: rgba(255,255,255,0.05);
      color: #94a3b8;
      transition: all 0.3s ease;
    }
    .btn-load-scan:hover {
      border-color: rgba(233, 69, 96, 0.3);
      color: #e0e0e0;
      background: rgba(255,255,255,0.08);
    }
    .btn-load-scan:disabled { opacity: 0.4; cursor: not-allowed; }
    .confidence-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    .confidence-high { background: rgba(34,197,94,0.1); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
    .confidence-medium { background: rgba(234,179,8,0.1); color: #fbbf24; border: 1px solid rgba(234,179,8,0.2); }
    .confidence-low { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }

    /* ─── Email Expand ───────────────────────────────────────── */
    .email-count-btn {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #94a3b8;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
    }
    .email-count-btn:hover {
      border-color: #e94560;
      color: #e94560;
      background: rgba(233, 69, 96, 0.08);
    }
    .email-list {
      display: none;
      margin-top: 8px;
    }
    .email-list.open { display: block; }
    .email-item {
      font-size: 12px;
      color: #64748b;
      padding: 4px 0;
      padding-left: 12px;
      border-left: 2px solid rgba(233, 69, 96, 0.2);
      margin-bottom: 4px;
    }

    /* ─── Mobile Cards ───────────────────────────────────────── */
    .mobile-jobs { display: none; }

    @media (max-width: 900px) {
      .table-container { display: none; }
      .mobile-jobs { display: block; }
      .stats-grid.visible { grid-template-columns: repeat(2, 1fr); }
      .main { padding: 16px; }
      .hero { padding: 24px; }
      .hero-title { font-size: 22px; }
      .navbar { padding: 0 16px; }
      .auth-badges { display: none; }
    }
    @media (max-width: 480px) {
      .stats-grid.visible { grid-template-columns: 1fr 1fr; }
      .scan-controls { flex-direction: column; align-items: stretch; }
      .btn-scan { justify-content: center; }
    }

    .mobile-job-card {
      background: linear-gradient(135deg, #111133, #141436);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 12px;
    }
    .mobile-job-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .mobile-job-card-num {
      background: rgba(233, 69, 96, 0.1);
      color: #e94560;
      font-weight: 700;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 6px;
    }
    .mobile-job-card-company {
      font-weight: 600;
      font-size: 15px;
      color: #f1f5f9;
    }
    .mobile-job-card-role {
      color: #64748b;
      font-size: 13px;
      margin-top: 2px;
    }
    .mobile-job-card-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      font-size: 13px;
    }
    .mobile-job-card-row:last-child { border-bottom: none; }
    .mobile-job-card-label { color: #475569; }
    .mobile-job-card-value { text-align: right; word-break: break-all; max-width: 60%; }

    /* ─── Skipped Section ────────────────────────────────────── */
    .skipped-section {
      display: none;
      margin-top: 8px;
    }
    .skipped-section.visible { display: block; }
    .skipped-toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 14px 20px;
      background: linear-gradient(135deg, #111133, #141436);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
      font-size: 14px;
      color: #64748b;
      user-select: none;
      transition: all 0.2s;
    }
    .skipped-toggle:hover {
      border-color: rgba(255,255,255,0.1);
      color: #94a3b8;
    }
    .skipped-chevron {
      transition: transform 0.3s;
      font-size: 10px;
    }
    .skipped-chevron.open { transform: rotate(90deg); }
    .skipped-list {
      display: none;
      padding: 12px 20px;
      background: rgba(17, 17, 51, 0.5);
      border: 1px solid rgba(255,255,255,0.04);
      border-top: none;
      border-radius: 0 0 12px 12px;
      max-height: 250px;
      overflow-y: auto;
    }
    .skipped-list.open { display: block; }
    .skipped-email {
      font-size: 13px;
      color: #475569;
      padding: 5px 0;
      padding-left: 14px;
      border-left: 2px solid rgba(255,255,255,0.06);
      margin-bottom: 2px;
    }

    /* ─── Scrollbar ──────────────────────────────────────────── */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #e94560; }

    /* ─── Empty state ────────────────────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #475569;
    }
    .empty-state svg { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state p { font-size: 15px; }
  </style>
</head>
<body>

  <!-- Navbar -->
  <nav class="navbar">
    <div class="navbar-brand">
      <div class="navbar-logo">J</div>
      <span class="navbar-title">Job URL Finder</span>
    </div>
    <div class="auth-badges">
      <div class="auth-badge">
        <span id="gmail-dot" class="auth-dot loading"></span>
        <span id="gmail-label">Gmail</span>
        <button id="gmail-auth-btn" class="auth-btn login-btn" style="display:none" onclick="handleGmailAuth()">Login</button>
      </div>
      <div class="auth-badge">
        <span id="chatgpt-dot" class="auth-dot loading"></span>
        <span id="chatgpt-label">ChatGPT</span>
        <button id="chatgpt-auth-btn" class="auth-btn login-btn" style="display:none" onclick="handleChatGPTAuth()">Login</button>
      </div>
    </div>
  </nav>

  <div class="main">

    <!-- Hero / Scan -->
    <div class="hero">
      <h2 class="hero-title">Scan & Discover Job Applications</h2>
      <p class="hero-subtitle">Reads Gmail, identifies job acknowledgment emails, and finds original posting URLs using ChatGPT.</p>

      <div class="scan-controls">
        <div class="input-group">
          <label for="startDate">From</label>
          <input type="date" id="startDate">
        </div>
        <div class="input-group">
          <label for="endDate">To</label>
          <input type="date" id="endDate">
        </div>
        <div class="input-group">
          <label for="maxEmails">Max</label>
          <input type="number" id="maxEmails" value="100" min="1" max="500">
        </div>
        <span class="email-count-hint" id="emailCountHint"></span>
        <button class="btn-scan" id="scanBtn" onclick="startScan()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Scan Emails
        </button>
        <button class="btn-load-scan" id="loadLastBtn" onclick="loadLastScan()">Load Last Scan</button>
      </div>

      <!-- Progress -->
      <div class="progress-section" id="progress">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill indeterminate" id="progressFill"></div>
        </div>
        <div class="progress-text">
          <div class="spinner"></div>
          <span id="progressText">Reading emails from Gmail...</span>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div class="error-banner" id="errorBanner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span id="errorText"></span>
    </div>

    <!-- Stats -->
    <div class="stats-grid" id="statsGrid">
      <div class="stat-card">
        <div class="stat-value" id="statTotal">0</div>
        <div class="stat-label">Total Emails</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="statJobs">0</div>
        <div class="stat-label">Job Emails</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="statSkipped">0</div>
        <div class="stat-label">Non-Job</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="statUnique">0</div>
        <div class="stat-label">Unique Jobs</div>
      </div>
    </div>

    <!-- Feedback Stats -->
    <div class="feedback-stats" id="feedbackStats">
      <div class="section-header">
        <h3 class="section-title">Feedback Loop</h3>
      </div>
      <div class="stats-row" style="display:flex;gap:16px;padding:16px;flex-wrap:wrap;">
        <div class="stat-card" style="flex:1;min-width:120px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#4ade80;" id="fbTotal">0</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Corrections</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:120px;background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.15);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#60a5fa;" id="fbCompanies">0</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Companies</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:120px;background:rgba(233,69,96,0.06);border:1px solid rgba(233,69,96,0.15);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#e94560;" id="fbAccuracy">—</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">High Confidence</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:120px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#f59e0b;" id="fbVerified">—</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Verified in Last Scan</div>
        </div>
      </div>
    </div>

    <!-- Jobs Table -->
    <div class="jobs-section" id="jobsSection">
      <div class="section-header">
        <h3 class="section-title">Discovered Jobs</h3>
        <span class="section-count" id="jobCount">0 jobs</span>
        <div class="export-btns">
          <button class="export-btn" onclick="exportCSV()">Export CSV</button>
          <button class="export-btn" onclick="exportJSON()">Export JSON</button>
        </div>
      </div>

      <!-- Desktop table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Company</th>
              <th>Role</th>
              <th>Job ID</th>
              <th>Location</th>
              <th>Source</th>
              <th>URL / Search</th>
              <th>Confidence</th>
              <th>Emails</th>
            </tr>
          </thead>
          <tbody id="tableBody"></tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="mobile-jobs" id="mobileJobs"></div>
    </div>

    <!-- Skipped -->
    <div class="skipped-section" id="skippedSection">
      <div class="skipped-toggle" onclick="toggleSkipped()">
        <span class="skipped-chevron" id="skippedChevron">&#9654;</span>
        <span id="skippedTitle">Skipped non-job emails</span>
      </div>
      <div class="skipped-list" id="skippedList"></div>
    </div>

  </div>

  <script>
    // ─── Load auth status + email count on page load ──────────
    function updateAuthButton(btnId, isAuthenticated) {
      var btn = document.getElementById(btnId);
      btn.style.display = '';
      if (isAuthenticated) {
        btn.textContent = 'Logout';
        btn.className = 'auth-btn logout-btn';
      } else {
        btn.textContent = 'Login';
        btn.className = 'auth-btn login-btn';
      }
      btn.disabled = false;
    }

    async function init() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        const gDot = document.getElementById('gmail-dot');
        const gLabel = document.getElementById('gmail-label');
        if (data.gmail.authenticated) {
          gDot.className = 'auth-dot ' + (data.gmail.expired ? 'yellow' : 'green');
          gLabel.textContent = data.gmail.email || 'Gmail';
        } else {
          gDot.className = 'auth-dot red';
          gLabel.textContent = 'Gmail: not connected';
        }
        updateAuthButton('gmail-auth-btn', data.gmail.authenticated);

        const cDot = document.getElementById('chatgpt-dot');
        const cLabel = document.getElementById('chatgpt-label');
        if (data.chatgpt.authenticated) {
          cDot.className = 'auth-dot ' + (data.chatgpt.expired ? 'yellow' : 'green');
          cLabel.textContent = 'ChatGPT';
        } else {
          cDot.className = 'auth-dot red';
          cLabel.textContent = 'ChatGPT: not connected';
        }
        updateAuthButton('chatgpt-auth-btn', data.chatgpt.authenticated);
      } catch (e) {
        console.error('Status check failed:', e);
      }

      // Fetch email count
      try {
        const res = await fetch('/api/email-count');
        const data = await res.json();
        if (data.total) {
          document.getElementById('emailCountHint').textContent = '/ ' + data.total.toLocaleString() + ' total in inbox';
        }
      } catch (e) { /* ignore */ }
    }
    init();

    // ─── Auth handlers ──────────────────────────────────────────
    async function handleGmailAuth() {
      var btn = document.getElementById('gmail-auth-btn');
      var isLogout = btn.textContent === 'Logout';

      btn.disabled = true;
      btn.textContent = isLogout ? 'Logging out...' : 'Logging in...';

      try {
        var endpoint = isLogout ? '/api/auth/gmail-logout' : '/api/auth/gmail-login';
        var res = await fetch(endpoint, { method: 'POST' });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
      } catch (e) {
        btn.disabled = false;
        btn.textContent = isLogout ? 'Logout' : 'Login';
        alert((isLogout ? 'Gmail logout' : 'Gmail login') + ' failed: ' + e.message);
        return;
      }

      init(); // Refresh all auth status
    }

    async function handleChatGPTAuth() {
      var btn = document.getElementById('chatgpt-auth-btn');
      var isLogout = btn.textContent === 'Logout';

      btn.disabled = true;
      btn.textContent = isLogout ? 'Logging out...' : 'Logging in...';

      try {
        var endpoint = isLogout ? '/api/auth/logout' : '/api/auth/login';
        var res = await fetch(endpoint, { method: 'POST' });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
      } catch (e) {
        btn.disabled = false;
        btn.textContent = isLogout ? 'Logout' : 'Login';
        alert((isLogout ? 'ChatGPT logout' : 'ChatGPT login') + ' failed: ' + e.message);
        return;
      }

      init(); // Refresh all auth status
    }

    // ─── Scan ────────────────────────────────────────────────
    async function startScan() {
      const btn = document.getElementById('scanBtn');
      const progress = document.getElementById('progress');
      const errorBanner = document.getElementById('errorBanner');
      const maxEmails = parseInt(document.getElementById('maxEmails').value) || 100;
      const startDate = document.getElementById('startDate').value || '';
      const endDate = document.getElementById('endDate').value || '';

      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Scanning...';
      progress.classList.add('visible');
      errorBanner.classList.remove('visible');
      document.getElementById('statsGrid').classList.remove('visible');
      document.getElementById('jobsSection').classList.remove('visible');
      document.getElementById('skippedSection').classList.remove('visible');
      var dateLabel = '';
      if (startDate && endDate) dateLabel = ' from ' + startDate + ' to ' + endDate;
      else if (startDate) dateLabel = ' from ' + startDate;
      else if (endDate) dateLabel = ' until ' + endDate;
      document.getElementById('progressText').textContent = 'Reading emails' + dateLabel + ' from Gmail...';

      try {
        var progressTimer = setTimeout(function() {
          document.getElementById('progressText').textContent = 'Analyzing emails with ChatGPT... This takes 1-2 minutes.';
        }, 8000);

        // Convert dates from YYYY-MM-DD to YYYY/MM/DD for Gmail query
        var payload = { maxEmails: maxEmails };
        if (startDate) payload.startDate = startDate.replace(/-/g, '/');
        if (endDate) payload.endDate = endDate.replace(/-/g, '/');

        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        clearTimeout(progressTimer);

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Scan failed');
        }

        const data = await res.json();
        renderResults(data);
        loadStats();
      } catch (e) {
        document.getElementById('errorText').textContent = e.message;
        errorBanner.classList.add('visible');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Scan Emails';
        progress.classList.remove('visible');
      }
    }

    // ─── Render Results ──────────────────────────────────────
    window._lastScanData = null;

    function renderResults(data) {
      window._lastScanData = data;
      // Stats
      document.getElementById('statTotal').textContent = data.totalEmails;
      document.getElementById('statJobs').textContent = data.jobEmails;
      document.getElementById('statSkipped').textContent = data.nonJobEmails;
      document.getElementById('statUnique').textContent = data.jobs.length;
      document.getElementById('statsGrid').classList.add('visible');

      // Job count badge
      document.getElementById('jobCount').textContent = data.jobs.length + ' job' + (data.jobs.length !== 1 ? 's' : '');

      // Desktop table
      var tbody = document.getElementById('tableBody');
      tbody.innerHTML = '';

      // Mobile cards
      var mobileJobs = document.getElementById('mobileJobs');
      mobileJobs.innerHTML = '';

      data.jobs.forEach(function(grouped, idx) {
        var job = grouped.job;
        var emails = grouped.emails;
        var num = idx + 1;

        var feedbackKey = (job.company + '|' + job.role).toLowerCase();
        var hasFeedback = window._feedbackMap && window._feedbackMap[feedbackKey];

        var urlHtml = '';
        if (job.applicationUrl) {
          urlHtml = '<a class="url-link" href="' + esc(job.applicationUrl) + '" target="_blank">' + esc(truncate(job.applicationUrl, 40)) + '</a>';
        }
        if (job.searchUrl) {
          urlHtml += (urlHtml ? '<br>' : '') + '<a class="url-search" href="' + esc(job.searchUrl) + '" target="_blank">&#x1F50D; Google Search</a>';
        }
        if (!job.applicationUrl && !job.searchUrl) {
          urlHtml = '<span class="url-missing">&#x26A0; Not found</span>';
        }

        if (hasFeedback) {
          urlHtml += '<div class="verified-badge">&#x2705; Verified: ' + esc(truncate(hasFeedback, 40)) + '</div>';
        }

        // Feedback input
        var fromDomain = (emails[0] && emails[0].from) ? emails[0].from.split('@').pop() || '' : '';
        var subjectSnip = (emails[0] && emails[0].subject) ? emails[0].subject.slice(0, 100) : '';
        urlHtml += '<div class="feedback-row">' +
          '<input type="text" class="feedback-input" placeholder="Paste correct URL..." ' +
            'data-company="' + esc(job.company) + '" ' +
            'data-role="' + esc(job.role) + '" ' +
            'data-jobid="' + esc(job.jobId || '') + '" ' +
            'data-source="' + esc(job.source || '') + '" ' +
            'data-fromdomain="' + esc(fromDomain) + '" ' +
            'data-subjectsnippet="' + esc(subjectSnip) + '" />' +
          '<button class="feedback-btn" onclick="submitFeedback(this)">Save</button>' +
        '</div>';

        var conf = job.confidence || 'low';
        var confDot = conf === 'high' ? '&#x1F7E2;' : conf === 'medium' ? '&#x1F7E1;' : '&#x1F534;';
        var confHtml = '<span class="confidence-badge confidence-' + conf + '">' + confDot + ' ' + conf + '</span>';

        var sourceHtml = job.source
          ? '<span class="source-badge">' + esc(job.source) + '</span>'
          : '<span style="color:#334155">—</span>';

        var emailListHtml = emails.map(function(e) {
          return '<div class="email-item">' + esc(e.subject) + '</div>';
        }).join('');

        // Desktop row
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td style="color:#475569;font-weight:600">' + num + '</td>' +
          '<td class="company-cell">' + esc(job.company) + '</td>' +
          '<td class="role-cell">' + esc(job.role) + '</td>' +
          '<td>' + (job.jobId ? '<span class="job-id-cell">' + esc(job.jobId) + '</span>' : '<span style="color:#334155">—</span>') + '</td>' +
          '<td class="location-cell">' + esc(job.location || '—') + '</td>' +
          '<td>' + sourceHtml + '</td>' +
          '<td>' + urlHtml + '</td>' +
          '<td>' + confHtml + '</td>' +
          '<td>' +
            '<button class="email-count-btn" onclick="toggleEmails(this)">' + emails.length + ' email' + (emails.length > 1 ? 's' : '') + '</button>' +
            '<div class="email-list">' + emailListHtml + '</div>' +
          '</td>';
        tbody.appendChild(tr);

        // Mobile card
        var card = document.createElement('div');
        card.className = 'mobile-job-card';
        card.innerHTML =
          '<div class="mobile-job-card-header">' +
            '<div><div class="mobile-job-card-company">' + esc(job.company) + '</div>' +
            '<div class="mobile-job-card-role">' + esc(job.role) + '</div></div>' +
            '<span class="mobile-job-card-num">#' + num + '</span>' +
          '</div>' +
          '<div class="mobile-job-card-row"><span class="mobile-job-card-label">Job ID</span><span class="mobile-job-card-value">' + (job.jobId ? '<span class="job-id-cell">' + esc(job.jobId) + '</span>' : '—') + '</span></div>' +
          '<div class="mobile-job-card-row"><span class="mobile-job-card-label">Location</span><span class="mobile-job-card-value">' + esc(job.location || '—') + '</span></div>' +
          '<div class="mobile-job-card-row"><span class="mobile-job-card-label">Source</span><span class="mobile-job-card-value">' + sourceHtml + '</span></div>' +
          '<div class="mobile-job-card-row"><span class="mobile-job-card-label">URL</span><span class="mobile-job-card-value">' + urlHtml + '</span></div>' +
          '<div class="mobile-job-card-row"><span class="mobile-job-card-label">Confidence</span><span class="mobile-job-card-value">' + confHtml + '</span></div>' +
          '<div class="mobile-job-card-row"><span class="mobile-job-card-label">Emails</span><span class="mobile-job-card-value">' +
            '<button class="email-count-btn" onclick="toggleEmails(this)">' + emails.length + ' email' + (emails.length > 1 ? 's' : '') + '</button>' +
            '<div class="email-list">' + emailListHtml + '</div>' +
          '</span></div>';
        mobileJobs.appendChild(card);
      });

      document.getElementById('jobsSection').classList.add('visible');

      // Skipped emails
      if (data.skippedSubjects && data.skippedSubjects.length > 0) {
        document.getElementById('skippedTitle').textContent = 'Skipped non-job emails (' + data.skippedSubjects.length + ')';
        var list = document.getElementById('skippedList');
        list.innerHTML = data.skippedSubjects.map(function(s) {
          return '<div class="skipped-email">' + esc(s) + '</div>';
        }).join('');
        document.getElementById('skippedSection').classList.add('visible');
      }
    }

    // ─── Helpers ─────────────────────────────────────────────
    function esc(str) {
      var d = document.createElement('div');
      d.textContent = str || '';
      return d.innerHTML;
    }
    function truncate(str, max) {
      return str && str.length > max ? str.slice(0, max) + '...' : (str || '');
    }
    function toggleEmails(btn) {
      var list = btn.nextElementSibling;
      list.classList.toggle('open');
      btn.style.borderColor = list.classList.contains('open') ? '#e94560' : '';
      btn.style.color = list.classList.contains('open') ? '#e94560' : '';
    }
    function toggleSkipped() {
      document.getElementById('skippedList').classList.toggle('open');
      document.getElementById('skippedChevron').classList.toggle('open');
    }

    // ─── Export ──────────────────────────────────────────────
    function exportCSV() {
      var data = window._lastScanData;
      if (!data || !data.jobs.length) return;

      var rows = [['Company','Role','Job ID','Location','Source','URL','Confidence','Emails']];
      data.jobs.forEach(function(g) {
        var j = g.job;
        rows.push([
          j.company, j.role, j.jobId || '', j.location || '',
          j.source || '', j.applicationUrl || j.searchUrl || '',
          j.confidence || '', g.emails.length.toString()
        ]);
      });

      var csv = rows.map(function(r) {
        return r.map(function(c) { return '"' + (c || '').replace(/"/g, '""') + '"'; }).join(',');
      }).join('\\n');

      var blob = new Blob([csv], { type: 'text/csv' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'job-scan-' + new Date().toISOString().slice(0,10) + '.csv';
      a.click();
    }

    function exportJSON() {
      var data = window._lastScanData;
      if (!data || !data.jobs.length) return;

      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'job-scan-' + new Date().toISOString().slice(0,10) + '.json';
      a.click();
    }

    // ─── Feedback ────────────────────────────────────────────
    window._feedbackMap = {};

    async function loadFeedbackMap() {
      try {
        var res = await fetch('/api/feedback');
        var data = await res.json();
        (data.entries || []).forEach(function(e) {
          var key = (e.company + '|' + e.role).toLowerCase();
          window._feedbackMap[key] = e.correctUrl;
        });
      } catch (e) { /* ignore */ }
    }

    async function submitFeedback(btn) {
      var input = btn.previousElementSibling;
      var url = input.value.trim();
      if (!url) return;

      btn.disabled = true;
      btn.textContent = '...';

      try {
        var res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: input.dataset.company,
            role: input.dataset.role,
            jobId: input.dataset.jobid || null,
            source: input.dataset.source || null,
            fromDomain: input.dataset.fromdomain,
            subjectSnippet: input.dataset.subjectsnippet,
            correctUrl: url
          })
        });

        if (!res.ok) throw new Error('Failed');

        var key = (input.dataset.company + '|' + input.dataset.role).toLowerCase();
        window._feedbackMap[key] = url;

        var row = btn.closest('.feedback-row');
        row.innerHTML = '<span class="verified-badge">&#x2705; Saved: ' + esc(truncate(url, 40)) + '</span>';
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Save';
        btn.style.borderColor = '#ef4444';
        btn.style.color = '#ef4444';
        setTimeout(function() {
          btn.style.borderColor = '';
          btn.style.color = '';
        }, 2000);
      }
    }

    async function loadLastScan() {
      var btn = document.getElementById('loadLastBtn');
      btn.disabled = true;
      btn.textContent = 'Loading...';

      try {
        var res = await fetch('/api/last-scan');
        if (!res.ok) throw new Error('No previous scan found');
        var data = await res.json();
        renderResults(data.result);
      } catch (e) {
        document.getElementById('errorText').textContent = e.message;
        document.getElementById('errorBanner').classList.add('visible');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Load Last Scan';
      }
    }

    // ─── Stats ───────────────────────────────────────────────
    async function loadStats() {
      try {
        var res = await fetch('/api/stats');
        if (!res.ok) return;
        var s = await res.json();

        document.getElementById('fbTotal').textContent = s.totalFeedback;
        document.getElementById('fbCompanies').textContent = s.uniqueCompanies;

        if (s.lastScan) {
          var pct = s.lastScan.totalJobs > 0
            ? Math.round((s.lastScan.highConfidence / s.lastScan.totalJobs) * 100) + '%'
            : '—';
          document.getElementById('fbAccuracy').textContent = pct;
          document.getElementById('fbVerified').textContent =
            s.lastScan.feedbackMatches + '/' + s.lastScan.totalJobs;
        }
      } catch (e) { /* ignore */ }
    }

    // Load feedback map and stats on init
    loadFeedbackMap();
    loadStats();
  </script>

</body>
</html>`;
}
