/* ============================================================
   建站工坊 · 门户逻辑（Flask 后端 + 本地降级）

   - 通过 Flask 打开（http://...）：账号 / 项目 / 模板存 SQLite，
     使用服务端签名会话，换设备登录也能继续编辑。
   - 直接双击 index.html（file://）或没有 API 的静态服务器：
     自动降级为 localStorage 演示模式，功能保持可用。
   ============================================================ */
(function () {
  'use strict';

  var K = {
    users: 'pt_users_v1',
    session: 'pt_session_v1',
    projects: 'pt_projects_v1',
    templates: 'pt_templates_v1'
  };

  var MODE = 'local'; // 'flask' | 'local'
  var CACHE = { user: null, projects: [], templates: [] };

  /* ---------- 本地降级用存储工具 ---------- */
  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { toast('本地空间不足，保存失败', true); return false; }
  }
  function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  // 本地演示用的不可逆摘要（不是加密，仅避免明文展示密码）
  function hashPass(s) {
    var h = 5381, i;
    s = 'pt$' + String(s);
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'h' + (h >>> 0).toString(36) + s.length.toString(36);
  }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function timeStr(ts) {
    var d = new Date(ts), now = new Date();
    var same = d.toDateString() === now.toDateString();
    var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return same ? ('今天 ' + hm) : ((d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ============================================================
     API 数据层：优先 Flask，失败自动降级
     ============================================================ */
  function api(path, options) {
    options = options || {};
    var init = {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    };
    if (options.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    return fetch(path, init).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!j) throw new Error('bad response');
        return j;
      });
    });
  }

  function loadLocal() {
    var id = read(K.session, null);
    var users = read(K.users, []);
    CACHE.user = id ? (users.filter(function (u) { return u.id === id; })[0] || null) : null;
    CACHE.projects = read(K.projects, []);
    CACHE.templates = read(K.templates, []);
  }

  function refresh() {
    if (MODE !== 'flask') { loadLocal(); return Promise.resolve(); }
    return Promise.all([
      api('/api/me'),
      api('/api/projects'),
      api('/api/templates')
    ]).then(function (r) {
      CACHE.user = r[0].user || null;
      CACHE.projects = r[1].items || [];
      CACHE.templates = r[2].items || [];
    }).catch(function () { loadLocal(); });
  }

  function initData() {
    return new Promise(function (resolve) {
      if (typeof window.fetch !== 'function') { loadLocal(); return resolve(); }
      var done = false;
      function finish() { if (!done) { done = true; resolve(); } }
      // 探测后端：超时 1.5s，避免静态环境下卡住首屏
      setTimeout(finish, 1500);
      try {
        var init = { method: 'GET', cache: 'no-store' };
        if (typeof AbortController === 'function') {
          var ctl = new AbortController();
          init.signal = ctl.signal;
          setTimeout(function () { ctl.abort(); }, 1400);
        }
        fetch('/api/health', init).then(function (r) {
          return r.ok ? r.json() : null;
        }).then(function (j) {
          if (j && j.backend === 'flask') MODE = 'flask';
          return refresh();
        }).catch(loadLocal).then(function () { lateRender(); finish(); }, function () { lateRender(); finish(); });
      } catch (e) { loadLocal(); finish(); }
    });
  }

  /* ---------- 统一的缓存读取（渲染函数保持同步） ---------- */
  function currentUser() { return CACHE.user; }
  function projects() { return CACHE.projects; }
  function myProjects(uid_) {
    return CACHE.projects.filter(function (p) { return p.ownerId === uid_; });
  }
  function allTemplates() { return CACHE.templates; }
  function myTemplates(uid_) {
    return CACHE.templates.filter(function (t) { return t.ownerId === uid_; });
  }
  function saveLocalProjects(list) {
    if (!write(K.projects, list)) return false;
    CACHE.projects = list;
    return true;
  }
  function saveLocalTemplates(list) {
    if (!write(K.templates, list)) return false;
    CACHE.templates = list;
    return true;
  }

  /* ---------- 提示 ---------- */
  var toastEl, toastTimer;
  function toast(msg, err) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'pt-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = 'pt-toast show' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'pt-toast'; }, 2600);
  }
  function authNote() {
    return MODE === 'flask'
      ? '🔒 账号与数据保存在服务器数据库中，登录后可在任意设备继续编辑。'
      : '🔒 本地演示版：账号与数据只保存在这台设备的浏览器里，不上传服务器。清理浏览器数据会一并清除。';
  }

  /* ============================================================
     账号操作（返回 Promise）
     ============================================================ */
  function register(name, email, pass, code) {
    email = String(email || '').trim().toLowerCase();
    name = String(name || '').trim();
    if (!name) return Promise.resolve({ ok: false, msg: '请填写昵称' });
    if (!validEmail(email)) return Promise.resolve({ ok: false, msg: '邮箱格式不正确' });
    if (String(pass || '').length < 6) return Promise.resolve({ ok: false, msg: '密码至少 6 位' });
    if (MODE === 'flask') {
      return api('/api/register', {
        method: 'POST',
        body: { name: name, email: email, password: pass, code: String(code || '').trim() }
      }).then(function (res) {
        if (!res.ok) return res;
        return refresh().then(function () { return res; });
      }).catch(function () { return { ok: false, msg: '连接服务器失败，请稍后重试' }; });
    }
    var list = read(K.users, []);
    if (list.some(function (u) { return u.email === email; })) {
      return Promise.resolve({ ok: false, msg: '该邮箱已注册，请直接登录' });
    }
    var u = { id: uid(), name: name.slice(0, 24), email: email, pass: hashPass(pass), createdAt: Date.now() };
    list.push(u);
    if (!write(K.users, list)) return Promise.resolve({ ok: false, msg: '保存失败' });
    write(K.session, u.id);
    loadLocal();
    return Promise.resolve({ ok: true, user: u });
  }

  function login(email, pass) {
    email = String(email || '').trim().toLowerCase();
    if (MODE === 'flask') {
      return api('/api/login', {
        method: 'POST', body: { email: email, password: pass }
      }).then(function (res) {
        if (!res.ok) return res;
        return refresh().then(function () { return res; });
      }).catch(function () { return { ok: false, msg: '连接服务器失败，请稍后重试' }; });
    }
    var u = read(K.users, []).filter(function (x) { return x.email === email; })[0];
    if (!u) return Promise.resolve({ ok: false, msg: '邮箱未注册' });
    if (u.pass !== hashPass(pass)) return Promise.resolve({ ok: false, msg: '密码不正确' });
    write(K.session, u.id);
    loadLocal();
    return Promise.resolve({ ok: true, user: u });
  }

  function logout() {
    if (MODE === 'flask') {
      return api('/api/logout', { method: 'POST' }).catch(function () {})
        .then(function () { CACHE.user = null; CACHE.projects = []; CACHE.templates = []; });
    }
    write(K.session, null);
    loadLocal();
    return Promise.resolve();
  }

  /* ============================================================
     项目操作（按用户隔离）
     ============================================================ */
  function saveProject(data, name) {
    var u = currentUser();
    if (!u) return Promise.resolve({ ok: false, msg: '请先登录再保存到账号' });
    var nm = String(name || (data && data.name) || '未命名页面').slice(0, 80);
    if (MODE === 'flask') {
      return api('/api/projects', {
        method: 'POST', body: { name: nm, data: data }
      }).then(function (res) {
        if (!res.ok) return res;
        return refresh().then(function () {
          if (document.body && document.body.getAttribute('data-pt-page') === 'home') renderMyProjects();
          return res;
        });
      }).catch(function () { return { ok: false, msg: '保存失败，请检查网络' }; });
    }
    var list = projects();
    var existing = null;
    // 用「同名项目」作为更新依据，避免重复堆叠
    for (var i = 0; i < list.length; i++) {
      if (list[i].ownerId === u.id && list[i].name === nm) { existing = list[i]; break; }
    }
    if (existing) {
      existing.data = data; existing.name = nm; existing.updatedAt = Date.now();
    } else {
      list.unshift({ id: uid(), ownerId: u.id, name: nm, data: data, createdAt: Date.now(), updatedAt: Date.now() });
    }
    if (!saveLocalProjects(list)) return Promise.resolve({ ok: false, msg: '保存失败' });
    if (document.body && document.body.getAttribute('data-pt-page') === 'home') renderMyProjects();
    return Promise.resolve({ ok: true });
  }

  function deleteProject(id) {
    if (MODE === 'flask') {
      return api('/api/projects/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(refresh).then(function () { return { ok: true }; })
        .catch(function () { return { ok: false, msg: '删除失败' }; });
    }
    var u = currentUser();
    if (!u) return Promise.resolve(false);
    return Promise.resolve(saveLocalProjects(projects().filter(function (p) {
      return !(p.id === id && p.ownerId === u.id);
    })));
  }

  /* ============================================================
     模板操作
     ============================================================ */
  function builtinTemplates() { return (window.WR_TEMPLATES || []).slice(); }
  function templateById(id) {
    var b = builtinTemplates().filter(function (t) { return t.id === id; })[0];
    if (b) return b;
    return allTemplates().filter(function (t) { return t.id === id; })[0] || null;
  }
  function saveAsTemplate(data, name, desc) {
    var u = currentUser();
    if (!u) return Promise.resolve({ ok: false, msg: '请先登录再保存模板' });
    if (MODE === 'flask') {
      return api('/api/templates', {
        method: 'POST',
        body: { name: name, desc: desc, data: data }
      }).then(function (res) {
        if (!res.ok) return res;
        return refresh().then(function () {
          return { ok: true, template: allTemplates().filter(function (t) { return t.id === res.id; })[0] };
        });
      }).catch(function () { return { ok: false, msg: '保存失败，请检查网络' }; });
    }
    var t = {
      id: 'tpl_' + uid(), name: String(name || '我的模板').slice(0, 40),
      desc: String(desc || '由我的页面保存的模板').slice(0, 120),
      category: '我的模板', tags: ['自定义'], color: '#64748b', emoji: '⭐',
      ownerId: u.id, data: data, createdAt: Date.now()
    };
    var list = allTemplates();
    list.unshift(t);
    if (!saveLocalTemplates(list)) return Promise.resolve({ ok: false, msg: '保存失败' });
    return Promise.resolve({ ok: true, template: t });
  }
  function deleteTemplate(id) {
    if (MODE === 'flask') {
      return api('/api/templates/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(refresh).then(function () { return { ok: true }; })
        .catch(function () { return { ok: false, msg: '删除失败' }; });
    }
    var u = currentUser();
    if (!u) return Promise.resolve(false);
    return Promise.resolve(saveLocalTemplates(allTemplates().filter(function (t) {
      return !(t.id === id && t.ownerId === u.id);
    })));
  }

  /* ============================================================
     载入到编辑器：写草稿键 → 跳转 editor.html
     ============================================================ */
  function openInEditor(data, from) {
    try { localStorage.setItem('wr-studio-project-v1', JSON.stringify(data)); }
    catch (e) { toast('本地空间不足，无法载入', true); return; }
    var url = 'editor.html';
    var q = [];
    if (from) q.push('from=' + encodeURIComponent(from));
    if (q.length) url += '?' + q.join('&');
    window.location.href = url;
  }
  function useTemplate(id) {
    var t = templateById(id);
    if (!t || !t.data) { toast('模板不存在', true); return; }
    openInEditor(clone(t.data), 'tpl:' + t.id);
  }
  function continueProject(id) {
    var p = projects().filter(function (x) { return x.id === id; })[0];
    if (!p) { toast('项目不存在', true); return; }
    openInEditor(clone(p.data), 'proj:' + id);
  }

  /* ============================================================
     首页渲染
     ============================================================ */
  function renderAuthArea() {
    var guest = document.getElementById('ptGuest');
    var auth = document.getElementById('ptAuth');
    if (!guest || !auth) return;
    var u = currentUser();
    if (u) {
      guest.classList.add('pt-hide');
      auth.classList.remove('pt-hide');
      var nm = document.getElementById('ptUserName');
      var av = document.getElementById('ptAvatar');
      if (nm) nm.textContent = u.name;
      if (av) av.textContent = (u.name || u.email || '用').slice(0, 1).toUpperCase();
      var dbItem = document.querySelector('[data-useract="dbadmin"]');
      if (dbItem) dbItem.style.display = u.isAdmin ? '' : 'none';
      var dbLinks = document.querySelectorAll('[data-admin-only]');
      for (var di = 0; di < dbLinks.length; di++) dbLinks[di].hidden = !u.isAdmin;
    } else {
      guest.classList.remove('pt-hide');
      auth.classList.add('pt-hide');
    }
  }

  var tplCategory = '全部';
  function renderTemplates() {
    var grid = document.getElementById('ptTplGrid');
    if (!grid) return;
    var u = currentUser();
    var builtin = builtinTemplates();
    var mine = u ? myTemplates(u.id) : [];
    var all = mine.concat(builtin);
    var cats = ['全部'];
    if (mine.length) cats.push('我的模板');
    builtin.forEach(function (t) { if (cats.indexOf(t.category) < 0) cats.push(t.category); });
    if (cats.indexOf(tplCategory) < 0) tplCategory = '全部';

    var tabs = document.getElementById('ptTplTabs');
    if (tabs) {
      tabs.innerHTML = cats.map(function (c) {
        return '<button class="pt-tab' + (c === tplCategory ? ' active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('');
    }
    var list = tplCategory === '全部' ? all : all.filter(function (t) { return t.category === tplCategory; });
    if (!list.length) {
      grid.innerHTML = '<div class="pt-empty"><div class="pt-ico">🗂️</div><div>这里还没有模板</div></div>';
      return;
    }
    grid.innerHTML = list.map(function (t) {
      var isMine = !!t.ownerId;
      var cover = t.color || '#2563eb';
      return '<article class="pt-tpl-card">' +
        '<div class="pt-tpl-cover" style="background:linear-gradient(135deg,' + esc(cover) + ',' + esc(shade(cover, -28)) + ')">' +
        '<span class="pt-emoji">' + esc(t.emoji || '✦') + '</span>' +
        '<div class="pt-mini"><i></i><i></i><i></i></div></div>' +
        '<div class="pt-tpl-body">' +
        '<div class="pt-tpl-top"><span class="pt-tpl-cat">' + esc(t.category || '模板') + '</span>' +
        (isMine ? '<span class="pt-tpl-mine">我的</span>' : '') + '</div>' +
        '<h3>' + esc(t.name) + '</h3>' +
        '<p>' + esc(t.desc || '') + '</p>' +
        '<div class="pt-tpl-tags">' + (t.tags || []).map(function (g) { return '<span>' + esc(g) + '</span>'; }).join('') + '</div>' +
        '<div class="pt-tpl-actions">' +
        '<button class="pt-btn pt-btn-primary pt-btn-sm" data-use="' + esc(t.id) + '">使用此模板</button>' +
        (isMine ? '<button class="pt-btn pt-btn-ghost pt-btn-sm" data-deltpl="' + esc(t.id) + '" title="删除模板">删除</button>' : '') +
        '</div></div></article>';
    }).join('');
  }
  function shade(hex, amt) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return '#1e3a8a';
    var n = parseInt(m[1], 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function renderMyProjects() {
    var box = document.getElementById('ptMyProjects');
    // section 的 id 同时是导航锚点 #projects
    var section = document.getElementById('projects') || document.getElementById('ptProjectsSection');
    if (!box || !section) return;
    var u = currentUser();
    if (!u) { section.classList.add('pt-hide'); return; }
    var list = myProjects(u.id);
    if (!list.length) {
      section.classList.add('pt-hide');
      return;
    }
    section.classList.remove('pt-hide');
    box.innerHTML = list.map(function (p) {
      return '<div class="pt-project">' +
        '<div class="pt-project-ico">📄</div>' +
        '<h4 title="' + esc(p.name) + '">' + esc(p.name) + '</h4>' +
        '<div class="pt-meta">更新于 ' + timeStr(p.updatedAt) + '</div>' +
        '<div class="pt-row">' +
        '<button class="pt-btn pt-btn-primary pt-btn-sm" data-proj="' + esc(p.id) + '">继续编辑</button>' +
        '<button class="pt-btn pt-btn-ghost pt-btn-sm" data-delproj="' + esc(p.id) + '" title="删除项目">删除</button>' +
        '</div></div>';
    }).join('');
  }

  /* ============================================================
     弹窗：登录 / 注册
     ============================================================ */
  function openAuth(mode) {
    var mask = document.getElementById('ptAuthMask');
    if (!mask) { toast('登录组件未加载'); return; }
    renderAuthModal(mode);
    mask.classList.add('open');
  }
  function closeAuth() {
    var mask = document.getElementById('ptAuthMask');
    if (mask) mask.classList.remove('open');
  }
  /* ---------- 邮箱验证码 ---------- */
  function sendCode(email, purpose) {
    email = String(email || '').trim().toLowerCase();
    if (!validEmail(email)) return Promise.resolve({ ok: false, msg: '邮箱格式不正确' });
    if (MODE !== 'flask') return Promise.resolve({ ok: false, msg: '本地演示版无需验证码' });
    return api('/api/auth/send-code', {
      method: 'POST', body: { email: email, purpose: purpose || 'register' }
    }).catch(function () { return { ok: false, msg: '连接服务器失败，请稍后重试' }; });
  }

  function resetPassword(email, code, pass) {
    email = String(email || '').trim().toLowerCase();
    if (MODE !== 'flask') return Promise.resolve({ ok: false, msg: '本地演示版不支持找回密码' });
    return api('/api/auth/reset-password', {
      method: 'POST',
      body: { email: email, code: String(code || '').trim(), password: pass }
    }).catch(function () { return { ok: false, msg: '连接服务器失败，请稍后重试' }; });
  }

  function bindAuthShell(box) {
    var close = box.querySelector('[data-closeauth]');
    if (close) close.addEventListener('click', closeAuth);
    var sw = box.querySelector('[data-authmode]');
    if (sw) sw.addEventListener('click', function () { renderAuthModal(sw.getAttribute('data-authmode')); });
  }

  function bindCodeRow(box, purpose) {
    var btn = box.querySelector('#ptSendCode');
    if (!btn) return;
    var emailInput = box.querySelector('#ptFEmail');
    var codeInput = box.querySelector('#ptFCode');
    var tip = box.querySelector('#ptCodeTip');
    var err = box.querySelector('#ptErr');

    btn.addEventListener('click', function () {
      var email = emailInput.value;
      err.textContent = '';
      if (!validEmail(String(email).trim())) {
        err.textContent = '请先填写正确的邮箱';
        emailInput.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = '发送中…';
      sendCode(email, purpose).then(function (res) {
        if (!res.ok) {
          btn.disabled = false;
          btn.textContent = '获取验证码';
          err.textContent = res.msg || '发送失败';
          return;
        }
        tip.className = 'pt-code-tip' + (res.dev ? ' dev' : '');
        tip.textContent = (res.msg || '验证码已发送') + (res.dev && res.devCode ? '：' + res.devCode : '');
        if (res.dev && res.devCode) codeInput.value = res.devCode;
        codeInput.focus();
        var left = res.cooldown || 60;
        btn.textContent = left + ' 秒后重发';
        var timer = setInterval(function () {
          left -= 1;
          if (left <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            btn.textContent = '重新获取';
            return;
          }
          btn.textContent = left + ' 秒后重发';
        }, 1000);
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = '获取验证码';
        err.textContent = '发送失败，请稍后重试';
      });
    });
  }

  function bindAuthSubmit(box, opt) {
    box.querySelector('#ptAuthForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = box.querySelector('#ptErr');
      var submit = box.querySelector('button[type="submit"]');
      err.textContent = '';
      submit.disabled = true;
      submit.textContent = '请稍候…';

      var email = box.querySelector('#ptFEmail').value;
      var pass = box.querySelector('#ptFPass').value;
      var codeEl = box.querySelector('#ptFCode');
      var code = codeEl ? codeEl.value : '';
      var p;
      if (opt.isReset) p = resetPassword(email, code, pass);
      else if (opt.isReg) p = register(box.querySelector('#ptFName').value, email, pass, code);
      else p = login(email, pass);

      Promise.resolve(p).then(function (res) {
        submit.disabled = false;
        submit.textContent = opt.label;
        if (!res.ok) { err.textContent = res.msg; return; }
        if (opt.isReset) {
          toast('密码已重置，请用新密码登录');
          renderAuthModal('login');
          return;
        }
        closeAuth();
        toast(opt.isReg ? '注册成功，欢迎！' : '登录成功');
        renderAuthArea();
        renderTemplates();
        renderMyProjects();
        if (typeof onLogin === 'function') { var fn = onLogin; onLogin = null; fn(res.user); }
      }).catch(function () {
        submit.disabled = false;
        submit.textContent = opt.label;
        err.textContent = '操作失败，请稍后重试';
      });
    });
  }

  function renderAuthModal(mode) {
    var box = document.getElementById('ptAuthModal');
    var isReg = mode === 'register';
    var isReset = mode === 'reset';
    var label = isReset ? '重置密码' : (isReg ? '注册并登录' : '登录');

    // 本地演示版没有服务端，找回密码无从谈起
    if (isReset && MODE !== 'flask') {
      box.innerHTML =
        '<button class="pt-modal-close" data-closeauth aria-label="关闭">✕</button>' +
        '<h2>找回密码</h2>' +
        '<p class="pt-sub">本地演示版没有服务器，账号只保存在这台设备的浏览器里。</p>' +
        '<div class="pt-auth-note">忘记密码时可以清理浏览器数据后重新注册（本地项目会一并清除），或直接用另一个邮箱注册。</div>' +
        '<div class="pt-auth-switch"><a data-authmode="login">返回登录</a></div>';
      bindAuthShell(box);
      return;
    }

    var needCode = MODE === 'flask' && (isReg || isReset);

    box.innerHTML =
      '<button class="pt-modal-close" data-closeauth aria-label="关闭">✕</button>' +
      '<h2>' + (isReset ? '找回密码' : (isReg ? '创建账号' : '欢迎回来')) + '</h2>' +
      '<p class="pt-sub">' + (isReset
        ? '验证邮箱后设置新密码，验证码 10 分钟内有效。'
        : (isReg ? '注册后即可保存项目与模板，随时继续编辑。' : '登录以继续管理你的项目和模板。')) + '</p>' +
      '<form id="ptAuthForm" novalidate>' +
      (isReg ? '<div class="pt-field"><label>昵称</label><input id="ptFName" autocomplete="nickname" placeholder="怎么称呼你"></div>' : '') +
      '<div class="pt-field"><label>邮箱</label><input id="ptFEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>' +
      (needCode
        ? '<div class="pt-field"><label>邮箱验证码</label>' +
          '<div class="pt-code-row">' +
          '<input id="ptFCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6 位数字">' +
          '<button type="button" class="pt-code-btn" id="ptSendCode">获取验证码</button>' +
          '</div><div class="pt-code-tip" id="ptCodeTip"></div></div>'
        : '') +
      '<div class="pt-field"><label>' + (isReset ? '新密码' : '密码') + '</label>' +
      '<input id="ptFPass" type="password" autocomplete="' + (isReset || isReg ? 'new-password' : 'current-password') + '" placeholder="至少 6 位"></div>' +
      '<div class="pt-err" id="ptErr"></div>' +
      '<button class="pt-btn pt-btn-primary pt-btn-block pt-btn-lg" type="submit">' + label + '</button>' +
      '</form>' +
      '<div class="pt-auth-switch">' + (isReset
        ? '<a data-authmode="login">返回登录</a>'
        : (isReg
          ? '已有账号？<a data-authmode="login">立即登录</a>'
          : '还没有账号？<a data-authmode="register">免费注册</a> · <a data-authmode="reset">忘记密码</a>')) +
      '</div>' +
      '<div class="pt-auth-note">' + (isReset
        ? '📮 验证码会发送到你的邮箱，10 分钟内有效，请勿泄露给他人。'
        : (isReg && MODE === 'flask' ? '📮 注册需要邮箱验证码，用于确认邮箱真实可用。' : authNote())) +
      '</div>';

    bindAuthShell(box);
    bindCodeRow(box, isReset ? 'reset' : 'register');
    bindAuthSubmit(box, { isReg: isReg, isReset: isReset, label: label });
  }

  // 供页面覆盖：登录成功后的额外动作
  var onLogin = null;

  /* ============================================================
     用户下拉菜单
     ============================================================ */
  function bindUserMenu() {
    var chip = document.getElementById('ptUserChip');
    var dd = document.getElementById('ptDropdown');
    if (!chip || !dd) return;
    chip.addEventListener('click', function (e) { e.stopPropagation(); dd.classList.toggle('open'); });
    document.addEventListener('click', function () { dd.classList.remove('open'); });
    dd.addEventListener('click', function (e) {
      var act = e.target.getAttribute('data-useract');
      if (!act) return;
      e.stopPropagation();
      dd.classList.remove('open');
      if (act === 'dbadmin') { window.location.href = 'dbadmin.html'; }
      else if (act === 'projects') { window.location.href = 'index.html#projects'; }
      else if (act === 'templates') { window.location.href = 'index.html#templates'; }
      else if (act === 'logout') {
        Promise.resolve(logout()).then(function () {
          renderAuthArea(); renderTemplates(); renderMyProjects();
          window.location.href = 'index.html';
        });
      }
    });
  }

  /* ============================================================
     首页事件绑定
     ============================================================ */
  function bindHome() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      var el;
      if ((el = t.closest('[data-openauth]'))) { openAuth(el.getAttribute('data-openauth')); return; }
      if (t.closest('[data-closeauth]')) { closeAuth(); return; }
      if ((el = t.closest('[data-cat]'))) { tplCategory = el.getAttribute('data-cat'); renderTemplates(); return; }
      if ((el = t.closest('[data-use]'))) { useTemplate(el.getAttribute('data-use')); return; }
      if ((el = t.closest('[data-proj]'))) { continueProject(el.getAttribute('data-proj')); return; }
      if ((el = t.closest('[data-deltpl]'))) {
        if (window.confirm('确定删除这个模板吗？')) {
          Promise.resolve(deleteTemplate(el.getAttribute('data-deltpl'))).then(function (res) {
            if (res && res.ok === false) { toast(res.msg || '删除失败', true); return; }
            renderTemplates(); toast('模板已删除');
          });
        }
        return;
      }
      if ((el = t.closest('[data-delproj]'))) {
        if (window.confirm('确定删除这个项目吗？此操作不可恢复。')) {
          Promise.resolve(deleteProject(el.getAttribute('data-delproj'))).then(function (res) {
            if (res && res.ok === false) { toast(res.msg || '删除失败', true); return; }
            renderMyProjects(); toast('项目已删除');
          });
        }
        return;
      }
    });
    var mask = document.getElementById('ptAuthMask');
    if (mask) mask.addEventListener('click', function (e) { if (e.target === mask) closeAuth(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAuth(); });
  }

  /* ============================================================
     编辑器增强：顶栏账号 + 保存项目 / 存为模板
     ============================================================ */
  function bindEditor() {
    var slot = document.getElementById('ptEditorUser');
    if (slot) renderEditorUser(slot);
    var saveBtn = document.getElementById('ptSaveProject');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var u = currentUser();
      if (!u) {
        openAuth('login');
        onLogin = function () { toast('已登录，再点一次保存即可'); };
        return;
      }
      var data = window.__wrSite && window.__wrSite.getProject ? window.__wrSite.getProject() : null;
      if (!data) { toast('读取项目失败', true); return; }
      var name = window.prompt('保存为项目名称：', data.name || '未命名页面');
      if (name == null) return;
      Promise.resolve(saveProject(data, name.trim() || data.name)).then(function (res) {
        if (res.ok) { toast('✓ 已保存到「我的项目」'); updateSaveHint(); }
        else toast(res.msg, true);
      });
    });
    var tplBtn = document.getElementById('ptSaveTemplate');
    if (tplBtn) tplBtn.addEventListener('click', function () {
      var u = currentUser();
      if (!u) {
        openAuth('login');
        onLogin = function () { toast('已登录，再点一次即可存为模板'); };
        return;
      }
      var data = window.__wrSite && window.__wrSite.getProject ? window.__wrSite.getProject() : null;
      if (!data) { toast('读取项目失败', true); return; }
      var name = window.prompt('模板名称：', (data.name || '我的页面') + ' 模板');
      if (name == null) return;
      var desc = window.prompt('模板简介（选填）：', '从「' + (data.name || '我的页面') + '」保存的模板');
      if (desc == null) desc = '';
      Promise.resolve(saveAsTemplate(data, name.trim(), desc.trim())).then(function (res) {
        if (res.ok) toast('✓ 已保存到「我的模板」');
        else toast(res.msg, true);
      });
    });
    updateSaveHint();
  }
  function renderEditorUser(slot) {
    var u = currentUser();
    if (u) {
      slot.innerHTML =
        '<div class="pt-user-menu-wrap">' +
        '<button class="pt-user-chip" id="ptEdChip"><span class="pt-avatar">' + esc((u.name || u.email).slice(0, 1).toUpperCase()) + '</span><span class="pt-user-name">' + esc(u.name) + '</span></button>' +
        '<div class="pt-dropdown" id="ptEdDrop"><button data-ed="home">⌂ 返回首页</button><button data-ed="projects">▤ 我的项目</button><button data-ed="templates">✦ 模板库</button>' +
        (u.isAdmin ? '<button data-ed="dbadmin">⚙ 数据库管理</button>' : '') +
        '<hr><button data-ed="logout">退出登录</button></div>' +
        '</div>';
      var chip = slot.querySelector('#ptEdChip'), dd = slot.querySelector('#ptEdDrop');
      chip.addEventListener('click', function (e) { e.stopPropagation(); dd.classList.toggle('open'); });
      document.addEventListener('click', function () { dd.classList.remove('open'); });
      dd.addEventListener('click', function (e) {
        var a = e.target.getAttribute('data-ed'); if (!a) return;
        if (a === 'home') window.location.href = 'index.html';
        else if (a === 'projects') window.location.href = 'index.html#projects';
        else if (a === 'templates') window.location.href = 'index.html#templates';
        else if (a === 'dbadmin') window.location.href = 'dbadmin.html';
        else if (a === 'logout') {
          Promise.resolve(logout()).then(function () { renderEditorUser(slot); });
        }
      });
    } else {
      slot.innerHTML = '<button class="pt-btn pt-btn-ghost pt-btn-sm" data-openauth="login">登录</button>' +
        '<button class="pt-btn pt-btn-primary pt-btn-sm" data-openauth="register">注册</button>';
    }
  }
  function updateSaveHint() {
    var hint = document.getElementById('ptSaveHint');
    if (!hint) return;
    var u = currentUser();
    var cnt = u ? myProjects(u.id).length : 0;
    hint.textContent = u ? ('已保存 ' + cnt + ' 个项目') : '登录后可保存到账号';
  }

  /* ============================================================
     启动：先探测后端 / 加载数据，再渲染界面
     ============================================================ */
  var booted = false;
  function lateRender() {
    if (!booted || !document.body) return;
    var page = document.body.getAttribute('data-pt-page');
    if (page === 'home') {
      renderAuthArea(); renderTemplates(); renderMyProjects();
      var copy = document.getElementById('ptFooterCopy');
      if (copy && MODE === 'flask') copy.textContent = '© 2026 建站工坊 · 数据由 Flask 后端安全保存';
    } else if (page === 'editor') {
      updateSaveHint();
    }
  }

  function bootstrap() {
    booted = true;
    bindHome();
    // 支持 ?auth=register|login|reset 直接打开对应弹窗（方便分享链接与本地调试）
    var authParam = (location.search.match(/[?&]auth=(login|register|reset)(?:&|$)/) || [])[1];
    if (authParam) setTimeout(function () { openAuth(authParam); }, 200);
    var page = document.body.getAttribute('data-pt-page');
    if (page === 'home') {
      renderAuthArea(); renderTemplates(); renderMyProjects(); bindUserMenu();
      var copy = document.getElementById('ptFooterCopy');
      if (copy && MODE === 'flask') copy.textContent = '© 2026 建站工坊 · 数据由 Flask 后端安全保存';
    } else if (page === 'editor') {
      bindEditor();
      var mask = document.getElementById('ptAuthMask');
      if (mask) mask.addEventListener('click', function (e) { if (e.target === mask) closeAuth(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAuth(); });
      document.addEventListener('click', function (e) {
        var el = e.target.closest && e.target.closest('[data-openauth]');
        if (el) openAuth(el.getAttribute('data-openauth'));
      });
    }
  }

  initData().then(bootstrap);

  /* ---------- 模块（我的组件）云端同步 ---------- */
  function saveModules(items) {
    if (MODE !== 'flask') return Promise.resolve({ ok: false, msg: '需要 Flask 后端，本地模式请用文件导出' });
    return api('/api/modules', { method: 'POST', body: { items: items } })
      .catch(function () { return { ok: false, msg: '上传失败，请检查网络' }; });
  }
  function loadModules() {
    if (MODE !== 'flask') return Promise.resolve({ ok: false, msg: '需要 Flask 后端' });
    return api('/api/modules')
      .catch(function () { return { ok: false, msg: '读取失败，请检查网络' }; });
  }

  /* 对外暴露（供编辑器 / 调试） */
  window.WRPortal = {
    currentUser: currentUser,
    openAuth: openAuth,
    saveProject: saveProject,
    myProjects: myProjects,
    useTemplate: useTemplate,
    toast: toast,
    saveModules: saveModules,
    loadModules: loadModules,
    mode: function () { return MODE; }
  };
})();
