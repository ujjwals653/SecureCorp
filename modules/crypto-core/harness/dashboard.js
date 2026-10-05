/**
 * SecureCorp Engineering Operations Hub — Interactive Controller
 * Connects directly to Web Crypto API (@securecorp/crypto-core)
 */
import * as cc from '../src/index.js';

// Items dataset representing Engineers & Autonomous System Modules
const ITEMS_DATA = [
  {
    id: 'alice',
    type: 'engineer',
    name: 'Alice Chen',
    role: 'Cryptographic Protocol Lead',
    status: 'active', // Green dot pill
    statusLabel: 'Active',
    avatar: 'AC',
    desc: 'Implementing client-side envelope assembly (§7.1) and RSA-PSS signature bindings.',
    currentTask: 'Act 3 File Sharing & Envelope Packaging',
    progress: 88,
    progressColor: 'green',
    tech: ['Web Crypto', 'RSA-OAEP', 'RSA-PSS', 'AES-256-GCM', 'TypeScript'],
    updated: 'Just now'
  },
  {
    id: 'crypto-engine',
    type: 'module',
    name: 'Crypto Core Module',
    role: 'Zero-Knowledge Engine (In-Browser)',
    status: 'completed', // Blue dot pill
    statusLabel: 'Completed',
    avatar: 'CC',
    desc: '30/30 unit tests passing. Strict verify-before-decrypt order and non-extractable keys.',
    currentTask: 'All 6 Definition-of-Done items verified',
    progress: 100,
    progressColor: 'blue',
    tech: ['window.crypto.subtle', 'SubtleCrypto', 'RFC 8017', 'NIST SP 800-38D'],
    updated: '2m ago'
  },
  {
    id: 'bob',
    type: 'engineer',
    name: 'Bob Smith',
    role: 'Frontend Experience & Security UX',
    status: 'active', // Green dot pill
    statusLabel: 'Active',
    avatar: 'BS',
    desc: 'Building file receive & decryption screen, handling unwrap errors (Act 6 Eve defense).',
    currentTask: 'Key unwrap pipeline & UI alerts',
    progress: 74,
    progressColor: 'green',
    tech: ['React 19', 'Web Crypto', 'IndexedDB', 'Tailwind CSS', 'Vite'],
    updated: '4m ago'
  },
  {
    id: 'backend-api',
    type: 'module',
    name: 'Flask Portal API',
    role: 'RBAC & Ciphertext Envelope Store',
    status: 'active', // Green dot pill
    statusLabel: 'Active',
    avatar: 'BP',
    desc: 'Restricting access to envelopes. Only stores base64 ciphertext and wrapped keys.',
    currentTask: 'RBAC endpoint /api/files/<file_id>',
    progress: 65,
    progressColor: 'green',
    tech: ['Python 3.12', 'Flask', 'SQLite', 'cryptography', 'REST'],
    updated: '11m ago'
  },
  {
    id: 'pki-service',
    type: 'module',
    name: 'PKI / Mini-CA',
    role: 'X.509 Identity & Certificate Authority',
    status: 'completed', // Blue dot pill
    statusLabel: 'Completed',
    avatar: 'CA',
    desc: 'Issues root TLS certs and co-signs registered public keys (§7.3) for mutual TLS.',
    currentTask: 'Root CA certificate chain generated',
    progress: 100,
    progressColor: 'blue',
    tech: ['X.509', 'cryptography.x509', 'OpenSSL', 'SPKI DER'],
    updated: '18m ago'
  },
  {
    id: 'ids-monitor',
    type: 'module',
    name: 'Intrusion Detection System',
    role: 'Traffic Classifier & Live Defense',
    status: 'active', // Green dot pill
    statusLabel: 'Active',
    avatar: 'ID',
    desc: 'Monitoring server inbound packets for port scans and brute force from Mallory (Act 5).',
    currentTask: 'Real-time packet capture parser',
    progress: 82,
    progressColor: 'green',
    tech: ['Scapy', 'Packet Sniffing', 'Wireshark', 'Python'],
    updated: '7m ago'
  },
  {
    id: 'eve',
    type: 'engineer',
    name: 'Eve Vance',
    role: 'Security Audit & Penetration Testing',
    status: 'break', // Amber dot pill
    statusLabel: 'On Break',
    avatar: 'EV',
    desc: 'Verifying Act 6 defense: proving that unauthorized users cannot unwrap Bob’s AES key.',
    currentTask: 'Awaiting Checkpoint 3 integration',
    progress: 40,
    progressColor: 'amber',
    tech: ['Burp Suite', 'Wireshark', 'API Fuzzing', 'CNS Audit'],
    updated: '35m ago'
  },
  {
    id: 'mallory',
    type: 'engineer',
    name: 'Mallory (Red Team)',
    role: 'Adversarial Attack Simulation',
    status: 'break', // Amber dot pill
    statusLabel: 'On Break',
    avatar: 'MA',
    desc: 'Scripts prepared for SYN port scan and brute force against Portal API login routes.',
    currentTask: 'Standby for live demonstration Act 5',
    progress: 50,
    progressColor: 'amber',
    tech: ['Nmap', 'Python Scripts', 'Hydra', 'Packet Flooding'],
    updated: '42m ago'
  },
  {
    id: 'test-harness',
    type: 'module',
    name: 'Integration Test Suite',
    role: 'Automated Module Verification',
    status: 'active', // Green dot pill
    statusLabel: 'Active',
    avatar: 'TH',
    desc: 'Running cross-module integration tests at Checkpoints 1 through 4.',
    currentTask: 'Mock Portal API swap verification',
    progress: 90,
    progressColor: 'green',
    tech: ['Node.js', 'node:test', 'Web Crypto API', 'Docker Compose'],
    updated: '1m ago'
  },
  {
    id: 'docker-infra',
    type: 'module',
    name: 'Docker Infrastructure',
    role: 'Container Orchestration & Deployment',
    status: 'active', // Green dot pill
    statusLabel: 'Active',
    avatar: 'DK',
    desc: 'Configuring multi-service docker-compose setup for backend, frontend, and IDS.',
    currentTask: 'Resolving frontend crypto-core relative build path',
    progress: 78,
    progressColor: 'green',
    tech: ['Docker', 'docker-compose', 'Alpine Linux', 'Networking'],
    updated: '8m ago'
  }
];

const $ = (id) => document.getElementById(id);

let currentFilter = 'all';
let searchQuery = '';

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function updateClock() {
  const now = new Date();
  $('live-clock').textContent = now.toTimeString().split(' ')[0] + ' UTC';
}

function getBadgeHtml(status) {
  if (status === 'active') {
    return `<span class="dot-pill dot-pill-active"><span class="dot"></span> Active</span>`;
  }
  if (status === 'completed') {
    return `<span class="dot-pill dot-pill-completed"><span class="dot"></span> Completed</span>`;
  }
  if (status === 'break') {
    return `<span class="dot-pill dot-pill-break"><span class="dot"></span> On Break</span>`;
  }
  return '';
}

function renderCards() {
  const grid = $('items-grid');
  grid.innerHTML = '';

  const filtered = ITEMS_DATA.filter((item) => {
    const matchesFilter = currentFilter === 'all' || item.status === currentFilter;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery) ||
      item.role.toLowerCase().includes(searchQuery) ||
      item.desc.toLowerCase().includes(searchQuery) ||
      item.tech.some((t) => t.toLowerCase().includes(searchQuery));
    return matchesFilter && matchesSearch;
  });

  $('visible-counter').textContent = `Showing ${filtered.length} of ${ITEMS_DATA.length} items`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--text-muted); background: var(--surface-card); border: 1px dashed var(--border-card); border-radius: var(--radius-card);">
        No matching engineers or services found for "${searchQuery}".
      </div>
    `;
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'item-card';

    const techBadgesHtml = item.tech
      .map((t) => `<span class="tech-badge">${t}</span>`)
      .join('');

    card.innerHTML = `
      <div class="card-top">
        <div class="avatar-info">
          <div class="card-avatar">${item.avatar}</div>
          <div class="card-meta-text">
            <span class="card-title">${item.name}</span>
            <span class="card-role">${item.role}</span>
          </div>
        </div>
        ${getBadgeHtml(item.status)}
      </div>

      <p class="card-desc">${item.desc}</p>

      <div class="task-progress-box">
        <div class="task-progress-header">
          <span class="task-title">${item.currentTask}</span>
          <span class="task-pct">${item.progress}%</span>
        </div>
        <div class="task-bar-bg">
          <div class="task-bar-fill ${item.progressColor}" style="width: ${item.progress}%"></div>
        </div>
      </div>

      <div class="tech-badges-list">
        ${techBadgesHtml}
      </div>

      <div class="card-footer">
        <span class="card-time">Updated ${item.updated}</span>
        <button class="btn-card-action" data-id="${item.id}">Inspect Details</button>
      </div>
    `;

    grid.appendChild(card);
  });

  // Attach card action listeners
  grid.querySelectorAll('.btn-card-action').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const found = ITEMS_DATA.find((x) => x.id === id);
      if (found) {
        toast(`${found.name}: Status is ${found.statusLabel} (${found.currentTask})`);
        appendActivityLog(found.name, `Inspected status details: ${found.currentTask}`);
      }
    });
  });
}

function updateCounts() {
  const activeCount = ITEMS_DATA.filter((i) => i.status === 'active').length;
  const completedCount = ITEMS_DATA.filter((i) => i.status === 'completed').length;
  const breakCount = ITEMS_DATA.filter((i) => i.status === 'break').length;

  $('count-all').textContent = ITEMS_DATA.length;
  $('count-active').textContent = activeCount;
  $('count-completed').textContent = completedCount;
  $('count-break').textContent = breakCount;

  $('metric-active-count').textContent = activeCount;
  $('metric-completed-count').textContent = completedCount;
  $('metric-break-count').textContent = breakCount;
}

function setupFilters() {
  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderCards();
    });
  });

  const search = $('global-search');
  search.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderCards();
  });

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      search.focus();
    }
  });
}

function appendActivityLog(actor, message) {
  const feed = $('activity-feed');
  const now = new Date().toTimeString().split(' ')[0];
  const item = document.createElement('div');
  item.className = 'activity-item';
  item.innerHTML = `
    <span class="activity-time">${now}</span>
    <span class="activity-text"><span class="actor">${actor}</span> ${message}</span>
  `;
  feed.prepend(item);
}

// -------------------------------------------------------------------
// Live Web Crypto API Benchmark Tool
// -------------------------------------------------------------------
async function runLiveCryptoBenchmark() {
  const btn = $('btn-trigger-bench');
  btn.textContent = 'Measuring...';
  btn.disabled = true;

  try {
    appendActivityLog('Benchmark', 'Starting live SubtleCrypto performance run...');

    // 1. RSA-OAEP KeyGen
    const t0 = performance.now();
    const keyPair = await cc.generateKeyPair();
    const rsaDuration = performance.now() - t0;
    $('bench-rsa-time').textContent = `${rsaDuration.toFixed(1)} ms`;

    // 2. AES-256-GCM 1 MB Encrypt
    const oneMb = new Uint8Array(1024 * 1024);
    globalThis.crypto.getRandomValues(oneMb.subarray(0, 65536)); // partial fill for speed
    const aesKey = await cc.generateFileKey();
    const t1 = performance.now();
    const { ciphertext } = await cc.encryptFile(oneMb, aesKey);
    const aesDuration = performance.now() - t1;
    $('bench-aes-time').textContent = `${aesDuration.toFixed(1)} ms (${(1000 / aesDuration).toFixed(0)} MB/s)`;

    // 3. RSA-PSS-2048 Sign + Verify
    const sigKeys = await cc.generateSigningKeyPair();
    const sampleData = cc.utf8Encode('SecureCorp benchmark sample payload');
    const t2 = performance.now();
    const sig = await cc.sign(sampleData, sigKeys.privateKey);
    const valid = await cc.verify(sampleData, sig, sigKeys.publicKey);
    const pssDuration = performance.now() - t2;
    $('bench-pss-time').textContent = `${pssDuration.toFixed(1)} ms (Valid: ${valid})`;

    appendActivityLog('Benchmark', `Completed: RSA-2048 in ${rsaDuration.toFixed(0)}ms, AES in ${aesDuration.toFixed(0)}ms`);
    toast('Web Crypto API benchmark completed!');
  } catch (err) {
    appendActivityLog('Benchmark', `Failed: ${err.message}`);
    toast(`Benchmark failed: ${err.message}`);
  } finally {
    btn.textContent = 'Measure Performance Now';
    btn.disabled = false;
  }
}

// Initialization
window.addEventListener('DOMContentLoaded', () => {
  setInterval(updateClock, 1000);
  updateClock();

  updateCounts();
  renderCards();
  setupFilters();

  $('btn-trigger-bench').addEventListener('click', runLiveCryptoBenchmark);
  $('btn-quick-key-test').addEventListener('click', runLiveCryptoBenchmark);

  // Initial activity logs
  appendActivityLog('System', 'Obsidian dark-mode engineering hub initialized (#0c0e12).');
  appendActivityLog('Crypto Core', 'Native Web Crypto API active. 30/30 unit tests verified.');
  appendActivityLog('Auth & RBAC', 'Portal API tickets ready for Checkpoint 2 integration.');
});
