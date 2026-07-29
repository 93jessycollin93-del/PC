(function () {
  'use strict';

  function canonical(value) { return JSON.stringify(sortKeys(value)); }
  function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).sort().forEach(function (k) { out[k] = sortKeys(value[k]); });
      return out;
    }
    return value;
  }

  function base64ToBuf(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  async function sha256Hex(text) {
    var bytes = new TextEncoder().encode(text);
    var digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  // Mirrors src/provenance/provenance.ts verifyArtifact exactly — this page
  // has no build step, so the check is reimplemented rather than imported.
  async function verifyRecord(record, content) {
    if (!record || record.v !== 1) return { ok: false, reason: 'Not a recognized provenance record (missing or unknown version).' };

    if (content !== undefined) {
      var recomputed = await sha256Hex(content);
      if (recomputed !== record.contentHash) {
        return { ok: false, reason: 'Content hash does not match — this content is not what the record describes.' };
      }
    }

    var publicKey;
    try {
      publicKey = await crypto.subtle.importKey('jwk', record.publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
    } catch (e) {
      return { ok: false, reason: 'The embedded public key is not a valid P-256 key.' };
    }

    var signature = record.signature;
    var unsigned = {};
    Object.keys(record).forEach(function (k) { if (k !== 'signature') unsigned[k] = record[k]; });
    var payload = new TextEncoder().encode(canonical(unsigned));

    var sigBuffer;
    try {
      sigBuffer = base64ToBuf(signature);
    } catch (e) {
      return { ok: false, reason: 'The signature is not valid base64.' };
    }

    var valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, sigBuffer, payload);
    if (!valid) return { ok: false, reason: 'Signature does not match this record’s content — it was altered after signing, or the key does not match.' };
    return { ok: true };
  }

  function render(html) { document.getElementById('result').innerHTML = html; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function runVerification(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      render('<div class="card fail">That is not valid JSON.</div>');
      return;
    }

    // Accept either a full PC export envelope (format/item/provenance) or a
    // bare provenance record pasted on its own.
    var record = parsed.provenance || (parsed.v === 1 && parsed.signature ? parsed : null);
    if (!record) {
      render('<div class="card fail">No provenance record found. This export was made without one, or the file is not a PC export.</div>');
      return;
    }
    var content = parsed.item !== undefined ? JSON.stringify(parsed.item) : undefined;

    var result = await verifyRecord(record, content);
    var fields =
      '<div class="field">App: <code>' + escapeHtml(record.producedBy && record.producedBy.app) + '</code></div>' +
      (record.producedBy && record.producedBy.model ? '<div class="field">Model: <code>' + escapeHtml(record.producedBy.model) + '</code></div>' : '') +
      '<div class="field">Signed: <code>' + escapeHtml(record.producedBy && new Date(record.producedBy.timestamp).toISOString()) + '</code></div>' +
      '<div class="field">Record id: <code>' + escapeHtml(record.id) + '</code></div>' +
      '<div class="field">Content hash: <code>' + escapeHtml(record.contentHash) + '</code></div>' +
      (content === undefined ? '<div class="field">(No artifact content was included alongside the record, so only the signature itself was checked — not that it matches a specific file.)</div>' : '');

    if (result.ok) {
      render('<div class="card ok">✓ Verified. This record’s signature matches its embedded public key' +
        (content !== undefined ? ', and the content hash matches the artifact in this file.' : '.') +
        '</div>' + fields);
    } else {
      render('<div class="card fail">✗ Not verified: ' + escapeHtml(result.reason) + '</div>' + fields);
    }
  }

  var dropEl = document.getElementById('drop');
  var fileInput = document.getElementById('file-input');
  var rawEl = document.getElementById('raw');
  var btn = document.getElementById('verify-btn');

  function loadFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      rawEl.value = String(reader.result);
    };
    reader.readAsText(file);
  }

  dropEl.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () {
    if (fileInput.files[0]) loadFile(fileInput.files[0]);
  });
  ['dragenter', 'dragover'].forEach(function (evt) {
    dropEl.addEventListener(evt, function (e) { e.preventDefault(); dropEl.classList.add('hover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    dropEl.addEventListener(evt, function (e) { e.preventDefault(); dropEl.classList.remove('hover'); });
  });
  dropEl.addEventListener('drop', function (e) {
    var file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });
  btn.addEventListener('click', function () {
    if (!rawEl.value.trim()) {
      render('<div class="card info">Paste or drop an export first.</div>');
      return;
    }
    runVerification(rawEl.value);
  });
})();
