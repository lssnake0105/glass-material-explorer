const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const INPUTS = [
  { file: "CDGM-ZEMAX202409.txt", library: "CDGM" },
  { file: "NHG202501.txt", library: "NHG" },
  { file: "PLASTIC2020.txt", library: "PLASTIC" },
];

function toNumber(value) {
  if (value === undefined || value === null || value === "?") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseName(name) {
  let rest = name;
  const out = {
    prefix: "",
    family: "",
    number: "",
    suffix: "",
    dashMark: "",
    atMark: "",
    star: false,
    baseName: name,
  };

  if (rest.endsWith("*")) {
    out.star = true;
    rest = rest.slice(0, -1);
  }
  const at = rest.match(/@([A-Za-z0-9_]+)$/);
  if (at) {
    out.atMark = at[1];
    rest = rest.slice(0, at.index);
  }
  const dash = rest.match(/-(\d+)$/);
  if (dash) {
    out.dashMark = dash[1];
    rest = rest.slice(0, dash.index);
  }
  const pref = rest.match(/^(H|D|S|L)-/);
  if (pref) {
    out.prefix = pref[1];
    rest = rest.slice(pref[0].length);
  }

  const sp = rest.match(/^SP-(\d+)([A-Z]*)$/);
  if (sp) {
    out.family = "SP";
    out.number = sp[1];
    out.suffix = sp[2] || "";
  } else if (/^\d+[A-Z]+$/.test(rest)) {
    const m = rest.match(/^(\d+)([A-Z]+)$/);
    out.family = "COP";
    out.number = m[1];
    out.suffix = m[2];
  } else {
    const m = rest.match(/^([A-Z]+)(\d*)([A-Z]*)$/);
    if (m) {
      out.family = m[1] || "";
      out.number = m[2] || "";
      out.suffix = m[3] || "";
    } else {
      out.family = rest.replace(/[^A-Z]/g, "");
    }
  }

  out.baseName = [out.family, out.number, out.suffix]
    .filter(Boolean)
    .join("")
    .replace(/(GT|TT)$/g, "");
  return out;
}

function materialClass(library, parsed, nd) {
  if (library === "PLASTIC") return "plastic";
  if (parsed.family === "IRG" || parsed.family === "HWS" || !nd || nd <= 0) return "infrared";
  return "glass";
}

function suffixText(parsed) {
  const parts = [];
  if (parsed.suffix) parts.push(parsed.suffix);
  if (parsed.dashMark) parts.push("-" + parsed.dashMark);
  if (parsed.atMark) parts.push("@" + parsed.atMark);
  if (parsed.star) parts.push("*");
  return parts.join("");
}

function autoTags(m) {
  const tags = new Set();
  tags.add("库:" + m.library);
  tags.add(m.class === "glass" ? "玻璃" : m.class === "plastic" ? "塑料" : "红外材料");
  if (m.prefix) tags.add("前缀:" + m.prefix);
  if (m.family) tags.add("族:" + m.family);
  if (m.suffix) tags.add("后缀:" + m.suffix);
  if (m.dashMark) tags.add("标记:-" + m.dashMark);
  if (m.atMark) tags.add("标记:@" + m.atMark);
  if (m.star) tags.add("标记:*");
  if (m.prefix === "D") tags.add("模压候选");
  if (/(GT|TT)/.test(m.suffix)) tags.add("高透");
  if (m.suffix.includes("TT")) tags.add("超高透");
  if (m.family === "IRG" || m.family === "HWS") tags.add("红外");
  if (m.library === "PLASTIC") tags.add("注塑候选");
  if (m.nd !== null) {
    if (m.nd >= 1.9) tags.add("超高折射");
    else if (m.nd >= 1.75) tags.add("高折射");
    else if (m.nd >= 1.6) tags.add("中高折射");
    else if (m.nd <= 1.5 && m.nd > 0) tags.add("低折射");
  }
  if (m.vd !== null) {
    if (m.vd >= 85) tags.add("超低色散");
    else if (m.vd >= 70) tags.add("低色散");
    if (m.vd <= 25 && m.vd > 0) tags.add("强色散");
    else if (m.vd <= 35 && m.vd > 0) tags.add("低阿贝");
  }
  if (/^(FK|PK|QK|K|ZK|LAK|ZPK)$/.test(m.family)) tags.add("冠牌倾向");
  if (/^(F|QF|ZF|LAF|ZLAF|BAF|ZBAF|BIF)$/.test(m.family)) tags.add("火石倾向");
  if (/^(LAK|LAF|ZLAF)$/.test(m.family)) tags.add("镧系");
  return Array.from(tags).sort();
}

function parseFile(input, startId) {
  const full = path.join(ROOT, input.file);
  const text = fs.readFileSync(full, "utf8");
  const rows = [];
  let id = startId;
  for (const line of text.split(/\r?\n/)) {
    const p = line.trim().split(/\s+/).filter(Boolean);
    if (p.length < 6) continue;
    const nd = toNumber(p[2]);
    const vd = toNumber(p[3]);
    if (nd === null || vd === null) continue;
    const parsed = parseName(p[0]);
    const m = {
      id: id++,
      library: input.library,
      sourceFile: input.file,
      name: p[0],
      status: p[1] || "",
      nd,
      vd,
      dpgf: toNumber(p[4]),
      density: toNumber(p[5]),
      melt: toNumber(p[6]),
      cost: toNumber(p[7]),
      cr: toNumber(p[8]),
      fr: toNumber(p[9]),
      sr: toNumber(p[10]),
      ar: toNumber(p[11]),
      pr: toNumber(p[12]),
      waveMin: toNumber(p[13]),
      waveMax: toNumber(p[14]),
      tce: toNumber(p[15]),
      d0: toNumber(p[16]),
      d1: toNumber(p[17]),
      d2: toNumber(p[18]),
      e0: toNumber(p[19]),
      e1: toNumber(p[20]),
      ltk: toNumber(p[21]),
      formula: p[22] || "",
      prefix: parsed.prefix,
      family: parsed.family,
      number: parsed.number,
      suffix: parsed.suffix,
      dashMark: parsed.dashMark,
      atMark: parsed.atMark,
      star: parsed.star,
      baseName: parsed.baseName,
    };
    m.class = materialClass(input.library, parsed, nd);
    m.suffixText = suffixText(parsed);
    m.autoTags = autoTags(m);
    rows.push(m);
  }
  return rows;
}

let materials = [];
for (const input of INPUTS) {
  materials = materials.concat(parseFile(input, materials.length));
}

const counts = materials.reduce((acc, m) => {
  acc[m.library] = (acc[m.library] || 0) + 1;
  return acc;
}, {});

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>玻璃材料替代查询与 Nd-Vd 图</title>
  <style>
    :root {
      --bg: #f6f8fb;
      --panel: #ffffff;
      --ink: #17202a;
      --muted: #687384;
      --line: #d8e0e8;
      --blue: #1c5d86;
      --blue-2: #2a7dae;
      --green: #14705d;
      --amber: #9a650e;
      --red: #b3263b;
      --violet: #6f4ab3;
      --shadow: 0 10px 26px rgba(23, 32, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.45;
      overflow-x: hidden;
    }
    header {
      min-height: 88px;
      padding: 20px 28px 18px;
      color: white;
      background: linear-gradient(120deg, #16384f, #1c5d86 62%, #24715f);
    }
    header h1 {
      margin: 0 0 8px;
      font-size: clamp(24px, 3vw, 36px);
      letter-spacing: 0;
      line-height: 1.16;
    }
    header p {
      margin: 0;
      color: #e5eef4;
      max-width: 1100px;
      font-size: 14px;
    }
    .top-links {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .top-links a {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 6px 10px;
      border: 1px solid rgba(255,255,255,0.42);
      border-radius: 6px;
      color: white;
      text-decoration: none;
      background: rgba(255,255,255,0.1);
    }
    .top-links a:hover {
      background: rgba(255,255,255,0.18);
    }
    .app {
      display: grid;
      grid-template-columns: minmax(260px, 330px) minmax(540px, 1fr) minmax(320px, 410px);
      gap: 16px;
      padding: 16px;
      max-width: 100%;
      min-width: 0;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      min-width: 0;
      overflow: hidden;
    }
    .panel h2 {
      margin: 0;
      padding: 13px 14px 10px;
      font-size: 16px;
      letter-spacing: 0;
      border-bottom: 1px solid var(--line);
    }
    .panel-body { padding: 12px 14px 14px; }
    label { font-size: 13px; color: var(--ink); }
    input, select, button, textarea {
      font: inherit;
      border: 1px solid #c9d2dc;
      border-radius: 6px;
      background: white;
      color: var(--ink);
      min-width: 0;
      max-width: 100%;
    }
    input, select { height: 34px; padding: 5px 8px; }
    textarea { width: 100%; min-height: 78px; padding: 8px; resize: vertical; }
    button {
      min-height: 34px;
      padding: 6px 10px;
      cursor: pointer;
      background: #edf4f8;
      color: #14384f;
      border-color: #b8ccda;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    button.primary {
      color: white;
      background: var(--blue);
      border-color: var(--blue);
    }
    button.warn {
      color: white;
      background: var(--red);
      border-color: var(--red);
    }
    .stack { display: grid; gap: 12px; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .row > input, .row > select { flex: 1 1 118px; }
    .row > button { flex: 0 1 auto; }
    .row.tight { gap: 5px; }
    .search-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(68px, max-content);
      gap: 8px;
      margin-bottom: 8px;
    }
    .search-row input { width: 100%; }
    .hint { color: var(--muted); font-size: 12px; }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
      gap: 8px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px;
      background: #fbfdff;
    }
    .metric strong { display: block; color: var(--blue); font-size: 19px; line-height: 1.15; }
    .metric span { color: var(--muted); font-size: 11px; }
    .checkbox-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 5px 8px;
      max-height: 164px;
      overflow: auto;
      padding-right: 4px;
    }
    .checkbox-grid label, .checkline {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      overflow-wrap: anywhere;
    }
    input[type="checkbox"] { width: 14px; height: 14px; flex: 0 0 auto; }
    .range-grid {
      display: grid;
      grid-template-columns: 44px 1fr 1fr;
      gap: 6px;
      align-items: center;
      margin-bottom: 6px;
    }
    .range-grid input { width: 100%; min-width: 0; }
    .chart-wrap {
      position: relative;
      padding: 10px 12px 12px;
    }
    canvas {
      display: block;
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
    }
    #mainPlot { height: 560px; }
    #slicePlot { height: 255px; }
    .chart-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .legend { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; font-size: 12px; color: var(--muted); }
    .swatch { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 4px; }
    .tooltip {
      position: fixed;
      z-index: 20;
      pointer-events: none;
      background: rgba(20, 30, 40, 0.94);
      color: white;
      border-radius: 6px;
      padding: 7px 9px;
      font-size: 12px;
      display: none;
      max-width: 280px;
      box-shadow: var(--shadow);
    }
    .material-title {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: start;
      margin-bottom: 8px;
    }
    .material-title strong { font-size: 20px; color: var(--blue); line-height: 1.2; overflow-wrap: anywhere; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 22px;
      padding: 2px 7px;
      border-radius: 999px;
      background: #eef4f8;
      color: #24506c;
      font-size: 12px;
      border: 1px solid #d5e1e8;
      white-space: nowrap;
    }
    .badge.green { background: #e8f5f1; color: var(--green); border-color: #bfddd4; }
    .badge.amber { background: #fff5df; color: var(--amber); border-color: #ead3a6; }
    .badge.red { background: #fff0f2; color: var(--red); border-color: #efc2ca; }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
      margin: 9px 0 10px;
      font-size: 13px;
    }
    .detail-grid div {
      background: #fbfdff;
      border: 1px solid var(--line);
      border-radius: 7px;
      padding: 7px;
      min-width: 0;
    }
    .detail-grid span { display: block; color: var(--muted); font-size: 11px; }
    .tag-list { display: flex; gap: 5px; flex-wrap: wrap; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      background: white;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 6px 7px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: #345;
      background: #eef4f8;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    tr.clickable { cursor: pointer; }
    tr.clickable:hover { background: #f2f8fb; }
    .table-wrap {
      max-height: 310px;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .custom-rule {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 7px;
      padding: 7px;
      background: #fbfdff;
      margin-top: 6px;
      font-size: 12px;
    }
    .section-label {
      margin: 2px 0 6px;
      font-size: 12px;
      color: var(--muted);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .split {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
    }
    .empty {
      color: var(--muted);
      padding: 12px;
      border: 1px dashed #c9d2dc;
      border-radius: 8px;
      background: #fbfdff;
      font-size: 13px;
    }
    @media (max-width: 1280px) {
      .app { grid-template-columns: minmax(240px, 300px) minmax(0, 1fr); }
      .right-col { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    }
    @media (max-width: 860px) {
      .app { grid-template-columns: 1fr; padding: 10px; }
      .right-col { display: block; }
      #mainPlot { height: 430px; }
      .metric-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
    }
    @media (max-width: 430px) {
      header { padding-left: 18px; padding-right: 18px; }
      .search-row { grid-template-columns: 1fr; }
      .split { grid-template-columns: 1fr; }
      .range-grid { grid-template-columns: 1fr 1fr; }
      .range-grid label { grid-column: 1 / -1; }
    }
  </style>
</head>
<body>
  <header>
    <h1>玻璃材料替代查询与 Nd-Vd 图</h1>
    <p>离线静态工具。支持 CDGM、NHG、PLASTIC 三个材料库的材料搜索、库/tag/数值筛选、Nd-Vd 可视化、局部切片和综合相近替代初筛。</p>
    <div class="top-links">
      <a href="./naming-guide/">材料命名解读</a>
      <a href="./material_naming_guide.html">本地命名文档</a>
    </div>
  </header>

  <div class="app">
    <aside class="panel">
      <h2>查询与筛选</h2>
      <div class="panel-body stack">
        <div>
          <div class="search-row">
            <input id="searchInput" list="materialNames" placeholder="搜索材料名，例如 H-K9L / OKP4">
            <button id="searchButton" class="primary">高光</button>
          </div>
          <datalist id="materialNames"></datalist>
          <div class="row tight">
            <button id="clearSelection">清除高光</button>
            <button id="resetFilters">重置筛选</button>
          </div>
        </div>

        <div class="metric-grid">
          <div class="metric"><strong id="totalCount">0</strong><span>全部材料</span></div>
          <div class="metric"><strong id="visibleCount">0</strong><span>当前筛选</span></div>
          <div class="metric"><strong id="neighborCount">0</strong><span>相近候选</span></div>
        </div>

        <div>
          <div class="section-label">材料库</div>
          <div id="libraryFilters" class="checkbox-grid"></div>
          <label class="checkline" style="margin-top:8px;">
            <input type="checkbox" id="showInfrared"> 显示 IRG/HWS 红外材料
          </label>
        </div>

        <div>
          <div class="section-label">数值范围</div>
          <div class="range-grid"><label>Nd</label><input id="ndMin" type="number" step="0.001" placeholder="min"><input id="ndMax" type="number" step="0.001" placeholder="max"></div>
          <div class="range-grid"><label>Vd</label><input id="vdMin" type="number" step="0.1" placeholder="min"><input id="vdMax" type="number" step="0.1" placeholder="max"></div>
          <div class="range-grid"><label>dPgF</label><input id="dpgfMin" type="number" step="0.001" placeholder="min"><input id="dpgfMax" type="number" step="0.001" placeholder="max"></div>
          <div class="range-grid"><label>密度</label><input id="densityMin" type="number" step="0.01" placeholder="min"><input id="densityMax" type="number" step="0.01" placeholder="max"></div>
        </div>

        <div>
          <div class="section-label">材料族</div>
          <div id="familyFilters" class="checkbox-grid"></div>
        </div>

        <div>
          <div class="section-label">Tag</div>
          <input id="tagSearch" placeholder="过滤 tag 列表" style="width:100%; margin-bottom:7px;">
          <div id="tagFilters" class="checkbox-grid"></div>
        </div>

        <div>
          <div class="section-label">自定义 Tag</div>
          <div class="split">
            <input id="customTagName" placeholder="tag 名称">
            <select id="customTagMode">
              <option value="contains">名称包含</option>
              <option value="starts">名称开头</option>
              <option value="family">材料族等于</option>
              <option value="prefix">前缀等于</option>
              <option value="regex">正则匹配名称</option>
              <option value="selected">当前选中材料</option>
            </select>
          </div>
          <div class="row" style="margin-top:7px;">
            <input id="customTagPattern" placeholder="匹配内容，例如 K9 或 ^H-ZF" style="flex:1; min-width:120px;">
            <button id="addCustomTag">添加</button>
          </div>
          <div class="row tight" style="margin-top:7px;">
            <button id="exportTags">导出</button>
            <button id="importTags">导入</button>
            <button id="clearTags" class="warn">清空</button>
          </div>
          <textarea id="customTagJson" placeholder="自定义 tag JSON 导入/导出区"></textarea>
          <div id="customRuleList"></div>
        </div>
      </div>
    </aside>

    <main class="panel">
      <h2>Nd-Vd 主图</h2>
      <div class="chart-wrap">
        <div class="chart-toolbar">
          <div class="legend">
            <span><i class="swatch" style="background:#2563eb"></i>CDGM</span>
            <span><i class="swatch" style="background:#0f766e"></i>NHG</span>
            <span><i class="swatch" style="background:#d97706"></i>PLASTIC</span>
            <span><i class="swatch" style="background:#b3263b"></i>选中</span>
          </div>
          <div class="row tight">
            <button id="fitPlot">适应窗口</button>
            <button id="zoomSlice">聚焦选中</button>
          </div>
        </div>
        <canvas id="mainPlot"></canvas>
        <div class="hint" style="margin-top:7px;">滚轮缩放，拖拽平移，点击点选材料。总览只标注选中材料和最近邻，避免密集区域互相遮挡。</div>
      </div>

      <h2>筛选结果表</h2>
      <div class="panel-body">
        <div class="row" style="justify-content:space-between; margin-bottom:8px;">
          <span class="hint" id="tableHint">显示前 250 条</span>
          <button id="downloadFiltered">导出当前 CSV</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>库</th><th>材料</th><th>Nd</th><th>Vd</th><th>dPgF</th><th>密度</th><th>标签</th></tr></thead>
            <tbody id="materialTable"></tbody>
          </table>
        </div>
      </div>
    </main>

    <aside class="right-col">
      <section class="panel">
        <h2>选中材料与替代关系</h2>
        <div class="panel-body">
          <div id="selectedDetails" class="empty">搜索或点击 Nd-Vd 图中的点，查看材料详情和相近替代关系。</div>
          <h3 style="font-size:15px; margin:14px 0 8px;">综合相近候选</h3>
          <div class="table-wrap" style="max-height:315px;">
            <table>
              <thead><tr><th>材料</th><th>库</th><th>距离</th><th>ΔNd</th><th>ΔVd</th><th>标签</th></tr></thead>
              <tbody id="similarTable"></tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>临近 Nd-Vd 切片</h2>
        <div class="chart-wrap">
          <div class="row" style="justify-content:space-between; margin-bottom:8px;">
            <div class="row tight">
              <label>Vd ±</label><input id="sliceVd" type="number" step="0.5" value="8" style="width:70px;">
              <label>Nd ±</label><input id="sliceNd" type="number" step="0.005" value="0.025" style="width:82px;">
            </div>
          </div>
          <canvas id="slicePlot"></canvas>
          <div class="hint" id="sliceHint" style="margin-top:7px;">选中材料后显示局部切片。</div>
        </div>
      </section>
    </aside>
  </div>

  <div id="tooltip" class="tooltip"></div>

  <script>
    const MATERIAL_DATA = ${JSON.stringify(materials)};
    const BUILD_INFO = ${JSON.stringify({ generatedAt: new Date().toISOString(), counts })};

    const COLORS = { CDGM: "#2563eb", NHG: "#0f766e", PLASTIC: "#d97706", OTHER: "#64748b" };
    const STORAGE_KEY = "materialExplorer.customTags.v1";
    const MAX_TABLE_ROWS = 250;
    const DPR = Math.max(1, window.devicePixelRatio || 1);

    const state = {
      selectedId: null,
      hoverId: null,
      similar: [],
      customRules: [],
      view: null,
      isPanning: false,
      panStart: null,
      suppressFit: false
    };

    const els = {};
    const validPoint = (m) => Number.isFinite(m.nd) && Number.isFinite(m.vd) && m.nd > 0 && m.vd > 0;

    function fmt(n, digits) {
      if (!Number.isFinite(n)) return "";
      return Number(n).toFixed(digits).replace(/\\.0+$/, "").replace(/(\\.\\d*?)0+$/, "$1");
    }

    function hashOffset(text, range) {
      let h = 2166136261;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      const a = ((h >>> 0) % 997) / 997;
      const b = (((h >>> 8) >>> 0) % 991) / 991;
      return [(a - 0.5) * range, (b - 0.5) * range];
    }

    function broadFamily(family) {
      if (/^(FK|PK|QK|K|ZK|LAK|ZPK)$/.test(family)) return "crown";
      if (/^(F|QF|ZF|LAF|ZLAF|BAF|ZBAF|BIF)$/.test(family)) return "flint";
      if (/^(APL|OKP|EP|SP|COP|AD)$/.test(family)) return "plastic";
      return family || "unknown";
    }

    function normalizeName(name) {
      return String(name || "")
        .replace(/^(H|D|S|L)-/, "")
        .replace(/@[^*]+$/, "")
        .replace(/\\*$/, "")
        .replace(/-25$/, "")
        .replace(/(GT|TT)$/g, "");
    }

    function loadCustomRules() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function saveCustomRules() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.customRules, null, 2));
    }

    function customTagsFor(m) {
      const tags = [];
      for (const rule of state.customRules) {
        if (!rule || !rule.name) continue;
        let ok = false;
        const pattern = String(rule.pattern || "");
        try {
          if (rule.mode === "contains") ok = m.name.toLowerCase().includes(pattern.toLowerCase());
          else if (rule.mode === "starts") ok = m.name.toLowerCase().startsWith(pattern.toLowerCase());
          else if (rule.mode === "family") ok = m.family.toLowerCase() === pattern.toLowerCase();
          else if (rule.mode === "prefix") ok = m.prefix.toLowerCase() === pattern.toLowerCase();
          else if (rule.mode === "regex") ok = new RegExp(pattern, "i").test(m.name);
          else if (rule.mode === "selected") ok = Array.isArray(rule.ids) && rule.ids.includes(m.id);
        } catch {
          ok = false;
        }
        if (ok) tags.push("自定义:" + rule.name);
      }
      return tags;
    }

    function allTagsFor(m) {
      return Array.from(new Set([...(m.autoTags || []), ...customTagsFor(m)])).sort();
    }

    function byId(id) {
      return MATERIAL_DATA.find((m) => m.id === id) || null;
    }

    function initElements() {
      for (const id of [
        "searchInput","searchButton","materialNames","clearSelection","resetFilters","totalCount","visibleCount","neighborCount",
        "libraryFilters","showInfrared","ndMin","ndMax","vdMin","vdMax","dpgfMin","dpgfMax","densityMin","densityMax",
        "familyFilters","tagSearch","tagFilters","customTagName","customTagMode","customTagPattern","addCustomTag",
        "exportTags","importTags","clearTags","customTagJson","customRuleList","mainPlot","fitPlot","zoomSlice",
        "materialTable","tableHint","downloadFiltered","selectedDetails","similarTable","sliceVd","sliceNd","slicePlot",
        "sliceHint","tooltip"
      ]) els[id] = document.getElementById(id);
    }

    function makeCheckbox(container, value, label, checked, cls) {
      const item = document.createElement("label");
      item.className = cls || "";
      item.title = label;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = value;
      cb.checked = checked;
      cb.addEventListener("change", () => {
        state.suppressFit = false;
        refresh();
      });
      item.appendChild(cb);
      item.appendChild(document.createTextNode(label));
      container.appendChild(item);
    }

    function renderStaticFilters() {
      els.materialNames.innerHTML = MATERIAL_DATA.map((m) => '<option value="' + m.name + '"></option>').join("");
      els.libraryFilters.innerHTML = "";
      const libs = Array.from(new Set(MATERIAL_DATA.map((m) => m.library))).sort();
      for (const lib of libs) makeCheckbox(els.libraryFilters, lib, lib, true);

      els.familyFilters.innerHTML = "";
      const families = Array.from(new Set(MATERIAL_DATA.map((m) => m.family).filter(Boolean))).sort();
      for (const fam of families) makeCheckbox(els.familyFilters, fam, fam, false);
    }

    function tagCounts() {
      const counts = new Map();
      for (const m of MATERIAL_DATA) {
        for (const tag of allTagsFor(m)) counts.set(tag, (counts.get(tag) || 0) + 1);
      }
      return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"));
    }

    function renderTagFilters(keepSelected) {
      const selected = keepSelected ? selectedCheckboxValues(els.tagFilters) : new Set();
      const q = els.tagSearch.value.trim().toLowerCase();
      els.tagFilters.innerHTML = "";
      for (const [tag, count] of tagCounts()) {
        if (q && !tag.toLowerCase().includes(q)) continue;
        makeCheckbox(els.tagFilters, tag, tag + " (" + count + ")", selected.has(tag), "checkline");
      }
    }

    function selectedCheckboxValues(container) {
      return new Set(Array.from(container.querySelectorAll("input[type=checkbox]:checked")).map((x) => x.value));
    }

    function numberValue(id) {
      if (els[id].value.trim() === "") return null;
      const v = Number(els[id].value);
      return Number.isFinite(v) ? v : null;
    }

    function currentFilters() {
      return {
        libs: selectedCheckboxValues(els.libraryFilters),
        families: selectedCheckboxValues(els.familyFilters),
        tags: selectedCheckboxValues(els.tagFilters),
        showInfrared: els.showInfrared.checked,
        ndMin: numberValue("ndMin"),
        ndMax: numberValue("ndMax"),
        vdMin: numberValue("vdMin"),
        vdMax: numberValue("vdMax"),
        dpgfMin: numberValue("dpgfMin"),
        dpgfMax: numberValue("dpgfMax"),
        densityMin: numberValue("densityMin"),
        densityMax: numberValue("densityMax"),
      };
    }

    function inRange(value, min, max) {
      if (min !== null && (!Number.isFinite(value) || value < min)) return false;
      if (max !== null && (!Number.isFinite(value) || value > max)) return false;
      return true;
    }

    function filteredMaterials() {
      const f = currentFilters();
      return MATERIAL_DATA.filter((m) => {
        if (!f.libs.has(m.library)) return false;
        if (!f.showInfrared && m.class === "infrared") return false;
        if (f.families.size && !f.families.has(m.family)) return false;
        if (!inRange(m.nd, f.ndMin, f.ndMax)) return false;
        if (!inRange(m.vd, f.vdMin, f.vdMax)) return false;
        if (!inRange(m.dpgf, f.dpgfMin, f.dpgfMax)) return false;
        if (!inRange(m.density, f.densityMin, f.densityMax)) return false;
        const tags = new Set(allTagsFor(m));
        for (const tag of f.tags) if (!tags.has(tag)) return false;
        return true;
      });
    }

    function candidatePool() {
      const selected = byId(state.selectedId);
      const showInfrared = els.showInfrared.checked || (selected && selected.class === "infrared");
      return MATERIAL_DATA.filter((m) => validPoint(m) && (showInfrared || m.class !== "infrared"));
    }

    function boundsFor(points, padX, padY) {
      const valid = points.filter(validPoint);
      if (!valid.length) return { xMin: 0, xMax: 100, yMin: 1.4, yMax: 2.1 };
      let xMin = Math.min(...valid.map((m) => m.vd));
      let xMax = Math.max(...valid.map((m) => m.vd));
      let yMin = Math.min(...valid.map((m) => m.nd));
      let yMax = Math.max(...valid.map((m) => m.nd));
      const xr = Math.max(1, xMax - xMin);
      const yr = Math.max(0.01, yMax - yMin);
      return { xMin: xMin - xr * padX, xMax: xMax + xr * padX, yMin: yMin - yr * padY, yMax: yMax + yr * padY };
    }

    function fitMainView(points) {
      state.view = boundsFor(points, 0.06, 0.08);
    }

    function clientSize(canvas) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * DPR));
      canvas.height = Math.max(1, Math.round(rect.height * DPR));
      const ctx = canvas.getContext("2d");
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      return { width: rect.width, height: rect.height, ctx };
    }

    function plotRect(size) {
      return { left: 54, right: 16, top: 18, bottom: 42, width: size.width, height: size.height };
    }

    function toScreen(m, view, rect, jitter) {
      const w = rect.width - rect.left - rect.right;
      const h = rect.height - rect.top - rect.bottom;
      const x = rect.left + ((m.vd - view.xMin) / (view.xMax - view.xMin)) * w;
      const y = rect.top + ((view.yMax - m.nd) / (view.yMax - view.yMin)) * h;
      if (!jitter) return [x, y];
      const j = hashOffset(m.name + m.library, 5.5);
      return [x + j[0], y + j[1]];
    }

    function fromScreen(x, y, view, rect) {
      const w = rect.width - rect.left - rect.right;
      const h = rect.height - rect.top - rect.bottom;
      return {
        vd: view.xMin + ((x - rect.left) / w) * (view.xMax - view.xMin),
        nd: view.yMax - ((y - rect.top) / h) * (view.yMax - view.yMin)
      };
    }

    function drawAxes(ctx, rect, view, title) {
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = "#d8e0e8";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#64748b";
      ctx.font = "12px Microsoft YaHei, Arial";

      const xTicks = 8;
      const yTicks = 7;
      for (let i = 0; i <= xTicks; i++) {
        const t = i / xTicks;
        const x = rect.left + t * (rect.width - rect.left - rect.right);
        const v = view.xMin + t * (view.xMax - view.xMin);
        ctx.beginPath();
        ctx.moveTo(x, rect.top);
        ctx.lineTo(x, rect.height - rect.bottom);
        ctx.stroke();
        ctx.fillText(fmt(v, 1), x - 11, rect.height - 18);
      }
      for (let i = 0; i <= yTicks; i++) {
        const t = i / yTicks;
        const y = rect.top + t * (rect.height - rect.top - rect.bottom);
        const v = view.yMax - t * (view.yMax - view.yMin);
        ctx.beginPath();
        ctx.moveTo(rect.left, y);
        ctx.lineTo(rect.width - rect.right, y);
        ctx.stroke();
        ctx.fillText(fmt(v, 3), 8, y + 4);
      }
      ctx.strokeStyle = "#8ca0b3";
      ctx.beginPath();
      ctx.rect(rect.left, rect.top, rect.width - rect.left - rect.right, rect.height - rect.top - rect.bottom);
      ctx.stroke();
      ctx.fillStyle = "#243b53";
      ctx.font = "13px Microsoft YaHei, Arial";
      ctx.fillText("Vd", rect.width / 2 - 8, rect.height - 6);
      ctx.save();
      ctx.translate(15, rect.height / 2 + 14);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Nd", 0, 0);
      ctx.restore();
      if (title) {
        ctx.fillStyle = "#17202a";
        ctx.font = "600 13px Microsoft YaHei, Arial";
        ctx.fillText(title, rect.left, 14);
      }
    }

    function drawMain(points) {
      const size = clientSize(els.mainPlot);
      const rect = plotRect(size);
      if (!state.view || !state.suppressFit) fitMainView(points);
      state.suppressFit = true;
      drawAxes(size.ctx, rect, state.view, "");
      drawPoints(size.ctx, rect, state.view, points, { jitter: true, labels: false, main: true });
    }

    function visibleInView(m, view) {
      return m.vd >= view.xMin && m.vd <= view.xMax && m.nd >= view.yMin && m.nd <= view.yMax;
    }

    function drawPoints(ctx, rect, view, points, opts) {
      const selected = byId(state.selectedId);
      const similarIds = new Set((state.similar || []).slice(0, 12).map((x) => x.m.id));
      const hover = byId(state.hoverId);
      const labelIds = new Set();
      if (selected) labelIds.add(selected.id);
      for (const x of (state.similar || []).slice(0, opts.main ? 8 : 40)) labelIds.add(x.m.id);

      for (const m of points) {
        if (!validPoint(m) || !visibleInView(m, view)) continue;
        const [x, y] = toScreen(m, view, rect, opts.jitter);
        const selectedPoint = selected && selected.id === m.id;
        const near = similarIds.has(m.id);
        ctx.globalAlpha = selectedPoint ? 1 : near ? 0.9 : 0.55;
        ctx.fillStyle = COLORS[m.library] || COLORS.OTHER;
        ctx.beginPath();
        ctx.arc(x, y, selectedPoint ? 5.5 : near ? 4.4 : 3.1, 0, Math.PI * 2);
        ctx.fill();
        if (near) {
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(x, y, 7.2, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (selectedPoint) {
          ctx.strokeStyle = "#b3263b";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x, y, 9.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (selected && validPoint(selected)) {
        const [sx, sy] = toScreen(selected, view, rect, opts.jitter);
        ctx.strokeStyle = "rgba(179,38,59,0.42)";
        ctx.lineWidth = 1.5;
        for (const x of (state.similar || []).slice(0, opts.main ? 8 : 18)) {
          const [tx, ty] = toScreen(x.m, view, rect, opts.jitter);
          if (visibleInView(x.m, view)) {
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(tx, ty);
            ctx.stroke();
          }
        }
      }
      ctx.font = opts.main ? "12px Microsoft YaHei, Arial" : "11px Microsoft YaHei, Arial";
      for (const m of points) {
        if (!validPoint(m) || !visibleInView(m, view)) continue;
        if (!labelIds.has(m.id) && !opts.labels) continue;
        const [x, y] = toScreen(m, view, rect, opts.jitter);
        const label = m.name;
        const textW = ctx.measureText(label).width + 8;
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.fillRect(x + 6, y - 17, textW, 16);
        ctx.strokeStyle = "rgba(120,136,153,0.35)";
        ctx.strokeRect(x + 6, y - 17, textW, 16);
        ctx.fillStyle = state.selectedId === m.id ? "#b3263b" : "#17202a";
        ctx.fillText(label, x + 10, y - 5);
      }
      if (hover && validPoint(hover) && visibleInView(hover, view)) {
        const [x, y] = toScreen(hover, view, rect, opts.jitter);
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawSlice() {
      const selected = byId(state.selectedId);
      const size = clientSize(els.slicePlot);
      const rect = plotRect(size);
      if (!selected || !validPoint(selected)) {
        drawAxes(size.ctx, rect, { xMin: 0, xMax: 100, yMin: 1.4, yMax: 2.1 }, "未选中材料");
        els.sliceHint.textContent = "选中材料后显示局部切片。";
        return;
      }
      const vdSpan = Math.max(0.5, Number(els.sliceVd.value) || 8);
      const ndSpan = Math.max(0.002, Number(els.sliceNd.value) || 0.025);
      const view = { xMin: selected.vd - vdSpan, xMax: selected.vd + vdSpan, yMin: selected.nd - ndSpan, yMax: selected.nd + ndSpan };
      const points = candidatePool().filter((m) => visibleInView(m, view));
      drawAxes(size.ctx, rect, view, selected.name + " 临近切片");
      drawPoints(size.ctx, rect, view, points, { jitter: false, labels: true, main: false });
      els.sliceHint.textContent = "切片范围内 " + points.length + " 个材料；默认不受左侧库/tag筛选限制，用于观察替代候选密集区。";
    }

    function nearestPoint(canvas, event, points, view, jitter) {
      const rectDom = canvas.getBoundingClientRect();
      const size = { width: rectDom.width, height: rectDom.height };
      const rect = plotRect(size);
      const px = event.clientX - rectDom.left;
      const py = event.clientY - rectDom.top;
      let best = null;
      let bestD = 144;
      for (const m of points) {
        if (!validPoint(m) || !visibleInView(m, view)) continue;
        const [x, y] = toScreen(m, view, rect, jitter);
        const d = (x - px) * (x - px) + (y - py) * (y - py);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      return best;
    }

    function showTooltip(m, x, y) {
      if (!m) {
        els.tooltip.style.display = "none";
        return;
      }
      els.tooltip.innerHTML = "<strong>" + m.name + "</strong><br>" +
        m.library + " / " + m.family + "<br>" +
        "Nd " + fmt(m.nd, 6) + " · Vd " + fmt(m.vd, 4) + " · dPgF " + fmt(m.dpgf, 4);
      els.tooltip.style.left = (x + 14) + "px";
      els.tooltip.style.top = (y + 14) + "px";
      els.tooltip.style.display = "block";
    }

    function similarityScore(a, b) {
      const terms = [
        ["nd", 0.02, 0.42],
        ["vd", 5.0, 0.28],
        ["dpgf", 0.012, 0.14],
        ["density", 1.2, 0.07],
        ["cost", 50, 0.04],
      ];
      let sum = 0;
      let weight = 0;
      for (const [key, scale, w] of terms) {
        if (Number.isFinite(a[key]) && Number.isFinite(b[key])) {
          const d = Math.min(4, Math.abs(a[key] - b[key]) / scale);
          sum += w * d * d;
          weight += w;
        }
      }
      let score = weight ? Math.sqrt(sum / weight) : 999;
      if (a.class !== b.class) score += 0.45;
      if (a.family !== b.family) score += broadFamily(a.family) === broadFamily(b.family) ? 0.08 : 0.18;
      if (a.library === b.library) score -= 0.015;
      return Math.max(0, score);
    }

    function computeSimilar() {
      const selected = byId(state.selectedId);
      if (!selected || !validPoint(selected)) {
        state.similar = [];
        return;
      }
      const pool = candidatePool().filter((m) => m.id !== selected.id);
      const scored = pool.map((m) => ({
        m,
        score: similarityScore(selected, m),
        nameLike: normalizeName(selected.name) === normalizeName(m.name) || selected.baseName === m.baseName,
        otherLibrary: selected.library !== m.library,
        dNd: m.nd - selected.nd,
        dVd: m.vd - selected.vd,
      })).sort((a, b) => a.score - b.score);
      const picked = [];
      const seen = new Set();
      function addMany(list, limit) {
        for (const item of list) {
          if (seen.has(item.m.id)) continue;
          picked.push(item);
          seen.add(item.m.id);
          if (picked.length >= limit) break;
        }
      }
      addMany(scored.filter((x) => x.nameLike), 10);
      addMany(scored, 24);
      addMany(scored.filter((x) => x.otherLibrary), 30);
      state.similar = picked.slice(0, 30);
    }

    function selectMaterial(id, centerMain) {
      state.selectedId = id;
      computeSimilar();
      if (centerMain) {
        const m = byId(id);
        if (m && validPoint(m)) {
          const xSpan = 16;
          const ySpan = 0.06;
          state.view = { xMin: m.vd - xSpan / 2, xMax: m.vd + xSpan / 2, yMin: m.nd - ySpan / 2, yMax: m.nd + ySpan / 2 };
          state.suppressFit = true;
        }
      }
      renderDetails();
      renderSimilarTable();
      drawSlice();
      drawMain(filteredMaterials());
    }

    function findBySearch(q) {
      const term = q.trim().toLowerCase();
      if (!term) return null;
      return MATERIAL_DATA.find((m) => m.name.toLowerCase() === term)
        || MATERIAL_DATA.find((m) => m.name.toLowerCase().startsWith(term))
        || MATERIAL_DATA.find((m) => m.name.toLowerCase().includes(term));
    }

    function renderDetails() {
      const m = byId(state.selectedId);
      if (!m) {
        els.selectedDetails.className = "empty";
        els.selectedDetails.textContent = "搜索或点击 Nd-Vd 图中的点，查看材料详情和相近替代关系。";
        return;
      }
      els.selectedDetails.className = "";
      const tags = allTagsFor(m).slice(0, 12).map((t) => '<span class="badge">' + t + '</span>').join("");
      const cls = m.class === "glass" ? "green" : m.class === "plastic" ? "amber" : "red";
      els.selectedDetails.innerHTML =
        '<div class="material-title"><strong>' + m.name + '</strong><span class="badge ' + cls + '">' + m.library + ' · ' + m.class + '</span></div>' +
        '<div class="detail-grid">' +
        '<div><span>Nd</span>' + fmt(m.nd, 6) + '</div>' +
        '<div><span>Vd</span>' + fmt(m.vd, 4) + '</div>' +
        '<div><span>dPgF</span>' + fmt(m.dpgf, 4) + '</div>' +
        '<div><span>密度</span>' + fmt(m.density, 4) + '</div>' +
        '<div><span>成本/库字段</span>' + fmt(m.cost, 3) + '</div>' +
        '<div><span>波段</span>' + fmt(m.waveMin, 4) + ' - ' + fmt(m.waveMax, 4) + '</div>' +
        '<div><span>前缀/族/后缀</span>' + (m.prefix || "无") + ' / ' + (m.family || "未知") + ' / ' + (m.suffixText || "无") + '</div>' +
        '<div><span>公式</span>' + (m.formula || "未知") + '</div>' +
        '</div>' +
        '<div class="tag-list">' + tags + '</div>';
    }

    function renderSimilarTable() {
      els.neighborCount.textContent = state.similar.length;
      if (!state.similar.length) {
        els.similarTable.innerHTML = '<tr><td colspan="6" class="hint">暂无候选</td></tr>';
        return;
      }
      els.similarTable.innerHTML = state.similar.map((x) => {
        const tag = x.nameLike ? "近名" : x.otherLibrary ? "跨库" : "近邻";
        return '<tr class="clickable" data-id="' + x.m.id + '">' +
          '<td>' + x.m.name + '</td><td>' + x.m.library + '</td><td>' + fmt(x.score, 3) + '</td>' +
          '<td>' + fmt(x.dNd, 6) + '</td><td>' + fmt(x.dVd, 3) + '</td><td><span class="badge">' + tag + '</span></td></tr>';
      }).join("");
      els.similarTable.querySelectorAll("tr[data-id]").forEach((tr) => {
        tr.addEventListener("click", () => selectMaterial(Number(tr.dataset.id), true));
      });
    }

    function renderTable(points) {
      const rows = points.slice(0, MAX_TABLE_ROWS);
      els.tableHint.textContent = "显示 " + rows.length + " / " + points.length + " 条";
      els.materialTable.innerHTML = rows.map((m) => {
        const tagText = allTagsFor(m).slice(0, 4).join("、");
        return '<tr class="clickable" data-id="' + m.id + '">' +
          '<td>' + m.library + '</td><td>' + m.name + '</td><td>' + fmt(m.nd, 6) + '</td><td>' + fmt(m.vd, 3) + '</td>' +
          '<td>' + fmt(m.dpgf, 4) + '</td><td>' + fmt(m.density, 3) + '</td><td>' + tagText + '</td></tr>';
      }).join("");
      els.materialTable.querySelectorAll("tr[data-id]").forEach((tr) => {
        tr.addEventListener("click", () => selectMaterial(Number(tr.dataset.id), false));
      });
    }

    function renderCustomRules() {
      if (!state.customRules.length) {
        els.customRuleList.innerHTML = '<div class="hint" style="margin-top:7px;">暂无自定义 tag。</div>';
        return;
      }
      els.customRuleList.innerHTML = state.customRules.map((r, i) =>
        '<div class="custom-rule"><div><strong>自定义:' + r.name + '</strong><br><span class="hint">' + r.mode + ' · ' + (r.pattern || (r.ids ? r.ids.join(",") : "")) + '</span></div><button data-i="' + i + '">删除</button></div>'
      ).join("");
      els.customRuleList.querySelectorAll("button[data-i]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.customRules.splice(Number(btn.dataset.i), 1);
          saveCustomRules();
          renderCustomRules();
          renderTagFilters(true);
          refresh();
        });
      });
    }

    function refresh() {
      const points = filteredMaterials();
      els.totalCount.textContent = MATERIAL_DATA.length;
      els.visibleCount.textContent = points.length;
      computeSimilar();
      renderDetails();
      renderSimilarTable();
      renderTable(points);
      drawMain(points);
      drawSlice();
    }

    function attachEvents() {
      els.searchButton.addEventListener("click", () => {
        const m = findBySearch(els.searchInput.value);
        if (m) selectMaterial(m.id, true);
      });
      els.searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") els.searchButton.click();
      });
      els.clearSelection.addEventListener("click", () => {
        state.selectedId = null;
        state.similar = [];
        refresh();
      });
      els.resetFilters.addEventListener("click", () => {
        els.libraryFilters.querySelectorAll("input").forEach((x) => x.checked = true);
        els.familyFilters.querySelectorAll("input").forEach((x) => x.checked = false);
        els.tagFilters.querySelectorAll("input").forEach((x) => x.checked = false);
        for (const id of ["ndMin","ndMax","vdMin","vdMax","dpgfMin","dpgfMax","densityMin","densityMax","tagSearch"]) els[id].value = "";
        els.showInfrared.checked = false;
        renderTagFilters(false);
        state.suppressFit = false;
        refresh();
      });
      for (const id of ["showInfrared","ndMin","ndMax","vdMin","vdMax","dpgfMin","dpgfMax","densityMin","densityMax","sliceVd","sliceNd"]) {
        els[id].addEventListener("input", () => {
          if (id !== "sliceVd" && id !== "sliceNd") state.suppressFit = false;
          refresh();
        });
      }
      els.tagSearch.addEventListener("input", () => renderTagFilters(true));
      els.fitPlot.addEventListener("click", () => {
        state.suppressFit = false;
        refresh();
      });
      els.zoomSlice.addEventListener("click", () => {
        if (state.selectedId !== null) selectMaterial(state.selectedId, true);
      });
      els.addCustomTag.addEventListener("click", () => {
        const name = els.customTagName.value.trim();
        const mode = els.customTagMode.value;
        const pattern = els.customTagPattern.value.trim();
        if (!name) return alert("请输入 tag 名称。");
        if (mode !== "selected" && !pattern) return alert("请输入匹配内容。");
        const rule = { name, mode, pattern };
        if (mode === "selected") {
          if (state.selectedId === null) return alert("请先选中一个材料。");
          rule.ids = [state.selectedId];
        }
        state.customRules.push(rule);
        saveCustomRules();
        els.customTagName.value = "";
        els.customTagPattern.value = "";
        renderCustomRules();
        renderTagFilters(true);
        refresh();
      });
      els.exportTags.addEventListener("click", () => {
        els.customTagJson.value = JSON.stringify(state.customRules, null, 2);
      });
      els.importTags.addEventListener("click", () => {
        try {
          const parsed = JSON.parse(els.customTagJson.value);
          if (!Array.isArray(parsed)) throw new Error("not array");
          state.customRules = parsed;
          saveCustomRules();
          renderCustomRules();
          renderTagFilters(true);
          refresh();
        } catch {
          alert("JSON 格式不正确。");
        }
      });
      els.clearTags.addEventListener("click", () => {
        if (!confirm("清空所有自定义 tag？")) return;
        state.customRules = [];
        saveCustomRules();
        renderCustomRules();
        renderTagFilters(true);
        refresh();
      });
      els.downloadFiltered.addEventListener("click", () => {
        const rows = filteredMaterials();
        const cols = ["library","name","nd","vd","dpgf","density","cost","family","prefix","suffixText"];
        const csv = [cols.join(",")].concat(rows.map((m) => cols.map((c) => '"' + String(m[c] ?? "").replace(/"/g, '""') + '"').join(","))).join("\\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "filtered_materials.csv";
        a.click();
        URL.revokeObjectURL(a.href);
      });

      els.mainPlot.addEventListener("mousemove", (e) => {
        const points = filteredMaterials();
        const m = state.view ? nearestPoint(els.mainPlot, e, points, state.view, true) : null;
        state.hoverId = m ? m.id : null;
        showTooltip(m, e.clientX, e.clientY);
        drawMain(points);
      });
      els.mainPlot.addEventListener("mouseleave", () => {
        state.hoverId = null;
        showTooltip(null);
        drawMain(filteredMaterials());
      });
      els.mainPlot.addEventListener("click", (e) => {
        if (!state.view) return;
        const m = nearestPoint(els.mainPlot, e, filteredMaterials(), state.view, true);
        if (m) selectMaterial(m.id, false);
      });
      els.mainPlot.addEventListener("wheel", (e) => {
        if (!state.view) return;
        e.preventDefault();
        const rectDom = els.mainPlot.getBoundingClientRect();
        const rect = plotRect({ width: rectDom.width, height: rectDom.height });
        const mouse = fromScreen(e.clientX - rectDom.left, e.clientY - rectDom.top, state.view, rect);
        const scale = e.deltaY < 0 ? 0.88 : 1.14;
        state.view = {
          xMin: mouse.vd - (mouse.vd - state.view.xMin) * scale,
          xMax: mouse.vd + (state.view.xMax - mouse.vd) * scale,
          yMin: mouse.nd - (mouse.nd - state.view.yMin) * scale,
          yMax: mouse.nd + (state.view.yMax - mouse.nd) * scale,
        };
        state.suppressFit = true;
        refresh();
      }, { passive: false });
      els.mainPlot.addEventListener("mousedown", (e) => {
        if (!state.view) return;
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY, view: { ...state.view } };
      });
      window.addEventListener("mousemove", (e) => {
        if (!state.isPanning || !state.panStart) return;
        const rectDom = els.mainPlot.getBoundingClientRect();
        const rect = plotRect({ width: rectDom.width, height: rectDom.height });
        const dx = e.clientX - state.panStart.x;
        const dy = e.clientY - state.panStart.y;
        const xScale = (state.panStart.view.xMax - state.panStart.view.xMin) / (rect.width - rect.left - rect.right);
        const yScale = (state.panStart.view.yMax - state.panStart.view.yMin) / (rect.height - rect.top - rect.bottom);
        state.view = {
          xMin: state.panStart.view.xMin - dx * xScale,
          xMax: state.panStart.view.xMax - dx * xScale,
          yMin: state.panStart.view.yMin + dy * yScale,
          yMax: state.panStart.view.yMax + dy * yScale,
        };
        state.suppressFit = true;
        drawMain(filteredMaterials());
      });
      window.addEventListener("mouseup", () => {
        state.isPanning = false;
        state.panStart = null;
      });
      window.addEventListener("resize", () => refresh());
    }

    function init() {
      initElements();
      state.customRules = loadCustomRules();
      renderStaticFilters();
      renderTagFilters(false);
      renderCustomRules();
      attachEvents();
      refresh();
    }

    init();
  </script>
</body>
</html>`;

const output = path.join(ROOT, "material_explorer.html");
fs.writeFileSync(output, html, "utf8");
console.log(`Generated material_explorer.html with ${materials.length} materials`);
console.log(JSON.stringify(counts));
