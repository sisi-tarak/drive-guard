/* ── DriveGuard Content Script ──
   Runs on Drive, Docs, Sheets, Slides, Gmail.
   Reads lastScan from chrome.storage.local and injects a 🔴 badge
   next to any link that matches an exposed file. ── */

(async () => {
  const { lastScan } = await chrome.storage.local.get("lastScan");
  if (!lastScan || !lastScan.files || lastScan.files.length === 0) return;

  const leakedSet = new Set();
  const leakedMeta = {};

  lastScan.files.forEach(f => {
    const id = extractFileId(f.link || "");
    if (id) {
      leakedSet.add(id);
      leakedMeta[id] = f;
    }
  });

  if (leakedSet.size === 0) return;

  scanAndBadge(document.body, leakedSet, leakedMeta);

  // Watch for dynamically added nodes (Drive is a SPA)
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          scanAndBadge(node, leakedSet, leakedMeta);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

function scanAndBadge(root, leakedSet, leakedMeta) {
  const links = root.querySelectorAll
    ? root.querySelectorAll("a[href]")
    : [];

  for (const a of links) {
    if (a.dataset.dgBadged) continue;

    const id = extractFileId(a.href);
    if (!id || !leakedSet.has(id)) continue;

    a.dataset.dgBadged = "1";
    const meta = leakedMeta[id];

    const badge = document.createElement("span");
    badge.className = "dg-leaked-badge";
    badge.setAttribute("title", `DriveGuard: This file is publicly exposed (${meta.risk === "high" ? "public" : "anyone with link"}). Click to learn more.`);
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: ${meta.risk === "high" ? "#fef2f2" : "#fffbeb"};
      color: ${meta.risk === "high" ? "#dc2626" : "#d97706"};
      border: 1px solid ${meta.risk === "high" ? "#fca5a5" : "#fde68a"};
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 5px;
      margin-left: 4px;
      cursor: pointer;
      vertical-align: middle;
      line-height: 1.6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      white-space: nowrap;
      z-index: 9999;
    `;
    badge.textContent = meta.risk === "high" ? "🔴 PUBLIC" : "🟠 LEAKED";

    badge.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      showTooltip(badge, meta);
    });

    // Insert after the link (or append inside if it's a container)
    if (a.parentNode) {
      a.parentNode.insertBefore(badge, a.nextSibling);
    }
  }
}

function showTooltip(anchor, meta) {
  // Remove any existing tooltip
  document.querySelectorAll(".dg-tooltip").forEach(t => t.remove());

  const tip = document.createElement("div");
  tip.className = "dg-tooltip";
  tip.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    background: #1e1b4b;
    color: #e0e7ff;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.5;
    box-shadow: 0 8px 24px rgba(0,0,0,.3);
    max-width: 280px;
    pointer-events: auto;
  `;

  const rect = anchor.getBoundingClientRect();
  tip.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 160)}px`;
  tip.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;

  tip.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <span style="font-size:18px">${meta.risk === "high" ? "🔴" : "🟠"}</span>
      <strong>DriveGuard Warning</strong>
    </div>
    <p style="margin-bottom:6px"><strong>${escHtml(meta.name)}</strong></p>
    <p style="opacity:.8;font-size:11px">${meta.risk === "high" ? "This file is completely public — anyone on the internet can access it." : "Anyone with the link can view this file."}</p>
    <div style="margin-top:10px;display:flex;gap:8px">
      <a href="${escHtml(meta.link)}" target="_blank"
         style="color:#a5b4fc;font-size:11px;text-decoration:none">Open in Drive ↗</a>
      <span style="color:#f87171;font-size:11px;cursor:pointer" id="dg-tip-close">Dismiss</span>
    </div>`;

  document.body.appendChild(tip);

  tip.querySelector("#dg-tip-close").addEventListener("click", () => tip.remove());
  setTimeout(() => { if (tip.parentNode) tip.remove(); }, 8000);

  // Click outside to close
  const closer = e => {
    if (!tip.contains(e.target)) { tip.remove(); document.removeEventListener("click", closer); }
  };
  setTimeout(() => document.addEventListener("click", closer), 50);
}

function extractFileId(url) {
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

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
