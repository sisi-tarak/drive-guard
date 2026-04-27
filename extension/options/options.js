/* ── DriveGuard Options Controller ── */
const DEFAULT_API = "http://127.0.0.1:8000/api";

const els = {
  apiUrl: document.getElementById("apiUrl"),
  autoScan: document.getElementById("autoScan"),
  notifications: document.getElementById("notificationsEnabled"),
  contentBadges: document.getElementById("contentBadges"),
  saveBtn: document.getElementById("saveBtn"),
  saveNotice: document.getElementById("saveNotice"),
  testConnection: document.getElementById("testConnection"),
  testResult: document.getElementById("testResult"),
  scanStats: document.getElementById("scanStats"),
  clearData: document.getElementById("clearData"),
  runScan: document.getElementById("runScan"),
};

// ── Load saved settings ────────────────────────────────────────────────────
async function loadSettings() {
  const sync = await chrome.storage.sync.get(["apiUrl", "autoScan", "notificationsEnabled", "contentBadges"]);
  els.apiUrl.value = sync.apiUrl || DEFAULT_API;
  els.autoScan.checked = sync.autoScan !== false;
  els.notifications.checked = sync.notificationsEnabled !== false;
  els.contentBadges.checked = sync.contentBadges !== false;

  await loadScanStats();
}

async function loadScanStats() {
  const local = await chrome.storage.local.get(["lastScan", "piiScan"]);
  const lines = [];
  if (local.lastScan) {
    const ts = new Date(local.lastScan.timestamp).toLocaleString();
    lines.push(`<strong>Leaked links scan:</strong> ${local.lastScan.count} exposed file${local.lastScan.count !== 1 ? "s" : ""} found — last run ${ts}`);
  } else {
    lines.push("<strong>Leaked links scan:</strong> No scan data yet.");
  }
  if (local.piiScan) {
    const ts = new Date(local.piiScan.timestamp).toLocaleString();
    lines.push(`<strong>PII scan:</strong> ${local.piiScan.count} file${local.piiScan.count !== 1 ? "s" : ""} with sensitive data — last run ${ts}`);
  } else {
    lines.push("<strong>PII scan:</strong> No scan data yet.");
  }
  els.scanStats.innerHTML = lines.join("<br>");
}

// ── Save settings ─────────────────────────────────────────────────────────
els.saveBtn.addEventListener("click", async () => {
  await chrome.storage.sync.set({
    apiUrl: els.apiUrl.value.trim() || DEFAULT_API,
    autoScan: els.autoScan.checked,
    notificationsEnabled: els.notifications.checked,
    contentBadges: els.contentBadges.checked,
  });

  // Adjust alarm based on autoScan toggle
  if (els.autoScan.checked) {
    chrome.alarms.create("periodicScan", { periodInMinutes: 60 });
  } else {
    chrome.alarms.clear("periodicScan");
  }

  els.saveNotice.classList.remove("hidden");
  setTimeout(() => els.saveNotice.classList.add("hidden"), 2500);
});

// ── Test connection ────────────────────────────────────────────────────────
els.testConnection.addEventListener("click", async () => {
  const api = els.apiUrl.value.trim() || DEFAULT_API;
  els.testResult.textContent = "Testing…";
  els.testResult.className = "test-result";
  try {
    const res = await fetch(`${api}/auth/status`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const d = await res.json();
      els.testResult.textContent = d.connected ? "✅ Connected!" : "⚠️ Server reachable but not signed in.";
      els.testResult.className = "test-result test-ok";
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (e) {
    els.testResult.textContent = `❌ ${e.message}`;
    els.testResult.className = "test-result test-fail";
  }
});

// ── Clear data ─────────────────────────────────────────────────────────────
els.clearData.addEventListener("click", async () => {
  if (!confirm("Clear all cached scan data?")) return;
  await chrome.storage.local.remove(["lastScan", "piiScan"]);
  await chrome.action.setBadgeText({ text: "" });
  await loadScanStats();
});

// ── Run scan from options page ─────────────────────────────────────────────
els.runScan.addEventListener("click", async () => {
  const api = els.apiUrl.value.trim() || DEFAULT_API;
  els.runScan.disabled = true;
  els.runScan.textContent = "Scanning…";
  try {
    const res = await fetch(`${api}/leaked/scan`, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    await chrome.storage.local.set({
      lastScan: { count: data.leaked_count, files: data.files, timestamp: Date.now() }
    });
    if (data.leaked_count > 0) {
      await chrome.action.setBadgeText({ text: String(data.leaked_count) });
      await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }
    await loadScanStats();
  } catch (e) {
    alert(`Scan failed: ${e.message}`);
  } finally {
    els.runScan.disabled = false;
    els.runScan.textContent = "Scan Now";
  }
});

loadSettings();
