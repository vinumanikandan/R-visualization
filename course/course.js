// Interactive course page: renders README.md and adds navigation, progress, exercises,
// quizzes and (for R courses) in-browser code execution with webR.
(function () {
  "use strict";
  const C = window.COURSE;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const KEY = "course:" + C.id;

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const darkMq = matchMedia("(prefers-color-scheme: dark)");
  const applyMode = () => root.setAttribute("data-mode", root.getAttribute("data-theme") || (darkMq.matches ? "dark" : "light"));
  const savedTheme = store.get("theme-course", null);
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  applyMode();
  darkMq.addEventListener("change", applyMode);
  $("#themeToggle").addEventListener("click", () => {
    const next = root.getAttribute("data-mode") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next); store.set("theme-course", next); applyMode();
  });

  /* ---------- Toast + lightbox ---------- */
  const toast = $("#toast");
  function showToast(msg) { toast.textContent = msg; toast.classList.add("show"); clearTimeout(showToast.t); showToast.t = setTimeout(() => toast.classList.remove("show"), 1800); }
  const lb = $("#lightbox");
  lb.addEventListener("click", () => lb.classList.remove("show"));
  addEventListener("keydown", (e) => { if (e.key === "Escape") { lb.classList.remove("show"); closeSide(); } });

  /* ---------- Mobile sidebar ---------- */
  const side = $("#side"), scrim = $("#scrim");
  function closeSide() { side.classList.remove("open"); scrim.classList.remove("show"); }
  $("#tocBtn").addEventListener("click", () => { side.classList.toggle("open"); scrim.classList.toggle("show"); });
  scrim.addEventListener("click", closeSide);

  /* ---------- Markdown clean-up ---------- */
  // README files use a few constructs GitHub tolerates but marked does not:
  // indented/odd-length fences, pandoc image widths and curly quotes inside code.
  function normalize(md) {
    md = md.replace(/!\[([^\]]*)\]\(([^)\s]+)\s*\)\s*\{\s*width\s*=\s*(\d+)%\s*\}/g,
      (m, alt, src, w) => `<img src="${src.trim()}" alt="${alt}" style="width:${Math.max(+w, 60)}%">`);
    md = md.replace(/\{\s*width\s*=\s*\d+%\s*\}/g, "");
    const lines = md.split("\n"), out = [];
    for (let i = 0; i < lines.length; i++) {
      const open = lines[i].match(/^\s*(`{3,})\s*([\w-]*)\s*$/);
      if (!open) { out.push(lines[i]); continue; }
      const body = [];
      let j = i + 1;
      while (j < lines.length && !/^\s*`{3,}\s*$/.test(lines[j])) body.push(lines[j++]);
      if (j >= lines.length) { out.push(lines[i]); continue; } // unterminated: leave as is
      while (body.length && !body[0].trim()) body.shift();
      while (body.length && !body[body.length - 1].trim()) body.pop();
      const ind = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length), 99);
      out.push("", "```" + (open[2] || C.lang), ...body.map((l) => l.slice(Math.min(ind, l.match(/^\s*/)[0].length))), "```", "");
      i = j;
    }
    return out.join("\n");
  }
  const straighten = (s) => s.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'");

  /* ---------- Render ---------- */
  const content = $("#content");
  fetch(C.readme || "README.md", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then((md) => {
      content.innerHTML = marked.parse(normalize(md), { gfm: true, breaks: false });
      enhance();
    })
    .catch((e) => { content.innerHTML = `<p class="loading">Couldn't load the lesson (${esc(e.message)}). <a href="${esc(C.repo)}">Open it on GitHub</a>.</p>`; });

  function slug(t, used) {
    let s = t.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "section";
    let k = s, n = 2;
    while (used.has(k)) k = s + "-" + n++;
    used.add(k); return k;
  }

  function enhance() {
    // Title: the README's first h1 becomes the hero.
    const first = content.querySelector("h1");
    if (first && first === content.firstElementChild) first.remove();
    let lede = content.firstElementChild;
    if (lede && lede.tagName === "P") lede.remove(); else lede = null;
    $("#hero").innerHTML = `
      <div class="hero__eyebrow">${esc(C.eyebrow)}</div>
      <h1>${esc(C.title)}</h1>
      <p class="hero__lede">${lede ? lede.innerHTML : esc(C.subtitle)}</p>
      <div class="hero__meta" id="heroMeta"></div>
      ${C.tip ? `<p class="hero__tip">${C.tip}</p>` : ""}`;
    $("#hero").setAttribute("data-glyph", C.glyph || "");

    // Tables scroll on small screens; images zoom.
    $$("table", content).forEach((t) => { const w = document.createElement("div"); w.className = "table-wrap"; t.replaceWith(w); w.appendChild(t); });
    $$("img", content).forEach((img) => {
      img.loading = "lazy"; img.decoding = "async";
      img.addEventListener("click", () => { $("img", lb).src = img.src; lb.classList.add("show"); });
    });
    // "**[1] 3**" style paragraphs are expected R output.
    $$("p", content).forEach((p) => { if (/^\s*\[\d+\]/.test(p.textContent) && !p.querySelector("a,img")) p.classList.add("expected"); });

    // Headings → ids, tasks, sections.
    const used = new Set();
    const heads = $$("h1, h2, h3", content);
    heads.forEach((h) => { h.id = slug(h.textContent, used); });
    // README code comments that slipped out of fences show up as stray h1s; demote very short-lived ones? Keep as is.
    wrapTasks();
    buildCode();
    insertQuizzes();
    buildToc();
    setupSearch();
    const steps = $$(".code").length, tasks = $$(".task").length, quizzes = $$(".quiz").length;
    $("#heroMeta").innerHTML = [
      `<span class="pill">📚 ${tocItems.length} sections</span>`,
      tasks ? `<span class="pill pill--alt">✎ ${tasks} exercises</span>` : "",
      `<span class="pill">⌨ ${steps} code examples</span>`,
      quizzes ? `<span class="pill pill--alt">✓ ${quizzes} quick checks</span>` : "",
      C.runnable ? `<span class="pill">▶ Runs in your browser</span>` : ""
    ].join("");
    if (location.hash) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView(); }
  }

  const isTask = (h) => /^\s*task\s*[-:]?\s*\d+/i.test(h.textContent);
  function wrapTasks() {
    $$("h1, h2, h3", content).filter(isTask).forEach((h) => {
      const box = document.createElement("section");
      box.className = "task";
      h.before(box);
      let n = h;
      const lvl = +h.tagName[1];
      do {
        const next = n.nextElementSibling;
        box.appendChild(n);
        n = next;
      } while (n && !(/^H[1-3]$/.test(n.tagName) && +n.tagName[1] <= Math.max(lvl, 2)) && !n.classList.contains("task"));
      $$("details > summary", box).forEach((s) => { if (/answer/i.test(s.textContent)) s.textContent = "Show answer"; });
    });
  }

  /* ---------- Code blocks ---------- */
  function buildCode() {
    $$("pre > code", content).forEach((code) => {
      const pre = code.parentElement;
      const lang = (code.className.match(/language-([\w-]+)/) || [, C.lang])[1];
      const isR = lang === "r";
      code.textContent = code.textContent.replace(/\n+$/, "");
      if (window.hljs) { try { hljs.highlightElement(code); } catch (e) { /* unknown language */ } }
      const box = document.createElement("div");
      box.className = "code code--" + lang;
      box.innerHTML = `<div class="code__bar"><span class="code__lang">${esc(lang === "bash" ? "terminal" : lang)}</span>
        ${isR && C.runnable ? `<button class="code__btn code__btn--run" type="button">▶ Run</button>` : ""}
        <button class="code__btn code__btn--copy" type="button">Copy</button></div>`;
      pre.replaceWith(box);
      box.appendChild(pre);
      const out = document.createElement("div");
      out.className = "out";
      box.appendChild(out);
      const src = straighten(code.textContent);
      $(".code__btn--copy", box).addEventListener("click", async (e) => {
        try { await navigator.clipboard.writeText(src); e.target.textContent = "Copied ✓"; } catch (err) { e.target.textContent = "Select & copy"; }
        setTimeout(() => (e.target.textContent = "Copy"), 1500);
      });
      const run = $(".code__btn--run", box);
      if (run) run.addEventListener("click", () => R.run(src, out, run));
    });
  }

  /* ---------- Quizzes ---------- */
  function insertQuizzes() {
    (C.quizzes || []).forEach((q, qi) => {
      const h = $$("h1, h2, h3", content).find((x) => x.textContent.trim().toLowerCase().startsWith(q.after.toLowerCase()));
      if (!h) return;
      // Place the quiz at the end of that heading's section.
      const lvl = +h.tagName[1];
      let n = h.closest(".task") || h, last = n;
      while ((n = n.nextElementSibling) && !(/^H[1-3]$/.test(n.tagName) && +n.tagName[1] <= Math.max(lvl, 2)) && !n.classList.contains("task")) last = n;
      const box = document.createElement("div");
      box.className = "quiz";
      box.innerHTML = `<div class="quiz__tag">Quick check</div><p class="quiz__q">${q.q}</p>
        <div class="quiz__opts">${q.options.map((o, i) => `<button class="quiz__opt" data-i="${i}" type="button">${o}</button>`).join("")}</div>
        <p class="quiz__fb" hidden></p>`;
      last.after(box);
      const fb = $(".quiz__fb", box);
      box.addEventListener("click", (e) => {
        const b = e.target.closest(".quiz__opt");
        if (e.target.closest(".quiz__retry")) { $$(".quiz__opt", box).forEach((x) => { x.disabled = false; x.classList.remove("right", "wrong"); }); fb.hidden = true; return; }
        if (!b || b.disabled) return;
        const ok = +b.dataset.i === q.answer;
        $$(".quiz__opt", box).forEach((x) => { x.disabled = true; if (+x.dataset.i === q.answer) x.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        fb.hidden = false;
        fb.innerHTML = (ok ? `<b class="ok">Correct!</b> ` : `<b class="no">Not quite.</b> `) + (q.explain || "") +
          (ok ? "" : `<button class="quiz__retry" type="button">Try again</button>`);
        const s = store.get(KEY + ":quiz", {}); s[qi] = ok; store.set(KEY + ":quiz", s);
      });
    });
  }

  /* ---------- TOC, progress, scrollspy ---------- */
  let tocItems = [];
  function buildToc() {
    const done = new Set(store.get(KEY + ":done", []));
    const heads = $$("h1, h2", content).filter((h) => h.textContent.trim().length > 1 && !h.closest("details"));
    tocItems = heads.map((h) => ({ h, id: h.id, lvl: h.tagName === "H1" ? 1 : 2, task: !!h.closest(".task"), text: h.textContent.trim() }));
    $("#toc").innerHTML = tocItems.map((t) =>
      `<li class="lvl-${t.lvl}${t.task ? " is-task" : ""}${done.has(t.id) ? " done" : ""}" data-id="${t.id}">
        <a href="#${t.id}"><span class="tick">✓</span><span>${esc(t.text)}</span></a></li>`).join("");
    // "Mark done" button on each heading.
    tocItems.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "done-btn" + (done.has(t.id) ? " on" : "");
      b.textContent = done.has(t.id) ? "✓ Done" : "Mark done";
      b.addEventListener("click", () => toggleDone(t.id));
      t.h.appendChild(b);
    });
    $("#toc").addEventListener("click", (e) => { if (e.target.closest("a")) closeSide(); });
    updateProgress();

    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        $$("#toc a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
        const act = $("#toc a.active");
        if (act && !side.classList.contains("open")) {
          const r = act.getBoundingClientRect(), sr = side.getBoundingClientRect();
          if (r.top < sr.top + 60 || r.bottom > sr.bottom - 20) side.scrollTo({ top: act.offsetTop - sr.height / 3, behavior: "smooth" });
        }
      });
    }, { rootMargin: "-10% 0px -80% 0px" });
    tocItems.forEach((t) => spy.observe(t.h));
  }
  function toggleDone(id) {
    const done = new Set(store.get(KEY + ":done", []));
    done.has(id) ? done.delete(id) : done.add(id);
    store.set(KEY + ":done", [...done]);
    const on = done.has(id);
    $(`#toc li[data-id="${CSS.escape(id)}"]`).classList.toggle("done", on);
    const b = $(".done-btn", document.getElementById(id));
    b.classList.toggle("on", on); b.textContent = on ? "✓ Done" : "Mark done";
    updateProgress();
    if (on && done.size === tocItems.length) showToast("🎉 Course complete — great work!");
  }
  function updateProgress() {
    const ids = new Set(tocItems.map((t) => t.id));
    const n = store.get(KEY + ":done", []).filter((id) => ids.has(id)).length;
    const pct = tocItems.length ? Math.round((n / tocItems.length) * 100) : 0;
    $("#progText").innerHTML = `<b>${n}</b> / ${tocItems.length} sections`;
    $("#progPct").textContent = pct + "%";
    $("#progBar").style.width = pct + "%";
  }
  $("#resetProg").addEventListener("click", () => {
    store.set(KEY + ":done", []);
    $$("#toc li").forEach((li) => li.classList.remove("done"));
    $$(".done-btn").forEach((b) => { b.classList.remove("on"); b.textContent = "Mark done"; });
    updateProgress();
  });

  addEventListener("scroll", () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    $("#progress").style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%";
  }, { passive: true });

  /* ---------- Search ---------- */
  function setupSearch() {
    const input = $("#search"), count = $("#searchCount");
    let hits = [], cur = -1;
    function clear() {
      $$("mark.hit", content).forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
      content.normalize();
      $$("#toc li").forEach((li) => li.classList.remove("hidden"));
      hits = []; cur = -1; count.textContent = "";
    }
    function run(q) {
      clear();
      if (q.length < 2) return;
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => n.parentElement.closest("button, .out, script") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      });
      const nodes = [];
      while (walker.nextNode()) if (re.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const frag = document.createDocumentFragment();
        let last = 0;
        node.nodeValue.replace(re, (m, off) => {
          frag.appendChild(document.createTextNode(node.nodeValue.slice(last, off)));
          const mk = document.createElement("mark"); mk.className = "hit"; mk.textContent = m; frag.appendChild(mk);
          last = off + m.length;
        });
        frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
        node.replaceWith(frag);
      });
      hits = $$("mark.hit", content);
      count.textContent = hits.length ? `0/${hits.length}` : "0";
      // Dim TOC entries whose section has no hits.
      tocItems.forEach((t, i) => {
        const next = tocItems[i + 1];
        const has = hits.some((m) => (t.h.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          (!next || (next.h.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_PRECEDING)));
        $(`#toc li[data-id="${CSS.escape(t.id)}"]`).classList.toggle("hidden", !has);
      });
    }
    function go(d) {
      if (!hits.length) return;
      if (hits[cur]) hits[cur].classList.remove("cur");
      cur = (cur + d + hits.length) % hits.length;
      const m = hits[cur];
      const det = m.closest("details"); if (det) det.open = true;
      m.classList.add("cur"); m.scrollIntoView({ block: "center" });
      count.textContent = `${cur + 1}/${hits.length}`;
    }
    let t;
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => run(input.value.trim()), 200); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); go(e.shiftKey ? -1 : 1); }
      if (e.key === "Escape") { input.value = ""; clear(); input.blur(); }
    });
    addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); input.focus(); }
    });
  }

  /* ---------- R in the browser (webR) ---------- */
  const R = {
    webR: null, ready: null, queue: Promise.resolve(), out: null, page: null,
    status(state, text) { const s = $("#rStatus"); s.classList.add("show"); s.dataset.state = state; $("span", s).textContent = text; },
    start() {
      if (this.ready) return this.ready;
      this.status("loading", "Starting R…");
      this.ready = (async () => {
        const { WebR } = await import(C.webrUrl);
        const webR = new WebR();
        await webR.init();
        this.webR = webR;
        await webR.evalRVoid(`
          options(device = function(...) webr::canvas(width = 520, height = 400, bg = "white"), warn = 1)
          install.packages <- function(pkgs, ...) {
            need <- pkgs[!vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)]
            if (!length(need)) return(invisible(message(paste(pkgs, collapse = ", "), " is already installed")))
            message("Installing ", paste(need, collapse = ", "), " (first time only, may take a minute)...")
            webr::install(need, quiet = TRUE)
            message("Done.")
          }
          View <- function(x, title) { print(utils::head(x, 20)); if (NROW(x) > 20) cat("... (", NROW(x), " rows in total)\\n", sep = ""); invisible(x) }
          .help_online <- function(t) { message("Help pages can't open in the browser. Read it online: https://www.rdocumentation.org/search?q=", t); invisible() }
          help <- function(topic, ...) .help_online(gsub('"', "", deparse(substitute(topic))))
          \`?\` <- function(e1, e2) .help_online(gsub('"', "", deparse(substitute(e1))))
          setwd <- function(dir) { message("setwd() is not available in the browser - staying in ", getwd()); invisible(getwd()) }
        `);
        this.readLoop();
        this.status("ready", "R ready");
      })().catch((e) => { this.status("error", "R failed to load"); this.ready = null; throw e; });
      return this.ready;
    },
    async readLoop() {
      for (;;) {
        const m = await this.webR.read();
        if (m.type !== "canvas" || !this.out) continue;
        if (m.data.event === "canvasNewPage") {
          this.page = this.newCanvas();
        } else if (m.data.event === "canvasImage") {
          // Drawing onto a plot made by an earlier block (e.g. abline after plot): copy that plot here first.
          if (!this.page || !this.out.contains(this.page)) {
            const prev = this.page;
            this.page = this.newCanvas();
            if (prev && prev.width) { this.page.width = prev.width; this.page.height = prev.height; this.page.getContext("2d").drawImage(prev, 0, 0); }
          }
          const img = m.data.image;
          if (this.page.width !== img.width) { this.page.width = img.width; this.page.height = img.height; }
          this.page.getContext("2d").drawImage(img, 0, 0);
        }
      }
    },
    newCanvas() { const c = document.createElement("canvas"); c.width = 0; c.height = 0; this.out.appendChild(c); return c; },
    line(text, cls) {
      const last = this.out.lastElementChild;
      if (last && last.tagName === "PRE" && last.className === (cls || "")) { last.textContent += "\n" + text; return; }
      const p = document.createElement("pre"); if (cls) p.className = cls; p.textContent = text; this.out.appendChild(p);
    },
    packages(code) {
      const base = new Set(["base", "stats", "graphics", "grDevices", "utils", "datasets", "methods", "tools", "grid", "parallel", "splines", "webr", "stats4", "tcltk", "BiocManager"]);
      const found = new Set();
      code.replace(/(?:library|require|requireNamespace)\(\s*["']?([A-Za-z][\w.]*)/g, (m, p) => found.add(p));
      code.replace(/\b([A-Za-z][\w.]*)::/g, (m, p) => found.add(p));
      return [...found].filter((p) => !base.has(p));
    },
    run(code, out, btn) {
      this.queue = this.queue.then(async () => {
        btn.disabled = true; btn.textContent = "Running…";
        out.innerHTML = "";
        this.out = out;
        try {
          if (!this.webR) { this.line("Starting R in your browser (first run takes a few seconds)…", "info"); await this.start(); out.innerHTML = ""; }
          const webR = this.webR;
          for (const p of this.packages(code)) {
            if (await webR.evalRBoolean(`requireNamespace("${p}", quietly = TRUE)`)) continue;
            this.line(`Installing package ${p}…`, "info");
            this.status("loading", "Installing " + p);
            await webR.installPackages([p], { quiet: true });
          }
          this.status("ready", "R ready");
          const shelter = await new webR.Shelter();
          try {
            const res = await shelter.captureR(code, { withAutoprint: true, captureStreams: true, captureConditions: true, captureGraphics: false });
            for (const o of res.output) {
              if (o.type === "stdout") this.line(o.data);
              else if (o.type === "stderr") this.line(o.data, "err");
              else {
                let msg = "";
                try { msg = await (await o.data.get("message")).toString(); } catch (e) { msg = String(o.data); }
                if (o.type === "message") this.line(msg.replace(/\n$/, ""), "info");
                else if (o.type === "warning") this.line("Warning: " + msg, "warn");
                else if (o.type === "error") this.line("Error: " + msg, "err");
              }
            }
          } finally { shelter.purge(); }
        } catch (e) {
          this.line("Error: " + (e.message || e).toString().replace(/^Error:\s*/, ""), "err");
        } finally {
          // Give late canvas messages a moment to land in this block.
          await new Promise((r) => setTimeout(r, 150));
          if (!out.childElementCount) this.line("✓ Ran with no printed output", "info");
          btn.disabled = false; btn.textContent = "▶ Run again";
        }
      });
    }
  };
})();
