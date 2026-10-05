/**
 * Interactive Client-Side Application for Crypto Core Test Lab.
 * Runs in-browser using native Web Crypto API.
 */
import * as cc from '../src/index.js';
import { cases, DEFINITION_OF_DONE } from '../test/cases.js';

// Global state
const state = {
  personas: {
    alice: { id: 'alice', name: 'Alice Chen', role: 'Security Lead (Sender)', color: 'violet', enc: null, sig: null, spki: '', sigSpki: '', fp: '' },
    bob: { id: 'bob', name: 'Bob Smith', role: 'Executive (Authorized Recipient)', color: 'teal', enc: null, sig: null, spki: '', sigSpki: '', fp: '' },
    eve: { id: 'eve', name: 'Eve Vance', role: 'Unauthorized Insider (Act 6 Demo)', color: 'rose', enc: null, sig: null, spki: '', sigSpki: '', fp: '' },
    mallory: { id: 'mallory', name: 'Mallory', role: 'Attacker (Signature Forgery)', color: 'rose', enc: null, sig: null, spki: '', sigSpki: '', fp: '' },
  },
  selectedFile: null,
  lastEnvelope: null,
  serverStore: [],
  selectedEnvelopeId: null,
};

// Utilities
const $ = (id) => document.getElementById(id);
const nowIso = () => new Date().toISOString();

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function log(level, message) {
  const container = $('log');
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const row = document.createElement('div');
  row.className = `log-line ${level}`;
  row.innerHTML = `<span class="log-time">${time}</span><span class="log-lvl">${level.toUpperCase()}</span><span class="log-msg">${escapeHtml(message)}</span>`;
  container.prepend(row);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function formatJsonSyntax(obj) {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'j-val';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'j-key';
      } else {
        cls = 'j-str';
      }
    } else if (/null/.test(match)) {
      cls = 'j-null';
    }
    return `<span class="${cls}">${escapeHtml(match)}</span>`;
  });
}

function flipBase64Byte(b64, index = 0) {
  const bytes = cc.base64ToBytes(b64).slice();
  bytes[index % bytes.length] ^= 0x01;
  return cc.bytesToBase64(bytes);
}

// -------------------------------------------------------------
// Tabs Navigation
// -------------------------------------------------------------
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  const indicator = $('tab-indicator');

  function updateIndicator(activeTab) {
    indicator.style.left = `${activeTab.offsetLeft}px`;
    indicator.style.width = `${activeTab.offsetWidth}px`;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach((p) => (p.hidden = true));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const targetPanel = $(`panel-${tab.dataset.tab}`);
      if (targetPanel) targetPanel.hidden = false;
      updateIndicator(tab);
    });
  });

  const activeTab = document.querySelector('.tab.active');
  if (activeTab) updateIndicator(activeTab);
  window.addEventListener('resize', () => {
    const cur = document.querySelector('.tab.active');
    if (cur) updateIndicator(cur);
  });
}

// -------------------------------------------------------------
// Environment Check
// -------------------------------------------------------------
function checkEnvironment() {
  const pills = $('status-pills');
  const available = cc.isWebCryptoAvailable();
  const secure = window.isSecureContext;

  pills.innerHTML = `
    <div class="pill ${available ? '' : 'bad'}">
      <span class="dot"></span>
      <span>${available ? 'window.crypto.subtle Active' : 'Web Crypto Unavailable'}</span>
    </div>
    <div class="pill ${secure ? '' : 'bad'}">
      <span class="dot"></span>
      <span>${secure ? 'Secure Context (127.0.0.1 / HTTPS)' : 'Insecure Context'}</span>
    </div>
  `;

  if (!available) {
    log('err', 'Web Crypto API is not accessible in this context. Run via 127.0.0.1 or localhost.');
  } else {
    log('info', 'Crypto Core Lab ready. Web Crypto API SubtleCrypto verified.');
  }
}

// -------------------------------------------------------------
// Personas & Key Management (Act 2)
// -------------------------------------------------------------
function renderPersonas() {
  const grid = $('persona-grid');
  grid.innerHTML = '';

  const visibleKeys = ['alice', 'bob', 'eve'];

  visibleKeys.forEach((key) => {
    const p = state.personas[key];
    const isReady = p.enc && p.sig;

    const card = document.createElement('div');
    card.className = 'card persona';
    card.dataset.color = p.color;

    card.innerHTML = `
      <div class="persona-top">
        <div class="avatar">${p.name[0]}</div>
        <div>
          <div class="persona-name">${p.name}</div>
          <div class="persona-role">${p.role}</div>
        </div>
        <span class="persona-status ${isReady ? 'ready' : ''}">${isReady ? 'KEYS ACTIVE' : 'NO KEYS'}</span>
      </div>

      <div class="chips">
        <span class="chip">RSA-OAEP-2048</span>
        <span class="chip alt">RSA-PSS-2048</span>
        <span class="chip lock">Non-extractable Private</span>
      </div>

      ${
        isReady
          ? `
        <div class="kv">
          <div class="kv-row">
            <span class="kv-label"><span>Wrapping Public Key (SPKI Fingerprint)</span></span>
            <span class="kv-value fp">${p.fp.slice(0, 16)}...${p.fp.slice(-16)}</span>
          </div>
          <div class="kv-row">
            <span class="kv-label"><span>Base64 SPKI Length</span></span>
            <span class="kv-value">${p.spki.length} chars (~294 bytes DER)</span>
          </div>
        </div>
        <div class="reg-json" id="reg-json-${p.id}">
          <pre class="code" id="reg-code-${p.id}"></pre>
        </div>
      `
          : `<div class="persona-empty">Asymmetric keypairs not yet generated.</div>`
      }

      <div class="persona-actions">
        <button class="btn btn-primary btn-sm" id="btn-gen-${p.id}">
          ${isReady ? 'Regenerate Keys' : 'Generate Keypair'}
        </button>
        ${
          isReady
            ? `
          <button class="btn btn-ghost btn-sm" id="btn-toggle-reg-${p.id}">View §7.3 Reg JSON</button>
          <button class="btn btn-ghost btn-sm" id="btn-copy-spki-${p.id}">Copy Public SPKI</button>
        `
            : ''
        }
      </div>
    `;

    grid.appendChild(card);

    // Event listeners
    $(`btn-gen-${p.id}`).addEventListener('click', () => generatePersonaKeys(p.id));

    if (isReady) {
      $(`btn-toggle-reg-${p.id}`).addEventListener('click', async () => {
        const box = $(`reg-json-${p.id}`);
        const code = $(`reg-code-${p.id}`);
        if (box.classList.contains('open')) {
          box.classList.remove('open');
        } else {
          const reg = await cc.createPublicKeyRegistration({ userId: p.id, publicKey: p.enc.publicKey });
          code.innerHTML = formatJsonSyntax(reg);
          box.classList.add('open');
        }
      });

      $(`btn-copy-spki-${p.id}`).addEventListener('click', async () => {
        await navigator.clipboard.writeText(p.spki);
        toast(`${p.name}'s SPKI base64 copied!`);
      });
    }
  });

  updateSelectDropdowns();
}

async function generatePersonaKeys(id) {
  const p = state.personas[id];
  const btn = $(`btn-gen-${id}`);
  if (btn) btn.classList.add('loading');

  try {
    log('info', `[${id}] Generating RSA-OAEP-2048 encryption keypair...`);
    const enc = await cc.generateKeyPair();

    log('info', `[${id}] Generating RSA-PSS-2048 digital signing keypair...`);
    const sig = await cc.generateSigningKeyPair();

    const spki = await cc.exportPublicKeyAsBase64(enc.publicKey);
    const sigSpki = await cc.exportPublicKeyAsBase64(sig.publicKey);
    const fp = await cc.getPublicKeyFingerprint(enc.publicKey);

    p.enc = enc;
    p.sig = sig;
    p.spki = spki;
    p.sigSpki = sigSpki;
    p.fp = fp;

    log('ok', `[${id}] Keypairs active in memory. Private keys protected (non-extractable).`);
    toast(`${p.name} keys generated successfully.`);
  } catch (err) {
    log('err', `Key generation failed for ${id}: ${err.message}`);
    toast(`Failed to generate keys: ${err.message}`);
  } finally {
    if (btn) btn.classList.remove('loading');
    renderPersonas();
  }
}

async function generateAllPersonas() {
  const btn = $('btn-generate-all');
  btn.classList.add('loading');
  try {
    for (const id of ['alice', 'bob', 'eve', 'mallory']) {
      await generatePersonaKeys(id);
    }
    toast('All personas (Alice, Bob, Eve, Mallory) generated!');
  } finally {
    btn.classList.remove('loading');
  }
}

function updateSelectDropdowns() {
  const senderSel = $('share-sender');
  const recipSel = $('share-recipient');
  const recvSel = $('receive-as');

  const prevSender = senderSel.value;
  const prevRecip = recipSel.value;
  const prevRecv = recvSel.value;

  const buildOpts = (selected) => {
    return ['alice', 'bob', 'eve']
      .map((k) => {
        const p = state.personas[k];
        const status = p.enc ? '✓ Ready' : '⚠️ No Keys';
        return `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${p.name} (${p.id}) — ${status}</option>`;
      })
      .join('');
  };

  senderSel.innerHTML = buildOpts(prevSender || 'alice');
  recipSel.innerHTML = buildOpts(prevRecip || 'bob');
  recvSel.innerHTML = buildOpts(prevRecv || 'bob');
}

// -------------------------------------------------------------
// Encrypt & Share (Act 3)
// -------------------------------------------------------------
function setupShareHandlers() {
  const dropzone = $('dropzone');
  const fileInput = $('file-input');
  const dzFile = $('dz-file');

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      state.selectedFile = fileInput.files[0];
      dzFile.textContent = `${state.selectedFile.name} (${formatBytes(state.selectedFile.size)})`;
      $('share-filename').value = state.selectedFile.name;
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    if (e.dataTransfer.files.length > 0) {
      state.selectedFile = e.dataTransfer.files[0];
      fileInput.files = e.dataTransfer.files;
      dzFile.textContent = `${state.selectedFile.name} (${formatBytes(state.selectedFile.size)})`;
      $('share-filename').value = state.selectedFile.name;
    }
  });

  $('btn-encrypt').addEventListener('click', executeSharePipeline);

  $('btn-copy-envelope').addEventListener('click', async () => {
    if (state.lastEnvelope) {
      await navigator.clipboard.writeText(JSON.stringify(state.lastEnvelope, null, 2));
      toast('Encrypted Envelope JSON copied to clipboard!');
    }
  });

  $('btn-download-envelope').addEventListener('click', () => {
    if (!state.lastEnvelope) return;
    const blob = new Blob([JSON.stringify(state.lastEnvelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `envelope-${state.lastEnvelope.file_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $('btn-goto-receive').addEventListener('click', () => {
    $('tab-receive').click();
  });
}

function updatePipelineStep(containerId, index, stateClass, title, detail, durationMs = null) {
  const container = $(containerId);
  let el = container.querySelector(`[data-index="${index}"]`);
  if (!el) {
    el = document.createElement('li');
    el.className = 'step';
    el.dataset.index = index;
    el.innerHTML = `
      <span class="step-dot">${index + 1}</span>
      <div>
        <div class="step-title"></div>
        <div class="step-detail"></div>
      </div>
      <div class="step-time"></div>
    `;
    container.appendChild(el);
  }

  el.dataset.state = stateClass;
  el.querySelector('.step-title').textContent = title;
  el.querySelector('.step-detail').textContent = detail;
  if (durationMs !== null) {
    el.querySelector('.step-time').textContent = `${durationMs.toFixed(1)} ms`;
  }
}

async function executeSharePipeline() {
  const senderId = $('share-sender').value;
  const recipientId = $('share-recipient').value;
  const sender = state.personas[senderId];
  const recipient = state.personas[recipientId];

  if (!sender.sig) {
    toast(`Sender ${sender.name} must generate keys first!`);
    $('tab-identities').click();
    return;
  }
  if (!recipient.enc) {
    toast(`Recipient ${recipient.name} must generate keys first!`);
    $('tab-identities').click();
    return;
  }

  const btn = $('btn-encrypt');
  btn.classList.add('loading');
  const pipeline = 'share-pipeline';
  $(pipeline).innerHTML = '';
  const startTime = performance.now();

  try {
    // 1. Resolve payload bytes
    let fileBytes;
    let filename = $('share-filename').value.trim() || 'payload.bin';

    if (state.selectedFile) {
      fileBytes = new Uint8Array(await state.selectedFile.arrayBuffer());
    } else {
      const text = $('share-text').value;
      fileBytes = cc.utf8Encode(text);
    }

    updatePipelineStep(pipeline, 0, 'running', '1. Input Preparation', `Loaded ${formatBytes(fileBytes.length)} for "${filename}"`);
    await new Promise((r) => setTimeout(r, 60));
    updatePipelineStep(pipeline, 0, 'done', '1. Input Preparation', `Ready: ${formatBytes(fileBytes.length)}`);

    // 2. AES keygen & file encryption
    const t0 = performance.now();
    updatePipelineStep(pipeline, 1, 'running', '2. AES-256-GCM Encryption', 'Generating fresh ephemeral key & 12-byte IV...');
    const aesKey = await cc.generateFileKey();
    const { ciphertext, iv } = await cc.encryptFile(fileBytes, aesKey);
    const tEncrypt = performance.now() - t0;
    updatePipelineStep(pipeline, 1, 'done', '2. AES-256-GCM Encryption', `Encrypted (${cc.base64ToBytes(ciphertext).length} B ciphertext)`, tEncrypt);

    // 3. RSA-OAEP Key Wrapping
    const t1 = performance.now();
    updatePipelineStep(pipeline, 2, 'running', '3. RSA-OAEP Key Wrapping', `Wrapping AES key with ${recipient.name}'s public key...`);
    const wrapped_key = await cc.wrapKey(aesKey, recipient.enc.publicKey);
    const tWrap = performance.now() - t1;
    updatePipelineStep(pipeline, 2, 'done', '3. RSA-OAEP Key Wrapping', `Wrapped (256 bytes RSA ciphertext)`, tWrap);

    // 4. RSA-PSS Digital Signature
    const t2 = performance.now();
    updatePipelineStep(pipeline, 3, 'running', '4. RSA-PSS Digital Signature', `Signing raw (ciphertext || iv) with ${sender.name}'s private key...`);
    const sigPayload = cc.buildSignaturePayload(ciphertext, iv);
    const signature = await cc.sign(sigPayload, sender.sig.privateKey);
    const tSign = performance.now() - t2;
    updatePipelineStep(pipeline, 3, 'done', '4. RSA-PSS Digital Signature', `Signed (${cc.base64ToBytes(signature).length} bytes signature)`, tSign);

    // 5. Envelope Assembly
    const envelope = {
      file_id: globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : `file-${Date.now()}`,
      sender_id: senderId,
      recipient_id: recipientId,
      ciphertext,
      iv,
      wrapped_key,
      signature,
      filename,
      timestamp: nowIso(),
    };
    cc.validateEnvelope(envelope);
    updatePipelineStep(pipeline, 4, 'done', '5. Envelope Validation', 'Compliant with PROJECT_CONTEXT.md §7.1');

    const totalTime = performance.now() - startTime;
    $('share-total').textContent = `Total: ${totalTime.toFixed(1)} ms`;

    state.lastEnvelope = envelope;
    state.serverStore.unshift(envelope);
    renderServerStorage();

    // Display in Envelope Card
    $('envelope-card').hidden = false;
    $('envelope-json').innerHTML = formatJsonSyntax(envelope);
    $('envelope-stats').innerHTML = `
      <div class="stat"><div class="stat-label">Envelope ID</div><div class="stat-value small">${envelope.file_id.slice(0, 13)}...</div></div>
      <div class="stat"><div class="stat-label">Sender</div><div class="stat-value">${sender.name}</div></div>
      <div class="stat"><div class="stat-label">Recipient</div><div class="stat-value">${recipient.name}</div></div>
      <div class="stat"><div class="stat-label">Original Size</div><div class="stat-value">${formatBytes(fileBytes.length)}</div></div>
      <div class="stat"><div class="stat-label">Total Time</div><div class="stat-value">${totalTime.toFixed(1)} ms</div></div>
    `;

    log('ok', `[Act 3] Envelope created: "${filename}" (${senderId} → ${recipientId}). Stored in simulated server mailbox.`);
    toast('Encrypted envelope generated & stored!');
  } catch (err) {
    log('err', `Encryption pipeline failed: ${err.message}`);
    toast(`Failed: ${err.message}`);
  } finally {
    btn.classList.remove('loading');
  }
}

// -------------------------------------------------------------
// Receive & Decrypt (Act 3 & Act 6)
// -------------------------------------------------------------
function renderServerStorage() {
  const list = $('server-list');
  $('server-count').textContent = `${state.serverStore.length} envelopes`;

  if (state.serverStore.length === 0) {
    list.innerHTML = `<div class="server-empty">Server mailbox empty. Encrypt a file in Tab 2 or paste envelope JSON below.</div>`;
    return;
  }

  list.innerHTML = '';
  state.serverStore.forEach((env) => {
    const isSelected = env.file_id === state.selectedEnvelopeId;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `server-item ${isSelected ? 'selected' : ''}`;
    item.innerHTML = `
      <div class="si-icon">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div>
        <div class="si-name">${escapeHtml(env.filename)}</div>
        <div class="si-meta">${escapeHtml(env.sender_id)} &rarr; ${escapeHtml(env.recipient_id)} &middot; ${env.file_id.slice(0, 8)}</div>
      </div>
      <div class="si-size">${formatBytes(cc.base64ToBytes(env.ciphertext).length)}</div>
    `;

    item.addEventListener('click', () => {
      state.selectedEnvelopeId = env.file_id;
      renderServerStorage();
      log('info', `Selected envelope ${env.file_id.slice(0, 8)} for decryption inspection.`);
    });

    list.appendChild(item);
  });

  if (!state.selectedEnvelopeId && state.serverStore.length > 0) {
    state.selectedEnvelopeId = state.serverStore[0].file_id;
  }
}

function setupReceiveHandlers() {
  $('btn-import-envelope').addEventListener('click', () => {
    const raw = $('paste-envelope').value.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      cc.validateEnvelope(parsed);
      state.serverStore.unshift(parsed);
      state.selectedEnvelopeId = parsed.file_id;
      renderServerStorage();
      toast('Imported valid envelope into server storage!');
      log('ok', `Imported envelope ${parsed.file_id} via JSON paste.`);
    } catch (err) {
      toast(`Invalid envelope: ${err.message}`);
      log('err', `Import failed: ${err.message}`);
    }
  });

  $('btn-decrypt').addEventListener('click', executeReceivePipeline);
}

async function executeReceivePipeline() {
  const currentEnv = state.serverStore.find((e) => e.file_id === state.selectedEnvelopeId) || state.lastEnvelope;
  if (!currentEnv) {
    toast('No envelope selected to decrypt!');
    return;
  }

  const receiverId = $('receive-as').value;
  const receiver = state.personas[receiverId];
  const claimedSender = state.personas[currentEnv.sender_id];

  if (!receiver.enc) {
    toast(`${receiver.name} must generate keys in Tab 1 first.`);
    return;
  }

  const pipeline = 'receive-pipeline';
  $(pipeline).innerHTML = '';
  const resultCard = $('result-card');
  resultCard.hidden = true;
  const btn = $('btn-decrypt');
  btn.classList.add('loading');

  // Clone envelope to allow attack simulations without mutating original
  let targetEnv = JSON.parse(JSON.stringify(currentEnv));

  // Attack 1: Flip ciphertext byte
  if ($('tamper-ciphertext').checked) {
    targetEnv.ciphertext = flipBase64Byte(targetEnv.ciphertext, 4);
    log('warn', 'Simulating Attack: Flipped 1 byte in ciphertext in transit.');
  }

  // Attack 2: Corrupt signature
  if ($('tamper-signature').checked) {
    targetEnv.signature = flipBase64Byte(targetEnv.signature, 8);
    log('warn', 'Simulating Attack: Corrupted digital signature in transit.');
  }

  // Attack 3: Mallory re-signs with her own key (forgery)
  if ($('tamper-forge').checked) {
    if (!state.personas.mallory.sig) {
      await generatePersonaKeys('mallory');
    }
    const payload = cc.buildSignaturePayload(targetEnv.ciphertext, targetEnv.iv);
    targetEnv.signature = await cc.sign(payload, state.personas.mallory.sig.privateKey);
    log('warn', 'Simulating Attack: Mallory re-signed the envelope payload with attacker private key.');
  }

  try {
    // Step 1: Structural Validation
    updatePipelineStep(pipeline, 0, 'running', '1. Structural Verification', 'Checking §7.1 required schema fields & base64 encoding...');
    await new Promise((r) => setTimeout(r, 40));
    cc.validateEnvelope(targetEnv);
    updatePipelineStep(pipeline, 0, 'done', '1. Structural Verification', '9 contract fields valid, 12-byte IV verified');

    // Step 2: Digital Signature Verification (BEFORE Decrypting!)
    updatePipelineStep(pipeline, 1, 'running', '2. RSA-PSS Signature Verification', `Verifying signature against ${claimedSender.name}'s public key...`);
    const tSigStart = performance.now();
    const payload = cc.buildSignaturePayload(targetEnv.ciphertext, targetEnv.iv);

    let senderSigningKey = claimedSender?.sig?.publicKey;
    if (!senderSigningKey) {
      // Import from known SPKI if present
      senderSigningKey = await cc.importSigningPublicKey(claimedSender.sigSpki);
    }

    const sigValid = await cc.verify(payload, targetEnv.signature, senderSigningKey);
    const tSig = performance.now() - tSigStart;

    if (!sigValid) {
      updatePipelineStep(pipeline, 1, 'error', '2. RSA-PSS Signature Verification', 'FAILED: Signature mismatch or corrupted data', tSig);
      throw new cc.CryptoCoreError(
        cc.ErrorCodes.SIGNATURE_INVALID,
        `Digital signature verification failed! The file payload was altered in transit or was forged by an unauthorized sender. Decryption aborted before touching private keys.`,
      );
    }
    updatePipelineStep(pipeline, 1, 'done', '2. RSA-PSS Signature Verification', `Verified authentic from "${targetEnv.sender_id}"`, tSig);

    // Step 3: Key Unwrapping (RSA-OAEP)
    updatePipelineStep(pipeline, 2, 'running', '3. Key Unwrapping (RSA-OAEP)', `Attempting to unwrap AES key with ${receiver.name}'s private key...`);
    const tUnwrapStart = performance.now();
    let aesKey;
    try {
      aesKey = await cc.unwrapKey(targetEnv.wrapped_key, receiver.enc.privateKey);
    } catch (cause) {
      const tUnwrap = performance.now() - tUnwrapStart;
      updatePipelineStep(pipeline, 2, 'error', '3. Key Unwrapping (RSA-OAEP)', 'FAILED: Key not wrapped for this user', tUnwrap);
      throw new cc.CryptoCoreError(
        cc.ErrorCodes.UNWRAP_FAILED,
        `Act 6 Defense Active: ${receiver.name} (${receiverId}) is not the intended recipient! The AES key was wrapped for "${targetEnv.recipient_id}". Even if server RBAC is bypassed, Eve cannot decrypt the file.`,
        { cause },
      );
    }
    const tUnwrap = performance.now() - tUnwrapStart;
    updatePipelineStep(pipeline, 2, 'done', '3. Key Unwrapping (RSA-OAEP)', `AES key successfully unwrapped (non-extractable)`, tUnwrap);

    // Step 4: AES-256-GCM Decryption
    updatePipelineStep(pipeline, 3, 'running', '4. AES-256-GCM Decryption', 'Decrypting and verifying 128-bit authentication tag...');
    const tDecStart = performance.now();
    let fileBytes;
    try {
      fileBytes = await cc.decryptFile(targetEnv.ciphertext, targetEnv.iv, aesKey);
    } catch (cause) {
      const tDec = performance.now() - tDecStart;
      updatePipelineStep(pipeline, 3, 'error', '4. AES-256-GCM Decryption', 'FAILED: Authentication tag verification failed', tDec);
      throw cause;
    }
    const tDec = performance.now() - tDecStart;
    updatePipelineStep(pipeline, 3, 'done', '4. AES-256-GCM Decryption', `Decrypted ${formatBytes(fileBytes.length)} successfully`, tDec);

    // Show Success Result
    showDecryptionSuccess(fileBytes, targetEnv, receiver);
    log('ok', `[Act 3] File "${targetEnv.filename}" decrypted successfully by ${receiver.name}.`);
  } catch (err) {
    showDecryptionFailure(err, receiver);
    log('err', `Decryption failed: ${err.message}`);
  } finally {
    btn.classList.remove('loading');
  }
}

function showDecryptionSuccess(bytes, envelope, receiver) {
  const card = $('result-card');
  card.className = 'card result-card ok';
  card.hidden = false;

  const isText = envelope.filename.endsWith('.txt') || envelope.filename.endsWith('.json') || envelope.filename.endsWith('.md');
  let previewHtml = '';

  if (isText) {
    const text = cc.utf8Decode(bytes);
    previewHtml = `<pre class="preview-text">${escapeHtml(text)}</pre>`;
  } else {
    previewHtml = `<div class="preview-text">[Binary File: ${formatBytes(bytes.length)}]</div>`;
  }

  card.innerHTML = `
    <div class="result-head">
      <div class="result-icon">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div>
        <div class="result-title">Decryption &amp; Verification Successful</div>
        <div class="result-sub">Opened as <b>${receiver.name}</b> &middot; Verified authentic from <b>${envelope.sender_id}</b></div>
      </div>
    </div>
    ${previewHtml}
    <div class="result-actions">
      <button class="btn btn-primary btn-sm" id="btn-dl-decrypted">Download Restored File (${escapeHtml(envelope.filename)})</button>
    </div>
  `;

  $('btn-dl-decrypted').addEventListener('click', () => {
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = envelope.filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function showDecryptionFailure(err, receiver) {
  const card = $('result-card');
  card.className = 'card result-card fail';
  card.hidden = false;

  let explain = '';
  if (err.code === cc.ErrorCodes.SIGNATURE_INVALID) {
    explain = `<b>Integrity Guarantee:</b> RSA-PSS digital signature verification failed. Because the system follows <i>Verify-Before-Decrypt</i>, no keys were exposed and invalid ciphertext was discarded immediately.`;
  } else if (err.code === cc.ErrorCodes.UNWRAP_FAILED) {
    explain = `<b>Act 6 Zero-Knowledge Guarantee:</b> The server stores only ciphertext and an AES key wrapped for the authorized recipient's public key. Even if an attacker compromises server RBAC or sniffs the network, they cannot unwrap the symmetric key.`;
  } else if (err.code === cc.ErrorCodes.DECRYPTION_FAILED) {
    explain = `<b>Authentication Guarantee:</b> AES-GCM detected that the ciphertext or IV was modified after encryption. The GCM 128-bit authentication tag failed.`;
  }

  card.innerHTML = `
    <div class="result-head">
      <div class="result-icon">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
      <div>
        <div class="result-title">Operation Blocked by Cryptographic Assertion</div>
        <div class="result-sub">User: <b>${receiver.name}</b> &middot; Error: <span class="err-code">${err.code || 'UNKNOWN_ERROR'}</span></div>
      </div>
    </div>
    <p class="muted">${escapeHtml(err.message)}</p>
    ${explain ? `<div class="explain">${explain}</div>` : ''}
  `;
}

// -------------------------------------------------------------
// Suite Self-Test (Tab 4)
// -------------------------------------------------------------
function renderDoDList() {
  const container = $('dod-list');
  container.innerHTML = '';
  DEFINITION_OF_DONE.forEach((item, idx) => {
    const num = idx + 1;
    const div = document.createElement('div');
    div.className = 'dod-item';
    div.id = `dod-item-${num}`;
    div.innerHTML = `
      <div class="dod-check">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div><b>DoD #${num}:</b> ${escapeHtml(item)}</div>
    `;
    container.appendChild(div);
  });
}

async function runBrowserSelfTests() {
  const btn = $('btn-run-tests');
  btn.classList.add('loading');
  const resultsDiv = $('test-results');
  resultsDiv.innerHTML = '';
  const countsDiv = $('test-counts');
  const bar = $('test-progress');
  const barWrap = $('test-progress-bar');
  barWrap.classList.remove('failed');

  let passed = 0;
  let failed = 0;
  const total = cases.length;

  // Group by category
  const groups = [...new Set(cases.map((c) => c.group))];
  const groupContainers = {};

  groups.forEach((g) => {
    const gDiv = document.createElement('div');
    gDiv.className = 'test-group';
    gDiv.innerHTML = `<h4>${escapeHtml(g)}</h4><div class="group-cases" id="g-${g.replace(/\s+/g, '-')}"></div>`;
    resultsDiv.appendChild(gDiv);
    groupContainers[g] = gDiv.querySelector('.group-cases');
  });

  const dodStatus = {};

  for (let i = 0; i < total; i++) {
    const c = cases[i];
    const row = document.createElement('div');
    row.className = 'test-row';

    const tStart = performance.now();
    try {
      await c.run();
      const dur = performance.now() - tStart;
      passed++;
      row.classList.add('pass');
      row.innerHTML = `
        <span class="ico">✓</span>
        <div>${escapeHtml(c.name)}${c.dod ? `<span class="dod-tag">DoD #${c.dod}</span>` : ''}</div>
        <span class="t-ms">${dur.toFixed(1)} ms</span>
      `;
      if (c.dod && dodStatus[c.dod] !== false) dodStatus[c.dod] = true;
    } catch (err) {
      const dur = performance.now() - tStart;
      failed++;
      row.classList.add('fail');
      row.innerHTML = `
        <span class="ico">✕</span>
        <div>${escapeHtml(c.name)}${c.dod ? `<span class="dod-tag">DoD #${c.dod}</span>` : ''}</div>
        <span class="t-ms">${dur.toFixed(1)} ms</span>
        <div class="t-err">${escapeHtml(err.message)}</div>
      `;
      if (c.dod) dodStatus[c.dod] = false;
    }

    groupContainers[c.group].appendChild(row);
    const pct = ((i + 1) / total) * 100;
    bar.style.width = `${pct}%`;
    countsDiv.innerHTML = `Running tests (${i + 1}/${total}): <span class="pass">${passed} passed</span>, <span class="fail">${failed} failed</span>`;
  }

  if (failed > 0) barWrap.classList.add('failed');
  countsDiv.innerHTML = `Completed: <span class="pass">${passed} passed</span>, <span class="fail">${failed} failed</span> out of ${total} tests.`;

  // Update DoD indicators
  Object.keys(dodStatus).forEach((num) => {
    const el = $(`dod-item-${num}`);
    if (el) {
      if (dodStatus[num]) {
        el.classList.add('done');
        el.classList.remove('failed');
      } else {
        el.classList.add('failed');
        el.classList.remove('done');
      }
    }
  });

  btn.classList.remove('loading');
  log(failed === 0 ? 'ok' : 'err', `In-browser Self-Test complete: ${passed}/${total} passed.`);
  toast(failed === 0 ? 'All 30 in-browser tests passed!' : `Tests finished with ${failed} failure(s)`);
}

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  checkEnvironment();
  renderPersonas();
  renderServerStorage();
  renderDoDList();

  $('btn-generate-all').addEventListener('click', generateAllPersonas);
  $('btn-clear-log').addEventListener('click', () => {
    $('log').innerHTML = '';
  });
  $('btn-run-tests').addEventListener('click', runBrowserSelfTests);

  setupShareHandlers();
  setupReceiveHandlers();

  // Pre-generate keys so user can immediately test sharing without friction
  await generateAllPersonas();
});
