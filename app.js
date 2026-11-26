/* SIGMA OS // ORDERBLOCK FINANCE TERMINAL (Vault Viewer + Built-in Inbox + Zero-Prompt Auto Login) */
(function () {
  "use strict";

  const REPO_DEFAULT = "exon6/obsidian-vault";
  const SHELL_REPO = "exon6/sigma-os";
  const STORAGE_KEYS = {
    theme: "sigma_web_theme_v2",
    market: "sigma_web_market",
    repo: "sigma_web_repo",
    tokenPlain: "sigma_web_pat",
    tokenEnc: "sigma_web_pat_enc",
    patExpiry: "sigma_web_pat_expiry",
    safeWrite: "sigma_web_safe_write",
  };

  const state = {
    repo: localStorage.getItem(STORAGE_KEYS.repo) || REPO_DEFAULT,
    token: sessionStorage.getItem(STORAGE_KEYS.tokenPlain) || localStorage.getItem(STORAGE_KEYS.tokenPlain) || "",
    patExpiry: localStorage.getItem(STORAGE_KEYS.patExpiry) || "",
    safeWriteMode: localStorage.getItem(STORAGE_KEYS.safeWrite) !== "false",
    cloudVaultEnc: null, // Loaded from ./auth-vault.json if present on GitHub Pages
    mode: "loading", // "local" | "github" | "locked"
    lastAuthError: "",
    generatedAt: "",
    notes: [],
    byPath: {},
    byName: {},
    tickersIndex: {},
    themesIndex: {},
    conflicts: [],
    remoteShas: {},
    activeTab: "triage",
    thoughtFilter: "all",
    investingSubtab: "stocks",
    hubTicker: "",
    hubTheme: "",
    wikiFilter: "all",
    currentNotePath: "8. System/분류하기.md",
    editingNote: false,
    collapsedFolders: { "7. Template": true },
    historyStack: [],
    selectedClippingFiles: [],
  };

  /* -------------------- Utilities -------------------- */
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function daysBetween(dateA, dateB) {
    const a = new Date(String(dateA).slice(0, 10) + "T00:00:00Z");
    const b = new Date(String(dateB).slice(0, 10) + "T00:00:00Z");
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((a - b) / 86400000);
  }

  function showToast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => el.classList.remove("show"), 3400);
  }

  function cleanWikiTarget(val) {
    return String(val ?? "")
      .replace(/^\[\[/, "")
      .replace(/\]\]$/, "")
      .split("|")[0]
      .split("#")[0]
      .trim();
  }

  /* -------------------- WebCrypto AES-256-GCM -------------------- */
  async function deriveKey(password, saltBytes) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBytes, iterations: 250000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  function bytesToB64(bytes) {
    let bin = "";
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  async function encryptTokenWithPassword(token, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
    return JSON.stringify({
      v: 1,
      salt: bytesToB64(salt),
      iv: bytesToB64(iv),
      ct: bytesToB64(ct),
    });
  }

  async function decryptTokenWithPassword(payloadJson, password) {
    const data = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
    const salt = b64ToBytes(data.salt);
    const iv = b64ToBytes(data.iv);
    const ct = b64ToBytes(data.ct);
    const key = await deriveKey(password, salt);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  }

  /* -------------------- GitHub REST API Helpers -------------------- */
  function encodeRepoPath(relPath) {
    return relPath.split("/").map(encodeURIComponent).join("/");
  }

  function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function ghFetch(apiPath, options = {}) {
    if (!state.token) throw new Error("ERROR — GitHub PAT 토큰이 연결되지 않은 기기입니다.");
    const headers = Object.assign(
      {
        Authorization: `Bearer ${state.token}`,
        Accept: options.raw ? "application/vnd.github.raw" : "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      options.headers || {}
    );
    const res = await fetch(`https://api.github.com${apiPath}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`ERROR — GitHub API (${res.status}): ${errText.slice(0, 180)}`);
    }
    if (options.raw) return res.text();
    if (res.status === 204) return null;
    return res.json();
  }

  function b64ToUtf8(b64) {
    const clean = String(b64 || "").replace(/\s+/g, "");
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  async function ghGetBlobByPath(relPath) {
    const parts = relPath.split("/");
    const fileName = parts.pop();
    const dirPath = parts.join("/");
    const listUrl = dirPath
      ? `/repos/${state.repo}/contents/${encodeRepoPath(dirPath)}?ref=main`
      : `/repos/${state.repo}/contents?ref=main`;
    const entries = await ghFetch(listUrl);
    if (!Array.isArray(entries)) throw new Error(`ERROR — 경로 목록을 불러올 수 없습니다: ${relPath}`);
    const match = entries.find((item) => item.name === fileName);
    if (!match || !match.sha) throw new Error(`ERROR — 원격 파일을 찾을 수 없습니다: ${relPath}`);
    state.remoteShas[relPath] = match.sha;
    const blob = await ghFetch(`/repos/${state.repo}/git/blobs/${match.sha}`);
    return b64ToUtf8(blob.content || "");
  }

  async function ghGetFileRaw(relPath) {
    try {
      const meta = await ghFetch(`/repos/${state.repo}/contents/${encodeRepoPath(relPath)}?ref=main`);
      if (meta && meta.sha) state.remoteShas[relPath] = meta.sha;
      if (meta && typeof meta.content === "string" && meta.encoding === "base64") {
        return b64ToUtf8(meta.content);
      }
      if (meta && meta.sha) {
        const blob = await ghFetch(`/repos/${state.repo}/git/blobs/${meta.sha}`);
        return b64ToUtf8(blob.content || "");
      }
    } catch (err) {
      if (String(err.message || "").includes("403") || String(err.message || "").includes("too_large")) {
        return ghGetBlobByPath(relPath);
      }
      throw err;
    }
    return ghFetch(`/repos/${state.repo}/contents/${encodeRepoPath(relPath)}?ref=main`, { raw: true });
  }

  async function ghPutFileBase64(relPath, b64Content, commitMsg, targetRepo = state.repo) {
    let sha = undefined;
    try {
      const existing = await ghFetch(`/repos/${targetRepo}/contents/${encodeRepoPath(relPath)}?ref=main`);
      if (existing && existing.sha) sha = existing.sha;
    } catch (_) {
      // new file
    }
    const knownSha = state.remoteShas[relPath];
    if (knownSha && sha && knownSha !== sha) {
      const force = window.confirm(
        `[충돌 감지] '${relPath}' 파일이 방금 전 Google Drive 동기화나 다른 기기에서 변경되었습니다.\n` +
        `그래도 현재 웹 내용으로 덮어쓸까요? (취소 후 SYNC ↗ 버튼을 누르면 최신본을 불러옵니다)`
      );
      if (!force) {
        throw new Error("CANCELLED — 원격 변경 감지(SYNC ↗로 최신본 확인 필요)");
      }
    }
    const res = await ghFetch(`/repos/${targetRepo}/contents/${encodeRepoPath(relPath)}`, {
      method: "PUT",
      body: {
        message: commitMsg,
        content: b64Content,
        sha,
        branch: "main",
      },
    });
    if (res && res.content && res.content.sha) {
      state.remoteShas[relPath] = res.content.sha;
    }
    return res;
  }

  async function ghPutFile(relPath, contentStr, commitMsg, targetRepo = state.repo) {
    return ghPutFileBase64(relPath, utf8ToB64(contentStr), commitMsg, targetRepo);
  }

  async function ghTriggerWorkflow(workflowFile, inputs = {}) {
    return ghFetch(`/repos/${state.repo}/actions/workflows/${workflowFile}/dispatches`, {
      method: "POST",
      body: { ref: "main", inputs },
    });
  }

  /* -------------------- Frontmatter & Index Management -------------------- */
  function parseFrontmatterJS(rawText) {
    const m = String(rawText).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { props: {}, body: rawText };
    const yaml = m[1];
    const body = m[2];
    const props = {};
    let curKey = null;
    for (const line of yaml.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const listM = line.match(/^\s*-\s+(.*)$/);
      if (listM && curKey) {
        if (!Array.isArray(props[curKey])) props[curKey] = [];
        props[curKey].push(parseScalarJS(listM[1]));
        continue;
      }
      const kvM = line.match(/^([A-Za-z0-9_\-\uac00-\ud7a3]+)\s*:\s*(.*)$/);
      if (kvM) {
        curKey = kvM[1];
        const rest = kvM[2].trim();
        props[curKey] = rest === "[]" ? [] : parseScalarJS(rest);
      }
    }
    return { props, body };
  }

  function parseScalarJS(v) {
    let s = String(v ?? "").trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1);
    }
    if (s.toLowerCase() === "true") return true;
    if (s.toLowerCase() === "false") return false;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    return s;
  }

  function serializeFrontmatterJS(props, body) {
    const keys = Object.keys(props);
    if (!keys.length) return body;
    const lines = ["---"];
    for (const k of keys) {
      const val = props[k];
      if (Array.isArray(val)) {
        if (!val.length) {
          lines.push(`${k}: []`);
        } else {
          lines.push(`${k}:`);
          for (const item of val) {
            const q = String(item).includes("[[") || String(item).includes(":") ? `"${String(item).replace(/"/g, '\\"')}"` : item;
            lines.push(`  - ${q}`);
          }
        }
      } else if (typeof val === "boolean" || typeof val === "number") {
        lines.push(`${k}: ${val}`);
      } else {
        const str = String(val ?? "");
        const needsQuote = str.includes("[[") || str.includes(": ") || str.startsWith("#");
        lines.push(`${k}: ${needsQuote ? `"${str.replace(/"/g, '\\"')}"` : str}`);
      }
    }
    lines.push("---");
    return lines.join("\n") + "\n" + body;
  }

  function indexNotes(data) {
    state.generatedAt = data.generated_at || "";
    state.notes = data.notes || [];
    state.tickersIndex = data.tickers_index || {};
    state.themesIndex = data.themes_index || {};
    state.conflicts = data.conflicts || [];
    state.byPath = {};
    state.byName = {};
    for (const n of state.notes) {
      state.byPath[n.path] = n;
      if (!state.byName[n.name] || n.top_folder !== "Clippings") {
        state.byName[n.name] = n;
      }
    }
    applyLocalEditsFromStorage();
  }

  function applyLocalEditsFromStorage() {
    try {
      const raw = localStorage.getItem("sigma_web_local_edits_v1");
      if (!raw) return;
      const map = JSON.parse(raw);
      if (!map || typeof map !== "object") return;
      for (const [relPath, mdText] of Object.entries(map)) {
        if (typeof mdText === "string") {
          upsertNoteInMemory(relPath, mdText, false);
        }
      }
    } catch (_) {}
  }

  function saveLocalEditToStorage(relPath, rawMarkdown) {
    try {
      const raw = localStorage.getItem("sigma_web_local_edits_v1");
      const map = raw ? JSON.parse(raw) : {};
      map[relPath] = rawMarkdown;
      localStorage.setItem("sigma_web_local_edits_v1", JSON.stringify(map));
    } catch (_) {}
  }

  function upsertNoteInMemory(relPath, rawMarkdown, persistLocal = true) {
    const parts = relPath.split("/");
    const name = parts[parts.length - 1].replace(/\.md$/i, "");
    const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    const topFolder = parts.length > 1 ? parts[0] : "(root)";
    const { props, body } = parseFrontmatterJS(rawMarkdown);
    const existing = state.byPath[relPath];
    const note = {
      path: relPath,
      name,
      folder,
      top_folder: topFolder,
      props,
      body,
      truncated: false,
      size: new TextEncoder().encode(rawMarkdown).length,
      ctime: existing ? existing.ctime : todayStr(),
      mtime: todayStr(),
      links: existing ? existing.links : [],
      backlinks: existing ? existing.backlinks : [],
      has_source_backlink: existing ? existing.has_source_backlink : false,
    };
    if (existing) {
      const idx = state.notes.indexOf(existing);
      if (idx >= 0) state.notes[idx] = note;
    } else {
      state.notes.unshift(note);
    }
    state.byPath[relPath] = note;
    state.byName[name] = note;
    if (persistLocal) {
      saveLocalEditToStorage(relPath, rawMarkdown);
    }
    return note;
  }

  async function loadVaultData() {
    const badge = document.getElementById("connection-badge");
    if (badge) badge.textContent = "LOADING...";

    // 0. Check optional encrypted cloud vault backup (if present)
    try {
      const encRes = await fetch("./auth-vault.json", { cache: "no-store" });
      if (encRes.ok) {
        const encJson = await encRes.json();
        if (encJson && encJson.ciphertext) {
          state.cloudVaultEnc = JSON.stringify(encJson);
        }
      }
    } catch (_) {}

    let loadedAny = false;

    // 1. Load local ../../.sigma-sync/vault-index.json (when opened locally) or optional ./vault-index.json
    for (const candidate of ["./vault-index.json", "../../.sigma-sync/vault-index.json"]) {
      try {
        const res = await fetch(candidate, { cache: "no-store" });
        if (res.ok) {
          const parsed = await res.json();
          indexNotes(parsed);
          state.mode = "ready";
          loadedAny = true;
          if (badge) {
            badge.textContent = `LIVE · ${state.notes.length} NOTES`;
          }
          renderAll();
          break;
        }
      } catch (_) {}
    }

    // 2. If GitHub token is configured, fetch latest private index directly from exon6/obsidian-vault
    if (state.token) {
      try {
        const rawJson = await ghGetFileRaw(".sigma-sync/vault-index.json");
        const parsed = JSON.parse(rawJson);
        indexNotes(parsed);
        state.mode = "github";
        state.lastAuthError = "";
        loadedAny = true;
        if (badge) badge.textContent = `LIVE · ${state.notes.length} NOTES`;
        renderAll();
        return;
      } catch (err) {
        const msg = String(err && err.message ? err.message : err || "Unknown auth error");
        let hint = "";
        if (msg.includes("(401)")) hint = " [토큰이 만료되었거나 오타가 있습니다]";
        else if (msg.includes("(403)")) hint = " [Fine-grained PAT에 Contents: Read and write 권한이 필요합니다]";
        else if (msg.includes("(404)")) hint = ` [PAT에 '${state.repo}' 저장소 접근 권한이 포함되어 있는지 확인하세요]`;
        state.lastAuthError = `${msg}${hint}`;
        if (badge) badge.textContent = "AUTH ERROR";
        showToast(state.lastAuthError);
      }
    }

    // 3. No bundled index and no valid GitHub PAT -> show Private Vault Lock / Auth screen cleanly
    if (!loadedAny && state.notes.length === 0) {
      state.mode = "locked";
      if (badge && badge.textContent === "LOADING...") {
        badge.textContent = "LOCKED · AUTH";
      }
      renderAll();
      return;
    }

    state.mode = "ready";
    renderAll();
  }

  async function ensureFullNoteBody(note) {
    if (!note || !note.truncated) return;
    for (const prefix of ["./", "../../"]) {
      try {
        const localRes = await fetch(`${prefix}${encodeRepoPath(note.path)}`, { cache: "no-store" });
        if (localRes.ok) {
          const raw = await localRes.text();
          const { body } = parseFrontmatterJS(raw);
          note.body = body;
          note.truncated = false;
          return;
        }
      } catch (_) {}
    }
    if (state.token) {
      const raw = await ghGetFileRaw(note.path);
      const { body } = parseFrontmatterJS(raw);
      note.body = body;
      note.truncated = false;
    }
  }

  function resolveNoteLink(target) {
    const clean = cleanWikiTarget(target);
    if (!clean) return null;
    if (state.byPath[clean]) return state.byPath[clean];
    if (state.byPath[`${clean}.md`]) return state.byPath[`${clean}.md`];
    const stem = clean.split("/").pop().replace(/\.md$/i, "");
    return state.byName[stem] || null;
  }

  /* -------------------- ORDERBLOCK Direction & Number Formatter -------------------- */
  function colorizeNumbersInHtml(html) {
    // Highlight explicit directional strings like +103%, -9.1B, ▲ +25%, etc.
    return html
      .replace(/(\+\d+(?:\.\d+)?%)/g, '<span class="ob-up">▲ $1</span>')
      .replace(/(-\$\d+(?:\.\d+)?[BMK])/g, '<span class="ob-down">▼ $1</span>');
  }

  /* -------------------- Obsidian .base Evaluator -------------------- */
  function evaluateBaseEmbed(baseSpec, contextNote) {
    const [baseFile, viewName = ""] = baseSpec.split("#");
    const baseName = baseFile.split("/").pop().replace(/\.base$/i, "");
    const today = todayStr();

    if (baseName === "inbox") {
      if (viewName === "ingest 대기") {
        const rows = state.notes
          .filter((n) => n.top_folder === "Clippings" && !n.has_source_backlink)
          .sort((a, b) => a.ctime.localeCompare(b.ctime));
        return renderBaseTable(
          `INGEST QUEUE // 위키 반영 대기 클리핑 (${rows.length})`,
          ["CLIPPING FILE (CLIPPINGS/)", "SOURCE", "CAPTURED", "AGE"],
          rows.map((n) => [
            noteLinkHTML(n.path, n.name),
            n.props.source ? `<a href="${esc(n.props.source)}" target="_blank" rel="noopener" class="wikilink">LINK ↗</a>` : "−",
            `<span class="ob-mono">${esc(n.ctime)}</span>`,
            `<span class="ob-mono">${daysBetween(today, n.ctime) ?? 0}D</span>`,
          ])
        );
      }
      const rows = state.notes.filter(
        (n) => n.top_folder === "0. Inbox" && !n.props.entity && n.props.done !== true
      );
      return renderBaseTable(
        `INBOX // 수집함 미분류 메모 (${rows.length})`,
        ["NOTE", "ENTITY", "BOX", "CAPTURED"],
        rows.map((n) => [
          noteLinkHTML(n.path, n.name),
          `<span class="ob-badge">${esc(n.props.entity || "UNCLASSIFIED")}</span>`,
          formatPropVal(n.props.box),
          `<span class="ob-mono">${esc(n.ctime)}</span>`,
        ]),
        "미분류 메모가 없습니다."
      );
    }

    if (baseName === "resources") {
      const pool = state.notes.filter(
        (n) => (n.top_folder === "0. Inbox" || n.top_folder === "6. Resources") && n.props.entity === "자료" && n.props.importance !== "아카이브"
      );
      let rows = pool;
      if (viewName === "다듬을 생각") {
        rows = pool.filter((n) => n.props.kind === "생각" && (!n.props.stage || n.props.stage === "임시"));
      } else if (viewName === "생각") {
        rows = pool.filter((n) => n.props.kind === "생각");
      } else if (viewName === "구조 노트") {
        rows = pool.filter((n) => n.props.kind === "구조");
      } else if (viewName === "참고") {
        rows = pool.filter((n) => n.props.kind === "참고");
      } else if (viewName === "글감") {
        rows = pool.filter((n) => Array.isArray(n.props.tags) && n.props.tags.includes("글감"));
      } else if (viewName === "불편") {
        rows = pool.filter((n) => n.props.kind === "불편");
      } else if (viewName === "중요") {
        rows = pool.filter((n) => n.props.importance === "중요");
      } else if (viewName === "미분류") {
        rows = pool.filter((n) => {
          const zk = ["생각", "참고", "구조", "불편"].includes(n.props.kind);
          const noBox = !n.props.box || (Array.isArray(n.props.box) && !n.props.box.length);
          return (!zk && noBox) || !n.props.kind || !n.props.importance;
        });
      }
      rows.sort((a, b) => b.mtime.localeCompare(a.mtime));
      return renderBaseTable(
        `ZETTELKASTEN // ${viewName || "자료"} (${rows.length})`,
        ["NOTE", "STAGE / KIND", "SUMMARY", "UPDATED"],
        rows.map((n) => [
          noteLinkHTML(n.path, n.name),
          `<span class="ob-badge ${n.props.stage === "영구" ? "ob-badge--low" : n.props.stage === "임시" ? "ob-badge--warning" : "ob-badge--info"}">${esc(n.props.kind || "자료")}${n.props.stage ? " · " + esc(n.props.stage) : ""}</span>`,
          esc(n.props.summary || n.body.replace(/^#.*$/gm, "").trim().slice(0, 95)),
          `<span class="ob-mono">${esc(n.mtime)}</span>`,
        ])
      );
    }

    if (baseName === "stocks") {
      const pool = state.notes.filter((n) => n.folder === "6. Resources/Stocks" || n.props.kind === "종목");
      let rows = pool;
      if (viewName === "보유") rows = pool.filter((n) => n.props.position === "보유");
      else if (viewName === "점검 필요") {
        rows = pool.filter((n) => n.props.position !== "매도" && (!n.props.next_review || String(n.props.next_review) <= today));
      } else if (viewName === "관심") rows = pool.filter((n) => n.props.position === "관심");
      rows.sort((a, b) => String(a.props.next_review || "").localeCompare(String(b.props.next_review || "")));
      return renderBaseTable(
        `CORE HOLDINGS // 종목 · ${viewName || "전체"} (${rows.length})`,
        ["TICKER / NOTE", "SECTOR", "NEXT REVIEW", "KEY QUESTION", "THESIS"],
        rows.map((n) => {
          const tkr = String(n.props.ticker || n.name.split(" ")[0]);
          return [
            `<div style="display:flex;align-items:center;gap:10px;"><span class="ob-ticker" data-ticker="${esc(tkr)}">${esc(tkr)}</span><div>${noteLinkHTML(n.path, n.name)}</div></div>`,
            esc(n.props.sector || "−"),
            `<span class="ob-mono">${esc(n.props.next_review || "−")}</span>`,
            esc(n.props.question || "−"),
            esc(n.props.thesis || "−"),
          ];
        })
      );
    }

    if (baseName === "tasks") {
      const pool = state.notes.filter((n) => n.top_folder === "5. Tasks" || n.props.entity === "할일");
      let rows = pool;
      if (viewName === "오늘") rows = pool.filter((n) => String(n.props.do_date) === today && n.props.type !== "위임");
      else if (viewName === "일정") rows = pool.filter((n) => n.props.type === "일정" && n.props.done !== true);
      else if (viewName === "미계획") rows = pool.filter((n) => !n.props.do_date && n.props.done !== true);
      else if (viewName === "미분류") rows = pool.filter((n) => n.props.done !== true && (!n.props.type || (!n.props.box && !n.props.project)));
      else if (viewName === "완료") rows = pool.filter((n) => n.props.done === true);
      else rows = pool.filter((n) => n.props.done !== true);
      rows.sort((a, b) => String(a.props.do_date || "9999").localeCompare(String(b.props.do_date || "9999")));
      return renderBaseTable(
        `TASKS // 할 일 · ${viewName || "ACTIVE"} (${rows.length})`,
        ["DONE", "TASK", "TYPE", "DO DATE", "TIME", "BOX / PROJECT"],
        rows.map((n) => [
          `<input type="checkbox" class="task-toggle" data-path="${esc(n.path)}" ${n.props.done === true ? "checked" : ""} title="완료 상태 토글" />`,
          noteLinkHTML(n.path, n.name),
          `<span class="ob-badge">${esc(n.props.type || "일반")}</span>`,
          `<span class="ob-mono">${esc(n.props.do_date || "−")}</span>`,
          `<span class="ob-mono">${esc(n.props.planned_time || "−")}</span>`,
          formatPropVal(n.props.box || n.props.project),
        ])
      );
    }

    if (baseName === "context" && contextNote) {
      const linked = state.notes.filter(
        (n) =>
          n.path !== contextNote.path &&
          n.top_folder !== "7. Template" &&
          (n.links.some((l) => cleanWikiTarget(l) === contextNote.name) ||
            (contextNote.props.wiki && n.links.some((l) => cleanWikiTarget(l) === cleanWikiTarget(contextNote.props.wiki))))
      );
      if (viewName === "매매 기록") {
        const trades = linked.filter((n) => n.props.kind === "매매일지");
        return renderBaseTable(
          `TRADES // 연결된 매매 기록 (${trades.length})`,
          ["DATE", "NOTE", "SIDE", "REASON"],
          trades.map((n) => [`<span class="ob-mono">${esc(n.props.trade_date || n.ctime)}</span>`, noteLinkHTML(n.path, n.name), esc(n.props.side || "−"), esc(n.props.reason || "−")])
        );
      }
      return renderBaseTable(
        `BACKLINKS & CONTEXT // 연결된 자료 · 위키 (${linked.length})`,
        ["NOTE", "FOLDER", "TYPE", "SUMMARY"],
        linked.slice(0, 25).map((n) => [
          noteLinkHTML(n.path, n.name),
          `<span class="ob-badge">${esc(n.top_folder)}</span>`,
          esc(n.props.kind || n.props.wiki_type || "−"),
          esc(n.props.summary || n.body.replace(/^#.*$/gm, "").trim().slice(0, 90)),
        ])
      );
    }

    return `<div class="callout"><div class="callout-title">DATABASE VIEW // ${esc(baseSpec)}</div></div>`;
  }

  function renderBaseTable(title, headers, rows, emptyMsg = "NO RECORDS IN THIS VIEW.") {
    if (!rows.length) {
      return `<div class="ob-card">
        <div class="ob-card__head"><span>${esc(title)}</span><span class="ob-badge">0</span></div>
        <div class="ob-card__body" style="color:var(--muted);font-size:13px;">${esc(emptyMsg)}</div>
      </div>`;
    }
    const ths = headers.map((h) => `<th>${esc(h)}</th>`).join("");
    const trs = rows
      .map(
        (r) =>
          `<tr>${r
            .map((cell, idx) => `<td data-label="${esc(headers[idx] || "")}"><div>${cell}</div></td>`)
            .join("")}</tr>`
      )
      .join("");
    return `<div class="ob-card">
      <div class="ob-card__head"><span>${esc(title)}</span><span class="ob-badge">${rows.length}</span></div>
      <div class="table-wrap"><table class="ob-table ob-table--striped ob-table--responsive"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>
    </div>`;
  }

  function noteLinkHTML(path, label) {
    return `<a class="wikilink" data-note-path="${esc(path)}">${esc(label)}</a>`;
  }

  function formatPropVal(val) {
    if (Array.isArray(val)) return val.map((v) => formatSingleProp(v)).join(" ");
    return formatSingleProp(val);
  }

  function formatSingleProp(val) {
    const s = String(val ?? "");
    if (!s) return "−";
    const m = s.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
    if (m) {
      const target = resolveNoteLink(m[1]);
      const label = m[2] || m[1];
      if (target) return noteLinkHTML(target.path, label);
      return `<span class="ob-badge">${esc(label)}</span>`;
    }
    return esc(s);
  }

  /* -------------------- Obsidian Markdown Renderer -------------------- */
  function renderMarkdown(mdText, contextNote) {
    const lines = String(mdText || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim().startsWith("```")) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        out.push(`<pre><code>${esc(codeLines.join("\n"))}</code></pre>`);
        continue;
      }

      const embedM = line.trim().match(/^!\[\[([^\]]+)\]\]$/);
      if (embedM) {
        const spec = embedM[1];
        if (spec.includes(".base")) {
          out.push(evaluateBaseEmbed(spec, contextNote));
        } else {
          const target = resolveNoteLink(spec);
          if (target) {
            out.push(`<div class="callout">
              <div class="callout-title">EMBED // ${noteLinkHTML(target.path, target.name)}</div>
              <div style="font-size:13px;color:var(--muted);">${esc(target.props.summary || target.body.slice(0, 180))}</div>
            </div>`);
          }
        }
        i++;
        continue;
      }

      if (line.trim().startsWith(">")) {
        const bqLines = [];
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          bqLines.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        const first = bqLines[0] || "";
        const calloutM = first.match(/^\[!([a-zA-Z]+)\][-+]?\s*(.*)$/);
        if (calloutM) {
          const cType = calloutM[1].toLowerCase();
          const cTitle = calloutM[2] || cType.toUpperCase();
          const cBody = bqLines.slice(1).join("\n");
          out.push(`<div class="callout callout-${esc(cType)}">
            <div class="callout-title">${inlineFormat(cTitle)}</div>
            <div>${renderMarkdown(cBody, contextNote)}</div>
          </div>`);
        } else {
          out.push(`<blockquote>${bqLines.map((l) => inlineFormat(l)).join("<br/>")}</blockquote>`);
        }
        continue;
      }

      if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s\-:|]+\|[\s\-:|]*$/.test(lines[i + 1])) {
        const parseRow = (r) =>
          r
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split(/(?<!\\)\|/)
            .map((c) => colorizeNumbersInHtml(inlineFormat(c.replace(/\\\|/g, "|").trim())));
        const headers = parseRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
          rows.push(parseRow(lines[i]));
          i++;
        }
        out.push(
          `<div class="table-wrap" style="margin:14px 0;"><table class="ob-table ob-table--striped"><thead><tr>${headers
            .map((h) => `<th>${h}</th>`)
            .join("")}</tr></thead><tbody>${rows
            .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
            .join("")}</tbody></table></div>`
        );
        continue;
      }

      const hM = line.match(/^(#{1,4})\s+(.*)$/);
      if (hM) {
        const lvl = hM[1].length;
        const headingText = hM[2];
        const isAiHeading = headingText.includes("AI 확장") || headingText.includes("외부 분석");
        out.push(
          `<h${lvl}>${inlineFormat(headingText)} ${
            isAiHeading ? '<span class="ob-badge ob-badge--ai" style="margin-left:8px;">AI</span>' : ""
          }</h${lvl}>`
        );
        i++;
        continue;
      }

      if (/^---+$/.test(line.trim())) {
        out.push("<hr style='border:none;border-top:3px solid var(--frame);margin:20px 0;'/>");
        i++;
        continue;
      }

      if (/^\s*([-*•]|\d+\.)\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*([-*•]|\d+\.)\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*•]|\d+\.)\s+/, ""));
          i++;
        }
        out.push(`<ul>${items.map((it) => `<li>${colorizeNumbersInHtml(inlineFormat(it))}</li>`).join("")}</ul>`);
        continue;
      }

      if (!line.trim()) {
        i++;
        continue;
      }

      out.push(`<p>${colorizeNumbersInHtml(inlineFormat(line))}</p>`);
      i++;
    }

    return out.join("\n");
  }

  function inlineFormat(text) {
    let s = esc(text);
    s = s.replace(/\\\$/g, "$");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
      const unescaped = inner.replace(/\\\|/g, "|");
      const [targetPart, aliasPart] = unescaped.split("|");
      const cleanName = targetPart.split("#")[0].trim();
      const label = (aliasPart || targetPart).trim();
      const targetNote = resolveNoteLink(cleanName);
      if (targetNote) {
        return `<a class="wikilink" data-note-path="${esc(targetNote.path)}">${label}</a>`;
      }
      return `<a class="wikilink" data-search-query="${esc(cleanName)}">${label}</a>`;
    });
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="wikilink">$1 ↗</a>');
    return s;
  }

  /* -------------------- View Renderers -------------------- */
  function renderStatsStrip() {
    const container = document.getElementById("stats-container");
    if (!container) return;
    if (state.mode === "locked") {
      container.innerHTML = "";
      return;
    }
    const thoughts = state.notes.filter((n) => n.props.kind === "생각");
    const tempThoughts = thoughts.filter((n) => !n.props.stage || n.props.stage === "임시");
    const permThoughts = thoughts.filter((n) => n.props.stage === "영구");
    const refs = state.notes.filter((n) => n.props.kind === "참고");
    const stocks = state.notes.filter((n) => n.folder === "6. Resources/Stocks");
    const wikiCount = state.notes.filter((n) => n.top_folder === "9. Wiki").length;
    const pendingClippings = state.notes.filter((n) => n.top_folder === "Clippings" && !n.has_source_backlink).length;
    const openTasks = state.notes.filter((n) => (n.top_folder === "5. Tasks" || n.props.entity === "할일") && n.props.done !== true).length;

    container.innerHTML = `
      <div class="ob-stat" data-jump-tab="explorer">
        <span class="ob-stat__label"><span class="stat-en">VAULT NOTES // </span>전체 노트</span>
        <span class="ob-stat__value">${state.notes.length}</span>
        <span class="ob-stat__sub">10 FOLDERS · PRIVATE SYNC</span>
      </div>
      <div class="ob-stat" data-jump-tab="thoughts" data-thought-filter="all">
        <span class="ob-stat__label"><span class="stat-en">ZETTELKASTEN // </span>생각·참고</span>
        <span class="ob-stat__value">${thoughts.length + refs.length}</span>
        <span class="ob-stat__sub">PERM ${permThoughts.length} · TEMP ${tempThoughts.length} · REF ${refs.length}</span>
      </div>
      <div class="ob-stat" data-jump-tab="investing" data-inv-sub="stocks">
        <span class="ob-stat__label"><span class="stat-en">CORE HOLDINGS // </span>보유종목</span>
        <span class="ob-stat__value">${stocks.length}</span>
        <span class="ob-stat__sub">NVDA·AVGO·MRVL·GOOGL·ANT·SPCX</span>
      </div>
      <div class="ob-stat" data-jump-tab="investing" data-inv-sub="wiki">
        <span class="ob-stat__label"><span class="stat-en">LLM WIKI // </span>위키·콜</span>
        <span class="ob-stat__value">${wikiCount}</span>
        <span class="ob-stat__sub">48 CALLS/EVENTS · 75 SEC FILINGS</span>
      </div>
      <div class="ob-stat" data-jump-tab="triage">
        <span class="ob-stat__label"><span class="stat-en">ACTIVE TASKS // </span>할일·클립</span>
        <span class="ob-stat__value">${openTasks}</span>
        <span class="ob-stat__sub">INGEST PENDING: ${pendingClippings} CLIPS</span>
      </div>
    `;
  }

  function renderLockedView() {
    const localEnc = localStorage.getItem(STORAGE_KEYS.tokenEnc);
    const hasAnyEnc = Boolean(localEnc || state.cloudVaultEnc);
    return `
      <div class="ob-card ob-card--elevated" style="max-width:620px;margin:32px auto;">
        <div class="ob-card__head">
          <span>PRIVATE VAULT LOCK // 비공개 시그마 OS 인증</span>
          <span class="ob-badge ob-badge--yellow">ZERO DATA EXPOSED</span>
        </div>
        <div class="ob-card__body">
          <p style="color:var(--muted);margin-bottom:18px;">
            <strong>들어갈 때마다 PAT 토큰을 입력할 필요가 없습니다.</strong><br/>
            한 번만 연결해두면 이 기기(브라우저)에 자동 저장되어 <strong>다음부터는 주소만 열면 0.5초 만에 바로 볼트로 들어갑니다.</strong> 또한 나만의 간편 비밀번호로 클라우드 금고를 저장해두면 스마트폰이나 다른 PC에서도 긴 토큰 없이 비밀번호 한 줄로 즉시 연결됩니다.
          </p>
          ${
            state.lastAuthError
              ? `<div class="ob-block" style="padding:12px 14px;margin-bottom:16px;border:2px solid var(--ob-red,#d9383a);background:rgba(217,56,58,0.08);font-size:12.5px;">
                  <strong>AUTH ERROR (${esc(state.repo)}):</strong><br/>${esc(state.lastAuthError)}
                </div>`
              : ""
          }
          ${
            hasAnyEnc
              ? `<div class="ob-block ob-tone-kelp" style="padding:18px;margin-bottom:20px;">
                  <div style="font-family:var(--font-display);font-size:13px;text-transform:uppercase;margin-bottom:8px;">
                    UNLOCK WITH PASSWORD // 간편 비밀번호로 즉시 입장 ${state.cloudVaultEnc ? "(모든 기기 클라우드 금고 활성)" : ""}
                  </div>
                  <div class="form-row" style="margin-bottom:8px;">
                    <input type="password" id="unlock-pin-input" class="input" placeholder="설정한 간편 비밀번호 입력" style="flex:1;" />
                    <button class="ob-btn ob-btn--primary" id="btn-unlock-pin">UNLOCK →</button>
                  </div>
                  <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;">
                    <input type="checkbox" id="unlock-remember-device" class="task-toggle" checked />
                    <span>이 기기에서 자동 로그인 유지 (다음부터 비밀번호 입력 없이 바로 열림)</span>
                  </label>
                </div>`
              : ""
          }
          <div style="border-top:3px solid var(--frame);padding-top:16px;">
            <div style="font-family:var(--font-display);font-size:13px;text-transform:uppercase;margin-bottom:8px;">
              INITIAL SETUP // 최초 1회 GITHUB PAT 토큰 등록
            </div>
            <input type="password" id="auth-pat-direct" class="input" placeholder="github_pat_... 또는 ghp_..." style="margin-bottom:10px;" />
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px;cursor:pointer;">
              <input type="checkbox" id="auth-remember-direct" class="task-toggle" checked />
              <span><strong>이 기기에서 자동 로그인 유지</strong> (다음부터 토큰/비밀번호 입력 없이 접속 즉시 열림)</span>
            </label>
            <input type="password" id="auth-pin-setup" class="input" placeholder="선택: 스마트폰/다른 PC에서도 쓸 간편 비밀번호 (AES-256 암호화)" style="margin-bottom:14px;" />
            <button class="ob-btn ob-btn--primary" id="btn-save-pat-direct" style="width:100%;">CONNECT PRIVATE VAULT →</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSelectedClippingsMarkup() {
    if (!state.selectedClippingFiles.length) return "";
    const chips = state.selectedClippingFiles
      .map(
        (file, idx) =>
          `<span class="quick-file-chip" title="${esc(file.name)}">
            <span class="quick-file-chip__name">${esc(file.name)}</span>
            <button type="button" class="quick-file-chip__rm" data-remove-clip-idx="${idx}" aria-label="${esc(file.name)} 취소">✕</button>
          </span>`
      )
      .join("");
    return `${chips}<button type="button" class="ob-btn ob-btn--xs quick-file-clear-btn" id="btn-clear-clippings">선택 취소</button>`;
  }

  function syncSelectedClippingsUI() {
    const lbl = document.getElementById("label-choose-clippings");
    const count = state.selectedClippingFiles.length;
    if (lbl) {
      lbl.textContent = count ? `파일 선택 (${count})` : "파일 선택";
      lbl.title = count ? state.selectedClippingFiles.map((f) => f.name).join(", ") : "";
    }
    const bar = document.getElementById("quick-selected-files");
    if (bar) {
      bar.innerHTML = renderSelectedClippingsMarkup();
      bar.hidden = count === 0;
    }
  }

  function deriveMemoTitle(body) {
    const firstLine =
      String(body || "")
        .split(/\r?\n/)
        .map((l) => l.replace(/^[#>*\-\s]+/, "").trim())
        .find((l) => l.length > 0) || "";
    let base = firstLine
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40)
      .replace(/[.\s]+$/, "");
    if (!base) base = `메모 ${todayStr()}`;
    let candidate = base;
    let n = 2;
    while (state.byPath[`0. Inbox/${candidate}.md`]) {
      candidate = `${base} ${n}`;
      n += 1;
    }
    return candidate;
  }

  /* 1. Triage / Home View (Integrated Minimal Quick Sigma Inbox) */
  /* -------------------- V2.5 Enhancements: Provenance, Radar, Triage, Hub -------------------- */
  function renderAuthorBadge(note) {
    const layer = note.author_layer || (note.top_folder === "Clippings" ? "raw" : note.top_folder === "9. Wiki" ? "llm" : "human");
    if (layer === "raw") return `<span class="ob-badge ob-badge--warning">🔒 RAW</span>`;
    if (layer === "llm") return `<span class="ob-badge ob-badge--ai">🤖 LLM WIKI</span>`;
    if (layer === "hybrid") return `<span class="ob-badge ob-badge--info">⚡ HYBRID</span>`;
    return `<span class="ob-badge ob-badge--low">✍️ HUMAN</span>`;
  }

  function addDaysStr(baseDateStr, days) {
    const d = new Date(String(baseDateStr || todayStr()).slice(0, 10) + "T00:00:00Z");
    if (isNaN(d)) return todayStr();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function renderConflictBanner() {
    if (!state.conflicts || !state.conflicts.length) return "";
    return `
      <div class="ob-card" style="border-color:var(--down, #dc2626);margin-bottom:18px;">
        <div class="ob-card__head" style="background:rgba(220,38,38,0.08);">
          <span>⚠ GOOGLE DRIVE SYNC CONFLICT (${state.conflicts.length}) // 동시 수정 충돌 감지</span>
          <span class="ob-badge ob-badge--down">ACTION REQUIRED</span>
        </div>
        <div class="ob-card__body">
          <div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;">
            GitHub과 Google Drive에서 동시에 수정된 파일이 보존되었습니다. 두 노트를 비교·병합한 뒤 <code>.conflict-gdrive-*</code> 사본을 삭제하면 알림이 사라집니다.
          </div>
          ${state.conflicts
            .map(
              (c) => `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--hairline);">
                <span class="ob-mono" style="font-size:12.5px;">${esc(c.original_file)}</span>
                <div style="display:flex;gap:6px;">
                  <button class="ob-btn ob-btn--xs" data-note-path="${esc(c.original_file)}">원본 열기</button>
                  <button class="ob-btn ob-btn--xs ob-btn--primary" data-note-path="${esc(c.conflict_file)}">드라이브 사본 열기</button>
                </div>
              </div>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderReviewAndStalenessRadar() {
    const today = todayStr();
    const dueStocks = state.notes
      .filter((n) => n.folder === "6. Resources/Stocks" && n.props.position !== "매도")
      .map((n) => {
        const diff = n.props.next_review ? daysBetween(n.props.next_review, today) : null;
        return { note: n, diff };
      })
      .filter((x) => x.diff !== null && x.diff <= 30)
      .sort((a, b) => a.diff - b.diff);

    const staleWikis = state.notes
      .filter((n) => n.top_folder === "9. Wiki" && ((n.stale_sources && n.stale_sources.length > 0) || (n.props.wiki_type && ["entity", "concept", "synthesis"].includes(n.props.wiki_type) && daysBetween(today, n.mtime) > 60)))
      .slice(0, 8);

    const patWarn = (() => {
      if (!state.patExpiry) return "";
      const left = daysBetween(state.patExpiry, today);
      if (left !== null && left <= 7) {
        return `<div class="ob-mono" style="font-size:12px;color:var(--down, #dc2626);margin-bottom:10px;">⚠ Fine-grained PAT 만료 임박 (D${left >= 0 ? "-" + left : "+" + Math.abs(left)} · ${esc(state.patExpiry)}) — AUTH 창에서 갱신하세요.</div>`;
      }
      return "";
    })();

    const triageTargets = state.notes
      .filter(
        (n) =>
          (n.top_folder === "0. Inbox" && n.props.done !== true) ||
          (n.props.kind === "생각" && (!n.props.stage || n.props.stage === "임시"))
      )
      .slice(0, 6);

    if (!dueStocks.length && !staleWikis.length && !triageTargets.length && !patWarn) return "";

    return `
      <div class="ob-card" style="margin-bottom:20px;">
        <div class="ob-card__head">
          <span>RADAR // 복기 일정 · 위키 신선도 · Frontmatter 원클릭 분류</span>
          <span class="ob-mono" style="font-size:11px;color:var(--muted);">SAFE WRITE: ${state.safeWriteMode ? "ON" : "OFF"}</span>
        </div>
        <div class="ob-card__body">
          ${patWarn}
          <div class="grid-2" style="gap:16px;">
            <div>
              <div class="label" style="margin-bottom:8px;">📈 종목 점검 레이더 (${dueStocks.length})</div>
              ${
                dueStocks.length
                  ? dueStocks
                      .map(({ note, diff }) => {
                        const badgeCls = diff <= 0 ? "ob-badge--down" : diff <= 14 ? "ob-badge--warning" : "ob-badge--info";
                        const label = diff <= 0 ? `D+${Math.abs(diff)} 지연` : `D-${diff}`;
                        const cycle = Number(note.props.review_cycle_days) || 30;
                        return `
                          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--hairline);">
                            <div style="min-width:0;">
                              <span class="ob-badge ${badgeCls}">${label}</span>
                              ${noteLinkHTML(note.path, note.name)}
                            </div>
                            <button class="ob-btn ob-btn--xs" data-review-done="${esc(note.path)}" data-review-cycle="${cycle}">점검완료 +${cycle}일</button>
                          </div>`;
                      })
                      .join("")
                  : `<div style="font-size:12.5px;color:var(--muted);">30일 내 점검 예정 종목이 없습니다.</div>`
              }
              <div class="label" style="margin:14px 0 8px;">🤖 재합성 필요 위키 (${staleWikis.length})</div>
              ${
                staleWikis.length
                  ? staleWikis
                      .map(
                        (w) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--hairline);">
                          ${noteLinkHTML(w.path, w.name)}
                          <span class="ob-badge ob-badge--warning">${w.stale_sources && w.stale_sources.length ? `신규출처 ${w.stale_sources.length}건` : `노후(${w.mtime})`}</span>
                        </div>`
                      )
                      .join("")
                  : `<div style="font-size:12.5px;color:var(--muted);">모든 LLM 위키가 최신 출처와 동기화되어 있습니다.</div>`
              }
            </div>
            <div>
              <div class="label" style="margin-bottom:8px;">⚡ 폴더 이동 없는 Frontmatter 빠른 분류 (${triageTargets.length})</div>
              ${
                triageTargets.length
                  ? triageTargets
                      .map(
                        (t) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--hairline);">
                          <div style="min-width:0;flex:1;">
                            ${renderAuthorBadge(t)}
                            ${noteLinkHTML(t.path, t.name)}
                          </div>
                          <div style="display:flex;gap:4px;">
                            <button class="ob-btn ob-btn--xs" data-fm-action="processing" data-fm-path="${esc(t.path)}">처리중</button>
                            ${t.props.kind === "생각" ? `<button class="ob-btn ob-btn--xs ob-btn--ai" data-fm-action="promote_perm" data-fm-path="${esc(t.path)}">영구승격</button>` : ""}
                            <button class="ob-btn ob-btn--xs" data-fm-action="done" data-fm-path="${esc(t.path)}">완료</button>
                          </div>
                        </div>`
                      )
                      .join("")
                  : `<div style="font-size:12.5px;color:var(--muted);">대기 중인 수집함·임시 생각이 없습니다.</div>`
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderTickerThemeHub() {
    const tickers = Object.keys(state.tickersIndex || {}).sort((a, b) => {
      const sa = state.tickersIndex[a]?.stock_note ? 0 : 1;
      const sb = state.tickersIndex[b]?.stock_note ? 0 : 1;
      return sa - sb || (state.tickersIndex[b]?.total || 0) - (state.tickersIndex[a]?.total || 0);
    });
    const themes = Object.keys(state.themesIndex || {});

    if (!state.hubTicker && !state.hubTheme && tickers.length) {
      state.hubTicker = tickers[0];
    }

    let detailHtml = `<div style="color:var(--muted);font-size:13px;">위 티커 또는 테마를 선택하면 관련 투자 논리·위키·어닝콜·SEC·개인 생각 노트가 한 화면에 집계됩니다.</div>`;

    if (state.hubTicker && state.tickersIndex[state.hubTicker]) {
      const b = state.tickersIndex[state.hubTicker];
      const renderGroup = (title, paths) => {
        const valid = (paths || []).filter((p) => state.byPath[p]);
        if (!valid.length) return "";
        return `
          <div style="margin-bottom:14px;">
            <div class="label" style="margin-bottom:6px;">${esc(title)} (${valid.length})</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${valid.map((p) => `<button class="ob-btn ob-btn--xs" data-note-path="${esc(p)}">${esc(state.byPath[p].name)} →</button>`).join("")}
            </div>
          </div>`;
      };
      detailHtml = `
        <div class="ob-card" style="margin-top:14px;">
          <div class="ob-card__head">
            <span><span class="ob-ticker">${esc(b.ticker)}</span> TICKER HUB // 연결 노트 총 ${b.total}건</span>
            <div style="display:flex;gap:6px;">
              ${b.stock_note ? `<button class="ob-btn ob-btn--xs ob-btn--primary" data-note-path="${esc(b.stock_note)}">투자 논리 →</button>` : ""}
              ${b.valuation_note ? `<button class="ob-btn ob-btn--xs ob-btn--primary" data-note-path="${esc(b.valuation_note)}">다모다란 밸류에이션 →</button>` : ""}
              ${b.entity_note ? `<button class="ob-btn ob-btn--xs ob-btn--ai" data-note-path="${esc(b.entity_note)}">위키 엔티티 →</button>` : ""}
            </div>
          </div>
          <div class="ob-card__body">
            ${renderGroup("밸류에이션 데스크 (Story · Decision)", b.desk_notes)}
            ${renderGroup("어닝콜 시계열", b.call_notes)}
            ${renderGroup("대형 행사 · IR", b.event_notes)}
            ${renderGroup("개인 생각 · 참고 노트", b.thought_notes)}
            ${renderGroup("위키 종합 · 출처", b.wiki_notes)}
            ${renderGroup("SEC 공시 (최신순)", [...(b.sec_notes || [])].reverse().slice(0, 10))}
            ${renderGroup("원본 클리핑", (b.clipping_notes || []).slice(0, 10))}
          </div>
        </div>`;
    } else if (state.hubTheme && state.themesIndex[state.hubTheme]) {
      const paths = state.themesIndex[state.hubTheme].filter((p) => state.byPath[p]);
      detailHtml = renderBaseTable(
        `THEME HUB // ${state.hubTheme} (${paths.length})`,
        ["NOTE", "LAYER", "FOLDER", "UPDATED"],
        paths.map((p) => {
          const n = state.byPath[p];
          return [
            noteLinkHTML(n.path, n.name),
            renderAuthorBadge(n),
            `<span class="ob-badge">${esc(n.top_folder)}</span>`,
            `<span class="ob-mono">${esc(n.mtime)}</span>`,
          ];
        })
      );
    }

    return `
      <div style="margin-bottom:14px;">
        <div class="label" style="margin-bottom:8px;">TICKERS (${tickers.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
          ${tickers
            .map(
              (tk) =>
                `<button class="ob-chip ${state.hubTicker === tk ? "is-active" : ""}" data-hub-ticker="${esc(tk)}">${esc(tk)} (${state.tickersIndex[tk].total})</button>`
            )
            .join("")}
        </div>
        <div class="label" style="margin-bottom:8px;">THEMES &amp; CONCEPTS (${themes.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${themes
            .slice(0, 24)
            .map(
              (th) =>
                `<button class="ob-chip ${state.hubTheme === th ? "is-active" : ""}" data-hub-theme="${esc(th)}">${esc(th)} (${state.themesIndex[th].length})</button>`
            )
            .join("")}
        </div>
      </div>
      ${detailHtml}
    `;
  }

  /* 1. Triage / Home View */
  function renderTriageView() {
    const latestDaily = state.notes
      .filter((n) => n.top_folder === "1. Daily Note")
      .sort((a, b) => b.name.localeCompare(a.name))[0];
    const clipCount = state.selectedClippingFiles.length;

    return `
      <!-- Minimal Quick Sigma Inbox -->
      <div class="ob-card ob-card--elevated quick-inbox-card">
        <div class="ob-card__head">
          <span>빠른 시그마 수집함</span>
          <div class="quick-inbox-head-actions">
            ${latestDaily ? `<button class="ob-btn ob-btn--xs" data-note-path="${esc(latestDaily.path)}">오늘 노트</button>` : ""}
          </div>
        </div>
        <div class="ob-card__body">
          <textarea id="quick-body" class="textarea quick-body-textarea" placeholder="메모" aria-label="메모"></textarea>
          <div id="quick-selected-files" class="quick-selected-files"${clipCount ? "" : " hidden"}>${renderSelectedClippingsMarkup()}</div>
          <div class="quick-toolbar">
            <div class="quick-clip-group">
              <input type="file" id="clipping-file-input" accept=".md,text/markdown" multiple class="quick-file-hidden" aria-label="클리핑 파일 선택" />
              <label for="clipping-file-input" class="ob-btn ob-btn--sm" id="label-choose-clippings">${clipCount ? `파일 선택 (${clipCount})` : "파일 선택"}</label>
              <button type="button" class="ob-btn ob-btn--sm" id="btn-upload-clippings">클리핑 업로드</button>
            </div>
            <div class="quick-action-group">
              <button type="button" class="ob-btn ob-btn--sm" id="btn-dispatch-workflows">워크플로우 디스패치 ↗</button>
              <button type="button" class="ob-btn ob-btn--primary ob-btn--sm" id="btn-quick-save">저장 +</button>
            </div>
          </div>
        </div>
      </div>

      ${renderConflictBanner()}
      ${renderReviewAndStalenessRadar()}
      ${window.SIGMA_V2 ? window.SIGMA_V2.renderHabitHeatmapPanel(state) : ""}

      <div class="grid-2">
        <div>
          ${evaluateBaseEmbed("resources.base#다듬을 생각")}
          ${evaluateBaseEmbed("inbox.base#수집함")}
          ${evaluateBaseEmbed("tasks.base#오늘")}
          ${evaluateBaseEmbed("tasks.base#미계획")}
        </div>
        <div>
          ${evaluateBaseEmbed("stocks.base#보유")}
          ${evaluateBaseEmbed("inbox.base#ingest 대기")}
        </div>
      </div>
    `;
  }

  /* 2. Thoughts, Permanent & Reference Notes View */
  function renderThoughtsView() {
    const allResourceNotes = state.notes.filter(
      (n) => n.top_folder === "6. Resources" && n.folder !== "6. Resources/Stocks"
    );
    const permThoughts = allResourceNotes.filter((n) => n.props.kind === "생각" && n.props.stage === "영구");
    const tempThoughts = allResourceNotes.filter((n) => n.props.kind === "생각" && (!n.props.stage || n.props.stage === "임시"));
    const refNotes = allResourceNotes.filter((n) => n.props.kind === "참고");
    const studyNotes = allResourceNotes.filter((n) => n.props.kind !== "생각" && n.props.kind !== "참고");

    let filtered = allResourceNotes;
    if (state.thoughtFilter === "perm") filtered = permThoughts;
    else if (state.thoughtFilter === "temp") filtered = tempThoughts;
    else if (state.thoughtFilter === "ref") filtered = refNotes;
    else if (state.thoughtFilter === "study") filtered = studyNotes;

    filtered.sort((a, b) => b.mtime.localeCompare(a.mtime));

    const cards = filtered
      .map((n) => {
        const isPerm = n.props.stage === "영구";
        const isTemp = n.props.kind === "생각" && !isPerm;
        const badgeClass = isPerm ? "ob-badge--low" : isTemp ? "ob-badge--warning" : "ob-badge--info";
        const badgeLabel = n.props.kind === "생각" ? `THOUGHT · ${n.props.stage || "임시"}` : n.props.kind || "RESOURCE";
        const hasOriginalMemo = n.body.includes("## 원래 메모");
        const hasAiExpansion = n.body.includes("AI 확장");
        const preview = n.props.summary || n.body.replace(/^#+\s+.*$/gm, "").trim().slice(0, 165);

        return `
          <div class="ob-card" data-note-path="${esc(n.path)}" style="cursor:pointer;margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;">
            <div class="ob-card__head">
              <span class="ob-badge ${badgeClass}">${esc(badgeLabel)}</span>
              <span class="ob-mono" style="font-size:11.5px;color:var(--muted);">${esc(n.mtime)}</span>
            </div>
            <div class="ob-card__body" style="flex:1;display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <h3 style="margin:0 0 8px;font-size:17px;line-height:1.35;color:var(--ink);">${esc(n.name)}</h3>
                <p style="font-size:13px;color:var(--muted);margin:0 0 14px;">${esc(preview)}</p>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--hairline);">
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  ${hasOriginalMemo ? '<span class="ob-badge">RAW MEMO ✓</span>' : ""}
                  ${hasAiExpansion ? '<span class="ob-badge ob-badge--ai">AI EXPANDED</span>' : ""}
                  ${n.backlinks.length ? `<span class="ob-badge">LINKS ${n.backlinks.length}</span>` : ""}
                </div>
                <span class="ob-mono" style="font-size:12px;color:var(--ink);font-weight:700;">OPEN →</span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="ob-card ob-card--elevated">
        <div class="ob-card__head">
          <span>ZETTELKASTEN // 생각 노트 · 영구 노트 · 참고 노트 (${filtered.length})</span>
          <button class="ob-btn ob-btn--primary ob-btn--sm" id="btn-new-thought-jump" data-jump-tab="triage" data-focus-quick="true">NEW THOUGHT +</button>
        </div>
        <div class="ob-card__body">
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">
            <button class="ob-chip ${state.thoughtFilter === "all" ? "is-active" : ""}" data-thought-filter="all">ALL (${allResourceNotes.length})</button>
            <button class="ob-chip ${state.thoughtFilter === "perm" ? "is-active" : ""}" data-thought-filter="perm">PERMANENT · 영구 생각 (${permThoughts.length})</button>
            <button class="ob-chip ${state.thoughtFilter === "temp" ? "is-active" : ""}" data-thought-filter="temp">FLEETING · 다듬을 생각 (${tempThoughts.length})</button>
            <button class="ob-chip ${state.thoughtFilter === "ref" ? "is-active" : ""}" data-thought-filter="ref">REFERENCE · 참고 노트 (${refNotes.length})</button>
            <button class="ob-chip ${state.thoughtFilter === "study" ? "is-active" : ""}" data-thought-filter="study">STUDY &amp; DOCS · 공부·상담 자료 (${studyNotes.length})</button>
            <button class="ob-chip" data-note-path="8. System/생각 노트.md">SYSTEM GUIDE →</button>
          </div>
          <div class="grid-3">${cards}</div>
        </div>
      </div>
    `;
  }

  /* 4. Investing & LLM Wiki View */
  function renderInvestingView() {
    const stocks = state.notes
      .filter((n) => n.folder === "6. Resources/Stocks")
      .sort((a, b) => a.name.localeCompare(b.name));

    const callSourceMap = {
      NVDA: "9. Wiki/Sources/src-nvda-earnings-calls-fy25-fy27.md",
      AVGO: "9. Wiki/Sources/src-avgo-earnings-calls-fy24-fy26.md",
      MRVL: "9. Wiki/Sources/src-mrvl-earnings-calls-fy25-fy27.md",
      GOOGL: "9. Wiki/Sources/src-googl-earnings-calls-2024-2026.md",
      SPCX: "9. Wiki/Sources/src-spcx-earnings-calls-2026.md",
      ANT: "9. Wiki/Entities/Anthropic.md",
    };

    const eventSourceMap = {
      NVDA: "9. Wiki/Sources/src-nvda-gtc-taipei-analyst-qa-2026.md",
      MRVL: "9. Wiki/Sources/src-mrvl-investor-day-2026.md",
    };

    const stockCards = stocks
      .map((s) => {
        const ticker = String(s.props.ticker || s.name.split(" ")[0]).toUpperCase();
        const hubBucket = state.tickersIndex[ticker] || {};
        const wikiTarget = resolveNoteLink(s.props.wiki || ticker) || (hubBucket.entity_note ? state.byPath[hubBucket.entity_note] : null);
        const callPath = (hubBucket.call_notes && hubBucket.call_notes[0]) || callSourceMap[ticker];
        const eventPath = (hubBucket.event_notes && hubBucket.event_notes[0]) || eventSourceMap[ticker];
        return `
          <div class="ob-card" style="margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;">
            <div class="ob-card__head">
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="ob-ticker" data-ticker="${esc(ticker)}">${esc(ticker)}</span>
                <span>${esc(s.name)}</span>
              </div>
              <span class="ob-badge ob-badge--low">${esc(s.props.position || "HOLDING")}</span>
            </div>
            <div class="ob-card__body" style="flex:1;display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <div class="ob-mono" style="font-size:12px;color:var(--muted);margin-bottom:10px;">
                  SECTOR: ${esc(s.props.sector || "−")} // NEXT REVIEW: <strong style="color:var(--ink);">${esc(s.props.next_review || "−")}</strong>
                </div>
                <div style="font-size:13.5px;margin-bottom:10px;color:var(--ink);"><strong>THESIS:</strong> ${esc(s.props.thesis || "−")}</div>
                <div style="font-size:12.5px;color:var(--muted);margin-bottom:14px;"><strong>QUESTION:</strong> ${esc(s.props.question || "−")}</div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;padding-top:12px;border-top:1px solid var(--hairline);">
                <button class="ob-btn ob-btn--xs" data-note-path="${esc(s.path)}">THESIS NOTE →</button>
                ${hubBucket.valuation_note && state.byPath[hubBucket.valuation_note] ? `<button class="ob-btn ob-btn--xs ob-btn--primary" data-note-path="${esc(hubBucket.valuation_note)}">DAMODARAN DCF</button>` : ""}
                ${callPath && state.byPath[callPath] ? `<button class="ob-btn ob-btn--xs" data-note-path="${esc(callPath)}">EARNINGS SERIES</button>` : ""}
                ${eventPath && state.byPath[eventPath] ? `<button class="ob-btn ob-btn--xs" data-note-path="${esc(eventPath)}">EVENT 5-BOX</button>` : ""}
                ${wikiTarget ? `<button class="ob-btn ob-btn--xs" data-note-path="${esc(wikiTarget.path)}">WIKI ENTITY</button>` : ""}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    const wikiNotes = state.notes.filter((n) => n.top_folder === "9. Wiki");
    let subContent = "";

    if (state.investingSubtab === "stocks") {
      subContent = `
        <div class="grid-3" style="margin-bottom:24px;">${stockCards}</div>
        <div class="grid-2">
          <div>${renderQuickPreviewPanel("9. Wiki/매크로 스냅샷.md", "FRED MACRO SNAPSHOT // 거시 지표 및 점검 트리거")}</div>
          <div>${renderQuickPreviewPanel("9. Wiki/AI 인프라 신용 점검.md", "AI INFRA CREDIT // 보증 · XPV · FCF 신용 점검")}</div>
        </div>
      `;
    } else if (state.investingSubtab === "hub") {
      subContent = renderTickerThemeHub();
    } else if (state.investingSubtab === "calls") {
      const callPaths = [
        "9. Wiki/Sources/src-nvda-earnings-calls-fy25-fy27.md",
        "9. Wiki/Sources/src-nvda-gtc-taipei-analyst-qa-2026.md",
        "9. Wiki/Sources/src-avgo-earnings-calls-fy24-fy26.md",
        "9. Wiki/Sources/src-mrvl-earnings-calls-fy25-fy27.md",
        "9. Wiki/Sources/src-mrvl-investor-day-2026.md",
        "9. Wiki/Sources/src-googl-earnings-calls-2024-2026.md",
        "9. Wiki/Sources/src-spcx-earnings-calls-2026.md",
      ];
      subContent = `<div class="grid-2">${callPaths.map((p) => renderQuickPreviewPanel(p)).join("")}</div>`;
    } else {
      let filteredWiki = wikiNotes;
      if (state.wikiFilter === "entity") filteredWiki = wikiNotes.filter((n) => n.folder === "9. Wiki/Entities");
      else if (state.wikiFilter === "concept") filteredWiki = wikiNotes.filter((n) => n.folder === "9. Wiki/Concepts");
      else if (state.wikiFilter === "synthesis") filteredWiki = wikiNotes.filter((n) => n.props.wiki_type === "synthesis");
      else if (state.wikiFilter === "source") filteredWiki = wikiNotes.filter((n) => n.folder === "9. Wiki/Sources" && !n.name.startsWith("src-sec-"));
      else if (state.wikiFilter === "sec") filteredWiki = wikiNotes.filter((n) => n.name.startsWith("src-sec-") || n.name === "SEC 공시");

      subContent = `
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          <button class="ob-chip ${state.wikiFilter === "all" ? "is-active" : ""}" data-wiki-filter="all">ALL WIKI (${wikiNotes.length})</button>
          <button class="ob-chip ${state.wikiFilter === "synthesis" ? "is-active" : ""}" data-wiki-filter="synthesis">SYNTHESES · 종합/매크로/신용/IR</button>
          <button class="ob-chip ${state.wikiFilter === "entity" ? "is-active" : ""}" data-wiki-filter="entity">ENTITIES · 기업/인물</button>
          <button class="ob-chip ${state.wikiFilter === "concept" ? "is-active" : ""}" data-wiki-filter="concept">CONCEPTS · 개념</button>
          <button class="ob-chip ${state.wikiFilter === "source" ? "is-active" : ""}" data-wiki-filter="source">SOURCES · 어닝콜/일반 출처</button>
          <button class="ob-chip ${state.wikiFilter === "sec" ? "is-active" : ""}" data-wiki-filter="sec">SEC EDGAR (75)</button>
        </div>
        ${renderBaseTable(
          `LLM WIKI DIRECTORY (${filteredWiki.length})`,
          ["WIKI PAGE", "TYPE / FOLDER", "TICKER / CREDIBILITY", "UPDATED"],
          filteredWiki.map((n) => [
            noteLinkHTML(n.path, n.name),
            `<span class="ob-badge">${esc(n.props.wiki_type || n.folder)}</span>`,
            `<span class="ob-mono">${esc(n.props.ticker || n.props.credibility || "−")}</span>`,
            `<span class="ob-mono">${esc(n.mtime)}</span>`,
          ])
        )}
      `;
    }

    return `
      <div class="ob-card ob-card--elevated">
        <div class="ob-card__head">
          <span>ORDERBLOCK INVESTING &amp; LLM WIKI // 6종목 투자 터미널</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="ob-btn ob-btn--xs" data-note-path="9. Wiki/overview.md">WIKI OVERVIEW</button>
            <button class="ob-btn ob-btn--xs" data-note-path="9. Wiki/index.md">WIKI INDEX</button>
            <button class="ob-btn ob-btn--xs" data-note-path="9. Wiki/공식 보도자료.md">OFFICIAL IR</button>
            <button class="ob-btn ob-btn--xs" data-note-path="9. Wiki/SEC 공시.md">SEC FILINGS</button>
            ${state.byPath["10. Equity Desk/04_Dashboards/US_Stock_Desk.md"] ? `<button class="ob-btn ob-btn--xs ob-btn--primary" data-note-path="10. Equity Desk/04_Dashboards/US_Stock_Desk.md">VALUATION DESK</button>` : ""}
            ${state.byPath["10. Equity Desk/01_Macro_Desk/US_Macro_Pulse.md"] ? `<button class="ob-btn ob-btn--xs" data-note-path="10. Equity Desk/01_Macro_Desk/US_Macro_Pulse.md">MACRO PULSE</button>` : ""}
          </div>
        </div>
        <div class="ob-card__body">
          ${window.SIGMA_V2 ? window.SIGMA_V2.renderEarningsChartPanel() : ""}
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">
            <button class="ob-chip ${state.investingSubtab === "stocks" ? "is-active" : ""}" data-inv-sub="stocks">01 // 핵심 보유 6종목 &amp; 매크로·신용</button>
            <button class="ob-chip ${state.investingSubtab === "calls" ? "is-active" : ""}" data-inv-sub="calls">02 // 어닝콜 46건 + 대형행사 2건 시계열</button>
            <button class="ob-chip ${state.investingSubtab === "wiki" ? "is-active" : ""}" data-inv-sub="wiki">03 // LLM 위키 전체 탐색 (${wikiNotes.length})</button>
            <button class="ob-chip ${state.investingSubtab === "hub" ? "is-active" : ""}" data-inv-sub="hub">04 // 티커 · 테마 허브 (${Object.keys(state.tickersIndex || {}).length})</button>
          </div>
          ${subContent}
        </div>
      </div>
    `;
  }

  function renderQuickPreviewPanel(relPath, customTitle) {
    const n = state.byPath[relPath];
    if (!n) return "";
    const rawCount = Array.isArray(n.props.raw) ? n.props.raw.length : 0;
    return `
      <div class="ob-card" style="margin-bottom:0;">
        <div class="ob-card__head">
          <span>${noteLinkHTML(n.path, customTitle || n.name)}</span>
          <div style="display:flex;gap:6px;align-items:center;">
            ${rawCount ? `<span class="ob-badge ob-badge--info">${rawCount} TRANSCRIPTS</span>` : ""}
            <button class="ob-btn ob-btn--xs" data-note-path="${esc(n.path)}">OPEN FULL →</button>
          </div>
        </div>
        <div class="ob-card__body md-body" style="max-height:340px;overflow-y:auto;font-size:13.2px;">
          ${renderMarkdown(n.body.slice(0, 1800), n)}
        </div>
      </div>
    `;
  }

  /* 5. Full Vault Explorer + Note Reader & Editor View */
  function renderExplorerView() {
    const folders = {};
    for (const n of state.notes) {
      const f = n.top_folder;
      if (!folders[f]) folders[f] = [];
      folders[f].push(n);
    }

    const folderHtml = Object.keys(folders)
      .sort()
      .map((f) => {
        const items = folders[f].sort((a, b) => a.name.localeCompare(b.name));
        const collapsed = Boolean(state.collapsedFolders[f]);
        return `
          <div class="folder-group">
            <div class="folder-header" data-toggle-folder="${esc(f)}">
              <span>${collapsed ? "+" : "−"} ${esc(f)}</span>
              <span class="ob-badge">${items.length}</span>
            </div>
            ${
              collapsed
                ? ""
                : `<div class="folder-items">${items
                    .map(
                      (n) =>
                        `<div class="file-item ${n.path === state.currentNotePath ? "active" : ""}" data-note-path="${esc(n.path)}" title="${esc(n.path)}">
                          <span style="overflow:hidden;text-overflow:ellipsis;">${esc(n.name)}</span>
                        </div>`
                    )
                    .join("")}</div>`
            }
          </div>
        `;
      })
      .join("");

    const note = state.byPath[state.currentNotePath] || state.notes[0];
    if (!note) return "<div class='ob-card'><div class='ob-card__body'>NO NOTE FOUND.</div></div>";

    const isClipping = note.top_folder === "Clippings";
    const isTempThought = note.props.kind === "생각" && (!note.props.stage || note.props.stage === "임시");
    const propKeys = Object.keys(note.props);

    const propsHtml = propKeys.length
      ? `<div class="props-grid">${propKeys
          .map((k) => `<span class="prop-chip"><span class="prop-key">${esc(k)}:</span> <span>${formatPropVal(note.props[k])}</span></span>`)
          .join("")}</div>`
      : "";

    const provenanceHtml =
      note.top_folder === "9. Wiki"
        ? `<div class="ob-block" style="padding:10px 14px;margin-bottom:14px;border:2px solid var(--frame);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <div>${renderAuthorBadge(note)} <span class="ob-mono" style="font-size:12px;margin-left:6px;">COMPILED: ${esc(note.props.last_compiled || note.props.updated || note.mtime)}</span></div>
              ${
                note.stale_sources && note.stale_sources.length
                  ? `<span class="ob-badge ob-badge--warning">⚠ 재합성 권장 · 신규 출처 ${note.stale_sources.length}건</span>`
                  : `<span class="ob-badge ob-badge--low">✓ 출처 최신 일치</span>`
              }
            </div>
            ${
              note.stale_sources && note.stale_sources.length
                ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
                    ${note.stale_sources
                      .map((sp) => {
                        const sn = state.byPath[sp];
                        return sn ? `<button class="ob-btn ob-btn--xs" data-note-path="${esc(sp)}">갱신된 출처: ${esc(sn.name)} →</button>` : "";
                      })
                      .join("")}
                  </div>`
                : ""
            }
          </div>`
        : "";

    const backlinksHtml = note.backlinks && note.backlinks.length
      ? `<div style="margin-top:32px;padding-top:16px;border-top:3px solid var(--frame);">
          <div class="label" style="margin-bottom:10px;color:var(--muted);">BACKLINKS // 이 노트를 인용한 연결 노트 (${note.backlinks.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${note.backlinks
              .map((bp) => {
                const bn = state.byPath[bp];
                return bn ? `<button class="ob-btn ob-btn--xs" data-note-path="${esc(bn.path)}">${esc(bn.name)} →</button>` : "";
              })
              .join("")}
          </div>
        </div>`
      : "";

    let readerBodyHtml = "";
    if (state.editingNote && !isClipping) {
      const fullRaw = serializeFrontmatterJS(note.props, note.body);
      readerBodyHtml = `
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="ob-mono" style="font-size:12px;color:var(--muted);">EDIT MARKDOWN &amp; FRONTMATTER (## 원래 메모 보존 원칙 준수)</span>
            ${
              isTempThought
                ? `<button class="ob-btn ob-btn--ai ob-btn--xs" id="btn-insert-perm-template">+ 영구 생각 AI 확장 섹션 틀 삽입</button>`
                : ""
            }
          </div>
          <textarea id="note-editor-textarea" class="textarea" style="min-height:460px;font-family:var(--font-mono);font-size:13px;">${esc(fullRaw)}</textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="ob-btn ob-btn--sm" id="btn-cancel-edit">CANCEL</button>
          <button class="ob-btn ob-btn--primary ob-btn--sm" id="btn-save-edit">COMMIT CHANGES +</button>
        </div>
      `;
    } else {
      readerBodyHtml = `
        ${provenanceHtml}
        ${propsHtml}
        <div class="md-body">${renderMarkdown(note.body, note)}</div>
        ${
          note.truncated
            ? `<div style="margin-top:18px;"><button class="ob-btn ob-btn--primary" id="btn-load-full-clipping">LOAD FULL TRANSCRIPT (${(note.size / 1024).toFixed(1)} KB) →</button></div>`
            : ""
        }
        ${backlinksHtml}
        ${window.SIGMA_V2 ? window.SIGMA_V2.renderGraphPanel(note) : ""}
      `;
    }

    const splitActive = Boolean(window.SIGMA_V2 && window.SIGMA_V2.state.splitActive);

    return `
      <div class="explorer-layout ${splitActive ? "is-split" : ""}">
        <button class="ob-btn ob-btn--sm mobile-tree-toggle" id="btn-mobile-tree-toggle">
          ${state.mobileTreeOpen ? "− CLOSE VAULT FOLDERS // 폴더 목록 닫기" : `+ OPEN VAULT FOLDERS // 폴더 목록 열기 (${state.notes.length})`}
        </button>
        <aside class="sidebar ${state.mobileTreeOpen ? "mobile-open" : ""}" aria-label="볼트 폴더 트리">
          <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid var(--frame);margin-bottom:10px;">
            <span class="label">VAULT TREE</span>
            <button class="ob-btn ob-btn--xs" id="btn-back-history" ${state.historyStack.length ? "" : "disabled"}>← BACK</button>
          </div>
          ${folderHtml}
        </aside>

        <section class="note-reader">
          <div class="note-top-meta">
            <div>
              <div class="note-path">${esc(note.path)}</div>
              <h2 style="margin:6px 0 0;font-family:var(--font-display);font-size:22px;line-height:28px;color:var(--ink);">${esc(note.name)}</h2>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button class="ob-btn ob-btn--xs ${splitActive ? "ob-btn--ai" : ""}" id="btn-toggle-split" title="좌측 원문/위키 + 우측 생각/종목 노트 동시 비교·편집">
                ${splitActive ? "CLOSE SPLIT [✕]" : "◨ SPLIT PANE // 좌우 분할 비교·편집"}
              </button>
              ${renderAuthorBadge(note)}
              ${
                isClipping
                  ? `<span class="ob-badge ob-badge--warning" title="CLAUDE.md 규칙에 따라 Clippings 원본은 수정하지 않고 보존합니다">RAW CLIPPING · READ ONLY</span>`
                  : `<button class="ob-btn ob-btn--xs ${state.editingNote ? "ob-btn--primary" : ""}" id="btn-toggle-edit" title="Safe Write 모드에서는 확인 후 본문 편집 모드로 전환합니다">${
                      state.editingNote ? "VIEW MODE" : (state.safeWriteMode ? "FULL EDIT 🔒" : "EDIT NOTE")
                    }</button>`
              }
              <a href="https://github.com/${esc(state.repo)}/blob/main/${encodeRepoPath(note.path)}" target="_blank" rel="noopener" class="ob-btn ob-btn--xs">GITHUB ↗</a>
            </div>
          </div>
          ${readerBodyHtml}
        </section>

        ${window.SIGMA_V2 ? window.SIGMA_V2.renderSplitPaneRight(state, renderMarkdown, serializeFrontmatterJS) : ""}
      </div>
    `;
  }

  function renderAll() {
    renderStatsStrip();
    document.querySelectorAll(".ob-nav__link, .mobile-bottom-nav__btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === state.activeTab);
    });
    const container = document.getElementById("view-container");
    if (!container) return;

    if (state.mode === "locked") {
      container.innerHTML = renderLockedView();
      return;
    }

    if (state.activeTab === "thoughts") container.innerHTML = renderThoughtsView();
    else if (state.activeTab === "investing") container.innerHTML = renderInvestingView();
    else if (state.activeTab === "explorer") {
      container.innerHTML = renderExplorerView();
      if (window.SIGMA_V2) {
        setTimeout(() => window.SIGMA_V2.mountGraphCanvas(state, openNote), 20);
      }
    } else {
      state.activeTab = "triage";
      container.innerHTML = renderTriageView();
    }
  }

  /* -------------------- Navigation & Actions -------------------- */
  async function openNote(relPath, pushHistory = true) {
    const note = state.byPath[relPath];
    if (!note) {
      showToast(`ERROR — Note not found: ${relPath}`);
      return;
    }
    if (pushHistory && state.currentNotePath && state.currentNotePath !== relPath) {
      state.historyStack.push(state.currentNotePath);
    }
    state.currentNotePath = relPath;
    state.editingNote = false;
    state.mobileTreeOpen = false;
    state.collapsedFolders[note.top_folder] = false;
    state.activeTab = "explorer";
    renderAll();
    window.scrollTo({ top: 0, behavior: "auto" });

    if (note.truncated) {
      try {
        await ensureFullNoteBody(note);
        renderAll();
      } catch (_) {}
    }
  }

  function buildNewNotePayload(kind, title, body, opts = {}) {
    const today = todayStr();
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-").trim();
    const importance = opts.importance || "일반";
    const dateVal = opts.date || today;
    const sourceVal = opts.source || "시그마 웹 수집함";
    const summaryVal = opts.summary || "";

    if (kind === "thought_temp") {
      const props = {
        entity: "자료",
        kind: "생각",
        stage: "임시",
        importance,
        captured: today,
        source: sourceVal,
      };
      if (summaryVal) props.summary = summaryVal;
      return {
        path: `6. Resources/Thoughts/${safeTitle}.md`,
        content: serializeFrontmatterJS(props, `## 원래 메모\n${body.trim()}\n`),
      };
    }

    if (kind === "thought_perm") {
      const props = {
        entity: "자료",
        kind: "생각",
        stage: "영구",
        importance,
        pinned: false,
        summary: summaryVal || safeTitle,
        source: sourceVal,
        captured: today,
        reviewed: today,
        publish: false,
      };
      const tpl = `## 주장\n${body.trim()}\n\n## 근거 · 연결 (AI 확장)\n- \n\n## 반대로 볼 수 있는 점 (AI 확장)\n- \n\n## 이어지는 생각 (AI 확장)\n- \n\n## 원래 메모\n${body.trim()}\n`;
      return {
        path: `6. Resources/Thoughts/${safeTitle}.md`,
        content: serializeFrontmatterJS(props, tpl),
      };
    }

    if (kind === "reference") {
      const props = {
        entity: "자료",
        kind: "참고",
        importance,
        source: sourceVal,
        summary: summaryVal || safeTitle,
        captured: today,
      };
      return {
        path: `6. Resources/${safeTitle}.md`,
        content: serializeFrontmatterJS(props, `## 걸린 대목 · 인용\n\n\n## 내 반응 · 생각\n${body.trim()}\n`),
      };
    }

    if (kind === "task" || kind === "schedule") {
      const props = {
        entity: "할일",
        type: kind === "schedule" ? "일정" : "일반",
        priority: importance === "중요" ? 1 : 2,
        do_date: dateVal,
        done: false,
      };
      return {
        path: `5. Tasks/${safeTitle}.md`,
        content: serializeFrontmatterJS(props, `${body.trim()}\n`),
      };
    }

    const props = {
      captured: today,
      source: sourceVal,
    };
    return {
      path: `0. Inbox/${safeTitle}.md`,
      content: serializeFrontmatterJS(props, `${body.trim()}\n`),
    };
  }

  async function saveNewInboxNote(kind, title, body, opts = {}) {
    if (!title.trim()) {
      showToast("ERROR — 제목을 입력하십시오.");
      return;
    }
    const payload = buildNewNotePayload(kind, title, body, opts);
    upsertNoteInMemory(payload.path, payload.content);
    renderAll();

    if (state.token) {
      showToast(`COMMITTING: ${payload.path}`);
      await ghPutFile(payload.path, payload.content, `feat(inbox): add ${payload.path} via Sigma OS Web`);
      showToast(`OK — SAVED: ${payload.path}`);
    } else {
      showToast(`OK — SAVED: ${payload.path}`);
    }
  }

  /* -------------------- Search Modal -------------------- */
  function openSearchModal(initialQuery = "") {
    const modal = document.getElementById("search-modal");
    const input = document.getElementById("search-input");
    if (!modal || !input) return;
    modal.classList.add("open");
    input.value = initialQuery;
    input.focus();
    runSearch(initialQuery);
  }

  function runSearch(query) {
    const box = document.getElementById("search-results");
    if (!box) return;
    const q = String(query || "").trim().toLowerCase();
    if (!q) {
      box.innerHTML = `<div style="color:var(--muted);font-size:13px;">344개 전체 노트 제목·본문·속성·티커에서 실시간 검색합니다.</div>`;
      return;
    }
    const matches = [];
    for (const n of state.notes) {
      const nameHit = n.name.toLowerCase().includes(q);
      const propStr = JSON.stringify(n.props).toLowerCase();
      const propHit = propStr.includes(q);
      const bodyHit = n.body.toLowerCase().includes(q);
      if (nameHit || propHit || bodyHit) {
        const score = (nameHit ? 10 : 0) + (propHit ? 5 : 0) + (bodyHit ? 1 : 0);
        matches.push({ note: n, score });
      }
    }
    matches.sort((a, b) => b.score - a.score || b.note.mtime.localeCompare(a.note.mtime));
    const top = matches.slice(0, 30);
    if (!top.length) {
      box.innerHTML = `<div style="color:var(--muted);font-size:13px;">NO RESULTS FOR '${esc(query)}'.</div>`;
      return;
    }
    box.innerHTML = top
      .map(({ note }) => {
        const idx = note.body.toLowerCase().indexOf(q);
        const snippet =
          idx >= 0
            ? note.body.slice(Math.max(0, idx - 45), idx + 110)
            : note.props.summary || note.body.slice(0, 120);
        return `
          <div class="file-item" data-note-path="${esc(note.path)}" style="padding:10px;border-bottom:1px solid var(--hairline);white-space:normal;display:block;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <strong style="color:var(--ink);font-size:14px;">${esc(note.name)}</strong>
              <span class="ob-badge">${esc(note.top_folder)}</span>
            </div>
            <div style="font-size:12.5px;color:var(--muted);">${esc(snippet.replace(/\s+/g, " "))}</div>
          </div>
        `;
      })
      .join("");
  }

  /* -------------------- Auth Modal -------------------- */
  function openAuthModal() {
    const modal = document.getElementById("auth-modal");
    const body = document.getElementById("auth-modal-body");
    if (!modal || !body) return;
    const localEnc = localStorage.getItem(STORAGE_KEYS.tokenEnc);
    const hasAnyEnc = Boolean(localEnc || state.cloudVaultEnc);
    const autoLoginActive = Boolean(localStorage.getItem(STORAGE_KEYS.tokenPlain));

    body.innerHTML = `
      <div class="ob-block ob-tone-kelp" style="padding:16px;margin-bottom:16px;">
        <div class="label" style="margin-bottom:4px;">AUTO-LOGIN STATUS // 자동 로그인 상태</div>
        <div style="font-size:13px;">
          ${
            autoLoginActive
              ? "✓ <strong>이 기기 자동 로그인 활성됨</strong> — 들어갈 때마다 PAT나 비밀번호를 입력할 필요 없이 접속 즉시 열립니다."
              : "■ 현재 세션 또는 비밀번호 잠금 모드입니다. 아래에서 [이 기기에서 자동 로그인 유지]를 켜면 다음부터 입력 없이 바로 열립니다."
          }
        </div>
      </div>
      ${
        state.lastAuthError
          ? `<div class="ob-block" style="padding:12px 14px;margin-bottom:14px;border:2px solid var(--ob-red,#d9383a);background:rgba(217,56,58,0.08);font-size:12.5px;">
              <strong>최근 연결 오류 (${esc(state.repo)}):</strong><br/>${esc(state.lastAuthError)}
            </div>`
          : ""
      }
      ${
        hasAnyEnc
          ? `<div style="margin-bottom:16px;padding:14px;background:var(--surface);border:3px solid var(--frame);">
              <strong class="label" style="display:block;margin-bottom:8px;">UNLOCK WITH PASSWORD // 간편 비밀번호로 잠금 해제</strong>
              <div class="form-row" style="margin-bottom:0;">
                <input type="password" id="modal-unlock-pin" class="input" placeholder="간편 비밀번호 입력" style="flex:1;" />
                <button class="ob-btn ob-btn--primary" id="btn-modal-unlock">UNLOCK →</button>
              </div>
            </div>`
          : ""
      }
      <div style="margin-bottom:12px;">
        <label class="label" style="display:block;margin-bottom:4px;">VAULT REPOSITORY</label>
        <input type="text" id="modal-repo-input" class="input" value="${esc(state.repo)}" />
      </div>
      <div style="margin-bottom:12px;">
        <label class="label" style="display:block;margin-bottom:4px;">GITHUB PERSONAL ACCESS TOKEN (PAT)</label>
        <input type="password" id="modal-pat-input" class="input" value="${esc(state.token)}" placeholder="github_pat_... 또는 ghp_..." />
      </div>
      <div style="margin-bottom:12px;">
        <label class="label" style="display:block;margin-bottom:4px;">FINE-GRAINED PAT EXPIRY // 토큰 만료일 알림 (선택, D-7 경고)</label>
        <input type="date" id="modal-pat-expiry" class="input" value="${esc(state.patExpiry)}" />
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:10px;cursor:pointer;">
        <input type="checkbox" id="modal-remember-device" class="task-toggle" ${autoLoginActive ? "checked" : ""} />
        <span><strong>이 기기에서 자동 로그인 유지</strong> (개인 기기만 권장 · 공용 PC에서는 해제하고 아래 비밀번호 사용)</span>
      </label>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:14px;cursor:pointer;">
        <input type="checkbox" id="modal-safe-write" class="task-toggle" ${state.safeWriteMode ? "checked" : ""} />
        <span><strong>Safe Write 모드 유지</strong> (집 PC Obsidian·Google Drive 충돌 방지를 위해 긴 본문 편집 전 확인)</span>
      </label>
      <div style="margin-bottom:16px;">
        <label class="label" style="display:block;margin-bottom:4px;">OPTIONAL PASSWORD // AES-256-GCM 간편 비밀번호 (권장)</label>
        <input type="password" id="modal-pin-input" class="input" placeholder="설정 시 토큰 암호화 보관 (만료 짧은 Fine-grained PAT 권장)" />
      </div>
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <button class="ob-btn ob-btn--sm" id="btn-clear-auth">LOGOUT / RESET</button>
        <button class="ob-btn ob-btn--primary ob-btn--sm" id="btn-save-auth">SAVE &amp; AUTO-LOGIN ✓</button>
      </div>
    `;
    modal.classList.add("open");
  }

  /* -------------------- Event Delegation -------------------- */
  function bindEvents() {
    document.addEventListener("click", async (e) => {
      const target = e.target.closest(
        "#connection-badge,[data-tab],[data-jump-tab],[data-note-path],[data-search-query],[data-thought-filter],[data-inv-sub],[data-wiki-filter],[data-toggle-folder],[data-chart-ticker],[data-chart-idx],[data-graph-depth],[data-cal-date],[data-remove-clip-idx],[data-hub-ticker],[data-hub-theme],[data-fm-action],[data-review-done],button"
      );
      if (!target) return;

      if (target.hasAttribute("data-remove-clip-idx")) {
        const idx = parseInt(target.getAttribute("data-remove-clip-idx"), 10);
        if (!Number.isNaN(idx) && idx >= 0 && idx < state.selectedClippingFiles.length) {
          state.selectedClippingFiles.splice(idx, 1);
          const input = document.getElementById("clipping-file-input");
          if (input && state.selectedClippingFiles.length === 0) input.value = "";
          syncSelectedClippingsUI();
        }
        return;
      }

      if (target.hasAttribute("data-chart-ticker")) {
        if (window.SIGMA_V2) {
          window.SIGMA_V2.state.chartTicker = target.getAttribute("data-chart-ticker");
          window.SIGMA_V2.state.chartSelectedIdx = 99;
          renderAll();
        }
        return;
      }

      if (target.hasAttribute("data-chart-idx")) {
        if (window.SIGMA_V2) {
          window.SIGMA_V2.state.chartSelectedIdx = parseInt(target.getAttribute("data-chart-idx"), 10) || 0;
          renderAll();
        }
        return;
      }

      if (target.hasAttribute("data-graph-depth")) {
        if (window.SIGMA_V2) {
          window.SIGMA_V2.state.graphDepth = parseInt(target.getAttribute("data-graph-depth"), 10) || 1;
          renderAll();
        }
        return;
      }

      if (target.hasAttribute("data-cal-date")) {
        if (window.SIGMA_V2) {
          window.SIGMA_V2.state.calSelectedDate = target.getAttribute("data-cal-date");
          renderAll();
        }
        return;
      }

      if (target.hasAttribute("data-tab")) {
        state.activeTab = target.getAttribute("data-tab");
        renderAll();
        return;
      }

      if (target.hasAttribute("data-jump-tab")) {
        const focusQuick = target.getAttribute("data-focus-quick") === "true";
        state.activeTab = target.getAttribute("data-jump-tab");
        if (target.hasAttribute("data-thought-filter")) state.thoughtFilter = target.getAttribute("data-thought-filter");
        if (target.hasAttribute("data-inv-sub")) state.investingSubtab = target.getAttribute("data-inv-sub");
        renderAll();
        if (focusQuick) {
          window.scrollTo({ top: 0, behavior: "auto" });
          document.getElementById("quick-body")?.focus();
        }
        return;
      }

      if (target.hasAttribute("data-note-path")) {
        e.preventDefault();
        const p = target.getAttribute("data-note-path");
        document.getElementById("search-modal")?.classList.remove("open");
        await openNote(p);
        return;
      }

      if (target.hasAttribute("data-search-query")) {
        e.preventDefault();
        openSearchModal(target.getAttribute("data-search-query"));
        return;
      }

      if (target.hasAttribute("data-thought-filter")) {
        state.thoughtFilter = target.getAttribute("data-thought-filter");
        renderAll();
        return;
      }

      if (target.hasAttribute("data-inv-sub")) {
        state.investingSubtab = target.getAttribute("data-inv-sub");
        renderAll();
        return;
      }

      if (target.hasAttribute("data-wiki-filter")) {
        state.wikiFilter = target.getAttribute("data-wiki-filter");
        renderAll();
        return;
      }

      if (target.hasAttribute("data-hub-ticker")) {
        state.hubTicker = target.getAttribute("data-hub-ticker");
        state.hubTheme = "";
        renderAll();
        return;
      }

      if (target.hasAttribute("data-hub-theme")) {
        state.hubTheme = target.getAttribute("data-hub-theme");
        state.hubTicker = "";
        renderAll();
        return;
      }

      if (target.hasAttribute("data-fm-action")) {
        const action = target.getAttribute("data-fm-action");
        const p = target.getAttribute("data-fm-path");
        const n = state.byPath[p];
        if (!n) return;
        const nextProps = { ...n.props, updated: todayStr() };
        if (action === "processing") {
          nextProps.status = "processing";
        } else if (action === "promote_perm") {
          nextProps.stage = "영구";
          nextProps.status = "evergreen";
          nextProps.reviewed = todayStr();
        } else if (action === "done") {
          nextProps.done = true;
          nextProps.status = "evergreen";
        }
        const newRaw = serializeFrontmatterJS(nextProps, n.body);
        upsertNoteInMemory(p, newRaw);
        renderAll();
        if (state.token) {
          try {
            await ghPutFile(p, newRaw, `chore(triage): ${action} on ${n.name} via Sigma OS Web`);
            showToast(`OK — FRONTMATTER UPDATED (${action})`);
          } catch (err) {
            showToast(err.message);
          }
        } else {
          showToast(`OK — LOCAL FRONTMATTER UPDATED (${action})`);
        }
        return;
      }

      if (target.hasAttribute("data-review-done")) {
        const p = target.getAttribute("data-review-done");
        const cycle = parseInt(target.getAttribute("data-review-cycle"), 10) || 30;
        const n = state.byPath[p];
        if (!n) return;
        const nextDate = addDaysStr(todayStr(), cycle);
        const nextProps = { ...n.props, next_review: nextDate, updated: todayStr(), review_cycle_days: cycle };
        const newRaw = serializeFrontmatterJS(nextProps, n.body);
        upsertNoteInMemory(p, newRaw);
        renderAll();
        if (state.token) {
          try {
            await ghPutFile(p, newRaw, `chore(stocks): review done -> next_review=${nextDate} on ${n.name}`);
            showToast(`OK — 다음 점검일 ${nextDate}로 갱신됨`);
          } catch (err) {
            showToast(err.message);
          }
        } else {
          showToast(`OK — 다음 점검일 ${nextDate}로 로컬 갱신됨`);
        }
        return;
      }

      if (target.hasAttribute("data-toggle-folder")) {
        const f = target.getAttribute("data-toggle-folder");
        state.collapsedFolders[f] = !state.collapsedFolders[f];
        renderAll();
        return;
      }

      const id = target.id;
      if (id === "brand-home") {
        state.activeTab = "triage";
        renderAll();
      } else if (id === "btn-open-search") {
        openSearchModal("");
      } else if (id === "btn-close-search") {
        document.getElementById("search-modal")?.classList.remove("open");
      } else if (id === "btn-open-auth" || id === "connection-badge") {
        openAuthModal();
      } else if (id === "btn-close-auth") {
        document.getElementById("auth-modal")?.classList.remove("open");
      } else if (id === "btn-sync-now") {
        showToast("SYNCING VAULT INDEX...");
        await loadVaultData();
        showToast("OK — VAULT SYNCHRONIZED");
      } else if (id === "btn-theme-toggle") {
        const root = document.documentElement;
        const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
        root.setAttribute("data-theme", next);
        localStorage.setItem(STORAGE_KEYS.theme, next);
      } else if (id === "btn-market-toggle") {
        const root = document.documentElement;
        const next = root.getAttribute("data-market") === "kr" ? "us" : "kr";
        root.setAttribute("data-market", next);
        localStorage.setItem(STORAGE_KEYS.market, next);
        target.textContent = `${next.toUpperCase()} ▲`;
      } else if (id === "btn-mobile-tree-toggle") {
        state.mobileTreeOpen = !state.mobileTreeOpen;
        renderAll();
      } else if (id === "btn-toggle-split") {
        if (window.SIGMA_V2) {
          window.SIGMA_V2.state.splitActive = !window.SIGMA_V2.state.splitActive;
          renderAll();
        }
      } else if (id === "btn-close-split") {
        if (window.SIGMA_V2) {
          window.SIGMA_V2.state.splitActive = false;
          renderAll();
        }
      } else if (id === "btn-split-mode-toggle") {
        if (window.SIGMA_V2) {
          window.SIGMA_V2.state.splitRightMode = window.SIGMA_V2.state.splitRightMode === "edit" ? "preview" : "edit";
          renderAll();
        }
      } else if (id === "btn-split-insert-ai") {
        const ta = document.getElementById("split-right-textarea");
        if (ta) {
          let v = ta.value.replace(/stage:\s*임시/, "stage: 영구");
          if (!v.includes("## 주장")) {
            v += `\n\n## 주장\n\n\n## 근거 · 연결 (AI 확장)\n- \n\n## 반대로 볼 수 있는 점 (AI 확장)\n- \n\n## 이어지는 생각 (AI 확장)\n- \n`;
          }
          ta.value = v;
        }
      } else if (id === "btn-split-new-thought") {
        const titleInput = window.prompt("새 생각 노트의 한 문장 제목을 입력하세요:", "");
        if (!titleInput || !titleInput.trim()) return;
        const leftNote = state.byPath[state.currentNotePath];
        const sourceLabel = leftNote ? `[[${leftNote.name}]]` : "시그마 좌우 분할 비교";
        const payload = buildNewNotePayload("thought_temp", titleInput.trim(), `참조 원문: ${sourceLabel}\n\n`, {
          date: todayStr(),
          source: sourceLabel,
        });
        upsertNoteInMemory(payload.path, payload.content);
        if (window.SIGMA_V2) {
          window.SIGMA_V2.state.splitRightPath = payload.path;
          window.SIGMA_V2.state.splitRightMode = "edit";
        }
        renderAll();
        showToast(`CREATED IN RIGHT PANE: ${payload.path}`);
      } else if (id === "btn-split-save") {
        const ta = document.getElementById("split-right-textarea");
        const sel = document.getElementById("split-right-select");
        const targetPath = (window.SIGMA_V2 && window.SIGMA_V2.state.splitRightPath) || (sel && sel.value);
        if (!ta || !targetPath) return;
        const newRaw = ta.value;
        upsertNoteInMemory(targetPath, newRaw);
        renderAll();
        if (state.token) {
          try {
            showToast(`COMMITTING ${targetPath}...`);
            await ghPutFile(targetPath, newRaw, `docs(vault): update ${targetPath} via Sigma OS Split Pane`);
            showToast(`OK — SAVED: ${targetPath}`);
          } catch (err) {
            showToast(err.message);
          }
        } else {
          showToast(`OK — SAVED: ${targetPath}`);
        }
      } else if (id === "btn-cal-prev" || id === "btn-cal-next") {
        if (window.SIGMA_V2) {
          const [yStr, mStr] = window.SIGMA_V2.state.calMonth.split("-");
          let y = parseInt(yStr, 10) || 2026;
          let m = parseInt(mStr, 10) || 11;
          m += id === "btn-cal-next" ? 1 : -1;
          if (m < 1) {
            m = 12;
            y -= 1;
          } else if (m > 12) {
            m = 1;
            y += 1;
          }
          const nextYm = `${y}-${String(m).padStart(2, "0")}`;
          window.SIGMA_V2.state.calMonth = nextYm;
          window.SIGMA_V2.state.calSelectedDate = `${nextYm}-01`;
          renderAll();
        }
      } else if (id === "btn-save-daily-habit") {
        if (!window.SIGMA_V2) return;
        const dStr = window.SIGMA_V2.state.calSelectedDate || todayStr();
        const relPath = `1. Daily Note/${dStr}.md`;
        const existing = state.byPath[relPath];
        const hEx = Boolean(document.getElementById("cal-habit-ex")?.checked);
        const hFast = Boolean(document.getElementById("cal-habit-fast")?.checked);
        const hStudy = Boolean(document.getElementById("cal-habit-study")?.checked);
        const energyRaw = (document.getElementById("cal-energy")?.value || "").trim();
        const oneThing = (document.getElementById("cal-one-thing")?.value || "").trim();
        const winVal = (document.getElementById("cal-win")?.value || "").trim();
        const missVal = (document.getElementById("cal-miss")?.value || "").trim();
        const tomorrowVal = (document.getElementById("cal-tomorrow")?.value || "").trim();

        const props = existing
          ? { ...existing.props }
          : {
              entity: "저널",
              journal: "데일리",
              date: dStr,
              tags: ["daily"],
              one_thing: "",
              win: "",
              miss: "",
              tomorrow: "",
              energy: null,
              habit_운동: false,
              habit_저녁금식: false,
              habit_공부: false,
            };
        props["habit_운동"] = hEx;
        props["habit_저녁금식"] = hFast;
        props["habit_공부"] = hStudy;
        props.energy = energyRaw ? parseInt(energyRaw, 10) : null;
        props.one_thing = oneThing;
        props.win = winVal;
        props.miss = missVal;
        props.tomorrow = tomorrowVal;

        const body = existing
          ? existing.body
          : `## 오늘 할 일\n![[context.base#이날 할 일]]\n\n## 메모\n\n\n## 오늘 배운 것\n\n\n## 회고\n`;
        const newRaw = serializeFrontmatterJS(props, body);
        upsertNoteInMemory(relPath, newRaw);
        renderAll();
        if (state.token) {
          try {
            showToast(`COMMITTING DAILY NOTE (${dStr})...`);
            await ghPutFile(relPath, newRaw, `docs(daily): update habits & review for ${dStr} via Sigma OS Web`);
            showToast(`OK — DAILY NOTE SAVED (${dStr})`);
          } catch (err) {
            showToast(err.message);
          }
        } else {
          showToast(`OK — DAILY NOTE SAVED (${dStr})`);
        }
      } else if (id === "btn-quick-save") {
        const bodyEl = document.getElementById("quick-body");
        const body = (bodyEl?.value || "").trim();
        if (!body) {
          showToast("ERROR — 메모를 입력하십시오.");
          return;
        }
        try {
          const title = deriveMemoTitle(body);
          await saveNewInboxNote("inbox", title, body);
          if (document.getElementById("quick-body")) document.getElementById("quick-body").value = "";
        } catch (err) {
          showToast(err.message);
        }
      } else if (id === "btn-clear-clippings") {
        state.selectedClippingFiles = [];
        const input = document.getElementById("clipping-file-input");
        if (input) input.value = "";
        syncSelectedClippingsUI();
      } else if (id === "btn-dispatch-workflows") {
        const workflows = [
          { file: "sigma-gdrive-sync.yml", inputs: { mode: "bidirectional" } },
          { file: "sigma-equity-desk.yml", inputs: {} },
          { file: "sigma-inbox-sync.yml", inputs: { apply: true } },
          { file: "sigma-macro-sync.yml", inputs: {} },
          { file: "sigma-ir-sync.yml", inputs: {} },
          { file: "sigma-sec-wiki.yml", inputs: {} },
        ];
        try {
          target.disabled = true;
          showToast("DISPATCHING WORKFLOWS...");
          let okCount = 0;
          const skipped = [];
          for (const wf of workflows) {
            try {
              await ghTriggerWorkflow(wf.file, wf.inputs);
              okCount += 1;
            } catch (_) {
              skipped.push(wf.file.replace(".yml", ""));
            }
          }
          showToast(
            skipped.length
              ? `OK — DISPATCHED ${okCount}/${workflows.length} (건너뜀: ${skipped.join(", ")})`
              : `OK — WORKFLOWS DISPATCHED (${okCount})`
          );
        } catch (err) {
          showToast(err.message);
        } finally {
          target.disabled = false;
        }
      } else if (id === "btn-upload-clippings") {
        const input = document.getElementById("clipping-file-input");
        const files = state.selectedClippingFiles.length
          ? [...state.selectedClippingFiles]
          : Array.from(input?.files || []);
        if (!files.length) {
          showToast("ERROR — 업로드할 .md 파일을 선택하십시오.");
          return;
        }
        try {
          target.disabled = true;
          const count = files.length;
          for (const file of files) {
            const buf = await file.arrayBuffer();
            const rawBytes = new Uint8Array(buf);
            const text = new TextDecoder().decode(rawBytes);
            const relPath = `Clippings/${file.name}`;
            upsertNoteInMemory(relPath, text);
            if (state.token) {
              await ghPutFileBase64(relPath, bytesToB64(rawBytes), `feat(clippings): upload ${file.name} via Sigma OS Web`);
            }
          }
          state.selectedClippingFiles = [];
          if (input) input.value = "";
          renderAll();
          showToast(`OK — UPLOADED ${count} CLIPPING(S)`);
        } catch (err) {
          showToast(err.message);
        } finally {
          target.disabled = false;
        }
      } else if (id === "btn-toggle-edit") {
        if (!state.editingNote && state.safeWriteMode) {
          const ok = window.confirm(
            "[Safe Write 모드] 집 PC Obsidian(Google Drive)과의 동시 편집 충돌을 줄이기 위해 웹 전체 편집은 권장하지 않습니다.\n이 노트의 전체 편집 모드를 열까요?"
          );
          if (!ok) return;
        }
        state.editingNote = !state.editingNote;
        renderAll();
      } else if (id === "btn-cancel-edit") {
        state.editingNote = false;
        renderAll();
      } else if (id === "btn-insert-perm-template") {
        const ta = document.getElementById("note-editor-textarea");
        if (ta) {
          let v = ta.value.replace(/stage:\s*임시/, "stage: 영구");
          if (!v.includes("## 주장")) {
            v += `\n\n## 주장\n\n\n## 근거 · 연결 (AI 확장)\n- \n\n## 반대로 볼 수 있는 점 (AI 확장)\n- \n\n## 이어지는 생각 (AI 확장)\n- \n`;
          }
          ta.value = v;
        }
      } else if (id === "btn-save-edit") {
        const ta = document.getElementById("note-editor-textarea");
        if (!ta) return;
        const newRaw = ta.value;
        const prevNote = state.byPath[state.currentNotePath];
        if (prevNote && prevNote.body.includes("## 원래 메모")) {
          const prevOrig = prevNote.body.split("## 원래 메모")[1] || "";
          const nextOrig = newRaw.includes("## 원래 메모") ? (newRaw.split("## 원래 메모")[1] || "") : null;
          if (nextOrig === null || nextOrig.trim() !== prevOrig.trim()) {
            const proceed = window.confirm(
              "[원문 보존 원칙 경고] '## 원래 메모' 섹션이 변경되거나 삭제되었습니다. 그래도 저장할까요?"
            );
            if (!proceed) return;
          }
        }
        upsertNoteInMemory(state.currentNotePath, newRaw);
        state.editingNote = false;
        renderAll();
        if (state.token) {
          try {
            showToast("COMMITTING TO VAULT...");
            await ghPutFile(state.currentNotePath, newRaw, `docs(vault): update ${state.currentNotePath} via Sigma OS Web`);
            showToast("OK — SAVED TO VAULT");
          } catch (err) {
            showToast(err.message);
          }
        } else {
          showToast("OK — SAVED");
        }
      } else if (id === "btn-load-full-clipping") {
        const note = state.byPath[state.currentNotePath];
        try {
          showToast("LOADING FULL TRANSCRIPT...");
          await ensureFullNoteBody(note);
          renderAll();
        } catch (err) {
          showToast(err.message);
        }
      } else if (id === "btn-back-history") {
        const prev = state.historyStack.pop();
        if (prev) await openNote(prev, false);
      } else if (id === "btn-save-auth" || id === "btn-save-pat-direct") {
        const isModal = id === "btn-save-auth";
        const repoVal = (isModal ? document.getElementById("modal-repo-input")?.value : state.repo) || REPO_DEFAULT;
        const patVal = (
          isModal
            ? document.getElementById("modal-pat-input")?.value || ""
            : document.getElementById("auth-pat-direct")?.value || ""
        ).trim();
        const pinVal = (
          isModal
            ? document.getElementById("modal-pin-input")?.value || ""
            : document.getElementById("auth-pin-setup")?.value || ""
        ).trim();
        const expiryEl = isModal ? document.getElementById("modal-pat-expiry") : null;
        if (expiryEl) {
          state.patExpiry = expiryEl.value.trim();
          localStorage.setItem(STORAGE_KEYS.patExpiry, state.patExpiry);
        }
        const safeWriteEl = isModal ? document.getElementById("modal-safe-write") : null;
        if (safeWriteEl) {
          state.safeWriteMode = Boolean(safeWriteEl.checked);
          localStorage.setItem(STORAGE_KEYS.safeWrite, String(state.safeWriteMode));
        }
        const remember =
          (isModal
            ? document.getElementById("modal-remember-device")?.checked
            : document.getElementById("auth-remember-direct")?.checked) ?? true;

        if (!patVal) {
          showToast("ERROR — GitHub PAT 토큰을 입력하십시오.");
          return;
        }
        state.repo = repoVal.trim() || REPO_DEFAULT;
        state.token = patVal;
        state.lastAuthError = "";
        localStorage.setItem(STORAGE_KEYS.repo, state.repo);
        sessionStorage.setItem(STORAGE_KEYS.tokenPlain, patVal);

        // Save encrypted backup if password provided
        if (pinVal) {
          const enc = await encryptTokenWithPassword(patVal, pinVal);
          localStorage.setItem(STORAGE_KEYS.tokenEnc, enc);
        }

        // Keep auto-login active in localStorage by default so user NEVER has to re-enter PAT!
        if (remember) {
          localStorage.setItem(STORAGE_KEYS.tokenPlain, patVal);
        } else {
          localStorage.removeItem(STORAGE_KEYS.tokenPlain);
        }

        document.getElementById("auth-modal")?.classList.remove("open");
        await loadVaultData();
        if (state.mode === "github") {
          showToast("OK — PRIVATE VAULT CONNECTED (AUTO-LOGIN ENABLED)");
        }
      } else if (id === "btn-unlock-pin" || id === "btn-modal-unlock") {
        const pinVal = (document.getElementById("unlock-pin-input")?.value || document.getElementById("modal-unlock-pin")?.value || "").trim();
        const enc = localStorage.getItem(STORAGE_KEYS.tokenEnc) || state.cloudVaultEnc;
        const remember = (document.getElementById("unlock-remember-device")?.checked ?? true) === true;
        if (!pinVal || !enc) return;
        try {
          const pat = await decryptTokenWithPassword(enc, pinVal);
          state.token = pat;
          sessionStorage.setItem(STORAGE_KEYS.tokenPlain, pat);
          if (remember) {
            localStorage.setItem(STORAGE_KEYS.tokenPlain, pat);
          }
          document.getElementById("auth-modal")?.classList.remove("open");
          await loadVaultData();
          if (state.mode === "github") {
            showToast("OK — VAULT UNLOCKED");
          }
        } catch (_) {
          showToast("ERROR — 비밀번호가 일치하지 않습니다.");
        }
      } else if (id === "btn-clear-auth") {
        state.token = "";
        state.repo = REPO_DEFAULT;
        state.lastAuthError = "";
        sessionStorage.removeItem(STORAGE_KEYS.tokenPlain);
        localStorage.removeItem(STORAGE_KEYS.tokenPlain);
        localStorage.removeItem(STORAGE_KEYS.tokenEnc);
        localStorage.removeItem(STORAGE_KEYS.repo);
        document.getElementById("auth-modal")?.classList.remove("open");
        const modalBody = document.getElementById("auth-modal-body");
        if (modalBody) modalBody.innerHTML = "";
        await loadVaultData();
        showToast("LOGGED OUT — 연결 정보가 초기화되었습니다.");
      }
    });

    document.addEventListener("change", async (e) => {
      if (e.target.id === "clipping-file-input") {
        const picked = Array.from(e.target.files || []);
        if (picked.length) {
          state.selectedClippingFiles = picked;
        }
        e.target.value = "";
        syncSelectedClippingsUI();
        return;
      }
      if (e.target.id === "split-right-select") {
        if (window.SIGMA_V2) {
          window.SIGMA_V2.state.splitRightPath = e.target.value;
          renderAll();
        }
        return;
      }
      if (e.target.classList.contains("task-toggle") && e.target.hasAttribute("data-path")) {
        const path = e.target.getAttribute("data-path");
        const note = state.byPath[path];
        if (!note) return;
        note.props.done = e.target.checked;
        const newRaw = serializeFrontmatterJS(note.props, note.body);
        saveLocalEditToStorage(path, newRaw);
        renderAll();
        if (state.token) {
          try {
            await ghPutFile(path, newRaw, `feat(tasks): toggle done=${note.props.done} on ${note.name}`);
            showToast(`OK — TASK UPDATED: ${note.name}`);
          } catch (err) {
            showToast(err.message);
          }
        } else {
          showToast(`OK — TASK UPDATED: ${note.name}`);
        }
      }
    });

    document.getElementById("search-input")?.addEventListener("input", (e) => {
      runSearch(e.target.value);
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearchModal("");
      } else if (e.key === "Escape") {
        document.getElementById("search-modal")?.classList.remove("open");
        document.getElementById("auth-modal")?.classList.remove("open");
      }
    });
  }

  /* -------------------- Init -------------------- */
  function init() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
    const savedMarket = localStorage.getItem(STORAGE_KEYS.market) || "us";
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.documentElement.setAttribute("data-market", savedMarket);
    const mktBtn = document.getElementById("btn-market-toggle");
    if (mktBtn) mktBtn.textContent = `${savedMarket.toUpperCase()} ▲`;
    bindEvents();
    loadVaultData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
