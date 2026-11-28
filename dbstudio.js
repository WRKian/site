/* ============================================================
   数据后台（编辑器内建表 + 数据接口）
   ------------------------------------------------------------
   入口：编辑器顶栏「⚙ 数据」
   后端复用 /api/admin/db/*，和 /admin/db 那个独立管理页是同一套接口，
   区别是这里只做「建表 + 开接口」，不搬浏览数据、执行 SQL 那些重活。
   ============================================================ */
(function () {
  if (window.WRDB) return;

  var API = '/api/admin/db';
  var TYPES = [
    ['text', '文本'], ['integer', '整数'], ['real', '小数'], ['boolean', '布尔'],
    ['datetime', '日期时间'], ['date', '日期'], ['blob', '二进制'], ['numeric', '精确小数']
  ];
  var SQL_TYPE = {
    text: 'TEXT', integer: 'INTEGER', real: 'REAL', boolean: 'BOOLEAN',
    datetime: 'DATETIME', date: 'DATE', blob: 'BLOB', numeric: 'NUMERIC'
  };
  /* 后端会拒绝这些名字，前端先提示一次，省得白点 */
  var RESERVED = ['user', 'project', 'template', 'module', 'sqlite_sequence', 'sqlite_master'];
  /* 站内自己用的表：列出来是为了看得见全貌，但不提供删除入口，免得把功能弄坏 */
  var SYS = ['user', 'project', 'template', 'module', 'message', 'email_code', 'user_profile'];
  function isSys(name) { return SYS.indexOf(String(name)) >= 0; }

  var S = {
    token: '',
    tables: [],
    table: '',        /* 当前选中的表 */
    view: 'list',     /* list=概览 / new=建表 / table=某张表 */
    tab: 'struct',    /* struct=结构 / api=数据接口 */
    info: null,       /* 当前表结构 */
    cfg: null,        /* 当前表接口配置 */
    draft: null,      /* 建表草稿 */
    addOpen: false,   /* 加字段表单是否展开 */
    err: '',          /* 面板级提示 */
    busy: false
  };

  /* ---------------- 小工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function nfmt(n) {
    if (n == null || n < 0) return '—';
    if (n < 10000) return String(n);
    return (n / 1000).toFixed(n < 100000 ? 1 : 0) + 'k';
  }
  var tTimer = null;
  function toast(msg, err) {
    if (window.WRPortal && window.WRPortal.toast) { window.WRPortal.toast(msg, err); return; }
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('error', !!err);
    el.classList.add('show');
    clearTimeout(tTimer);
    tTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  function copyText(text, okMsg) {
    var done = function () { toast(okMsg || '已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
      return;
    }
    fallback();
    function fallback() {
      var t = document.createElement('textarea');
      t.value = text;
      t.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选中', true); }
      document.body.removeChild(t);
    }
  }

  /* ---------------- 接口 ---------------- */
  function api(path, opt) {
    opt = opt || {};
    var init = {
      method: opt.method || 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    };
    if (init.method !== 'GET') init.headers['X-DB-Token'] = S.token;
    if (opt.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opt.body);
    }
    return fetch(API + path, init).then(function (r) {
      return r.json().catch(function () {
        return { ok: false, msg: '服务器返回异常（HTTP ' + r.status + '）' };
      });
    }, function () {
      return { ok: false, code: 'offline', msg: '没连上后端，请先用 python app.py 启动服务' };
    });
  }

  /* ---------------- DDL 预览（和服务端同一套规则） ---------------- */
  function defSql(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    if (/^(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|NULL)$/i.test(s)) return ' DEFAULT ' + s.toUpperCase();
    if (/^-?\d+(\.\d+)?$/.test(s)) return ' DEFAULT ' + s;
    return " DEFAULT '" + s.replace(/'/g, "''") + "'";
  }
  function ddlOf(draft) {
    var named = draft.cols.filter(function (c) { return String(c.name || '').trim(); });
    var pkCount = 0;
    var parts = [];
    if (!named.some(function (c) { return c.pk; })) {
      parts.push('"id" INTEGER PRIMARY KEY AUTOINCREMENT');
    }
    named.forEach(function (c) {
      var name = String(c.name).trim().toLowerCase();
      var sql = '"' + name + '" ' + (SQL_TYPE[c.type] || 'TEXT');
      if (c.pk) {
        pkCount++;
        sql += ' PRIMARY KEY';
        if (c.type === 'integer') sql += ' AUTOINCREMENT';
      } else {
        if (c.notnull) sql += ' NOT NULL';
        sql += defSql(c.def);
        if (c.unique) sql += ' UNIQUE';
      }
      parts.push(sql);
    });
    var tname = String(draft.name || '').trim().toLowerCase() || 'your_table';
    return 'CREATE TABLE "' + tname + '" (\n  ' + parts.join(',\n  ') + '\n)';
  }

  /* ---------------- 弹层骨架 ---------------- */
  var CSS = [
    '.wrdb-mask{position:fixed;inset:0;z-index:120;background:rgba(3,7,14,.84);backdrop-filter:blur(8px);',
    'display:flex;align-items:center;justify-content:center;padding:22px}',
    '.wrdb-mask[hidden]{display:none}',
    '.wrdb-shell{width:min(1100px,100%);height:min(740px,100%);display:flex;flex-direction:column;',
    'background:var(--ui-panel);border:1px solid var(--ui-line);border-radius:14px;overflow:hidden;',
    'box-shadow:0 30px 90px rgba(0,0,0,.6)}',
    '.wrdb-head{flex:0 0 56px;display:flex;align-items:center;gap:12px;padding:0 18px;',
    'border-bottom:1px solid var(--ui-line);background:linear-gradient(90deg,rgba(58,210,245,.07),transparent 60%)}',
    '.wrdb-head h2{margin:0;font-size:14px;font-weight:700}',
    '.wrdb-head .sub{font-size:11px;color:var(--ui-faint)}',
    '.wrdb-head .sp{flex:1}',
    '.wrdb-x{width:32px;height:32px;border:1px solid var(--ui-line);border-radius:8px;',
    'background:rgba(255,255,255,.03);color:var(--ui-muted);font-size:13px;cursor:pointer}',
    '.wrdb-x:hover{color:var(--ui-text);border-color:rgba(58,210,245,.4)}',
    '.wrdb-body{flex:1;display:flex;min-height:0}',

    /* 左栏 */
    '.wrdb-side{flex:0 0 232px;border-right:1px solid var(--ui-line);display:flex;flex-direction:column;min-height:0;',
    'background:rgba(255,255,255,.012)}',
    '.wrdb-side-h{display:flex;align-items:center;justify-content:space-between;padding:13px 14px 9px;',
    'font-size:11px;letter-spacing:.06em;color:var(--ui-faint)}',
    '.wrdb-list{flex:1;overflow:auto;padding:0 8px 8px}',
    '.wrdb-tb{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;margin-bottom:2px;',
    'border:1px solid transparent;border-radius:8px;background:transparent;color:var(--ui-muted);',
    'font-size:12.5px;text-align:left;cursor:pointer}',
    '.wrdb-tb:hover{background:rgba(255,255,255,.04);color:var(--ui-text)}',
    '.wrdb-tb.on{background:rgba(58,210,245,.13);border-color:rgba(58,210,245,.34);color:var(--accent)}',
    '.wrdb-tb b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}',
    '.wrdb-tb em{font-style:normal;font-size:9px;padding:1px 4px;border-radius:4px;flex:0 0 auto;',
    'background:rgba(140,180,230,.12);color:var(--ui-faint);letter-spacing:.04em}',
    '.wrdb-tb i{font:10px/1 var(--mono);font-style:normal;color:var(--ui-faint)}',
    '.wrdb-side-f{padding:10px;border-top:1px solid var(--ui-line);display:flex;flex-direction:column;gap:7px}',
    '.wrdb-mini{font-size:10.5px;color:var(--ui-faint);line-height:1.6}',
    '.wrdb-mini a{color:var(--accent);text-decoration:none}',

    /* 右栏 */
    '.wrdb-main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}',
    '.wrdb-bar{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--ui-line)}',
    '.wrdb-bar h3{margin:0;font-size:13px;font-weight:700}',
    '.wrdb-bar .sp{flex:1}',
    '.wrdb-pane{flex:1;overflow:auto;padding:18px}',
    '.wrdb-tabs{display:flex;gap:3px;padding:3px;border:1px solid var(--ui-line);border-radius:9px;background:rgba(255,255,255,.03)}',
    '.wrdb-tab{height:26px;padding:0 11px;border:0;border-radius:6px;background:transparent;color:var(--ui-muted);',
    'font-size:12px;cursor:pointer}',
    '.wrdb-tab:hover{color:var(--ui-text)}',
    '.wrdb-tab.on{background:rgba(58,210,245,.15);color:var(--accent)}',

    /* 按钮 */
    '.wrdb-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 12px;',
    'border:1px solid var(--ui-line);border-radius:8px;background:rgba(255,255,255,.035);color:var(--ui-muted);',
    'font-size:12px;cursor:pointer;transition:all .16s}',
    '.wrdb-btn:hover{color:var(--ui-text);border-color:rgba(58,210,245,.4)}',
    '.wrdb-btn.primary{background:linear-gradient(120deg,var(--accent),var(--accent2));border-color:transparent;',
    'color:#04121d;font-weight:700}',
    '.wrdb-btn.primary:hover{filter:brightness(1.08);color:#04121d}',
    '.wrdb-btn.ghost{background:transparent}',
    '.wrdb-btn.danger{color:var(--danger);border-color:rgba(255,138,117,.34);background:rgba(255,138,117,.07)}',
    '.wrdb-btn.sm{height:25px;padding:0 9px;font-size:11.5px}',
    '.wrdb-btn[disabled]{opacity:.5;cursor:not-allowed}',
    '.wrdb-btn.wide{width:100%}',

    /* 表单 */
    '.wrdb-field{margin-bottom:14px}',
    '.wrdb-label{display:block;font-size:11.5px;color:var(--ui-muted);margin-bottom:6px}',
    '.wrdb-label i{font-style:normal;color:var(--ui-faint)}',
    '.wrdb-input,.wrdb-select{width:100%;height:32px;padding:0 10px;border:1px solid var(--ui-line);border-radius:8px;',
    'background:rgba(255,255,255,.035);color:var(--ui-text);font-size:12.5px;outline:none;box-sizing:border-box}',
    '.wrdb-input:focus,.wrdb-select:focus{border-color:rgba(58,210,245,.55);background:rgba(58,210,245,.06)}',
    '.wrdb-input::placeholder{color:var(--ui-faint)}',
    '.wrdb-select{appearance:none;background-image:none;cursor:pointer}',
    '.wrdb-select option{background:#0d1524;color:var(--ui-text)}',
    '.wrdb-hint{font-size:10.5px;color:var(--ui-faint);margin-top:5px;line-height:1.6}',

    /* 字段编辑表格 */
    '.wrdb-cols{border:1px solid var(--ui-line);border-radius:10px;overflow:hidden}',
    '.wrdb-col-h,.wrdb-col{display:grid;grid-template-columns:1.25fr 108px 46px 46px 1fr 28px;gap:7px;align-items:center}',
    '.wrdb-col-h{padding:7px 10px;background:rgba(255,255,255,.03);font-size:10.5px;color:var(--ui-faint);',
    'border-bottom:1px solid var(--ui-line)}',
    '.wrdb-col{padding:7px 10px;border-bottom:1px solid rgba(140,180,230,.07)}',
    '.wrdb-col:last-child{border-bottom:0}',
    '.wrdb-col .wrdb-input,.wrdb-col .wrdb-select{height:28px;font-size:12px}',
    '.wrdb-ck{display:flex;align-items:center;justify-content:center}',
    '.wrdb-ck input{width:14px;height:14px;accent-color:var(--accent);cursor:pointer}',
    '.wrdb-ck i{display:none;font-style:normal;font-size:11px;color:var(--ui-faint)}',
    '.wrdb-del{width:24px;height:24px;border:1px solid transparent;border-radius:6px;background:transparent;',
    'color:var(--ui-faint);font-size:13px;cursor:pointer}',
    '.wrdb-del:hover{color:var(--danger);border-color:rgba(255,138,117,.34);background:rgba(255,138,117,.08)}',

    /* 代码块 */
    '.wrdb-code{margin:0;padding:12px 14px;border:1px solid var(--ui-line);border-radius:10px;',
    'background:#060c16;color:#a8d8ff;font:11.5px/1.75 var(--mono);white-space:pre;overflow:auto;max-height:230px}',
    '.wrdb-code.sm{max-height:150px}',
    '.wrdb-code b{color:var(--accent);font-weight:400}',

    /* 信息块 */
    '.wrdb-box{border:1px solid var(--ui-line);border-radius:10px;padding:12px 14px;margin-bottom:12px;',
    'background:rgba(255,255,255,.02)}',
    '.wrdb-kv{display:flex;align-items:center;gap:9px;font:11.5px var(--mono);color:var(--ui-text);word-break:break-all}',
    '.wrdb-kv b{color:var(--accent);font-weight:700;font-family:var(--font);font-size:11.5px;flex:0 0 auto}',
    '.wrdb-kv .sp{flex:1}',
    '.wrdb-tip{font-size:11px;color:var(--ui-faint);line-height:1.7;margin-top:6px}',
    '.wrdb-chip{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;',
    'font-size:10.5px;border:1px solid var(--ui-line);color:var(--ui-muted)}',
    '.wrdb-chip.on{color:#7fe3b0;border-color:rgba(127,227,176,.4);background:rgba(127,227,176,.1)}',
    '.wrdb-chip.pause{color:var(--gold);border-color:rgba(255,182,72,.4);background:rgba(255,182,72,.09)}',
    '.wrdb-seg{display:flex;gap:3px;padding:3px;border:1px solid var(--ui-line);border-radius:9px;',
    'background:rgba(255,255,255,.03);width:max-content}',
    '.wrdb-seg button{height:26px;padding:0 12px;border:0;border-radius:6px;background:transparent;',
    'color:var(--ui-muted);font-size:12px;cursor:pointer}',
    '.wrdb-seg button.on{background:rgba(58,210,245,.16);color:var(--accent)}',

    /* 通知 / 空态 */
    '.wrdb-note{display:flex;gap:10px;padding:12px 14px;border-radius:10px;font-size:12px;line-height:1.7;',
    'border:1px solid rgba(255,182,72,.3);background:rgba(255,182,72,.08);color:#ffd79a;margin-bottom:14px}',
    '.wrdb-note.err{border-color:rgba(255,138,117,.34);background:rgba(255,138,117,.08);color:#ffb3a5}',
    '.wrdb-empty{padding:50px 20px;text-align:center;color:var(--ui-faint);font-size:12.5px;line-height:2}',
    '.wrdb-empty b{display:block;font-size:14px;color:var(--ui-muted);margin-bottom:6px}',
    '.wrdb-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}',

    /* 手机 / 窄窗口 */
    '@media(max-width:760px){',
    '.wrdb-mask{padding:8px}',
    '.wrdb-shell{height:100%;border-radius:12px}',
    '.wrdb-body{flex-direction:column}',
    '.wrdb-side{flex:0 0 auto;border-right:0;border-bottom:1px solid var(--ui-line)}',
    '.wrdb-list{display:flex;flex-wrap:wrap;gap:5px;padding:0 8px 8px;max-height:120px;overflow-y:auto}',
    '.wrdb-tb{width:auto;max-width:47%;margin:0;flex:0 0 auto}',
    '.wrdb-side-f{flex-direction:row;align-items:center;gap:8px;padding:8px 10px}',
    '.wrdb-side-f .wrdb-btn{width:auto;flex:0 0 auto;height:28px}',
    '.wrdb-mini{display:none}',
    '.wrdb-bar{flex-wrap:wrap;padding:10px 14px}',
    '.wrdb-col-h{display:none}',
    '.wrdb-col{grid-template-columns:1fr 1fr;gap:5px;padding:9px 10px}',
    '.wrdb-col .wrdb-ck{justify-content:flex-start;gap:5px}',
    '.wrdb-ck i{display:inline}',
    '.wrdb-pane{padding:12px}',
    '.wrdb-grid2{grid-template-columns:1fr}',
    '}'
  ].join('\n');

  function injectCSS() {
    if ($('#wrdbStyle')) return;
    var st = document.createElement('style');
    st.id = 'wrdbStyle';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* 弹层只在第一次打开时建，之后复用 */
  function shell() {
    var mask = $('#wrdbMask');
    if (mask) return mask;
    mask = document.createElement('div');
    mask.className = 'wrdb-mask';
    mask.id = 'wrdbMask';
    mask.hidden = true;
    mask.innerHTML =
      '<div class="wrdb-shell" role="dialog" aria-modal="true" aria-label="数据后台">' +
        '<div class="wrdb-head">' +
          '<h2>⚙ 数据后台</h2>' +
          '<span class="sub">图形化建表 · 一键开数据接口</span>' +
          '<span class="sp"></span>' +
          '<button class="wrdb-btn sm ghost" data-act="reload" title="重新读取数据表列表">↻ 刷新</button>' +
          '<button class="wrdb-x" data-act="close" aria-label="关闭">✕</button>' +
        '</div>' +
        '<div class="wrdb-body">' +
          '<div class="wrdb-side">' +
            '<div class="wrdb-side-h"><span>数据表</span><span id="wrdbCount"></span></div>' +
            '<div class="wrdb-list" id="wrdbList"></div>' +
            '<div class="wrdb-side-f">' +
              '<button class="wrdb-btn primary wide" data-act="new">＋ 新建数据表</button>' +
              '<div class="wrdb-mini">需要浏览数据、跑 SQL？<a href="/admin/db" target="_blank" rel="noopener">打开完整版 ↗</a></div>' +
            '</div>' +
          '</div>' +
          '<div class="wrdb-main" id="wrdbMain"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', onMaskClick);
    return mask;
  }

  /* ---------------- 数据加载 ---------------- */
  function loadOverview() {
    S.err = '';
    return api('/overview').then(function (d) {
      if (!d.ok) { S.err = d.msg || '读取失败'; S.tables = []; return; }
      if (d.token) S.token = d.token;
      S.tables = d.tables || [];
      if (S.view === 'table' && S.table && !S.tables.some(function (t) { return t.name === S.table; })) {
        S.view = 'list'; S.table = '';
      }
      /* 第一次打开优先挑一张自己的表；全是系统表就停在欢迎页，别一上来就选中 email_code */
      if (!S.table && S.tables.length) {
        var own = S.tables.filter(function (t) { return !isSys(t.name); })[0];
        if (own) { S.table = own.name; S.view = 'table'; }
      }
    });
  }
  function loadTable(name) {
    S.info = null; S.cfg = null;
    return api('/table/' + encodeURIComponent(name) + '/structure').then(function (d) {
      if (d.ok) S.info = d.info;
    });
  }
  function loadCfg(name) {
    return api('/api/' + encodeURIComponent(name)).then(function (d) {
      if (d.ok) { S.cfg = d; S.cfgErr = ''; return; }
      /* 读不到也给一份空壳，面板才不会一直停在「正在读取」 */
      S.cfgErr = d.msg || '读取接口配置失败';
      S.cfg = {
        table: name, token: '', methods: 'GET,POST', hits: 0,
        endpoint: location.origin + '/api/data/' + name
      };
    });
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    if (!S.token && S.err) { renderLock(); return; }
    $('#wrdbCount').textContent = S.tables.length ? S.tables.length + ' 张' : '';
    $('#wrdbList').innerHTML = S.tables.length
      ? S.tables.map(function (t) {
        return '<button class="wrdb-tb' + (S.view === 'table' && t.name === S.table ? ' on' : '') +
          '" data-act="pick" data-table="' + esc(t.name) + '" title="' + esc(t.name) + '">' +
          '<b>' + esc(t.name) + '</b>' +
          (isSys(t.name) ? '<em>系统</em>' : '') +
          '<i>' + nfmt(t.columns) + '列/' + nfmt(t.rows) + '行</i></button>';
      }).join('')
      : '<div class="wrdb-mini" style="padding:10px">还没有数据表</div>';
    $('#wrdbMain').innerHTML = S.view === 'new' ? newTableHTML()
      : (S.view === 'table' && S.table) ? tableHTML() : emptyHTML();
    bindForm();
  }

  function emptyHTML() {
    var own = S.tables.filter(function (t) { return !isSys(t.name); });
    return '<div class="wrdb-pane"><div class="wrdb-empty" style="text-align:left;max-width:520px;margin:0 auto">' +
      '<b>给自己的页面建一张表</b>' +
      '左边列的是这个站点的全部数据表，灰色「系统」是站点自己在用的，先别动。<br>' +
      '点左下角「＋ 新建数据表」起一张自己的表，建完马上就能给它开数据接口，' +
      '导出的页面用 fetch 就能提交和读取，不用另找后端。<br><br>' +
      '整条链路就三步：<b style="display:inline;font-size:12.5px;color:var(--accent)">建表 → 生成密钥 → 页面里 fetch</b>' +
      (own.length ? '<br><br>你已经有了 ' + own.length + ' 张自己的表，点左边看看。' : '') +
      '</div></div>';
  }

  function renderLock() {
    $('#wrdbCount').textContent = '';
    $('#wrdbList').innerHTML = '';
    $('#wrdbMain').innerHTML =
      '<div class="wrdb-pane"><div class="wrdb-empty">' +
      '<b>数据后台需要站长账号</b>' +
      esc(S.err || '请先登录站长账号') + '<br><br>' +
      '<a class="wrdb-btn primary" href="index.html" target="_blank" rel="noopener">去登录 ↗</a>' +
      '</div></div>';
  }

  /* --- 建表 --- */
  function newTableHTML() {
    var d = S.draft;
    var rows = d.cols.map(function (c, i) { return colRowHTML(c, i); }).join('');
    return '<div class="wrdb-bar"><h3>新建数据表</h3><span class="sp"></span>' +
      '<button class="wrdb-btn sm ghost" data-act="cancelnew">取消</button></div>' +
      '<div class="wrdb-pane">' +
      (S.err ? '<div class="wrdb-note err">' + esc(S.err) + '</div>' : '') +
      '<div class="wrdb-field"><label class="wrdb-label" for="wrdbName">表名</label>' +
      '<input class="wrdb-input" id="wrdbName" placeholder="例如 article" value="' + esc(d.name) + '" spellcheck="false" maxlength="41">' +
      '<div class="wrdb-hint">小写字母开头，2–41 位，只能用字母、数字、下划线。建表时会自动补一个自增主键 <code>id</code>（除非你自己指定了主键）。</div></div>' +
      '<div class="wrdb-label">字段</div>' +
      '<div class="wrdb-cols"><div class="wrdb-col-h"><span>字段名</span><span>类型</span><span>主键</span><span>非空</span><span>默认值</span><span></span></div>' +
      rows + '</div>' +
      '<div style="margin-top:10px"><button class="wrdb-btn sm" data-act="addcol">＋ 添加字段</button></div>' +
      '<div class="wrdb-label" style="margin-top:18px">建表语句（实时预览）</div>' +
      '<pre class="wrdb-code" id="wrdbDdl">' + esc(ddlOf(d)) + '</pre>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:16px">' +
      '<button class="wrdb-btn primary" data-act="create">创建数据表</button>' +
      '<button class="wrdb-btn ghost" data-act="cancelnew">取消</button>' +
      '<span class="wrdb-hint" style="margin:0">创建后可以直接在「数据接口」里生成密钥，页面就能读写这张表。</span>' +
      '</div></div>';
  }

  function colRowHTML(c, i) {
    var opts = TYPES.map(function (t) {
      return '<option value="' + t[0] + '"' + (c.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
    }).join('');
    return '<div class="wrdb-col" data-i="' + i + '">' +
      '<input class="wrdb-input" data-f="name" placeholder="字段名" value="' + esc(c.name) + '" spellcheck="false" maxlength="41">' +
      '<select class="wrdb-select" data-f="type">' + opts + '</select>' +
      '<label class="wrdb-ck"><input type="checkbox" data-f="pk"' + (c.pk ? ' checked' : '') + '><i>主键</i></label>' +
      '<label class="wrdb-ck"><input type="checkbox" data-f="notnull"' + (c.notnull ? ' checked' : '') + '><i>非空</i></label>' +
      '<input class="wrdb-input" data-f="def" placeholder="留空" value="' + esc(c.def || '') + '" spellcheck="false">' +
      '<button class="wrdb-del" data-act="delcol" data-i="' + i + '" title="删除这一行">✕</button>' +
      '</div>';
  }

  /* --- 单表 --- */
  function tableHTML() {
    var t = S.tables.filter(function (x) { return x.name === S.table; })[0] || { name: S.table, columns: 0, rows: 0 };
    return '<div class="wrdb-bar"><h3>' + esc(t.name) + '</h3>' +
      '<span class="wrdb-chip">' + nfmt(t.columns) + ' 个字段 · ' + nfmt(t.rows) + ' 行</span>' +
      '<span class="sp"></span>' +
      '<div class="wrdb-tabs">' +
        '<button class="wrdb-tab' + (S.tab === 'struct' ? ' on' : '') + '" data-act="tab" data-tab="struct">结构</button>' +
        '<button class="wrdb-tab' + (S.tab === 'api' ? ' on' : '') + '" data-act="tab" data-tab="api">数据接口</button>' +
      '</div></div>' +
      '<div class="wrdb-pane">' +
      (S.err ? '<div class="wrdb-note err">' + esc(S.err) + '</div>' : '') +
      (S.tab === 'struct' ? structHTML() : apiHTML()) +
      '</div>';
  }

  function structHTML() {
    /* 切表时结构是异步来的，先确认拿到的是这张表的，别把上一张的字段显示出来 */
    var info = S.info && S.info.name === S.table ? S.info : null;
    if (!info) return '<div class="wrdb-empty">正在读取表结构…</div>';
    var rows = info.columns.map(function (c) {
      return '<div class="wrdb-col" style="grid-template-columns:1.4fr 1fr 60px 60px 1fr;cursor:default">' +
        '<b style="font-size:12px;font-weight:600">' + esc(c.name) +
        (c.pk ? ' <span class="wrdb-chip on" style="padding:0 6px">PK</span>' : '') + '</b>' +
        '<span style="font:11px var(--mono);color:var(--ui-muted)">' + esc(c.type) + '</span>' +
        '<span class="wrdb-hint" style="margin:0">' + (c.pk ? '主键' : (c.nullable ? '可空' : '非空')) + '</span>' +
        '<span class="wrdb-hint" style="margin:0">' + (c.pk ? '—' : (c.default == null ? '—' : esc(String(c.default)).slice(0, 18))) + '</span>' +
        '<span></span></div>';
    }).join('');
    return '<div class="wrdb-cols"><div class="wrdb-col-h" style="grid-template-columns:1.4fr 1fr 60px 60px 1fr">' +
      '<span>字段</span><span>类型</span><span>约束</span><span>默认值</span><span></span></div>' + rows + '</div>' +
      (S.addOpen ? addFieldHTML() : '') +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:14px">' +
      '<button class="wrdb-btn sm" data-act="addfield">' + (S.addOpen ? '收起' : '＋ 添加字段') + '</button>' +
      '<span class="sp" style="flex:1"></span>' +
      (isSys(S.table)
        ? '<span class="wrdb-hint" style="margin:0">系统自带的表不提供删除入口</span>'
        : '<button class="wrdb-btn sm danger" data-act="drop">删除这张表</button>') +
      '</div>' +
      (info.ddl ? '<div class="wrdb-label" style="margin-top:16px">建表语句</div>' +
        '<pre class="wrdb-code sm">' + esc(info.ddl) + '</pre>' : '');
  }

  function addFieldHTML() {
    var opts = TYPES.map(function (t) {
      return '<option value="' + t[0] + '">' + t[1] + '</option>';
    }).join('');
    return '<div class="wrdb-box" style="margin-top:14px">' +
      '<div class="wrdb-label">给这张表加一个字段</div>' +
      '<div style="display:grid;grid-template-columns:1.3fr 110px 1fr 78px;gap:8px;align-items:center">' +
      '<input class="wrdb-input" id="wrdbFn" placeholder="字段名" spellcheck="false" maxlength="41">' +
      '<select class="wrdb-select" id="wrdbFt">' + opts + '</select>' +
      '<input class="wrdb-input" id="wrdbFd" placeholder="默认值（可留空）" spellcheck="false">' +
      '<label class="wrdb-ck" style="gap:6px;font-size:11.5px;color:var(--ui-muted)">' +
      '<input type="checkbox" id="wrdbFnn">非空</label>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<button class="wrdb-btn primary sm" data-act="commitfield">确认添加</button>' +
      '<span class="wrdb-hint" style="margin:0">已有数据不会受影响；非空字段没填默认值时会自动补空字符串。</span>' +
      '</div></div>';
  }

  function apiHTML() {
    var cfg = S.cfg && S.cfg.table === S.table ? S.cfg : null;
    if (!cfg) return '<div class="wrdb-empty">正在读取接口配置…</div>';
    var has = !!cfg.token;
    var methods = String(cfg.methods || '').split(',');
    var paused = has && !methods.filter(function (m) { return m; }).length;
    var ep = cfg.endpoint || (location.origin + '/api/data/' + S.table);
    var state = !has ? '<span class="wrdb-chip">未开通</span>'
      : paused ? '<span class="wrdb-chip pause">已暂停</span>'
        : '<span class="wrdb-chip on">● 已开通</span>';
    var snippet = snippetOf(cfg, ep);

    return '<div class="wrdb-box">' +
      '<div class="wrdb-kv">状态 ' + state + '<span class="sp"></span>' +
      '<span class="wrdb-hint" style="margin:0">已调用 ' + nfmt(cfg.hits || 0) + ' 次</span></div>' +
      '</div>' +
      (S.cfgErr ? '<div class="wrdb-note err">' + esc(S.cfgErr) + '</div>' : '') +

      '<div class="wrdb-box"><div class="wrdb-kv">接口地址 <b>' + esc(ep) + '</b>' +
      '<button class="wrdb-btn sm ghost" data-act="copyep" style="margin-left:auto">⧉ 复制</button></div>' +
      '<div class="wrdb-tip">页面里用 fetch 调它就能读写这张表，访问者不需要登录；密钥相当于这张表的密码。</div></div>' +

      '<div class="wrdb-box"><div class="wrdb-kv">密钥 ' +
      (has ? '<code style="font-family:var(--mono);font-size:11.5px;color:var(--accent)">' +
        esc(cfg.token) + '</code>' +
        '<button class="wrdb-btn sm ghost" data-act="copykey">⧉ 复制</button>' +
        '<button class="wrdb-btn sm danger" data-act="resetkey">重置</button>'
        : '<span style="color:var(--ui-faint);font-family:var(--font)">还没生成</span>' +
        '<button class="wrdb-btn sm primary" data-act="genkey" style="margin-left:auto">生成密钥</button>') +
      '</div>' +
      '<div class="wrdb-tip">重置后旧密钥立刻失效，已经发布的页面要跟着换；只改下面的开关不会换密钥。</div></div>' +

      '<div class="wrdb-box"><div class="wrdb-label" style="margin-bottom:8px">开放的操作</div>' +
      '<div class="wrdb-seg">' +
      '<button data-act="method" data-m="GET" class="' + (methods.indexOf('GET') >= 0 ? 'on' : '') + '">读取 GET</button>' +
      '<button data-act="method" data-m="POST" class="' + (methods.indexOf('POST') >= 0 ? 'on' : '') + '">写入 POST</button>' +
      '</div>' +
      '<div class="wrdb-tip">关掉写入就只能读；两个都关掉等于暂停接口，密钥仍然保留，改回来页面不用换密钥。</div></div>' +

      '<div class="wrdb-label" style="margin:16px 0 8px">页面里怎么用</div>' +
      '<pre class="wrdb-code" id="wrdbSnippet">' + esc(snippet) + '</pre>' +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<button class="wrdb-btn sm primary" data-act="copysnippet">⧉ 复制这段代码</button>' +
      '<span class="wrdb-hint" style="margin:0">把「你的密钥」换成上面那串，字段按表的实际列名改。</span>' +
      '</div>';
  }

  /* 按表的真实字段生成提交 / 读取两段代码，用户不用自己拼 */
  function sampleOf(c) {
    if (c.type === 'integer' || c.type === 'real' || c.type === 'numeric') return '0';
    if (c.type === 'boolean') return 'true';
    if (c.type === 'date') return "'2026-01-01'";
    if (c.type === 'datetime') return "'2026-01-01 00:00:00'";
    return c.name === 'title' ? "'标题'" : "'示例文字'";
  }
  function snippetOf(cfg, ep) {
    /* 主键和有默认值的列不用手填，数据库会自己补 */
    var cols = (S.info && S.info.columns || []).filter(function (c) {
      return !c.pk && c.default == null;
    });
    var sample = cols.slice(0, 6).map(function (c) {
      return '  ' + c.name + ': ' + sampleOf(c);
    });
    var key = cfg.token ? cfg.token : '你的密钥';
    return "// 提交一条数据\nfetch('" + ep + "?key=" + key + "', {\n" +
      "  method: 'POST',\n" +
      "  headers: { 'Content-Type': 'application/json' },\n" +
      "  body: JSON.stringify({\n" + (sample.join(',\n') || "  // 这张表没有可写字段") + "\n  })\n" +
      "}).then(function (r) { return r.json(); }).then(console.log);\n\n" +
      "// 读最新 10 条\nfetch('" + ep + "?key=" + key + "&limit=10')\n" +
      "  .then(function (r) { return r.json(); })\n" +
      "  .then(function (res) { console.log(res.data); });";
  }

  /* ---------------- 交互 ---------------- */
  function onMaskClick(e) {
    var act = e.target.closest('[data-act]');
    if (!act) {
      if (e.target === $('#wrdbMask')) close();
      return;
    }
    var a = act.getAttribute('data-act');
    if (a === 'close') return close();
    if (a === 'reload') return refresh();
    if (a === 'new') return startNew();
    if (a === 'cancelnew') { S.view = S.table ? 'table' : 'list'; S.err = ''; return render(); }
    if (a === 'pick') {
      S.table = act.getAttribute('data-table');
      S.view = 'table'; S.tab = 'struct'; S.addOpen = false; S.err = '';
      render();
      return loadTable(S.table).then(function () { if (S.view === 'table') render(); });
    }
    if (a === 'tab') {
      S.tab = act.getAttribute('data-tab');
      S.err = '';
      render();
      if (S.tab === 'api' && (!S.cfg || S.cfg.table !== S.table)) loadCfg(S.table).then(function () { render(); });
      if (S.tab === 'struct' && (!S.info || S.info.name !== S.table)) loadTable(S.table).then(function () { render(); });
      return;
    }
    if (a === 'addcol') {
      S.draft.cols.push({ name: '', type: 'text', pk: false, notnull: false, def: '' });
      return render();
    }
    if (a === 'delcol') {
      var i = Number(act.getAttribute('data-i'));
      S.draft.cols.splice(i, 1);
      if (!S.draft.cols.length) S.draft.cols.push({ name: '', type: 'text' });
      return render();
    }
    if (a === 'create') return createTable();
    if (a === 'addfield') { S.addOpen = !S.addOpen; return render(); }
    if (a === 'commitfield') return addField();
    if (a === 'drop') return dropTable();
    if (a === 'genkey') return saveApi(true);
    if (a === 'resetkey') {
      if (window.confirm('重置密钥？旧密钥会立刻失效，已经用它的页面要改成新密钥。')) saveApi(true);
      return;
    }
    if (a === 'copykey') return copyText(S.cfg.token, '✓ 密钥已复制');
    if (a === 'copyep') return copyText(S.cfg.endpoint || (location.origin + '/api/data/' + S.table), '✓ 接口地址已复制');
    if (a === 'copysnippet') return copyText(snippetOf(S.cfg, S.cfg.endpoint || (location.origin + '/api/data/' + S.table)), '✓ 代码已复制');
    if (a === 'method') {
      act.classList.toggle('on');
      return saveApi(false);
    }
  }

  /* 输入类控件单独绑，避免整块重绘打断输入 */
  function bindForm() {
    var name = $('#wrdbName');
    if (name) {
      name.addEventListener('input', function () {
        S.draft.name = name.value;
        var ddl = $('#wrdbDdl');
        if (ddl) ddl.textContent = ddlOf(S.draft);
      });
    }
    $$('#wrdbMain .wrdb-col[data-i]').forEach(function (row) {
      var i = Number(row.getAttribute('data-i'));
      $$('[data-f]', row).forEach(function (inp) {
        inp.addEventListener('input', function () {
          var f = inp.getAttribute('data-f');
          if (f === 'pk' || f === 'notnull') S.draft.cols[i][f] = inp.checked;
          else S.draft.cols[i][f] = inp.value;
          var ddl = $('#wrdbDdl');
          if (ddl) ddl.textContent = ddlOf(S.draft);
        });
        if (inp.type === 'checkbox') {
          inp.addEventListener('change', function () {
            S.draft.cols[i][inp.getAttribute('data-f')] = inp.checked;
            var ddl = $('#wrdbDdl');
            if (ddl) ddl.textContent = ddlOf(S.draft);
          });
        }
      });
    });
  }

  function startNew() {
    S.view = 'new';
    S.err = '';
    S.draft = {
      name: '',
      cols: [
        { name: 'title', type: 'text', notnull: true, def: '' },
        { name: 'body', type: 'text', notnull: false, def: '' },
        { name: 'created_at', type: 'datetime', notnull: false, def: 'CURRENT_TIMESTAMP' }
      ]
    };
    render();
    var n = $('#wrdbName');
    if (n) n.focus();
  }

  function createTable() {
    if (S.busy) return;
    var name = String(S.draft.name || '').trim().toLowerCase();
    if (!name) { S.err = '先给表起个名字'; return render(); }
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(name)) {
      S.err = '表名要小写字母开头，2–41 位，只能用字母、数字、下划线';
      return render();
    }
    if (RESERVED.indexOf(name) >= 0) { S.err = '「' + name + '」是系统保留名，换一个'; return render(); }
    var cols = S.draft.cols.filter(function (c) { return String(c.name || '').trim(); });
    if (!cols.length) { S.err = '至少填一个字段'; return render(); }
    var payload = cols.map(function (c) {
      return {
        name: String(c.name).trim().toLowerCase(), type: c.type,
        notnull: !!c.notnull, pk: !!c.pk, default: String(c.def || '').trim(), unique: false
      };
    });
    S.busy = true;
    api('/create-table', { method: 'POST', body: { table: name, columns: payload } }).then(function (d) {
      S.busy = false;
      if (!d.ok) { S.err = d.msg || '创建失败'; return render(); }
      toast('✓ 数据表 ' + name + ' 已创建');
      S.table = name; S.view = 'table'; S.tab = 'api'; S.err = '';
      S.cfg = null;
      return loadOverview().then(function () {
        render();
        return loadTable(name).then(function () { return loadCfg(name).then(function () { render(); }); });
      });
    });
  }

  function addField() {
    if (S.busy) return;
    var n = $('#wrdbFn'), t = $('#wrdbFt'), d = $('#wrdbFd'), nn = $('#wrdbFnn');
    var col = String(n && n.value || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,40}$/.test(col)) { S.err = '字段名不合法：小写字母开头，只能用字母、数字、下划线'; return render(); }
    S.busy = true;
    api('/alter-table', {
      method: 'POST',
      body: { table: S.table, columns: [{ name: col, type: t.value, notnull: !!(nn && nn.checked), default: String(d.value || '').trim() }] }
    }).then(function (r) {
      S.busy = false;
      if (!r.ok) { S.err = r.msg || '添加失败'; return render(); }
      toast('✓ 已添加字段 ' + col);
      S.err = ''; S.addOpen = false;
      return loadOverview().then(function () { return loadTable(S.table).then(function () { render(); }); });
    });
  }

  function dropTable() {
    var name = S.table;
    var typed = window.prompt('删除「' + name + '」会把这张表和里面的数据一起删掉，不能撤销。\n请输入表名确认：', '');
    if (typed == null) return;
    if (typed.trim() !== name) { toast('表名不一致，已取消', true); return; }
    api('/drop-table', { method: 'POST', body: { table: name, confirm: name } }).then(function (d) {
      if (!d.ok) { S.err = d.msg || '删除失败'; return render(); }
      toast('✓ 已删除 ' + name);
      S.table = ''; S.view = 'list'; S.info = null; S.cfg = null;
      return loadOverview().then(function () {
        if (!S.table && S.tables.length) { S.table = S.tables[0].name; S.view = 'table'; }
        render();
        if (S.view === 'table') loadTable(S.table).then(function () { render(); });
      });
    });
  }

  function saveApi(reset) {
    if (!S.cfg || S.cfg.table !== S.table) return;
    var picked = $$('#wrdbMain .wrdb-seg button.on').map(function (b) { return b.getAttribute('data-m'); });
    api('/api/' + encodeURIComponent(S.table), {
      method: 'POST',
      body: { methods: picked.join(','), reset: !!reset }
    }).then(function (d) {
      if (!d.ok) { toast(d.msg || '保存失败', true); return; }
      S.cfg = d;
      toast(reset ? '✓ 已生成新密钥' : (picked.length ? '✓ 接口设置已保存' : '✓ 接口已暂停'));
      render();
    });
  }

  /* ---------------- 打开 / 关闭 ---------------- */
  function refresh() {
    S.err = '';
    return loadOverview().then(function () {
      render();
      if (S.view === 'table' && S.table) {
        return loadTable(S.table).then(function () {
          if (S.tab === 'api') return loadCfg(S.table).then(function () { render(); });
          render();
        });
      }
    });
  }

  function open() {
    injectCSS();
    var mask = shell();
    mask.hidden = false;
    S.err = '';
    if (location.protocol === 'file:') {
      S.token = ''; S.err = '编辑器是通过 file:// 打开的，读不到接口。请在项目目录运行 python app.py，再打开 http://127.0.0.1:5000/editor.html';
      return renderLock();
    }
    $('#wrdbMain').innerHTML = '<div class="wrdb-pane"><div class="wrdb-empty">正在读取数据库…</div></div>';
    refresh();
  }
  function close() {
    var mask = $('#wrdbMask');
    if (mask) mask.hidden = true;
  }

  /* ---------------- 挂载 ---------------- */
  function mount() {
    if ($('#wrdbOpen')) return;
    var anchor = $('#motionBtn');
    if (!anchor || !anchor.parentNode) return;
    var b = document.createElement('button');
    b.className = 'tb-btn';
    b.id = 'wrdbOpen';
    b.type = 'button';
    b.title = '数据后台：图形化建表 + 一键开数据接口（给页面存数据用）';
    b.textContent = '⚙ 数据';
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
    b.addEventListener('click', open);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  setTimeout(mount, 900);          /* app.js 若晚一步渲染顶栏，这里补挂一次 */

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var mask = $('#wrdbMask');
    if (mask && !mask.hidden) { close(); e.stopPropagation(); }
  }, true);

  window.WRDB = { open: open, close: close, state: S };
})();
