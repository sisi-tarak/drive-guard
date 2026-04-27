/* ── DriveGuard Popup Controller ── */
let API = "http://127.0.0.1:8000/api";
let _authPollTimer = null;

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.sync.get("apiUrl");
  if (stored.apiUrl) API = stored.apiUrl;
  checkAuth();
});

// ── Auth ──────────────────────────────────────────────────────────────────
async function checkAuth() {
  try {
    const res = await fetch(`${API}/auth/status`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (data.connected) {
      showMainApp(data);
    } else {
      showAuthScreen();
    }
  } catch {
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("mainApp").classList.add("hidden");
}

async function showMainApp(statusData) {
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");

  // Show user info
  if (statusData.user_name) {
    document.getElementById("userName").textContent = statusData.user_name;
  }

  // Load drive stats and populate dashboard
  loadDashboard();
}

document.getElementById("connectBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: `${API}/auth/login` });
  startAuthPolling();
});

function startAuthPolling() {
  if (_authPollTimer) return;
  _authPollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API}/auth/status`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (data.connected) {
        clearInterval(_authPollTimer);
        _authPollTimer = null;
        showMainApp(data);
      }
    } catch { /* keep polling */ }
  }, 2000);
}

document.getElementById("disconnectBtn").addEventListener("click", async () => {
  try {
    await fetch(`${API}/auth/logout`);
  } catch { /* ignore */ }
  await chrome.storage.local.remove(["lastScan", "piiScan"]);
  showAuthScreen();
});

// ── Tab navigation ────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove("hidden");
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────
async function loadDashboard() {
  // Drive storage stats
  try {
    const res = await fetch(`${API}/drive/stats`, { signal: AbortSignal.timeout(5000) });
    const d = await res.json();
    const usedGB = (d.used_bytes / 1e9).toFixed(2);
    const totalGB = d.total_bytes > 0 ? (d.total_bytes / 1e9).toFixed(1) : "∞";
    const pct = d.total_bytes > 0 ? Math.min(100, Math.round((d.used_bytes / d.total_bytes) * 100)) : 0;
    document.getElementById("storageText").textContent = `${usedGB} GB / ${totalGB} GB`;
    document.getElementById("storageBar").style.width = `${pct}%`;
    if (d.user_name) document.getElementById("userName").textContent = d.user_name;
  } catch { /* non-fatal */ }

  // Load cached scan results
  const local = await chrome.storage.local.get(["lastScan", "piiScan"]);
  if (local.lastScan) {
    const { count, files, timestamp } = local.lastScan;
    document.getElementById("statLeaked").textContent = count;
    const ts = new Date(timestamp);
    document.getElementById("lastScanTime").textContent = `Last scanned: ${ts.toLocaleString()}`;
    document.getElementById("lastScanInfo").classList.remove("hidden");
    if (files && files.length > 0) {
      renderDashLeaked(files.slice(0, 3));
    }
  } else {
    document.getElementById("statLeaked").textContent = "—";
  }

  if (local.piiScan) {
    document.getElementById("statPii").textContent = local.piiScan.count;
  } else {
    document.getElementById("statPii").textContent = "—";
  }

  document.getElementById("statImages").textContent = "—";
  document.getElementById("statFaces").textContent = "—";
}

function renderDashLeaked(files) {
  const list = document.getElementById("dashLeakedList");
  list.innerHTML = "";
  files.forEach(f => {
    const div = document.createElement("div");
    div.className = "list-item risk-" + (f.risk === "high" ? "high" : "medium");
    div.innerHTML = `
      <div class="list-item-header">
        <span class="list-item-name">${escHtml(f.name)}</span>
        <span class="risk-badge badge-${f.risk === "high" ? "high" : "medium"}">${f.risk === "high" ? "PUBLIC" : "LINK"}</span>
      </div>`;
    list.appendChild(div);
  });
  document.getElementById("dashboardLeaked").classList.remove("hidden");
}

document.getElementById("quickScanBtn").addEventListener("click", async () => {
  setScanning(true);
  await runLeakedScan(true);
  await runPiiScan(true);
  setScanning(false);
});

function setScanning(on) {
  document.getElementById("quickScanBtn").disabled = on;
  document.getElementById("quickScanText").textContent = on ? "Scanning…" : "Run Security Scan";
  toggleEl("quickScanSpinner", on);
}

// ── Leaked Links Tab ───────────────────────────────────────────────────────
document.getElementById("scanLeakedBtn").addEventListener("click", () => runLeakedScan(false));

async function runLeakedScan(silent = false) {
  if (!silent) {
    clearResults("leaked");
    toggleEl("leakedSpinner", true);
  }
  try {
    const res = await fetch(`${API}/leaked/scan`, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    // Cache to storage
    await chrome.storage.local.set({
      lastScan: { count: data.leaked_count, files: data.files, timestamp: Date.now() }
    });

    // Update badge via background
    chrome.runtime.sendMessage({ type: "UPDATE_BADGE", count: data.leaked_count });

    if (!silent) {
      toggleEl("leakedSpinner", false);
      if (!data.files || data.files.length === 0) {
        toggleEl("leakedEmpty", true);
      } else {
        renderLeakedResults(data.files);
      }
    }

    // Refresh dashboard stats
    document.getElementById("statLeaked").textContent = data.leaked_count;
    if (data.files && data.files.length > 0) renderDashLeaked(data.files.slice(0, 3));

    return data;
  } catch (e) {
    if (!silent) {
      toggleEl("leakedSpinner", false);
      showError("leakedError", e.message);
    }
  }
}

function renderLeakedResults(files) {
  const container = document.getElementById("leakedResults");
  container.innerHTML = "";
  files.forEach(f => {
    const isHigh = f.risk === "high";
    const div = document.createElement("div");
    div.className = `list-item risk-${isHigh ? "high" : "medium"}`;
    div.innerHTML = `
      <div class="list-item-header">
        <span class="list-item-name">${escHtml(f.name)}</span>
        <span class="risk-badge badge-${isHigh ? "high" : "medium"}">${isHigh ? "PUBLIC" : "LINK SHARED"}</span>
      </div>
      <div class="list-item-actions">
        <a class="action-link" href="${escHtml(f.link)}" target="_blank">Open in Drive ↗</a>
        <span class="action-link" data-copy="${escHtml(f.link)}">Copy Link</span>
      </div>`;
    container.appendChild(div);
  });

  // Copy link handlers
  container.querySelectorAll("[data-copy]").forEach(el => {
    el.addEventListener("click", () => {
      navigator.clipboard.writeText(el.dataset.copy).then(() => {
        const orig = el.textContent;
        el.textContent = "Copied!";
        setTimeout(() => { el.textContent = orig; }, 1200);
      });
    });
  });
}

// ── Image Search Tab ───────────────────────────────────────────────────────
setupDropZone("imageDropZone", "imageFileInput", "imagePreview", "imagePreviewImg", "imageSearchBtn");

document.getElementById("imageSearchBtn").addEventListener("click", async () => {
  const input = document.getElementById("imageFileInput");
  if (!input.files[0]) return;
  clearResults("image");
  toggleEl("imageSpinner", true);
  document.getElementById("imageSearchBtn").disabled = true;

  try {
    const fd = new FormData();
    fd.append("file", input.files[0]);
    const res = await fetch(`${API}/search/image`, { method: "POST", body: fd, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    renderGridResults("imageResults", data.results, data.total);
  } catch (e) {
    showError("imageError", e.message);
  } finally {
    toggleEl("imageSpinner", false);
    document.getElementById("imageSearchBtn").disabled = false;
  }
});

// ── Text Search Tab ────────────────────────────────────────────────────────
document.getElementById("textSearchBtn").addEventListener("click", runTextSearch);
document.getElementById("textQuery").addEventListener("keydown", e => {
  if (e.key === "Enter") runTextSearch();
});

async function runTextSearch() {
  const q = document.getElementById("textQuery").value.trim();
  if (!q) return;
  clearResults("text");
  toggleEl("textSpinner", true);
  document.getElementById("textSearchBtn").disabled = true;
  toggleEl("geminiNote", false);

  try {
    const res = await fetch(`${API}/search/text?query=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (data.enhanced_query) {
      const note = document.getElementById("geminiNote");
      note.textContent = `✨ Gemini enhanced: "${data.enhanced_query}"`;
      toggleEl("geminiNote", true);
    }
    renderGridResults("textResults", data.results, data.total);
  } catch (e) {
    showError("textError", e.message);
  } finally {
    toggleEl("textSpinner", false);
    document.getElementById("textSearchBtn").disabled = false;
  }
}

// ── Face Match Tab ─────────────────────────────────────────────────────────
setupDropZone("faceDropZone", "faceFileInput", "facePreview", "facePreviewImg", "faceSearchBtn");

document.getElementById("faceSearchBtn").addEventListener("click", async () => {
  const input = document.getElementById("faceFileInput");
  if (!input.files[0]) return;
  clearResults("face");
  toggleEl("faceSpinner", true);
  document.getElementById("faceSearchBtn").disabled = true;

  try {
    const fd = new FormData();
    fd.append("file", input.files[0]);
    const res = await fetch(`${API}/face/search`, { method: "POST", body: fd, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    renderGridResults("faceResults", data.matches || [], (data.matches || []).length);
  } catch (e) {
    showError("faceError", e.message);
  } finally {
    toggleEl("faceSpinner", false);
    document.getElementById("faceSearchBtn").disabled = false;
  }
});

// ── PII Scan Tab ───────────────────────────────────────────────────────────
document.getElementById("scanPiiBtn").addEventListener("click", () => runPiiScan(false));

async function runPiiScan(silent = false) {
  if (!silent) {
    clearResults("pii");
    toggleEl("piiSpinner", true);
  }
  try {
    const res = await fetch(`${API}/security/scan`, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    const findings = data.findings || data.results || [];
    const count = findings.length;
    await chrome.storage.local.set({ piiScan: { count, timestamp: Date.now() } });
    document.getElementById("statPii").textContent = count;

    if (!silent) {
      toggleEl("piiSpinner", false);
      if (count === 0) {
        toggleEl("piiEmpty", true);
      } else {
        renderPiiResults(findings);
      }
    }
  } catch (e) {
    if (!silent) {
      toggleEl("piiSpinner", false);
      showError("piiError", e.message);
    }
  }
}

function renderPiiResults(findings) {
  const container = document.getElementById("piiResults");
  container.innerHTML = "";
  findings.forEach(f => {
    const div = document.createElement("div");
    div.className = "list-item risk-pii";
    const entities = (f.entities || []).map(e =>
      `<span class="entity-chip">${escHtml(e)}</span>`
    ).join("");
    div.innerHTML = `
      <div class="list-item-header">
        <span class="list-item-name">${escHtml(f.file_name || f.name || "Unknown")}</span>
        <span class="risk-badge badge-low">PII</span>
      </div>
      ${entities ? `<div class="pii-entities">${entities}</div>` : ""}
      <div class="list-item-actions" style="margin-top:6px">
        ${f.drive_link ? `<a class="action-link" href="${escHtml(f.drive_link)}" target="_blank">Open in Drive ↗</a>` : ""}
      </div>`;
    container.appendChild(div);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function renderGridResults(containerId, results, total) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (!results || results.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon">🔍</div><p>No results found.</p></div>`;
    return;
  }
  results.forEach(r => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.title = r.file_name;

    const thumbSrc = r.thumbnail_url
      ? `${API.replace(/\/api$/, "")}/api/drive/thumbnail/${r.file_id}`
      : "";

    card.innerHTML = thumbSrc
      ? `<img class="result-thumb" src="${thumbSrc}" alt="${escHtml(r.file_name)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'" loading="lazy">
         <div class="result-thumb-placeholder" style="display:none">🖼️</div>`
      : `<div class="result-thumb-placeholder">🖼️</div>`;

    const info = document.createElement("div");
    info.className = "result-info";
    info.innerHTML = `
      <div class="result-name">${escHtml(r.file_name)}</div>
      <div class="result-score">${(r.similarity_score * 100).toFixed(1)}% match</div>`;
    card.appendChild(info);

    card.addEventListener("click", () => {
      const link = r.drive_link || `https://drive.google.com/file/d/${r.file_id}/view`;
      chrome.tabs.create({ url: link });
    });

    container.appendChild(card);
  });
}

function setupDropZone(zoneId, inputId, previewWrapId, previewImgId, btnId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const previewWrap = document.getElementById(previewWrapId);
  const previewImg = document.getElementById(previewImgId);
  const btn = document.getElementById(btnId);

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileSelected(file, input, previewWrap, previewImg, btn);
  });
  input.addEventListener("change", () => {
    if (input.files[0]) handleFileSelected(input.files[0], input, previewWrap, previewImg, btn);
  });
}

function handleFileSelected(file, input, previewWrap, previewImg, btn) {
  // Transfer to input's FileList via DataTransfer
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewWrap.classList.remove("hidden");
  btn.classList.remove("hidden");
}

function clearResults(prefix) {
  const ids = [`${prefix}Results`, `${prefix}Error`, `${prefix}Empty`];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = ""; el.classList.add("hidden"); }
  });
}

function toggleEl(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = `Error: ${msg}`;
  el.classList.remove("hidden");
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
