/* ── DriveGuard Service Worker ── */

const DEFAULT_API = "http://127.0.0.1:8000/api";

// ── Install: context menu + alarms ───────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "dg-scan-link",
    title: "DriveGuard: Check if this file is exposed",
    contexts: ["link"],
    targetUrlPatterns: [
      "https://drive.google.com/*",
      "https://docs.google.com/*",
      "https://sheets.google.com/*",
      "https://slides.google.com/*"
    ]
  });

  chrome.contextMenus.create({
    id: "dg-open",
    title: "Open DriveGuard",
    contexts: ["action"]
  });

  // Schedule periodic scan every 60 minutes
  chrome.alarms.create("periodicScan", { periodInMinutes: 60 });

  await refreshBadge();
});

// ── Context menu click ────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "dg-scan-link") {
    const url = info.linkUrl || "";
    const fileId = extractDriveFileId(url);
    if (!fileId) {
      notify("DriveGuard", "Could not extract a Drive file ID from this link.");
      return;
    }

    const local = await chrome.storage.local.get("lastScan");
    if (local.lastScan && local.lastScan.files) {
      const match = local.lastScan.files.find(f => f.id === fileId || (f.link && f.link.includes(fileId)));
      if (match) {
        notify("DriveGuard — Exposed!", `"${match.name}" is publicly accessible. Risk: ${match.risk.toUpperCase()}`);
      } else {
        notify("DriveGuard — Safe", "This file was not found in the last leaked-link scan. Run a new scan to be sure.");
      }
    } else {
      notify("DriveGuard", "No scan data yet. Open DriveGuard and run a security scan first.");
    }
  }
});

// ── Alarm: periodic scan ──────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "periodicScan") return;

  const api = await getApi();
  try {
    const res = await fetch(`${api}/auth/status`, { signal: AbortSignal.timeout(5000) });
    const status = await res.json();
    if (!status.connected) return; // not signed in, skip

    const scanRes = await fetch(`${api}/leaked/scan`, { signal: AbortSignal.timeout(30000) });
    if (!scanRes.ok) return;
    const data = await scanRes.json();

    const prev = await chrome.storage.local.get("lastScan");
    const prevCount = prev.lastScan ? prev.lastScan.count : 0;

    await chrome.storage.local.set({
      lastScan: { count: data.leaked_count, files: data.files, timestamp: Date.now() }
    });

    await setBadge(data.leaked_count);

    // Notify if new exposures found
    if (data.leaked_count > prevCount) {
      const newCount = data.leaked_count - prevCount;
      notify(
        "DriveGuard — New Exposure!",
        `${newCount} new file${newCount > 1 ? "s" : ""} found with public sharing. Open DriveGuard to review.`
      );
    }
  } catch { /* network unreachable or server down — silently skip */ }
});

// ── Message from popup ────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "UPDATE_BADGE") {
    setBadge(msg.count).then(() => sendResponse({ ok: true }));
    return true; // keep channel open for async response
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────
async function getApi() {
  const stored = await chrome.storage.sync.get("apiUrl");
  return stored.apiUrl || DEFAULT_API;
}

async function setBadge(count) {
  if (count > 0) {
    await chrome.action.setBadgeText({ text: String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }
}

async function refreshBadge() {
  const local = await chrome.storage.local.get("lastScan");
  if (local.lastScan) await setBadge(local.lastScan.count);
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "../icons/icon48.png",
    title,
    message,
    priority: 1
  });
}

function extractDriveFileId(url) {
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/[a-z]+\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}
