/* Sigma OS All-in-One Web App (100% Private Vault Viewer + Built-in Inbox + Editor) */
(function () {
  "use strict";

  const REPO_DEFAULT = "exon6/obsidian-vault";
  const STORAGE_KEYS = {
    theme: "sigma_web_theme",
    repo: "sigma_web_repo",
    tokenPlain: "sigma_web_pat",
    tokenEnc: "sigma_web_pat_enc",
  };

  const state = {
    repo: localStorage.getItem(STORAGE_KEYS.repo) || REPO_DEFAULT,
    token: sessionStorage.getItem(STORAGE_KEYS.tokenPlain) || localStorage.getItem(STORAGE_KEYS.tokenPlain) || "",
    mode: "loading", // "local" | "github" | "locked"
    generatedAt: "",
    notes: [],
    byPath: {},
    byName: {},
    activeTab: "triage",
    thoughtFilter: "all",
    investingSubtab: "stocks",
    wikiFilter: "all",
    currentNotePath: "8. System/분류하기.md",
    editingNote: false,
    collapsedFolders: { "7. Template": true },
    historyStack: [],
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
    showToast._timer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function cleanWikiTarget(val) {
    return String(val ?? "")
      .replace(/^\[\[/, "")
      .replace(/\]\]$/, "")
      .split("|")[0]
      .split("#")[0]
      .trim();
  }

  /* -------------------- WebCrypto AES-256-GCM Pin Lock -------------------- */
  async function deriveKey(password, saltBytes) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBytes, iterations: 200000, hash: "SHA-256" },
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
    const data = JSON.parse(payloadJson);
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
    if (!state.token) throw new Error("GitHub 토큰이 설정되지 않았습니다. 상단 [🔒 보안 연결]에서 토큰을 입력해주세요.");
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
      throw new Error(`GitHub API 오류 (${res.status}): ${errText.slice(0, 180)}`);
    }
    if (options.raw) return res.text();
    if (res.status === 204) return null;
    return res.json();
  }

  async function ghGetFileRaw(relPath) {
    return ghFetch(`/repos/${state.repo}/contents/${encodeRepoPath(relPath)}?ref=main`, { raw: true });
  }

  async function ghPutFile(relPath, contentStr, commitMsg) {
    let sha = undefined;
    try {
      const existing = await ghFetch(`/repos/${state.repo}/contents/${encodeRepoPath(relPath)}?ref=main`);
      if (existing && existing.sha) sha = existing.sha;
    } catch (_) {
      // new file
    }
    return ghFetch(`/repos/${state.repo}/contents/${encodeRepoPath(relPath)}`, {
      method: "PUT",
      body: {
        message: commitMsg,
        content: utf8ToB64(contentStr),
        sha,
        branch: "main",
      },
    });
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
    state.byPath = {};
    state.byName = {};
    for (const n of state.notes) {
      state.byPath[n.path] = n;
      if (!state.byName[n.name] || n.top_folder !== "Clippings") {
        state.byName[n.name] = n;
      }
    }
  }

  function upsertNoteInMemory(relPath, rawMarkdown) {
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
    return note;
  }

  async function loadVaultData() {
    const badge = document.getElementById("connection-badge");
    // 1. If GitHub token is present, prefer live private GitHub fetch (or fallback to local index)
    if (state.token) {
      try {
        if (badge) badge.textContent = "GitHub 동기화 중...";
        const rawJson = await ghGetFileRaw(".sigma-sync/vault-index.json");
        const parsed = JSON.parse(rawJson);
        indexNotes(parsed);
        state.mode = "github";
        if (badge) badge.textContent = `🔒 비공개 GitHub 연결됨 (${state.notes.length}개 노트)`;
        renderAll();
        return;
      } catch (err) {
        console.warn("GitHub index fetch fallback:", err);
      }
    }

    // 2. Try local relative vault-index.json (when served from local vault preview)
    for (const candidate of ["../../.sigma-sync/vault-index.json", "./vault-index.json"]) {
      try {
        const res = await fetch(candidate, { cache: "no-store" });
        if (res.ok) {
          const parsed = await res.json();
          indexNotes(parsed);
          state.mode = state.token ? "github" : "local";
          if (badge) {
            badge.textContent = state.token
              ? `🔒 GitHub + 로컬 볼트 (${state.notes.length}개 노트)`
              : `💻 로컬 볼트 미리보기 (${state.notes.length}개 노트)`;
          }
          renderAll();
          return;
        }
      } catch (_) {
        // ignore
      }
    }

    // 3. Otherwise locked (hosted on public GitHub Pages without unlocked token)
    state.mode = "locked";
    if (badge) badge.textContent = "🔐 잠금 상태 (인증 필요)";
    renderAll();
  }

  async function ensureFullNoteBody(note) {
    if (!note || !note.truncated) return;
    // Try local file first, then GitHub API
    try {
      const localRes = await fetch(`../../${encodeRepoPath(note.path)}`, { cache: "no-store" });
      if (localRes.ok) {
        const raw = await localRes.text();
        const { body } = parseFrontmatterJS(raw);
        note.body = body;
        note.truncated = false;
        return;
      }
    } catch (_) {}
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
          `📥 위키 반영 대기 클리핑 (${rows.length}건)`,
          ["클리핑 파일 (Clippings/)", "출처 URL", "저장일", "경과일"],
          rows.map((n) => [
            noteLinkHTML(n.path, n.name),
            n.props.source ? `<a href="${esc(n.props.source)}" target="_blank" rel="noopener" class="wikilink">원문 ↗</a>` : "-",
            esc(n.ctime),
            `${daysBetween(today, n.ctime) ?? 0}일`,
          ])
        );
      }
      // inbox.base#수집함
      const rows = state.notes.filter(
        (n) => n.top_folder === "0. Inbox" && !n.props.entity && n.props.done !== true
      );
      return renderBaseTable(
        `📥 수집함 미분류 메모 (${rows.length}건)`,
        ["노트", "종류", "박스", "저장일"],
        rows.map((n) => [
          noteLinkHTML(n.path, n.name),
          esc(n.props.entity || "미분류"),
          formatPropVal(n.props.box),
          esc(n.ctime),
        ]),
        "현재 `0. Inbox/`에 미분류 메모가 없습니다. 상단 빠른 수집함에서 새 메모나 생각을 바로 추가할 수 있습니다."
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
        `🧠 ${viewName || "자료"} (${rows.length}건)`,
        ["노트", "분류/단계", "요약", "갱신일"],
        rows.map((n) => [
          noteLinkHTML(n.path, n.name),
          `<span class="badge ${n.props.stage === "영구" ? "badge-green" : n.props.stage === "임시" ? "badge-amber" : "badge-blue"}">${esc(n.props.kind || "자료")}${n.props.stage ? " · " + esc(n.props.stage) : ""}</span>`,
          esc(n.props.summary || n.body.replace(/^#.*$/gm, "").trim().slice(0, 95)),
          esc(n.mtime),
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
        `📈 종목 · ${viewName || "전체"} (${rows.length}건)`,
        ["종목 노트", "티커", "섹터", "다음 점검", "핵심 질문 (Question)", "투자 논리 (Thesis)"],
        rows.map((n) => [
          noteLinkHTML(n.path, n.name),
          `<span class="badge badge-blue">${esc(n.props.ticker || "-")}</span>`,
          esc(n.props.sector || "-"),
          esc(n.props.next_review || "-"),
          esc(n.props.question || "-"),
          esc(n.props.thesis || "-"),
        ])
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
        `✅ 할 일 · ${viewName || "진행 중"} (${rows.length}건)`,
        ["상태", "할 일", "구분", "날짜 (do_date)", "시각", "박스/프로젝트"],
        rows.map((n) => [
          `<input type="checkbox" class="task-toggle" data-path="${esc(n.path)}" ${n.props.done === true ? "checked" : ""} title="완료 상태 토글" />`,
          noteLinkHTML(n.path, n.name),
          `<span class="badge">${esc(n.props.type || "일반")}</span>`,
          esc(n.props.do_date || "-"),
          esc(n.props.planned_time || "-"),
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
          `📝 연결된 매매 기록 (${trades.length}건)`,
          ["일자", "노트", "매매", "근거"],
          trades.map((n) => [esc(n.props.trade_date || n.ctime), noteLinkHTML(n.path, n.name), esc(n.props.side || "-"), esc(n.props.reason || "-")])
        );
      }
      return renderBaseTable(
        `🔗 연결된 자료 · 위키 (${linked.length}건)`,
        ["노트", "폴더", "분류", "요약"],
        linked.slice(0, 25).map((n) => [
          noteLinkHTML(n.path, n.name),
          `<span class="badge">${esc(n.top_folder)}</span>`,
          esc(n.props.kind || n.props.wiki_type || "-"),
          esc(n.props.summary || n.body.replace(/^#.*$/gm, "").trim().slice(0, 90)),
        ])
      );
    }

    return `<div class="callout callout-info"><div class="callout-title">📊 데이터베이스 뷰: ${esc(baseSpec)}</div></div>`;
  }

  function renderBaseTable(title, headers, rows, emptyMsg = "해당 조건의 항목이 없습니다.") {
    if (!rows.length) {
      return `<div class="panel" style="margin:12px 0;padding:12px 14px;">
        <div style="font-weight:700;font-size:13.5px;margin-bottom:4px;">${esc(title)}</div>
        <div style="color:var(--text-muted);font-size:12.8px;">${esc(emptyMsg)}</div>
      </div>`;
    }
    const ths = headers.map((h) => `<th>${esc(h)}</th>`).join("");
    const trs = rows.map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
    return `<div class="panel" style="margin:12px 0;padding:12px 14px;">
      <div style="font-weight:700;font-size:13.5px;margin-bottom:8px;">${esc(title)}</div>
      <div class="table-wrap"><table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>
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
    if (!s) return "-";
    const m = s.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
    if (m) {
      const target = resolveNoteLink(m[1]);
      const label = m[2] || m[1];
      if (target) return noteLinkHTML(target.path, label);
      return `<span class="badge">${esc(label)}</span>`;
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

      // 1. Fenced code block
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

      // 2. Embedded .base or note transclusion ![[...]]
      const embedM = line.trim().match(/^!\[\[([^\]]+)\]\]$/);
      if (embedM) {
        const spec = embedM[1];
        if (spec.includes(".base")) {
          out.push(evaluateBaseEmbed(spec, contextNote));
        } else {
          const target = resolveNoteLink(spec);
          if (target) {
            out.push(`<div class="callout callout-info">
              <div class="callout-title">📄 임베드 노트: ${noteLinkHTML(target.path, target.name)}</div>
              <div style="font-size:13px;color:var(--text-muted);">${esc(target.props.summary || target.body.slice(0, 180))}</div>
            </div>`);
          }
        }
        i++;
        continue;
      }

      // 3. Callouts or Blockquotes (> [!tip] or > text)
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

      // 4. Markdown Table
      if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s\-:|]+\|[\s\-:|]*$/.test(lines[i + 1])) {
        const parseRow = (r) =>
          r
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split(/(?<!\\)\|/)
            .map((c) => inlineFormat(c.replace(/\\\|/g, "|").trim()));
        const headers = parseRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
          rows.push(parseRow(lines[i]));
          i++;
        }
        out.push(
          `<div class="table-wrap" style="margin:12px 0;"><table class="data-table"><thead><tr>${headers
            .map((h) => `<th>${h}</th>`)
            .join("")}</tr></thead><tbody>${rows
            .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
            .join("")}</tbody></table></div>`
        );
        continue;
      }

      // 5. Headings
      const hM = line.match(/^(#{1,4})\s+(.*)$/);
      if (hM) {
        const lvl = hM[1].length;
        out.push(`<h${lvl}>${inlineFormat(hM[2])}</h${lvl}>`);
        i++;
        continue;
      }

      // 6. Horizontal rule
      if (/^---+$/.test(line.trim())) {
        out.push("<hr style='border:none;border-top:1px solid var(--border-subtle);margin:18px 0;'/>");
        i++;
        continue;
      }

      // 7. Lists
      if (/^\s*([-*•]|\d+\.)\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*([-*•]|\d+\.)\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*•]|\d+\.)\s+/, ""));
          i++;
        }
        out.push(`<ul>${items.map((it) => `<li>${inlineFormat(it)}</li>`).join("")}</ul>`);
        continue;
      }

      // 8. Blank line
      if (!line.trim()) {
        i++;
        continue;
      }

      // 9. Paragraph
      out.push(`<p>${inlineFormat(line)}</p>`);
      i++;
    }

    return out.join("\n");
  }

  function inlineFormat(text) {
    let s = esc(text);
    // Unescape \$ in prose
    s = s.replace(/\\\$/g, "$");
    // Inline code
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold & Italic
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // WikiLinks [[Target|Label]] or [[Target#Heading|Label]]
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
    // External Markdown links [label](url)
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
      <div class="stat-card" data-jump-tab="explorer">
        <div class="stat-label">전체 볼트 노트</div>
        <div class="stat-value">${state.notes.length}</div>
        <div class="stat-sub">10개 폴더 전체 동기화</div>
      </div>
      <div class="stat-card" data-jump-tab="thoughts" data-thought-filter="all">
        <div class="stat-label">내 생각 · 영구 · 참고</div>
        <div class="stat-value">${thoughts.length + refs.length}</div>
        <div class="stat-sub">영구 ${permThoughts.length} · 다듬을 생각 ${tempThoughts.length} · 참고 ${refs.length}</div>
      </div>
      <div class="stat-card" data-jump-tab="investing" data-inv-sub="stocks">
        <div class="stat-label">핵심 보유 종목</div>
        <div class="stat-value">${stocks.length}</div>
        <div class="stat-sub">NVDA · AVGO · MRVL · GOOGL · ANT · SPCX</div>
      </div>
      <div class="stat-card" data-jump-tab="investing" data-inv-sub="wiki">
        <div class="stat-label">LLM 위키 &amp; 어닝콜</div>
        <div class="stat-value">${wikiCount}</div>
        <div class="stat-sub">48개 어닝콜/행사 · 74개 SEC 공시</div>
      </div>
      <div class="stat-card" data-jump-tab="triage">
        <div class="stat-label">진행 중 할 일 · 일정</div>
        <div class="stat-value">${openTasks}</div>
        <div class="stat-sub">위키 대기 클리핑 ${pendingClippings}건</div>
      </div>
    `;
  }

  function renderLockedView() {
    const hasEncrypted = Boolean(localStorage.getItem(STORAGE_KEYS.tokenEnc));
    return `
      <div class="panel" style="max-width:560px;margin:40px auto;padding:28px;">
        <div class="panel-header">
          <h2 class="panel-title">🔐 비공개 시그마 OS 볼트 잠금 해제</h2>
          <span class="badge badge-blue">100% 비공개</span>
        </div>
        <p style="color:var(--text-muted);font-size:13.5px;margin-bottom:16px;">
          이 웹앱은 외부에 노트 원문을 단 한 글자도 공개하지 않습니다. 본인 인증 후 비공개 저장소(<code>${esc(state.repo)}</code>)에서 직접 노트를 불러오고 수집함에 기록합니다.
        </p>
        ${
          hasEncrypted
            ? `<div style="margin-bottom:18px;padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);">
                <label style="font-weight:700;font-size:13px;display:block;margin-bottom:6px;">🔑 저장된 간편 비밀번호로 잠금 해제</label>
                <div class="form-row" style="margin-bottom:0;">
                  <input type="password" id="unlock-pin-input" class="input" placeholder="설정한 간편 비밀번호 입력" style="flex:1;" />
                  <button class="btn btn-primary" id="btn-unlock-pin">잠금 해제</button>
                </div>
              </div>`
            : ""
        }
        <div>
          <label style="font-weight:700;font-size:13px;display:block;margin-bottom:6px;">GitHub Personal Access Token (PAT) 입력</label>
          <input type="password" id="auth-pat-direct" class="input" placeholder="ghp_... 또는 github_pat_... (repo 및 workflow 권한)" style="margin-bottom:10px;" />
          <label style="font-weight:600;font-size:12.5px;color:var(--text-muted);display:block;margin-bottom:6px;">선택: 다음부터 폰/PC에서 쉽게 열기 위한 간편 비밀번호 설정 (AES-256 암호화 저장)</label>
          <input type="password" id="auth-pin-setup" class="input" placeholder="간편 비밀번호 설정 (예: 나만의 4~20자리 암호, 비워두면 현재 기기에 바로 유지)" style="margin-bottom:12px;" />
          <button class="btn btn-primary" id="btn-save-pat-direct" style="width:100%;justify-content:center;padding:10px;">🔒 비공개 볼트 연결 및 열기</button>
        </div>
      </div>
    `;
  }

  /* 1. Triage / Home View */
  function renderTriageView() {
    const latestDaily = state.notes
      .filter((n) => n.top_folder === "1. Daily Note")
      .sort((a, b) => b.name.localeCompare(a.name))[0];

    return `
      <!-- Quick Inbox Capture Bar -->
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">⚡ 빠른 시그마 수집함 (생각 · 메모 · 할 일 즉시 기록)</h2>
          <div style="display:flex;gap:8px;align-items:center;">
            ${latestDaily ? `<button class="btn btn-sm" data-note-path="${esc(latestDaily.path)}">📅 최신 데일리 (${esc(latestDaily.name)})</button>` : ""}
            <a href="https://sigma-inbox.emeraldtuna8.chatgpt.site" target="_blank" rel="noopener" class="btn btn-sm">ChatGPT 수집함 ↗</a>
          </div>
        </div>
        <div class="form-row">
          <select id="quick-kind" class="select" style="flex:0 0 190px;">
            <option value="thought_temp">🧠 임시 생각 (다듬을 생각)</option>
            <option value="thought_perm">💎 영구 생각 노트</option>
            <option value="reference">📌 참고 노트 (반응·인용)</option>
            <option value="task">✅ 할 일 / 일정</option>
            <option value="inbox">📥 일반 미분류 메모 (0. Inbox)</option>
          </select>
          <input type="text" id="quick-title" class="input" placeholder="제목 (예: 광 인터커넥트 병목에서 Marvell-Lumentum 합병의 의미)" style="flex:1;min-width:220px;" />
        </div>
        <textarea id="quick-body" class="textarea" style="min-height:82px;margin-bottom:10px;" placeholder="떠오른 생각, 원문 메모, 또는 할 일을 적으세요. 생각 노트는 ## 원래 메모에 원형 그대로 보존됩니다."></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <span style="font-size:12px;color:var(--text-muted);">저장 즉시 GitHub 비공개 볼트(<code>${esc(state.repo)}</code>)의 해당 폴더에 마크다운 노트로 커밋됩니다.</span>
          <div style="display:flex;gap:8px;">
            <button class="btn" id="btn-go-full-inbox">📥 상세 수집함 · MD 클리핑 업로드 열기</button>
            <button class="btn btn-primary" id="btn-quick-save">💾 볼트에 즉시 저장</button>
          </div>
        </div>
      </div>

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

  /* 2. Built-in Sigma Inbox View */
  function renderInboxView() {
    return `
      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <h2 class="panel-title">📥 시그마 수집함 · 새 노트 직접 작성</h2>
            <span class="badge badge-blue">GitHub 볼트 직결</span>
          </div>
          <div class="form-row">
            <div style="flex:1;min-width:160px;">
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">기록 종류</label>
              <select id="inbox-kind" class="select">
                <option value="thought_temp">🧠 생각 노트 (임시 · 다듬을 생각)</option>
                <option value="thought_perm">💎 생각 노트 (영구 · 주장+AI확장 틀)</option>
                <option value="reference">📌 참고 노트 (책·영상·기사 대목과 내 반응)</option>
                <option value="task">✅ 할 일 (5. Tasks)</option>
                <option value="schedule">📅 일정 (5. Tasks · type: 일정)</option>
                <option value="inbox">📥 미분류 수집함 메모 (0. Inbox)</option>
              </select>
            </div>
            <div style="flex:1;min-width:140px;">
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">중요도 / 우선순위</label>
              <select id="inbox-importance" class="select">
                <option value="일반">일반</option>
                <option value="중요">중요</option>
              </select>
            </div>
            <div style="flex:1;min-width:150px;">
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">관련 날짜 / 실행일 (선택)</label>
              <input type="date" id="inbox-date" class="input" value="${todayStr()}" />
            </div>
          </div>

          <div class="form-row">
            <div style="flex:2;min-width:220px;">
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">노트 제목 (파일명)</label>
              <input type="text" id="inbox-title" class="input" placeholder="제목을 입력하세요" />
            </div>
            <div style="flex:1;min-width:160px;">
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">출처 / 저자 (참고·생각 선택)</label>
              <input type="text" id="inbox-source" class="input" placeholder="예: 시그마 웹 수집함 / 기사 URL" />
            </div>
          </div>

          <div style="margin-bottom:10px;">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">한 줄 요약 (summary 속성 · 선택)</label>
            <input type="text" id="inbox-summary" class="input" placeholder="핵심 요약을 한 줄로 적으면 표 뷰에서 바로 보입니다" />
          </div>

          <div style="margin-bottom:12px;">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">본문 / 내 원래 메모 (원형 보존)</label>
            <textarea id="inbox-body" class="textarea" style="min-height:180px;" placeholder="내 생각이나 메모 원문을 자유롭게 작성하세요."></textarea>
          </div>

          <button class="btn btn-primary" id="btn-inbox-submit" style="width:100%;justify-content:center;padding:10px;">💾 비공개 볼트에 노트 생성 및 커밋</button>
        </div>

        <div>
          <!-- MD Clipping Upload Panel -->
          <div class="panel">
            <div class="panel-header">
              <h2 class="panel-title">📎 웹 클리핑 MD 파일 업로드 (원본 바이트 보존)</h2>
              <span class="badge badge-green">Clippings/</span>
            </div>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
              Obsidian Web Clipper 등으로 저장한 <code>.md</code> 파일(어닝콜 트랜스크립트, 유튜브 자막, 기사 등)을 선택하면 원본 바이트 그대로 <code>Clippings/</code> 폴더에 업로드합니다.
            </p>
            <input type="file" id="clipping-file-input" accept=".md,text/markdown" multiple class="input" style="margin-bottom:10px;" />
            <button class="btn btn-primary" id="btn-upload-clippings" style="width:100%;justify-content:center;">📤 선택한 MD 클리핑 볼트에 업로드</button>
          </div>

          <!-- GitHub Actions Trigger Panel -->
          <div class="panel">
            <div class="panel-header">
              <h2 class="panel-title">⚙️ 시그마 OS 자동화 워크플로 즉시 실행</h2>
              <span class="badge badge-teal">GitHub Actions</span>
            </div>
            <p style="font-size:12.8px;color:var(--text-muted);margin-bottom:12px;">
              정기 스케줄(06:15 수집함 · 07:00 매크로 · 07:30 IR · 08:00 SEC)을 기다리지 않고 지금 바로 GitHub Actions를 실행합니다.
            </p>
            <div class="grid-2" style="grid-template-columns:1fr 1fr;gap:8px;">
              <button class="btn" data-Run-workflow="sigma-inbox-sync.yml" data-wf-apply="true">🔄 수집함 동기화 실행</button>
              <button class="btn" data-Run-workflow="sigma-macro-sync.yml">📊 FRED 매크로 갱신</button>
              <button class="btn" data-Run-workflow="sigma-ir-sync.yml">📰 6종목 공식 IR 갱신</button>
              <button class="btn" data-Run-workflow="sigma-sec-wiki.yml">🏛️ SEC 공시 동기화</button>
            </div>
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--text-muted);">기존 ChatGPT 상담 수집함 사이트가 필요할 때:</span>
              <a href="https://sigma-inbox.emeraldtuna8.chatgpt.site" target="_blank" rel="noopener" class="btn btn-sm">ChatGPT 수집함 열기 ↗</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* 3. Thoughts, Permanent & Reference Notes View */
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
        const badgeClass = isPerm ? "badge-green" : isTemp ? "badge-amber" : n.props.kind === "참고" ? "badge-teal" : "badge-blue";
        const badgeLabel = n.props.kind === "생각" ? `생각 · ${n.props.stage || "임시"}` : n.props.kind || "자료";
        const hasOriginalMemo = n.body.includes("## 원래 메모");
        const hasAiExpansion = n.body.includes("AI 확장");
        const preview = n.props.summary || n.body.replace(/^#+\s+.*$/gm, "").trim().slice(0, 160);

        return `
          <div class="thought-card" data-note-path="${esc(n.path)}">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;">
                <span class="badge ${badgeClass}">${esc(badgeLabel)}</span>
                <span style="font-size:11.5px;color:var(--text-faint);">${esc(n.mtime)}</span>
              </div>
              <div style="font-weight:700;font-size:15px;margin-bottom:6px;line-height:1.4;">${esc(n.name)}</div>
              <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">${esc(preview)}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border-subtle);">
              <div style="display:flex;gap:4px;flex-wrap:wrap;">
                ${hasOriginalMemo ? '<span class="badge" title="사용자 원래 메모 보존됨">✍️ 원문 보존</span>' : ""}
                ${hasAiExpansion ? '<span class="badge badge-blue" title="AI 근거·반론·연결 확장됨">✨ AI 확장</span>' : ""}
                ${n.backlinks.length ? `<span class="badge">🔗 백링크 ${n.backlinks.length}</span>` : ""}
              </div>
              <span style="font-size:12px;color:var(--accent);font-weight:600;">열기 →</span>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">🧠 내 생각 · 영구 노트 · 참고 노트 · 공부 자료 (${filtered.length}건)</h2>
          <button class="btn btn-primary btn-sm" data-jump-tab="inbox">➕ 새 생각 / 참고 노트 작성</button>
        </div>
        <div class="subtabs">
          <button class="btn btn-sm ${state.thoughtFilter === "all" ? "btn-primary" : ""}" data-thought-filter="all">전체 (${allResourceNotes.length})</button>
          <button class="btn btn-sm ${state.thoughtFilter === "perm" ? "btn-primary" : ""}" data-thought-filter="perm">💎 영구 생각 (${permThoughts.length})</button>
          <button class="btn btn-sm ${state.thoughtFilter === "temp" ? "btn-primary" : ""}" data-thought-filter="temp">🌱 다듬을 임시 생각 (${tempThoughts.length})</button>
          <button class="btn btn-sm ${state.thoughtFilter === "ref" ? "btn-primary" : ""}" data-thought-filter="ref">📌 참고 노트 (${refNotes.length})</button>
          <button class="btn btn-sm ${state.thoughtFilter === "study" ? "btn-primary" : ""}" data-thought-filter="study">📘 투자·매크로 공부 및 기타 자료 (${studyNotes.length})</button>
          <button class="btn btn-sm" data-note-path="8. System/생각 노트.md">📖 생각 노트 시스템 가이드 열기</button>
        </div>
        <div class="grid-3">${cards || "<p style='color:var(--text-muted);'>해당 분류의 노트가 없습니다.</p>"}</div>
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
        const ticker = s.props.ticker || s.name.split(" ")[0];
        const wikiTarget = resolveNoteLink(s.props.wiki || ticker);
        const callPath = callSourceMap[ticker];
        const eventPath = eventSourceMap[ticker];
        return `
          <div class="stock-card" data-note-path="${esc(s.path)}">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="badge badge-blue" style="font-size:13px;padding:3px 10px;">${esc(ticker)}</span>
                  <span style="font-weight:700;font-size:15px;">${esc(s.name)}</span>
                </div>
                <span class="badge badge-green">${esc(s.props.position || "보유")}</span>
              </div>
              <div style="font-size:12px;color:var(--text-faint);margin-bottom:8px;">
                섹터: ${esc(s.props.sector || "-")} · 다음 점검일: <strong>${esc(s.props.next_review || "-")}</strong>
              </div>
              <div style="font-size:13px;margin-bottom:8px;"><strong>핵심 논리(Thesis):</strong> ${esc(s.props.thesis || "-")}</div>
              <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;"><strong>판단 질문:</strong> ${esc(s.props.question || "-")}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;padding-top:10px;border-top:1px solid var(--border-subtle);">
              <button class="btn btn-sm btn-primary" data-note-path="${esc(s.path)}">종목 논리 노트</button>
              ${callPath && state.byPath[callPath] ? `<button class="btn btn-sm" data-note-path="${esc(callPath)}">어닝콜 시계열</button>` : ""}
              ${eventPath && state.byPath[eventPath] ? `<button class="btn btn-sm" data-note-path="${esc(eventPath)}">대형행사 5칸</button>` : ""}
              ${wikiTarget ? `<button class="btn btn-sm" data-note-path="${esc(wikiTarget.path)}">위키 엔티티</button>` : ""}
            </div>
          </div>
        `;
      })
      .join("");

    const wikiNotes = state.notes.filter((n) => n.top_folder === "9. Wiki");
    let subContent = "";

    if (state.investingSubtab === "stocks") {
      subContent = `
        <div class="grid-3" style="margin-bottom:18px;">${stockCards}</div>
        <div class="grid-2">
          <div>${ renderQuickPreviewPanel("9. Wiki/매크로 스냅샷.md", "📊 FRED 매크로 스냅샷 최신 트리거") }</div>
          <div>${ renderQuickPreviewPanel("9. Wiki/AI 인프라 신용 점검.md", "🏦 AI 인프라 신용 · 보증 · XPV · FCF 점검") }</div>
        </div>
      `;
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
      // Full LLM Wiki Explorer
      let filteredWiki = wikiNotes;
      if (state.wikiFilter === "entity") filteredWiki = wikiNotes.filter((n) => n.folder === "9. Wiki/Entities");
      else if (state.wikiFilter === "concept") filteredWiki = wikiNotes.filter((n) => n.folder === "9. Wiki/Concepts");
      else if (state.wikiFilter === "synthesis") filteredWiki = wikiNotes.filter((n) => n.props.wiki_type === "synthesis");
      else if (state.wikiFilter === "source") filteredWiki = wikiNotes.filter((n) => n.folder === "9. Wiki/Sources" && !n.name.startsWith("src-sec-"));
      else if (state.wikiFilter === "sec") filteredWiki = wikiNotes.filter((n) => n.name.startsWith("src-sec-") || n.name === "SEC 공시");

      subContent = `
        <div class="subtabs">
          <button class="btn btn-sm ${state.wikiFilter === "all" ? "btn-primary" : ""}" data-wiki-filter="all">전체 위키 (${wikiNotes.length})</button>
          <button class="btn btn-sm ${state.wikiFilter === "synthesis" ? "btn-primary" : ""}" data-wiki-filter="synthesis">종합·매크로·신용·IR</button>
          <button class="btn btn-sm ${state.wikiFilter === "entity" ? "btn-primary" : ""}" data-wiki-filter="entity">기업·인물 (Entities)</button>
          <button class="btn btn-sm ${state.wikiFilter === "concept" ? "btn-primary" : ""}" data-wiki-filter="concept">개념 (Concepts)</button>
          <button class="btn btn-sm ${state.wikiFilter === "source" ? "btn-primary" : ""}" data-wiki-filter="source">일반·어닝콜 출처 (Sources)</button>
          <button class="btn btn-sm ${state.wikiFilter === "sec" ? "btn-primary" : ""}" data-wiki-filter="sec">SEC 공시 (74)</button>
        </div>
        ${renderBaseTable(
          `📚 LLM 위키 목록 (${filteredWiki.length}건)`,
          ["위키 페이지", "폴더 / 유형", "신뢰도 / 티커", "최종 갱신"],
          filteredWiki.map((n) => [
            noteLinkHTML(n.path, n.name),
            `<span class="badge">${esc(n.props.wiki_type || n.folder)}</span>`,
            esc(n.props.ticker || n.props.credibility || "-"),
            esc(n.mtime),
          ])
        )}
      `;
    }

    return `
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">📈 핵심 보유 6종목 투자 센터 &amp; LLM 위키</h2>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-sm" data-note-path="9. Wiki/overview.md">🌐 위키 전체 종합 (overview)</button>
            <button class="btn btn-sm" data-note-path="9. Wiki/index.md">📑 위키 목차 (index)</button>
            <button class="btn btn-sm" data-note-path="9. Wiki/공식 보도자료.md">📰 6종목 공식 보도자료</button>
            <button class="btn btn-sm" data-note-path="9. Wiki/SEC 공시.md">🏛️ SEC 공시</button>
          </div>
        </div>
        <div class="subtabs">
          <button class="btn btn-sm ${state.investingSubtab === "stocks" ? "btn-primary" : ""}" data-inv-sub="stocks">핵심 보유 6종목 &amp; 매크로·신용</button>
          <button class="btn btn-sm ${state.investingSubtab === "calls" ? "btn-primary" : ""}" data-inv-sub="calls">🎙️ 어닝콜 46건 + 대형행사 2건 시계열 종합</button>
          <button class="btn btn-sm ${state.investingSubtab === "wiki" ? "btn-primary" : ""}" data-inv-sub="wiki">📚 LLM 위키 전체 탐색 (${wikiNotes.length}개)</button>
        </div>
        ${subContent}
      </div>
    `;
  }

  function renderQuickPreviewPanel(relPath, customTitle) {
    const n = state.byPath[relPath];
    if (!n) return "";
    const rawCount = Array.isArray(n.props.raw) ? n.props.raw.length : 0;
    return `
      <div class="panel" style="margin-bottom:0;">
        <div class="panel-header">
          <h3 class="panel-title" style="font-size:14.5px;">${noteLinkHTML(n.path, customTitle || n.name)}</h3>
          <div style="display:flex;gap:6px;">
            ${rawCount ? `<span class="badge badge-blue">원본 ${rawCount}건</span>` : ""}
            <button class="btn btn-sm" data-note-path="${esc(n.path)}">전체 열기 →</button>
          </div>
        </div>
        <div class="md-body" style="max-height:320px;overflow-y:auto;font-size:13.2px;">
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
              <span>${collapsed ? "▸" : "▾"} 📁 ${esc(f)}</span>
              <span class="badge">${items.length}</span>
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
    if (!note) return "<div class='panel'>노트를 찾을 수 없습니다.</div>";

    const isClipping = note.top_folder === "Clippings";
    const isTempThought = note.props.kind === "생각" && (!note.props.stage || note.props.stage === "임시");
    const propKeys = Object.keys(note.props);

    const propsHtml = propKeys.length
      ? `<div class="props-grid">${propKeys
          .map((k) => `<span class="prop-chip"><span class="prop-key">${esc(k)}:</span> <span>${formatPropVal(note.props[k])}</span></span>`)
          .join("")}</div>`
      : "";

    const backlinksHtml = note.backlinks && note.backlinks.length
      ? `<div style="margin-top:28px;padding-top:16px;border-top:1px solid var(--border);">
          <div style="font-weight:700;font-size:13.5px;margin-bottom:10px;color:var(--text-muted);">🔗 이 노트를 연결한 백링크 (${note.backlinks.length}건)</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${note.backlinks
              .map((bp) => {
                const bn = state.byPath[bp];
                return bn ? `<button class="btn btn-sm" data-note-path="${esc(bn.path)}">📄 ${esc(bn.name)}</button>` : "";
              })
              .join("")}
          </div>
        </div>`
      : "";

    let readerBodyHtml = "";
    if (state.editingNote && !isClipping) {
      const fullRaw = serializeFrontmatterJS(note.props, note.body);
      readerBodyHtml = `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:12.5px;color:var(--text-muted);">마크다운 및 프론트매터 직접 편집 (<code>## 원래 메모</code>는 원형 그대로 보존하세요)</span>
            ${
              isTempThought
                ? `<button class="btn btn-sm" id="btn-insert-perm-template">✨ 영구 생각 확장 섹션 틀 자동 삽입</button>`
                : ""
            }
          </div>
          <textarea id="note-editor-textarea" class="textarea" style="min-height:460px;font-family:var(--font-mono);font-size:13px;">${esc(fullRaw)}</textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="btn" id="btn-cancel-edit">취소</button>
          <button class="btn btn-primary" id="btn-save-edit">💾 GitHub 볼트에 변경사항 커밋</button>
        </div>
      `;
    } else {
      readerBodyHtml = `
        ${propsHtml}
        <div class="md-body">${renderMarkdown(note.body, note)}</div>
        ${
          note.truncated
            ? `<div style="margin-top:14px;"><button class="btn btn-primary" id="btn-load-full-clipping">📖 클리핑 전문 끝까지 불러오기 (${(note.size / 1024).toFixed(1)} KB)</button></div>`
            : ""
        }
        ${backlinksHtml}
      `;
    }

    return `
      <div class="explorer-layout">
        <aside class="sidebar" aria-label="볼트 폴더 트리">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px 10px;border-bottom:1px solid var(--border-subtle);margin-bottom:8px;">
            <strong style="font-size:13px;">📂 볼트 폴더 탐색기</strong>
            <button class="btn btn-sm" id="btn-back-history" ${state.historyStack.length ? "" : "disabled"}>← 이전</button>
          </div>
          ${folderHtml}
        </aside>

        <section class="note-reader">
          <div class="note-top-meta">
            <div>
              <div class="note-path">${esc(note.path)}</div>
              <h2 style="margin:4px 0 0;font-size:20px;">${esc(note.name)}</h2>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              ${
                isClipping
                  ? `<span class="badge badge-amber" title="CLAUDE.md 규칙에 따라 Clippings 원본은 수정하지 않고 보존합니다">🔒 Clippings 원본 보존 (읽기 전용)</span>`
                  : `<button class="btn btn-sm ${state.editingNote ? "btn-primary" : ""}" id="btn-toggle-edit">${
                      state.editingNote ? "👁️ 읽기 모드로" : "✏️ 노트 편집"
                    }</button>`
              }
              <a href="https://github.com/${esc(state.repo)}/blob/main/${encodeRepoPath(note.path)}" target="_blank" rel="noopener" class="btn btn-sm">GitHub 원문 ↗</a>
            </div>
          </div>
          ${readerBodyHtml}
        </section>
      </div>
    `;
  }

  function renderAll() {
    renderStatsStrip();
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === state.activeTab);
    });
    const container = document.getElementById("view-container");
    if (!container) return;

    if (state.mode === "locked") {
      container.innerHTML = renderLockedView();
      return;
    }

    if (state.activeTab === "triage") container.innerHTML = renderTriageView();
    else if (state.activeTab === "inbox") container.innerHTML = renderInboxView();
    else if (state.activeTab === "thoughts") container.innerHTML = renderThoughtsView();
    else if (state.activeTab === "investing") container.innerHTML = renderInvestingView();
    else if (state.activeTab === "explorer") container.innerHTML = renderExplorerView();
  }

  /* -------------------- Navigation & Actions -------------------- */
  async function openNote(relPath, pushHistory = true) {
    const note = state.byPath[relPath];
    if (!note) {
      showToast(`노트를 찾을 수 없습니다: ${relPath}`);
      return;
    }
    if (pushHistory && state.currentNotePath && state.currentNotePath !== relPath) {
      state.historyStack.push(state.currentNotePath);
    }
    state.currentNotePath = relPath;
    state.editingNote = false;
    state.collapsedFolders[note.top_folder] = false;
    state.activeTab = "explorer";
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });

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

    // default: 0. Inbox
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
      showToast("제목을 입력해주세요.");
      return;
    }
    const payload = buildNewNotePayload(kind, title, body, opts);
    upsertNoteInMemory(payload.path, payload.content);
    renderAll();

    if (state.token) {
      showToast(`GitHub 비공개 볼트에 저장 중: ${payload.path}`);
      await ghPutFile(payload.path, payload.content, `feat(inbox): add ${payload.path} via Sigma OS Web`);
      showToast(`✅ 비공개 볼트에 커밋 완료: ${payload.path}`);
    } else {
      showToast(`⚠️ 브라우저 메모리에 반영됨 (GitHub 영구 저장은 상단 [🔒 보안 연결]에 토큰을 입력하세요)`);
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
      box.innerHTML = `<div style="color:var(--text-muted);font-size:13px;">검색어를 입력하면 343개 전체 노트 제목·본문·속성·티커에서 즉시 검색합니다.</div>`;
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
      box.innerHTML = `<div style="color:var(--text-muted);font-size:13px;">'${esc(query)}' 검색 결과가 없습니다.</div>`;
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
          <div class="file-item" data-note-path="${esc(note.path)}" style="padding:10px;border-bottom:1px solid var(--border-subtle);white-space:normal;display:block;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
              <strong style="color:var(--text);font-size:13.8px;">${esc(note.name)}</strong>
              <span class="badge">${esc(note.top_folder)}</span>
            </div>
            <div style="font-size:12.2px;color:var(--text-muted);">${esc(snippet.replace(/\s+/g, " "))}</div>
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
    const hasEnc = Boolean(localStorage.getItem(STORAGE_KEYS.tokenEnc));
    body.innerHTML = `
      <p style="font-size:13px;color:var(--text-muted);margin-top:0;">
        비공개 저장소(<code>${esc(state.repo)}</code>)를 읽고 수집함 메모·노트 편집을 커밋하려면 GitHub Personal Access Token(PAT)이 필요합니다. 토큰은 외부 서버로 전송되지 않고 브라우저에만 보관됩니다.
      </p>
      ${
        hasEnc
          ? `<div style="margin-bottom:14px;padding:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);">
              <strong style="font-size:13px;display:block;margin-bottom:6px;">🔑 저장된 간편 비밀번호로 잠금 해제</strong>
              <div class="form-row" style="margin-bottom:0;">
                <input type="password" id="modal-unlock-pin" class="input" placeholder="간편 비밀번호 입력" style="flex:1;" />
                <button class="btn btn-primary" id="btn-modal-unlock">잠금 해제</button>
              </div>
            </div>`
          : ""
      }
      <div style="margin-bottom:10px;">
        <label style="font-size:12.5px;font-weight:600;display:block;margin-bottom:4px;">저장소 (Owner/Repo)</label>
        <input type="text" id="modal-repo-input" class="input" value="${esc(state.repo)}" />
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12.5px;font-weight:600;display:block;margin-bottom:4px;">GitHub Personal Access Token (PAT)</label>
        <input type="password" id="modal-pat-input" class="input" value="${esc(state.token)}" placeholder="ghp_... 또는 github_pat_..." />
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:12.5px;font-weight:600;display:block;margin-bottom:4px;">간편 비밀번호로 AES-256 암호화 잠금 설정 (선택)</label>
        <input type="password" id="modal-pin-input" class="input" placeholder="설정 시 토큰을 AES-256으로 암호화해 저장합니다" />
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;">
        <button class="btn" id="btn-clear-auth">연결 해제 / 초기화</button>
        <button class="btn btn-primary" id="btn-save-auth">🔒 저장 및 동기화</button>
      </div>
    `;
    modal.classList.add("open");
  }

  /* -------------------- Event Delegation -------------------- */
  function bindEvents() {
    document.addEventListener("click", async (e) => {
      const target = e.target.closest(
        "[data-tab],[data-jump-tab],[data-note-path],[data-search-query],[data-thought-filter],[data-inv-sub],[data-wiki-filter],[data-toggle-folder],[data-Run-workflow],button"
      );
      if (!target) return;

      // 1. Top nav tab switch
      if (target.hasAttribute("data-tab")) {
        state.activeTab = target.getAttribute("data-tab");
        renderAll();
        return;
      }

      // 2. Jump tab from stat cards
      if (target.hasAttribute("data-jump-tab")) {
        state.activeTab = target.getAttribute("data-jump-tab");
        if (target.hasAttribute("data-thought-filter")) state.thoughtFilter = target.getAttribute("data-thought-filter");
        if (target.hasAttribute("data-inv-sub")) state.investingSubtab = target.getAttribute("data-inv-sub");
        renderAll();
        return;
      }

      // 3. Open note link
      if (target.hasAttribute("data-note-path")) {
        e.preventDefault();
        const p = target.getAttribute("data-note-path");
        document.getElementById("search-modal")?.classList.remove("open");
        await openNote(p);
        return;
      }

      // 4. Unresolved wikilink -> search
      if (target.hasAttribute("data-search-query")) {
        e.preventDefault();
        openSearchModal(target.getAttribute("data-search-query"));
        return;
      }

      // 5. Thought filter
      if (target.hasAttribute("data-thought-filter")) {
        state.thoughtFilter = target.getAttribute("data-thought-filter");
        renderAll();
        return;
      }

      // 6. Investing subtab
      if (target.hasAttribute("data-inv-sub")) {
        state.investingSubtab = target.getAttribute("data-inv-sub");
        renderAll();
        return;
      }

      // 7. Wiki filter
      if (target.hasAttribute("data-wiki-filter")) {
        state.wikiFilter = target.getAttribute("data-wiki-filter");
        renderAll();
        return;
      }

      // 8. Toggle folder in Explorer
      if (target.hasAttribute("data-toggle-folder")) {
        const f = target.getAttribute("data-toggle-folder");
        state.collapsedFolders[f] = !state.collapsedFolders[f];
        renderAll();
        return;
      }

      // 9. Trigger GitHub Actions workflow
      if (target.hasAttribute("data-Run-workflow")) {
        const wf = target.getAttribute("data-Run-workflow");
        const inputs = target.getAttribute("data-wf-apply") === "true" ? { apply: true } : {};
        try {
          showToast(`⚙️ GitHub Actions 실행 요청 중: ${wf}`);
          await ghTriggerWorkflow(wf, inputs);
          showToast(`✅ 워크플로 실행 시작됨: ${wf}`);
        } catch (err) {
          showToast(err.message);
        }
        return;
      }

      // Button IDs
      const id = target.id;
      if (id === "brand-home") {
        state.activeTab = "triage";
        renderAll();
      } else if (id === "btn-open-search") {
        openSearchModal("");
      } else if (id === "btn-close-search") {
        document.getElementById("search-modal")?.classList.remove("open");
      } else if (id === "btn-open-auth") {
        openAuthModal();
      } else if (id === "btn-close-auth") {
        document.getElementById("auth-modal")?.classList.remove("open");
      } else if (id === "btn-sync-now") {
        showToast("🔄 볼트 최신 인덱스 동기화 중...");
        await loadVaultData();
        showToast("✅ 동기화 완료");
      } else if (id === "btn-theme-toggle") {
        const root = document.documentElement;
        const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
        root.setAttribute("data-theme", next);
        localStorage.setItem(STORAGE_KEYS.theme, next);
      } else if (id === "btn-go-full-inbox") {
        state.activeTab = "inbox";
        renderAll();
      } else if (id === "btn-quick-save") {
        const kind = document.getElementById("quick-kind")?.value || "thought_temp";
        const title = document.getElementById("quick-title")?.value || "";
        const body = document.getElementById("quick-body")?.value || "";
        try {
          await saveNewInboxNote(kind, title, body);
          if (document.getElementById("quick-title")) document.getElementById("quick-title").value = "";
          if (document.getElementById("quick-body")) document.getElementById("quick-body").value = "";
        } catch (err) {
          showToast(err.message);
        }
      } else if (id === "btn-inbox-submit") {
        const kind = document.getElementById("inbox-kind")?.value || "thought_temp";
        const title = document.getElementById("inbox-title")?.value || "";
        const body = document.getElementById("inbox-body")?.value || "";
        const importance = document.getElementById("inbox-importance")?.value || "일반";
        const date = document.getElementById("inbox-date")?.value || todayStr();
        const source = document.getElementById("inbox-source")?.value || "시그마 웹 수집함";
        const summary = document.getElementById("inbox-summary")?.value || "";
        try {
          await saveNewInboxNote(kind, title, body, { importance, date, source, summary });
          await openNote(buildNewNotePayload(kind, title, body, { importance, date, source, summary }).path);
        } catch (err) {
          showToast(err.message);
        }
      } else if (id === "btn-upload-clippings") {
        const input = document.getElementById("clipping-file-input");
        if (!input || !input.files || !input.files.length) {
          showToast("업로드할 .md 파일을 선택해주세요.");
          return;
        }
        for (const file of input.files) {
          const text = await file.text();
          const relPath = `Clippings/${file.name}`;
          upsertNoteInMemory(relPath, text);
          if (state.token) {
            await ghPutFile(relPath, text, `feat(clippings): upload ${file.name} via Sigma OS Web`);
          }
        }
        renderAll();
        showToast(`✅ MD 클리핑 ${input.files.length}건 업로드 완료`);
      } else if (id === "btn-toggle-edit") {
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
        upsertNoteInMemory(state.currentNotePath, newRaw);
        state.editingNote = false;
        renderAll();
        if (state.token) {
          try {
            showToast("💾 GitHub 볼트에 변경사항 커밋 중...");
            await ghPutFile(state.currentNotePath, newRaw, `docs(vault): update ${state.currentNotePath} via Sigma OS Web`);
            showToast("✅ GitHub 볼트 커밋 완료");
          } catch (err) {
            showToast(err.message);
          }
        } else {
          showToast("⚠️ 브라우저에 반영됨 (GitHub 커밋은 상단 [🔒 보안 연결]에 토큰 필요)");
        }
      } else if (id === "btn-load-full-clipping") {
        const note = state.byPath[state.currentNotePath];
        try {
          showToast("클리핑 전문을 불러오는 중...");
          await ensureFullNoteBody(note);
          renderAll();
        } catch (err) {
          showToast(err.message);
        }
      } else if (id === "btn-back-history") {
        const prev = state.historyStack.pop();
        if (prev) await openNote(prev, false);
      } else if (id === "btn-save-auth" || id === "btn-save-pat-direct") {
        const repoVal = document.getElementById("modal-repo-input")?.value || state.repo;
        const patVal = (document.getElementById("modal-pat-input")?.value || document.getElementById("auth-pat-direct")?.value || "").trim();
        const pinVal = (document.getElementById("modal-pin-input")?.value || document.getElementById("auth-pin-setup")?.value || "").trim();
        if (!patVal) {
          showToast("GitHub Personal Access Token을 입력해주세요.");
          return;
        }
        state.repo = repoVal.trim();
        state.token = patVal;
        localStorage.setItem(STORAGE_KEYS.repo, state.repo);
        sessionStorage.setItem(STORAGE_KEYS.tokenPlain, patVal);
        if (pinVal) {
          const enc = await encryptTokenWithPassword(patVal, pinVal);
          localStorage.setItem(STORAGE_KEYS.tokenEnc, enc);
          localStorage.removeItem(STORAGE_KEYS.tokenPlain);
        } else {
          localStorage.setItem(STORAGE_KEYS.tokenPlain, patVal);
        }
        document.getElementById("auth-modal")?.classList.remove("open");
        await loadVaultData();
        showToast("🔒 비공개 GitHub 볼트 연결 완료");
      } else if (id === "btn-unlock-pin" || id === "btn-modal-unlock") {
        const pinVal = (document.getElementById("unlock-pin-input")?.value || document.getElementById("modal-unlock-pin")?.value || "").trim();
        const enc = localStorage.getItem(STORAGE_KEYS.tokenEnc);
        if (!pinVal || !enc) return;
        try {
          const pat = await decryptTokenWithPassword(enc, pinVal);
          state.token = pat;
          sessionStorage.setItem(STORAGE_KEYS.tokenPlain, pat);
          document.getElementById("auth-modal")?.classList.remove("open");
          await loadVaultData();
          showToast("🔓 잠금 해제 완료");
        } catch (_) {
          showToast("❌ 비밀번호가 일치하지 않습니다.");
        }
      } else if (id === "btn-clear-auth") {
        state.token = "";
        sessionStorage.removeItem(STORAGE_KEYS.tokenPlain);
        localStorage.removeItem(STORAGE_KEYS.tokenPlain);
        localStorage.removeItem(STORAGE_KEYS.tokenEnc);
        document.getElementById("auth-modal")?.classList.remove("open");
        await loadVaultData();
        showToast("연결 정보가 초기화되었습니다.");
      }
    });

    // Task checkbox toggle
    document.addEventListener("change", async (e) => {
      if (e.target.classList.contains("task-toggle")) {
        const path = e.target.getAttribute("data-path");
        const note = state.byPath[path];
        if (!note) return;
        note.props.done = e.target.checked;
        const newRaw = serializeFrontmatterJS(note.props, note.body);
        renderAll();
        if (state.token) {
          try {
            await ghPutFile(path, newRaw, `feat(tasks): toggle done=${note.props.done} on ${note.name}`);
            showToast(`✅ 할 일 상태 저장됨: ${note.name}`);
          } catch (err) {
            showToast(err.message);
          }
        }
      }
    });

    // Search input
    document.getElementById("search-input")?.addEventListener("input", (e) => {
      runSearch(e.target.value);
    });

    // Keyboard shortcuts (Ctrl+K or / to search, Esc to close modals)
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
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    bindEvents();
    loadVaultData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
