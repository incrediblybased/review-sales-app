/* Review Signal: shared app script. Plain JS, no dependencies. Reads window.DATA from data.js. */
(function () {
  "use strict";
  const D = window.DATA || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const fmt = {
    n: (v) => v == null || v === "" || isNaN(v) ? "n/a" : Math.round(+v).toLocaleString("en-US"),
    d2: (v) => v == null || v === "" || isNaN(v) ? "n/a" : (+v).toFixed(2),
    d3: (v) => v == null || v === "" || isNaN(v) ? "n/a" : (+v).toFixed(3),
    sd3: (v) => v == null || v === "" || isNaN(v) ? "n/a" : ((+v >= 0 ? "+" : "") + (+v).toFixed(3)),
    pct: (v, d = 1) => v == null || v === "" || isNaN(v) ? "n/a" : ((+v) * 100).toFixed(d) + "%",
    spct: (v, d = 1) => v == null || v === "" || isNaN(v) ? "n/a" : ((+v >= 0 ? "+" : "") + ((+v) * 100).toFixed(d) + "%"),
    usd: (v) => v == null || v === "" ? "n/a" : "$" + (+v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "M",
  };
  const num = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ---------- frame: header, nav, footer, theme ---------- */
  const PAGES = [
    ["index.html", "Overview"], ["studies.html", "Studies"], ["model.html", "Model"],
    ["method.html", "Method"], ["forward.html", "Forward"],
  ];
  function frame() {
    const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    const top = document.createElement("header");
    top.className = "top";
    top.innerHTML = `<div class="inner">
      <a class="brand" href="index.html" aria-label="Review Signal home">
        Review Signal</a>
      <nav class="nav" aria-label="Pages">${PAGES.map(([h, t]) => `<a href="${h}"${h === here || (here === "" && h === "index.html") ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
      <button class="theme-btn" type="button" id="themeBtn" aria-label="Switch colour theme">Theme</button></div>`;
    document.body.prepend(top);
    const foot = document.createElement("footer");
    foot.className = "foot";
    foot.innerHTML = `<span>Personal research project. Not investment advice. Data built ${esc((D.generated_at || "").slice(0, 10))}.</span>
      <span>Reviews: Amazon Reviews 2023, Steam reviews dataset. Revenue: company reports and SEC EDGAR.</span>`;
    document.body.appendChild(foot);
    const urlTheme = new URLSearchParams(location.search).get("theme");
    const saved = urlTheme === "light" || urlTheme === "dark" ? urlTheme : (() => { try { return localStorage.getItem("rs-theme"); } catch (e) { return null; } })();
    if (saved) document.documentElement.dataset.theme = saved;
    const label = () => { $("#themeBtn").textContent = (document.documentElement.dataset.theme || "light") === "dark" ? "Light" : "Dark"; };
    label();
    $("#themeBtn").addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme || "light";
      const next = cur === "dark" ? "light" : "dark";
      const apply = () => { document.documentElement.dataset.theme = next; try { localStorage.setItem("rs-theme", next); } catch (e) {} label(); rerenderAll(); };
      if (document.startViewTransition && !reduce) document.startViewTransition(apply); else apply();
    });
  }

  /* ---------- count-up ---------- */
  function countUp(root = document) {
    $$("[data-count]", root).forEach((e) => {
      const target = parseFloat(e.dataset.count), dec = +(e.dataset.dec || 0), pre = e.dataset.pre || "", suf = e.dataset.suf || "";
      const show = (v) => (e.textContent = pre + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf);
      if (reduce || isNaN(target)) { show(target || 0); return; }
      const t0 = performance.now(), dur = 900;
      const tick = (t) => { const p = Math.min(1, (t - t0) / dur), k = 1 - Math.pow(1 - p, 3); show(target * k); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- charts ---------- */
  const registry = [];
  function rerenderAll() { registry.forEach((f) => f(false)); }
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(rerenderAll, 160); });

  function niceTicks(min, max, n = 5) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, t = [];
    for (let v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(10));
    return t;
  }

  function tooltip(box) {
    let t = $(".tip", box);
    if (!t) { t = document.createElement("div"); t.className = "tip"; box.appendChild(t); }
    return {
      show(html, x, y) {
        t.innerHTML = html; t.classList.add("on");
        const bw = box.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
        let left = x + 14; if (left + tw > bw) left = x - tw - 14; if (left < 0) left = 0;
        t.style.left = left + "px"; t.style.top = Math.max(0, y - th / 2) + "px";
      },
      hide() { t.classList.remove("on"); },
    };
  }

  /* Line/bar chart on a band x scale. opts:
     labels[], series:[{name,color,values[],dash,type:'line'|'bar',barColor(i,v)}], height, yFmt, zero, shade:Set, tip(i)->html, xEvery, yMin, yMax */
  function chart(box, opts) {
    const render = (animate = true) => {
      box.innerHTML = ""; box.classList.add("chart"); box.classList.remove("hovering");
      const W = Math.max(300, box.clientWidth), H = opts.height || 300;
      const m = { t: 12, r: opts.right || 96, b: 46, l: 52 };
      if (W < 520) m.r = 16;
      const iw = W - m.l - m.r, ih = H - m.t - m.b, n = opts.labels.length;
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "chart" }, box);
      const vals = opts.series.flatMap((s) => s.values.filter((v) => v != null && !isNaN(v)));
      if (!vals.length) { box.innerHTML = '<div class="empty">No data for this view yet.</div>'; return; }
      let lo = opts.yMin != null ? opts.yMin : Math.min(...vals), hi = opts.yMax != null ? opts.yMax : Math.max(...vals);
      if (opts.zero || opts.series.some((s) => s.type === "bar")) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      const ticks = niceTicks(lo, hi, opts.ticks || 5); lo = ticks[0]; hi = ticks[ticks.length - 1];
      const bw = iw / n, X = (i) => m.l + bw * i + bw / 2, Y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
      const g = el("g", {}, svg);
      if (opts.shade) opts.shade.forEach((i) => el("rect", { class: "shade", x: m.l + bw * i, y: m.t, width: bw, height: ih }, g));
      ticks.forEach((v) => {
        el("line", { class: v === 0 && lo < 0 ? "zero" : "grid-line", x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v) }, g);
        el("text", { class: "axis-text", x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }, g).textContent = (opts.yFmt || fmt.d2)(v);
      });
      const every = opts.xEvery || Math.max(1, Math.ceil(n / Math.max(4, Math.floor(iw / 64))));
      opts.labels.forEach((lab, i) => {
        if (i % every) return;
        const tx = el("text", { class: "axis-text", x: X(i), y: m.t + ih + 16, "text-anchor": "middle" }, g);
        tx.textContent = lab;
      });
      // bars
      opts.series.filter((s) => s.type === "bar").forEach((s, si) => {
        s.values.forEach((v, i) => {
          if (v == null || isNaN(v)) return;
          const y0 = Y(0), y1 = Y(v), w = Math.max(1.5, bw * (opts.barWidth || 0.68));
          const r = el("rect", { class: "bar" + (animate && !reduce ? " grow" : ""), "data-i": i, x: X(i) - w / 2, y: Math.min(y0, y1), width: w, height: Math.max(1, Math.abs(y1 - y0)), rx: Math.min(3, w / 3), fill: s.barColor ? s.barColor(i, v) : s.color }, g);
          r.style.transformOrigin = v >= 0 ? "center bottom" : "center top";
          if (animate && !reduce) r.style.animationDelay = Math.min(600, i * 8) + "ms";
        });
      });
      // lines
      const usedY = [];
      opts.series.filter((s) => s.type !== "bar").forEach((s) => {
        let d = "", pen = false, last = null;
        s.values.forEach((v, i) => {
          if (v == null || isNaN(v)) { pen = false; return; }
          d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); pen = true; last = i;
        });
        if (!d) return;
        const p = el("path", { d, fill: "none", stroke: s.color, "stroke-width": s.width || 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
        if (s.dash) p.setAttribute("stroke-dasharray", "5 4");
        else if (animate && !reduce) { const L = p.getTotalLength(); p.style.setProperty("--len", L); p.classList.add("draw"); }
        if (last != null && W >= 520) {
          let ly = Y(s.values[last]) + 4;
          for (const u of usedY) if (Math.abs(u - ly) < 13) ly = u + (ly >= u ? 13 : -13);
          usedY.push(ly);
          const t = el("text", { class: "end-label", x: X(last) + 8, y: ly }, g);
          t.textContent = s.name;
        }
      });
      // hover
      const xh = el("line", { class: "xhair", y1: m.t, y2: m.t + ih }, g);
      const dots = opts.series.filter((s) => s.type !== "bar").map((s) => el("circle", { class: "dot", r: 4.5, fill: s.color, opacity: 0 }, g));
      const hit = el("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, svg);
      const tip = tooltip(box);
      const move = (ev) => {
        const pt = svg.getBoundingClientRect(), sx = (ev.clientX - pt.left) * (W / pt.width);
        const i = Math.max(0, Math.min(n - 1, Math.floor((sx - m.l) / bw)));
        box.classList.add("hovering");
        xh.setAttribute("x1", X(i)); xh.setAttribute("x2", X(i));
        $$("rect.bar", svg).forEach((r) => r.classList.toggle("hot", +r.dataset.i === i));
        opts.series.filter((s) => s.type !== "bar").forEach((s, k) => {
          const v = s.values[i];
          if (v == null || isNaN(v)) dots[k].setAttribute("opacity", 0);
          else { dots[k].setAttribute("cx", X(i)); dots[k].setAttribute("cy", Y(v)); dots[k].setAttribute("opacity", 1); }
        });
        const rows = opts.series.map((s) => `<div class="row"><span><i class="sw" style="background:${s.barColor ? s.barColor(i, s.values[i]) : s.color}"></i>${esc(s.name)}</span><b>${(s.fmt || opts.yFmt || fmt.d2)(s.values[i])}</b></div>`).join("");
        const extra = opts.tip ? opts.tip(i) : "";
        tip.show(`<b>${esc(opts.labels[i])}</b>${rows}${extra}`, (X(i) / W) * box.clientWidth, (ev.clientY - pt.top));
      };
      hit.addEventListener("mousemove", move);
      hit.addEventListener("touchstart", (e) => move(e.touches[0]), { passive: true });
      hit.addEventListener("mouseleave", () => { box.classList.remove("hovering"); tip.hide(); dots.forEach((d) => d.setAttribute("opacity", 0)); $$("rect.bar", svg).forEach((r) => r.classList.remove("hot")); });
    };
    registry.push(render);
    render(true);
    return render;
  }

  /* ---------- tables ---------- */
  function table(host, cfg) {
    let rows = cfg.rows.slice(), sortKey = cfg.sort || null, dir = cfg.dir || -1, q = "", page = 0;
    const size = cfg.pageSize || 25;
    host.innerHTML = `<div class="controls">${cfg.search !== false ? `<input type="search" placeholder="${esc(cfg.placeholder || "Search")}" aria-label="Search table">` : ""}
      ${cfg.filters || ""}<span style="flex:1"></span><button class="btn" type="button" data-csv>Download CSV</button></div>
      <div class="table-wrap"><table><thead><tr>${cfg.columns.map((c) => `<th scope="col" data-k="${c.key}" class="${c.num ? "num" : ""}">${esc(c.label)}</th>`).join("")}</tr></thead><tbody></tbody></table></div>
      <div class="table-foot"><span data-count-label></span><span><button class="btn" data-prev type="button">Previous</button> <button class="btn" data-next type="button">Next</button></span></div>`;
    const tb = $("tbody", host);
    const filtered = () => {
      let r = cfg.filter ? rows.filter(cfg.filter) : rows;
      if (q) r = r.filter((x) => cfg.columns.some((c) => String(x[c.key] ?? "").toLowerCase().includes(q)));
      if (sortKey) {
        const c = cfg.columns.find((c) => c.key === sortKey);
        r = r.slice().sort((a, b) => {
          const va = c.num ? num(a[sortKey]) : String(a[sortKey] ?? ""), vb = c.num ? num(b[sortKey]) : String(b[sortKey] ?? "");
          if (va == null) return 1; if (vb == null) return -1;
          return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
        });
      }
      return r;
    };
    const draw = () => {
      const r = filtered(), pages = Math.max(1, Math.ceil(r.length / size)); page = Math.min(page, pages - 1);
      tb.innerHTML = r.slice(page * size, page * size + size).map((x) => `<tr>${cfg.columns.map((c) => `<td class="${c.num ? "num" : ""}${c.wrap ? " wrap" : ""}">${c.html ? c.html(x) : esc(c.fmt ? c.fmt(x[c.key], x) : x[c.key])}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cfg.columns.length}" class="empty">No rows match.</td></tr>`;
      $("[data-count-label]", host).textContent = `${r.length.toLocaleString()} rows${pages > 1 ? `, page ${page + 1} of ${pages}` : ""}`;
      $("[data-prev]", host).disabled = page === 0; $("[data-next]", host).disabled = page >= pages - 1;
      $$("th", host).forEach((th) => th.setAttribute("aria-sort", th.dataset.k === sortKey ? (dir > 0 ? "ascending" : "descending") : "none"));
    };
    $$("th", host).forEach((th) => th.addEventListener("click", () => { dir = sortKey === th.dataset.k ? -dir : -1; sortKey = th.dataset.k; draw(); }));
    const s = $('input[type="search"]', host); if (s) s.addEventListener("input", () => { q = s.value.trim().toLowerCase(); page = 0; draw(); });
    $("[data-prev]", host).addEventListener("click", () => { page--; draw(); });
    $("[data-next]", host).addEventListener("click", () => { page++; draw(); });
    $("[data-csv]", host).addEventListener("click", () => {
      const r = filtered(), cols = cfg.columns.map((c) => c.key);
      const csv = [cols.join(",")].concat(r.map((x) => cols.map((k) => `"${String(x[k] ?? "").replace(/"/g, '""')}"`).join(","))).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = (cfg.name || "table") + ".csv"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    draw();
    return { redraw: draw, setFilter(f) { cfg.filter = f; page = 0; draw(); } };
  }

  function seg(host, options, initial, onChange) {
    host.classList.add("seg"); host.setAttribute("role", "group");
    host.innerHTML = options.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${v === initial}">${esc(t)}</button>`).join("");
    $$("button", host).forEach((b) => b.addEventListener("click", () => {
      $$("button", host).forEach((x) => x.setAttribute("aria-pressed", x === b)); onChange(b.dataset.v);
    }));
  }

  const pages = {};

  /* ---------- project data ---------- */
  const ST = D.studies || {}, NM = D.names || {};
  const nm = (c) => NM[c] || c;
  const P = (D.predictions || []).map((r) => { const o = { ...r }; for (const k in o) if (k !== "company_id" && k !== "quarter") o[k] = num(o[k]); return o; });
  const MR = D.model_report || {};
  const pct0 = (v) => v == null ? "n/a" : Math.round(v * 100) + "%";
  const lgPct = (v) => v == null || isNaN(v) ? "n/a" : ((Math.exp(v) - 1) >= 0 ? "+" : "") + ((Math.exp(v) - 1) * 100).toFixed(1) + "%";
  const pts = (v) => v == null ? "n/a" : (v * 100).toFixed(1) + " pts";

  function studyRows() {
    const L = ST.logitech && ST.logitech.summary, A = ST.aerogrow, Pd = ST.paradox, N = ST.nowcast, H = ST.halfyear;
    const r = [];
    if (L && L.primary) r.push({ id: "1", name: "Logitech", plat: "Amazon", q: "Does review tone predict next quarter's sales direction?", n: L.primary.eligible + " quarters",
      sig: pct0(L.primary.hit_rate) + " right", base: pct0(L.baselines.persistence.hit_rate) + " right", ok: false });
    if (A && A.tone) r.push({ id: "2", name: "AeroGrow (AeroGarden)", plat: "Amazon", q: "Same, for a brand selling about half through Amazon", n: A.tone.n + " quarters",
      sig: pct0(A.tone.hit_rate) + " right", base: pct0(A.tone.baselines_same_rows.persistence.hit_rate) + " right", ok: A.verdict && A.verdict.usable_signal });
    if (Pd && Pd.tone) r.push({ id: "3", name: "Paradox Interactive", plat: "Steam", q: "Same, where the review site is the store", n: Pd.tone.n + " quarters",
      sig: pct0(Pd.tone.hit_rate) + " right", base: pct0(Pd.tone.baselines_same_rows.always_positive.hit_rate) + " right", ok: Pd.verdict && Pd.verdict.usable_signal });
    if (N && N.primary_leave_one_company_out) { const s = N.primary_leave_one_company_out.score_mean_company_MAE;
      r.push({ id: "4", name: "13 game publishers", plat: "Steam", q: "Do review counts estimate this quarter's sales growth before results day?", n: N.primary_leave_one_company_out.rows + " company-quarters",
        sig: pts(s.M) + " avg miss", base: pts(s.B1) + " avg miss", ok: N.success_criterion && N.success_criterion.useful }); }
    if (MR.results) r.push({ id: "5", name: "Sales prediction model", plat: "Steam", q: "Can all signals together (reviews, launches, past growth) beat the simple rule?", n: MR.rows + " company-quarters",
      sig: pts(MR.results[MR.chosen_model].loco_mean_company_MAE) + " avg miss", base: pts(MR.results.B1_last_growth.loco_mean_company_MAE) + " avg miss", ok: false, explor: true });
    if (H && H.status === "underpowered") r.push({ id: "6", name: "Half-year PC publishers", plat: "Steam", q: "Do reviews work for PC-focused publishers (new companies)?", n: "too few half-years", sig: "not run", base: "not run", ok: false, under: true });
    if (H && H.primary_leave_one_company_out) { const s = H.primary_leave_one_company_out.score_mean_company_MAE;
      r.push({ id: "6", name: "Half-year PC publishers", plat: "Steam", q: "Do reviews work for PC-focused publishers (new companies)?", n: H.primary_leave_one_company_out.rows + " company-halves",
        sig: pts(s.M) + " avg miss", base: pts(s.B1) + " avg miss", ok: H.success_criterion && H.success_criterion.useful }); }
    return r;
  }

  Object.assign(pages, {
    index() {
      const rows = studyRows(), wins = rows.filter((r) => r.ok).length, tested = rows.filter((r) => !r.under).length;
      $("#answer").innerHTML = `<div class="bar neg"></div><div><span class="eyebrow">The answer so far</span><h2 style="margin-top:6px">${wins ? "Mixed: some studies passed" : "No. Reviews did not beat simple rules in any study."}</h2>
        <p class="ink2">Across ${tested} completed tests, the best predictor of a company's sales growth was its own recent growth. Reviews track sales loosely (strongest for PC-focused game publishers), but adding them did not make estimates more accurate on companies the model had not seen.</p></div>`;
      $("#stats").innerHTML = [["Studies", rows.length], ["Companies tested", 16], ["Reviews analysed (M)", 32], ["Passed the frozen test", wins]]
        .map(([k, v]) => `<div class="panel stat"><span class="label">${k}</span><span class="value" data-count="${v}">${v}</span></div>`).join("");
      $("#studyCards").innerHTML = `<div class="table-wrap studies"><table><thead><tr><th>Study</th><th>Question</th><th class="num">Data</th><th class="num">With reviews</th><th class="num">Simple rule</th><th>Verdict</th></tr></thead><tbody>${rows.map((r) =>
        `<tr><td><b>${esc(r.name)}</b><br><span class="small muted">Study ${r.id}, ${r.plat}${r.explor ? ", exploratory" : ""}</span></td><td class="wrap small">${esc(r.q)}</td><td class="num">${esc(r.n)}</td><td class="num">${esc(r.sig)}</td><td class="num">${esc(r.base)}</td><td>${r.under ? "underpowered" : r.ok ? "signal" : "no usable signal"}</td></tr>`).join("")}</tbody></table></div>`;
      countUp();
    },
    studies() {
      const N = ST.nowcast;
      if (N) {
        const pc = N.primary_leave_one_company_out.per_company_MAE, cor = N.secondary.per_company_corr_x_y, el_ = N.minimum_data.eligible_quarters_per_company;
        const rows = Object.keys(pc).map((c) => ({ company: nm(c), quarters: el_[c], with_reviews: pc[c].M, without: pc[c].B1, better: pc[c].M < pc[c].B1 ? "yes" : "no", corr: cor[c] }));
        table($("#ncTable"), { name: "nowcast_by_company", rows, sort: "corr", dir: -1, search: false, pageSize: 20, columns: [
          { key: "company", label: "Company" }, { key: "quarters", label: "Quarters", num: true },
          { key: "with_reviews", label: "Avg miss with reviews", num: true, fmt: pts }, { key: "without", label: "Avg miss without", num: true, fmt: pts },
          { key: "better", label: "Reviews helped" }, { key: "corr", label: "Correlation (reviews, sales)", num: true, fmt: fmt.d2 }] });
        const crit = N.success_criterion;
        $("#ncCrit").innerHTML = `<dl class="kv"><dt>Beats both simple rules</dt><dd>${crit["1_beats_B0_and_B1"] ? "yes" : "no"}</dd>
          <dt>Statistically reliable (p &lt; 0.05)</dt><dd>${crit["2_bootstrap_p_lt_0.05"] ? "yes" : "no"} (p = ${N.primary_leave_one_company_out.bootstrap_p_M_vs_B1})</dd>
          <dt>Better in most companies</dt><dd>${crit["3_better_in_more_than_half"] ? "yes" : "no"} (${N.primary_leave_one_company_out.M_better_than_B1_in_companies})</dd></dl>`;
      }
      const H = ST.halfyear;
      $("#hyBox").innerHTML = H && H.status === "underpowered" ? `<p><span class="pill na">underpowered</span></p><p class="ink2 small">${esc(H.reason)}</p><p class="ink2 small">${esc(H.what_happens_next)}</p>` : H ? `<dl class="kv"><dt>Company-halves</dt><dd>${H.primary_leave_one_company_out.rows}</dd>
          <dt>Avg miss with reviews</dt><dd>${pts(H.primary_leave_one_company_out.score_mean_company_MAE.M)}</dd>
          <dt>Avg miss without</dt><dd>${pts(H.primary_leave_one_company_out.score_mean_company_MAE.B1)}</dd>
          <dt>Verdict</dt><dd>${H.success_criterion.useful ? "signal" : "no usable signal"}</dd></dl>` : '<p class="muted">Running now. This panel fills in when the half-year study finishes.</p>';
    },
    model() {
      const comps = [...new Set(P.map((r) => r.company_id))];
      const sel = $("#company"); sel.innerHTML = comps.map((c) => `<option value="${c}">${esc(nm(c))}</option>`).join("");
      const best = MR.chosen_model || "ridge";
      const draw = () => {
        const c = sel.value, rs = P.filter((r) => r.company_id === c);
        chart($("#modelChart"), { aria: "Actual and estimated sales growth", labels: rs.map((r) => r.quarter), yFmt: (v) => Math.round((Math.exp(v) - 1) * 100) + "%", zero: true, height: 320,
          series: [{ name: "Actual", type: "bar", values: rs.map((r) => r.actual_y), color: css("--line-strong"), fmt: lgPct },
                   { name: "Model", values: rs.map((r) => r[best]), color: css("--s1"), fmt: lgPct },
                   { name: "Simple rule", values: rs.map((r) => r.B1_last_growth), color: css("--s2"), dash: true, fmt: lgPct }] });
        const errM = rs.reduce((a, r) => a + Math.abs(r[best] - r.actual_y), 0) / rs.length, errB = rs.reduce((a, r) => a + Math.abs(r.B1_last_growth - r.actual_y), 0) / rs.length;
        $("#modelNote").innerHTML = `${esc(nm(c))}: average miss <b>${pts(errM)}</b> for the model and <b>${pts(errB)}</b> for the simple rule (${rs.length} quarters, each estimated by a model that never saw this company).`;
        const q = $("#quarter"); q.innerHTML = rs.map((r) => `<option>${r.quarter}</option>`).reverse().join(""); explain();
      };
      const explain = () => {
        const r = P.find((x) => x.company_id === sel.value && x.quarter === $("#quarter").value); if (!r) return;
        const lab = { y_prev: "Last published sales growth", y_lag4: "Sales growth a year earlier", x_reviews: "Steam review growth", x_new_reviews: "Growth in reviews of new games",
          x_launches: "Change in number of launches", d_rec: "Change in share recommending", pandemic: "Pandemic quarter" };
        $("#explain").innerHTML = `<div class="table-wrap"><table><thead><tr><th>Input</th><th class="num">Value</th></tr></thead><tbody>${Object.keys(lab).map((k) =>
          `<tr><td>${lab[k]}</td><td class="num">${k === "pandemic" ? (r[k] ? "yes" : "no") : k === "d_rec" ? fmt.sd3(r[k]) : lgPct(r[k])}</td></tr>`).join("")}</tbody></table></div>
          <dl class="kv" style="margin-top:var(--sp-4)"><dt>Model estimate</dt><dd>${lgPct(r[best])}</dd><dt>Simple rule</dt><dd>${lgPct(r.B1_last_growth)}</dd><dt>Actual (reported later)</dt><dd><b>${lgPct(r.actual_y)}</b></dd></dl>`;
      };
      sel.addEventListener("change", draw); $("#quarter").addEventListener("change", explain); draw();
      const R = MR.results || {};
      $("#modelScores").innerHTML = `<div class="table-wrap"><table><thead><tr><th>Approach</th><th class="num">Avg miss</th><th class="num">Direction</th><th class="num">2020-23 test</th></tr></thead><tbody>${
        [["ridge", "Model: linear (ridge)"], ["boosted_trees", "Model: boosted trees"], ["B1_last_growth", "Simple rule: last growth (fitted)"], ["B0_persistence", "Simple rule: last growth as is"]]
          .filter(([k]) => R[k]).map(([k, t]) => `<tr><td>${t}</td><td class="num">${pts(R[k].loco_mean_company_MAE)}</td><td class="num">${pct0(R[k].loco_direction_hit)}</td><td class="num">${pts(R[k].time_split_MAE)}</td></tr>`).join("")}</tbody></table></div>`;
    },
    method() { $("#universe").textContent = D.universe || ""; },
    forward() {
      const runs = (D.forward && D.forward.runs) || [];
      $("#fwdRuns").innerHTML = runs.length ? `<ul class="list">${runs.map((r) => `<li class="mono small">${esc(r)}</li>`).join("")}</ul>` : '<p class="muted">No weekly snapshots yet. The first scheduled run is Sunday 15 November 2026, 11:00, if the PC is on.</p>';
    },
  });

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", () => { frame(); const p = document.body.dataset.page; if (pages[p]) pages[p](); });
  window.RS = { table, chart, fmt };
})();
