/* ===================================================================
   WR Studio · 拖拽建站工具
   纯前端 / 零依赖 / 数据只存在浏览器本地
   =================================================================== */
(function () {
  'use strict';

  /* ---------- 工具函数 ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var uid = function () { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var nl = function (v) { return esc(v).replace(/\r?\n/g, '<br>'); };
  /* CSS 声明值净化：去掉能闭合 style 属性或引入手写标记的字符。
     用户输入的颜色 / 背景 / 文案都可能被拼进 style="..."，这里是统一防线。 */
  function safeCssValue(v) {
    return String(v).replace(/["'<>{}@\\\u0000-\u001f\u007f]/g, '').replace(/;\s*$/, '');
  }
  var css = function (o) {
    return Object.keys(o).filter(function (k) {
      var v = o[k]; return v !== '' && v != null && v !== false && v !== undefined;
    }).map(function (k) { return k + ':' + safeCssValue(o[k]); }).join(';');
  };
  var clampFont = function (px) {
    var n = Number(px) || 32;
    return 'clamp(' + Math.max(16, Math.round(n * 0.62)) + 'px,5vw,' + n + 'px)';
  };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var toastTimer = null;
  function toast(msg, isError) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ---------- 字段定义 ---------- */
  var F = {
    align: { k: 'align', label: '对齐方式', type: 'seg', opts: [['left', '左'], ['center', '中'], ['right', '右']] },
    color: { k: 'color', label: '文字颜色', type: 'color' },
    bg: { k: 'bg', label: '区块背景', type: 'color', hint: '留空为透明' },
    fontSize: { k: 'fontSize', label: '字号', type: 'range', min: 12, max: 80, unit: 'px' },
    padY: { k: 'padY', label: '上下留白', type: 'range', min: 0, max: 120, unit: 'px' },
    padX: { k: 'padX', label: '左右留白', type: 'range', min: 0, max: 80, unit: 'px' },
    radius: { k: 'radius', label: '圆角', type: 'range', min: 0, max: 48, unit: 'px' },
    text: { k: 'text', label: '文字内容', type: 'textarea' },
    htmlCode: { k: 'htmlCode', label: 'HTML 代码', type: 'code', rows: 11, hint: 'script / style / on* 事件会被移除' },
    title: { k: 'title', label: '标题', type: 'text' },
    level: { k: 'level', label: '标题级别', type: 'select', opts: [['1', 'H1 大标题'], ['2', 'H2 中标题'], ['3', 'H3 小标题']] },
    href: { k: 'href', label: '链接地址', type: 'text', hint: '如 https://… 或 #section' },
    url: { k: 'url', label: '视频链接', type: 'text', hint: 'B站 / YouTube / 任意网页' },
    filmSrc: { k: 'filmSrc', label: '视频来源', type: 'film', hint: '选内置示例，或填视频直链 / 上传本地文件' },
    filmPoster: {
      k: 'filmPoster', label: '封面图', type: 'media', ph: '留空则用视频自带封面',
      hint: '视频加载前显示；内置示例自带封面，一般不用填'
    },
    filmMode: {
      k: 'filmMode', label: '播放方式', type: 'seg',
      opts: [['scroll', '随滚动播放'], ['loop', '进入循环'], ['click', '点击播放']],
      hint: '随滚动播放：往下滚多少就播到哪一帧'
    },
    filmH: { k: 'filmH', label: '视频高度', type: 'range', min: 240, max: 760, unit: 'px' },
    filmW: { k: 'filmW', label: '视频宽度', type: 'range', min: 40, max: 100, unit: '%' },
    src: { k: 'src', label: '图片地址', type: 'text', hint: '可填写网址，或用左侧上传的素材' },
    alt: { k: 'alt', label: '图片说明', type: 'text' },
    caption: { k: 'caption', label: '图片下方文字', type: 'text' },
    width: { k: 'width', label: '图片宽度', type: 'range', min: 20, max: 100, unit: '%' },
    items: { k: 'items', label: '条目', type: 'rows', cols: ['图标', '标题', '说明'], long: 2, mediaRows: true, hint: '第一格可填 emoji、图片网址或上传的图片' },
    author: { k: 'author', label: '署名', type: 'text' },
    btnBg: { k: 'btnBg', label: '按钮底色 / 边框色', type: 'color', hint: '留空跟随主题色或组件默认' },
    btnColor: { k: 'btnColor', label: '按钮文字色', type: 'color', hint: '留空跟随组件默认' },
    /* 独立按钮：所有内嵌按钮的组件共用这一套设置 */
    btnStyle: {
      k: 'btnStyle', label: '按钮样式', type: 'select',
      opts: [['auto', '跟随组件'], ['solid', '实心'], ['outline', '描边'], ['soft', '浅底'], ['ghost', '幽灵'], ['link', '文字链接']]
    },
    btnRadius: { k: 'btnRadius', label: '按钮圆角', type: 'range', min: 0, max: 60, unit: 'px' },
    btnPadX: { k: 'btnPadX', label: '左右内边距', type: 'range', min: 0, max: 60, unit: 'px' },
    btnPadY: { k: 'btnPadY', label: '上下内边距', type: 'range', min: 0, max: 30, unit: 'px' },
    btnFontSize: { k: 'btnFontSize', label: '按钮字号', type: 'range', min: 10, max: 24, unit: 'px' },
    btnWeight: { k: 'btnWeight', label: '按钮字重', type: 'seg', opts: [['500', '常规'], ['600', '半粗'], ['700', '加粗'], ['800', '特粗']] },
    btnShadow: {
      k: 'btnShadow', label: '按钮阴影', type: 'select',
      opts: [['none', '无'], ['soft', '轻微'], ['strong', '明显'], ['glow', '柔光']]
    },
    btnFull: { k: 'btnFull', label: '按钮宽度', type: 'seg', opts: [['0', '随文字'], ['1', '占满整行']] },
    btnBorderWidth: { k: 'btnBorderWidth', label: '按钮边框粗细', type: 'range', min: 0, max: 4, unit: 'px', hint: '描边 / 幽灵样式下生效' },
    /* 导航内文字与链接 */
    navLinkColor: { k: 'navLinkColor', label: '菜单文字色', type: 'color', hint: '留空跟随导航栏文字色' },
    navLinkHover: { k: 'navLinkHover', label: '菜单悬停色', type: 'color', hint: '留空保持原色' },
    navLinkSize: { k: 'navLinkSize', label: '菜单字号', type: 'range', min: 11, max: 20, unit: 'px' },
    navLinkGap: { k: 'navLinkGap', label: '菜单间距', type: 'range', min: 0, max: 40, unit: 'px' },
    navBrandSize: { k: 'navBrandSize', label: '品牌名字号', type: 'range', min: 13, max: 30, unit: 'px' },
    /* 页脚内文字与链接 */
    footLinkColor: { k: 'footLinkColor', label: '链接颜色', type: 'color', hint: '留空跟随页脚文字色' },
    footLinkSize: { k: 'footLinkSize', label: '链接字号', type: 'range', min: 11, max: 20, unit: 'px' },
    footLinkGap: { k: 'footLinkGap', label: '链接行距', type: 'range', min: 0, max: 24, unit: 'px' },
    footTitleSize: { k: 'footTitleSize', label: '栏目标题字号', type: 'range', min: 12, max: 24, unit: 'px' },
    footBottomSize: { k: 'footBottomSize', label: '版权文字字号', type: 'range', min: 10, max: 18, unit: 'px' },
    /* 表单 / 搜索框的输入框 */
    inputBg: { k: 'inputBg', label: '输入框背景', type: 'color', hint: '留空跟随组件默认（搜索框默认透明）' },
    inputColor: { k: 'inputColor', label: '输入文字色', type: 'color' },
    inputPhColor: { k: 'inputPhColor', label: '占位文字色', type: 'color', hint: '留空用浏览器默认' },
    inputBorderColor: { k: 'inputBorderColor', label: '边框颜色', type: 'color' },
    inputBorderWidth: { k: 'inputBorderWidth', label: '边框粗细', type: 'range', min: 0, max: 3, unit: 'px' },
    inputRadius: { k: 'inputRadius', label: '输入框圆角', type: 'range', min: 0, max: 30, unit: 'px' },
    inputPadX: { k: 'inputPadX', label: '左右内边距', type: 'range', min: 4, max: 30, unit: 'px' },
    inputPadY: { k: 'inputPadY', label: '上下内边距', type: 'range', min: 4, max: 24, unit: 'px' },
    cardBg: { k: 'cardBg', label: '卡片背景', type: 'color' },
    /* 卡片 / 条目内部：让每张卡片的内边距与文字层级单独可调 */
    cardPadX: { k: 'cardPadX', label: '卡片左右内边距', type: 'range', min: 0, max: 80, unit: 'px' },
    cardPadY: { k: 'cardPadY', label: '卡片上下内边距', type: 'range', min: 0, max: 80, unit: 'px' },
    cardTitleSize: { k: 'cardTitleSize', label: '条目标题字号', type: 'range', min: 11, max: 40, unit: 'px' },
    cardTextSize: { k: 'cardTextSize', label: '条目正文字号', type: 'range', min: 9, max: 30, unit: 'px' },
    cardIconSize: { k: 'cardIconSize', label: '条目图标 / 头像尺寸', type: 'range', min: 16, max: 140, unit: 'px' },
    height: { k: 'height', label: '空白高度', type: 'range', min: 8, max: 200, unit: 'px' },    lineColor: { k: 'lineColor', label: '线条 / 边框颜色', type: 'color', hint: '留空则无边框' },
    thickness: { k: 'thickness', label: '线条粗细', type: 'range', min: 1, max: 12, unit: 'px' },
    lineWidth: { k: 'lineWidth', label: '线条宽度', type: 'range', min: 10, max: 100, unit: '%' },
    desc: { k: 'desc', label: '描述文字', type: 'textarea' },
    kicker: { k: 'kicker', label: '小标签', type: 'text' },
    btnText: { k: 'btnText', label: '按钮文字', type: 'text' },
    emoji: { k: 'emoji', label: '图标 / 徽标', type: 'media', hint: '可填 emoji，或上传 / 选择图片' },
    tagBg: { k: 'tagBg', label: '标签底色', type: 'color' },
    leftTitle: { k: 'leftTitle', label: '左栏标题', type: 'text' },
    leftText: { k: 'leftText', label: '左栏内容', type: 'textarea' },
    rightTitle: { k: 'rightTitle', label: '右栏标题', type: 'text' },
    rightText: { k: 'rightText', label: '右栏内容', type: 'textarea' },

    /* --- 导航与框架 --- */
    navItems: { k: 'navItems', label: '菜单项', type: 'rows', cols: ['菜单文字', '链接'], hint: '点链接那一格可以改跳转地址，如 #products' },
    sticky: { k: 'sticky', label: '滚动时吸顶', type: 'seg', opts: [['1', '吸顶'], ['0', '不吸顶']], hint: '滚动画布或导出页面时会固定在顶部' },
    stickyTop: { k: 'stickyTop', label: '吸顶距顶部', type: 'range', min: 0, max: 120, unit: 'px' },
    navHeight: { k: 'navHeight', label: '导航高度', type: 'range', min: 44, max: 100, unit: 'px' },
    crumbItems: { k: 'crumbItems', label: '面包屑', type: 'rows', cols: ['文字', '链接'], hint: '最后一项留空链接即当前页' },
    footerLinks: { k: 'footerLinks', label: '底部链接', type: 'rows', cols: ['文字', '链接'] },
    copyright: { k: 'copyright', label: '版权信息', type: 'text' },
    phone: { k: 'phone', label: '联系电话', type: 'text' },
    email: { k: 'email', label: '联系邮箱', type: 'text' },
    address: { k: 'address', label: '地址', type: 'text' },
    navCtaHref: { k: 'navCtaHref', label: '按钮链接', type: 'text', hint: '如 #contact 或 https://…' },
    subItems: { k: 'subItems', label: '子菜单', type: 'rows', cols: ['主菜单', '子项（逗号分隔）'], long: 1, hint: '主菜单名需与「菜单项」里的文字一致' },
    dropItems: { k: 'dropItems', label: '下拉内容', type: 'rows', cols: ['标题', '内容或链接'], long: 1, hint: '内容以 http/# 开头会渲染成链接' },
    checkItems: { k: 'checkItems', label: '选项', type: 'rows', cols: ['文字', '值', '默认选中（填 1）'] },
    chkBtn: { k: 'chkBtn', label: '按钮文字', type: 'text' },
    chkResult: { k: 'chkResult', label: '结果前缀', type: 'text' },
    themeBtnText: { k: 'themeBtnText', label: '主题按钮文字', type: 'text' },
    searchPlaceholder: { k: 'searchPlaceholder', label: '搜索框提示', type: 'text' },

    /* --- 多行内容 --- */
    btnItems: { k: 'btnItems', label: '按钮', type: 'rows', cols: ['文字', '链接', '主按钮（填 1）'] },
    featureItems: { k: 'featureItems', label: '要点', type: 'rows', cols: ['图标', '标题', '说明'], long: 2, mediaRows: true, hint: '第一格可填 emoji、图片网址或上传的图片' },
    galleryItems: { k: 'galleryItems', label: '图片', type: 'rows', cols: ['图片地址', '说明'], long: 1, mediaRows: true, hint: '地址留空显示占位图；可上传图片自动填地址' },
    priceItems: { k: 'priceItems', label: '方案', type: 'rows', cols: ['方案名', '价格', '特点（一行一条）', '按钮文字', '推荐（填 1）'], long: 2 },
    teamItems: { k: 'teamItems', label: '成员', type: 'rows', cols: ['头像', '姓名', '职位', '简介'], long: 3, mediaRows: true, hint: '第一格可填 emoji、图片网址或上传的图片' },
    faqItems: { k: 'faqItems', label: '问答', type: 'rows', cols: ['问题', '答案'], long: 1 },
    openFirst: { k: 'openFirst', label: '默认展开第一项', type: 'seg', opts: [['1', '展开'], ['0', '收起']] },
    timelineItems: { k: 'timelineItems', label: '节点', type: 'rows', cols: ['时间', '标题', '说明'], long: 2 },
    progressItems: { k: 'progressItems', label: '进度', type: 'rows', cols: ['名称', '百分比'] },
    logoItems: { k: 'logoItems', label: '品牌', type: 'rows', cols: ['名称或 Logo', '链接'], mediaRows: true, hint: '第一格填名称或图片，第二格可选填链接' },
    tableData: { k: 'tableData', label: '表格', type: 'rows', cols: ['列 1', '列 2', '列 3'], flexCols: true },
    codeText: { k: 'codeText', label: '代码内容', type: 'textarea', rows: 7 },
    codeLang: { k: 'codeLang', label: '语言标签', type: 'text' },
    noticeType: { k: 'noticeType', label: '提示类型', type: 'select', opts: [['info', '信息 蓝'], ['success', '成功 绿'], ['warning', '提醒 橙'], ['danger', '警告 红']] },

    /* --- 嵌套容器 --- */
    layout: { k: 'layout', label: '子模块排列', type: 'seg', opts: [['stack', '纵向堆叠'], ['row', '一行均分'], ['flow', '自动横排']] },
    alignItems: { k: 'alignItems', label: '垂直对齐', type: 'seg', opts: [['stretch', '等高'], ['start', '顶部'], ['center', '居中'], ['end', '底部']] },

    /* --- 外观 --- */
    cols: { k: 'cols', label: '一行放几个', type: 'range', min: 1, max: 6, unit: '个' },
    gap: { k: 'gap', label: '项目间距', type: 'range', min: 0, max: 40, unit: 'px' },
    stars: { k: 'stars', label: '星级', type: 'range', min: 0, max: 5, unit: '星' },
    avatar: { k: 'avatar', label: '头像', type: 'media', hint: '可填 emoji，或上传 / 选择图片' },
    noticeIcon: { k: 'noticeIcon', label: '自定义图标', type: 'media', hint: '留空则按提示类型显示默认符号' },
    contactIcons: { k: 'contactIcons', label: '三个图标（用 | 分隔）', type: 'media', multi: true, hint: '可填 emoji 或图片；留空用默认符号' },
    role: { k: 'role', label: '身份 / 职位', type: 'text' },
    dateText: { k: 'dateText', label: '日期 / 时间', type: 'text', hint: '如 2026 年 3 月 / Q2' },
    percent: { k: 'percent', label: '进度', type: 'range', min: 0, max: 100, unit: '%' },
    hot: { k: 'hot', label: '推荐标记', type: 'seg', opts: [['1', '推荐'], ['0', '普通']] },
    barColor: { k: 'barColor', label: '进度条颜色', type: 'color' },

    /* --- 参考国内外知名站点的内容字段 --- */
    hotItems: { k: 'hotItems', label: '热搜', type: 'rows', cols: ['关键词', '热度', '标签'], hint: '标签可填 爆 / 热 / 新 / 沸，留空也行' },
    feedItems: { k: 'feedItems', label: '动态', type: 'rows', cols: ['头像', '昵称', '时间', '正文', '配图', '转发', '评论', '赞'], long: 3, mediaRows: true, hint: '头像可填 emoji 或图片网址；配图可留空' },
    feedStyle: { k: 'feedStyle', label: '信息流样式', type: 'seg', opts: [['weibo', '微博卡片'], ['x', 'X 时间线']] },
    qaQuestion: { k: 'qaQuestion', label: '问题标题', type: 'text' },
    qaAuthor: { k: 'qaAuthor', label: '回答者', type: 'text' },
    qaBio: { k: 'qaBio', label: '回答者简介', type: 'text' },
    qaAvatar: { k: 'qaAvatar', label: '回答者头像', type: 'media' },
    qaText: { k: 'qaText', label: '回答正文', type: 'textarea', rows: 6 },
    qaVote: { k: 'qaVote', label: '赞同数', type: 'text' },
    qaComments: { k: 'qaComments', label: '评论数', type: 'text' },
    qaTags: { k: 'qaTags', label: '话题标签', type: 'text', hint: '用逗号分隔' },
    ratingItems: { k: 'ratingItems', label: '条目', type: 'rows', cols: ['标题', '年份', '评分', '海报', '简介'], long: 4, mediaRows: true, hint: '评分 0~10，例如 9.2' },
    searchPlaceholder: { k: 'searchPlaceholder', label: '搜索框提示文字', type: 'text' },
    searchBtn: { k: 'searchBtn', label: '搜索按钮文字', type: 'text' },
    searchAction: { k: 'searchAction', label: '搜索提交地址', type: 'text', hint: '如 https://www.google.com/search；留空只做展示' },
    searchSuggest: { k: 'searchSuggest', label: '热门搜索词', type: 'text', hint: '用逗号分隔' },
    repoName: { k: 'repoName', label: '仓库名称', type: 'text' },
    repoOwner: { k: 'repoOwner', label: '所有者', type: 'text' },
    repoDesc: { k: 'repoDesc', label: '仓库描述', type: 'textarea', rows: 3 },
    repoLang: { k: 'repoLang', label: '主要语言', type: 'text' },
    repoStars: { k: 'repoStars', label: 'Star 数', type: 'text' },
    repoForks: { k: 'repoForks', label: 'Fork 数', type: 'text' },
    repoIssues: { k: 'repoIssues', label: 'Issue 数', type: 'text' },
    repoTopics: { k: 'repoTopics', label: '主题标签', type: 'text', hint: '用逗号分隔' },
    repoUpdated: { k: 'repoUpdated', label: '更新时间', type: 'text' },
    wikiLead: { k: 'wikiLead', label: '导语', type: 'textarea', rows: 4 },
    wikiInfobox: { k: 'wikiInfobox', label: '信息框', type: 'rows', cols: ['名称', '内容'], long: 1 },
    wikiToc: { k: 'wikiToc', label: '目录', type: 'rows', cols: ['标题', '缩进层级'] },
    wikiBody: { k: 'wikiBody', label: '正文段落', type: 'textarea', rows: 7 },
    chatServer: { k: 'chatServer', label: '服务器名称', type: 'text' },
    chatChannel: { k: 'chatChannel', label: '频道名称', type: 'text' },
    chatMembers: { k: 'chatMembers', label: '在线成员', type: 'rows', cols: ['头像', '昵称'], mediaRows: true },
    chatItems: { k: 'chatItems', label: '消息', type: 'rows', cols: ['头像', '昵称', '时间', '内容', '角色色'], long: 3, mediaRows: true, hint: '角色色可填 #e91e63 等，留空用默认色' },
    awardItems: { k: 'awardItems', label: '作品', type: 'rows', cols: ['封面', '名称', '团队', '奖项'], mediaRows: true },
    awardDesc: { k: 'awardDesc', label: '副标题', type: 'text' },
    marqueeText: { k: 'marqueeText', label: '跑马灯文字', type: 'rows', cols: ['一组文字'], hint: '一行一组，导出时自动用 · 连成一整条' },
    marqueeSpeed: { k: 'marqueeSpeed', label: '一轮时长', type: 'range', min: 8, max: 80, unit: '秒' },
    marqueeDir: { k: 'marqueeDir', label: '滚动方向', type: 'seg', opts: [['left', '向左'], ['right', '向右']] },

    /* --- 视觉实验：品牌墙 / 未来排版 / 几何 / 动感 / 高清图 / 3D --- */
    brandItems: { k: 'brandItems', label: '品牌', type: 'rows', cols: ['Logo 或名称', '链接', '说明'], long: 2, mediaRows: true, hint: '第一格可填文字、emoji 或图片网址' },
    brandStyle: { k: 'brandStyle', label: '品牌墙样式', type: 'seg', opts: [['grid', '矩阵网格'], ['marquee', '流动长廊']] },
    brandCols: { k: 'brandCols', label: '一行几个', type: 'range', min: 2, max: 8, unit: '个' },
    brandSpeed: { k: 'brandSpeed', label: '长廊一轮时长', type: 'range', min: 10, max: 80, unit: '秒' },
    futypeText: { k: 'futypeText', label: '主标题（每行一段）', type: 'textarea', rows: 3 },
    futypeSub: { k: 'futypeSub', label: '副标题', type: 'text' },
    futypeStyle: { k: 'futypeStyle', label: '排版风格', type: 'select', opts: [['neon', '霓虹故障'], ['outline', '镂空描边'], ['gradient', '渐变金属'], ['glitch', '错位故障']] },
    futypeSize: { k: 'futypeSize', label: '字号', type: 'range', min: 36, max: 140, unit: 'px' },
    shapeItems: { k: 'shapeItems', label: '形状', type: 'rows', cols: ['形状', '颜色'], hint: '形状可填 圆 / 方 / 三角 / 六边形 / 环 / 水滴' },
    shapeSize: { k: 'shapeSize', label: '形状基准尺寸', type: 'range', min: 60, max: 240, unit: 'px' },
    shapeSpeed: { k: 'shapeSpeed', label: '漂浮一轮时长', type: 'range', min: 4, max: 24, unit: '秒' },
    shapeFill: { k: 'shapeFill', label: '默认颜色', type: 'color' },
    kineticText: { k: 'kineticText', label: '动感文字', type: 'textarea', rows: 3 },
    kineticStyle: { k: 'kineticStyle', label: '动感样式', type: 'select', opts: [['orbit', '轨道环'], ['wave', '声波柱'], ['ticker', '斜切快讯']] },
    kineticSpeed: { k: 'kineticSpeed', label: '一轮时长', type: 'range', min: 4, max: 30, unit: '秒' },
    hiSrc: { k: 'hiSrc', label: '高清图片', type: 'media', hint: '建议 2400px 以上；可上传或从我的图片选择' },
    hiAlt: { k: 'hiAlt', label: '图片说明', type: 'text' },
    hiRatio: { k: 'hiRatio', label: '画面比例', type: 'select', opts: [['wide', '宽幅 16:9'], ['pano', '全景 21:9'], ['square', '方形 1:1'], ['portrait', '竖幅 3:4']] },
    hiHeight: { k: 'hiHeight', label: '最大高度', type: 'range', min: 220, max: 900, unit: 'px' },
    hiFocusY: { k: 'hiFocusY', label: '焦点纵向位置', type: 'range', min: 0, max: 100, unit: '%' },
    hiCaption: { k: 'hiCaption', label: '图片下方文字', type: 'text' },
    hiOverlay: { k: 'hiOverlay', label: '压暗蒙层', type: 'seg', opts: [['1', '开启'], ['0', '关闭']] },
    objShape: { k: 'objShape', label: '3D 形状', type: 'select', opts: [['cube', '立方体'], ['pyramid', '金字塔'], ['sphere', '星球'], ['ring', '光环']] },
    objSize: { k: 'objSize', label: '尺寸', type: 'range', min: 100, max: 360, unit: 'px' },
    objSpeed: { k: 'objSpeed', label: '自转一轮', type: 'range', min: 4, max: 30, unit: '秒' },
    objColor1: { k: 'objColor1', label: '主色', type: 'color' },
    objColor2: { k: 'objColor2', label: '辅色', type: 'color' },
    objLabel: { k: 'objLabel', label: '3D 元素说明', type: 'text' },
    objTilt: { k: 'objTilt', label: '跟随鼠标', type: 'seg', opts: [['1', '开启'], ['0', '关闭']] },

    /* --- 个性化：个人名片 / 技能 / 时间轴 / 社交链接 / 标签云 / 数据 / 照片墙 --- */
    cardName: { k: 'cardName', label: '姓名', type: 'text' },
    cardRole: { k: 'cardRole', label: '头衔 / 身份', type: 'text' },
    cardAvatar: { k: 'cardAvatar', label: '头像', type: 'media', hint: '可上传或从我的图片选择，留空用文字首字母' },
    cardBio: { k: 'cardBio', label: '个人简介', type: 'textarea', rows: 3 },
    cardLinks: { k: 'cardLinks', label: '社交链接', type: 'rows', cols: ['平台', '地址'] },
    cardVerified: { k: 'cardVerified', label: '认证标识', type: 'seg', opts: [['1', '显示'], ['0', '隐藏']] },
    cardLayout: { k: 'cardLayout', label: '名片布局', type: 'seg', opts: [['center', '居中'], ['left', '左对齐']] },
    skillTitle: { k: 'skillTitle', label: '标题', type: 'text' },
    skillItems: { k: 'skillItems', label: '技能', type: 'rows', cols: ['名称', '熟练度 0-100'] },
    skillColor: { k: 'skillColor', label: '进度条颜色', type: 'color' },
    skillTrack: { k: 'skillTrack', label: '轨道颜色', type: 'color' },
    skillAnimate: { k: 'skillAnimate', label: '入场增长', type: 'seg', opts: [['1', '开启'], ['0', '关闭']] },
    tlTitle: { k: 'tlTitle', label: '标题', type: 'text' },
    tlItems: { k: 'tlItems', label: '经历', type: 'rows', cols: ['年份', '标题', '说明'], long: 2 },
    tlLineColor: { k: 'tlLineColor', label: '轴线颜色', type: 'color' },
    tlDotColor: { k: 'tlDotColor', label: '节点颜色', type: 'color' },
    linkTitle: { k: 'linkTitle', label: '标题', type: 'text' },
    linkBio: { k: 'linkBio', label: '一句话简介', type: 'text' },
    linkItems: { k: 'linkItems', label: '链接按钮', type: 'rows', cols: ['名称', '地址', '图标'] },
    linkBtnBg: { k: 'linkBtnBg', label: '按钮底色', type: 'color' },
    linkBtnColor: { k: 'linkBtnColor', label: '按钮文字色', type: 'color' },
    linkShape: { k: 'linkShape', label: '按钮形状', type: 'seg', opts: [['round', '圆角'], ['pill', '胶囊']] },
    tagTitle: { k: 'tagTitle', label: '标题', type: 'text' },
    tagItems: { k: 'tagItems', label: '标签', type: 'rows', cols: ['文字', '权重 1-5', '颜色'] },
    tagStyle: { k: 'tagStyle', label: '标签样式', type: 'seg', opts: [['pill', '胶囊'], ['card', '卡片']] },
    tagSpread: { k: 'tagSpread', label: '排布方式', type: 'seg', opts: [['wrap', '自然排列'], ['center', '居中密集']] },
    statTitle: { k: 'statTitle', label: '标题', type: 'text' },
    statItems: { k: 'statItems', label: '数据', type: 'rows', cols: ['数值', '单位', '说明'], long: 2 },
    statCols: { k: 'statCols', label: '每行几项', type: 'range', min: 2, max: 5, unit: '列' },
    statAccent: { k: 'statAccent', label: '数字颜色', type: 'color' },
    statDivider: { k: 'statDivider', label: '分隔线', type: 'seg', opts: [['1', '显示'], ['0', '隐藏']] },
    polarTitle: { k: 'polarTitle', label: '标题', type: 'text' },
    polarItems: { k: 'polarItems', label: '照片', type: 'rows', cols: ['图片地址', '说明', '角度 -15~15'], long: 1 },
    polarCols: { k: 'polarCols', label: '每行几张', type: 'range', min: 2, max: 5, unit: '列' },
    polarTilt: { k: 'polarTilt', label: '照片倾斜', type: 'seg', opts: [['1', '开启'], ['0', '关闭']] },

    /* --- 网页外观控制：颜色切换 / 深色模式 / 字号调节 / 主题切换器 --- */
    swLabel: { k: 'swLabel', label: '按钮组标题', type: 'text' },
    swColors: { k: 'swColors', label: '可选颜色', type: 'rows', cols: ['颜色值', '名称'], hint: '点任意一个就会把整页强调色换成这个颜色' },
    swShape: { k: 'swShape', label: '色块形状', type: 'seg', opts: [['round', '圆形'], ['square', '圆角方形']] },
    swSize: { k: 'swSize', label: '色块大小', type: 'range', min: 20, max: 56, unit: 'px' },
    swShowName: { k: 'swShowName', label: '显示颜色名称', type: 'seg', opts: [['1', '显示'], ['0', '隐藏']] },
    swAlign: { k: 'swAlign', label: '对齐', type: 'seg', opts: [['center', '居中'], ['left', '靠左'], ['right', '靠右']] },
    dmLabelOn: { k: 'dmLabelOn', label: '切换到深色时显示', type: 'text' },
    dmLabelOff: { k: 'dmLabelOff', label: '切换到浅色时显示', type: 'text' },
    dmDarkBg: { k: 'dmDarkBg', label: '深色模式背景', type: 'color' },
    dmDarkText: { k: 'dmDarkText', label: '深色模式文字', type: 'color' },
    dmDarkCard: { k: 'dmDarkCard', label: '深色模式卡片', type: 'color' },
    dmStyle: { k: 'dmStyle', label: '开关样式', type: 'seg', opts: [['toggle', '滑动开关'], ['button', '文字按钮']] },
    fsLabel: { k: 'fsLabel', label: '控件标题', type: 'text' },
    fsMin: { k: 'fsMin', label: '最小缩放', type: 'range', min: 50, max: 100, unit: '%' },
    fsMax: { k: 'fsMax', label: '最大缩放', type: 'range', min: 100, max: 180, unit: '%' },
    fsStep: { k: 'fsStep', label: '每次调整', type: 'range', min: 5, max: 25, unit: '%' },
    fsShowValue: { k: 'fsShowValue', label: '显示百分比', type: 'seg', opts: [['1', '显示'], ['0', '隐藏']] },
    tpLabel: { k: 'tpLabel', label: '控件标题', type: 'text' },
    tpThemes: { k: 'tpThemes', label: '主题', type: 'rows', cols: ['名称', '强调色', '背景色', '文字色'] },
    tpStyle: { k: 'tpStyle', label: '切换器样式', type: 'seg', opts: [['chip', '标签按钮'], ['swatch', '色卡']] },

    /* --- 层叠：任意模块都能浮在其他模块上 --- */
    layerMode: { k: 'layerMode', label: '显示方式', type: 'seg', opts: [['normal', '正常排布'], ['overlay', '浮层叠放']], hint: '浮层会叠在目标模块上方，可用左上角的 ✥ 手柄拖动' },
    layerTarget: { k: 'layerTarget', label: '叠放在哪个模块上', type: 'select', opts: [], hint: '留空表示紧挨着的上一个模块' },
    layerX: { k: 'layerX', label: '水平位置', type: 'range', min: -100, max: 100, unit: '%' },
    layerY: { k: 'layerY', label: '垂直位置', type: 'range', min: -100, max: 100, unit: '%' },
    layerW: { k: 'layerW', label: '浮层宽度', type: 'range', min: 10, max: 150, unit: '%' },
    layerH: { k: 'layerH', label: '浮层高度', type: 'number', min: 0, max: 1200, hint: 'px · 0 表示随内容' },
    layerZ: { k: 'layerZ', label: '层级', type: 'range', min: 0, max: 100, unit: '' },
    layerRotate: { k: 'layerRotate', label: '旋转', type: 'range', min: -180, max: 180, unit: '°' },
    layerPointer: { k: 'layerPointer', label: '鼠标事件', type: 'seg', opts: [['auto', '内容可点·空白穿透'], ['box', '整块可点'], ['none', '完全穿透']], hint: '默认只让浮层的文字 / 图片 / 按钮接收点击，透明区域透到下层，不会挡住下面的链接；「整块可点」适合遮罩类浮层' },

    /* --- 通用设置：所有模块共享，不写进 ASSETS.fields，由属性面板单独渲染 --- */
    linkTarget: { k: 'linkTarget', label: '链接打开方式', type: 'seg', opts: [['self', '当前窗口'], ['blank', '新标签页'], ['external', '仅外链']] },
    anchorId: { k: 'anchorId', label: '锚点 ID', type: 'text', hint: '链接里写 #这个ID 即可定位' },
    extraClass: { k: 'extraClass', label: '自定义 CSS 类', type: 'text', hint: '多个类名用空格分隔' },
    boxWidth: { k: 'boxWidth', label: '模块宽度', type: 'range', min: 20, max: 100, unit: '%', hint: '小于 100% 时可配合水平位置' },
    boxMaxWidth: { k: 'boxMaxWidth', label: '最大宽度', type: 'number', min: 0, max: 2000, hint: 'px · 0 表示不限制' },
    boxMinHeight: { k: 'boxMinHeight', label: '最小高度', type: 'number', min: 0, max: 2000, hint: 'px · 0 表示随内容' },
    boxHeight: { k: 'boxHeight', label: '固定高度', type: 'number', min: 0, max: 2000, hint: 'px · 0 表示自适应' },
    boxMarginY: { k: 'boxMarginY', label: '上下外边距', type: 'range', min: 0, max: 100, unit: 'px' },
    boxAlign: { k: 'boxAlign', label: '水平位置', type: 'seg', opts: [['left', '靠左'], ['center', '居中'], ['right', '靠右']] },
    boxOverflow: { k: 'boxOverflow', label: '内容溢出', type: 'select', opts: [['visible', '显示'], ['hidden', '裁剪'], ['auto', '滚动']] },
    boxBorderColor: { k: 'boxBorderColor', label: '边框颜色', type: 'color', hint: '留空则不显示边框' },
    boxBorderWidth: { k: 'boxBorderWidth', label: '边框粗细', type: 'range', min: 0, max: 10, unit: 'px' },
    boxShadow: { k: 'boxShadow', label: '投影', type: 'select', opts: [['none', '无'], ['sm', '轻微'], ['md', '中等'], ['lg', '明显']] },
    boxOpacity: { k: 'boxOpacity', label: '不透明度', type: 'range', min: 20, max: 100, unit: '%' },
    boxHover: {
      k: 'boxHover', label: '鼠标悬停', type: 'select', hint: '悬停时的反馈效果',
      opts: [['none', '无'], ['lift', '上浮'], ['lift-lg', '大幅上浮'], ['zoom', '放大'],
        ['glow', '柔光发光'], ['shadow', '阴影增强'], ['shine', '扫光掠过'], ['tilt', '3D 倾斜'],
        ['tilt-glare', '3D + 镜面反光'], ['magnet', '磁吸跟随'], ['press', '按压回弹'],
        ['outline', '描边高亮'], ['border', '流光描边'], ['spot', '光标光斑'],
        ['underline', '下划线展开'], ['imgzoom', '图片放大'], ['saturate', '图片增彩'],
        ['dir', '方向感知划入'],         ['wipe', '遮罩揭示'], ['glitch', '故障抖动'],
        ['glass', '毛玻璃抬升'], ['arrow', '箭头滑动'], ['unblur', '图片去模糊'],
        ['flip3d', '3D 翻转'], ['zoomblur', '模糊缩放']]
    },
    loopFx: {
      k: 'loopFx', label: '常驻动效', type: 'select', hint: '一直循环播放，会覆盖悬停位移',
      opts: [['none', '无'], ['float', '上下浮动'], ['pulse', '呼吸缩放'], ['breathe', '光晕呼吸'],
        ['shine', '流光扫过'], ['beam', '流光边框'], ['gradient', '渐变流动'], ['sway', '轻微摇摆'], ['ring', '光圈扩散'],
        ['metal', '金属光泽文字'], ['typewriter', '打字机'], ['marquee', '横向跑马灯'],
        ['blink', '在线呼吸点'], ['shimmer', '骨架微光'],
        ['orbit', '轨道旋转'], ['rgbshift', '色差闪烁']]
    },
    animIn: {
      k: 'animIn', label: '进入动画', type: 'select', hint: '滚动到可视区域时播放',
      opts: [['none', '无'], ['up', '上移淡入'], ['down', '下移淡入'], ['left', '向右滑入'],
        ['right', '向左滑入'], ['fade', '纯淡入'], ['zoom', '缩放淡入'], ['pop', '弹入放大'],
        ['rotate', '旋转淡入'], ['flip', '翻转展开'], ['unfold', '3D 翻开'], ['swing', '摆动入场'],
        ['skew', '斜切入场'], ['mask', '遮罩揭示'], ['rise', '遮罩升起'], ['blur', '模糊聚焦'],
        ['blurup', '模糊上移'], ['drop', '垂落入场'], ['wipe', '横向擦除'],
        ['blurzoom', '模糊放大'], ['spring', '弹跳入场'], ['slideblur', '模糊滑入']]
    },
    animDur: { k: 'animDur', label: '动画时长', type: 'range', min: 200, max: 2000, unit: 'ms' },
    animDelay: { k: 'animDelay', label: '延迟播放', type: 'range', min: 0, max: 1500, unit: 'ms' },
    animEase: { k: 'animEase', label: '缓动曲线', type: 'seg', opts: [['out', '顺滑'], ['smooth', '柔和'], ['spring', '回弹'], ['linear', '线性']] },
    animDist: { k: 'animDist', label: '位移距离', type: 'range', min: 0, max: 120, unit: 'px' },
    animOnce: { k: 'animOnce', label: '播放次数', type: 'seg', opts: [['1', '只播一次'], ['0', '每次进入']], hint: '滚出后重置' },
    animStagger: { k: 'animStagger', label: '子模块依次入场', type: 'range', min: 0, max: 300, unit: 'ms', hint: '每个子模块比前一个晚这么多' },
    boxVisibility: { k: 'boxVisibility', label: '显示条件', type: 'select', opts: [['all', '始终显示'], ['desktop', '仅桌面 / 平板'], ['mobile', '仅手机'], ['hidden', '隐藏（不导出）']] },
    boxCustomCSS: { k: 'boxCustomCSS', label: '追加 CSS', type: 'textarea', rows: 2, hint: '如 letter-spacing:1px;cursor:pointer' },
    /* --- 行内布局：仅当父容器是横向布局时生效 --- */
    colSpan: { k: 'colSpan', label: '横向占几列', type: 'select', opts: [['1', '1 列'], ['2', '2 列'], ['3', '3 列'], ['4', '4 列'], ['5', '5 列'], ['6', '6 列']], hint: '大于容器列数时按整行处理' },
    flowWidth: { k: 'flowWidth', label: '行内宽度', type: 'range', min: 0, max: 100, unit: '%', hint: '0 = 自动均分，一行放不下会自动换行' },

    /* ===================================================================
       通用增强属性：对所有组件生效（不写进 ASSETS.fields，由属性面板单独渲染）
       =================================================================== */
    /* --- 整块链接 --- */
    boxHref: { k: 'boxHref', label: '整块链接', type: 'text', hint: '填了以后整个模块都能点击跳转，如 https://… 或 #锚点' },
    boxHoverTip: { k: 'boxHoverTip', label: '悬停提示文字', type: 'text', hint: '鼠标停在模块上时显示的 title 提示' },
    /* --- 模块配色 --- */
    boxColorLock: { k: 'boxColorLock', label: '独立配色（不受模式影响）', type: 'seg', opts: [['0', '跟随主题'], ['1', '锁定自身']], hint: '锁定后本模块的背景 / 文字 / 链接 / 强调色始终用下方设置的值，切换深色 / 浅色模式也不会被覆盖' },
    /* --- 主题样式：每个模块决定自己在浅色 / 深色主题下长什么样 --- */
    boxThemeRole: { k: 'boxThemeRole', label: '在主题下的样子', type: 'select',
      opts: [['auto', '跟随主题（默认）'], ['base', '页面底色'], ['card', '卡片底色'], ['soft', '主题浅底'],
        ['accent', '强调色块'], ['inverse', '反色块'], ['outline', '主题描边'], ['plain', '透明无底色'], ['custom', '自定义（分浅色 / 深色）']],
      hint: '决定这个模块在浅色 / 深色主题下的底色、文字与链接；换主题色时选「强调色块 / 主题浅底」会跟着变' },
    boxThemeLightBg: { k: 'boxThemeLightBg', label: '浅色模式 · 底色', type: 'color', hint: '留空保持透明' },
    boxThemeLightText: { k: 'boxThemeLightText', label: '浅色模式 · 文字色', type: 'color' },
    boxThemeLightAccent: { k: 'boxThemeLightAccent', label: '浅色模式 · 强调色', type: 'color' },
    boxThemeLightLink: { k: 'boxThemeLightLink', label: '浅色模式 · 链接色', type: 'color' },
    boxThemeDarkBg: { k: 'boxThemeDarkBg', label: '深色模式 · 底色', type: 'color', hint: '留空沿用上面的浅色设置' },
    boxThemeDarkText: { k: 'boxThemeDarkText', label: '深色模式 · 文字色', type: 'color' },
    boxThemeDarkAccent: { k: 'boxThemeDarkAccent', label: '深色模式 · 强调色', type: 'color' },
    boxThemeDarkLink: { k: 'boxThemeDarkLink', label: '深色模式 · 链接色', type: 'color' },
    boxTextColor: { k: 'boxTextColor', label: '模块文字色', type: 'color', hint: '统一覆盖模块内所有文字颜色（按钮 / 链接可单独设）' },
    boxBg: { k: 'boxBg', label: '模块背景', type: 'color', hint: '覆盖或叠加在模块背景上，支持渐变；留空用组件自带背景' },
    boxAccent: { k: 'boxAccent', label: '模块强调色', type: 'color', hint: '只改本模块的按钮 / 图标 / 进度条 / 链接色' },
    boxLinkColor: { k: 'boxLinkColor', label: '链接颜色', type: 'color', hint: '模块内所有链接文字的颜色（留空跟随强调色）' },
    boxRadius: { k: 'boxRadius', label: '模块圆角', type: 'range', min: 0, max: 80, unit: 'px', hint: '统一覆盖模块自带圆角' },
    /* --- 文字排版 --- */
    boxFont: { k: 'boxFont', label: '字体', type: 'select', opts: [['', '跟随页面'], ['sans', '现代无衬线'], ['serif', '衬线 / 宋体'], ['mono', '等宽代码'], ['round', '圆润 / 苹方']] },
    boxFontSize: { k: 'boxFontSize', label: '基础字号', type: 'range', min: 10, max: 40, unit: 'px', hint: '模块内文字的基准大小（已写死字号的以组件自身为准）' },
    boxLineHeight: { k: 'boxLineHeight', label: '行高', type: 'range', min: 100, max: 240, unit: '%' },
    boxLetterSpacing: { k: 'boxLetterSpacing', label: '字间距', type: 'range', min: -2, max: 10, unit: 'px' },
    boxFontWeight: { k: 'boxFontWeight', label: '文字粗细', type: 'seg', opts: [['', '继承'], ['400', '常规'], ['600', '半粗'], ['700', '加粗'], ['900', '特粗']] },
    boxTextTransform: { k: 'boxTextTransform', label: '英文大小写', type: 'seg', opts: [['none', '原样'], ['uppercase', '全大写'], ['lowercase', '全小写'], ['capitalize', '首字母大写']] },
    boxTextShadow: { k: 'boxTextShadow', label: '文字阴影', type: 'select', opts: [['none', '无'], ['soft', '柔和'], ['hard', '硬朗'], ['glow', '发光']] },
    /* --- 视觉效果 --- */
    boxFilter: { k: 'boxFilter', label: '滤镜', type: 'select', hint: '对整块模块做图像处理', opts: [['none', '无'], ['grayscale', '黑白'], ['sepia', '怀旧'], ['blur', '轻微模糊'], ['brightness', '提亮'], ['contrast', '高对比'], ['saturate', '高饱和'], ['invert', '反色']] },
    boxBlend: { k: 'boxBlend', label: '混合模式', type: 'select', hint: '模块与背景的颜色混合方式', opts: [['normal', '正常'], ['multiply', '正片叠底'], ['screen', '滤色'], ['overlay', '叠加'], ['darken', '变暗'], ['lighten', '变亮'], ['difference', '差值'], ['luminosity', '明度']] },
    boxBackdrop: { k: 'boxBackdrop', label: '毛玻璃背景', type: 'seg', opts: [['0', '关闭'], ['1', '开启']], hint: '开启后模块背景变半透明毛玻璃，建议同时设置背景色' },
    boxRotate: { k: 'boxRotate', label: '旋转', type: 'range', min: -30, max: 30, unit: '°', hint: '整块模块倾斜，配合浮层可做贴纸效果' },
    boxScale: { k: 'boxScale', label: '缩放', type: 'range', min: 50, max: 150, unit: '%', hint: '100 为原始大小' },
    /* --- 高级交互 / SEO --- */
    boxCursor: { k: 'boxCursor', label: '鼠标指针', type: 'select', opts: [['', '默认'], ['pointer', '手型'], ['help', '帮助'], ['crosshair', '十字'], ['grab', '抓手'], ['not-allowed', '禁止'], ['none', '隐藏']] },
    boxPointer: { k: 'boxPointer', label: '鼠标穿透', type: 'seg', opts: [['auto', '正常'], ['none', '穿透']], hint: '穿透后点击会落到下层内容，适合浮层装饰' },
    boxAriaLabel: { k: 'boxAriaLabel', label: '无障碍名称', type: 'text', hint: 'aria-label，给屏幕阅读器识别这个模块' },
    boxPrintHide: { k: 'boxPrintHide', label: '打印时', type: 'seg', opts: [['0', '显示'], ['1', '隐藏']] },
    /* --- 通用属性补充：背景图 / 边框样式 / 内边距 / 文字装饰 --- */
    boxBgImage: { k: 'boxBgImage', label: '模块背景图', type: 'media', hint: '给整块模块铺一张背景图，可与背景色叠加（图在上、色在下）' },
    boxBgSize: { k: 'boxBgSize', label: '背景图填充', type: 'seg', opts: [['cover', '铺满裁切'], ['contain', '完整显示'], ['auto', '原始大小']] },
    boxBgRepeat: { k: 'boxBgRepeat', label: '背景平铺', type: 'seg', opts: [['repeat', '平铺'], ['no-repeat', '不平铺']] },
    boxBorderStyle: { k: 'boxBorderStyle', label: '边框样式', type: 'seg', opts: [['solid', '实线'], ['dashed', '虚线'], ['dotted', '点线'], ['double', '双线']] },
    boxPadY: { k: 'boxPadY', label: '上下内边距', type: 'range', min: 0, max: 160, unit: 'px', hint: '覆盖模块默认的内边距（0 = 跟随组件自带值）' },
    boxTextDeco: { k: 'boxTextDeco', label: '文字装饰', type: 'seg', opts: [['none', '无'], ['underline', '下划线'], ['line-through', '删除线'], ['overline', '上划线']] },

    /* ===================================================================
       新组件字段：设备样机 / 转动品牌墙 / 视频播放器 / 图片轮播 /
       选项卡 / 倒计时 / 图片对比 / 音频播放器
       =================================================================== */
    /* 设备样机：电脑 / 手机外壳，屏幕放图片或视频 */
    devKind: { k: 'devKind', label: '设备类型', type: 'seg', opts: [['laptop', '笔记本'], ['monitor', '台式机'], ['phone', '手机'], ['tablet', '平板']] },
    devMode: { k: 'devMode', label: '屏幕内容', type: 'seg', opts: [['image', '图片'], ['video', '视频']] },
    devScreen: { k: 'devScreen', label: '屏幕图片', type: 'media', hint: '上传或从素材库选择一张图片' },
    devVideo: { k: 'devVideo', label: '屏幕视频', type: 'film', hint: '选内置示例，或填视频直链 / 上传本地文件' },
    devPoster: { k: 'devPoster', label: '视频封面', type: 'media', ph: '留空用视频自带封面' },
    devVideoMode: { k: 'devVideoMode', label: '视频播放', type: 'seg', opts: [['auto', '自动静音循环'], ['control', '带控制条']] },
    devFrame: { k: 'devFrame', label: '机身颜色', type: 'color' },
    devTilt: { k: 'devTilt', label: '轻微倾斜', type: 'seg', opts: [['1', '开启'], ['0', '关闭']] },
    devGlow: { k: 'devGlow', label: '背景光晕', type: 'seg', opts: [['1', '开启'], ['0', '关闭']] },
    /* 转动品牌墙：3D 环形旋转 */
    rotItems: { k: 'rotItems', label: '品牌', type: 'rows', cols: ['Logo 或名称', '链接'], mediaRows: true, hint: '第一格可填文字、emoji 或图片网址；数量决定环上分布' },
    rotShape: { k: 'rotShape', label: '排布形状', type: 'seg', opts: [['ring', '环形旋转'], ['sphere', '球形旋转']] },
    rotSpeed: { k: 'rotSpeed', label: '转一圈用时', type: 'range', min: 8, max: 90, unit: '秒' },
    rotRadius: { k: 'rotRadius', label: '环半径', type: 'range', min: 120, max: 480, unit: 'px' },
    rotCardBg: { k: 'rotCardBg', label: '品牌卡片背景', type: 'color' },
    rotPause: { k: 'rotPause', label: '悬停暂停', type: 'seg', opts: [['1', '暂停'], ['0', '继续']] },
    /* 视频播放器：真正直接播放 */
    playSrc: { k: 'playSrc', label: '视频来源', type: 'film', hint: '选内置示例，或填视频直链 / 上传本地文件' },
    playPoster: { k: 'playPoster', label: '封面图', type: 'media', ph: '留空用视频自带封面' },
    playMode: { k: 'playMode', label: '播放方式', type: 'seg', opts: [['auto', '静音自动循环'], ['control', '带控制条']] },
    playRatio: { k: 'playRatio', label: '画面比例', type: 'select', opts: [['16 / 9', '宽屏 16:9'], ['4 / 3', '标准 4:3'], ['21 / 9', '超宽 21:9']] },
    playFit: { k: 'playFit', label: '填充方式', type: 'seg', opts: [['cover', '铺满裁切'], ['contain', '完整显示']] },
    playW: { k: 'playW', label: '播放器宽度', type: 'range', min: 40, max: 100, unit: '%' },
    playCaption: { k: 'playCaption', label: '视频说明', type: 'text' },
    /* 图片轮播 / 幻灯片 */
    slideItems: { k: 'slideItems', label: '幻灯片', type: 'rows', cols: ['图片', '标题', '链接'], mediaRows: true, hint: '第一格可上传图片；标题、链接可留空' },
    slideH: { k: 'slideH', label: '画面高度', type: 'range', min: 180, max: 640, unit: 'px' },
    slideAuto: { k: 'slideAuto', label: '自动切换', type: 'seg', opts: [['1', '开启'], ['0', '手动']] },
    slideDur: { k: 'slideDur', label: '每张停留', type: 'range', min: 2, max: 12, unit: '秒' },
    slideNav: { k: 'slideNav', label: '箭头与圆点', type: 'seg', opts: [['1', '显示'], ['0', '隐藏']] },
    slideFit: { k: 'slideFit', label: '图片填充', type: 'seg', opts: [['cover', '铺满'], ['contain', '完整']] },
    slideCapBg: { k: 'slideCapBg', label: '标题条底色', type: 'color' },
    /* 选项卡 */
    tabItems: { k: 'tabItems', label: '选项卡', type: 'rows', cols: ['标签', '内容'], long: 1, hint: '内容支持换行；第二格是文字说明' },
    tabStyle: { k: 'tabStyle', label: '标签样式', type: 'seg', opts: [['line', '下划线'], ['pill', '胶囊'], ['card', '卡片']] },
    tabAlign: { k: 'tabAlign', label: '标签对齐', type: 'seg', opts: [['left', '靠左'], ['center', '居中']] },
    tabCardBg: { k: 'tabCardBg', label: '内容区背景', type: 'color' },
    tabActive: { k: 'tabActive', label: '强调色', type: 'color' },
    /* 倒计时 */
    cdTo: { k: 'cdTo', label: '目标时间', type: 'text', hint: '如 2027-01-01 00:00:00 或 2027-01-01；过期显示结束文案' },
    cdTitle: { k: 'cdTitle', label: '标题', type: 'text' },
    cdEnd: { k: 'cdEnd', label: '结束后文案', type: 'text' },
    cdStyle: { k: 'cdStyle', label: '样式', type: 'seg', opts: [['box', '数字卡片'], ['plain', '简洁文字']] },
    cdAccent: { k: 'cdAccent', label: '数字颜色', type: 'color' },
    cdBoxBg: { k: 'cdBoxBg', label: '数字底框', type: 'color' },
    cdShowSec: { k: 'cdShowSec', label: '显示秒', type: 'seg', opts: [['1', '显示'], ['0', '隐藏']] },
    /* 图片对比 Before / After */
    cmpBefore: { k: 'cmpBefore', label: '改前图片', type: 'media', hint: '底层图片（左侧）' },
    cmpAfter: { k: 'cmpAfter', label: '改后图片', type: 'media', hint: '上层图片（右侧），拖动滑杆对比' },
    cmpBeforeLabel: { k: 'cmpBeforeLabel', label: '改前标签', type: 'text' },
    cmpAfterLabel: { k: 'cmpAfterLabel', label: '改后标签', type: 'text' },
    cmpH: { k: 'cmpH', label: '画面高度', type: 'range', min: 200, max: 680, unit: 'px' },
    cmpStart: { k: 'cmpStart', label: '初始位置', type: 'range', min: 10, max: 90, unit: '%' },
    /* 音频播放器 */
    auSrc: { k: 'auSrc', label: '音频地址', type: 'text', hint: 'mp3 / wav / ogg 直链，或上传的素材地址' },
    auTitle: { k: 'auTitle', label: '曲目名称', type: 'text' },
    auArtist: { k: 'auArtist', label: '作者 / 专辑', type: 'text' },
    auCover: { k: 'auCover', label: '封面图', type: 'media', hint: '留空用默认音乐图标' },
    auAuto: { k: 'auAuto', label: '自动播放', type: 'seg', opts: [['0', '关闭'], ['1', '开启（需浏览器允许）']] },
    auCardBg: { k: 'auCardBg', label: '卡片背景', type: 'color' },

    /* ===== 常用组件第二批：步骤 / 文章 / 订阅 / 商品 / 优惠券 / 下载 / 分享 / 地址 / 活动 / 职位 / 图标导航 / 正文 ===== */
    /* 步骤流程 */
    stepsItems: { k: 'stepsItems', label: '步骤', type: 'rows', cols: ['标题', '说明'], long: 1, hint: '一行一个步骤，第二格是说明文字' },
    stepsLayout: { k: 'stepsLayout', label: '排列', type: 'seg', opts: [['row', '横向'], ['col', '纵向']] },
    stepsShape: { k: 'stepsShape', label: '序号样式', type: 'seg', opts: [['num', '数字'], ['check', '对勾'], ['dot', '圆点']] },
    stepsLine: { k: 'stepsLine', label: '连接线', type: 'seg', opts: [['1', '显示'], ['0', '隐藏']] },
    stepsAccent: { k: 'stepsAccent', label: '序号颜色', type: 'color' },
    stepsCardBg: { k: 'stepsCardBg', label: '卡片背景', type: 'color' },
    /* 文章列表 / 博客 */
    postItems: { k: 'postItems', label: '文章', type: 'rows', cols: ['图片', '标题', '日期', '简介', '链接'], long: 3, mediaRows: true, hint: '第一格可上传图片；其余格子留空即可' },
    postCols: { k: 'postCols', label: '每行几篇', type: 'seg', opts: [['2', '2 篇'], ['3', '3 篇'], ['4', '4 篇']] },
    postCardBg: { k: 'postCardBg', label: '卡片背景', type: 'color' },
    postImgH: { k: 'postImgH', label: '封面高度', type: 'range', min: 100, max: 320, unit: 'px' },
    /* 邮件订阅 */
    subTitle: { k: 'subTitle', label: '标题', type: 'text' },
    subDesc: { k: 'subDesc', label: '说明文字', type: 'text' },
    subPlaceholder: { k: 'subPlaceholder', label: '输入框提示', type: 'text' },
    subBtn: { k: 'subBtn', label: '按钮文字', type: 'text' },
    subAction: { k: 'subAction', label: '提交地址', type: 'text', hint: '表单 action；留空则只展示不提交，避免误发' },
    subCardBg: { k: 'subCardBg', label: '卡片背景', type: 'color' },
    subBtnBg: { k: 'subBtnBg', label: '按钮颜色', type: 'color' },
    /* 商品卡片 */
    prodImage: { k: 'prodImage', label: '商品图片', type: 'media' },
    prodName: { k: 'prodName', label: '商品名称', type: 'text' },
    prodDesc: { k: 'prodDesc', label: '简介', type: 'text' },
    prodPrice: { k: 'prodPrice', label: '现价', type: 'text', hint: '如 ¥299' },
    prodOldPrice: { k: 'prodOldPrice', label: '原价', type: 'text', hint: '留空则不显示划线价' },
    prodBadge: { k: 'prodBadge', label: '角标', type: 'text', hint: '如 热销 / 新品' },
    prodBtn: { k: 'prodBtn', label: '按钮文字', type: 'text' },
    prodHref: { k: 'prodHref', label: '按钮链接', type: 'text' },
    prodCardBg: { k: 'prodCardBg', label: '卡片背景', type: 'color' },
    /* 优惠券 */
    cpAmount: { k: 'cpAmount', label: '优惠金额 / 折扣', type: 'text', hint: '如 ¥50 或 8.5 折' },
    cpCondition: { k: 'cpCondition', label: '使用门槛', type: 'text', hint: '如 满 299 元可用' },
    cpTitle: { k: 'cpTitle', label: '券名称', type: 'text' },
    cpCode: { k: 'cpCode', label: '优惠码', type: 'text', hint: '留空则不显示券码' },
    cpBtn: { k: 'cpBtn', label: '按钮文字', type: 'text' },
    cpHref: { k: 'cpHref', label: '按钮链接', type: 'text' },
    cpBg: { k: 'cpBg', label: '券面背景', type: 'color' },
    cpAccent: { k: 'cpAccent', label: '主色', type: 'color' },
    /* 下载卡片 */
    dlIcon: { k: 'dlIcon', label: '文件图标', type: 'text', hint: 'emoji，如 📄 📦 🎵' },
    dlName: { k: 'dlName', label: '文件名', type: 'text' },
    dlMeta: { k: 'dlMeta', label: '文件信息', type: 'text', hint: '如 PDF · 2.4 MB' },
    dlBtn: { k: 'dlBtn', label: '按钮文字', type: 'text' },
    dlHref: { k: 'dlHref', label: '下载地址', type: 'text', hint: '文件直链，或上传后的素材地址' },
    dlCardBg: { k: 'dlCardBg', label: '卡片背景', type: 'color' },
    /* 社交分享 */
    shareTitle: { k: 'shareTitle', label: '标题', type: 'text' },
    sharePlatforms: { k: 'sharePlatforms', label: '分享平台', type: 'textarea', rows: 2, hint: '用逗号分隔：微信,微博,QQ,复制链接,X,Facebook' },
    shareStyle: { k: 'shareStyle', label: '样式', type: 'seg', opts: [['btn', '按钮'], ['icon', '圆形图标']] },
    shareAccent: { k: 'shareAccent', label: '图标颜色', type: 'color' },
    /* 地址 / 门店卡 */
    mapTitle: { k: 'mapTitle', label: '名称', type: 'text' },
    mapAddress: { k: 'mapAddress', label: '地址', type: 'text' },
    mapPhone: { k: 'mapPhone', label: '电话', type: 'text' },
    mapHours: { k: 'mapHours', label: '营业时间', type: 'text' },
    mapLink: { k: 'mapLink', label: '地图链接', type: 'text', hint: '填地图分享链接，按钮会跳转过去' },
    mapBtn: { k: 'mapBtn', label: '按钮文字', type: 'text' },
    mapCardBg: { k: 'mapCardBg', label: '卡片背景', type: 'color' },
    /* 活动 / 日程卡片 */
    evtDate: { k: 'evtDate', label: '日期', type: 'text', hint: '如 11月28日' },
    evtTime: { k: 'evtTime', label: '时间', type: 'text', hint: '如 14:00 - 17:00' },
    evtTitle: { k: 'evtTitle', label: '活动名称', type: 'text' },
    evtDesc: { k: 'evtDesc', label: '简介', type: 'textarea', rows: 2 },
    evtLocation: { k: 'evtLocation', label: '地点', type: 'text' },
    evtBtn: { k: 'evtBtn', label: '按钮文字', type: 'text' },
    evtHref: { k: 'evtHref', label: '按钮链接', type: 'text' },
    evtAccent: { k: 'evtAccent', label: '日期色块背景', type: 'color' },
    /* 职位列表 */
    jobItems: { k: 'jobItems', label: '职位', type: 'rows', cols: ['职位', '地点', '薪资', '链接'], hint: '一行一个职位' },
    jobTitle: { k: 'jobTitle', label: '模块标题', type: 'text' },
    jobCardBg: { k: 'jobCardBg', label: '卡片背景', type: 'color' },
    jobAccent: { k: 'jobAccent', label: '强调色', type: 'color' },
    /* 图标导航宫格 */
    navItems2: { k: 'navItems2', label: '入口', type: 'rows', cols: ['图标', '名称', '链接'], mediaRows: true, hint: '第一格可填 emoji、图片或上传素材' },
    navCols: { k: 'navCols', label: '每行几个', type: 'seg', opts: [['3', '3 个'], ['4', '4 个'], ['5', '5 个'], ['6', '6 个']] },
    navItemBg: { k: 'navItemBg', label: '单项背景', type: 'color' },
    /* 文章正文 */
    artTitle: { k: 'artTitle', label: '文章标题', type: 'text' },
    artMeta: { k: 'artMeta', label: '元信息', type: 'text', hint: '如 作者 · 2026-11-19 · 5 分钟阅读' },
    artBody: { k: 'artBody', label: '正文', type: 'textarea', rows: 12, hint: '支持换行分段；以「## 」开头是二级标题，以「> 」开头是引用' },
    artCover: { k: 'artCover', label: '封面图', type: 'media' },
    artWidth: { k: 'artWidth', label: '正文宽度', type: 'range', min: 480, max: 980, unit: 'px' },
    artCardBg: { k: 'artCardBg', label: '正文背景', type: 'color' }
  };

  /* ---------- 通用设置的默认值 / 取值（兼容旧项目） ---------- */
  var COMMON_DEFAULTS = {
    linkTarget: 'self', anchorId: '', extraClass: '', boxWidth: 100,
    boxMaxWidth: 0, boxMinHeight: 0, boxHeight: 0, boxMarginY: 0,
    boxAlign: 'left', boxOverflow: 'visible', boxBorderColor: '',
    boxBorderWidth: 0, boxShadow: 'none', boxOpacity: 100, boxHover: 'none',
    boxVisibility: 'all', boxCustomCSS: '', colSpan: 1, flowWidth: 0, stickyTop: 0,
    /* 浮层：默认仍是普通排布，切成 overlay 后才参与叠放 */
    layerMode: 'normal', layerTarget: '', layerX: 8, layerY: 8,
    layerW: 46, layerH: 0, layerZ: 20, layerRotate: 0, layerPointer: 'auto',
    /* 动效：所有值都能在属性面板改，缺省即关闭 */
    loopFx: 'none', animIn: 'none', animDur: 700, animDelay: 0,
    animEase: 'out', animDist: 28, animOnce: '1', animStagger: 0,
    /* 通用增强属性 */
    boxHref: '', boxHoverTip: '', boxColorLock: '0', boxTextColor: '', boxBg: '', boxAccent: '', boxLinkColor: '',
    boxThemeRole: 'auto', boxThemeLightBg: '', boxThemeLightText: '', boxThemeLightAccent: '', boxThemeLightLink: '',
    boxThemeDarkBg: '', boxThemeDarkText: '', boxThemeDarkAccent: '', boxThemeDarkLink: '',
    boxRadius: 0, boxFont: '', boxFontSize: 0, boxLineHeight: 0,
    boxLetterSpacing: 0, boxFontWeight: '', boxTextTransform: 'none', boxTextShadow: 'none',
    boxFilter: 'none', boxBlend: 'normal', boxBackdrop: '0', boxRotate: 0, boxScale: 100,
    boxCursor: '', boxPointer: 'auto', boxAriaLabel: '', boxPrintHide: '0',
    boxBgImage: '', boxBgSize: 'cover', boxBgRepeat: 'no-repeat',
    boxBorderStyle: 'solid', boxPadY: 0, boxTextDeco: 'none'
  };
  function cv(p, k) {
    var v = p ? p[k] : undefined;
    return (v == null || v === '') ? COMMON_DEFAULTS[k] : v;
  }
  function cnum(p, k) {
    var n = Number(cv(p, k));
    return isFinite(n) ? n : (Number(COMMON_DEFAULTS[k]) || 0);
  }
  /* 这些字段代表模块内存在链接，才在属性面板显示「链接打开方式」 */
  var LINK_FIELD_KEYS = ['href', 'url', 'navItems', 'navCtaHref', 'crumbItems', 'footerLinks', 'btnItems', 'priceItems', 'logoItems', 'searchAction', 'brandItems', 'cardLinks', 'linkItems'];
  function hasLinks(b) {
    // 整块链接是通用属性，任何模块设了它都应显示「链接打开方式」
    if (b && String(cv(b.p, 'boxHref') || '').trim()) return true;
    var a = ASSET_MAP[b.type];
    return !!a && a.fields.some(function (k) { return LINK_FIELD_KEYS.indexOf(k) >= 0; });
  }

  /* ---------- 动效 ----------
     进入动画只定义「起始状态」，终态就是元素本身的样式；导出页由
     IntersectionObserver 加 .wr-in 触发过渡，没有 JS 时元素默认可见。
     同一份 ANIM 表既生成 CSS，也用来在编辑器里试播（WAAPI），保证两边一致。 */
  var ANIM = {
    none: { label: '无', build: null },
    up: { label: '上移淡入', build: function (d) { return { opacity: 0, transform: 'translate3d(0,' + d + ',0)' }; } },
    down: { label: '下移淡入', build: function (d) { return { opacity: 0, transform: 'translate3d(0,calc(-1 * ' + d + '),0)' }; } },
    left: { label: '向右滑入', build: function (d) { return { opacity: 0, transform: 'translate3d(calc(-1.4 * ' + d + '),0,0)' }; } },
    right: { label: '向左滑入', build: function (d) { return { opacity: 0, transform: 'translate3d(calc(1.4 * ' + d + '),0,0)' }; } },
    fade: { label: '纯淡入', build: function () { return { opacity: 0 }; } },
    zoom: { label: '缩放淡入', build: function () { return { opacity: 0, transform: 'scale(.92)' }; } },
    pop: { label: '弹入放大', build: function () { return { opacity: 0, transform: 'scale(.72)' }; } },
    rotate: { label: '旋转淡入', build: function () { return { opacity: 0, transform: 'rotate(-3deg) scale(.96)' }; } },
    flip: { label: '翻转展开', build: function () { return { opacity: 0, transform: 'perspective(900px) rotateX(16deg)' }; } },
    unfold: { label: '3D 翻开', build: function (d) { return { opacity: 0, transform: 'perspective(1000px) rotateY(-30deg) translate3d(calc(-1 * ' + d + '),0,0)' }; } },
    swing: { label: '摆动入场', build: function (d) { return { opacity: 0, transform: 'rotate(7deg) translate3d(0,' + d + ',0)' }; } },
    skew: { label: '斜切入场', build: function (d) { return { opacity: 0, transform: 'skewY(5deg) translate3d(0,' + d + ',0)' }; } },
    mask: { label: '遮罩揭示', build: function () { return { opacity: 0, clipPath: 'inset(0 0 100% 0)' }; } },
    rise: { label: '遮罩升起', build: function (d) { return { opacity: 0, clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0,calc(.7 * ' + d + '),0)' }; } },
    blur: { label: '模糊聚焦', build: function () { return { opacity: 0, filter: 'blur(10px)' }; } },
    blurup: { label: '模糊上移', build: function (d) { return { opacity: 0, filter: 'blur(12px)', transform: 'translate3d(0,' + d + ',0)' }; } },
    drop: { label: '垂落入场', build: function (d) { return { opacity: 0, transform: 'translate3d(0,calc(-2.2 * ' + d + '),0)' }; } },
    wipe: { label: '横向擦除', build: function () { return { opacity: 0, clipPath: 'inset(0 100% 0 0)' }; } },
    blurzoom: { label: '模糊放大', build: function () { return { opacity: 0, filter: 'blur(14px)', transform: 'scale(1.08)' }; } },
    spring: { label: '弹跳入场', build: function () { return { opacity: 0, transform: 'scale(.86) rotate(-1.5deg)' }; } },
    slideblur: { label: '模糊滑入', build: function (d) { return { opacity: 0, filter: 'blur(8px)', transform: 'translate3d(calc(-1.2 * ' + d + '),0,0)' }; } }
  };
  var EASE = {
    out: 'cubic-bezier(.22,1,.36,1)',
    smooth: 'cubic-bezier(.4,0,.2,1)',
    spring: 'cubic-bezier(.34,1.56,.64,1)',
    linear: 'linear'
  };
  /* 动效强度：只缩放位移与时长，不影响是否开启 */
  function fxMul() {
    var lv = String(state.page && state.page.fxLevel || '2');
    return lv === '1' ? 0.7 : (lv === '3' ? 1.35 : 1);
  }
  function animOf(p) {
    var k = cv(p, 'animIn');
    return ANIM[k] ? k : 'none';
  }
  function animEase(p) { var e = cv(p, 'animEase'); return EASE[e] || EASE.out; }
  function animVars(b, extraDelay) {
    if (animOf(b.p) === 'none') return '';
    var m = fxMul();
    var dur = Math.max(120, Math.min(2600, Math.round(cnum(b.p, 'animDur') * m)));
    var dist = Math.max(0, Math.min(160, Math.round(cnum(b.p, 'animDist') * m)));
    var delay = Math.max(0, Math.min(4000, Math.round(cnum(b.p, 'animDelay') + (extraDelay || 0))));
    return '--wr-adur:' + dur + 'ms;--wr-adelay:' + delay + 'ms;--wr-adist:' + dist +
      'px;--wr-aease:' + animEase(b.p) + ';';
  }
  function pageFx(p) {
    p = p || state.page || {};
    return {
      glow: p.cursorGlow === '1',
      cursor: p.cursorStyle || 'none',
      magnet: p.magnet === '1',
      bar: p.scrollBar === '1',
      top: p.backTop === '1',
      /* 动效库里的页面级效果 */
      spotlight: p.spotlight === '1',      par: p.parallax === '1',
      ripple: p.ripple === '1',
      shadow: p.scrollShadow === '1',
      count: p.countUp === '1',
      trail: p.trail === '1',
      veil: p.pageVeil === '1',
      grain: p.grain === '1',
      respect: p.reduceMotion !== '0'
    };
  }

  /* 视差滚动只作用于顶层模块：不能是吸顶导航（translate 会让它脱离吸附位），
     也不能是容器（容器里的吸顶子模块会跟着漂）。用独立的 translate 属性做位移，
     与进场动画 / 悬停的 transform 互不覆盖。 */
  function parEligible(b, parent) {
    if (!state.page || state.page.parallax !== '1') return false;
    if (parent || !b || !b.p) return false;
    return !isNavType(b.type) && !isContainer(b);
  }

  /* ---------- 开场动画：品牌幕 / 光标进入 / 幕布揭开 + 滚动提示 ----------
     进入网站时先盖一层整屏幕布，再揭开显示页面；配合底部的滚轮鼠标提示。 */
  var INTRO_STYLES = ['none', 'splash', 'cursor', 'veil', 'film'];
  var INTRO_DRIVE = ['scroll', 'auto'];
  var INTRO_FREQ = ['always', 'session', 'once'];
  var HINT_STYLES = ['none', 'mouse', 'arrow'];
  /* 幕布 / 提示条文字颜色：亮色背景自动转深色，避免白字看不清 */
  function colorLum(c) {
    var m = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/.exec(String(c || ''));
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) / 255;
    var g = parseInt(h.slice(2, 4), 16) / 255;
    var b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function readableInk(bg) {
    var v = String(bg == null ? '' : bg);
    if (/gradient/i.test(v)) {
      var m = /rgba?\(\s*\d+[,\s]+\d+[,\s]+\d+[^)]*\)|#[0-9a-fA-F]{3,8}/.exec(v);
      v = m ? m[0] : '';
    }
    var l = colorLum(v);
    return (l != null && l > 0.62) ? '#16233a' : '#ffffff';
  }
  /* 每个项目一个稳定的存储键：同一个页面「每会话一次 / 仅一次」只播一遍 */
  function introKey() {
    var s = String(state.name || '') + '|' + String((state.page || {}).introTitle || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return 'wr-intro-' + (h >>> 0).toString(36);
  }
  var previewMode = false;   // 预览时按「第一次访问」播放，不计入播放记录
  function introCfg() {
    var p = state.page || {};
    var style = INTRO_STYLES.indexOf(p.introStyle) >= 0 ? p.introStyle : 'none';
    var hint = HINT_STYLES.indexOf(p.hintStyle) >= 0 ? p.hintStyle : 'none';
    var bg = p.introBg ? paint(p.introBg, safeCssColor(p.accent, '#3b82f6')) : safeCssColor(p.accent, '#3b82f6');
    if (!bg) bg = '#3b82f6';
    var ink = readableInk(bg);
    var dur = Number(p.introDur);
    return {
      style: style,
      hint: hint,
      title: String(p.introTitle || '').trim().slice(0, 40) || String(state.name || '我的网页').slice(0, 40),
      sub: String(p.introSub || '').trim().slice(0, 60),
      bg: bg,
      ink: ink,
      dur: isFinite(dur) && dur > 0 ? Math.max(600, Math.min(5000, Math.round(dur))) : 2000,
      freq: previewMode ? 'always' : (INTRO_FREQ.indexOf(p.introFreq) >= 0 ? p.introFreq : 'session'),
      noStore: previewMode,
      film: p.introStyle === 'film' ? filmSrcOf({ filmSrc: p.introFilm }) : '',
      filmPoster: p.introStyle === 'film' ? filmPosterOf({ filmSrc: p.introFilm, filmPoster: p.introPoster }) : '',
      // 揭幕推进：跟鼠标滚动走（默认）或按设定时长自播
      drive: INTRO_DRIVE.indexOf(p.introDrive) >= 0 ? p.introDrive : 'scroll',
      hintText: String(p.hintText || '').trim().slice(0, 24) || '滑动鼠标',
      hintColor: p.hintColor ? safeCssColor(p.hintColor, ink) : safeCssColor(p.text, '#16233a'),
      respect: pageFx(p).respect,
      key: introKey()
    };
  }
  function introHTML(c) {
    if (!c || c.style === 'none') return '';
    var title = esc(c.title), sub = c.sub ? esc(c.sub) : '';
    var mark = esc(String(c.title || 'W').trim().slice(0, 1).toUpperCase() || 'W');
    var arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2l0 17.6 4.4-4.2 2.8 6.5 2.8-1.2-2.8-6.4 5.8-.4z" ' +
      'fill="#fff" stroke="#16233a" stroke-width="1.1" stroke-linejoin="round"/></svg>';
    var head = '<span class="wr-splash-name">' + title + '</span>' +
      (sub ? '<span class="wr-splash-sub">' + sub + '</span>' : '');
    var cta = '<span class="wr-splash-cta"><button type="button" class="wr-splash-enter">进入网站</button>' +
      '<span class="wr-splash-ripple"></span>' +
      '<span class="wr-splash-cursor">' + arrow + '</span></span>';
    // 短品牌名（如「岚 野」）直接把全名当标志，再配一个首字徽标就重复了
    var showMark = String(c.title || '').trim().length > 6;
    var body = c.style === 'film'
      ? (c.film
        // 自动播放时循环：片子比停留时长短的话，否则会定在最后一帧（很多成片最后一帧是黑的）
        ? '<video class="wr-splash-v" muted playsinline preload="auto" aria-hidden="true"' +
          (c.drive === 'scroll' ? '' : ' loop') +
          (c.filmPoster ? ' poster="' + esc(c.filmPoster) + '"' : '') + ' src="' + esc(c.film) + '"></video>'
        : '<span class="wr-splash-v wr-splash-vnone" aria-hidden="true"></span>') +
        '<span class="wr-splash-scrim" aria-hidden="true"></span>' +
        '<span class="wr-splash-hero"><span class="wr-splash-brand">' + head + '</span>' + cta + '</span>'
      : (showMark ? '<span class="wr-splash-mark">' + mark + '</span>' : '') + head + cta;
    var tip = c.drive === 'scroll'
      ? '<span class="wr-splash-tip"><span class="wr-mouse" aria-hidden="true"><i></i></span>' +
        (c.style === 'film' ? '向下滚动播放' : '向下滚动进入') + '</span>'
      : '';
    return '<div class="wr-splash" data-style="' + c.style + '" data-drive="' + c.drive + '" role="status" aria-label="正在进入 ' + title + '"' +
      ' style="--wr-intro-dur:' + c.dur + 'ms;--wr-intro-bg:' + esc(c.bg) + ';background:' + esc(c.bg) + ';color:' + esc(c.ink) + '">' +
      body + tip +
      '<span class="wr-splash-bar"><i></i></span>' +
      '</div>';
  }
  /* 提示字色的亮度（0 黑 ~ 1 白），解析不了返回 -1 */
  function colorLum(c) {
    var s = String(c == null ? '' : c).trim().toLowerCase(), m, r, g, b;
    if ((m = /^#([0-9a-f]{3,8})$/.exec(s))) {
      var h = m[1];
      if (h.length < 6) {
        r = parseInt(h.charAt(0) + h.charAt(0), 16);
        g = parseInt(h.charAt(1) + h.charAt(1), 16);
        b = parseInt(h.charAt(2) + h.charAt(2), 16);
      } else {
        r = parseInt(h.substr(0, 2), 16); g = parseInt(h.substr(2, 2), 16); b = parseInt(h.substr(4, 2), 16);
      }
    } else if ((m = /^rgba?\(([^)]*)\)/.exec(s))) {
      var p = m[1].split(/[,\s\/]+/).filter(Boolean);
      r = parseFloat(p[0]); g = parseFloat(p[1]); b = parseFloat(p[2]);
    } else if (s === 'white') {
      r = g = b = 255;
    } else if (s === 'black') {
      r = g = b = 0;
    } else {
      return -1;
    }
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) return -1;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  /* 提示衬底：按字的明暗反过来挑深浅底，任何页面底色上都压得住正文 */
  function hintTone(color) {
    var l = colorLum(color);
    var dark = l < 0 ? true : l < 0.6;   // 解析不出来按「浅底深字」处理，这是最常见的组合
    return dark
      ? { bg: 'rgba(255,255,255,.74)', bd: 'rgba(12,22,40,.14)', veil: 'rgba(255,255,255,.95)' }
      : { bg: 'rgba(10,16,28,.74)', bd: 'rgba(255,255,255,.24)', veil: 'rgba(10,16,28,.95)' };
  }
  function hintHTML(c) {
    if (!c || c.hint === 'none') return '';
    var ic = c.hint === 'arrow'
      ? '<svg class="wr-hintarrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" ' +
        'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<span class="wr-mouse" aria-hidden="true"><i></i></span>';
    var tn = hintTone(c.hintColor);
    return '<a class="wr-scrollhint" href="#top" aria-label="向下滚动查看更多"' +
      ' style="--wr-hint:' + esc(c.hintColor) + ';color:' + esc(c.hintColor) +
      ';--wr-hint-bg:' + tn.bg + ';--wr-hint-bd:' + tn.bd + ';--wr-hint-veil:' + tn.veil + '">' +
      ic + '<span class="wr-scrollhint-t">' + esc(c.hintText) + '</span></a>';
  }


  /* ---------- 素材库（35 种基础组件 · 5 个分组） ---------- */
  var ASSETS = [
    { type: 'hero', label: '主视觉区', ico: '◈', tone: '',
      fields: ['kicker', 'title', 'desc', 'btnText', 'href', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'color', 'bg', 'align', 'padY', 'padX'],
      d: { kicker: 'WELCOME', title: '把想法，做成看得见的页面', desc: '一段简洁有力的介绍文字，说明你是谁、做什么、为谁而做。', btnText: '了解更多', href: '#more', btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 10, btnPadX: 28, btnPadY: 13, btnFontSize: 15, btnWeight: '600', btnShadow: 'soft', color: '#ffffff', bg: '#12233f', align: 'center', padY: 80, padX: 32, radius: 0 } },
    { type: 'heading', label: '标题', ico: 'H', tone: '',
      fields: ['text', 'level', 'color', 'align', 'fontSize', 'padY', 'padX', 'bg'],
      d: { text: '在这里写标题', level: '2', color: '#16233a', align: 'center', fontSize: 36, padY: 28, padX: 24, bg: '' } },
    { type: 'text', label: '段落文字', ico: '¶', tone: '',
      fields: ['text', 'color', 'align', 'fontSize', 'padY', 'padX', 'bg'],
      d: { text: '这是一段正文。点击选中后，可以在右侧修改文字、颜色、字号和对齐方式。支持换行。', color: '#4a5a72', align: 'center', fontSize: 16, padY: 12, padX: 24, bg: '' } },
    { type: 'button', label: '按钮', ico: '▭', tone: 'gold',
      fields: ['text', 'href', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'btnBorderWidth', 'btnFull', 'align', 'padY', 'bg'],
      d: { text: '点击按钮', href: '#', btnStyle: 'auto', btnBg: '#3b82f6', btnColor: '#ffffff', btnRadius: 10, btnPadX: 30, btnPadY: 13, btnFontSize: 15, btnWeight: '600', btnShadow: 'soft', btnBorderWidth: 0, btnFull: '0', radius: 10, align: 'center', padY: 20, padX: 24, bg: '' } },
    { type: 'image', label: '图片', ico: '▧', tone: '',
      fields: ['src', 'alt', 'caption', 'width', 'radius', 'align', 'padY', 'bg'],
      d: { src: '', alt: '图片', caption: '', width: 100, radius: 12, align: 'center', padY: 18, padX: 24, bg: '' } },
    { type: 'card', label: '卡片', ico: '▢', tone: '',
      fields: ['emoji', 'title', 'desc', 'cardBg', 'color', 'radius', 'cardPadX', 'cardPadY', 'cardTitleSize', 'cardTextSize', 'cardIconSize', 'align', 'padY', 'bg'],
      d: { emoji: '✦', title: '卡片标题', desc: '用一两句话说明这个模块要表达的重点。', cardBg: '#f3f7ff', color: '#16233a', radius: 16, cardPadX: 28, cardPadY: 28, cardTitleSize: 20, cardTextSize: 14, cardIconSize: 48, align: 'left', padY: 24, padX: 24, bg: '' } },
    { type: 'grid', label: '三栏特性', ico: '▦', tone: 'violet',
      fields: ['items', 'title', 'cols', 'cardBg', 'color', 'radius', 'cardPadX', 'cardPadY', 'cardTitleSize', 'cardTextSize', 'cardIconSize', 'align', 'padY', 'bg'],
      d: { items: '⚡ | 快速上手 | 拖一拖就能搭出页面\n🎨 | 自由定制 | 颜色字号留白都能改\n↧ | 一键导出 | 得到独立可用的 HTML', title: '', cols: 3, cardBg: '#f5f8ff', color: '#16233a', radius: 14, cardPadX: 20, cardPadY: 26, cardTitleSize: 17, cardTextSize: 13, cardIconSize: 42, align: 'center', padY: 40, padX: 24, bg: '' } },
    { type: 'twocol', label: '双栏内容', ico: '▥', tone: '',
      fields: ['leftTitle', 'leftText', 'rightTitle', 'rightText', 'cardBg', 'color', 'radius', 'cardPadX', 'cardPadY', 'cardTitleSize', 'cardTextSize', 'padY', 'bg'],
      d: { leftTitle: '左边标题', leftText: '左栏的正文内容，可以写特点、说明或列表。', rightTitle: '右边标题', rightText: '右栏的正文内容，与左栏形成对照或补充。', cardBg: '#f5f8ff', color: '#16233a', radius: 14, cardPadX: 26, cardPadY: 26, cardTitleSize: 19, cardTextSize: 14, padY: 36, padX: 24, bg: '' } },
    { type: 'stats', label: '数字统计', ico: '№', tone: 'gold',
      rowCols: { items: ['数值', '说明'] },
      fields: ['items', 'title', 'color', 'bg', 'padY'],
      d: { items: '12 | 年经验\n240 | 个项目\n99% | 好评率', title: '', color: '#16233a', bg: '#f5f8ff', padY: 40, padX: 24 } },
    { type: 'quote', label: '引用', ico: '❝', tone: '',
      fields: ['text', 'author', 'color', 'bg', 'align', 'padY', 'radius'],
      d: { text: '好的设计，是让人感觉不到设计的存在。', author: '— 团队寄语', color: '#2b3b57', bg: '#f5f8ff', align: 'center', padY: 36, padX: 32, radius: 14 } },
    { type: 'badge', label: '标签组', ico: '#', tone: '',
      fields: ['text', 'tagBg', 'color', 'align', 'padY', 'bg'],
      d: { text: '设计, 开发, 运营, 协作', tagBg: '#e5f4ff', color: '#1c6bb5', align: 'center', padY: 20, padX: 24, bg: '' } },
    { type: 'divider', label: '分割线', ico: '—', tone: '',
      fields: ['lineColor', 'thickness', 'lineWidth', 'align', 'padY', 'bg'],
      d: { lineColor: '#dce5f2', thickness: 2, lineWidth: 60, align: 'center', padY: 22, padX: 24, bg: '' } },
    { type: 'spacer', label: '空白间距', ico: '↕', tone: '',
      fields: ['height', 'bg'],
      d: { height: 48, bg: '', padY: 0, padX: 0 } },
    { type: 'video', label: '视频链接卡', ico: '▶', tone: 'gold',
      fields: ['title', 'desc', 'url', 'btnText', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'radius', 'align', 'padY', 'bg'],
      d: { title: '观看介绍视频', desc: '点击下方按钮打开视频页面，可在右侧设置是否新标签页。', url: 'https://', btnText: '播放视频', btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 9, btnPadX: 26, btnPadY: 11, btnFontSize: 14, btnWeight: '600', btnShadow: 'none', radius: 16, align: 'center', padY: 32, padX: 24, bg: '#f5f8ff' } },
    { type: 'film', label: '滚动视频', ico: '◉', tone: 'violet',
      fields: ['filmSrc', 'filmMode', 'filmH', 'filmW', 'filmPoster', 'radius', 'padY', 'padX', 'bg'],
      d: {
        filmSrc: 'builtin:ui', filmMode: 'scroll', filmH: 420, filmW: 100, filmPoster: '',
        radius: 16, padY: 24, padX: 24, bg: ''
      } },
    { type: 'form', label: '联系表单', ico: '✉', tone: 'violet',
      fields: ['title', 'desc', 'btnText', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'btnFull', 'inputBg', 'inputColor', 'inputPhColor', 'inputBorderColor', 'inputBorderWidth', 'inputRadius', 'inputPadX', 'inputPadY', 'color', 'bg', 'radius', 'padY'],
      d: { title: '和我们聊聊', desc: '留下联系方式，我们会尽快回复。', btnText: '提交', btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 8, btnPadX: 12, btnPadY: 12, btnFontSize: 14, btnWeight: '600', btnShadow: 'none', btnFull: '1', inputBg: '', inputColor: '', inputPhColor: '', inputBorderColor: '', inputBorderWidth: 1, inputRadius: 8, inputPadX: 13, inputPadY: 11, color: '#16233a', bg: '#f5f8ff', radius: 16, padY: 40, align: 'center', padX: 24 } }
  ];
  /* ---------- 分组归属 ---------- */
  var GROUPS = [
    { key: 'basic', label: '基础内容', ico: '◆' },
    { key: 'nav', label: '导航与框架', ico: '▤' },
    { key: 'show', label: '内容展示', ico: '▦' },
    { key: 'singles', label: '单条组件', ico: '◫' },
    { key: 'convert', label: '转化与互动', ico: '✦' },
    { key: 'social', label: '社区与产品', ico: '◍' },
    { key: 'visual', label: '视觉实验', ico: '✧' },
    { key: 'personal', label: '个性化', ico: '☺' },
    { key: 'appearance', label: '网页外观', ico: '◐' },
    { key: 'layout', label: '排版工具', ico: '↕' },
    { key: 'custom', label: '自定义', ico: '✧' }
  ];
  var GROUP_OF = {
    hero: 'basic', heading: 'basic', text: 'basic', button: 'basic', image: 'basic', card: 'basic', quote: 'basic', badge: 'basic',
    grid: 'show', twocol: 'show', stats: 'show', film: 'show',
    divider: 'layout', spacer: 'layout', video: 'convert', form: 'convert'
  };
  ASSETS.forEach(function (a) { a.g = a.g || GROUP_OF[a.type] || 'basic'; });

  /* ---------- 新增组件（21 种，含容器与「一行多列容器」预设） ---------- */
  ASSETS = ASSETS.concat([
    /* ===== 可嵌套容器 ===== */
    { type: 'container', label: '容器 / 分组', ico: '⬚', tone: 'gold', g: 'layout', nest: true,
      fields: ['layout', 'cols', 'alignItems', 'gap', 'title', 'bg', 'color', 'lineColor', 'radius', 'padY', 'padX', 'align'],
      d: { layout: 'stack', cols: 3, alignItems: 'stretch', gap: 14, title: '', bg: '#f5f8ff', color: '#16233a', lineColor: '#dfe8f6', radius: 14, padY: 24, padX: 24, align: 'left' } },
    /* 预设：拖进来就是一行多列，往里放几个模块就并排几个（内部仍是标准容器） */
    { type: 'rowbox', label: '一行多列容器', ico: '▤', tone: 'gold', g: 'layout', nest: true,
      fields: [], d: {},
      preset: { realType: 'container', p: { layout: 'row', cols: 3, alignItems: 'stretch', gap: 14, title: '', bg: '#f5f8ff', color: '#16233a', lineColor: '#dfe8f6', radius: 14, padY: 24, padX: 24, align: 'left' } } },

    /* ===== 导航与框架 ===== */
    { type: 'navbar', label: '导航栏', ico: '☰', tone: 'gold', g: 'nav',
      fields: ['title', 'emoji', 'navItems', 'btnText', 'navCtaHref', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'navLinkColor', 'navLinkHover', 'navLinkSize', 'navLinkGap', 'navBrandSize', 'sticky', 'stickyTop', 'navHeight', 'align', 'color', 'bg', 'padX'],
      d: { title: 'WR Studio', emoji: '✦', navItems: '首页 | #top\n功能 | #features\n案例 | #works\n关于我们 | #about', btnText: '开始使用', navCtaHref: '#contact', btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 9, btnPadX: 18, btnPadY: 9, btnFontSize: 14, btnWeight: '600', btnShadow: 'none', navLinkColor: '', navLinkHover: '', navLinkSize: 14, navLinkGap: 20, navBrandSize: 17, sticky: '1', stickyTop: 0, navHeight: 64, align: 'right', color: '#16233a', bg: '#ffffff', padY: 0, padX: 24 } },
    { type: 'announce', label: '顶部公告条', ico: '!', tone: '', g: 'nav',
      fields: ['text', 'emoji', 'btnText', 'href', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'color', 'bg'],
      d: { text: '新版已上线，新增 19 个常用组件', emoji: '📣', btnText: '查看详情', href: '#features', btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 60, btnPadX: 12, btnPadY: 6, btnFontSize: 13, btnWeight: '600', btnShadow: 'none', color: '#ffffff', bg: '#1b3b6f', padY: 10, padX: 24, align: 'center' } },
    { type: 'breadcrumb', label: '面包屑', ico: '›', tone: '', g: 'nav',
      fields: ['crumbItems', 'color', 'bg', 'align', 'padY', 'padX'],
      d: { crumbItems: '首页 | #top\n产品 | #features\n拖拽建站', color: '#7a8aa3', bg: '', align: 'left', padY: 14, padX: 24 } },
    { type: 'footer', label: '页脚', ico: '▄', tone: 'gold', g: 'nav',
      fields: ['title', 'desc', 'footerLinks', 'copyright', 'phone', 'email', 'address', 'footLinkColor', 'footLinkSize', 'footLinkGap', 'footTitleSize', 'footBottomSize', 'color', 'bg', 'padY', 'padX'],
      d: { title: 'WR Studio', desc: '一个专注把想法快速落地的小团队。', footerLinks: '首页 | #top\n功能 | #features\n关于我们 | #about\n联系我们 | #contact', copyright: '© 2026 WR Studio · 保留所有权利', phone: '400-000-0000', email: 'hello@example.com', address: '中国 · 上海', footLinkColor: '', footLinkSize: 13, footLinkGap: 7, footTitleSize: 14, footBottomSize: 12, color: '#c8d6ea', bg: '#12233f', padY: 48, padX: 32, radius: 0 } },

    /* ===== 内容展示 ===== */
    { type: 'features', label: '要点清单', ico: '✓', tone: '', g: 'show',
      fields: ['featureItems', 'title', 'cardBg', 'color', 'radius', 'gap', 'cardPadX', 'cardPadY', 'cardTitleSize', 'cardTextSize', 'cardIconSize', 'padY', 'bg'],
      d: { title: '为什么选择我们', featureItems: '⚡ | 开箱即用 | 无需安装，打开浏览器就能开始\n🎯 | 所见即所得 | 每次修改都能立刻看到效果\n↧ | 一键导出 | 生成一个可直接上传的 HTML 文件\n🔒 | 数据在本地 | 所有内容只保存在你的浏览器里', cardBg: '#f5f8ff', color: '#16233a', radius: 12, gap: 14, cardPadX: 20, cardPadY: 20, cardTitleSize: 16, cardTextSize: 13, cardIconSize: 38, align: 'left', padY: 36, padX: 24, bg: '' } },
    { type: 'gallery', label: '图片画廊', ico: '▩', tone: '', g: 'show',
      fields: ['galleryItems', 'title', 'cols', 'gap', 'radius', 'color', 'bg', 'padY'],
      d: { title: '作品展示', galleryItems: ' | 项目一\n | 项目二\n | 项目三', cols: 3, gap: 12, radius: 10, color: '#7a8aa3', align: 'center', padY: 32, padX: 24, bg: '' } },
    { type: 'pricing', label: '价格方案', ico: '＄', tone: 'gold', g: 'show',
      fields: ['priceItems', 'title', 'href', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'cardBg', 'color', 'radius', 'gap', 'cardPadX', 'cardPadY', 'cardTitleSize', 'cardTextSize', 'bg', 'padY'],
      d: { title: '选择适合你的方案', href: '#contact', priceItems: '入门版 | ¥0 | 无限页面；基础组件；本地保存 | 免费开始 | 0\n专业版 | ¥99/月 | 全部组件；自定义域名；优先支持 | 立即购买 | 1\n团队版 | ¥299/月 | 多人协作；品牌定制；专属顾问 | 联系销售 | 0', btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 9, btnPadX: 11, btnPadY: 11, btnFontSize: 14, btnWeight: '600', btnShadow: 'none', cardBg: '#ffffff', color: '#16233a', radius: 16, gap: 16, cardPadX: 22, cardPadY: 28, cardTitleSize: 17, cardTextSize: 13, align: 'center', padY: 40, padX: 24, bg: '#f5f8ff' } },
    { type: 'team', label: '团队成员', ico: '☻', tone: '', g: 'show',
      fields: ['teamItems', 'title', 'cardBg', 'color', 'radius', 'gap', 'cardPadX', 'cardPadY', 'cardTitleSize', 'cardTextSize', 'cardIconSize', 'bg', 'padY'],
      d: { title: '认识我们的团队', teamItems: '👩‍💻 | 林晓 | 前端工程师 | 负责交互与可视化编辑器\n🧑‍🎨 | 陈默 | 视觉设计师 | 让每个页面都好看又好用\n🧑‍💼 | 苏禾 | 项目负责人 | 把控节奏与交付质量', cardBg: '#f5f8ff', color: '#16233a', radius: 14, gap: 16, cardPadX: 18, cardPadY: 26, cardTitleSize: 16, cardTextSize: 13, cardIconSize: 62, align: 'center', padY: 40, padX: 24, bg: '' } },
    { type: 'testimonial', label: '用户评价', ico: '★', tone: 'violet', g: 'show',
      fields: ['text', 'stars', 'avatar', 'author', 'role', 'cardBg', 'color', 'radius', 'cardPadX', 'cardPadY', 'cardTextSize', 'cardIconSize', 'bg', 'padY'],
      d: { text: '以前做个落地页要等一周，现在自己拖一拖，下午就能上线给客户看。', stars: 5, avatar: '🙂', author: '王先生', role: '某互联网公司 · 运营负责人', cardBg: '#f5f8ff', color: '#16233a', radius: 16, cardPadX: 30, cardPadY: 34, cardTextSize: 19, cardIconSize: 46, align: 'center', padY: 44, padX: 32, bg: '' } },
    { type: 'timeline', label: '时间线', ico: '⌁', tone: '', g: 'show',
      fields: ['timelineItems', 'title', 'lineColor', 'color', 'bg', 'padY'],
      d: { title: '我们的历程', timelineItems: '2023 | 团队成立 | 三个人、一台服务器，从第一个小项目开始\n2024 | 产品上线 | 自研工具正式对外开放，服务第一批客户\n2026 | 持续进化 | 组件库扩充到 36 个，容器里还能一行放多个模块', lineColor: '#c9dcf7', color: '#16233a', padY: 40, padX: 32, bg: '' } },
    { type: 'progress', label: '进度 / 技能条', ico: '▰', tone: '', g: 'show',
      fields: ['progressItems', 'title', 'barColor', 'color', 'bg', 'padY'],
      d: { title: '我们擅长的事', progressItems: '前端开发 | 95\n视觉设计 | 88\n项目运营 | 82', barColor: '#3b82f6', color: '#16233a', padY: 36, padX: 32, bg: '' } },
    { type: 'logos', label: '合作品牌墙', ico: '▥', tone: '', g: 'show',
      fields: ['logoItems', 'title', 'cardBg', 'color', 'radius', 'gap', 'bg', 'padY'],
      d: { title: '他们都在使用', logoItems: 'NORTH\nLUMEN\n像素工场\nATLAS\n青柠科技', cardBg: '#f5f8ff', color: '#5b6c86', radius: 10, gap: 12, align: 'center', padY: 36, padX: 24, bg: '' } },
    { type: 'table', label: '表格', ico: '▤', tone: '', g: 'show',
      fields: ['tableData', 'title', 'cardBg', 'lineColor', 'color', 'bg', 'padY'],
      d: { title: '方案对比', tableData: '功能 | 入门版 | 专业版\n页面数量 | 3 | 无限\n自定义域名 | — | 支持\n技术支持 | 社区 | 专属', cardBg: '#eef4ff', lineColor: '#e2eaf6', color: '#16233a', padY: 36, padX: 24, bg: '' } },
    { type: 'code', label: '代码块', ico: '</>', tone: '', g: 'show',
      fields: ['codeLang', 'codeText', 'radius', 'padY', 'bg'],
      d: { codeLang: 'HTML', codeText: '<section class="hero">\n  <h1>Hello, World!</h1>\n  <p>用 WR Studio 搭出来的页面。</p>\n</section>', radius: 12, padY: 28, padX: 24, bg: '' } },

    /* ===== 转化与互动 ===== */
    { type: 'cta', label: '行动号召', ico: '➤', tone: 'gold', g: 'convert',
      fields: ['title', 'desc', 'btnText', 'href', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'color', 'radius', 'bg', 'align', 'padY'],
      d: { title: '准备好开始了吗？', desc: '不用写代码，几分钟就能做出属于你的页面。', btnText: '立即开始', href: '#top', btnStyle: 'auto', btnBg: '', btnColor: '#1b3b6f', btnRadius: 10, btnPadX: 28, btnPadY: 12, btnFontSize: 15, btnWeight: '700', btnShadow: 'none', color: '#ffffff', radius: 18, bg: '#2a5bd7', align: 'center', padY: 52, padX: 32 } },
    { type: 'buttongroup', label: '按钮组', ico: '▭▭', tone: '', g: 'convert',
      fields: ['btnItems', 'title', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'gap', 'align', 'padY', 'bg'],
      d: { title: '', btnItems: '主要按钮 | #top | 1\n次要按钮 | #features | 0\n了解更多 | #about | 0', btnStyle: 'auto', btnBg: '#3b82f6', btnColor: '', btnRadius: 10, btnPadX: 24, btnPadY: 11, btnFontSize: 14, btnWeight: '600', btnShadow: 'none', radius: 10, gap: 12, align: 'center', padY: 26, padX: 24, bg: '' } },
    { type: 'faq', label: '折叠问答', ico: '?', tone: 'violet', g: 'convert',
      fields: ['faqItems', 'title', 'openFirst', 'cardBg', 'color', 'radius', 'gap', 'bg', 'padY'],
      d: { title: '常见问题', faqItems: '需要安装什么软件吗？ | 不需要，浏览器打开就能用，导出的是单个 HTML 文件。\n我的内容会上传到服务器吗？ | 不会，所有编辑都保存在浏览器本地。\n导出的页面能绑定自己的域名吗？ | 可以，上传 HTML 到任意静态托管或你的服务器即可。', openFirst: '1', cardBg: '#f5f8ff', color: '#16233a', radius: 12, gap: 10, padY: 40, padX: 32, bg: '' } },
    { type: 'notice', label: '提示框', ico: '!', tone: '', g: 'convert',
      fields: ['noticeType', 'noticeIcon', 'title', 'text', 'radius', 'padY', 'bg'],
      d: { noticeType: 'info', noticeIcon: '', title: '小提示', text: '导出的 HTML 是纯静态文件，表单为演示用途，不含提交接口。', radius: 12, padY: 20, padX: 24, bg: '' } },
    { type: 'contact', label: '联系信息', ico: '✆', tone: '', g: 'convert',
      fields: ['title', 'phone', 'email', 'address', 'contactIcons', 'cardBg', 'color', 'radius', 'gap', 'bg', 'padY'],
      d: { title: '联系我们', phone: '400-000-0000', email: 'hello@example.com', address: '中国 · 上海', cardBg: '#f5f8ff', color: '#16233a', radius: 14, gap: 16, align: 'center', padY: 40, padX: 24, bg: '' } },

    /* ===== 社区与产品：参考微博 / 知乎 / 豆瓣 / Google / GitHub / 维基 / X / Discord / Awwwards ===== */
    { type: 'hotlist', label: '热搜榜单', ico: '🔥', tone: 'gold', g: 'social',
      fields: ['title', 'hotItems', 'cardBg', 'color', 'radius', 'gap', 'bg', 'padY'],
      d: { title: '实时热搜', hotItems: '城市更新让老街重新热闹 | 482 万 | 热\n年轻人开始重新爱上纸质书 | 356 万 | 新\n开源社区发布新一代工具链 | 291 万 | 爆\n周末去哪儿：城市漫游指南 | 188 万 | 荐\n这份入门清单请收好 | 152 万 | 沸\n夜跑路线图登上本地榜首 | 121 万 |', cardBg: '#ffffff', color: '#16233a', radius: 14, gap: 8, align: 'left', padY: 40, padX: 24, bg: '#f5f8ff' } },
    { type: 'feed', label: '社媒信息流', ico: '◍', tone: 'violet', g: 'social',
      fields: ['feedStyle', 'feedItems', 'cardBg', 'color', 'radius', 'gap', 'bg', 'padY'],
      d: { feedStyle: 'weibo', feedItems: '🌿 | 林间小屋 | 12 分钟前 | 今天把工作区的窗帘换成了亚麻色，阳光一进来整个房间都软了。 |  | 128 | 36 | 902\n📷 | 城市漫游者 | 1 小时前 | 沿河新开的一段步道，傍晚光线很好，推荐散步。 |  | 64 | 12 | 438\n💻 | 开源日报 | 3 小时前 | 本周值得关注的 5 个小工具，都是打开浏览器就能用的。 |  | 312 | 88 | 1560', cardBg: '#ffffff', color: '#16233a', radius: 16, gap: 16, align: 'left', padY: 40, padX: 24, bg: '#f5f8ff' } },
    { type: 'qa', label: '问答回答卡', ico: 'Q', tone: '', g: 'social',
      fields: ['qaQuestion', 'qaAvatar', 'qaAuthor', 'qaBio', 'qaText', 'qaVote', 'qaComments', 'qaTags', 'cardBg', 'color', 'radius', 'bg', 'padY'],
      d: { qaQuestion: '怎样快速做出一个好看又不复杂的个人网站？', qaAvatar: '🧑‍💻', qaAuthor: '知无不言', qaBio: '前端工程师 · 长期写文档', qaText: '先别急着挑框架。把「我是谁、我做什么、怎么联系我」这三件事写清楚，再选一套能改颜色字号的模板就够了。\n\n真正影响观感的往往不是特效，而是留白、字号层级和图片质量。先把这三件事做对，再加一点点动效，页面就不会显得乱。', qaVote: '2.4 万', qaComments: '386', qaTags: '建站, 前端, 设计', cardBg: '#ffffff', color: '#16233a', radius: 16, align: 'left', padY: 40, padX: 24, bg: '#f5f8ff' } },
    { type: 'rating', label: '评分卡片', ico: '★', tone: 'gold', g: 'social',
      fields: ['title', 'ratingItems', 'cardBg', 'color', 'radius', 'gap', 'bg', 'padY'],
      d: { title: '本周值得看', ratingItems: '海边的房间 | 2025 | 8.7 |  | 一个关于告别与重新出发的故事，镜头安静但后劲很足。\n漫长的周末 | 2024 | 7.9 |  | 适合下雨天看的电影，节奏慢，细节很丰富。\n抵达之前 | 2026 | 9.1 |  | 今年最惊喜的一部，看完想立刻去旅行。', cardBg: '#ffffff', color: '#16233a', radius: 14, gap: 16, align: 'left', padY: 40, padX: 24, bg: '#fffaf2' } },
    { type: 'search', label: '搜索焦点区', ico: '⌕', tone: '', g: 'social',
      fields: ['title', 'desc', 'searchPlaceholder', 'searchBtn', 'searchAction', 'searchSuggest', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'inputBg', 'inputColor', 'inputPhColor', 'inputBorderColor', 'inputBorderWidth', 'inputRadius', 'inputPadX', 'inputPadY', 'color', 'bg', 'radius', 'padY'],
      d: { title: '想找什么，直接搜', desc: '一个干净的搜索入口，适合资料站、文档站与作品站。', searchPlaceholder: '输入关键词，按回车搜索', searchBtn: '搜索', searchAction: 'https://www.google.com/search', searchSuggest: '设计灵感, 前端开发, 开源项目, 旅行攻略', btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 60, btnPadX: 26, btnPadY: 13, btnFontSize: 15, btnWeight: '600', btnShadow: 'none', inputBg: '', inputColor: '', inputPhColor: '', inputBorderColor: '', inputBorderWidth: 0, inputRadius: 30, inputPadX: 16, inputPadY: 13, color: '#16233a', bg: '#f5f8ff', radius: 999, align: 'center', padY: 72, padX: 24 } },
    { type: 'repo', label: '仓库项目卡', ico: '⌥', tone: '', g: 'social',
      fields: ['repoName', 'repoOwner', 'repoDesc', 'repoLang', 'repoStars', 'repoForks', 'repoIssues', 'repoTopics', 'repoUpdated', 'cardBg', 'color', 'radius', 'bg', 'padY'],
      d: { repoName: 'awesome-web-studio', repoOwner: 'wr-team', repoDesc: '一个收集建站灵感、组件写法和交互动效的开源清单，持续更新。', repoLang: 'JavaScript', repoStars: '3.2k', repoForks: '486', repoIssues: '12', repoTopics: 'website, components, animation, open-source', repoUpdated: '2 小时前更新', cardBg: '#ffffff', color: '#16233a', radius: 14, align: 'left', padY: 40, padX: 24, bg: '#f6f8fa' } },
    { type: 'wiki', label: '百科条目卡', ico: 'W', tone: '', g: 'social',
      fields: ['title', 'wikiLead', 'wikiInfobox', 'wikiToc', 'wikiBody', 'cardBg', 'lineColor', 'color', 'bg', 'padY'],
      d: { title: '万维网', wikiLead: '万维网是一个通过互联网访问的、由许多互相链接的超文本组成的信息系统。它让文档之间可以通过超链接互相引用，从而形成一张巨大的信息网。', wikiInfobox: '类型 | 信息系统\n创建时间 | 1989\n创始人 | Tim Berners-Lee\n核心技术 | HTML、URL、HTTP', wikiToc: '概述\n历史\n核心技术\n相关协议', wikiBody: '万维网的雏形来自 1989 年欧洲核子研究中心的一项内部提案。随后，HTML、URL 与 HTTP 三个基础约定让浏览器和服务器能够彼此理解。\n\n今天，万维网已经从静态文档扩展到动态应用、社交网络与开放数据平台，但它最初的链接思想依然是整个体系的骨架。', cardBg: '#ffffff', lineColor: '#d8dee4', color: '#202122', bg: '#f8f9fa', padY: 40, padX: 24 } },
    { type: 'chat', label: '频道聊天室', ico: '◉', tone: 'violet', g: 'social',
      fields: ['chatServer', 'chatChannel', 'chatMembers', 'chatItems', 'cardBg', 'color', 'radius', 'bg', 'padY'],
      d: { chatServer: '创造者俱乐部', chatChannel: '设计交流', chatMembers: '🦊 | 小狐狸\n🐼 | 阿胖\n🦉 | 夜猫子', chatItems: '🦊 | 小狐狸 | 09:42 | 早，今天把首页的留白重做了一版，看起来舒服多了。 | #f472b6\n🐼 | 阿胖 | 09:45 | 能发张截图吗？我也在调这块。 | #38bdf8\n🦉 | 夜猫子 | 09:51 | 建议标题再收一点字距，整体会更高级。 | #a78bfa\n🦊 | 小狐狸 | 09:53 | 好，我试试，谢谢！ | #f472b6', cardBg: '#313338', color: '#f2f3f5', radius: 14, align: 'left', padY: 40, padX: 24, bg: '#1e1f22' } },
    { type: 'awards', label: '奖项作品墙', ico: '✧', tone: 'violet', g: 'social',
      fields: ['title', 'awardDesc', 'awardItems', 'cardBg', 'color', 'radius', 'gap', 'bg', 'padY'],
      d: { title: '值得反复看的网页', awardDesc: 'Awwwards 风格的作品陈列：大图、克制文字、悬停揭示。', awardItems: ' | 光的轨迹 | Studio Nova | SOTD\n | 声之博物馆 | Makemuse | HM\n | 城市漫游手册 | North Lab | DEV\n | 未来植物园 | Green Type | SOTM', cardBg: '#111318', color: '#ffffff', radius: 16, gap: 14, align: 'left', padY: 56, padX: 24, bg: '#0b0d12' } },
    { type: 'marquee', label: '跑马灯标题', ico: '⇄', tone: 'gold', g: 'social',
      fields: ['marqueeText', 'marqueeSpeed', 'marqueeDir', 'color', 'bg', 'padY'],
      d: { marqueeText: 'DESIGN · CODE · MOTION · SHIP', marqueeSpeed: 24, marqueeDir: 'left', color: '#16233a', bg: '#f5f8ff', padY: 22, padX: 0, radius: 0 } },

    /* ===== 视觉实验：品牌墙 / 未来排版 / 几何 / 动感 / 高清图 / 3D ===== */
    { type: 'brandwall', label: '品牌墙 Pro', ico: '▦', tone: 'gold', g: 'visual',
      fields: ['title', 'brandItems', 'brandStyle', 'brandCols', 'brandSpeed', 'cardBg', 'color', 'radius', 'gap', 'bg', 'padY'],
      d: { title: '与这些品牌一起成长', brandStyle: 'grid', brandCols: 5, brandSpeed: 28,
        brandItems: '▲ ALPHA | #about | 合作伙伴\n◐ LUMEN | #about | 年度合作\n✦ NORTH | #about | 设计伙伴\n● 像素工场 | #about | 内容伙伴\n⬡ ATLAS | #about | 技术伙伴\n✧ 青柠科技 | #about | 生态伙伴',
        cardBg: '#ffffff', color: '#36435c', radius: 14, gap: 12, align: 'center', padY: 46, padX: 24, bg: '#f6f8fc' } },
    { type: 'futype', label: '未来感排版', ico: 'F', tone: 'violet', g: 'visual',
      fields: ['futypeText', 'futypeSub', 'futypeStyle', 'futypeSize', 'color', 'bg', 'padY'],
      d: { futypeText: 'FUTURE\nIS NOW', futypeSub: 'FUTURISTIC TYPOGRAPHY · 2026', futypeStyle: 'neon', futypeSize: 96,
        color: '#e8f2ff', bg: '#080c18', align: 'left', padY: 76, padX: 32 } },
    { type: 'geometry', label: '几何形状', ico: '△', tone: '', g: 'visual',
      fields: ['title', 'shapeItems', 'shapeSize', 'shapeSpeed', 'shapeFill', 'color', 'bg', 'padY'],
      d: { title: '形状，是最简洁的语言', shapeSpeed: 12, shapeSize: 150, shapeFill: '#3b82f6',
        shapeItems: '圆 | #3b82f6\n六边形 | #8b5cf6\n三角 | #f59e0b\n方 | #22c55e\n环 | #ec4899\n水滴 | #06b6d4',
        color: '#16233a', bg: '#f8fafc', align: 'left', padY: 46, padX: 24 } },
    { type: 'kinetic', label: '动感动画', ico: '◎', tone: 'gold', g: 'visual',
      fields: ['kineticText', 'kineticStyle', 'kineticSpeed', 'color', 'bg', 'padY'],
      d: { kineticText: 'MOTION\nIN EVERY PIXEL', kineticStyle: 'orbit', kineticSpeed: 12,
        color: '#ffffff', bg: 'linear-gradient(135deg,#171a3a,#4c1d95 55%,#0f766e)', align: 'center', padY: 70, padX: 24 } },
    { type: 'hires', label: '高分辨率图片', ico: '▧', tone: '', g: 'visual',
      fields: ['hiSrc', 'hiAlt', 'hiRatio', 'hiHeight', 'hiFocusY', 'hiCaption', 'hiOverlay', 'radius', 'bg', 'padY'],
      d: { hiSrc: '', hiAlt: '高分辨率图片', hiRatio: 'wide', hiHeight: 520, hiFocusY: 50,
        hiCaption: '支持上传 2400px 以上的图片，宽幅 / 全景 / 方形 / 竖幅都能保持清晰。', hiOverlay: '0',
        radius: 16, align: 'center', padY: 36, padX: 24, bg: '' } },
    { type: 'object3d', label: '3D 元素', ico: '◇', tone: 'violet', g: 'visual',
      fields: ['objShape', 'objSize', 'objSpeed', 'objColor1', 'objColor2', 'objLabel', 'objTilt', 'color', 'bg', 'padY'],
      d: { objShape: 'cube', objSize: 220, objSpeed: 12, objColor1: '#3b82f6', objColor2: '#8b5cf6',
        objLabel: 'CSS 3D · 无需外部模型', objTilt: '1', color: '#dbe8ff', bg: 'radial-gradient(circle at 50% 35%,#1b2450,#070b1a 72%)',
        align: 'center', padY: 62, padX: 24 } },

    /* ===== 个性化：个人名片 / 技能 / 时间轴 / 社交链接 / 标签云 / 数据 / 照片墙 ===== */
    { type: 'profilecard', label: '个人名片', ico: '☺', tone: 'violet', g: 'personal',
      fields: ['cardName', 'cardRole', 'cardAvatar', 'cardBio', 'cardLinks', 'cardVerified', 'cardLayout', 'cardBg', 'color', 'radius', 'bg', 'padY'],
      d: { cardName: '林小满', cardRole: '产品设计师 · 独立创作者', cardAvatar: '',
        cardBio: '在设计与代码之间来回横跳，喜欢把复杂的东西做得简单一点。',
        cardLinks: '个人网站 | https://example.com\nGitHub | https://github.com\n微博 | https://weibo.com',
        cardVerified: '1', cardLayout: 'center', cardBg: '#ffffff', color: '#16233a',
        radius: 20, align: 'center', padY: 54, padX: 24, bg: 'linear-gradient(135deg,#eef2ff,#faf5ff)' } },
    { type: 'skillbar', label: '技能熟练度', ico: '▰', tone: '', g: 'personal',
      fields: ['skillTitle', 'skillItems', 'skillColor', 'skillTrack', 'skillAnimate', 'cardBg', 'color', 'radius', 'bg', 'padY'],
      d: { skillTitle: '我的技能', skillItems: '产品设计 | 95\n前端开发 | 86\n动效设计 | 78\n用户研究 | 70',
        skillColor: '#6d5efc', skillTrack: '#e8ecf5', skillAnimate: '1',
        cardBg: '#ffffff', color: '#16233a', radius: 18, align: 'left', padY: 46, padX: 24, bg: '#f8fafc' } },
    { type: 'journey', label: '经历时间轴', ico: '⌁', tone: 'gold', g: 'personal',
      fields: ['tlTitle', 'tlItems', 'tlLineColor', 'tlDotColor', 'cardBg', 'color', 'radius', 'bg', 'padY'],
      d: { tlTitle: '一路走来', tlItems: '2026 | 现在 · 独立创作 | 专注网页体验与动效设计，接一些有趣的项目。\n2023 | 高级设计师 | 负责设计系统与品牌升级，带 5 人小队。\n2020 | 产品设计师 | 从 0 到 1 做了几款被很多人用的产品。\n2017 | 设计入门 | 从一张白纸开始，从此没停下来。',
        tlLineColor: '#dfe6f5', tlDotColor: '#6d5efc', cardBg: '', color: '#16233a',
        radius: 0, align: 'left', padY: 48, padX: 24, bg: '#ffffff' } },
    { type: 'linkhub', label: '社交链接矩阵', ico: '⌘', tone: 'violet', g: 'personal',
      fields: ['linkTitle', 'linkBio', 'linkItems', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'cardBg', 'color', 'radius', 'bg', 'padY'],
      d: { linkTitle: '@xiaoman', linkBio: '设计师 / 创作者 / 咖啡爱好者 ☕',
        linkItems: '我的博客 | https://example.com/blog | 📝\nGitHub | https://github.com | 🐙\nInstagram | https://instagram.com | 📷\n联系我 | mailto:hello@example.com | ✉️',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 16, btnPadX: 20, btnPadY: 14, btnFontSize: 15, btnWeight: '700', btnShadow: 'soft',
        cardBg: '', color: '#ffffff', radius: 0, align: 'center', padY: 56, padX: 24,
        bg: 'linear-gradient(160deg,#5b4be0,#9d5cf6 60%,#ec4899)' } },
    { type: 'tagcloud', label: '兴趣标签云', ico: '#', tone: '', g: 'personal',
      fields: ['tagTitle', 'tagItems', 'tagStyle', 'tagSpread', 'color', 'bg', 'padY'],
      d: { tagTitle: '我感兴趣的事', tagItems: '设计 | 5 | #6d5efc\n前端 | 4 | #0ea5e9\n摄影 | 3 | #f59e0b\n旅行 | 3 | #22c55e\n咖啡 | 2 | #a16207\n音乐 | 2 | #ec4899\n写代码 | 4\n读书 | 2',
        tagStyle: 'pill', tagSpread: 'wrap', color: '#16233a', bg: '#f8fafc', align: 'left', padY: 46, padX: 24 } },
    { type: 'statboard', label: '个人数据看板', ico: '◫', tone: 'gold', g: 'personal',
      fields: ['statTitle', 'statItems', 'statCols', 'statAccent', 'statDivider', 'color', 'bg', 'padY'],
      d: { statTitle: '一些数字', statItems: '128 | k | 关注者\n56 | 个 | 完成项目\n9 | 年 | 设计经验\n24 | k | 获得点赞',
        statCols: 4, statAccent: '#6d5efc', statDivider: '1', color: '#5b6478', bg: '#ffffff', align: 'center', padY: 44, padX: 24 } },
    { type: 'polaroid', label: '拍立得照片墙', ico: '▧', tone: '', g: 'personal',
      fields: ['polarTitle', 'polarItems', 'polarCols', 'polarTilt', 'color', 'bg', 'padY'],
      d: { polarTitle: '生活碎片', polarItems: '| 一个阳光很好的下午 | -6\n| 出差路上的风景 | 5\n| 和朋友们在一起 | -3\n| 我的工作台 | 7',
        polarCols: 4, polarTilt: '1', color: '#16233a', bg: '#fdf6f0', align: 'center', padY: 48, padX: 24 } },

    /* ===== 网页外观：颜色切换 / 深色模式 / 字号调节 / 主题切换器 ===== */
    { type: 'colorswitch', label: '颜色切换按钮', ico: '◉', tone: 'violet', g: 'appearance',
      fields: ['swLabel', 'swColors', 'swShape', 'swSize', 'swShowName', 'swAlign', 'cardBg', 'color', 'radius', 'bg', 'padY'],
      d: { swLabel: '换个心情 · 主题色', swColors: '#3b82f6 | 海洋蓝\n#8b5cf6 | 星云紫\n#ec4899 | 樱花粉\n#f59e0b | 暖阳橙\n#10b981 | 薄荷绿',
        swShape: 'round', swSize: 34, swShowName: '1', swAlign: 'center',
        cardBg: '#ffffff', color: '#16233a', radius: 18, align: 'center', padY: 26, padX: 24, bg: '#f7f9fc' } },
    { type: 'darkmode', label: '深色模式开关', ico: '☾', tone: '', g: 'appearance',
      fields: ['dmLabelOn', 'dmLabelOff', 'dmStyle', 'dmDarkBg', 'dmDarkText', 'dmDarkCard', 'align', 'bg', 'padY'],
      d: { dmLabelOn: '☀️ 浅色', dmLabelOff: '🌙 深色', dmStyle: 'toggle',
        dmDarkBg: '#0f172a', dmDarkText: '#e8eef9', dmDarkCard: '#1e293b',
        align: 'center', padY: 34, padX: 24, bg: '#f7f9fc' } },
    { type: 'fontsizer', label: '字号调节', ico: 'A', tone: 'gold', g: 'appearance',
      fields: ['fsLabel', 'fsMin', 'fsMax', 'fsStep', 'fsShowValue', 'cardBg', 'color', 'radius', 'align', 'bg', 'padY'],
      d: { fsLabel: '字体大小', fsMin: 80, fsMax: 130, fsStep: 10, fsShowValue: '1',
        cardBg: '#ffffff', color: '#16233a', radius: 14, align: 'center', padY: 26, padX: 24, bg: '#f7f9fc' } },
    { type: 'themepicker', label: '主题切换器', ico: '◐', tone: 'violet', g: 'appearance',
      fields: ['tpLabel', 'tpThemes', 'tpStyle', 'cardBg', 'color', 'radius', 'align', 'bg', 'padY'],
      d: { tpLabel: '选择主题', tpThemes: '明亮蓝 | #3b82f6 | #ffffff | #16233a\n暗夜紫 | #8b5cf6 | #12101f | #eae6ff\n森林绿 | #10b981 | #f0fdf6 | #10382b\n暖橙 | #f97316 | #fff8f0 | #4a2c0f',
        tpStyle: 'chip', cardBg: '#ffffff', color: '#16233a', radius: 16, align: 'center', padY: 30, padX: 24, bg: '#f7f9fc' } },

    /* ===== 自定义 ===== */
    { type: 'html', label: '自定义 HTML', ico: '<>', tone: 'violet', g: 'custom',
      fields: ['htmlCode', 'color', 'bg', 'radius', 'padY', 'padX'],
      d: {
        htmlCode: '<div style="text-align:center;padding:8px 0">\n' +
          '  <h3 style="margin:0 0 8px;font-size:22px">自定义 HTML</h3>\n' +
          '  <p style="margin:0;font-size:14px;opacity:.72">把任意 HTML 粘到这里，内联样式会直接生效。</p>\n' +
          '</div>',
        color: '#16233a', bg: '', radius: 0, padY: 28, padX: 24
      } },

    /* ===== 新组件：设备样机 / 转动品牌墙 / 视频 / 轮播 / 选项卡 / 倒计时 / 对比 / 音频 ===== */
    { type: 'device', label: '设备样机（图/视频）', ico: '▣', tone: 'violet', g: 'show',
      fields: ['devKind', 'devMode', 'devScreen', 'devVideo', 'devPoster', 'devVideoMode', 'devFrame', 'devTilt', 'devGlow', 'radius', 'padY'],
      d: { devKind: 'laptop', devMode: 'image', devScreen: '', devVideo: 'builtin:ui', devPoster: '', devVideoMode: 'auto',
        devFrame: '#1d2740', devTilt: '0', devGlow: '1', radius: 18, align: 'center', padY: 48, padX: 28, bg: 'linear-gradient(160deg,#eef3ff,#faf6ff)' } },
    { type: 'brandrotor', label: '转动品牌墙', ico: '◎', tone: 'gold', g: 'visual',
      fields: ['title', 'rotItems', 'rotShape', 'rotSpeed', 'rotRadius', 'rotCardBg', 'rotPause', 'color', 'bg', 'padY'],
      d: { title: '与这些品牌一起成长', rotShape: 'ring', rotSpeed: 30, rotRadius: 260,
        rotItems: '▲ ALPHA\n◐ LUMEN\n✦ NORTH\n● 像素工场\n⬡ ATLAS\n✧ 青柠科技\n❖ ORBIT\n◈ 星野',
        rotCardBg: '#ffffff', rotPause: '1', color: '#36435c', align: 'center', padY: 30, padX: 24,
        bg: 'radial-gradient(circle at 50% 45%,#1b2a55,#0b1226 72%)' } },
    { type: 'videoplayer', label: '视频直接播放', ico: '▶', tone: 'gold', g: 'show',
      fields: ['playSrc', 'playPoster', 'playMode', 'playRatio', 'playFit', 'playW', 'playCaption', 'radius', 'bg', 'padY'],
      d: { playSrc: 'builtin:aurora', playPoster: '', playMode: 'control', playRatio: '16 / 9', playFit: 'cover',
        playW: 100, playCaption: '', radius: 16, align: 'center', padY: 32, padX: 24, bg: '#0b1120' } },
    { type: 'carousel', label: '图片轮播', ico: '▤', tone: 'violet', g: 'show',
      fields: ['slideItems', 'slideH', 'slideAuto', 'slideDur', 'slideNav', 'slideFit', 'slideCapBg', 'radius', 'padY'],
      d: { slideItems: ' | 春日新品，如约而至 | #works\n | 让每一个想法都被看见 | #about\n | 现在开始，为时未晚 | #contact',
        slideH: 380, slideAuto: '1', slideDur: 4, slideNav: '1', slideFit: 'cover', slideCapBg: '',
        radius: 16, align: 'center', padY: 32, padX: 24, bg: '#0b1120' } },
    { type: 'tabs', label: '选项卡', ico: '▤', tone: '', g: 'show',
      fields: ['tabItems', 'tabStyle', 'tabAlign', 'tabCardBg', 'tabActive', 'radius', 'padY'],
      d: { tabItems: '产品介绍 | 一个专注把想法快速落地的小团队，让建站像搭积木一样简单。\n服务流程 | 沟通需求 → 设计方案 → 快速搭建 → 一键上线，全程透明。\n常见问题 | 不需要安装任何软件，浏览器打开就能用，导出的是独立 HTML 文件。',
        tabStyle: 'pill', tabAlign: 'left', tabCardBg: '#f6f9ff', tabActive: '#3b82f6',
        radius: 14, align: 'left', padY: 40, padX: 24, bg: '' } },
    { type: 'countdown', label: '倒计时', ico: '◷', tone: 'gold', g: 'convert',
      fields: ['cdTo', 'cdTitle', 'cdEnd', 'cdStyle', 'cdAccent', 'cdBoxBg', 'cdShowSec', 'bg', 'padY'],
      d: { cdTo: '2027-01-01 00:00:00', cdTitle: '距离新年还有', cdEnd: '时间到！', cdStyle: 'box',
        cdAccent: '#ffffff', cdBoxBg: 'rgba(255,255,255,.1)', cdShowSec: '1',
        align: 'center', padY: 56, padX: 24, bg: 'linear-gradient(135deg,#1e3a8a,#6d28d9)' } },
    { type: 'compare', label: '图片对比', ico: '◧', tone: '', g: 'show',
      fields: ['cmpBefore', 'cmpAfter', 'cmpBeforeLabel', 'cmpAfterLabel', 'cmpH', 'cmpStart', 'radius', 'padY'],
      d: { cmpBefore: '', cmpAfter: '', cmpBeforeLabel: '改前', cmpAfterLabel: '改后',
        cmpH: 420, cmpStart: 50, radius: 16, align: 'center', padY: 32, padX: 24, bg: '' } },
    { type: 'audioplayer', label: '音频播放器', ico: '♫', tone: '', g: 'show',
      fields: ['auSrc', 'auTitle', 'auArtist', 'auCover', 'auAuto', 'auCardBg', 'radius', 'padY'],
      d: { auSrc: '', auTitle: '示例曲目', auArtist: '未知艺术家', auCover: '', auAuto: '0',
        auCardBg: '#f6f9ff', radius: 16, align: 'left', padY: 32, padX: 24, bg: '' } },

    /* ===== 常用组件第二批 ===== */
    { type: 'steps', label: '步骤流程', ico: '①', tone: 'violet', g: 'show',
      fields: ['title', 'stepsItems', 'stepsLayout', 'stepsShape', 'stepsLine', 'stepsAccent', 'stepsCardBg', 'radius', 'padY'],
      d: { title: '只需三步，轻松上线', stepsItems: '选择模板 | 挑一个喜欢的版式，一键套用\n拖拽编辑 | 改文字、换图片，所见即所得\n一键发布 | 导出 HTML，或分享给全世界',
        stepsLayout: 'row', stepsShape: 'num', stepsLine: '1', stepsAccent: '#3b82f6', stepsCardBg: '#f5f8ff',
        radius: 16, align: 'center', padY: 48, padX: 28, bg: '' } },
    { type: 'posts', label: '文章列表', ico: '▤', tone: '', g: 'show',
      fields: ['title', 'postItems', 'postCols', 'postCardBg', 'postImgH', 'radius', 'padY'],
      d: { title: '最新文章', postItems: ' | 从零开始搭建你的第一个网站 | 2026-11-18 | 手把手带你了解拖拽建站的每一步。 | #\n | 设计好看页面的 7 个小技巧 | 2026-11-12 | 从配色到留白，让页面质感翻倍。 | #\n | 如何让你的网站被更多人看到 | 2026-11-05 | 分享几个简单有效的推广方法。 | #',
        postCols: '3', postCardBg: '#ffffff', postImgH: 160,
        radius: 14, align: 'left', padY: 44, padX: 24, bg: '#f6f9fc' } },
    { type: 'newsletter', label: '邮件订阅', ico: '✉', tone: 'gold', g: 'convert',
      fields: ['subTitle', 'subDesc', 'subPlaceholder', 'subBtn', 'subAction', 'subCardBg', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'btnFull', 'inputBg', 'inputColor', 'inputPhColor', 'inputBorderColor', 'inputBorderWidth', 'inputRadius', 'inputPadX', 'inputPadY', 'radius', 'padY'],
      d: { subTitle: '订阅我们的 newsletter', subDesc: '每周一封，分享设计、开发与灵感，不定时退订。',
        subPlaceholder: '输入你的邮箱地址', subBtn: '立即订阅', subAction: '',
        subCardBg: '#ffffff', btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 10, btnPadX: 22, btnPadY: 13, btnFontSize: 14, btnWeight: '700', btnShadow: 'none', btnFull: '0',
        inputBg: '', inputColor: '', inputPhColor: '', inputBorderColor: '', inputBorderWidth: 1, inputRadius: 10, inputPadX: 16, inputPadY: 13,
        radius: 18, align: 'center', padY: 52, padX: 28,
        bg: 'linear-gradient(135deg,#eef3ff,#faf5ff)' } },
    { type: 'product', label: '商品卡片', ico: '◇', tone: 'gold', g: 'convert',
      fields: ['prodImage', 'prodName', 'prodDesc', 'prodPrice', 'prodOldPrice', 'prodBadge', 'prodBtn', 'prodHref', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'btnFull', 'prodCardBg', 'radius', 'padY'],
      d: { prodImage: '', prodName: '精选好物 · 标准版', prodDesc: '品质与设计兼备，适合日常使用与送礼。',
        prodPrice: '¥299', prodOldPrice: '¥399', prodBadge: '热销', prodBtn: '立即购买', prodHref: '#',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 10, btnPadX: 13, btnPadY: 13, btnFontSize: 15, btnWeight: '700', btnShadow: 'none', btnFull: '1',
        prodCardBg: '#ffffff', radius: 18, align: 'center', padY: 40, padX: 24, bg: '#f6f9fc' } },
    { type: 'coupon', label: '优惠券', ico: '★', tone: 'gold', g: 'convert',
      fields: ['cpAmount', 'cpCondition', 'cpTitle', 'cpCode', 'cpBtn', 'cpHref', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'cpBg', 'cpAccent', 'radius', 'padY'],
      d: { cpAmount: '¥50', cpCondition: '满 299 元可用', cpTitle: '新人专享券', cpCode: 'NEW50', cpBtn: '立即领取', cpHref: '#',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 60, btnPadX: 20, btnPadY: 11, btnFontSize: 14, btnWeight: '700', btnShadow: 'none',
        cpBg: '#fff6f2', cpAccent: '#f0623c', radius: 16, align: 'center', padY: 32, padX: 24, bg: '' } },
    { type: 'download', label: '下载卡片', ico: '↓', tone: '', g: 'convert',
      fields: ['dlIcon', 'dlName', 'dlMeta', 'dlBtn', 'dlHref', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'dlCardBg', 'radius', 'padY'],
      d: { dlIcon: '📦', dlName: '产品使用手册.pdf', dlMeta: 'PDF 文档 · 2.4 MB', dlBtn: '下载文件', dlHref: '#',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 9, btnPadX: 18, btnPadY: 10, btnFontSize: 14, btnWeight: '600', btnShadow: 'none',
        dlCardBg: '#ffffff', radius: 14, align: 'left', padY: 28, padX: 24, bg: '#f6f9fc' } },
    { type: 'share', label: '社交分享', ico: '↗', tone: '', g: 'social',
      fields: ['shareTitle', 'sharePlatforms', 'shareStyle', 'shareAccent', 'align', 'padY'],
      d: { shareTitle: '觉得有用？分享给朋友', sharePlatforms: '微信,微博,QQ,复制链接', shareStyle: 'icon', shareAccent: '#3b82f6',
        align: 'center', padY: 32, padX: 24, bg: '' } },
    { type: 'mapcard', label: '地址 / 门店卡', ico: '⌖', tone: '', g: 'show',
      fields: ['mapTitle', 'mapAddress', 'mapPhone', 'mapHours', 'mapLink', 'mapBtn', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'mapCardBg', 'radius', 'padY'],
      d: { mapTitle: 'WR Studio 体验店', mapAddress: '上海市静安区某某路 88 号', mapPhone: '400-000-0000',
        mapHours: '周一至周日 10:00 - 20:00', mapLink: '', mapBtn: '查看地图',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 10, btnPadX: 20, btnPadY: 11, btnFontSize: 14, btnWeight: '600', btnShadow: 'none',
        mapCardBg: '#ffffff', radius: 16, align: 'left', padY: 32, padX: 24, bg: '#f6f9fc' } },
    { type: 'event', label: '活动 / 日程卡', ico: '▣', tone: 'violet', g: 'convert',
      fields: ['evtDate', 'evtTime', 'evtTitle', 'evtDesc', 'evtLocation', 'evtBtn', 'evtHref', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'evtAccent', 'radius', 'padY'],
      d: { evtDate: '11月28日', evtTime: '14:00 - 17:00', evtTitle: '2026 产品设计分享会',
        evtDesc: '和行业大咖一起，聊聊产品设计那些事儿。', evtLocation: '上海 · 静安', evtBtn: '立即报名', evtHref: '#',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 10, btnPadX: 22, btnPadY: 11, btnFontSize: 14, btnWeight: '700', btnShadow: 'none',
        evtAccent: '#3b82f6', radius: 18, align: 'left', padY: 36, padX: 24, bg: '#f6f9fc' } },
    { type: 'jobs', label: '职位列表', ico: '⌗', tone: '', g: 'convert',
      fields: ['jobTitle', 'jobItems', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'jobCardBg', 'jobAccent', 'radius', 'padY'],
      d: { jobTitle: '加入我们', jobItems: '高级前端工程师 | 上海 | 25-40K | #\n产品设计师 | 上海 / 远程 | 18-30K | #\n内容运营 | 上海 | 12-20K | #',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 8, btnPadX: 16, btnPadY: 8, btnFontSize: 13, btnWeight: '600', btnShadow: 'none',
        jobCardBg: '#ffffff', jobAccent: '#3b82f6', radius: 14, align: 'left', padY: 44, padX: 24, bg: '#f6f9fc' } },
    { type: 'iconnav', label: '图标导航宫格', ico: '⊞', tone: 'violet', g: 'nav',
      fields: ['title', 'navItems2', 'navCols', 'navItemBg', 'radius', 'padY'],
      d: { title: '快捷入口', navItems2: '📄 | 文档中心 | #\n🎨 | 设计资源 | #\n💬 | 社区论坛 | #\n🎥 | 视频教程 | #\n🛠️ | 工具箱 | #\n❓ | 帮助中心 | #',
        navCols: '4', navItemBg: '#ffffff', radius: 14, align: 'center', padY: 40, padX: 24, bg: '' } },
    { type: 'article', label: '文章正文', ico: '¶', tone: '', g: 'show',
      fields: ['artTitle', 'artMeta', 'artBody', 'artCover', 'artWidth', 'artCardBg', 'radius', 'padY'],
      d: { artTitle: '一篇文章的标题', artMeta: '作者 · 2026-11-19 · 5 分钟阅读',
        artBody: '这里是正文开头。以「## 」开头可写二级标题，以「> 」开头可写引用段落。\n\n## 为什么要做这件事\n把想法写下来，是梳理思路最好的方式之一。这一段可以放你的正文内容，支持任意换行分段。\n\n> 好的内容，值得被认真阅读。\n\n继续写下去，把你的观点讲清楚、讲透彻。',
        artCover: '', artWidth: 760, artCardBg: '#ffffff', radius: 16, align: 'left', padY: 48, padX: 24, bg: '#f6f9fc' } },

    /* ===== 拓展组件：二级导航 / 多功能导航 / 下拉栏 / 多选框 ===== */
    { type: 'subnav', label: '二级导航栏', ico: '▤', tone: 'gold', g: 'nav',
      fields: ['title', 'emoji', 'navItems', 'subItems', 'btnText', 'navCtaHref', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'navLinkColor', 'navLinkHover', 'navLinkSize', 'navLinkGap', 'navBrandSize', 'sticky', 'stickyTop', 'navHeight', 'align', 'color', 'bg', 'padX'],
      d: { title: 'WR Studio', emoji: '✦', navItems: '产品 | #products\n解决方案 | #solutions\n关于我们 | #about',
        subItems: '产品 | 网页搭建>#products\n网站模板>#templates\n帮助中心>#help\n解决方案 | 企业官网>#enterprise\n电商商城>#shop\n关于我们 | 团队介绍>#team\n联系我们>#contact',
        btnText: '开始使用', navCtaHref: '#contact',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 9, btnPadX: 18, btnPadY: 9, btnFontSize: 14, btnWeight: '600', btnShadow: 'none',
        navLinkColor: '', navLinkHover: '', navLinkSize: 14, navLinkGap: 6, navBrandSize: 17,
        sticky: '1', stickyTop: 0, navHeight: 64,
        align: 'right', color: '#16233a', bg: '#ffffff', padY: 0, padX: 24 } },
    { type: 'smartnav', label: '多功能导航栏', ico: '✦', tone: 'violet', g: 'nav',
      fields: ['title', 'emoji', 'navItems', 'btnText', 'navCtaHref', 'themeBtnText', 'searchPlaceholder', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'navLinkColor', 'navLinkHover', 'navLinkSize', 'navLinkGap', 'navBrandSize', 'sticky', 'stickyTop', 'navHeight', 'align', 'color', 'bg', 'padX'],
      d: { title: 'WR Studio', emoji: '✦', navItems: '首页 | #top\n功能 | #features\n案例 | #works\n博客 | #blog',
        btnText: '立即开始', navCtaHref: '#contact', themeBtnText: '切换主题',
        searchPlaceholder: '搜索…',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 9, btnPadX: 18, btnPadY: 9, btnFontSize: 14, btnWeight: '600', btnShadow: 'none',
        navLinkColor: '', navLinkHover: '', navLinkSize: 14, navLinkGap: 16, navBrandSize: 17,
        sticky: '1', stickyTop: 0, navHeight: 68,
        align: 'right', color: '#16233a', bg: '#ffffff', padY: 0, padX: 24 } },
    { type: 'dropdownbar', label: '下拉栏', ico: '⌄', tone: '', g: 'show',
      fields: ['title', 'dropItems', 'openFirst', 'cardBg', 'color', 'radius', 'gap', 'align', 'padY', 'bg'],
      d: { title: '常见问题', dropItems: '如何开始？ | 选中模板或直接拖入组件，右侧改文字即可。\n能导出源码吗？ | 可以，点顶部「导出 HTML」得到独立页面。\n数据存在哪里？ | 登录后会保存到服务器数据库。',
        openFirst: '0', cardBg: '#f6f9fc', color: '#16233a', radius: 12, gap: 10, align: 'left', padY: 36, padX: 24, bg: '' } },
    { type: 'checkboxset', label: '多选框', ico: '☑', tone: '', g: 'convert',
      fields: ['title', 'desc', 'checkItems', 'chkBtn', 'chkResult', 'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'cardBg', 'color', 'radius', 'align', 'padY', 'bg'],
      d: { title: '你感兴趣的方向', desc: '可多选，选好后点按钮查看结果。',
        checkItems: '网页设计 | design | 1\n品牌视觉 | brand\n数字营销 | marketing\n企业服务 | business',
        chkBtn: '查看选择', chkResult: '已选择：',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 9, btnPadX: 22, btnPadY: 10, btnFontSize: 14, btnWeight: '600', btnShadow: 'none',
        cardBg: '#f6f9fc', color: '#16233a',
        radius: 14, align: 'left', padY: 36, padX: 24, bg: '' } }
  ]);

  /* ---------- 单条组件 ----------
     从列表型组件里拆出来的「一条」：内容只有一条，样式字段和列表里的那一张卡完全一样。
     想排成三栏就并排放三个，想只让其中一个变样就单独改它，互不影响。 */
  var SINGLE_CARD_FIELDS = ['cardBg', 'color', 'radius', 'cardPadX', 'cardPadY', 'cardTitleSize', 'cardTextSize', 'cardIconSize', 'align', 'padY', 'padX', 'bg'];
  function sCard(extra) { return extra.concat(SINGLE_CARD_FIELDS); }
  var SINGLES = [
    { type: 'feat1', label: '单条特性', ico: '◫', tone: 'violet', g: 'singles',
      fields: sCard(['emoji', 'title', 'desc']),
      d: { emoji: '⚡', title: '快速上手', desc: '拖一拖就能搭出页面，改完立刻看到效果。',
        cardBg: '#f5f8ff', color: '#16233a', radius: 14, cardPadX: 20, cardPadY: 26,
        cardTitleSize: 17, cardTextSize: 13, cardIconSize: 42, align: 'left', padY: 20, padX: 24, bg: '' } },
    { type: 'member1', label: '单个成员', ico: '☺', tone: '', g: 'singles',
      fields: sCard(['emoji', 'title', 'role', 'desc']),
      d: { emoji: '👩‍💻', title: '林晓', role: '前端工程师', desc: '负责交互与可视化编辑器。',
        cardBg: '#f5f8ff', color: '#16233a', radius: 16, cardPadX: 18, cardPadY: 26,
        cardTitleSize: 16, cardTextSize: 13, cardIconSize: 62, align: 'center', padY: 20, padX: 24, bg: '' } },
    { type: 'plan1', label: '单条价格卡', ico: '▤', tone: 'gold', g: 'singles',
      fields: sCard(['title', 'prodPrice', 'desc', 'btnText', 'href', 'hot',
        'btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnFontSize']),
      d: { title: '专业版', prodPrice: '¥299', desc: '适合个人与小团队\n无限页面\n全部组件\n导出 HTML', btnText: '立即开始', href: '#', hot: '1',
        btnStyle: 'auto', btnBg: '', btnColor: '', btnRadius: 9, btnFontSize: 14,
        cardBg: '#ffffff', color: '#16233a', radius: 16, cardPadX: 22, cardPadY: 28,
        cardTitleSize: 17, cardTextSize: 13, cardIconSize: 42, align: 'left', padY: 20, padX: 24, bg: '' } },
    { type: 'milestone1', label: '单个时间节点', ico: '◷', tone: '', g: 'singles',
      fields: sCard(['dateText', 'title', 'desc', 'tlDotColor', 'tlLineColor']),
      d: { dateText: '2026 年 3 月', title: '项目启动', desc: '完成需求梳理与技术选型，第一版原型上线。',
        tlDotColor: '#3b82f6', tlLineColor: '#dbe6f6',
        cardBg: '', color: '#16233a', radius: 0, cardPadX: 0, cardPadY: 0,
        cardTitleSize: 16, cardTextSize: 13, cardIconSize: 42, align: 'left', padY: 16, padX: 24, bg: '' } },
    { type: 'qa1', label: '单条问答', ico: '？', tone: '', g: 'singles',
      fields: sCard(['title', 'desc', 'openFirst']),
      d: { title: '怎样快速做出一个网站？', desc: '选一个模板，把文字换掉，点导出就完成了。', openFirst: '1',
        cardBg: '#f5f8ff', color: '#16233a', radius: 12, cardPadX: 18, cardPadY: 16,
        cardTitleSize: 15, cardTextSize: 13, cardIconSize: 42, align: 'left', padY: 12, padX: 24, bg: '' } },
    { type: 'prog1', label: '单条进度', ico: '▰', tone: '', g: 'singles',
      fields: ['title', 'percent', 'barColor', 'color', 'cardPadX', 'cardPadY', 'padY', 'padX', 'bg'],
      d: { title: '项目完成度', percent: 68, barColor: '#3b82f6', color: '#16233a',
        cardPadX: 0, cardPadY: 0, padY: 10, padX: 24, bg: '' } },
    { type: 'rank1', label: '单条榜单', ico: '＃', tone: 'gold', g: 'singles',
      fields: sCard(['title', 'desc', 'role']),
      d: { title: '关键词', desc: '128.6 万', role: '1',
        cardBg: '#f6f9fc', color: '#16233a', radius: 12, cardPadX: 14, cardPadY: 11,
        cardTitleSize: 15, cardTextSize: 13, cardIconSize: 42, align: 'left', padY: 6, padX: 24, bg: '' } },
    { type: 'post1', label: '单篇文章卡', ico: '▭', tone: '', g: 'singles',
      fields: sCard(['src', 'title', 'dateText', 'desc', 'href']),
      d: { src: '', title: '文章标题', dateText: '2026-03-18', desc: '用一两句话概述这篇内容。', href: '#',
        cardBg: '#ffffff', color: '#16233a', radius: 14, cardPadX: 0, cardPadY: 0,
        cardTitleSize: 17, cardTextSize: 13, cardIconSize: 42, align: 'left', padY: 20, padX: 24, bg: '' } },
    { type: 'job1', label: '单个职位', ico: '▱', tone: '', g: 'singles',
      fields: sCard(['title', 'role', 'prodPrice', 'href', 'jobAccent']),
      d: { title: '前端工程师', role: '上海 · 全职', prodPrice: '25–40K', href: '#', jobAccent: '#3b82f6',
        cardBg: '#ffffff', color: '#16233a', radius: 12, cardPadX: 16, cardPadY: 14,
        cardTitleSize: 15, cardTextSize: 13, cardIconSize: 42, align: 'left', padY: 8, padX: 24, bg: '' } },
    { type: 'shot1', label: '单张图片', ico: '▧', tone: '', g: 'singles',
      fields: ['src', 'caption', 'width', 'radius', 'align', 'padY', 'bg'],
      d: { src: '', caption: '', width: 100, radius: 12, align: 'center', padY: 16, padX: 24, bg: '' } }
  ];
  ASSETS = ASSETS.concat(SINGLES);
  var ASSET_MAP = {};
  ASSETS.forEach(function (a) { ASSET_MAP[a.type] = a; });
  var FIELD_MAP = {};
  Object.keys(F).forEach(function (k) { FIELD_MAP[k] = F[k]; });

  function isContainer(b) { return !!b && !!(ASSET_MAP[b.type] && ASSET_MAP[b.type].nest); }
  function isNavType(t) { return t === 'navbar' || t === 'subnav' || t === 'smartnav'; }
  function makeBlock(type, p) {
    var def = ASSET_MAP[type];
    if (!def) return null;
    // 预设组件复用真实组件的定义与类型，只换一组默认参数（如「一行多列容器」）
    var realType = def.preset ? def.preset.realType : type;
    var realDef = ASSET_MAP[realType] || def;
    var base = Object.assign({}, realDef.d, def.preset ? def.preset.p : {}, p || {});
    rowsNormalize(realType, base);
    var b = { id: uid(), type: realType, p: base };
    if (realDef.nest) b.children = [];
    return b;
  }
  /* 导入专用：组件自带的默认留白（图片 18/24、文字 18/24…）是给「手动添加组件」用的。
     导入时必须从 0 起算，原页面的留白由「外层 section → 包装层 → 模块」这条链一路累加，
     否则会多出一圈默认留白（图片那块尤其明显：左右各多 24px）。 */
  function makeImp(type, p) {
    var o = p || {};
    if (o.padX == null) o.padX = 0;
    if (o.padY == null) o.padY = 0;
    return makeBlock(type, o);
  }
  /* 兼容旧项目：补默认值、过滤掉未知组件 / 非法节点（导入 JSON 时避免整页报错） */
  function normalizeBlocks(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    (list || []).forEach(function (b) {
      if (!b || typeof b !== 'object' || !b.type || !ASSET_MAP[b.type]) return;
      if (typeof b.id !== 'string' || !b.id) b.id = uid();
      if (!b.p || typeof b.p !== 'object' || Array.isArray(b.p)) b.p = {};
      // 老项目兼容：按钮组 / 社交链接以前把圆角写在模块的 radius 上，迁移到按钮自己的 btnRadius
      if (b.type === 'buttongroup' && b.p.btnRadius === undefined && b.p.radius != null) b.p.btnRadius = b.p.radius;
      if (b.type === 'button' && b.p.btnRadius === undefined && b.p.radius != null) b.p.btnRadius = b.p.radius;
      if (b.type === 'linkhub' && b.p.btnRadius === undefined) b.p.btnRadius = String(b.p.linkShape) === 'round' ? 12 : 16;
      var def = ASSET_MAP[b.type].d || {};
      Object.keys(def).forEach(function (k) { if (b.p[k] === undefined) b.p[k] = def[k]; });
      Object.keys(COMMON_DEFAULTS).forEach(function (k) { if (b.p[k] === undefined) b.p[k] = COMMON_DEFAULTS[k]; });
      rowsNormalize(b.type, b.p);
      rowsStyleSanitize(b.p);
      if (isContainer(b)) b.children = normalizeBlocks(b.children);
      else delete b.children;
      out.push(b);
    });
    list.length = 0;
    Array.prototype.push.apply(list, out);
    return list;
  }
  function countBlocks(list) {
    return (list || []).reduce(function (n, b) {
      return n + 1 + (isContainer(b) ? countBlocks(b.children) : 0);
    }, 0);
  }

  /* ---------- 默认状态与示例 ---------- */
  var SAMPLE_BADGE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="22" fill="#2a5bd7"/><text x="48" y="63" text-anchor="middle" font-family="Arial,sans-serif" font-size="46" font-weight="bold" fill="#fff">W</text></svg>'
  );
  function sampleBlocks() {
    // 示例：一个横向容器里并排放 3 个模块，展示「一行多个」
    var row = makeBlock('container', { layout: 'row', cols: 3, gap: 16, bg: '#f5f8ff', padY: 28, padX: 24, title: '' });
    row.children = [
      makeBlock('card', { emoji: '🎮', title: '游戏运营', desc: '活动、社群与内容，把玩家聚起来。', cardBg: '#ffffff' }),
      makeBlock('card', { emoji: '⌘', title: '编程开发', desc: '网站、工具与自动化，把想法做出来。', cardBg: '#ffffff' }),
      makeBlock('card', { emoji: SAMPLE_BADGE, title: '设计创意', desc: '图标位置也可以放图片，这一张就是示例图片。', cardBg: '#ffffff' })
    ];
    var list = [
      makeBlock('navbar', { emoji: SAMPLE_BADGE }),
      makeBlock('announce', {}),
      makeBlock('hero', { href: '#features' }),
      makeBlock('heading', { text: '我们擅长什么' }),
      makeBlock('grid', {}),
      row,
      makeBlock('features', {}),
      makeBlock('heading', { text: '模板演示', fontSize: 30, padY: 30 }),
      makeBlock('film', { filmSrc: 'builtin:grid', filmH: 400, radius: 18 }),
      makeBlock('faq', {}),
      makeBlock('cta', {}),
      makeBlock('footer', {})
    ];
    // 示例页默认带一层克制的滚动进场，打开预览就能看到效果；不需要可在「页面设置」一键清除
    list.forEach(function (b, i) {
      if (b.type === 'navbar') return;
      b.p.animIn = 'up';
      b.p.animDelay = Math.min(560, i * 60);
      b.p.animDist = 24;
    });
    row.p.animStagger = 90;
    return list;
  }
  function defaultState() {
    return {
      name: '未命名页面',
      page: {
        bg: '#ffffff', text: '#16233a', accent: '#3b82f6', maxWidth: 960, font: 'system', description: '',
        // 标签页图标：auto=按站点名生成，custom=自有图片，none=不显示
        favicon: '', faviconMode: 'auto', faviconFit: 'contain', faviconBg: '',
        fxLevel: '2', cursorGlow: '0', cursorStyle: 'none', magnet: '1',
        scrollBar: '1', backTop: '1', reduceMotion: '1',
        spotlight: '0', parallax: '0', ripple: '0', scrollShadow: '0', countUp: '0', trail: '0', pageVeil: '0',
        introStyle: 'splash', introFilm: '', introPoster: '', introDrive: 'scroll', introTitle: '', introSub: '', introBg: '', introDur: 2000, introFreq: 'session',
        hintStyle: 'mouse', hintText: '滑动鼠标', hintColor: ''
      },
      blocks: sampleBlocks(),
      assets: [],
      components: []
    };
  }
  /* 导入 / 恢复本地项目时统一白名单化：类型、长度、字段逐个校验，
     非法组件会被过滤掉，避免一个坏节点让整个编辑器白屏。 */
  function sanitizeProject(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s) || !Array.isArray(s.blocks)) return null;
    var d = defaultState();
    var name = (typeof s.name === 'string' && s.name.trim()) ? s.name.slice(0, 120) : d.name;
    var page = Object.assign({}, d.page);
    if (s.page && typeof s.page === 'object' && !Array.isArray(s.page)) {
      ['bg', 'text', 'accent', 'font', 'description'].forEach(function (k) {
        if (typeof s.page[k] === 'string') page[k] = s.page[k].slice(0, 300);
      });
      ['introTitle', 'introSub', 'hintText', 'introBg', 'hintColor'].forEach(function (k) {
        if (typeof s.page[k] === 'string') page[k] = s.page[k].slice(0, k === 'introBg' || k === 'hintColor' ? 300 : 120);
      });
      // 开场片可能是整段上传的 data URI：上限放宽，且只放行 video 来源
      if (typeof s.page.introFilm === 'string') page.introFilm = safeVideo(s.page.introFilm.slice(0, 7 * 1024 * 1024));
      // 开场片封面：片子首帧常是黑的，海报图是唯一能「一进来就看到东西」的东西
      if (typeof s.page.introPoster === 'string' && s.page.introPoster.length < 700000) {
        page.introPoster = safeImg(s.page.introPoster.trim().slice(0, 700000));
      }
      // 标签页图标：可能是上传后的 data URI，也可能是外链
      if (typeof s.page.favicon === 'string' && s.page.favicon.length < 700000) {
        page.favicon = safeImg(s.page.favicon.trim().slice(0, 700000));
      }
      [['faviconMode', ['auto', 'custom', 'none']], ['faviconFit', ['contain', 'cover']]].forEach(function (t) {
        var fv = String(s.page[t[0]] == null ? '' : s.page[t[0]]);
        if (t[1].indexOf(fv) >= 0) page[t[0]] = fv;
      });
      if (typeof s.page.faviconBg === 'string') page.faviconBg = s.page.faviconBg.slice(0, 60);
      if (s.page.introDur != null) {
        var idur = Number(s.page.introDur);
        page.introDur = isFinite(idur) && idur > 0 ? Math.max(600, Math.min(5000, Math.round(idur))) : d.page.introDur;
      }
      if (s.page.maxWidth != null) {
        var mw = Number(s.page.maxWidth);
        page.maxWidth = isFinite(mw) && mw > 0 ? Math.max(320, Math.min(4000, mw)) : d.page.maxWidth;
      }
      // 动效相关：只接受白名单取值，坏数据退回默认
      [['fxLevel', ['1', '2', '3']], ['cursorGlow', ['0', '1']], ['cursorStyle', ['none', 'ring', 'dot', 'both']],
        ['magnet', ['0', '1']], ['scrollBar', ['0', '1']], ['backTop', ['0', '1']], ['reduceMotion', ['0', '1']],
        ['spotlight', ['0', '1']], ['parallax', ['0', '1']], ['ripple', ['0', '1']], ['scrollShadow', ['0', '1']],
        ['countUp', ['0', '1']], ['trail', ['0', '1']], ['pageVeil', ['0', '1']],
        ['introStyle', INTRO_STYLES], ['introFreq', INTRO_FREQ], ['hintStyle', HINT_STYLES], ['introDrive', INTRO_DRIVE]
      ].forEach(function (t) {
        var v = String(s.page[t[0]] == null ? '' : s.page[t[0]]);
        if (t[1].indexOf(v) >= 0) page[t[0]] = v;
      });
    }
    var assets = Array.isArray(s.assets) ? s.assets.filter(function (a) {
      return a && typeof a === 'object' && typeof a.id === 'string' &&
        typeof a.src === 'string' && a.src.length < 8 * 1024 * 1024 &&
        /^(data:image\/|https?:\/\/|\/\/|\/|\.|asset:)/i.test(a.src);
    }).map(function (a) {
      return { id: a.id, name: String(a.name || '图片').slice(0, 120), src: a.src };
    }) : [];
    // 「我的组件」是用户自己攒的复用片段：只保留结构合法的，数量上限防止夸张数据拖慢编辑器
    var components = Array.isArray(s.components) ? s.components.filter(function (c) {
      return c && typeof c === 'object' && Array.isArray(c.blocks) && c.blocks.length;
    }).slice(0, 80).map(function (c) {
      return {
        id: (typeof c.id === 'string' && c.id) ? c.id : uid(),
        name: String(c.name || '我的组件').slice(0, 40),
        ico: String(c.ico || '◧').slice(0, 4),
        blocks: normalizeBlocks(c.blocks.slice())
      };
    }).filter(function (c) { return c.blocks.length; }) : [];
    return { name: name, page: page, blocks: normalizeBlocks(s.blocks.slice()), assets: assets, components: components };
  }

  var STORAGE_KEY = 'wr-studio-project-v1';
  var state = defaultState();
  var selectedId = null;
  var device = 'desktop';
  var history = [], hIdx = -1, hTimer = null, saveTimer = null;

  /* ---------- 历史 ----------
     快照只序列化 name/page/blocks，图片素材数组按引用共享（每次改动都换新数组，
     旧快照不会被后续编辑污染），避免几十份 MB 级 base64 反复 stringify / parse。 */
  var MAX_HISTORY = 40;
  function snapshot() {
    return {
      json: JSON.stringify({ name: state.name, page: state.page, blocks: state.blocks, components: state.components }),
      assets: state.assets || []
    };
  }
  function pushHistory() {
    clearTimeout(hTimer);
    history = history.slice(0, hIdx + 1);
    var s = snapshot();
    var last = history[history.length - 1];
    // 连续输入同一内容时不重复占历史位
    if (!last || last.json !== s.json || last.assets !== s.assets) {
      history.push(s);
      if (history.length > MAX_HISTORY) history.shift();
    }
    hIdx = history.length - 1;
    updateHistoryButtons();
    scheduleSave();
  }
  function scheduleHistory() {
    clearTimeout(hTimer);
    hTimer = setTimeout(pushHistory, 550);
  }
  function updateHistoryButtons() {
    $('#undoBtn').disabled = hIdx <= 0;
    $('#redoBtn').disabled = hIdx >= history.length - 1;
  }
  function restoreFromHistory() {
    clearTimeout(hTimer);
    var keepId = selectedId;
    var s = history[hIdx];
    var data = JSON.parse(s.json);
    state = Object.assign(defaultState(), data);
    state.page = Object.assign(defaultState().page, data.page || {});
    state.assets = s.assets || [];
    state.components = Array.isArray(data.components) ? data.components : [];
    normalizeBlocks(state.blocks);
    // 撤销/重做后仍保留当前选中模块，不用重新点一遍
    selectedId = (keepId && findBlock(keepId, state.blocks, null)) ? keepId : null;
    renderAll();
    updateHistoryButtons();
    scheduleSave();
  }
  function undo() { if (hIdx > 0) { hIdx--; restoreFromHistory(); toast('已撤销'); } }
  function redo() { if (hIdx < history.length - 1) { hIdx++; restoreFromHistory(); toast('已重做'); } }

  /* ---------- 本地保存 ---------- */
  var saveWarned = false;
  function writeLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveWarned = false;
      return true;
    } catch (e) {
      // 自动保存静默失败最危险：项目看似保存了，关掉页面却什么都没有
      if (!saveWarned) {
        saveWarned = true;
        toast('本地空间不足，自动保存失败；请删掉大图 / 大视频，或先导出项目 JSON 备份', true);
      }
      return false;
    }
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeLocal, 800);
  }
  function saveNow(silent) {
    var ok = writeLocal();
    if (ok && !silent) toast('✓ 项目已保存到浏览器本地');
    return ok;
  }
  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var clean = sanitizeProject(JSON.parse(raw));
      if (!clean) return false;
      state = clean;
      $('#projectName').value = state.name || '';
      return true;
    } catch (e) { return false; }
  }

  /* ---------- 渲染：素材库（分组 / 折叠 / 搜索） ---------- */
  var assetQuery = '';
  var collapsedGroups = {};
  function assetCardHTML(a) {
    return '<div class="asset-card ' + a.tone + '" draggable="true" tabindex="0" role="button" aria-label="添加' + esc(a.label) + '" data-asset="' + a.type + '" title="拖到画布，或点击直接添加">' +
      '<span class="asset-ico">' + esc(a.ico) + '</span><span class="asset-label">' + esc(a.label) + '</span></div>';
  }
  function renderAssets() {
    var box = $('#assetGrid');
    var q = assetQuery.trim().toLowerCase();
    var html = GROUPS.map(function (g) {
      var list = ASSETS.filter(function (a) {
        return a.g === g.key && (!q || (a.label + ' ' + a.type).toLowerCase().indexOf(q) >= 0);
      }).sort(function (a, b) { return (b.nest ? 1 : 0) - (a.nest ? 1 : 0); });
      if (!list.length) return '';
      var collapsed = !q && !!collapsedGroups[g.key];
      return '<div class="asset-group' + (collapsed ? ' collapsed' : '') + '" data-group="' + g.key + '">' +
        '<button class="group-head" type="button" data-toggle-group="' + g.key + '" aria-expanded="' + String(!collapsed) + '">' +
        '<span class="group-ico">' + esc(g.ico) + '</span><span class="group-label">' + esc(g.label) + '</span>' +
        '<span class="group-n">' + list.length + '</span><span class="group-arrow">⌄</span></button>' +
        '<div class="asset-grid">' + list.map(assetCardHTML).join('') + '</div></div>';
    }).join('');
    box.innerHTML = html || '<div class="asset-empty">没有找到匹配的组件</div>';
    $('#assetCount').textContent = q
      ? '匹配 ' + $$('.asset-card', box).length + ' 个'
      : ASSETS.length + ' 个组件 · 拖到画布';
  }
  function renderMyAssets() {
    var box = $('#myAssets');
    if (!state.assets.length) {
      box.innerHTML = '<div class="my-empty">还没有上传图片</div>';
      return;
    }
    box.innerHTML = state.assets.map(function (a) {
      return '<div class="my-asset" draggable="true" tabindex="0" role="button" aria-label="插入图片 ' + esc(a.name) + '" data-asset-id="' + a.id + '" title="拖到画布使用">' +
        '<img src="' + esc(a.src) + '" alt="' + esc(a.name) + '">' +
        '<button class="del" data-del-asset="' + a.id + '" title="删除素材">✕</button></div>';
    }).join('');
  }

  /* ---------- 渲染：我的组件（自己存的复用片段） ---------- */
  function componentCardHTML(c) {
    var n = countBlocks(c.blocks || []);
    return '<div class="comp-card" draggable="true" tabindex="0" role="button" aria-label="插入组件 ' + esc(c.name) +
      '" data-comp="' + esc(c.id) + '" title="拖到画布，或点击直接插入">' +
      '<span class="comp-ico">' + esc(c.ico || '◧') + '</span>' +
      '<span class="comp-body"><b>' + esc(c.name) + '</b><small>' + n + ' 个模块</small></span>' +
      '<button type="button" class="comp-btn" data-comp-export="' + esc(c.id) + '" title="导出为 JSON 模块">⬇</button>' +
      '<button type="button" class="comp-btn" data-comp-edit="' + esc(c.id) + '" title="重命名 / 换图标">✎</button>' +
      '<button type="button" class="comp-btn del" data-comp-del="' + esc(c.id) + '" title="删除组件">✕</button>' +
      '</div>';
  }
  function renderComponents() {
    var list = state.components || [];
    var box = $('#compGrid');
    if (!box) return;
    $('#compCount').textContent = list.length + ' 个';
    box.innerHTML = list.length ? list.map(componentCardHTML).join('') :
      '<div class="comp-empty">还没有组件。选中一个模块或容器，在右侧点「✚ 存为我的组件」。</div>';
  }
  /* ---------- 模块上传 / 导出：与「我的组件」共用同一份数据 ---------- */
  function normalizeModules(json) {
    var raw = [];
    if (Array.isArray(json)) raw = json;
    else if (json && Array.isArray(json.components)) raw = json.components;
    else if (json && json.project && Array.isArray(json.project.components)) raw = json.project.components;
    else if (json && Array.isArray(json.blocks)) raw = [json];
    var out = [];
    raw.forEach(function (c) {
      if (!c || !Array.isArray(c.blocks) || !c.blocks.length) return;
      var good = c.blocks.every(function (b) {
        return b && b.type && ASSET_MAP[b.type] && b.p && typeof b.p === 'object';
      });
      if (!good) return;
      var blocks = clone(c.blocks);
      blocks.forEach(regenIds);
      out.push({
        id: uid(), name: String(c.name || '导入模块').slice(0, 40),
        ico: String(c.ico || '◧').slice(0, 4), blocks: blocks
      });
    });
    return out;
  }
  function importModules(json, source) {
    var list = normalizeModules(json);
    if (!list.length) { toast('文件里没有可导入的模块', true); return 0; }
    var names = {};
    (state.components || []).forEach(function (c) { names[c.name] = 1; });
    var added = [];
    list.forEach(function (c) {
      var nm = c.name, i = 2;
      while (names[nm]) { nm = c.name + ' (' + i++ + ')'; }
      c.name = nm; names[nm] = 1; added.push(c);
    });
    if (added.length) {
      state.components = (state.components || []).concat(added);
      pushHistory(); renderAll();
    }
    toast('已从' + (source || '文件') + '导入 ' + added.length + ' 个模块');
    return added.length;
  }
  function downloadModules(list, filename) {
    if (!list || !list.length) { toast('没有可导出的模块', true); return; }
    var payload = {
      format: 'wr-module-v1', app: 'WR Studio',
      exportedAt: new Date().toISOString(), components: list
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename || 'wr-modules.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('已导出 ' + list.length + ' 个模块');
  }

  function insertComponent(id, index, parentId) {
    var c = (state.components || []).filter(function (x) { return x.id === id; })[0];
    if (!c || !c.blocks || !c.blocks.length) return;
    // 深拷贝 + 重生成 id：同一组件可以插很多次，彼此独立编辑
    var copies = clone(c.blocks);
    copies.forEach(regenIds);
    var list = listFor(parentId);
    var at = (index == null || index < 0 || index > list.length) ? list.length : index;
    Array.prototype.splice.apply(list, [at, 0].concat(copies));
    selectedId = copies[0].id;
    pushHistory(); renderAll();
    toast('已插入组件「' + c.name + '」');
  }
  function deleteComponent(id) {
    var c = (state.components || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    state.components = state.components.filter(function (x) { return x.id !== id; });
    pushHistory(); renderAll();
    toast('已删除组件「' + c.name + '」，可用 Ctrl+Z 撤销');
  }
  var COMP_ICONS = ['◧', '▤', '▦', '⬚', '✦', '✧', '◆', '▩', '☰', '✚', '◈', '▣'];
  var compEditId = null;
  function defaultCompName(b) {
    var base = isContainer(b) ? '组合' : (ASSET_MAP[b.type] ? ASSET_MAP[b.type].label : '模块');
    var t = String(b.p.title || b.p.text || '').split('\n')[0].replace(/[|｜]/g, ' ').trim();
    if (/^(asset:|data:|https?:)/i.test(t) || t.length > 40) t = '';
    return (t || base).slice(0, 40);
  }
  function pickCompIcon(ico) {
    $$('#compIcoPick button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-ico') === ico);
    });
  }
  function openCompModal(id) {
    compEditId = id || null;
    var c = id ? (state.components || []).filter(function (x) { return x.id === id; })[0] : null;
    if (!id) {
      var b = getBlock(selectedId);
      if (!b) { toast('请先在画布上选中一个模块', true); return; }
      $('#compModalTitle').textContent = '✚ 存为我的组件';
      $('#compSave').textContent = '保存组件';
      $('#compName').value = defaultCompName(b);
      pickCompIcon('◧');
      $('#compNote').textContent = '会把当前' + (isContainer(b) ? '容器（含 ' + (b.children || []).length + ' 个子模块）' : '模块') +
        '完整保存，之后可从左侧「我的组件」反复拖出来用，插入的副本彼此独立。';
    } else if (c) {
      $('#compModalTitle').textContent = '✎ 编辑组件';
      $('#compSave').textContent = '保存修改';
      $('#compName').value = c.name;
      pickCompIcon(c.ico || '◧');
      $('#compNote').textContent = '只改名称和图标，已经插入页面的模块不受影响。';
    } else return;
    $('#compModal').hidden = false;
    setTimeout(function () { var n = $('#compName'); n.focus(); n.select(); }, 30);
  }
  function closeCompModal() {
    compEditId = null;
    $('#compModal').hidden = true;
  }
  function submitCompModal() {
    var name = String($('#compName').value || '').trim().slice(0, 40) || '未命名组件';
    var active = $('#compIcoPick .active');
    var ico = active ? active.getAttribute('data-ico') : '◧';
    if (compEditId) {
      var c = (state.components || []).filter(function (x) { return x.id === compEditId; })[0];
      if (c) { c.name = name; c.ico = ico; }
      pushHistory(); renderAll();
      toast('✓ 组件已更新');
    } else {
      var b = getBlock(selectedId);
      if (!b) { closeCompModal(); return; }
      var copy = clone(b);
      regenIds(copy);
      state.components = (state.components || []).concat([{ id: uid(), name: name, ico: ico, blocks: [copy] }]);
      pushHistory(); renderAll();
      toast('✓ 已存为组件「' + name + '」，可在左侧「我的组件」中使用');
    }
    closeCompModal();
  }

  /* ---------- 通用设置：尺寸 / 外观 / 链接 ---------- */
  /* 尺寸样式：编辑态放在 .b-block 上，导出态放在 <section> 上，两处用同一份 */
  function sizeCSS(b) {
    var p = b.p, o = [];
    var w = Math.max(20, Math.min(100, cnum(p, 'boxWidth')));
    var mw = Math.max(0, cnum(p, 'boxMaxWidth'));
    var mh = Math.max(0, cnum(p, 'boxMinHeight'));
    var h = Math.max(0, cnum(p, 'boxHeight'));
    var my = Math.max(0, cnum(p, 'boxMarginY'));
    var limited = w < 100 || mw > 0;
    if (w < 100) o.push('width:' + w + '%');
    if (mw > 0) o.push('max-width:' + mw + 'px');
    if (mh > 0) o.push('min-height:' + mh + 'px');
    if (h > 0) o.push('height:' + h + 'px');
    if (my > 0) { o.push('margin-top:' + my + 'px', 'margin-bottom:' + my + 'px'); }
    if (limited) {
      var al = cv(p, 'boxAlign');
      if (al === 'center') o.push('margin-left:auto', 'margin-right:auto');
      else if (al === 'right') o.push('margin-left:auto', 'margin-right:0');
      else o.push('margin-left:0', 'margin-right:auto');
    }
    return o.join(';');
  }
  /* 浮层定位：编辑器写在 .b-block 上，导出写在 .wr-layer 包裹层上。
     坐标用百分比，目标模块缩放后浮层仍贴在原来的相对位置。 */
  /* 浮层鼠标模式：auto=智能穿透（容器透传、仅内容可点，默认），
     box=整块可点（旧行为，适合遮罩），none=完全穿透。旧数据只有 auto/none，会自动归入前两档。 */
  function layerPEMode(b) {
    var m = String(cv((b || {}).p, 'layerPointer') || 'auto');
    return m === 'box' ? 'box' : (m === 'none' ? 'none' : 'auto');
  }
  function layerCSS(b) {
    var p = b.p || {};
    var x = Math.max(-100, Math.min(100, cnum(p, 'layerX')));
    var y = Math.max(-100, Math.min(100, cnum(p, 'layerY')));
    var w = Math.max(10, Math.min(150, cnum(p, 'layerW')));
    var z = Math.max(0, Math.min(100, cnum(p, 'layerZ')));
    var h = Math.max(0, Math.min(1200, cnum(p, 'layerH')));
    var rot = Math.max(-180, Math.min(180, cnum(p, 'layerRotate')));
    return css({
      position: 'absolute', left: x + '%', top: y + '%', width: w + '%',
      height: h > 0 ? h + 'px' : '', 'z-index': z,
      transform: rot ? 'rotate(' + rot + 'deg)' : '',
      // 智能穿透 / 完全穿透时容器都不接收鼠标，只有 box 模式整块接收
      'pointer-events': layerPEMode(b) === 'box' ? 'auto' : 'none'
    });
  }
  function isOverlay(b) { return !!b && cv(b.p, 'layerMode') === 'overlay'; }
  /* 属性面板里的「叠放在哪个模块上」：只列同一层级的兄弟模块。
     浮层的配对只在同一个列表里完成，跨层级的目标导出后找不到宿主；
     浮层也可以作为目标（多层叠放导出时拍平到同一个宿主）。 */
  function refreshLayerTargetOpts(selected) {
    var out = [['', '紧挨着的上一个模块']];
    var b = selected || (selectedId ? getBlock(selectedId) : null);
    var r = b ? findBlock(b.id, state.blocks, null) : null;
    var list = r ? r.list : state.blocks;
    (list || []).forEach(function (x) {
      if (!x || (b && x.id === b.id)) return;
      var label = (isOverlay(x) ? '浮层 · ' : '') + shortLabel(x).slice(0, 24);
      out.push([x.id, label]);
    });
    F.layerTarget.opts = out;
    return selected;
  }
  /* 行内布局：子块在父容器的一行里占多少位置（编辑器 .b-block 与导出 <section> 共用同一份） */
  function colCSS(b, parent) {
    if (!parent || !isContainer(parent)) return '';
    var layout = parent.p.layout || 'stack';
    if (layout === 'row') {
      var cols = Math.max(1, Math.min(6, Number(parent.p.cols) || 3));
      var span = Math.max(1, Math.min(cols, Math.round(cnum(b.p, 'colSpan')) || 1));
      return span > 1 ? 'grid-column:span ' + span : '';
    }
    if (layout === 'flow') {
      var w = Math.max(0, Math.min(100, Math.round(cnum(b.p, 'flowWidth'))));
      var gap = Math.max(0, Number(parent.p.gap) || 0);
      if (w > 0) return 'flex:0 0 calc(' + w + '% - ' + gap + 'px)';
      return 'flex:1 1 180px;min-width:0';
    }
    return '';
  }
  /* 视觉样式：两种模式都直接作用于 <section>
     通用增强属性（配色 / 排版 / 效果）也在这里落地，画布与导出页共用同一份 */
  /* ---------- 主题样式：每个模块决定自己在浅色 / 深色主题下长什么样 ---------- */
  var THEME_ROLES = ['auto', 'base', 'card', 'soft', 'accent', 'inverse', 'outline', 'plain', 'custom'];
  var THEME_ROLE_NOTE = {
    auto: '跟随主题：浅色下用组件自己的配色，切到深色时由整站统一接管（原来的行为）。',
    base: '用页面底色 + 页面文字色，和页面融为一体；换主题底色时跟着变。',
    card: '浅色下是浅灰卡片，深色下是深色卡片，把内容从背景里「托」起来。',
    soft: '用当前强调色调出一层很浅的底，换主题色时整块跟着变。',
    accent: '整块铺当前强调色，文字自动取对比色；换主题色时整块跟着变。',
    inverse: '浅色主题下是深色块，深色主题下是浅色块，用来做视觉重点。',
    outline: '不填底色，只给一圈强调色描边；深色下同样适用。',
    plain: '完全透明，只保留内容，适合叠在背景图或渐层上。',
    custom: '下面给浅色和深色各设一套颜色，切换模式时自动换用对应的一套。'
  };
  function themeRoleOf(p) {
    var r = String((p && p.boxThemeRole) || 'auto');
    return THEME_ROLES.indexOf(r) >= 0 ? r : 'auto';
  }
  /* 「自定义配色」但四个颜色一个都没填 = 和跟随主题没区别。
     这种情况还写 wr-th-custom，深色模式的规则会用空变量把背景刷成透明，
     整块渐变就没了 —— 按 auto 处理，保留模块自己的底色。 */
  function themeRoleEff(p) {
    var r = themeRoleOf(p);
    if (r === 'custom') {
      var has = ['boxThemeLightBg', 'boxThemeLightText', 'boxThemeLightAccent', 'boxThemeLightLink',
        'boxThemeDarkBg', 'boxThemeDarkText', 'boxThemeDarkAccent', 'boxThemeDarkLink'].some(function (k) {
          return String(cv(p, k) || '').trim() !== '';
        });
      if (!has) return 'auto';
    }
    return r;
  }
  /* 底色深浅决定文字用黑还是白；解析不出来按浅底深字处理 */
  function inkOn(bg, fb) {
    var l = colorLum(bg);
    if (l == null || l < 0) return fb || '#ffffff';
    return l > 0.62 ? '#16233a' : '#ffffff';
  }
  /* 深色模式的三档底色：优先读页面里「深色模式」组件的设置，没有就用默认深色 */
  function darkPalette() {
    var d = { bg: '#0f172a', text: '#e8eef9', card: '#1e293b' };
    try {
      (function walk(list) {
        (list || []).forEach(function (b) {
          if (!b) return;
          if (b.type === 'darkmode' && b.p) {
            d.bg = safeCssColor(b.p.dmDarkBg, d.bg);
            d.text = safeCssColor(b.p.dmDarkText, d.text);
            d.card = safeCssColor(b.p.dmDarkCard, d.card);
          }
          if (b.children) walk(b.children);
        });
      })(state && state.blocks);
    } catch (e) { }
    return d;
  }
  function visualCSS(b) {
    var p = b.p, o = [];
    var bw = Math.max(0, cnum(p, 'boxBorderWidth'));
    var bc = String(cv(p, 'boxBorderColor') || '').trim();
    var bs = String(cv(p, 'boxBorderStyle') || 'solid');
    if (bw > 0 && bc) o.push('border:' + bw + 'px ' + (/^(solid|dashed|dotted|double)$/.test(bs) ? bs : 'solid') + ' ' + safeCssColor(bc));
    var op = Math.max(20, Math.min(100, cnum(p, 'boxOpacity')));
    if (op < 100) o.push('opacity:' + (op / 100));

    /* --- 模块配色 --- */
    var lockColor = String(cv(p, 'boxColorLock') || '') === '1';
    // 模块背景图：写在 background 简写之后（wrapStyle 先输出 background），单独覆盖子属性
    var bgi = String(cv(p, 'boxBgImage') || '').trim();
    var bgiSrc = bgi ? resolveMedia(bgi) : '';
    if (bgiSrc && safeImg(bgiSrc)) {
      // 用双引号包裹，外层 style 属性经 esc() 后浏览器会还原成合法 CSS。
      // 剔除引号 / 反斜杠 / 括号 / 分号 / 花括号 / 空白，杜绝 url() 内逃逸出第二条声明
      var bgiClean = bgiSrc.replace(/["'\\();{}\s<>]/g, '').replace(/(javascript|vbscript|expression)\s*:/gi, '');
      if (bgiClean && !/^(javascript|vbscript):/i.test(bgiClean)) {
        o.push('background-image:url("' + bgiClean + '")');
        o.push('background-size:' + (/^(cover|contain|auto)$/.test(cv(p, 'boxBgSize')) ? cv(p, 'boxBgSize') : 'cover'));
        o.push('background-repeat:' + (cv(p, 'boxBgRepeat') === 'repeat' ? 'repeat' : 'no-repeat'));
        o.push('background-position:center');
      }
    }
    var acc = String(cv(p, 'boxAccent') || '').trim();
    if (acc) o.push('--wr-accent:' + safeCssColor(acc));           // 覆盖本模块强调色（大量组件用 var(--wr-accent)）
    var ink = String(cv(p, 'boxTextColor') || '').trim();
    if (ink) o.push('--wr-mod-ink:' + safeCssColor(ink));           // 由 wr-mod-ink 类配合 !important 规则生效
    // 锁定配色但未设文字色时，冻结为页面浅色文字基准，避免深色模式下继承浅字导致浅底看不清
    if (lockColor && !ink) o.push('color:#16233a');
    var lk = String(cv(p, 'boxLinkColor') || '').trim();
    if (lk) o.push('--wr-mod-link:' + safeCssColor(lk));            // 由 wr-mod-links 类配合 !important 规则生效

    /* --- 主题样式：这个模块在浅色 / 深色主题下长什么样 ---
       选了非「跟随主题」后，这里的底色会盖过「模块配色」里的模块背景；
       文字色 / 链接色 / 强调色如果手动设过，仍以手动设置为准。 */
    var thRole = themeRoleOf(p);
    if (thRole !== 'auto') {
      var pageBg = paint((state.page && state.page.bg) || '', '#ffffff');
      var pageInk = safeCssColor((state.page && state.page.text) || '#16233a', '#16233a');
      var pageAcc = safeCssColor((state.page && state.page.accent) || '#3b82f6', '#3b82f6');
      var thBg = '', thInk = '', thAcc = '', thLink = '';
      if (thRole === 'base') {
        thBg = 'var(--wr-page-bg,' + pageBg + ')';
        thInk = 'var(--wr-page-text,' + pageInk + ')';
      } else if (thRole === 'card') {
        thBg = '#f6f8fc'; thInk = pageInk;
      } else if (thRole === 'soft') {
        thBg = 'color-mix(in srgb,var(--wr-accent,' + pageAcc + ') 10%,transparent)'; thInk = pageInk;
      } else if (thRole === 'accent') {
        thBg = 'var(--wr-accent,' + pageAcc + ')';
        thInk = inkOn(pageAcc, '#ffffff');
      } else if (thRole === 'inverse') {
        thBg = '#0f172a'; thInk = '#e8eef9';
      } else if (thRole === 'outline') {
        thBg = 'transparent';
      } else if (thRole === 'plain') {
        thBg = 'transparent';
      } else if (thRole === 'custom') {
        var thLB = safeColor(cv(p, 'boxThemeLightBg'));
        var thLT = safeColor(cv(p, 'boxThemeLightText'));
        var thLA = safeColor(cv(p, 'boxThemeLightAccent'));
        var thLL = safeColor(cv(p, 'boxThemeLightLink'));
        var thDB = safeColor(cv(p, 'boxThemeDarkBg'));
        var thDT = safeColor(cv(p, 'boxThemeDarkText'));
        var thDA = safeColor(cv(p, 'boxThemeDarkAccent'));
        var thDL = safeColor(cv(p, 'boxThemeDarkLink'));
        thBg = thLB; thInk = thLT; thAcc = thLA; thLink = thLL;
        // 深色那一套写成变量，由 componentCSS 里的规则在 html.wr-dark 下取用
        if (thLB) o.push('--wr-th-bg:' + thLB);
        if (thLT) { o.push('--wr-th-ink:' + thLT); if (!ink) o.push('--wr-mod-ink:' + thLT); }
        if (thLA) o.push('--wr-th-accent:' + thLA);
        if (thLL) o.push('--wr-th-link:' + thLL);
        if (thDB) o.push('--wr-th-bg-d:' + thDB);
        if (thDT) o.push('--wr-th-ink-d:' + thDT);
        if (thDA) o.push('--wr-th-accent-d:' + thDA);
        if (thDL) o.push('--wr-th-link-d:' + thDL);
      }
      if (thBg) o.push('background:' + thBg);
      if (thInk) o.push('color:' + thInk);
      if (thAcc && !acc) o.push('--wr-accent:' + thAcc);
      // 强调 / 反色块里的文字要统一反色，否则组件写死的深字会和深底糊在一起
      if ((thRole === 'accent' || thRole === 'inverse') && !ink && thInk) o.push('--wr-mod-ink:' + thInk);
      if ((thRole === 'accent' || thRole === 'inverse') && !lk) o.push('--wr-mod-link:' + (thLink || thInk));
      if (thRole === 'custom' && thLink && !lk) o.push('--wr-mod-link:' + thLink);
      if (thRole === 'outline' && !(bw > 0 && bc)) o.push('box-shadow:inset 0 0 0 1px ' + alphaColor(pageAcc, 0.45));
    }

    /* --- 文字排版：写在 section 上，靠 CSS 继承作用到未写死样式的子元素 --- */
    var ffMap = {
      sans: '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',
      serif: 'Georgia,"Songti SC","SimSun",serif',
      mono: 'ui-monospace,SFMono-Regular,Consolas,monospace',
      round: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'
    };
    var ff = ffMap[cv(p, 'boxFont')];
    if (ff) o.push('font-family:' + ff);
    var fs = cnum(p, 'boxFontSize'); if (fs > 0) o.push('font-size:' + fs + 'px');
    var lh = cnum(p, 'boxLineHeight'); if (lh > 0) o.push('line-height:' + (lh / 100));
    var ls = cnum(p, 'boxLetterSpacing'); if (ls) o.push('letter-spacing:' + ls + 'px');
    var fw = String(cv(p, 'boxFontWeight') || '').trim(); if (fw) o.push('font-weight:' + fw);
    var tt = cv(p, 'boxTextTransform'); if (tt && tt !== 'none') o.push('text-transform:' + tt);
    var td = cv(p, 'boxTextDeco'); if (td && td !== 'none' && /^(underline|line-through|overline)$/.test(td)) o.push('text-decoration:' + td);
    var tshMap = {
      soft: '0 2px 8px rgba(0,0,0,.22)', hard: '2px 3px 0 rgba(0,0,0,.22)', glow: '0 0 16px currentColor'
    };
    var tsh = tshMap[cv(p, 'boxTextShadow')]; if (tsh) o.push('text-shadow:' + tsh);

    /* --- 视觉效果：用独立的 rotate / scale 属性，避免与进场动画的 transform 冲突 --- */
    var fltMap = {
      grayscale: 'grayscale(1)', sepia: 'sepia(.85)', blur: 'blur(2px)',
      brightness: 'brightness(1.18)', contrast: 'contrast(1.25)',
      saturate: 'saturate(1.6)', invert: 'invert(1)'
    };
    var flt = fltMap[cv(p, 'boxFilter')]; if (flt) o.push('filter:' + flt);
    var bm = cv(p, 'boxBlend'); if (bm && bm !== 'normal') o.push('mix-blend-mode:' + bm);
    if (String(cv(p, 'boxBackdrop')) === '1') o.push('-webkit-backdrop-filter:blur(14px)', 'backdrop-filter:blur(14px)');
    var rot = cnum(p, 'boxRotate'); if (rot) o.push('rotate:' + rot + 'deg');
    var sc = cnum(p, 'boxScale'); if (sc && sc !== 100) o.push('scale:' + (sc / 100));
    var cur = String(cv(p, 'boxCursor') || '').trim(); if (cur) o.push('cursor:' + cur);
    var pe = cv(p, 'boxPointer'); if (pe === 'none') o.push('pointer-events:none');

    // 允许写多声明（分号），但禁止引号 / 花括号 / @import 等可逃逸或引入外部规则的内容
    var custom = safeCssValue(String(cv(p, 'boxCustomCSS') || '').trim());
    if (custom) o.push(custom);
    return o.join(';');
  }
  function sectionClass(b) {
    var p = b.p, c = [];
    var v = cv(p, 'boxVisibility');
    if (v === 'desktop') c.push('wr-only-desktop');
    if (v === 'mobile') c.push('wr-only-mobile');
    if (cv(p, 'boxShadow') !== 'none') c.push('wr-shadow-' + cv(p, 'boxShadow'));
    if (cv(p, 'boxHover') !== 'none') c.push('wr-hover-' + cv(p, 'boxHover'));
    if (cv(p, 'loopFx') !== 'none') c.push('wr-loop-' + cv(p, 'loopFx'));
    if (isStickyNav(b)) c.push('wr-sticky-nav');
    /* 通用增强：标记类，配合 componentCSS 里的规则生效 */
    if (String(cv(p, 'boxColorLock') || '') === '1') c.push('wr-color-lock');
    /* 主题样式：把角色写成类，深色模式用对应的规则接管；强调 / 反色块统一反色文字 */
    var thRole = themeRoleEff(p);
    if (thRole !== 'auto') {
      c.push('wr-th-' + thRole);
      if (thRole === 'accent' || thRole === 'inverse') c.push('wr-mod-ink', 'wr-mod-links');
      if (thRole === 'custom') {
        if (String(cv(p, 'boxThemeLightText') || '').trim()) c.push('wr-mod-ink');
        if (String(cv(p, 'boxThemeLightLink') || '').trim()) c.push('wr-mod-links');
      }
    }
    if (String(cv(p, 'boxTextColor') || '').trim()) c.push('wr-mod-ink');
    if (String(cv(p, 'boxLinkColor') || '').trim()) c.push('wr-mod-links');
    if (String(cv(p, 'boxHref') || '').trim()) c.push('wr-haslink');
    if (String(cv(p, 'boxPrintHide') || '') === '1') c.push('wr-print-hide');
    var extra = String(cv(p, 'extraClass') || '').replace(/[^A-Za-z0-9_\- ]/g, '').trim();
    if (extra) c.push(extra);
    return c.join(' ');
  }
  function sectionId(b) {
    return String(cv(b.p, 'anchorId') || '').replace(/[^A-Za-z0-9_\-]/g, '').trim();
  }
  function hasOwnBorder(b) {
    return cnum(b.p, 'boxBorderWidth') > 0 && !!String(cv(b.p, 'boxBorderColor') || '').trim();
  }
  /* 链接打开方式：统一给模块内所有 <a> 注入 target / rel，无需逐个组件改 */
  var CHILD_TOKEN = '\u0001WR_CHILDREN\u0001';
  function openNewTab(href, mode) {
    if (mode === 'blank') return true;
    if (mode === 'external') return /^(?:https?:)?\/\//i.test(href);
    return false;
  }
  function decorateLinks(html, b) {
    var mode = cv(b.p, 'linkTarget');
    return String(html).replace(/<a\b([^>]*)>/gi, function (all, attrs) {
      var hm = /href\s*=\s*"([^"]*)"/i.exec(attrs);
      // 统一兜底：任何组件拼出来的 href 都再过一次协议白名单
      // attrs 里的 href 已经过 esc，避免二次转义把 & 变成 &amp;amp;
      var url = safeUrl(hm ? hm[1] : '', '#');
      var clean = attrs.replace(/\s+(?:target|rel)\s*=\s*"[^"]*"/gi, '');
      clean = clean.replace(/href\s*=\s*"[^"]*"/i, function () { return 'href="' + url + '"'; });
      // 有背景 + 内边距的链接就是按钮，导出页的「磁性吸附」只认这一种
      var isBtn = /padding\s*:/.test(attrs) && /background/.test(attrs) && !/\bdata-wr-btn\b/.test(attrs);
      return '<a' + clean + (isBtn ? ' data-wr-btn="1"' : '') +
        (openNewTab(url, mode) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>';
    });
  }

  /* ---------- 吸顶导航 ----------
     sticky 只能相对「包含块」吸附：编辑器里 <section> 外面还包着一层等高的
     .b-block，把 sticky 加在 section 上等于没有任何可移动空间，所以编辑态必须
     把 sticky 提到外层 .b-block；导出态没有包裹层，直接加在 section 上。 */
  function isStickyNav(b) {
    if (!b || !isNavType(b.type)) return false;
    var v = b.p && b.p.sticky;
    // 兼容早期项目 / 旧 JSON：没写这个字段时按组件默认值处理
    if (v == null || v === '') v = (ASSET_MAP[b.type] && ASSET_MAP[b.type].d.sticky) || '1';
    return v === '1' || v === 1 || v === true;
  }
  function stickyCSS(b) {
    if (!isStickyNav(b)) return '';
    var top = Math.max(0, Math.min(400, cnum(b.p, 'stickyTop')));
    return 'position:-webkit-sticky;position:sticky;top:' + top + 'px;z-index:50';
  }
  function hasStickyNav(list) {
    var arr = Array.isArray(list) ? list : state.blocks;
    return arr.some(function (b) {
      return isStickyNav(b) ||
        (isContainer(b) && Array.isArray(b.children) && hasStickyNav(b.children));
    });
  }

  /* ---------- 渲染：单个模块（导出与画布共用） ---------- */
  /* 独立按钮：把按钮的样式设置折算成一组 CSS 声明。
     o 是该组件的默认值（底色 / 文字色 / 圆角 / 内边距 / 字号 / 字重 / 阴影），
     用户在右侧改了任意一项就覆盖默认值，没改就保持组件原来的样子。 */
  function pnum(p, k, fb, min, max) {
    var v = p ? p[k] : undefined;
    if (v == null || v === '') return fb;
    var n = Number(v);
    if (!isFinite(n)) return fb;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  }
  function alphaColor(color, a) {
    var h = toHexColor(color).slice(1);
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function btnSkin(p, o) {
    o = o || {};
    var style = String(p.btnStyle || 'auto');
    if (['auto', 'solid', 'outline', 'soft', 'ghost', 'link'].indexOf(style) < 0) style = 'auto';
    if (style === 'auto') style = o.auto || 'solid';
    var page = state.page || {};
    var accent = safeCssColor(page.accent, '#3b82f6');
    var base = paint(p.btnBg, '') || o.bg || accent;
    var ink = safeCssColor(p.btnColor, o.color || '#ffffff');
    var r = pnum(p, 'btnRadius', o.radius == null ? 10 : o.radius, 0, 120);
    var px = pnum(p, 'btnPadX', o.padX == null ? 22 : o.padX, 0, 80);
    var py = pnum(p, 'btnPadY', o.padY == null ? 11 : o.padY, 0, 60);
    var fs = pnum(p, 'btnFontSize', o.fontSize == null ? 14 : o.fontSize, 8, 40);
    var fw = String(p.btnWeight || o.weight || '600');
    if (['400', '500', '600', '700', '800', '900'].indexOf(fw) < 0) fw = '600';
    var shadow = String(p.btnShadow || o.shadow || 'none');
    var bw = pnum(p, 'btnBorderWidth', o.borderWidth == null ? 1 : o.borderWidth, 0, 8);
    var full = String(p.btnFull) === '1' || !!o.full;
    var decl = {
      display: full ? 'block' : 'inline-block',
      'border-radius': r + 'px',
      'font-size': fs + 'px',
      'font-weight': fw,
      'text-decoration': 'none',
      'text-align': 'center',
      'line-height': '1.35',
      'box-sizing': 'border-box',
      'white-space': 'normal'
    };
    if (full) decl.width = '100%';
    if (style === 'link') {
      decl.background = 'transparent';
      decl.color = p.btnColor || o.linkColor || ink;
      decl.padding = '0';
      decl['text-decoration'] = 'underline';
      decl['text-underline-offset'] = '3px';
      decl.border = '0';
    } else {
      decl.padding = py + 'px ' + px + 'px';
      if (style === 'outline') {
        decl.background = 'transparent';
        decl.color = base;
        decl.border = Math.max(1, bw) + 'px solid ' + base;
      } else if (style === 'soft') {
        decl.background = alphaColor(base, 0.14);
        decl.color = base;
        decl.border = bw > 0 ? bw + 'px solid ' + alphaColor(base, 0.28) : '0';
      } else if (style === 'ghost') {
        decl.background = 'transparent';
        decl.color = ink;
        decl.border = '1px solid ' + alphaColor(ink, 0.42);
      } else {
        decl.background = base;
        decl.color = ink;
        decl.border = bw > 0 ? bw + 'px solid ' + alphaColor(base, 0.45) : '0';
      }
      if (style === 'solid' || style === 'soft') {
        if (shadow === 'soft') decl['box-shadow'] = '0 8px 22px -10px rgba(20,40,80,.42)';
        else if (shadow === 'strong') decl['box-shadow'] = '0 14px 34px -12px rgba(20,40,80,.58)';
        else if (shadow === 'glow') decl['box-shadow'] = '0 0 0 4px ' + alphaColor(base, 0.16) + ',0 10px 28px -10px ' + alphaColor(base, 0.5);
      }
    }
    if (o.extra) Object.assign(decl, o.extra);
    return decl;
  }
  function inputSkin(p, o) {
    o = o || {};
    var page = state.page || {};
    var decl = {
      background: paint(p.inputBg, '') || o.bg || '#ffffff',
      color: p.inputColor || o.color || page.text || '#16233a',
      border: (pnum(p, 'inputBorderWidth', o.borderWidth == null ? 1 : o.borderWidth, 0, 5)) + 'px solid ' +
        safeCssColor(p.inputBorderColor, o.borderColor || 'rgba(0,0,0,.12)'),
      'border-radius': pnum(p, 'inputRadius', o.radius == null ? 10 : o.radius, 0, 60) + 'px',
      padding: pnum(p, 'inputPadY', o.padY == null ? 12 : o.padY, 0, 40) + 'px ' +
        pnum(p, 'inputPadX', o.padX == null ? 14 : o.padX, 0, 60) + 'px',
      'font-size': (o.fontSize || 14) + 'px',
      outline: 'none',
      'box-sizing': 'border-box'
    };
    if (o.full) decl.width = '100%';
    if (o.flex != null) decl.flex = o.flex;
    return decl;
  }
  /* 输入框占位色只能走 CSS 变量 */
  function phVars(p) {
    return p.inputPhColor ? '--wr-ph:' + safeCssColor(p.inputPhColor) + ';' : '';
  }
  /* 导航 / 页脚的文字变量：用 CSS 变量交给样式表，避免给每个链接单独写行内样式 */
  function navVars(p) {
    var d = { '--wr-nav-gap': pnum(p, 'navLinkGap', 20, 0, 80) + 'px' };
    d['--wr-nav-link-size'] = pnum(p, 'navLinkSize', 14, 8, 30) + 'px';
    if (safeColor(p.navLinkColor)) d['--wr-nav-link'] = safeColor(p.navLinkColor);
    if (safeColor(p.navLinkHover)) d['--wr-nav-link-hover'] = safeColor(p.navLinkHover);
    return d;
  }
  function brandStyle(p, fb) {
    return { 'font-size': pnum(p, 'navBrandSize', fb == null ? 17 : fb, 10, 40) + 'px' };
  }
  function footVars(p) {
    var d = {};
    d['--wr-foot-link-size'] = pnum(p, 'footLinkSize', 13, 8, 24) + 'px';
    d['--wr-foot-gap'] = pnum(p, 'footLinkGap', 7, 0, 40) + 'px';
    d['--wr-foot-title-size'] = pnum(p, 'footTitleSize', 14, 8, 30) + 'px';
    d['--wr-foot-bottom-size'] = pnum(p, 'footBottomSize', 12, 8, 24) + 'px';
    if (safeColor(p.footLinkColor)) d['--wr-foot-link'] = safeColor(p.footLinkColor);
    return d;
  }
  /* 单条组件共用：把卡片级样式（底色 / 圆角 / 内边距 / 文字色）折算成行内声明 */
  function singleCardStyle(p, fbBg, fbRad, fbPadX, fbPadY) {
    return css({
      background: paint(p.cardBg, fbBg),
      'border-radius': pnum(p, 'radius', fbRad, 0, 120) + 'px',
      padding: pnum(p, 'cardPadY', fbPadY, 0, 80) + 'px ' + pnum(p, 'cardPadX', fbPadX, 0, 80) + 'px',
      color: p.color || state.page.text
    });
  }
  function wrapStyle(b, editor, parentBlock, skipCol) {
    var p = b.p;
    // 通用背景 / 圆角覆盖：设了就用它替代组件自带值（boxBg 支持渐变）
    var ovrBg = String(cv(p, 'boxBg') || '').trim();
    var ovrRad = cnum(p, 'boxRadius');
    // 毛玻璃：没有背景时给一层半透明底色，否则 backdrop-filter 看不出效果
    if (String(cv(p, 'boxBackdrop') || '') === '1' && !ovrBg && !paint(p.bg)) ovrBg = 'rgba(255,255,255,.14)';
    var ovrPadY = cnum(p, 'boxPadY');
    var s = css({
      background: ovrBg ? paint(ovrBg, p.bg) : paint(p.bg),
      padding: (ovrPadY > 0 ? ovrPadY : (p.padY || 0)) + 'px ' + (p.padX || 0) + 'px',
      'border-radius': ovrRad ? ovrRad + 'px' : (p.radius ? p.radius + 'px' : ''),
      'text-align': p.align || 'left'
    });
    var vis = visualCSS(b);
    if (vis) s += (s ? ';' : '') + vis;
    var ov = cv(p, 'boxOverflow');
    if (ov === 'hidden' || ov === 'auto') s += (s ? ';' : '') + 'overflow:' + ov;
    if (editor) {
      // 编辑器里尺寸由外层 .b-block 承担，section 只需铺满它
      s += (s ? ';' : '') + 'width:100%';
      if (cnum(p, 'boxHeight') > 0) s += ';height:100%';
      if (cnum(p, 'boxMinHeight') > 0) s += ';min-height:inherit';
    } else {
      var sz = sizeCSS(b);
      if (sz) s += (s ? ';' : '') + sz;
      // 有浮层宿主时，列宽/跨列要写在 .wr-stack 包裹层上（它才是容器/弹性盒的直接子项）
      var cc = skipCol ? '' : colCSS(b, parentBlock);
      if (cc) s += (s ? ';' : '') + cc;
    }
    return s;
  }
  /* 多行内容统一入口：现在的数据是「行 → 单元格」的二维数组，
     老项目里还是 "a | b | c" + 换行的字符串，这里一并兼容，避免旧数据打不开。 */
  function rowsOf(v) {
    if (Array.isArray(v)) {
      return v.map(function (r) {
        if (Array.isArray(r)) return r.map(function (c) { return c == null ? '' : String(c); });
        return [r == null ? '' : String(r)];
      });
    }
    return String(v == null ? '' : v).split('\n')
      .map(function (l) { return l.replace(/\s+$/, ''); })
      .filter(function (l) { return l.trim() !== ''; })
      .map(function (l) { return l.split('|').map(function (s) { return s.trim(); }); });
  }
  function itemRows(v) {
    return rowsOf(v).map(function (c) {
      return { a: c[0] || '', b: c[1] || '', c: c.slice(2).join(' | ') || '' };
    });
  }
  var PLACEHOLDER_IMG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420"><rect width="800" height="420" fill="#e8eef8"/><g fill="none" stroke="#a9bbd4" stroke-width="3"><rect x="1.5" y="1.5" width="797" height="417" stroke-dasharray="12 9"/></g><circle cx="400" cy="180" r="34" fill="#c6d5ea"/><path d="M340 300 L420 220 L480 280 L540 240 L640 330 L340 330Z" fill="#c6d5ea"/><text x="400" y="382" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#7f93af">在右侧填写图片地址，或从左侧上传</text></svg>'
  );
  /* 高清占位图：2400×1400 的矢量稿，放大不糊；用户上传的图片会直接替换它 */
  var HIRES_IMG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1400" viewBox="0 0 2400 1400">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101a3a"/><stop offset=".52" stop-color="#3b82f6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>' +
    '<radialGradient id="r"><stop stop-color="#fff" stop-opacity=".65"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
    '<rect width="2400" height="1400" fill="url(#g)"/><circle cx="1760" cy="360" r="520" fill="url(#r)"/>' +
    '<g fill="none" stroke="#ffffff" stroke-opacity=".14" stroke-width="2">' +
    '<path d="M0 980 Q420 700 840 940 T1680 900 T2400 960"/><path d="M0 1080 Q480 820 920 1050 T1760 1010 T2400 1060"/>' +
    '<circle cx="620" cy="560" r="260"/><circle cx="620" cy="560" r="170"/><circle cx="620" cy="560" r="80"/></g>' +
    '<text x="120" y="1260" font-family="Arial,sans-serif" font-size="86" font-weight="700" fill="#ffffff" fill-opacity=".9">HIGH RESOLUTION</text>' +
    '<text x="124" y="1340" font-family="Arial,sans-serif" font-size="34" letter-spacing="10" fill="#ffffff" fill-opacity=".6">2400 × 1400 · VECTOR PLACEHOLDER</text></svg>'
  );

  /* 10 分制评分 → 5 颗星；半颗用线性渐变裁出来，避免额外图片 */
  function ratingStars(score) {
    var n = Math.max(0, Math.min(10, Number(score) || 0));
    var full = n / 2, out = '';
    for (var i = 0; i < 5; i++) {
      var fill = Math.max(0, Math.min(1, full - i));
      var style = fill >= 1 ? '' : 'background:linear-gradient(90deg,#f5a623 ' + Math.round(fill * 100) + '%,rgba(120,130,150,.24) ' + Math.round(fill * 100) + '%);-webkit-background-clip:text;background-clip:text;color:transparent';
      out += '<span aria-hidden="true"' + (style ? ' style="' + css({ background: 'linear-gradient(90deg,#f5a623 ' + Math.round(fill * 100) + '%,rgba(120,130,150,.24) ' + Math.round(fill * 100) + '%)', '-webkit-background-clip': 'text', 'background-clip': 'text', color: 'transparent' }) + '"' : '') + '>★</span>';
    }
    return '<span class="wr-rating-stars">' + out + '</span>';
  }
  /* 话题 / 标签：逗号、中文逗号、顿号都当分隔符 */
  function tagList(v, cls) {
    return String(v || '').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean)
      .map(function (s) { return '<span class="' + (cls || 'wr-tag') + '">' + esc(s) + '</span>'; }).join('');
  }
  /* 文章正文：按行解析标题(##)/引用(>)/普通段落，输出安全 HTML */
  function articleBodyHTML(raw) {
    var lines = String(raw || '').split(/\r?\n/);
    var out = [], buf = [];
    function flush() { if (buf.length) { out.push('<p>' + esc(buf.join(' ')) + '</p>'); buf = []; } }
    lines.forEach(function (line) {
      var t = line.trim();
      if (!t) { flush(); return; }
      if (/^#{1,3}\s/.test(t)) { flush(); out.push('<h3>' + esc(t.replace(/^#{1,3}\s/, '')) + '</h3>'); }
      else if (/^>\s?/.test(t)) { flush(); out.push('<blockquote>' + esc(t.replace(/^>\s?/, '')) + '</blockquote>'); }
      else buf.push(t);
    });
    flush();
    return out.join('');
  }
  /* 社交分享：返回平台按钮数组 [{name,glyph,href,act}]，href=# 的用 data-act 交给脚本 */
  function shareButtons(raw) {
    var names = String(raw || '').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var reg = {
      '微信': ['微', 'wechat'], '微博': ['微博', 'weibo'], 'qq': ['QQ', 'qq'], 'qq空间': ['QZ', 'qzone'],
      'x': ['X', 'x'], 'twitter': ['X', 'x'], 'facebook': ['f', 'facebook'], 'line': ['L', 'line'],
      '复制链接': ['🔗', 'copy'], '链接': ['🔗', 'copy']
    };
    return names.map(function (n) {
      var key = n.toLowerCase();
      var hit = reg[key] || reg[n] || [n.slice(0, 2), ''];
      var act = hit[1];
      var href = act === 'copy' ? '#' : 'https://service.weibo.com/share/share.php?url=' + encodeURIComponent(locationHref());
      return { name: n, glyph: hit[0], act: act, href: href };
    });
  }
  function locationHref() {
    try { return (typeof window !== 'undefined' && window.location && window.location.href) || ''; }
    catch (e) { return ''; }
  }
  /* ---------- 辅助：多行数据 / 安全链接 ---------- */
  function rowCells(v) {
    return rowsOf(v);
  }
  /* 一列几个格：取字段声明，行数据更长时以数据为准 */
  function rowsCols(f, rows) {
    var n = (f && f.cols ? f.cols.length : 0) || 1;
    (rows || []).forEach(function (r) { if (r.length > n) n = r.length; });
    return n;
  }
  /* 老项目 / 识别结果里这些字段还是字符串，进内存时统一转成数组 */
  function rowsNormalize(type, p) {
    var flds = (ASSET_MAP[type] && ASSET_MAP[type].fields) || [];
    flds.forEach(function (k) {
      var f = FIELD_MAP[k];
      if (f && f.type === 'rows' && !Array.isArray(p[k])) p[k] = rowsOf(p[k]);
    });
    return p;
  }

  /* ---------- 行级独立样式 ----------
     列表里每一条都能有自己的外观：底色、文字色、圆角、内边距、图标尺寸、角标、是否隐藏。
     存在 p.__rs = { 字段名: { 行号: {...} } }。行上移 / 下移 / 删除时索引一起搬，
     所以样式始终跟着它那一行走，不会因为调了顺序就跑到别人身上。 */
  function rowStyAll(p) {
    if (!p.__rs || typeof p.__rs !== 'object' || Array.isArray(p.__rs)) p.__rs = {};
    return p.__rs;
  }
  function rowSty(p, key, i) {
    var m = p && p.__rs && p.__rs[key];
    if (!m) return null;
    var s = m[String(i)];
    return (s && typeof s === 'object') ? s : null;
  }
  /* 读某一行的某个样式项，没设就返回组件级兜底值 */
  function rowStyVal(p, key, i, k, fb) {
    var s = rowSty(p, key, i);
    if (!s || s[k] == null || s[k] === '') return fb;
    return s[k];
  }
  function setRowSty(p, key, i, k, v) {
    var all = rowStyAll(p);
    var m = all[key] || (all[key] = {});
    var idx = String(i);
    var s = m[idx] || (m[idx] = {});
    if (v == null || v === '') delete s[k]; else s[k] = v;
    if (!Object.keys(s).length) delete m[idx];
    if (!Object.keys(m).length) delete all[key];
  }
  /* 行顺序变了，样式跟着搬 */
  function shiftRowSty(p, key, act, idx) {
    var all = p && p.__rs;
    if (!all || !all[key]) return;
    var m = all[key], out = {};
    if (act === 'clear') { delete all[key]; return; }
    Object.keys(m).forEach(function (k) {
      var i = Number(k);
      if (act === 'del') {
        if (i === idx) return;
        out[i > idx ? i - 1 : i] = m[k];
      } else if (act === 'up' && idx > 0) {
        if (i === idx) out[idx - 1] = m[k];
        else if (i === idx - 1) out[idx] = m[k];
        else out[i] = m[k];
      } else if (act === 'down') {
        if (i === idx) out[idx + 1] = m[k];
        else if (i === idx + 1) out[idx] = m[k];
        else out[i] = m[k];
      } else {
        out[i] = m[k];
      }
    });
    if (Object.keys(out).length) all[key] = out; else delete all[key];
  }
  /* 导入的 JSON 不可信：颜色走白名单校验，数值夹紧，超量截断 */
  function rowsStyleSanitize(p) {
    if (!p.__rs) return;
    if (typeof p.__rs !== 'object' || Array.isArray(p.__rs)) { delete p.__rs; return; }
    var out = {}, n = 0;
    Object.keys(p.__rs).slice(0, 12).forEach(function (k) {
      if (!/^[A-Za-z0-9_]{1,32}$/.test(k)) return;
      var m = p.__rs[k];
      if (!m || typeof m !== 'object' || Array.isArray(m)) return;
      var o = {};
      Object.keys(m).slice(0, 300).forEach(function (i) {
        if (!/^\d{1,3}$/.test(i)) return;
        var s = m[i];
        if (!s || typeof s !== 'object' || Array.isArray(s)) return;
        var t = {};
        if (s.bg) { var bg = safePaint(String(s.bg).slice(0, 160), ''); if (bg) t.bg = bg; }
        if (s.color) { var co = safeColor(String(s.color).slice(0, 40)); if (co) t.color = co; }
        if (s.badgeColor) { var bc = safeColor(String(s.badgeColor).slice(0, 40)); if (bc) t.badgeColor = bc; }
        if (s.radius != null && s.radius !== '') {
          var rd = Math.round(Number(s.radius));
          if (isFinite(rd)) t.radius = Math.max(0, Math.min(120, rd));
        }
        ['padX', 'padY', 'icon'].forEach(function (kk) {
          if (s[kk] != null && s[kk] !== '') {
            var v = Math.round(Number(s[kk]));
            if (isFinite(v)) t[kk] = Math.max(0, Math.min(160, v));
          }
        });
        if (s.badge) t.badge = String(s.badge).slice(0, 10);
        if (String(s.hide) === '1') t.hide = '1';
        if (Object.keys(t).length) o[i] = t;
      });
      if (Object.keys(o).length && n < 12) { out[k] = o; n++; }
    });
    if (Object.keys(out).length) p.__rs = out; else delete p.__rs;
  }
  function safeUrl(u, fallback) {
    var s = String(u || '').trim();
    if (!s) return fallback || '#';
    // 浏览器解析 URL 前会忽略 tab/换行等控制字符，先压平再判协议，防 "java\nscript:" 绕过
    var flat = s.replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();
    if (/^(javascript|vbscript|data|file|blob):/.test(flat)) return fallback || '#';
    return s;
  }
  function safeImg(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    var flat = s.replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();
    if (/^(javascript|vbscript|file|blob):/.test(flat)) return '';
    if (/^data:/.test(flat) && !/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml|bmp)[;,]/.test(flat)) return '';
    return s;
  }

  /* ---------- 统一媒体：emoji 与图片共用一套入口 ----------
     值可以是 emoji 文本、图片网址、data:image，或 asset:<素材ID> 引用。
     引用在渲染时才展开成真实地址，导出的 HTML 因此仍是自包含的。 */
  function isMediaImage(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return false;
    if (/^asset:/i.test(s)) return true;
    if (/^(?:https?:)?\/\//i.test(s) || /^data:image\//i.test(s)) return true;
    if (/^[/.]/.test(s)) return true;
    return /\.(?:png|jpe?g|gif|webp|svg|avif|bmp|ico)(?:[?#]|$)/i.test(s);
  }
  function resolveMedia(v) {
    var s = String(v == null ? '' : v).trim();
    var m = /^asset:(.+)$/i.exec(s);
    if (m) {
      var hit = (state.assets || []).filter(function (a) { return a.id === m[1]; })[0];
      return hit ? safeImg(hit.src) : '';
    }
    return safeImg(s);
  }
  /* ---------- 视频：内置示例 / 素材引用 / 直链 ----------
     值可以是 builtin:<id>（media.js 里的示例）、asset:<素材ID>、https 直链或 data:video。
     safeVideo 只放行明确的视频来源，避免 script: 之类被塞进 src。 */
  function safeVideo(u) {
    var s = String(u == null ? '' : u).trim();
    if (!s) return '';
    // 只看开头一小段：data URI 后半截是几百 KB 的 base64，整串跑正则没有必要
    var head = s.slice(0, 64).replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();
    if (/^(javascript|vbscript|blob):/.test(head)) return '';
    if (/^data:/.test(head) && !/^data:video\/(mp4|webm|ogg)/.test(head)) return '';
    return s;
  }
  function builtinFilm(id) {
    var list = (typeof window !== 'undefined' && window.WR_MEDIA) || {};
    return list[id] || null;
  }
  /* 解析出可直接放进 src 的地址；拿不到就返回空串（渲染时显示封面） */
  function filmSrcOf(p) {
    var raw = String((p && p.filmSrc) || '').trim();
    var m = /^builtin:([\w-]+)$/.exec(raw);
    if (m) { var b = builtinFilm(m[1]); return b ? b.src : ''; }
    var a = /^asset:(.+)$/.exec(raw);
    if (a) {
      var hit = (state.assets || []).filter(function (x) { return x.id === a[1]; })[0];
      return hit ? safeVideo(hit.src) : '';
    }
    return safeVideo(raw);
  }
  /* 封面：内置示例自带 poster；其余用用户填的封面图 */
  function filmPosterOf(p) {
    var raw = String((p && p.filmSrc) || '').trim();
    var m = /^builtin:([\w-]+)$/.exec(raw);
    if (m) { var b = builtinFilm(m[1]); if (b && b.poster) return b.poster; }
    var cover = String((p && p.filmPoster) || '').trim();
    if (!cover || !isMediaImage(cover)) return '';
    return resolveMedia(cover);
  }
  /* 属性面板与选项列表用：内置示例清单 */
  function builtinFilmList() {
    var list = (typeof window !== 'undefined' && window.WR_MEDIA) || {};
    return Object.keys(list).map(function (k) { return { id: k, name: list[k].name || k }; });
  }
  /* 通用视频源解析：与 filmSrcOf 同理，但直接接收字段原始值（供设备样机 / 播放器复用） */
  function videoSrcOf(raw) {
    raw = String(raw == null ? '' : raw).trim();
    if (!raw) return '';
    var m = /^builtin:([\w-]+)$/.exec(raw);
    if (m) { var b = builtinFilm(m[1]); return b ? b.src : ''; }
    var a = /^asset:(.+)$/.exec(raw);
    if (a) {
      var hit = (state.assets || []).filter(function (x) { return x.id === a[1]; })[0];
      return hit ? safeVideo(hit.src) : '';
    }
    return safeVideo(raw);
  }
  /* 通用封面：内置示例自带 poster；否则用用户填的封面图 */
  function videoPosterOf(rawSrc, rawPoster) {
    var m = /^builtin:([\w-]+)$/.exec(String(rawSrc == null ? '' : rawSrc).trim());
    if (m) { var b = builtinFilm(m[1]); if (b && b.poster) return b.poster; }
    var cover = String(rawPoster == null ? '' : rawPoster).trim();
    if (!cover || !isMediaImage(cover)) return '';
    return resolveMedia(cover);
  }
  /* 音频地址安全校验：只放行明确的音频直链 / data:audio / asset */
  function safeAudio(u) {
    var s = String(u == null ? '' : u).trim();
    if (!s) return '';
    var a = /^asset:(.+)$/.exec(s);
    if (a) {
      var hit = (state.assets || []).filter(function (x) { return x.id === a[1]; })[0];
      s = hit ? hit.src : '';
    }
    if (!s) return '';
    var head = s.slice(0, 64).replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();
    if (/^(javascript|vbscript|blob):/.test(head)) return '';
    if (/^data:/.test(head) && !/^data:audio\/(mpeg|mp3|mp4|wav|ogg|webm|x-wav)/.test(head)) return '';
    return s;
  }

  /* 倒计时拆分：解析目标时间，返回 {d,h,m,s}；无有效时间或已过期返回 null */
  function countdownParts(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    // 兼容 "2027-01-01 00:00:00" / "2027/01/01" / 纯日期，Safari 对空格格式敏感，统一替换
    var norm = s.replace(/-/g, '/').replace('T', ' ');
    var t = Date.parse(norm);
    if (isNaN(t)) return null;
    var diff = t - Date.now();
    if (diff <= 0) return null;
    var sec = Math.floor(diff / 1000);
    return {
      d: Math.floor(sec / 86400),
      h: Math.floor(sec / 3600) % 24,
      m: Math.floor(sec / 60) % 60,
      s: sec % 60
    };
  }
  /* opts: size / font / inline / round / radius / fit / margin / cls / bg / alt / fallback */
  function mediaHTML(v, o) {
    o = o || {};
    var raw = String(v == null ? '' : v).trim();
    if (!raw) return '';
    var size = Number(o.size) || 40;
    var cls = 'wr-media' + (o.inline ? ' inline' : '') + (o.fit === 'contain' ? ' contain' : '') +
      (o.round ? ' round' : '') + (o.cls ? ' ' + o.cls : '');
    var box = esc(css({
      width: size + 'px', height: size + 'px',
      'border-radius': o.radius != null ? o.radius + 'px' : (o.round ? '50%' : ''),
      margin: o.margin || '',
      'font-size': (Number(o.font) || Math.round(size * 0.62)) + 'px',
      background: paint(o.bg)
    }));
    if (isMediaImage(raw)) {
      var src = resolveMedia(raw);
      if (!src) return '<span class="' + cls + '" style="' + box + '">' + esc(o.fallback || '') + '</span>';
      return '<span class="' + cls + ' has-img" style="' + box + '">' +
        '<img class="wr-media-img" src="' + esc(src) + '" alt="' + esc(o.alt || '') +
        '" loading="lazy" decoding="async"></span>';
    }
    return '<span class="' + cls + '" style="' + box + '">' + esc(raw) + '</span>';
  }
  /* 属性面板里的小缩略图 */
  function mediaPreview(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '<span class="media-thumb-empty">◇</span>';
    if (isMediaImage(s)) {
      var src = resolveMedia(s);
      return src ? '<img src="' + esc(src) + '" alt="">' : '<span class="media-thumb-empty">?</span>';
    }
    return '<span class="media-thumb-emoji">' + esc(s.slice(0, 4)) + '</span>';
  }
  var MEDIA_ROW_TPL = {
    items: ' | 标题 | 说明',
    featureItems: ' | 要点标题 | 简要说明',
    teamItems: ' | 姓名 | 职位 | 简介',
    galleryItems: ' | 图片说明',
    logoItems: ''
  };
  function pct(v) {
    var n = parseFloat(v);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }
  function gridCols(n, def) {
    return 'repeat(' + Math.max(1, Math.min(6, Number(n) || def || 3)) + ',1fr)';
  }
  /* ---------- 颜色与渐变 ----------
     纯色和渐变共用一个白名单：颜色函数只允许字母数字和少量符号，
     渐变额外要求括号配平、长度受限。凡是拼进 style 的颜色值都从这里过一遍。 */
  var COLOR_FN_RE = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|var)\([A-Za-z0-9#%.,\s\/+\-]*\)$/i;
  var GRADIENT_RE = /^(repeating-)?(linear|radial|conic)-gradient\(/i;
  function colorOk(s) {
    if (!s) return false;
    if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return true;
    if (/^[a-zA-Z]{3,20}$/.test(s)) return true;           // red / currentColor / transparent
    return COLOR_FN_RE.test(s);
  }
  function isGradient(v) { return GRADIENT_RE.test(String(v == null ? '' : v).trim()); }
  function gradientOk(s) {
    if (s.length > 420) return false;
    var depth = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')') { if (--depth < 0) return false; }
      else if (!/[A-Za-z0-9#%.,\s\/+\-]/.test(ch)) return false;
    }
    return depth === 0;
  }
  function safeColor(c) {
    var s = String(c == null ? '' : c).trim();
    return colorOk(s) ? s : '';
  }
  function safeCssColor(c, fb) {
    return safeColor(c) || fb || '#3b82f6';
  }
  /* 背景专用：允许纯色或渐变，非法值退回 fallback（传空串表示透明） */
  function safePaint(v, fb) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    if (isGradient(s)) return gradientOk(s) ? s : (fb || '');
    return safeColor(s) || (fb || '');
  }
  var paint = safePaint;
  /* 取色器只认 #rrggbb：从任意颜色 / 渐变里抽出第一个可用颜色 */
  function toHexColor(v) {
    var s = String(v == null ? '' : v).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    if (/^#[0-9a-fA-F]{8}$/.test(s)) return s.slice(0, 7);
    var m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(s);
    if (m) {
      return '#' + [m[1], m[2], m[3]].map(function (n) {
        return ('0' + Math.max(0, Math.min(255, parseInt(n, 10))).toString(16)).slice(-2);
      }).join('');
    }
    var first = (s.match(/#[0-9a-fA-F]{3,8}/) || [])[0];
    if (first) return toHexColor(first);
    return '#3b82f6';
  }
  function mixHex(hex, amt) {
    var h = toHexColor(hex).slice(1);
    var n = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
    return '#' + n.map(function (c) {
      var d = amt < 0 ? 0 : 255;
      var v = Math.round(c + (d - c) * Math.abs(amt));
      return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
    }).join('');
  }
  /* 解析渐变：拿到类型 / 角度 / 两个色标，供编辑器回填 */
  function parseGradient(v) {
    var s = String(v == null ? '' : v).trim();
    var type = /^repeating-?radial|^radial/i.test(s) ? 'radial'
      : (/^repeating-?conic|^conic/i.test(s) ? 'conic' : 'linear');
    var angle = 135;
    var am = /(-?\d+(?:\.\d+)?)deg/i.exec(s);
    if (am) angle = Math.round(((parseFloat(am[1]) % 360) + 360) % 360);
    else if (/to\s+right/i.test(s)) angle = 90;
    else if (/to\s+bottom/i.test(s)) angle = 180;
    else if (/to\s+left/i.test(s)) angle = 270;
    else if (/to\s+top/i.test(s)) angle = 0;
    var cols = s.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)/g) || [];
    var c1 = toHexColor(cols[0] || '#3b82f6');
    var c2 = toHexColor(cols[cols.length > 1 ? cols.length - 1 : 0] || mixHex(c1, -0.35));
    return { type: type, angle: angle, c1: c1, c2: c2 };
  }
  function gradientCSS(g) {
    if (g.type === 'radial') return 'radial-gradient(circle at 50% 50%,' + g.c1 + ' 0%,' + g.c2 + ' 100%)';
    if (g.type === 'conic') return 'conic-gradient(from ' + g.angle + 'deg,' + g.c1 + ' 0%,' + g.c2 + ' 100%)';
    return 'linear-gradient(' + g.angle + 'deg,' + g.c1 + ' 0%,' + g.c2 + ' 100%)';
  }
  var GRAD_PRESETS = [
    ['#3b82f6', '#8b5cf6'], ['#0ea5e9', '#22d3ee'], ['#f97316', '#ec4899'],
    ['#10b981', '#84cc16'], ['#facc15', '#fb923c'], ['#1e293b', '#64748b']
  ];
  /* 渐变编辑器展开状态：按「块:字段」记住，属性面板重绘后不闪回 */
  var gradOpen = {};
  /* 这些字段是文字色 / 边框色，CSS 不接受渐变，不开渐变开关 */
  var NO_GRAD_KEYS = { color: 1, btnColor: 1, boxBorderColor: 1, __text: 1,
    boxTextColor: 1, boxLinkColor: 1, boxAccent: 1,
    boxThemeLightBg: 1, boxThemeLightText: 1, boxThemeLightAccent: 1, boxThemeLightLink: 1,
    boxThemeDarkBg: 1, boxThemeDarkText: 1, boxThemeDarkAccent: 1, boxThemeDarkLink: 1 };
  function canGradient(k) { return !NO_GRAD_KEYS[k]; }

  /* ---------- 组件公共样式：编辑器画布与导出页面使用同一份 ---------- */
  function kebab(k) { return String(k).replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }); }
  /* 动效样式：悬停 / 常驻 / 进入动画 / 光标与进度条，导出与编辑器共用一份 */
  function fxCSS() {
    var out = [];
    /* 悬停 / 常驻动效：每条规则都带一个 .is-hover 变体，动效库的预览卡片用它在
       卡片自身悬停时也能演示效果（导出页里永远不会有这个类）。 */
    out.push('.wr-hover-lift,.wr-hover-lift-lg,.wr-hover-zoom,.wr-hover-glow,.wr-hover-shadow,.wr-hover-press,' +
      '.wr-hover-outline,.wr-hover-tilt,.wr-hover-tilt-glare,.wr-hover-magnet,.wr-hover-underline{' +
      'transition:transform .34s cubic-bezier(.22,1,.36,1),box-shadow .34s ease,outline-color .3s ease,filter .5s ease}');
    out.push('.wr-hover-wipe,.wr-hover-glitch,.wr-hover-glass,.wr-hover-arrow,.wr-hover-unblur{' +
      'transition:transform .4s cubic-bezier(.22,1,.36,1),box-shadow .35s ease,filter .5s ease}');
    out.push('.wr-hover-lift:hover,.wr-hover-lift.is-hover{transform:translateY(-6px)}');
    out.push('.wr-hover-lift-lg:hover,.wr-hover-lift-lg.is-hover{transform:translateY(-14px) scale(1.008)}');
    out.push('.wr-hover-zoom:hover,.wr-hover-zoom.is-hover{transform:scale(1.03)}');
    out.push('.wr-hover-glow:hover,.wr-hover-glow.is-hover{box-shadow:0 18px 46px -14px rgba(59,130,246,.55);box-shadow:0 18px 46px -14px color-mix(in srgb,var(--wr-accent,#3b82f6) 60%,transparent)}');
    out.push('.wr-hover-shadow:hover,.wr-hover-shadow.is-hover{box-shadow:0 26px 54px -22px rgba(16,32,64,.45)}');
    out.push('.wr-hover-press:active,.wr-hover-press.is-hover{transform:translateY(2px) scale(.984)}');
    out.push('.wr-hover-outline{outline:2px solid transparent;outline-offset:-2px}');
    out.push('.wr-hover-outline:hover,.wr-hover-outline.is-hover{outline-color:var(--wr-accent,#3b82f6)}');
    out.push('.wr-hover-tilt,.wr-hover-tilt-glare{will-change:transform;transform-style:preserve-3d}');
    out.push('.wr-hover-tilt-glare{position:relative}');
    out.push('.wr-hover-tilt-glare::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:3;' +
      'opacity:0;transition:opacity .35s ease;background:radial-gradient(280px circle at var(--wr-gx,50%) var(--wr-gy,50%),rgba(255,255,255,.55),rgba(255,255,255,.12) 44%,transparent 70%)}');
    out.push('.wr-hover-tilt-glare:hover::after,.wr-hover-tilt-glare.is-hover::after{opacity:1}');
    out.push('.wr-hover-magnet{will-change:transform}');
    out.push('.wr-hover-underline{position:relative}');
    out.push('.wr-hover-underline::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;z-index:2;pointer-events:none;' +
      'background:var(--wr-accent,#3b82f6);transform:scaleX(0);transform-origin:left center;transition:transform .34s cubic-bezier(.22,1,.36,1)}');
    out.push('.wr-hover-underline:hover::after,.wr-hover-underline.is-hover::after{transform:scaleX(1)}');
    out.push('.wr-hover-imgzoom{overflow:hidden}');
    out.push('.wr-hover-imgzoom img{transition:transform .6s cubic-bezier(.22,1,.36,1)}');
    out.push('.wr-hover-imgzoom:hover img,.wr-hover-imgzoom.is-hover img{transform:scale(1.08)}');
    out.push('.wr-hover-saturate img{filter:grayscale(.9) saturate(.6) brightness(.97);transition:filter .55s ease}');
    out.push('.wr-hover-saturate:hover img,.wr-hover-saturate.is-hover img{filter:none}');
    /* 流光描边：conic 渐变 + mask 只留 1.5px 边框；不支持 @property 时是静态渐变（不报错、不闪） */
    out.push('@property --wr-beam{syntax:"<angle>";inherits:false;initial-value:0deg}');
    out.push('@keyframes wrBeamSpin{to{--wr-beam:360deg}}');
    out.push('.wr-hover-border{position:relative}');
    out.push('.wr-hover-border::before,.wr-loop-beam::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:2;' +
      'background:conic-gradient(from var(--wr-beam,0deg),transparent 0 56%,var(--wr-accent,#3b82f6) 74%,#a78bfa 82%,transparent 90%);' +
      '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;' +
      'mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;animation:wrBeamSpin 3.4s linear infinite}');
    out.push('.wr-hover-border::before{opacity:0;transition:opacity .3s ease}');
    out.push('.wr-hover-border:hover::before,.wr-hover-border.is-hover::before{opacity:1}');
    out.push('.wr-hover-shine{position:relative;overflow:hidden;isolation:isolate}');
    out.push('.wr-hover-shine::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:35%;pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg);opacity:0}');
    out.push('.wr-hover-shine:hover::after,.wr-hover-shine.is-hover::after{animation:wrSweep .9s ease}');
    out.push('.wr-hover-spot{position:relative;overflow:hidden}');
    out.push('.wr-hover-spot::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .35s ease;background:radial-gradient(260px circle at var(--wr-mx,50%) var(--wr-my,50%),rgba(59,130,246,.22),transparent 68%)}');
    out.push('.wr-hover-spot:hover::after,.wr-hover-spot.is-hover::after{opacity:1}');
    /* Awwwards 风格：遮罩揭示、故障抖动、毛玻璃、箭头、图片去模糊 */
    out.push('.wr-hover-wipe{position:relative;overflow:hidden;isolation:isolate}');
    out.push('.wr-hover-wipe::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;mix-blend-mode:soft-light;' +
      'background:linear-gradient(100deg,color-mix(in srgb,var(--wr-accent,#3b82f6) 32%,transparent),transparent 70%);' +
      'transform:scaleX(0);transform-origin:left center;transition:transform .46s cubic-bezier(.22,1,.36,1)}');
    out.push('.wr-hover-wipe:hover::after,.wr-hover-wipe.is-hover::after{transform:scaleX(1)}');
    out.push('.wr-hover-glitch:hover,.wr-hover-glitch.is-hover{animation:wrGlitchShake .46s steps(2,end) 1}');
    out.push('@keyframes wrGlitchShake{0%{transform:translate(0)}20%{transform:translate(-2px,1px);filter:drop-shadow(2px 0 rgba(255,80,120,.75))}' +
      '40%{transform:translate(2px,-1px);filter:drop-shadow(-2px 0 rgba(80,200,255,.75))}' +
      '60%{transform:translate(-1px,0)}80%{transform:translate(1px,1px)}100%{transform:none;filter:none}}');
    out.push('.wr-hover-glass{backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}');
    out.push('.wr-hover-glass:hover,.wr-hover-glass.is-hover{box-shadow:inset 0 0 0 1px rgba(255,255,255,.5),0 18px 42px -24px rgba(20,40,80,.55);transform:translateY(-3px)}');
    out.push('.wr-hover-arrow{position:relative}');
    out.push('.wr-hover-arrow::after{content:"→";position:absolute;right:14px;top:50%;transform:translateY(-50%);' +
      'pointer-events:none;transition:transform .3s cubic-bezier(.22,1,.36,1);opacity:.75}');
    out.push('.wr-hover-arrow:hover::after,.wr-hover-arrow.is-hover::after{transform:translate(6px,-50%)}');
    out.push('.wr-hover-unblur img{filter:blur(5px);transition:filter .55s ease}');
    out.push('.wr-hover-unblur:hover img,.wr-hover-unblur.is-hover img{filter:none}');
    out.push('.wr-hover-flip3d{transform-style:preserve-3d;transition:transform .7s cubic-bezier(.22,1,.36,1)}');
    out.push('.wr-hover-flip3d:hover,.wr-hover-flip3d.is-hover{transform:perspective(900px) rotateY(180deg)}');
    out.push('.wr-hover-zoomblur img{filter:blur(4px);transform:scale(1.04);transition:filter .5s ease,transform .6s cubic-bezier(.22,1,.36,1)}');
    out.push('.wr-hover-zoomblur:hover img,.wr-hover-zoomblur.is-hover img{filter:none;transform:scale(1)}');
    out.push('.wr-loop-orbit{animation:wrLoopOrbit 9s ease-in-out infinite}');
    out.push('@keyframes wrLoopOrbit{0%,100%{transform:rotate(-1.5deg) translateY(0)}50%{transform:rotate(1.5deg) translateY(-8px)}}');
    out.push('.wr-loop-rgbshift{animation:wrRGBShift 2.8s steps(2,end) infinite}');
    out.push('@keyframes wrRGBShift{0%,82%,100%{text-shadow:none;filter:none}' +
      '86%{text-shadow:2px 0 rgba(255,60,120,.75),-2px 0 rgba(60,220,255,.75)}' +
      '90%{text-shadow:-2px 0 rgba(255,60,120,.6),2px 0 rgba(60,220,255,.6)}' +
      '94%{text-shadow:1px 0 rgba(255,60,120,.45),-1px 0 rgba(60,220,255,.45)}}');
    out.push('.wr-loop-float{animation:wrFloat 5.5s ease-in-out infinite}');
    out.push('.wr-loop-pulse{animation:wrPulse 3.2s ease-in-out infinite}');
    out.push('.wr-loop-breathe{animation:wrBreathe 4s ease-in-out infinite}');
    out.push('.wr-loop-sway{animation:wrSway 6.4s ease-in-out infinite}');
    out.push('.wr-loop-beam{position:relative}');
    out.push('.wr-loop-ring{position:relative}');
    out.push('.wr-loop-ring::after{content:"";position:absolute;inset:-2px;border-radius:inherit;border:1.5px solid var(--wr-accent,#3b82f6);pointer-events:none;' +
      'opacity:0;animation:wrRingPulse 3s ease-out infinite}');
    out.push('.wr-loop-gradient{position:relative;overflow:hidden}');
    out.push('.wr-loop-gradient::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;' +
      'background:linear-gradient(118deg,rgba(59,130,246,.34),rgba(139,92,246,.3),rgba(236,72,153,.26),rgba(59,130,246,.34));' +
      'background-size:320% 320%;mix-blend-mode:soft-light;animation:wrGradFlow 9s ease-in-out infinite}');
    out.push('.wr-loop-shine{position:relative;overflow:hidden}');
    out.push('.wr-loop-shine::before{content:"";position:absolute;top:0;bottom:0;left:-40%;width:30%;pointer-events:none;z-index:1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-18deg);animation:wrLoopSweep 4.5s ease-in-out infinite}');
    /* 跑马灯 / 在线呼吸点 / 骨架微光 */
    out.push('.wr-loop-marquee{animation:wrLoopMarquee 12s ease-in-out infinite alternate}');
    out.push('@keyframes wrLoopMarquee{from{transform:translateX(0)}to{transform:translateX(-6%)}}');
    out.push('.wr-loop-blink{position:relative}');
    out.push('.wr-loop-blink::before{content:"";position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%;' +
      'background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:wrOnlineBlink 1.9s ease-out infinite;z-index:3}');
    out.push('@keyframes wrOnlineBlink{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55);opacity:1}70%{box-shadow:0 0 0 9px rgba(34,197,94,0);opacity:.8}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);opacity:1}}');
    out.push('.wr-loop-shimmer{position:relative;overflow:hidden}');
    out.push('.wr-loop-shimmer::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;' +
      'background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.42) 50%,transparent 80%);' +
      'background-size:220% 100%;animation:wrShimmer 2.8s linear infinite}');
    out.push('@keyframes wrShimmer{from{background-position:120% 0}to{background-position:-120% 0}}');
    /* 金属光泽文字：只刷标题和数字，正文保持原色。
       色标以 currentColor 为基准调亮/调暗，深色底和浅色底都不会丢对比度；
       不支持 color-mix 的浏览器整条降级为普通文字，不会出现「透明看不见」。 */
    out.push('@supports (background:color-mix(in srgb,red 50%,blue)){' +
      '.wr-loop-metal h1,.wr-loop-metal h2,.wr-loop-metal h3,.wr-loop-metal b,.wr-loop-metal [data-count]{' +
      'background-image:linear-gradient(100deg,' +
      'color-mix(in srgb,currentColor 74%,#000) 0%,' +
      'color-mix(in srgb,currentColor 54%,#fff) 14%,' +
      'color-mix(in srgb,currentColor 52%,#fff) 23%,' +
      'color-mix(in srgb,currentColor 82%,#000) 39%,' +
      'color-mix(in srgb,currentColor 74%,#000) 51%,' +
      'color-mix(in srgb,currentColor 50%,#fff) 70%,' +
      'color-mix(in srgb,currentColor 48%,#fff) 81%,' +
      'color-mix(in srgb,currentColor 74%,#000) 100%);' +
      'background-size:260% 100%;background-repeat:no-repeat;' +
      '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;' +
      'animation:wrMetal 6s linear infinite}}');
    /* 方向感知划入：JS 从指针进来的一侧给一个反向位移，再顺滑归位（WAAPI，不抢 CSS 的 transform） */
    out.push('.wr-hover-dir{will-change:transform}');
    /* 动效库预览里没有导出页的指针脚本，用 .is-hover 做一个「从左滑入」的近似演示 */
    out.push('.wr-hover-dir.is-hover{animation:wrDirIn .52s cubic-bezier(.22,1,.36,1)}');
    out.push('@keyframes wrDirIn{from{transform:translate3d(-14px,0,0);opacity:.86}to{transform:none;opacity:1}}');
    out.push('@keyframes wrMetal{0%{background-position:0% 50%}100%{background-position:260% 50%}}');
    out.push('.wr-type-cursor{display:inline-block;width:2px;height:.92em;margin-left:3px;vertical-align:-.1em;background:currentColor;animation:wrCaret 1s steps(1) infinite}');
    out.push('@keyframes wrCaret{0%,49%{opacity:1}50%,100%{opacity:0}}');
    out.push('@keyframes wrFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}');
    out.push('@keyframes wrPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}');
    out.push('@keyframes wrBreathe{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,.26)}50%{box-shadow:0 0 34px 6px rgba(59,130,246,.2)}}');
    out.push('@keyframes wrSway{0%,100%{transform:rotate(-.7deg)}50%{transform:rotate(.7deg)}}');
    out.push('@keyframes wrRingPulse{0%{transform:scale(.985);opacity:.55}70%{transform:scale(1.05);opacity:0}100%{transform:scale(1.05);opacity:0}}');
    out.push('@keyframes wrGradFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}');
    out.push('@keyframes wrSweep{0%{left:-40%;opacity:0}25%{opacity:1}100%{left:120%;opacity:0}}');
    out.push('@keyframes wrLoopSweep{0%{left:-40%;opacity:0}14%{opacity:.9}56%,100%{left:120%;opacity:0}}');
    // 进入动画：只有加了 .wr-js（脚本成功执行）的元素才会先隐藏，降级时内容照常可见。
    // 默认只在系统未要求「减少动效」时生效；页面里选「不尊重」时脚本会给 html 加
    // .wr-force，用同一套规则强制播动画。
    function entRules(sel) {
      var out = [sel + ' [data-anim]{transition-property:opacity,transform,filter,clip-path;' +
        'transition-duration:var(--wr-adur,.7s);transition-timing-function:var(--wr-aease,cubic-bezier(.22,1,.36,1));' +
        'transition-delay:var(--wr-adelay,0ms)}'];
      Object.keys(ANIM).forEach(function (k) {
        if (k === 'none') return;
        var f = ANIM[k].build('var(--wr-adist,28px)');
        out.push(sel + ' [data-anim="' + k + '"]:not(.wr-in){' +
          Object.keys(f).map(function (p) { return kebab(p) + ':' + f[p]; }).join(';') + '}');
      });
      return out.join('');
    }
    out.push('@media(prefers-reduced-motion:no-preference){' + entRules('.wr-js') + '}');
    out.push(entRules('.wr-force'));
    out.push('@media(prefers-reduced-motion:reduce){.wr-js:not(.wr-force) .wr-loop-float,.wr-js:not(.wr-force) .wr-loop-pulse,.wr-js:not(.wr-force) .wr-loop-breathe,.wr-js:not(.wr-force) .wr-loop-shine::before,.wr-js:not(.wr-force) .wr-loop-beam::before,.wr-js:not(.wr-force) .wr-loop-gradient::before,.wr-js:not(.wr-force) .wr-loop-sway,.wr-js:not(.wr-force) .wr-loop-ring::after,.wr-js:not(.wr-force) .wr-loop-marquee,.wr-js:not(.wr-force) .wr-loop-blink::before,.wr-js:not(.wr-force) .wr-loop-shimmer::after,.wr-js:not(.wr-force) .wr-loop-orbit,.wr-js:not(.wr-force) .wr-loop-rgbshift,.wr-js:not(.wr-force) .wr-loop-metal h1,.wr-js:not(.wr-force) .wr-loop-metal h2,.wr-js:not(.wr-force) .wr-loop-metal h3,.wr-js:not(.wr-force) .wr-loop-metal [data-count],.wr-js:not(.wr-force) .wr-brand-track,.wr-js:not(.wr-force) .wr-shape,.wr-js:not(.wr-force) .wr-orbit i,.wr-js:not(.wr-force) .wr-wave i,.wr-js:not(.wr-force) .wr-kticker,.wr-js:not(.wr-force) .wr-cube,.wr-js:not(.wr-force) .wr-pyramid,.wr-js:not(.wr-force) .wr-sphere3d,.wr-js:not(.wr-force) .wr-ring3d,.wr-js:not(.wr-force) .wr-object3d[data-tilt="1"] .wr-obj-stage{animation:none!important}}');
    out.push('.wr-magnet{transition:transform .25s cubic-bezier(.22,1,.36,1);will-change:transform}');
    // 页面级：滚动进度条 / 回到顶部 / 光标光晕 / 跟随光标
    out.push('.wr-progress{position:fixed;left:0;top:0;height:3px;width:0;z-index:9999;pointer-events:none;background:linear-gradient(90deg,var(--wr-accent,#3b82f6),#8b5cf6);box-shadow:0 0 14px rgba(59,130,246,.45);transition:width .1s linear}');
    out.push('.wr-top{position:fixed;right:22px;bottom:22px;width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:50%;padding:0;background:var(--wr-accent,#3b82f6);color:#fff;font-size:17px;cursor:pointer;box-shadow:0 12px 30px rgba(20,40,80,.3);opacity:0;transform:translateY(14px);pointer-events:none;transition:opacity .3s,transform .3s;z-index:9998}');
    out.push('.wr-top.is-on{opacity:1;transform:none;pointer-events:auto}');
    out.push('.wr-glow{position:fixed;left:0;top:0;width:460px;height:460px;margin:-230px 0 0 -230px;border-radius:50%;pointer-events:none;z-index:9997;mix-blend-mode:screen;background:radial-gradient(circle,rgba(59,130,246,.2),rgba(139,92,246,.08) 45%,transparent 68%);opacity:0;transition:opacity .5s;will-change:transform}');
    out.push('.wr-ring,.wr-dot{position:fixed;left:0;top:0;pointer-events:none;z-index:9999;border-radius:50%;opacity:0;transition:opacity .3s,width .22s,height .22s,margin .22s}');
    out.push('.wr-ring{width:28px;height:28px;margin:-14px 0 0 -14px;border:1.5px solid var(--wr-accent,#3b82f6);transform:translate3d(-100px,-100px,0)}');
    out.push('.wr-dot{width:7px;height:7px;margin:-3.5px 0 0 -3.5px;background:var(--wr-accent,#3b82f6);transform:translate3d(-100px,-100px,0)}');
    out.push('.wr-ring.is-hot{width:44px;height:44px;margin:-22px 0 0 -22px;opacity:.55}');
    // 页面级：聚光灯 / 波纹 / 拖尾 / 转场幕 / 吸顶导航滚动阴影 / 视差
    out.push('.wr-spot{position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;transition:opacity .6s ease;mix-blend-mode:soft-light;' +
      'background:radial-gradient(620px circle at var(--wr-sx,50%) var(--wr-sy,50%),rgba(59,130,246,.62),rgba(139,92,246,.3) 46%,transparent 72%)}');
    out.push('.wr-spot.is-on{opacity:.9}');
    out.push('.wr-sticky-nav{transition:box-shadow .3s ease}');
    out.push('.wr-sticky-nav.is-scrolled{box-shadow:0 12px 30px -14px rgba(16,32,64,.38)}');
    out.push('.wr-ripple{position:absolute;border-radius:50%;pointer-events:none;background:currentColor;opacity:.3;transform:scale(0);animation:wrRipple .62s ease-out forwards}');
    out.push('@keyframes wrRipple{to{transform:scale(2.6);opacity:0}}');
    out.push('.wr-trail{position:fixed;left:0;top:0;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;pointer-events:none;z-index:9996;' +
      'background:var(--wr-accent,#3b82f6);opacity:0;animation:wrTrailFade .72s ease-out forwards;will-change:transform,opacity}');
    out.push('@keyframes wrTrailFade{from{scale:1;opacity:.55}to{scale:.15;opacity:0}}');
    out.push('.wr-veil{position:fixed;inset:0;z-index:2147482900;pointer-events:none;background:var(--wr-accent,#3b82f6);' +
      'transform:translateY(-101%);transition:transform .48s cubic-bezier(.76,0,.24,1)}');
    out.push('.wr-veil.is-in{transform:none}');
    out.push('.wr-par{will-change:transform}');
    /* 页面颗粒质感：Awwwards 常用的低透明度噪点层，纯 CSS 不依赖图片文件 */
    out.push('.wr-grain{position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:.23;mix-blend-mode:soft-light;' +
      'background-image:url(data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%22.82%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%22.5%22/%3E%3C/svg%3E)}');
    out.push('@media(hover:none){.wr-glow,.wr-ring,.wr-dot,.wr-spot,.wr-trail{display:none}}');
    out.push('@media print{.wr-progress,.wr-top,.wr-glow,.wr-ring,.wr-dot,.wr-spot,.wr-trail,.wr-veil,.wr-grain{display:none}}');
    return out;
  }
  /* 开场幕与滚动提示的样式（导出与编辑器共用一份） */
  function introCSS() {
    return [
      '.wr-splash{position:fixed;inset:0;z-index:2147483000;display:none;flex-direction:column;align-items:center;justify-content:center;padding:28px;text-align:center;' +
        'clip-path:inset(0);background:var(--wr-intro-bg,#3b82f6);' +
        'transition:opacity .6s ease,transform .85s cubic-bezier(.22,1,.36,1),clip-path .85s cubic-bezier(.22,1,.36,1)}',
      'html.wr-intro,html.wr-intro body{overflow:hidden!important}',
      'html.wr-intro .wr-splash{display:flex}',
      '.wr-splash.is-out{opacity:0;pointer-events:none}',
      '.wr-splash[data-style="splash"].is-out{transform:scale(1.045)}',
      '.wr-splash[data-style="veil"].is-out{clip-path:inset(50% 0 50% 0)}',
      '.wr-splash-mark{display:grid;place-items:center;width:66px;height:66px;border-radius:20px;font-size:27px;font-weight:800;line-height:1;' +
        'background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.28),0 16px 38px rgba(6,14,30,.22)}',
      '.wr-splash-name{margin-top:20px;font-size:21px;font-weight:700;letter-spacing:.16em}',
      '.wr-splash-sub{margin-top:9px;font-size:12.5px;letter-spacing:.1em;opacity:.68}',
      '.wr-splash-bar{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.22);overflow:hidden}',
      '.wr-splash-bar i{display:block;height:100%;width:0;background:currentColor;opacity:.9}',
      'html.wr-intro .wr-splash-mark{animation:wrSplashMark .9s cubic-bezier(.22,1,.36,1) both}',
      'html.wr-intro .wr-splash-name{animation:wrSplashUp .9s cubic-bezier(.22,1,.36,1) .1s both}',
      'html.wr-intro .wr-splash-sub{animation:wrSplashUp .9s cubic-bezier(.22,1,.36,1) .2s both}',
      'html.wr-intro .wr-splash-cta{animation:wrSplashUp .9s cubic-bezier(.22,1,.36,1) .26s both}',
      'html.wr-intro .wr-splash-bar i{animation:wrSplashBar var(--wr-intro-dur,2000ms) linear forwards}',
      '@keyframes wrSplashMark{from{opacity:0;transform:translateY(16px) scale(.88)}to{opacity:1;transform:none}}',
      '@keyframes wrSplashUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
      '@keyframes wrSplashBar{from{width:0}to{width:100%}}',
      /* 伪光标：从右下角滑到按钮上，按下再抬起 */
      '.wr-splash-cta{position:relative;display:none;margin-top:28px}',
      '.wr-splash[data-style="cursor"] .wr-splash-cta,.wr-splash[data-style="film"] .wr-splash-cta{display:block}',
      '.wr-splash-enter{display:inline-flex;align-items:center;justify-content:center;padding:12px 26px;border:0;border-radius:999px;background:#fff;color:#16233a;' +
        'font-size:14px;font-weight:700;letter-spacing:.06em;cursor:pointer;box-shadow:0 12px 30px rgba(6,14,30,.22)}',
      '.wr-splash-cursor{position:absolute;left:calc(50% + 22px);top:calc(50% + 6px);width:26px;height:26px;pointer-events:none;opacity:0;' +
        'filter:drop-shadow(0 6px 12px rgba(6,14,30,.28))}',
      '.wr-splash-cursor svg{display:block;width:100%;height:100%}',
      'html.wr-intro .wr-splash[data-style="cursor"] .wr-splash-cursor,' +
        'html.wr-intro .wr-splash[data-style="film"] .wr-splash-cursor{animation:wrSplashCursor var(--wr-intro-dur,2000ms) cubic-bezier(.3,.6,.3,1) both}',
      '@keyframes wrSplashCursor{0%{opacity:0;transform:translate(32vw,26vh) scale(.94)}10%{opacity:1}' +
        '44%{opacity:1;transform:translate(0,0) scale(1)}51%{transform:translate(0,0) scale(.8)}58%{transform:translate(0,0) scale(1)}100%{opacity:1;transform:translate(0,0) scale(1)}}',
      '.wr-splash-ripple{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;' +
        'border:2px solid rgba(10,20,40,.22);opacity:0;pointer-events:none}',
      'html.wr-intro .wr-splash[data-style="cursor"] .wr-splash-ripple,' +
        'html.wr-intro .wr-splash[data-style="film"] .wr-splash-ripple{animation:wrSplashRipple var(--wr-intro-dur,2000ms) ease-out both}',
      '@keyframes wrSplashRipple{0%,46%{opacity:0;transform:scale(.35)}54%{opacity:.9;transform:scale(.6)}100%{opacity:0;transform:scale(2.6)}}',
      /* 滚动提示：滚轮图标 + 滚轮线（由真实滚动驱动，不自播） */
      /* 图标和文字收进同一枚胶囊，整块有底，压在正文上也不会串色 */
      '.wr-scrollhint{position:fixed;left:50%;bottom:5.5vh;z-index:9000;display:inline-flex;flex-direction:row;align-items:center;gap:9px;' +
        'padding:8px 15px 8px 12px;border-radius:999px;box-sizing:border-box;min-height:44px;' +
        'background:var(--wr-hint-bg,rgba(255,255,255,.74));border:1px solid var(--wr-hint-bd,rgba(12,22,40,.14));' +
        'box-shadow:0 6px 22px -10px rgba(10,20,40,.34);' +
        'backdrop-filter:blur(12px) saturate(1.3);-webkit-backdrop-filter:blur(12px) saturate(1.3);' +
        'transform:translateX(-50%);color:var(--wr-hint,#16233a);text-decoration:none;font-size:12px;letter-spacing:.22em;opacity:.92;' +
        'transition:opacity .5s ease,transform .5s ease}',
      '.wr-scrollhint.is-gone{opacity:0;transform:translate(-50%,10px);pointer-events:none}',
      '.wr-scrollhint-t{white-space:nowrap;padding-right:.22em}',   /* 补掉尾字的字距空档 */
      '.wr-scrollhint-t:empty{display:none}',
      /* 图标再收小一圈，配胶囊的比例更合适 */
      '.wr-scrollhint .wr-mouse{width:19px;height:30px;border-radius:10px}',
      '.wr-scrollhint .wr-mouse i{top:5px;height:7px}',
      '.wr-scrollhint .wr-hintarrow{width:19px;height:19px}',
      /* 不支持背景模糊的浏览器：换成接近实色的底，照样压得住 */
      '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){' +
        '.wr-scrollhint{background:var(--wr-hint-veil,rgba(255,255,255,.95))}}',
      '.wr-mouse{position:relative;display:block;width:24px;height:38px;border:1.5px solid currentColor;border-radius:13px}',
      /* 滚轮线不再自播：由脚本按真实滚动量推动，停下来再回弹 */
      '.wr-mouse i{position:absolute;left:50%;top:7px;width:2px;height:9px;margin-left:-1px;border-radius:2px;background:currentColor;' +
        'opacity:.85;transform:translateY(0);transition:transform .48s cubic-bezier(.22,1,.36,1),opacity .3s ease;will-change:transform}',
      '.wr-mouse i.is-live{transition:none}',
      '.wr-hintarrow{display:block;width:24px;height:24px;animation:wrHintBob 1.7s ease-in-out infinite}',
      '@keyframes wrHintBob{0%,100%{transform:translateY(-2px);opacity:.6}50%{transform:translateY(5px);opacity:1}}',
      /* 跟滚动走：把自播动画全部关掉，光标的位移/按压、涟漪、进度条都改成脚本按进度画 */
      'html.wr-intro .wr-splash[data-drive="scroll"] .wr-splash-cursor,' +
        'html.wr-intro .wr-splash[data-drive="scroll"] .wr-splash-ripple{animation:none}',
      'html.wr-intro .wr-splash[data-drive="scroll"] .wr-splash-bar i{animation:none;width:0}',
      'html.wr-intro .wr-splash[data-drive="scroll"] .wr-splash-mark,' +
        'html.wr-intro .wr-splash[data-drive="scroll"] .wr-splash-name,' +
        'html.wr-intro .wr-splash[data-drive="scroll"] .wr-splash-sub,' +
        'html.wr-intro .wr-splash[data-drive="scroll"] .wr-splash-cta{animation:wrSplashUp .8s cubic-bezier(.22,1,.36,1) both}',
      /* 幕上的操作提示：一枚小胶囊，带滚轮图标；进度走完自己消失 */
      '.wr-splash-tip{position:absolute;left:50%;bottom:30px;transform:translateX(-50%);z-index:4;display:inline-flex;align-items:center;gap:8px;' +
        'padding:6px 14px 6px 10px;border-radius:999px;font-size:11.5px;letter-spacing:.18em;line-height:1;' +
        'background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.26);color:inherit;opacity:.72;' +
        'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;transition:opacity .35s ease}',
      '.wr-splash-tip .wr-mouse{width:15px;height:24px;border-radius:8px;border-width:1.2px;opacity:.8}',
      '.wr-splash-tip .wr-mouse i{top:4px;height:6px;width:1.6px;margin-left:-.8px;animation:none}',
      '.wr-splash[data-drive="scroll"] .wr-splash-tip.is-gone{opacity:0}',
      /* 视频揭幕：整屏放片子，文案与按钮压到下缘，中间整块留给画面 */
      '.wr-splash[data-style="film"]{padding:0;background:#05070c;align-items:stretch;justify-content:flex-end}',
      '.wr-splash[data-style="film"] .wr-splash-v{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:0;' +
        'background:#05070c;pointer-events:none}',
      '.wr-splash-vnone{display:block}',
      '.wr-splash-scrim{position:absolute;inset:0;z-index:1;pointer-events:none;' +
        'background:linear-gradient(180deg,rgba(4,6,10,.55),rgba(4,6,10,0) 24%,rgba(4,6,10,0) 58%,rgba(4,6,10,.86)),' +
        'radial-gradient(135% 95% at 50% 50%,rgba(0,0,0,0),rgba(0,0,0,.34) 100%)}',
      '.wr-splash-hero{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;' +
        'text-align:center;padding:0 24px;max-width:min(92vw,720px)}',
      '.wr-splash[data-style="film"] .wr-splash-hero{position:absolute;left:0;right:0;bottom:0;z-index:3;max-width:none;' +
        'flex-direction:row;align-items:flex-end;justify-content:space-between;gap:18px;' +
        'padding:26px 32px calc(26px + env(safe-area-inset-bottom,0px));text-align:left}',
      '.wr-splash-brand{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.wr-splash[data-style="film"] .wr-splash-name{margin:0;font-size:15px;font-weight:700;letter-spacing:.3em;' +
        'text-transform:uppercase;text-shadow:0 2px 18px rgba(0,0,0,.72)}',
      '.wr-splash[data-style="film"] .wr-splash-sub{margin:0;font-size:11.5px;letter-spacing:.16em;opacity:.62;' +
        'text-shadow:0 2px 14px rgba(0,0,0,.72)}',
      '.wr-splash[data-style="film"] .wr-splash-cta{margin:0;flex-shrink:0}',
      '.wr-splash[data-style="film"] .wr-splash-enter{padding:10px 22px;font-size:12.5px;font-weight:600;' +
        'background:rgba(255,255,255,.10);color:#fff;border:1px solid rgba(255,255,255,.46);' +
        'box-shadow:0 10px 26px rgba(2,6,14,.34);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}',
      /* 视频幕的提示挪到顶部，不压文案 */
      '.wr-splash[data-style="film"] .wr-splash-tip{top:18px;bottom:auto}',
      /* 片子上那条 2px 的进度线在暗背景里几乎看不见，单独调亮加粗 */
      '.wr-splash[data-style="film"] .wr-splash-bar{height:3px;background:rgba(255,255,255,.16)}',
      '.wr-splash[data-style="film"] .wr-splash-bar i{background:#fff;box-shadow:0 0 14px rgba(255,255,255,.5)}',
      '@media (max-width:640px){.wr-splash[data-style="film"] .wr-splash-hero{flex-direction:column;' +
        'align-items:flex-start;gap:14px;padding:20px 20px calc(20px + env(safe-area-inset-bottom,0px))}' +
        '.wr-splash[data-style="film"] .wr-splash-name{font-size:13px}}',
      '@media print{.wr-splash,.wr-scrollhint{display:none!important}}'
    ];
  }
  /* 单个条目的独立样式：按模块 ID + 列表字段 + 第几条命中，用 !important 盖过行内样式。
     编辑器和导出页读的是同一份 CSS，所以两边长得一模一样。 */
  function rowStyleCSS() {
    var out = [];
    // 少数容器里条目前面还夹着一个标题之类的元素，索引要往后挪几位
    var ROW_SKIP = { 'footer:footerLinks': 1, 'wiki:wikiInfobox': 1, 'wiki:wikiToc': 1, 'chat:chatMembers': 3, 'table:tableData': -1 };
    function walk(list) {
      (list || []).forEach(function (b) {
        var rs = b && b.p && b.p.__rs;
        if (rs && b.id) {
          Object.keys(rs).forEach(function (key) {
            var skip = ROW_SKIP[b.type + ':' + key] || 0;
            Object.keys(rs[key]).forEach(function (i) {
              var s = rs[key][i];
              var n = Number(i) + 1 + skip;
              if (!(n > 0)) return;
              var base = '[data-wr-id="' + b.id + '"] [data-wr-list="' + key + '"]>*:nth-child(' + n + ')';
              var d = [];
              if (s.bg) d.push('background:' + s.bg + '!important');
              if (s.color) d.push('color:' + s.color + '!important');
              if (s.radius != null) d.push('border-radius:' + s.radius + 'px!important');
              if (s.padX != null) d.push('padding-left:' + s.padX + 'px!important', 'padding-right:' + s.padX + 'px!important');
              if (s.padY != null) d.push('padding-top:' + s.padY + 'px!important', 'padding-bottom:' + s.padY + 'px!important');
              if (s.hide === '1') d.push('display:none!important');
              if (d.length) out.push(base + '{' + d.join(';') + '}');
              // 文字色要连带子标题 / 正文一起变，但按钮和链接保留自己的配色
              if (s.color) out.push(base + ' *:not(a):not(button){color:' + s.color + '!important}');
              if (s.icon != null) {
                out.push(base + ' .wr-media{width:' + s.icon + 'px!important;height:' + s.icon + 'px!important;' +
                  'font-size:' + Math.round(s.icon * 0.66) + 'px!important}');
              }
              if (s.badge) {
                var txt = String(s.badge).replace(/[\r\n"\\<>]/g, ' ').slice(0, 10);
                var bc = s.badgeColor || 'var(--wr-accent,#3b82f6)';
                if (txt.trim()) {
                  out.push(base + '{position:relative}');
                  out.push(base + '::after{content:"' + txt + '";position:absolute;top:0;right:0;' +
                    'transform:translate(30%,-45%);background:' + bc + ';color:#fff;font-size:11px;' +
                    'font-weight:700;line-height:1;padding:5px 8px;border-radius:999px;' +
                    'white-space:nowrap;z-index:4;box-shadow:0 3px 10px rgba(20,40,80,.18)}');
                }
              }
            });
          });
        }
        if (b && b.children) walk(b.children);
      });
    }
    try { walk(state && state.blocks); } catch (e) { }
    return out.length ? '/* 列表条目的独立样式 */\n' + out.join('\n') : '';
  }
  function componentCSS(withEditor) {
    var dp = darkPalette();
    /* 深色下的主题样式规则：导出页看 html.wr-dark，画布的「深色预览」看 .canvas.is-dark-preview。
       选择器可能是逗号分隔的一组，逐个补作用域，否则后面的选择器会漏到浅色模式。 */
    function thDark(sel, decl) {
      return sel.split(',').map(function (s) {
        s = s.trim();
        return 'html.wr-dark .wr-page ' + s + ',.canvas.is-dark-preview ' + s;
      }).join(',') + '{' + decl + '}';
    }
    var base = [
      ':root{--wr-accent:' + safePaint(state.page.accent, '#3b82f6') + '}',
      /* ===== 通用增强属性：模块配色 / 整块链接 / 打印 ===== */
      // 模块文字色：用 !important 盖过组件写死的行内 color，但保留按钮 / 链接自身配色
      '.wr-mod-ink,.wr-mod-ink *:not(a):not(button){color:var(--wr-mod-ink)!important}',
      // 模块链接色
      '.wr-mod-links a{color:var(--wr-mod-link)!important}',
      /* 导航栏内部还有一层自绘底色：模块选了主题样式后让它透出 section 的底色，
         否则换什么角色都会被那条白底盖住。品牌字 / 按钮按角色反色，保证读得清。 */
      '.wr-th-base > .wr-nav,.wr-th-card > .wr-nav,.wr-th-soft > .wr-nav,.wr-th-accent > .wr-nav,' +
      '.wr-th-inverse > .wr-nav,.wr-th-outline > .wr-nav,.wr-th-plain > .wr-nav,.wr-th-custom > .wr-nav' +
      '{background:transparent!important;color:inherit!important}',
      '.wr-th-accent > .wr-nav .wr-nav-brand{color:var(--wr-mod-ink,#fff)!important}',
      '.wr-th-accent > .wr-nav .wr-nav-cta{background:var(--wr-mod-ink,#fff)!important;color:var(--wr-accent,#3b82f6)!important}',
      '.wr-th-inverse > .wr-nav .wr-nav-brand{color:#16233a!important}',
      '.wr-th-inverse > .wr-nav .wr-nav-cta{background:#16233a!important;color:#fff!important}',
      '.wr-th-custom > .wr-nav .wr-nav-brand{color:var(--wr-th-ink,inherit)!important}',
      // 整块链接：透明 <a> 盖住模块；内部真实链接 / 按钮抬高层级，仍可点击
      '.wr-haslink{position:relative}',
      '.wr-blocklink{position:absolute;left:0;top:0;right:0;bottom:0;z-index:2;text-decoration:none;font-size:0;line-height:0;border-radius:inherit;color:transparent}',
      '.wr-haslink a:not(.wr-blocklink),.wr-haslink button{z-index:3;position:relative}',
      '@media print{.wr-print-hide{display:none!important}}',
      /* 统一媒体：编辑器画布与导出页共用，图标图片不会被移动端规则拉满 */
      '.wr-media{display:grid;place-items:center;flex-shrink:0;overflow:hidden;line-height:1;vertical-align:middle;box-sizing:border-box}',
      '.wr-media.inline{display:inline-grid}',
      '.wr-media.round{border-radius:50%}',
      '.wr-media img{width:100%!important;height:100%!important;object-fit:cover;display:block}',
      '.wr-media.contain img{object-fit:contain}',
      '.wr-media.has-img{background:transparent!important}',
      '.wr-nav-mark.has-img,.wr-feature-ico.has-img,.wr-team-avatar.has-img{background:transparent!important}',
      '.wr-logo-img{max-height:38px;width:auto!important;max-width:100%;object-fit:contain;display:block;margin:0 auto}',
      /* 滚动视频 */
      '.wr-film{position:relative;display:block;overflow:hidden;background:#0b1120;line-height:0}',
      '.wr-film-v{display:block;width:100%;object-fit:cover;background:#0b1120}',
      '.wr-film-empty{display:grid;place-items:center;height:100%;min-height:160px;color:#8fa3c4;font-size:13px;line-height:1.6}',
      '.wr-film-note{position:absolute;inset:0;display:grid;place-items:center;background:#0b1120;color:#7f93b4;font-size:13px;line-height:1.6}',
      '.wr-film-badge{position:absolute;left:12px;top:12px;padding:5px 11px;border-radius:999px;background:rgba(8,14,26,.62);' +
        'color:#dce8ff;font-size:11px;letter-spacing:.06em;line-height:1.4;backdrop-filter:blur(6px);pointer-events:none}',
      /* 底部进度线：滚动模式下显示当前播到哪，由脚本写 --wr-film-p */
      '.wr-film-scan{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.16);pointer-events:none;' +
        'transform-origin:left center;transform:scaleX(var(--wr-film-p,0));transition:transform .08s linear;' +
        'background:linear-gradient(90deg,rgba(120,180,255,.9),rgba(160,210,255,.95))}',
      '.wr-film[data-mode="click"] .wr-film-scan,.wr-film[data-mode="loop"] .wr-film-scan{display:none}',
      /* ===== 新组件样式 ===== */
      /* 设备样机 */
      '.wr-device{position:relative;display:flex;flex-direction:column;align-items:center;max-width:920px;margin:0 auto}',
      '.wr-device.is-tilt .wr-dev-body{transform:perspective(1400px) rotateY(-7deg) rotateX(3deg)}',
      '.wr-dev-body{position:relative;width:100%;background:var(--wr-dev-frame,#1d2740);padding:14px;border-radius:20px;' +
        'box-shadow:0 30px 70px rgba(20,30,60,.28),inset 0 0 0 1px rgba(255,255,255,.08);transition:transform .5s ease;z-index:1}',
      '.wr-dev-screen{position:relative;width:100%;aspect-ratio:16/10;background:#0b1120;border-radius:8px;overflow:hidden;display:grid;place-items:center}',
      '.wr-dev-screen-img,.wr-dev-video{width:100%!important;height:100%!important;object-fit:cover;display:block}',
      '.wr-dev-cam{position:absolute;top:5px;left:50%;transform:translateX(-50%);width:6px;height:6px;border-radius:50%;' +
        'background:#3a4560;z-index:3;box-shadow:0 0 0 2px rgba(0,0,0,.2)}',
      '.wr-dev-base{position:relative;width:78%;height:12px;margin-top:-1px;background:linear-gradient(180deg,#c9d2e2,#8f9bb3);' +
        'border-radius:0 0 16px 16px;box-shadow:0 16px 24px rgba(20,30,60,.22)}',
      '.wr-dev-base::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:22%;height:5px;' +
        'background:rgba(0,0,0,.18);border-radius:0 0 8px 8px}',
      '.wr-device.wr-dev-monitor .wr-dev-body{padding:12px 12px 30px}',
      '.wr-device.wr-dev-monitor .wr-dev-base{width:14%;height:56px;margin-top:0;border-radius:0 0 8px 8px;' +
        'background:linear-gradient(180deg,#c9d2e2,#8f9bb3)}',
      '.wr-device.wr-dev-monitor .wr-dev-base::after{content:"";position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);' +
        'width:180%;height:10px;background:#aab4c8;border-radius:8px}',
      '.wr-device.wr-dev-phone{max-width:340px}',
      '.wr-device.wr-dev-phone .wr-dev-body{padding:12px 8px;border-radius:34px}',
      '.wr-device.wr-dev-phone .wr-dev-screen{aspect-ratio:9/19;border-radius:24px}',
      '.wr-device.wr-dev-phone .wr-dev-base,.wr-device.wr-dev-tablet .wr-dev-base{display:none}',
      '.wr-device.wr-dev-phone .wr-dev-cam{top:5px;width:36px;height:6px;border-radius:6px}',
      '.wr-device.wr-dev-tablet{max-width:620px}',
      '.wr-device.wr-dev-tablet .wr-dev-body{padding:12px;border-radius:22px}',
      '.wr-device.wr-dev-tablet .wr-dev-screen{aspect-ratio:4/3;border-radius:8px}',
      '.wr-dev-glow{position:absolute;left:50%;top:45%;width:78%;height:70%;transform:translate(-50%,-50%);' +
        'background:radial-gradient(ellipse,rgba(99,132,255,.35),transparent 68%);filter:blur(28px);z-index:0;pointer-events:none}',
      '.wr-device.no-glow .wr-dev-glow{display:none}',
      '.wr-dev-note{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;padding:8px 14px;' +
        'border-radius:8px;background:rgba(8,14,26,.7);color:#dce8ff;font-size:12px;white-space:nowrap;pointer-events:none}',
      /* 转动品牌墙 */
      '.wr-brandrotor{perspective:1200px;min-height:calc(var(--wr-rot-radius,260px) * 1.1 + 130px);position:relative;overflow:hidden}',
      '.wr-rot-stage{position:relative;width:100%;height:calc(var(--wr-rot-radius,260px) * 1.1 + 90px);' +
        'transform-style:preserve-3d;animation:wr-rot-spin var(--wr-rot-dur,30s) linear infinite}',
      '.wr-brandrotor[data-pause="1"]:hover .wr-rot-stage{animation-play-state:paused}',
      '@keyframes wr-rot-spin{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}',
      '.wr-rot-item,.wr-rot-card{position:absolute;left:50%;top:50%;transform-style:preserve-3d}',
      '.wr-rot-item{transform:translate(-50%,-50%) rotateY(calc(var(--wr-rot-i) * 360deg / var(--wr-rot-n))) translateZ(var(--wr-rot-radius,260px));' +
        'text-decoration:none;color:inherit}',
      '.wr-brandrotor[data-shape="sphere"] .wr-rot-item{transform:translate(-50%,-50%) ' +
        'rotateY(calc(var(--wr-rot-i) * 137.5deg)) rotateX(calc(var(--wr-rot-i) * 22deg - 30deg)) translateZ(var(--wr-rot-radius,260px))}',
      '.wr-rot-card{display:grid;place-items:center;min-width:128px;min-height:64px;padding:12px 20px;margin:-32px 0 0 -64px;' +
        'border-radius:14px;font-size:18px;font-weight:800;letter-spacing:.04em;white-space:nowrap;' +
        'box-shadow:0 10px 30px rgba(0,0,0,.18),inset 0 0 0 1px rgba(0,0,0,.04);backface-visibility:hidden}',
      '.wr-rot-card img{max-width:110px;max-height:40px;object-fit:contain;display:block}',
      /* 视频播放器 */
      '.wr-videoplayer .wr-vp-frame{position:relative;width:100%;background:#05080f;overflow:hidden}',
      '.wr-vp-video{width:100%;height:100%;object-fit:cover;display:block}',
      '.wr-videoplayer figcaption{margin-top:10px;font-size:13px;color:#9fb2d4;text-align:center;line-height:1.6}',
      '.wr-vp-empty,.wr-vp-note{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#8fa3c4;font-size:13px;' +
        'text-align:center;padding:10px 16px;background:rgba(8,14,26,.66);border-radius:8px;pointer-events:none;white-space:nowrap}',
      /* 图片轮播 */
      '.wr-carousel{position:relative;width:100%;overflow:hidden;background:#0b1120}',
      '.wr-slide-track{position:absolute;inset:0}',
      '.wr-slide{position:absolute;inset:0;opacity:0;transition:opacity .6s ease;pointer-events:none}',
      '.wr-slide.is-on{opacity:1;pointer-events:auto}',
      '.wr-slide-link,.wr-slide-img,.wr-slide-ph{display:block;width:100%;height:100%}',
      '.wr-slide-img{object-fit:cover}',
      '.wr-carousel[data-fit="contain"] .wr-slide-img{object-fit:contain}',
      '.wr-slide-ph{display:grid;place-items:center;color:#8fa3c4;font-size:18px;' +
        'background:linear-gradient(135deg,#16203a,#24345c)}',
      '.wr-slide-cap{position:absolute;left:0;right:0;bottom:0;padding:22px 24px;color:#fff;font-size:19px;font-weight:700;' +
        'background:linear-gradient(0deg,rgba(4,8,18,.78),transparent);text-align:center}',
      '.wr-slide-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:4;width:40px;height:40px;border:0;' +
        'border-radius:50%;background:rgba(8,14,26,.46);color:#fff;font-size:28px;line-height:1;cursor:pointer;' +
        'display:grid;place-items:center;backdrop-filter:blur(6px)}',
      '.wr-slide-arrow:hover{background:rgba(8,14,26,.72)}',
      '.wr-slide-arrow.prev{left:14px}.wr-slide-arrow.next{right:14px}',
      '.wr-slide-dots{position:absolute;left:0;right:0;bottom:14px;z-index:4;display:flex;justify-content:center;gap:8px}',
      '.wr-slide-dot{width:9px;height:9px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.5);cursor:pointer;transition:.25s}',
      '.wr-slide-dot.is-on{background:#fff;width:24px;border-radius:6px}',
      '.wr-carousel .wr-slide-cap,.wr-carousel[data-nav="0"] .wr-slide-dots{pointer-events:none}',
      /* 选项卡 */
      '.wr-tabs .wr-tab-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}',
      '.wr-tabs[data-align="center"] .wr-tab-bar{justify-content:center}',
      '.wr-tab-btn{border:0;background:transparent;color:inherit;cursor:pointer;font-size:14px;font-weight:600;' +
        'padding:10px 18px;opacity:.66;transition:.22s}',
      '.wr-tab-btn:hover{opacity:1}',
      '.wr-tabs[data-style="pill"] .wr-tab-btn{border-radius:999px;background:rgba(120,140,180,.12)}',
      '.wr-tabs[data-style="pill"] .wr-tab-btn.is-on{background:var(--wr-tab-active,#3b82f6);color:#fff;opacity:1}',
      '.wr-tabs[data-style="card"] .wr-tab-btn{border-radius:10px 10px 0 0;background:rgba(120,140,180,.1)}',
      '.wr-tabs[data-style="card"] .wr-tab-btn.is-on{background:var(--wr-tab-card,#f6f9ff);opacity:1}',
      '.wr-tabs[data-style="line"] .wr-tab-btn{border-bottom:2px solid transparent;border-radius:0;padding:10px 6px}',
      '.wr-tabs[data-style="line"] .wr-tab-btn.is-on{color:var(--wr-tab-active,#3b82f6);opacity:1;' +
        'border-bottom-color:var(--wr-tab-active,#3b82f6)}',
      '.wr-tab-body{background:var(--wr-tab-card,#f6f9ff);padding:22px 24px;line-height:1.9;font-size:14px}',
      '.wr-tabs[data-style="card"] .wr-tab-body{border-radius:0 12px 12px 12px}',
      '.wr-tab-pane{display:none}.wr-tab-pane.is-on{display:block}',
      /* 倒计时 */
      '.wr-countdown{text-align:center}',
      '.wr-cd-title{font-size:16px;letter-spacing:.12em;opacity:.9;margin-bottom:18px}',
      '.wr-cd-units{display:flex;justify-content:center;align-items:flex-start;gap:12px}',
      '.wr-cd-unit{min-width:78px;display:flex;flex-direction:column;align-items:center;gap:6px}',
      '.wr-cd-unit b{font-size:38px;line-height:1;font-variant-numeric:tabular-nums;color:var(--wr-cd-accent,#fff)}',
      '.wr-cd-unit span{font-size:12px;opacity:.72}',
      '.wr-countdown[data-style="box"] .wr-cd-unit b{background:var(--wr-cd-box,rgba(255,255,255,.1));' +
        'padding:14px 10px;border-radius:12px;min-width:78px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}',
      '.wr-countdown[data-sec="0"] .wr-cd-s{display:none}',
      /* 图片对比 */
      '.wr-compare{position:relative;width:100%;overflow:hidden;background:#0b1120;user-select:none}',
      '.wr-cmp-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}',
      '.wr-cmp-after-wrap{position:absolute;inset:0;clip-path:inset(0 0 0 var(--wr-cmp-pos,50%))}',
      '.wr-cmp-tag{position:absolute;top:14px;z-index:3;padding:5px 12px;border-radius:999px;font-size:12px;' +
        'background:rgba(8,14,26,.6);color:#fff;backdrop-filter:blur(6px)}',
      '.wr-cmp-tag.before{left:14px}.wr-cmp-tag.after{right:14px}',
      '.wr-cmp-handle{position:absolute;top:0;bottom:0;left:var(--wr-cmp-pos,50%);width:2px;background:#fff;' +
        'transform:translateX(-50%);z-index:4;pointer-events:none;box-shadow:0 0 8px rgba(0,0,0,.3)}',
      '.wr-cmp-handle span{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;' +
        'border-radius:50%;background:#fff;color:#1b2740;font-size:17px;letter-spacing:-2px;display:grid;place-items:center;' +
        'box-shadow:0 4px 14px rgba(0,0,0,.28)}',
      '.wr-cmp-range{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:col-resize;z-index:5}',
      /* 音频播放器 */
      '.wr-audioplayer{display:flex;align-items:center;gap:18px;padding:18px 22px}',
      '.wr-au-cover{flex:0 0 72px;width:72px;height:72px;border-radius:14px;display:grid;place-items:center;' +
        'font-size:34px;color:#fff;background:linear-gradient(135deg,#6366f1,#a855f7);overflow:hidden}',
      '.wr-au-cover.has-img{background:transparent}',
      '.wr-au-cover img{width:100%;height:100%;object-fit:cover}',
      '.wr-au-info{flex:1;min-width:0}',
      '.wr-au-title{font-size:17px;font-weight:700;margin-bottom:4px}',
      '.wr-au-artist{font-size:13px;opacity:.66;margin-bottom:10px}',
      '.wr-au-audio{width:100%;height:38px;display:block}',
      '.wr-au-empty{font-size:12px;opacity:.55;padding:8px 0}',
      /* ===== 常用组件第二批 ===== */
      /* 步骤流程 */
      '.wr-steps{display:flex;gap:18px;align-items:stretch}',
      '.wr-steps.is-col{flex-direction:column}',
      '.wr-step{flex:1;min-width:0;display:flex;gap:14px;align-items:flex-start;padding:22px;position:relative}',
      '.wr-steps:not(.no-line):not(.is-col) .wr-step:not(:last-child)::after{content:"";position:absolute;top:38px;left:calc(100% - 4px);width:18px;border-top:2px dashed var(--wr-step-accent,#3b82f6);opacity:.5;z-index:1}',
      '.wr-steps.is-col:not(.no-line) .wr-step:not(:last-child)::after{content:"";position:absolute;left:38px;top:calc(100% - 4px);height:18px;border-left:2px dashed var(--wr-step-accent,#3b82f6);opacity:.5}',
      '.wr-step-badge{flex:0 0 44px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;' +
        'font-size:18px;font-weight:800;color:#fff;background:var(--wr-step-accent,#3b82f6);box-shadow:0 6px 16px -6px var(--wr-step-accent,#3b82f6)}',
      '.wr-steps[data-shape="check"] .wr-step-badge{font-size:22px}',
      '.wr-steps[data-shape="dot"] .wr-step-badge{width:20px;height:20px;flex-basis:20px;margin:12px}',
      '.wr-step-txt h4{margin:2px 0 6px;font-size:16px}',
      '.wr-step-txt p{margin:0;font-size:13.5px;line-height:1.7;opacity:.72}',
      /* 文章列表 */
      '.wr-post{overflow:hidden;border:1px solid rgba(0,0,0,.06);display:flex;flex-direction:column;transition:transform .3s,box-shadow .3s}',
      '.wr-post:hover{transform:translateY(-4px);box-shadow:0 16px 36px rgba(20,40,80,.12)}',
      '.wr-post img,.wr-post-nocover{width:100%;object-fit:cover;display:block}',
      '.wr-post-nocover{display:grid;place-items:center;font-size:40px;color:#b9c6da;background:linear-gradient(135deg,#eef3ff,#faf6ff)}',
      '.wr-post-body{padding:18px 20px 22px;flex:1}',
      '.wr-post-body h3{margin:0 0 8px;font-size:17px;line-height:1.45}',
      '.wr-post-body h3 a{color:inherit;text-decoration:none}',
      '.wr-post-body h3 a:hover{text-decoration:underline}',
      '.wr-post-date{font-size:12px;opacity:.55;margin-bottom:8px}',
      '.wr-post-body p{margin:0;font-size:13.5px;line-height:1.75;opacity:.76}',
      /* 邮件订阅 */
      '.wr-newsletter{max-width:680px;margin:0 auto;padding:40px 36px;text-align:center}',
      '.wr-newsletter h2{margin:0 0 10px;font-size:26px}',
      '.wr-sub-desc{margin:0 0 24px;font-size:14px;opacity:.68;line-height:1.7}',
      '.wr-sub-form{display:flex;gap:10px;max-width:480px;margin:0 auto}',
      '.wr-sub-form input{flex:1;min-width:0;padding:13px 16px;border:1px solid rgba(0,0,0,.12);border-radius:10px;font-size:14px;outline:none}',
      '.wr-sub-form input:focus{border-color:var(--wr-accent,#3b82f6);box-shadow:0 0 0 3px color-mix(in srgb,var(--wr-accent,#3b82f6) 18%,transparent)}',
      '.wr-sub-form button{padding:13px 22px;border:0;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap}',
      /* 输入框占位色：由每个模块自己的 --wr-ph 控制 */
      '.wr-form input::placeholder,.wr-form textarea::placeholder,.wr-sub-form input::placeholder,.wr-search-form input::placeholder{color:var(--wr-ph,currentColor);opacity:.55}',
      '.wr-sub-msg{margin-top:16px;font-size:14px;color:#16a34a;font-weight:600}',
      /* 商品卡片 */
      '.wr-product{max-width:420px;margin:0 auto;overflow:hidden;position:relative;border:1px solid rgba(0,0,0,.06)}',
      '.wr-prod-badge{position:absolute;top:14px;left:14px;z-index:2;padding:5px 12px;border-radius:999px;' +
        'font-size:12px;font-weight:700;color:#fff;background:var(--wr-accent,#3b82f6)}',
      '.wr-prod-media{height:260px;display:grid;place-items:center;background:linear-gradient(135deg,#eef3ff,#faf6ff)}',
      '.wr-prod-media img{width:100%;height:100%;object-fit:cover}',
      '.wr-prod-ph{font-size:56px;color:#b9c6da}',
      '.wr-prod-info{padding:22px 24px 26px}',
      '.wr-prod-info h3{margin:0 0 8px;font-size:19px}',
      '.wr-prod-desc{margin:0 0 14px;font-size:13.5px;line-height:1.7;opacity:.7}',
      '.wr-prod-price{display:flex;align-items:baseline;gap:10px;margin-bottom:18px}',
      '.wr-prod-price b{font-size:26px;color:var(--wr-accent,#3b82f6)}',
      '.wr-prod-price s{font-size:14px;opacity:.5}',
      '.wr-prod-btn{display:block;text-align:center;padding:13px;border-radius:10px;' +
        'background:var(--wr-accent,#3b82f6);color:#fff;font-weight:700;font-size:15px;text-decoration:none}',
      '.wr-prod-btn.is-static{opacity:.9}',
      /* 优惠券 */
      '.wr-coupon{display:flex;align-items:stretch;max-width:680px;margin:0 auto;overflow:hidden;position:relative}',
      '.wr-cp-left{flex:0 0 150px;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'padding:20px 12px;color:var(--wr-cp-accent,#f0623c);border-right:2px dashed color-mix(in srgb,var(--wr-cp-accent,#f0623c) 45%,transparent)}',
      '.wr-cp-amount{font-size:36px;font-weight:900;line-height:1}',
      '.wr-cp-cond{font-size:12px;margin-top:8px;opacity:.8}',
      '.wr-cp-mid{flex:1;padding:20px 22px;display:flex;flex-direction:column;justify-content:center;gap:8px}',
      '.wr-cp-mid h3{margin:0;font-size:18px}',
      '.wr-cp-code{font-size:13px;opacity:.72}',
      '.wr-cp-code b{letter-spacing:.08em;color:var(--wr-cp-accent,#f0623c)}',
      '.wr-cp-right{flex:0 0 auto;display:grid;place-items:center;padding:0 22px}',
      '.wr-cp-right a,.wr-cp-right span{padding:11px 20px;border-radius:999px;font-size:14px;font-weight:700;' +
        'text-decoration:none;white-space:nowrap;background:var(--wr-cp-accent,#f0623c);color:#fff}',
      /* 下载卡片 */
      '.wr-download{display:flex;align-items:center;gap:16px;padding:20px 22px;max-width:560px;margin:0 auto;border:1px solid rgba(0,0,0,.06)}',
      '.wr-dl-icon{flex:0 0 52px;width:52px;height:52px;border-radius:12px;display:grid;place-items:center;' +
        'font-size:28px;background:linear-gradient(135deg,#eef3ff,#faf6ff)}',
      '.wr-dl-info{flex:1;min-width:0}',
      '.wr-dl-name{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.wr-dl-meta{font-size:12.5px;opacity:.6;margin-top:4px}',
      '.wr-dl-btn{flex:0 0 auto;padding:10px 18px;border-radius:9px;background:var(--wr-accent,#3b82f6);' +
        'color:#fff;text-decoration:none;font-size:14px;font-weight:600;white-space:nowrap}',
      /* 社交分享 */
      '.wr-share{display:flex;flex-direction:column;align-items:inherit;gap:14px;position:relative}',
      '.wr-share-title{font-size:16px;font-weight:700}',
      '.wr-share-btns{display:flex;gap:12px;flex-wrap:wrap}',
      '.wr-share-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border:1px solid rgba(0,0,0,.1);' +
        'border-radius:10px;background:#fff;color:var(--wr-share-accent,#3b82f6);cursor:pointer;text-decoration:none;' +
        'font-size:13.5px;font-style:normal;transition:transform .2s,box-shadow .2s}',
      '.wr-share-btn:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(20,40,80,.12)}',
      '.wr-share-btn span{font-size:15px;font-weight:700}',
      '.wr-share.is-icon .wr-share-btn{width:46px;height:46px;padding:0;border-radius:50%;justify-content:center;position:relative}',
      '.wr-share.is-icon .wr-share-btn i{display:none}',
      '.wr-share-toast{position:absolute;left:50%;top:-6px;transform:translateX(-50%);background:#16233a;color:#fff;' +
        'font-size:12px;padding:6px 14px;border-radius:999px;z-index:3}',
      /* 地址 / 门店卡 */
      '.wr-mapcard{display:flex;gap:20px;align-items:center;padding:26px 28px;border:1px solid rgba(0,0,0,.06)}',
      '.wr-map-ico{flex:0 0 60px;width:60px;height:60px;border-radius:16px;display:grid;place-items:center;' +
        'font-size:30px;color:#fff;background:linear-gradient(135deg,#3b82f6,#8b5cf6)}',
      '.wr-map-info{flex:1;min-width:0}',
      '.wr-map-info h3{margin:0 0 10px;font-size:18px}',
      '.wr-map-info ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}',
      '.wr-map-info li{font-size:14px;opacity:.8;display:flex;gap:9px;align-items:center}',
      '.wr-map-info li span{opacity:.6;width:16px;text-align:center}',
      '.wr-map-btn{flex:0 0 auto;padding:11px 20px;border-radius:10px;background:var(--wr-accent,#3b82f6);' +
        'color:#fff;text-decoration:none;font-size:14px;font-weight:600;white-space:nowrap}',
      /* 活动 / 日程卡 */
      '.wr-event{display:flex;gap:22px;align-items:center;padding:24px 26px;border:1px solid rgba(0,0,0,.07);flex-wrap:wrap}',
      '.wr-evt-date{flex:0 0 108px;width:108px;padding:16px 10px;border-radius:14px;text-align:center;display:flex;flex-direction:column;gap:4px}',
      '.wr-evt-date b{font-size:18px}',
      '.wr-evt-date span{font-size:11px;opacity:.9}',
      '.wr-evt-body{flex:1;min-width:180px}',
      '.wr-evt-body h3{margin:0 0 8px;font-size:19px}',
      '.wr-evt-body p{margin:0 0 8px;font-size:13.5px;line-height:1.7;opacity:.72}',
      '.wr-evt-loc{font-size:13px;opacity:.66}',
      '.wr-evt-btn{flex:0 0 auto;padding:11px 22px;border-radius:10px;background:var(--wr-accent,#3b82f6);' +
        'color:#fff;text-decoration:none;font-size:14px;font-weight:700;white-space:nowrap}',
      /* 职位列表 */
      '.wr-jobs{display:grid;gap:10px}',
      '.wr-job{display:flex;align-items:center;gap:16px;padding:18px 22px;border:1px solid rgba(0,0,0,.06);flex-wrap:wrap}',
      '.wr-job-main{flex:1;min-width:160px;display:flex;flex-direction:column;gap:4px}',
      '.wr-job-main b{font-size:16px}',
      '.wr-job-loc{font-size:12.5px;opacity:.6}',
      '.wr-job-salary{font-size:15px;font-weight:700;color:var(--wr-job-accent,#3b82f6)}',
      '.wr-job-btn{padding:8px 16px;border:1px solid var(--wr-job-accent,#3b82f6);border-radius:8px;' +
        'color:var(--wr-job-accent,#3b82f6);text-decoration:none;font-size:13px;font-weight:600;white-space:nowrap}',
      /* 图标导航宫格 */
      '.wr-ic-nav{display:flex;flex-direction:column;align-items:center;gap:12px;padding:26px 12px;text-decoration:none;' +
        'color:inherit;transition:transform .25s,box-shadow .25s;border:1px solid rgba(0,0,0,.05)}',
      '.wr-ic-nav:hover{transform:translateY(-4px);box-shadow:0 12px 28px rgba(20,40,80,.1)}',
      '.wr-ic-nav-glyph{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:28px;' +
        'background:linear-gradient(135deg,#eef3ff,#faf6ff)}',
      '.wr-ic-nav-img{width:54px;height:54px;object-fit:contain;border-radius:14px}',
      '.wr-ic-nav-name{font-size:14px;font-weight:600}',
      /* 文章正文 */
      '.wr-article{margin:0 auto;overflow:hidden;border:1px solid rgba(0,0,0,.05)}',
      '.wr-art-cover{width:100%;max-height:380px;object-fit:cover;display:block}',
      '.wr-art-inner{padding:44px 48px 52px}',
      '.wr-art-inner h1{font-size:32px;line-height:1.35;margin:0 0 14px}',
      '.wr-art-meta{font-size:13px;opacity:.6;margin-bottom:30px;padding-bottom:20px;border-bottom:1px solid rgba(0,0,0,.08)}',
      '.wr-art-body{font-size:16px;line-height:2;color:inherit}',
      '.wr-art-body p{margin:0 0 20px}',
      '.wr-art-body h3{font-size:22px;margin:34px 0 14px}',
      '.wr-art-body blockquote{margin:22px 0;padding:14px 22px;border-left:4px solid var(--wr-accent,#3b82f6);' +
        'background:rgba(59,130,246,.07);font-style:italic;opacity:.9}',
      /* --- 拓展组件：二级导航 / 多功能导航 / 下拉栏 / 多选框 --- */
      '.wr-subnav,.wr-smartnav{border-bottom:1px solid rgba(0,0,0,.07)}',
      '.wr-subnav-inner{display:flex;align-items:center;gap:18px;flex-wrap:wrap;position:relative}',
      '.wr-subnav-links{display:flex;align-items:center;gap:var(--wr-nav-gap,6px);flex-wrap:wrap}',
      '.wr-sub-link{color:var(--wr-nav-link,inherit);text-decoration:none;font-size:var(--wr-nav-link-size,14px);opacity:.85;padding:8px 10px;border-radius:8px;display:inline-flex;align-items:center;gap:4px}',
      '.wr-sub-link:hover{color:var(--wr-nav-link-hover,inherit);opacity:1;background:rgba(120,140,180,.1)}',
      '.wr-sub-item{position:relative}',
      '.wr-sub-caret{font-size:12px;transition:transform .2s}',
      '.wr-sub-item:hover .wr-sub-caret,.wr-sub-item:focus-within .wr-sub-caret{transform:rotate(180deg)}',
      '.wr-sub-menu{display:none;position:absolute;top:100%;left:0;min-width:170px;z-index:60;background:#fff;color:#16233a;' +
        'border:1px solid rgba(20,40,80,.1);border-radius:12px;box-shadow:0 16px 40px -18px rgba(20,40,80,.45);padding:8px}',
      '.wr-sub-item:hover .wr-sub-menu,.wr-sub-item:focus-within .wr-sub-menu{display:grid;gap:2px}',
      '.wr-sub-menu a{display:block;padding:9px 12px;border-radius:8px;color:inherit;text-decoration:none;font-size:13.5px;white-space:nowrap}',
      '.wr-sub-menu a:hover{background:rgba(59,130,246,.1);color:var(--wr-accent,#3b82f6)}',
      '.wr-smartnav-links{display:flex;align-items:center;gap:var(--wr-nav-gap,16px);flex-wrap:wrap}',
      '.wr-smartnav-links a{color:var(--wr-nav-link,inherit);text-decoration:none;font-size:var(--wr-nav-link-size,14px);opacity:.85}',
      '.wr-smartnav-links a:hover{color:var(--wr-nav-link-hover,inherit);opacity:1}',
      '.wr-smart-search{display:flex;align-items:center;border:1px solid rgba(30,50,90,.14);border-radius:999px;overflow:hidden;background:rgba(120,140,180,.07)}',
      '.wr-smart-search input{border:0;background:transparent;padding:8px 12px;font-size:13px;color:inherit;outline:none;width:110px}',
      '.wr-smart-search button{border:0;background:transparent;color:inherit;padding:7px 11px;cursor:pointer;font-size:16px;opacity:.7}',
      '.wr-smart-theme{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(30,50,90,.14);background:transparent;' +
        'color:inherit;border-radius:999px;padding:7px 12px;cursor:pointer;font:inherit;font-size:13px}',
      '.wr-smart-theme em{font-style:normal;opacity:.8}',
      '.wr-smart-theme:hover{border-color:var(--wr-accent,#3b82f6)}',
      '.wr-dropdowns{display:grid;max-width:760px;margin:0 auto}',
      '.wr-dd{background:var(--wr-dd-bg,#f6f9fc);border-radius:var(--wr-dd-radius,12px);overflow:hidden}',
      '.wr-dd summary{list-style:none;cursor:pointer;padding:16px 20px;font-size:15px;font-weight:600;display:flex;' +
        'align-items:center;justify-content:space-between;gap:12px}',
      '.wr-dd summary::-webkit-details-marker{display:none}',
      '.wr-dd-arrow{transition:transform .22s;opacity:.55}',
      '.wr-dd[open] .wr-dd-arrow{transform:rotate(180deg)}',
      '.wr-dd-body{padding:0 20px 18px;font-size:14px;line-height:1.8;opacity:.82}',
      '.wr-dd-body a{color:var(--wr-accent,#3b82f6)}',
      '.wr-checkset{max-width:760px;margin:0 auto;padding:30px 32px}',
      '.wr-ck-title{margin:0 0 8px;font-size:21px;font-weight:800}',
      '.wr-ck-desc{margin:0 0 20px;font-size:14px;opacity:.68;line-height:1.7}',
      '.wr-chk-list{display:grid;gap:10px}',
      '.wr-chk{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid rgba(30,50,90,.1);' +
        'border-radius:10px;background:rgba(255,255,255,.55);cursor:pointer;font-size:14px;transition:border-color .2s,background .2s}',
      '.wr-chk:hover{border-color:var(--wr-accent,#3b82f6)}',
      '.wr-chk input{accent-color:var(--wr-accent,#3b82f6);width:17px;height:17px;cursor:pointer}',
      '.wr-chk-actions{display:flex;align-items:center;gap:14px;margin-top:20px;flex-wrap:wrap}',
      '.wr-chk-btn{padding:10px 22px;border:0;border-radius:9px;background:var(--wr-accent,#3b82f6);color:#fff;' +
        'font:inherit;font-weight:600;cursor:pointer}',
      '.wr-chk-result{font-size:13.5px;opacity:.82}',
      '.wr-chk-result[hidden]{display:none}',
      '.wr-nav{border-bottom:1px solid rgba(0,0,0,.07)}',
      '.wr-nav-inner{display:flex;align-items:center;gap:20px;flex-wrap:wrap}',
      '.wr-nav-brand{display:flex;align-items:center;gap:10px;font-size:var(--wr-nav-brand-size,17px);font-weight:800;text-decoration:none;color:inherit;white-space:nowrap}',
      '.wr-nav-mark{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--wr-accent,#3b82f6);color:#fff;font-size:15px;flex-shrink:0}',
      '.wr-nav-links{display:flex;align-items:center;gap:var(--wr-nav-gap,20px);margin-left:auto;flex-wrap:wrap}',
      '.wr-nav-links a{color:var(--wr-nav-link,inherit);text-decoration:none;font-size:var(--wr-nav-link-size,14px);opacity:.82}',
      '.wr-nav-links a:hover{color:var(--wr-nav-link-hover,inherit);opacity:1}',
      '.wr-nav-cta{padding:9px 18px;border-radius:9px;background:var(--wr-accent,#3b82f6);color:#fff;opacity:1!important;font-weight:600}',
      '.wr-nav-cta:hover{opacity:1!important}',
      '.wr-nav-burger{display:none;margin-left:auto;font-size:22px;cursor:pointer;line-height:1;user-select:none;color:inherit;padding:4px 6px}',
      '.wr-nav-cb{display:none}',
      '.wr-announce-inner{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;font-size:13px}',
      '.wr-announce-inner a{color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:3px}',
      '.wr-crumb{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:13px}',
      '.wr-crumb a{color:inherit;text-decoration:none;opacity:.8}',
      '.wr-crumb a:hover{opacity:1;text-decoration:underline}',
      '.wr-crumb .wr-sep{opacity:.4}',
      '.wr-crumb .wr-cur{font-weight:600}',
      '.wr-footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:28px}',
      '.wr-footer-grid h4{margin:0 0 12px;font-size:var(--wr-foot-title-size,14px);color:inherit}',
      '.wr-footer-grid a{display:block;color:var(--wr-foot-link,inherit);text-decoration:none;opacity:.72;font-size:var(--wr-foot-link-size,13px);margin-bottom:var(--wr-foot-gap,7px)}',
      '.wr-footer-grid a:hover{opacity:1;text-decoration:underline}',
      '.wr-footer-grid p{margin:0;font-size:13px;line-height:1.9;opacity:.72}',
      '.wr-footer-bottom{margin-top:28px;padding-top:18px;border-top:1px solid rgba(255,255,255,.13);font-size:var(--wr-foot-bottom-size,12px);opacity:.6}',
      '.wr-features{display:grid;gap:14px}',
      '.wr-feature{display:flex;gap:14px;align-items:flex-start}',
      '.wr-feature-ico{flex:0 0 38px;width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:rgba(59,130,246,.1);font-size:19px}',
      '.wr-feature h4{margin:0 0 4px;font-size:16px}',
      '.wr-feature p{margin:0;font-size:13px;line-height:1.7;opacity:.72}',
      '.wr-gallery{display:grid}',
      '.wr-gallery figure{margin:0}',
      '.wr-gallery img{width:100%;height:170px;object-fit:cover}',
      '.wr-gallery figcaption{margin-top:8px;font-size:12.5px;text-align:center;opacity:.75}',
      '.wr-pricing{display:grid}',
      '.wr-price-card{display:flex;flex-direction:column;position:relative}',
      '.wr-price-card .wr-price-num{font-size:30px;font-weight:800;margin:6px 0 14px;line-height:1.2}',
      '.wr-price-card ul{margin:0 0 20px;padding:0;list-style:none;font-size:13px;line-height:2}',
      '.wr-price-card ul li::before{content:"✓";color:var(--wr-accent,#3b82f6);font-weight:700;margin-right:7px}',
      '.wr-price-card .wr-price-btn{margin-top:auto}',
      '.wr-price-badge{position:absolute;top:-11px;right:16px;background:var(--wr-accent,#3b82f6);color:#fff;font-size:11px;padding:3px 10px;border-radius:999px}',
      '.wr-team{display:grid}',
      '.wr-team-avatar{width:62px;height:62px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;font-size:28px;background:rgba(59,130,246,.1);overflow:hidden}',
      '.wr-team-avatar img{width:100%!important;height:100%!important;object-fit:cover}',
      '.wr-stars{letter-spacing:.15em;color:#f5a623;font-size:18px}',
      '.wr-testimonial blockquote{margin:18px 0;font-size:19px;line-height:1.8;font-weight:500}',
      '.wr-faq{display:grid}',
      '.wr-faq details{border:1px solid rgba(0,0,0,.07);overflow:hidden}',
      '.wr-faq summary{cursor:pointer;list-style:none;padding:15px 18px;font-size:14.5px;font-weight:600;display:flex;justify-content:space-between;gap:12px;align-items:center}',
      '.wr-faq summary::-webkit-details-marker{display:none}',
      '.wr-faq summary::after{content:"+";font-size:20px;font-weight:400;opacity:.55;flex-shrink:0}',
      '.wr-faq details[open] summary::after{content:"−"}',
      '.wr-faq .wr-faq-body{padding:0 18px 16px;font-size:13.5px;line-height:1.85;opacity:.75}',
      '.wr-timeline{border-left:2px solid #dbe6f6;padding-left:26px}',
      '.wr-tl-item{position:relative;padding-bottom:22px}',
      '.wr-tl-item:last-child{padding-bottom:0}',
      '.wr-tl-item::before{content:"";position:absolute;left:-33px;top:5px;width:12px;height:12px;border-radius:50%;background:var(--wr-accent,#3b82f6);box-shadow:0 0 0 4px rgba(59,130,246,.14)}',
      '.wr-tl-date{font-size:12px;font-weight:700;color:var(--wr-accent,#3b82f6);letter-spacing:.04em}',
      '.wr-tl-item h4{margin:3px 0 4px;font-size:16px}',
      '.wr-tl-item p{margin:0;font-size:13px;line-height:1.75;opacity:.72}',
      '.wr-pg-row{margin-bottom:16px}',
      '.wr-pg-label{display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:7px}',
      '.wr-pg-track{height:9px;border-radius:999px;background:rgba(0,0,0,.07);overflow:hidden}',
      '.wr-pg-fill{height:100%;border-radius:999px}',
      '.wr-logos{display:flex;flex-wrap:wrap;gap:12px}',
      '.wr-logo-item{flex:1 1 120px;min-width:100px;text-align:center;padding:16px 10px;font-weight:700;letter-spacing:.04em;font-size:13px;text-decoration:none;color:inherit}',
      '.wr-table-wrap{overflow-x:auto}',
      '.wr-table{width:100%;border-collapse:collapse;font-size:13.5px}',
      '.wr-table th,.wr-table td{padding:11px 14px;text-align:left;border-bottom:1px solid #e2eaf6}',
      '.wr-table th{font-weight:700}',
      '.wr-code{overflow:hidden;background:#0f1b2e;color:#dce8ff}',
      '.wr-code-bar{display:flex;align-items:center;gap:8px;padding:9px 14px;background:rgba(255,255,255,.05);font:11px/1.4 monospace;letter-spacing:.08em;color:#8fa6c8}',
      '.wr-code-bar .wr-dots{margin-left:auto;letter-spacing:.2em;color:#ff8a75}',
      '.wr-code pre{margin:0;padding:18px;overflow:auto;font:12.5px/1.8 "SFMono-Regular",Consolas,monospace;white-space:pre}',
      /* 一行多列里的长代码 / 长单词会把整列撑破，导致后面的列挤出页面 */
      '.wr-nest>*,.wr-cols>*,.wr-footer-grid>*{min-width:0}',
      '.wr-nest pre,.wr-cols pre,.wr-nest code{overflow-x:auto;max-width:100%}',
      '.wr-nest img,.wr-cols img{max-width:100%}',
      '.wr-notice{display:flex;gap:13px;align-items:flex-start}',
      '.wr-notice-ico{font-size:19px;line-height:1.3}',
      '.wr-notice b{display:block;font-size:14.5px;margin-bottom:3px}',
      '.wr-notice p{margin:0;font-size:13px;line-height:1.7;opacity:.82}',
      '.wr-contact{display:grid}',
      '.wr-contact-item{text-align:center}',
      '.wr-contact-ico{font-size:24px;margin-bottom:8px}',
      '.wr-contact-item b{display:block;font-size:12px;opacity:.6;margin-bottom:5px;font-weight:500}',
      '.wr-contact-item span{font-size:14px;font-weight:600}',
      /* --- 社区与产品组件 --- */
      '.wr-hotlist{max-width:760px;margin:0 auto}',
      '.wr-hot-row{transition:transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s ease}',
      '.wr-hot-row:hover{transform:translateX(5px);box-shadow:0 10px 26px -18px rgba(20,40,80,.55)}',
      '.wr-hot-rank{font-size:17px;font-weight:800;font-style:italic;text-align:center;color:#a7b2c4}',
      '.wr-hot-rank.wr-rank-1{color:#ff3b30}.wr-hot-rank.wr-rank-2{color:#ff7a45}.wr-hot-rank.wr-rank-3{color:#f5a623}',
      '.wr-hot-title{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.wr-hot-badge{font-style:normal;font-size:10px;padding:2px 6px;border-radius:5px;background:#eef3ff;color:#5b73a8;white-space:nowrap}',
      '.wr-hot-badge[data-tone="爆"]{background:#ffeceb;color:#e6453b}',
      '.wr-hot-badge[data-tone="热"]{background:#fff1e6;color:#f07020}',
      '.wr-hot-badge[data-tone="沸"]{background:#fff0f6;color:#d9366b}',
      '.wr-hot-badge[data-tone="新"]{background:#e9f8ef;color:#1a9c5b}',
      '.wr-hot-heat{font-size:12px;opacity:.55;white-space:nowrap}',
      '.wr-feed{max-width:760px;margin:0 auto}',
      '.wr-post-head{display:flex;align-items:center;gap:12px}',
      '.wr-post-who{display:grid;gap:2px;min-width:0}',
      '.wr-post-who b{font-size:15px}',
      '.wr-post-who span,.wr-post-who time{font-size:12px;opacity:.55}',
      '.wr-post-more,.wr-post-xmark{margin-left:auto;font-size:19px;opacity:.45}',
      '.wr-post-text{margin-top:14px;font-size:14.5px;line-height:1.85;white-space:pre-wrap}',
      '.wr-post-img{display:block;width:100%;max-height:320px;object-fit:cover;margin-top:14px;border-radius:10px}',
      '.wr-post-actions{display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid rgba(30,50,90,.07)}',
      '.wr-post-act,.wr-vote{border:0;background:transparent;color:inherit;cursor:pointer;font:inherit;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;transition:background .2s,color .2s,transform .2s}',
      '.wr-post-act:hover,.wr-vote:hover{background:rgba(59,130,246,.1);color:var(--wr-accent,#3b82f6)}',
      '.wr-post-act i{font-style:normal;font-size:15px}',
      '.wr-post-act span{font-size:12.5px;opacity:.72}',
      '.wr-feed.is-x .wr-post{border:1px solid rgba(30,50,90,.08)}',
      '.wr-feed.is-x .wr-post-text{font-size:15px}',
      '.wr-post-act.wr-like.is-liked,.wr-vote.is-liked{color:#e6453b;background:rgba(230,69,59,.1)}',
      '.wr-post-act.wr-like.is-liked i{font-weight:700}',
      '.wr-qa{max-width:780px;margin:0 auto;box-shadow:0 16px 44px -30px rgba(20,40,80,.4)}',
      '.wr-qa-title{margin:0 0 16px;font-size:24px;line-height:1.45;font-weight:800}',
      '.wr-qa-author{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid rgba(30,50,90,.08)}',
      '.wr-qa-author b{font-size:14px;display:block}',
      '.wr-qa-author small{display:block;font-size:12px;opacity:.55;margin-top:3px}',
      '.wr-qa-body{margin:20px 0;font-size:15px;line-height:2;white-space:pre-wrap}',
      '.wr-tags{display:flex;flex-wrap:wrap;gap:8px}',
      '.wr-tag{display:inline-block;padding:5px 11px;border-radius:999px;background:rgba(59,130,246,.1);color:var(--wr-accent,#3b82f6);font-size:12px;text-decoration:none}',
      '.wr-qa-actions{display:flex;align-items:center;gap:16px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(30,50,90,.08)}',
      '.wr-vote{font-weight:700;color:var(--wr-accent,#3b82f6)}',
      '.wr-qa-comments,.wr-qa-more{font-size:13px;opacity:.6}',
      '.wr-qa-more{margin-left:auto;font-size:20px;letter-spacing:.1em}',
      '.wr-rating-list{max-width:820px;margin:0 auto}',
      '.wr-rating-item{transition:transform .3s ease,box-shadow .3s ease}',
      '.wr-rating-item:hover{transform:translateY(-3px);box-shadow:0 16px 36px -26px rgba(20,40,80,.55)}',
      '.wr-rating-cover{width:76px;height:108px;object-fit:cover;border-radius:7px;background:#e9edf5}',
      '.wr-rating-ph{display:grid;place-items:center;color:#fff;font-size:30px;font-weight:800;background:linear-gradient(145deg,#f5a623,#e6584f)}',
      '.wr-rating-head{display:flex;align-items:baseline;gap:10px}',
      '.wr-rating-head b{font-size:17px}',
      '.wr-rating-head span{font-size:12px;opacity:.55}',
      '.wr-rating-score{display:flex;align-items:center;gap:10px;margin:7px 0 6px}',
      '.wr-rating-score strong{font-size:20px;color:#f5a623}',
      '.wr-rating-stars{letter-spacing:.13em;font-size:16px;white-space:nowrap}',
      '.wr-rating-item p{margin:0;font-size:13px;line-height:1.75;opacity:.72}',
      '.wr-search{max-width:900px;margin:0 auto;text-align:center}',
      '.wr-search-desc{margin:0;font-size:15px;line-height:1.8;opacity:.7}',
      '.wr-search-form{max-width:720px;box-sizing:border-box}',
      '.wr-search-form input{min-width:0}',
      '.wr-search-form button{white-space:nowrap}',
      '.wr-search-tags{justify-content:center;margin-top:20px}',
      '.wr-search-tag{cursor:pointer;background:#fff;border:1px solid rgba(30,50,90,.08);color:#5b6c86}',
      '.wr-repo{max-width:820px;margin:0 auto;box-shadow:0 14px 40px -32px rgba(20,40,80,.5)}',
      '.wr-repo-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:15px}',
      '.wr-repo-top b{color:var(--wr-accent,#3b82f6)}',
      '.wr-repo-mark{font-size:21px;color:#57606a}',
      '.wr-repo-owner{opacity:.66}',
      '.wr-repo-public{margin-left:auto;border:1px solid rgba(30,50,90,.2);border-radius:999px;padding:2px 9px;font-size:11px;opacity:.65}',
      '.wr-repo-desc{margin:16px 0;font-size:14px;line-height:1.8;opacity:.78}',
      '.wr-repo-stats{display:flex;gap:18px;flex-wrap:wrap;margin-top:20px;font-size:13px}',
      '.wr-repo-stats span{display:inline-flex;align-items:center;gap:6px}',
      '.wr-repo-lang i{width:10px;height:10px;border-radius:50%;display:inline-block}',
      '.wr-repo-foot{margin-top:18px;padding-top:14px;border-top:1px solid rgba(30,50,90,.08);font-size:12px;opacity:.55}',
      '.wr-wiki{max-width:940px;margin:0 auto;padding:28px 32px;box-sizing:border-box;font-size:14.5px;line-height:1.9}',
      '.wr-wiki-main h2{margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid rgba(30,50,90,.14)}',
      '.wr-wiki-lead{font-weight:600;font-size:15.5px}',
      '.wr-wiki-main p{white-space:pre-wrap;margin:0 0 14px}',
      '.wr-wiki-toc{display:grid;gap:6px;margin:22px 0;padding:16px 20px;background:rgba(59,130,246,.05);border:1px solid rgba(59,130,246,.14);border-radius:8px}',
      '.wr-wiki-toc b{font-size:13px;margin-bottom:4px}',
      '.wr-wiki-toc a{color:var(--wr-accent,#3b82f6);text-decoration:none;font-size:13.5px}',
      '.wr-wiki-toc .wr-toc-2{margin-left:18px;opacity:.8}',
      '.wr-wiki-info{padding:18px;background:#f8f9fa;border:1px solid #d8dee4;border-radius:4px;font-size:13px;align-self:start}',
      '.wr-wiki-info>b{display:block;font-size:17px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #d8dee4}',
      '.wr-wiki-info div{display:grid;grid-template-columns:76px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid rgba(30,50,90,.07)}',
      '.wr-wiki-info dt{font-weight:700;opacity:.7}',
      '.wr-wiki-info dd{margin:0;word-break:break-word}',
      '.wr-chat{max-width:960px;margin:0 auto;min-height:420px;box-shadow:0 24px 60px -36px rgba(0,0,0,.7)}',
      '.wr-chat-side{padding:18px 12px;background:rgba(0,0,0,.18)}',
      '.wr-chat-server{display:block;font-size:15px;margin-bottom:18px}',
      '.wr-chat-channel{padding:8px 10px;border-radius:6px;background:rgba(255,255,255,.09);font-size:13px;font-weight:600}',
      '.wr-chat-side-label{margin:22px 0 8px;font-size:11px;letter-spacing:.08em;opacity:.5}',
      '.wr-chat-member{display:flex;align-items:center;gap:8px;padding:6px 8px;font-size:13px;opacity:.86}',
      '.wr-online{width:7px;height:7px;border-radius:50%;background:#23a55a;margin-left:auto}',
      '.wr-chat-main{display:flex;flex-direction:column;min-width:0}',
      '.wr-chat-head{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08);font-weight:700}',
      '.wr-chat-head small{display:block;font-size:11px;font-weight:400;opacity:.5;margin-top:3px}',
      '.wr-chat-msgs{flex:1;padding:18px;display:grid;gap:14px;align-content:start;max-height:360px;overflow:auto}',
      '.wr-chat-msg{display:flex;gap:12px;align-items:flex-start;font-size:13.5px;line-height:1.7}',
      '.wr-chat-msg p{margin:0 0 3px}',
      '.wr-chat-msg b{font-size:13.5px}',
      '.wr-chat-msg time{margin-left:9px;font-size:10px;opacity:.45}',
      '.wr-chat-text{white-space:pre-wrap;opacity:.9}',
      '.wr-chat-composer{display:flex;gap:10px;margin:12px 16px 18px}',
      '.wr-chat-composer input{flex:1;min-width:0;border:0;border-radius:7px;padding:11px 13px;background:rgba(255,255,255,.07);color:inherit;outline:none}',
      '.wr-chat-composer button{border:0;border-radius:7px;padding:0 18px;cursor:pointer;background:var(--wr-accent,#5865f2);color:#fff;font-size:13px;font-weight:600}',
      '.wr-awards-desc{margin:-10px 0 28px;font-size:14px;opacity:.6}',
      '.wr-awards-grid{max-width:1060px;margin:0 auto}',
      '.wr-award{position:relative;min-height:230px;display:flex;align-items:flex-end;isolation:isolate}',
      '.wr-award.is-wide{grid-column:span 2;min-height:280px}',
      '.wr-award img,.wr-award-cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;transition:transform .7s cubic-bezier(.22,1,.36,1)}',
      '.wr-award:hover img,.wr-award:hover .wr-award-cover{transform:scale(1.06)}',
      '.wr-award-ph{display:grid;place-items:center;font-size:78px;font-weight:800;color:rgba(255,255,255,.5)}',
      '.wr-award-ph.0{background:linear-gradient(135deg,#1d3b8f,#8b5cf6)}',
      '.wr-award-ph.1{background:linear-gradient(135deg,#0f766e,#22c55e)}',
      '.wr-award-ph.2{background:linear-gradient(135deg,#7c2d12,#f59e0b)}',
      '.wr-award-ph.3{background:linear-gradient(135deg,#831843,#ec4899)}',
      '.wr-award-info{width:100%;padding:56px 20px 20px;background:linear-gradient(transparent,rgba(0,0,0,.86))}',
      '.wr-award-info small{font-size:10px;letter-spacing:.14em;opacity:.7}',
      '.wr-award-info h3{margin:5px 0 3px;font-size:21px}',
      '.wr-award-info span{font-size:12px;opacity:.66}',
      '.wr-marquee{overflow:hidden;white-space:nowrap;border-top:1px solid currentColor;border-bottom:1px solid currentColor;padding:12px 0}',
      '.wr-marquee-track{display:inline-flex;gap:56px;white-space:nowrap;will-change:transform;animation:wrMarqueeMove var(--wr-marquee-dur,24s) linear infinite}',
      '.wr-marquee.is-right .wr-marquee-track{animation-direction:reverse}',
      '.wr-marquee-track span{font-size:clamp(18px,3vw,34px);font-weight:800;letter-spacing:.08em}',
      '@keyframes wrMarqueeMove{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
      /* --- 视觉实验 --- */
      '.wr-brandwall{display:grid;max-width:1080px;margin:0 auto}',
      '.wr-brand-card{min-height:96px;display:grid;place-items:center;align-content:center;gap:5px;text-decoration:none;color:inherit;' +
        'box-shadow:0 12px 30px -24px rgba(20,40,80,.5);transition:transform .35s cubic-bezier(.22,1,.36,1),box-shadow .35s ease}',
      '.wr-brand-card:hover{transform:translateY(-5px);box-shadow:0 20px 42px -24px rgba(20,40,80,.6)}',
      '.wr-brand-mark{display:grid;place-items:center;min-height:36px}',
      '.wr-brand-logo{max-height:38px;width:auto;max-width:82%;object-fit:contain;display:block}',
      '.wr-brand-word{font-size:17px;font-weight:800;letter-spacing:.1em;text-align:center}',
      '.wr-brand-card small{font-size:11px;opacity:.55}',
      '.wr-brandwall.is-marquee{display:flex;max-width:none;overflow:hidden;gap:0;' +
        '-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);' +
        'mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}',
      '.wr-brand-track{display:flex;gap:14px;flex:0 0 auto;padding-right:14px;animation:wrBrandSlide var(--wr-brand-dur,28s) linear infinite}',
      '@keyframes wrBrandSlide{to{transform:translateX(-100%)}}',
      '.wr-futype{position:relative;overflow:hidden;isolation:isolate;padding:18px 0;text-align:left}',
      '.wr-futype-line{position:relative;font-size:clamp(34px,7.4vw,var(--wr-ft-size,96px));line-height:.98;font-weight:900;letter-spacing:-.035em;' +
        'text-transform:uppercase;animation:wrFutIn .9s cubic-bezier(.22,1,.36,1) both;animation-delay:calc(var(--wr-ft-i,0) * .12s)}',
      '.wr-futype-sub{margin-top:20px;font-size:12px;letter-spacing:.28em;opacity:.62}',
      '.wr-futype-grid{position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.28;' +
        'background-image:linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px);' +
        'background-size:48px 48px;transform:perspective(500px) rotateX(62deg) scale(1.6);transform-origin:bottom}',
      '.wr-futype[data-style="neon"] .wr-futype-line{color:#eaf4ff;text-shadow:0 0 18px rgba(56,189,248,.75),0 0 44px rgba(139,92,246,.55)}',
      '.wr-futype[data-style="outline"] .wr-futype-line{color:transparent;-webkit-text-stroke:1.4px currentColor;text-shadow:0 0 30px rgba(59,130,246,.35)}',
      '.wr-futype[data-style="gradient"] .wr-futype-line{background:linear-gradient(100deg,#fff 4%,#7dd3fc 28%,#a78bfa 52%,#fff 76%);' +
        'background-size:220% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:wrFutIn .9s cubic-bezier(.22,1,.36,1) both,wrFutGrad 6s linear infinite}',
      '.wr-futype[data-style="glitch"] .wr-futype-line::before,.wr-futype[data-style="glitch"] .wr-futype-line::after{' +
        'content:attr(data-text);position:absolute;inset:0;pointer-events:none;opacity:.7}',
      '.wr-futype[data-style="glitch"] .wr-futype-line::before{color:#ff4d8d;animation:wrFutGlitchA 3.1s steps(2,end) infinite}',
      '.wr-futype[data-style="glitch"] .wr-futype-line::after{color:#35e0ff;animation:wrFutGlitchB 2.7s steps(2,end) infinite}',
      '@keyframes wrFutIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}',
      '@keyframes wrFutGrad{to{background-position:220% 50%}}',
      '@keyframes wrFutGlitchA{0%,88%,100%{transform:none;opacity:0}90%{transform:translate(-3px,1px);opacity:.7}94%{transform:translate(2px,-1px);opacity:.5}}',
      '@keyframes wrFutGlitchB{0%,86%,100%{transform:none;opacity:0}88%{transform:translate(3px,-1px);opacity:.7}92%{transform:translate(-2px,2px);opacity:.5}}',
      '.wr-geometry{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:calc(var(--wr-shape-size,150px) * .22);max-width:1040px;margin:0 auto}',
      '.wr-shape{display:block;width:var(--wr-shape-size,150px);height:var(--wr-shape-size,150px);flex:0 0 auto;' +
        'animation:wrShapeFloat var(--wr-shape-dur,12s) ease-in-out infinite;animation-delay:calc(var(--wr-shape-i,0) * -.8s);filter:drop-shadow(0 18px 24px rgba(20,40,80,.18))}',
      '.wr-shape i{display:block;width:100%;height:100%;background:var(--wr-shape-color,#3b82f6)}',
      '.wr-shape[data-kind="circle"] i{border-radius:50%}',
      '.wr-shape[data-kind="square"] i{border-radius:12%}',
      '.wr-shape[data-kind="triangle"] i{clip-path:polygon(50% 0,100% 100%,0 100%)}',
      '.wr-shape[data-kind="hexagon"] i{clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)}',
      '.wr-shape[data-kind="ring"] i{border-radius:50%;background:transparent;border:calc(var(--wr-shape-size,150px) * .14) solid var(--wr-shape-color,#3b82f6)}',
      '.wr-shape[data-kind="drop"] i{border-radius:62% 62% 62% 0;transform:rotate(-45deg)}',
      '@keyframes wrShapeFloat{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-18px) rotate(6deg)}}',
      '.wr-kinetic{position:relative;min-height:340px;display:grid;place-items:center;overflow:hidden;border-radius:18px;isolation:isolate}',
      '.wr-kinetic::before{content:"";position:absolute;inset:0;z-index:-1;opacity:.35;' +
        'background-image:radial-gradient(circle at 20% 20%,rgba(255,255,255,.24),transparent 42%),radial-gradient(circle at 82% 70%,rgba(56,189,248,.3),transparent 46%)}',
      '.wr-orbit{position:relative;width:min(50vw,340px);aspect-ratio:1;display:grid;place-items:center;transform-style:preserve-3d}',
      '.wr-orbit i{position:absolute;inset:0;border:1px solid rgba(255,255,255,.45);border-radius:50%;' +
        'transform:rotateX(68deg) rotateY(0);animation:wrOrbitSpin var(--wr-kin-dur,12s) linear infinite}',
      '.wr-orbit i:nth-child(2){inset:14%;border-color:rgba(125,211,252,.7);animation-duration:calc(var(--wr-kin-dur,12s) * .72);animation-direction:reverse}',
      '.wr-orbit i:nth-child(3){inset:28%;border-color:rgba(167,139,250,.8);animation-duration:calc(var(--wr-kin-dur,12s) * .52)}',
      '.wr-orbit b{width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 0 30px 8px rgba(125,211,252,.75)}',
      '@keyframes wrOrbitSpin{to{transform:rotateX(68deg) rotateY(360deg)}}',
      '.wr-wave{display:flex;align-items:center;gap:7px;height:190px}',
      '.wr-wave i{display:block;width:6px;border-radius:6px;background:linear-gradient(#fff,#7dd3fc);height:42px;' +
        'animation:wrWaveBar var(--wr-kin-dur,12s) ease-in-out infinite alternate}',
      '.wr-wave i:nth-child(3n){animation-duration:calc(var(--wr-kin-dur,12s) * .7);background:linear-gradient(#fff,#a78bfa)}',
      '.wr-wave i:nth-child(4n){animation-duration:calc(var(--wr-kin-dur,12s) * 1.3);background:linear-gradient(#fff,#f472b6)}',
      '@keyframes wrWaveBar{from{height:22px;opacity:.55}to{height:180px;opacity:1}}',
      '.wr-kticker{display:flex;gap:48px;white-space:nowrap;font-size:clamp(30px,6vw,76px);font-weight:900;letter-spacing:.02em;' +
        'animation:wrKTicker var(--wr-kin-dur,12s) linear infinite}',
      '@keyframes wrKTicker{to{transform:translateX(-50%)}}',
      '.wr-kinetic-title{position:absolute;left:0;right:0;bottom:22px;text-align:center;display:grid;gap:2px;pointer-events:none}',
      '.wr-kinetic-title span{font-size:clamp(14px,2.2vw,22px);font-weight:800;letter-spacing:.32em;opacity:.9}',
      '.wr-hires-frame{position:relative;overflow:hidden;background:#0b1220}',
      '.wr-hires-frame img{display:block;transition:transform .8s cubic-bezier(.22,1,.36,1)}',
      '.wr-hires:hover .wr-hires-frame img{transform:scale(1.035)}',
      '.wr-hires-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(4,9,24,.55));pointer-events:none}',
      '.wr-hires figcaption{margin-top:12px;font-size:12.5px;opacity:.68;text-align:center}',
      '.wr-object3d{display:grid;place-items:center;gap:20px;min-height:380px;perspective:900px;overflow:hidden}',
      '.wr-obj-stage{width:var(--wr-obj-size,220px);height:var(--wr-obj-size,220px);display:grid;place-items:center;transform-style:preserve-3d}',
      '.wr-object3d[data-tilt="1"] .wr-obj-stage{animation:wrObjTilt 9s ease-in-out infinite}',
      '@keyframes wrObjTilt{0%,100%{transform:rotateX(-12deg) rotateY(0)}50%{transform:rotateX(12deg) rotateY(10deg)}}',
      '.wr-cube{position:relative;width:60%;height:60%;transform-style:preserve-3d;animation:wrObjSpin var(--wr-obj-dur,12s) linear infinite}',
      '.wr-cube i{position:absolute;inset:0;border:1px solid rgba(255,255,255,.4);' +
        'background:linear-gradient(135deg,var(--wr-obj-c1,#3b82f6),var(--wr-obj-c2,#8b5cf6));opacity:.88;backface-visibility:visible}',
      '.wr-cube .f1{transform:translateZ(calc(var(--wr-obj-size,220px) * .3))}',
      '.wr-cube .f2{transform:rotateY(180deg) translateZ(calc(var(--wr-obj-size,220px) * .3))}',
      '.wr-cube .f3{transform:rotateY(90deg) translateZ(calc(var(--wr-obj-size,220px) * .3))}',
      '.wr-cube .f4{transform:rotateY(-90deg) translateZ(calc(var(--wr-obj-size,220px) * .3))}',
      '.wr-cube .f5{transform:rotateX(90deg) translateZ(calc(var(--wr-obj-size,220px) * .3))}',
      '.wr-cube .f6{transform:rotateX(-90deg) translateZ(calc(var(--wr-obj-size,220px) * .3))}',
      '@keyframes wrObjSpin{from{transform:rotateX(-22deg) rotateY(0)}to{transform:rotateX(-22deg) rotateY(360deg)}}',
      '.wr-pyramid{position:relative;width:70%;height:70%;transform-style:preserve-3d;animation:wrObjSpin var(--wr-obj-dur,12s) linear infinite}',
      '.wr-pyramid i{position:absolute;left:0;right:0;bottom:0;height:100%;clip-path:polygon(50% 0,100% 100%,0 100%);' +
        'background:linear-gradient(160deg,var(--wr-obj-c1,#3b82f6),var(--wr-obj-c2,#8b5cf6));border:1px solid rgba(255,255,255,.25)}',
      '.wr-pyramid i:nth-child(2){transform:rotateY(90deg)}.wr-pyramid i:nth-child(3){transform:rotateY(180deg)}.wr-pyramid i:nth-child(4){transform:rotateY(270deg)}',
      '.wr-sphere3d{width:76%;height:76%;border-radius:50%;' +
        'background:radial-gradient(circle at 34% 28%,#fff 0%,var(--wr-obj-c1,#3b82f6) 22%,var(--wr-obj-c2,#8b5cf6) 62%,#0b1230 100%);' +
        'box-shadow:inset -18px -24px 50px rgba(0,0,0,.4),0 0 60px rgba(99,102,241,.4);animation:wrSphereSpin var(--wr-obj-dur,12s) linear infinite}',
      '@keyframes wrSphereSpin{to{background-position:220% 50%}}',
      '.wr-ring3d{position:relative;width:84%;height:84%;transform-style:preserve-3d;animation:wrObjSpin var(--wr-obj-dur,12s) linear infinite}',
      '.wr-ring3d i{position:absolute;inset:0;border-radius:50%;border:8px solid var(--wr-obj-c1,#3b82f6);box-shadow:0 0 26px var(--wr-obj-c2,#8b5cf6)}',
      '.wr-ring3d i:nth-child(2){inset:12%;transform:rotateX(70deg);border-color:var(--wr-obj-c2,#8b5cf6)}',
      '.wr-ring3d i:nth-child(3){inset:24%;transform:rotateY(70deg);border-color:#e0f2fe}',
      '.wr-obj-label{font-size:12px;letter-spacing:.16em;opacity:.68;margin:0;text-align:center}',
      /* 个性化：个人名片 / 技能 / 时间轴 / 社交链接 / 标签云 / 数据 / 照片墙 */
      '.wr-profilecard{max-width:640px;margin:0 auto;display:grid;justify-items:center;gap:10px;text-align:center;padding:38px 30px;border-radius:inherit}',
      '.wr-profilecard.is-left{justify-items:start;text-align:left;margin:0}',
      '.wr-pc-avatar{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;font-size:38px;font-weight:800;color:#fff;' +
        'background:linear-gradient(135deg,#6d5efc,#a855f7);box-shadow:0 12px 30px rgba(109,94,252,.32);overflow:hidden}',
      '.wr-pc-avatar.has-img img{width:100%;height:100%;object-fit:cover}',
      '.wr-pc-name{display:flex;align-items:center;gap:8px;margin:6px 0 0;font-size:26px;font-weight:800}',
      '.wr-profilecard.is-left .wr-pc-name{justify-content:flex-start}',
      '.wr-pc-verified{display:inline-grid;place-items:center;width:19px;height:19px;border-radius:50%;background:#6d5efc;color:#fff;font-size:12px}',
      '.wr-pc-role{margin:0;font-size:14px;color:#6d5efc;font-weight:600}',
      '.wr-pc-bio{margin:8px 0 0;font-size:14px;line-height:1.8;opacity:.82;max-width:460px}',
      '.wr-pc-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;justify-content:center}',
      '.wr-profilecard.is-left .wr-pc-links{justify-content:flex-start}',
      '.wr-pc-links a{padding:8px 16px;border-radius:999px;background:rgba(109,94,252,.1);color:#6d5efc;font-size:13px;font-weight:600;' +
        'text-decoration:none;transition:background .25s,transform .25s}',
      '.wr-pc-links a:hover{background:#6d5efc;color:#fff;transform:translateY(-2px)}',
      '.wr-skillbar{max-width:680px;margin:0 auto}',
      '.wr-skillbar h2,.wr-journey h2,.wr-tagcloud h2,.wr-statboard h2,.wr-polaroid h2{margin:0 0 22px;font-size:28px;font-weight:800}',
      '.wr-skills{display:grid;gap:18px}',
      '.wr-skill-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:14px}',
      '.wr-skill-top b{font-weight:700}.wr-skill-top span{opacity:.7;font-variant-numeric:tabular-nums}',
      '.wr-skill-track{height:10px;border-radius:999px;background:#e8ecf5;overflow:hidden}',
      '.wr-skill-track i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#6d5efc,#a855f7);transition:width 1.1s cubic-bezier(.22,1,.36,1)}',
      '.wr-journey{max-width:680px;margin:0 auto}',
      '.wr-jy-list{position:relative;padding-left:26px}',
      '.wr-jy-list::before{content:"";position:absolute;left:6px;top:6px;bottom:6px;width:2px;background:#dfe6f5}',
      '.wr-jy-item{position:relative;padding:0 0 26px}',
      '.wr-jy-item:last-child{padding-bottom:0}',
      '.wr-jy-dot{position:absolute;left:-26px;top:5px;width:14px;height:14px;border-radius:50%;background:#6d5efc;' +
        'box-shadow:0 0 0 4px #fff,0 0 0 5px #dfe6f5}',
      '.wr-jy-year{font-size:13px;font-weight:800;color:#6d5efc;letter-spacing:.04em;margin-bottom:5px}',
      '.wr-jy-body h3{margin:0 0 6px;font-size:18px;font-weight:700}',
      '.wr-jy-body p{margin:0;font-size:14px;line-height:1.75;opacity:.75}',
      '.wr-linkhub{max-width:520px;margin:0 auto;display:grid;justify-items:center;gap:8px;text-align:center;padding:16px 0}',
      '.wr-lh-avatar{width:76px;height:76px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,.7);margin-bottom:6px;' +
        'box-shadow:0 10px 26px rgba(0,0,0,.18)}',
      '.wr-lh-avatar img{width:100%;height:100%;object-fit:cover}',
      '.wr-linkhub h2{margin:0;font-size:26px;font-weight:800}',
      '.wr-lh-bio{margin:0 0 14px;font-size:14px;opacity:.85}',
      '.wr-lh-btns{width:100%;display:grid;gap:12px;margin-top:8px}',
      '.wr-lh-btn{display:flex;align-items:center;gap:12px;padding:14px 20px;border-radius:16px;background:#fff;color:#1f2a44;' +
        'font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.12);' +
        'transition:transform .25s,box-shadow .25s}',
      '.wr-linkhub.is-round .wr-lh-btn{border-radius:12px}',
      '.wr-lh-btn:hover{transform:translateY(-3px) scale(1.015);box-shadow:0 14px 32px rgba(0,0,0,.2)}',
      '.wr-lh-btn .wr-lh-ico{font-size:20px;line-height:1}',
      '.wr-lh-btn b{margin-left:auto;opacity:.5;font-size:14px}',
      '.wr-tagcloud{max-width:720px;margin:0 auto}',
      '.wr-tags{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
      '.wr-tagcloud.is-center .wr-tags{justify-content:center}',
      '.wr-tag-i{--wr-tag-c:#6d5efc;display:inline-block;padding:6px 14px;border-radius:999px;font-weight:700;' +
        'color:var(--wr-tag-c);background:color-mix(in srgb,var(--wr-tag-c) 12%,#fff);' +
        'border:1px solid color-mix(in srgb,var(--wr-tag-c) 26%,transparent);line-height:1.3}',
      '.wr-tag-i.w1{font-size:12px;padding:5px 11px}.wr-tag-i.w2{font-size:14px}',
      '.wr-tag-i.w3{font-size:17px}.wr-tag-i.w4{font-size:21px}.wr-tag-i.w5{font-size:26px;padding:9px 20px}',
      '.wr-tagcloud.is-card .wr-tag-i{border-radius:10px;box-shadow:0 4px 14px rgba(20,40,80,.08)}',
      '.wr-statboard{max-width:820px;margin:0 auto}',
      '.wr-stats{display:grid;gap:18px}',
      '.wr-stat{text-align:center;padding:6px 10px}',
      '.wr-statboard.has-divider .wr-stat + .wr-stat{border-left:1px solid #e4e9f3}',
      '.wr-stat strong{display:block;font-size:clamp(30px,5vw,46px);font-weight:800;line-height:1.1;color:#6d5efc;font-variant-numeric:tabular-nums}',
      '.wr-stat strong em{font-style:normal;font-size:.5em;margin-left:2px;opacity:.7}',
      '.wr-stat span{display:block;margin-top:6px;font-size:13px;opacity:.75}',
      '.wr-polaroid{max-width:980px;margin:0 auto}',
      '.wr-polars{display:grid;gap:20px;align-items:start}',
      '.wr-polar{--wr-ang:0deg;margin:0;padding:10px 10px 14px;background:#fff;border-radius:3px;' +
        'box-shadow:0 10px 26px rgba(20,40,80,.16);transform:rotate(var(--wr-ang));' +
        'transition:transform .35s cubic-bezier(.22,1,.36,1),box-shadow .35s}',
      '.wr-polar:hover{transform:rotate(0deg) translateY(-6px) scale(1.03);box-shadow:0 18px 40px rgba(20,40,80,.24);z-index:2}',
      '.wr-polar-img{display:block;aspect-ratio:1;overflow:hidden;background:#eef2f8}',
      '.wr-polar-img img{width:100%;height:100%;object-fit:cover;display:block}',
      '.wr-polar figcaption{margin-top:10px;text-align:center;font-size:13px;color:#5b6478}',
      '.wr-empty{grid-column:1/-1;text-align:center;opacity:.55;font-size:13px;padding:18px}',
      /* 网页外观：颜色切换 / 深色模式 / 字号调节 / 主题切换器 */
      '.wr-colorswitch{padding:22px 24px;display:grid;gap:14px;justify-items:inherit}',
      '.wr-colorswitch[data-wr-colorswitch]{max-width:560px;margin:0 auto}',
      '.wr-colorswitch[style*="text-align: center"],.wr-colorswitch[style*="text-align:center"]{justify-items:center}',
      '.wr-sw-title{font-size:14px;font-weight:700;opacity:.9}',
      '.wr-sw-dots{display:flex;flex-wrap:wrap;gap:12px;justify-content:inherit}',
      '.wr-sw-dot{width:34px;height:34px;border:3px solid #fff;border-radius:50%;background:var(--wr-dot,#3b82f6);' +
        'cursor:pointer;padding:0;box-shadow:0 3px 12px rgba(20,40,80,.18);transition:transform .25s,box-shadow .25s;' +
        'outline:2px solid transparent;outline-offset:2px}',
      '.wr-sw-dot.is-square{border-radius:9px}',
      '.wr-sw-dots.is-square .wr-sw-dot{border-radius:9px}',
      '.wr-sw-dot:hover{transform:translateY(-3px) scale(1.1)}',
      '.wr-sw-dot.is-active{outline-color:var(--wr-dot,#3b82f6);box-shadow:0 6px 18px rgba(20,40,80,.28)}',
      '.wr-sw-names{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;opacity:.62;justify-content:inherit}',
      '.wr-sw-names span{min-width:34px;text-align:center}',
      '.wr-darkmode{padding:4px 0}',
      '.wr-dm-toggle,.wr-dm-btn{display:inline-flex;align-items:center;gap:12px;border:0;background:none;cursor:pointer;' +
        'color:inherit;font-size:14px;font-weight:700;padding:8px 12px;border-radius:999px;transition:background .25s}',
      '.wr-dm-toggle:hover,.wr-dm-btn:hover{background:rgba(109,94,252,.1)}',
      '.wr-dm-track{width:52px;height:28px;border-radius:999px;background:#cbd5e1;position:relative;transition:background .3s;flex-shrink:0}',
      '.wr-dm-knob{position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;' +
        'box-shadow:0 2px 6px rgba(0,0,0,.2);transition:transform .3s cubic-bezier(.22,1,.36,1)}',
      '[data-wr-darkmode][aria-pressed="true"] .wr-dm-track{background:var(--wr-accent,#6d5efc)}',
      '[data-wr-darkmode][aria-pressed="true"] .wr-dm-knob{transform:translateX(24px)}',
      '.wr-dm-btn{padding:10px 22px;border-radius:999px;background:var(--wr-accent,#6d5efc);color:#fff;box-shadow:0 8px 22px rgba(109,94,252,.28)}',
      '.wr-dm-btn:hover{background:var(--wr-accent,#6d5efc);color:#fff;filter:brightness(1.08);background-color:var(--wr-accent,#6d5efc)}',
      '.wr-fontsizer{padding:20px 24px;display:grid;gap:12px;justify-items:inherit;max-width:560px;margin:0 auto}',
      '.wr-fs-title{font-size:14px;font-weight:700;opacity:.9}',
      '.wr-fs-ctrl{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(0,0,0,.1);border-radius:12px;overflow:hidden}',
      '.wr-fs-ctrl button{border:0;background:transparent;color:inherit;cursor:pointer;padding:9px 16px;font-size:15px;font-weight:700;transition:background .2s}',
      '.wr-fs-ctrl button:hover{background:rgba(109,94,252,.12)}',
      '.wr-fs-value{min-width:56px;text-align:center;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;opacity:.8}',
      '.wr-themepicker{padding:22px 24px;display:grid;gap:14px;justify-items:inherit;max-width:640px;margin:0 auto}',
      '.wr-tp-title{font-size:14px;font-weight:700;opacity:.9}',
      '.wr-tp-btns{display:flex;flex-wrap:wrap;gap:10px;justify-content:inherit}',
      '.wr-tp-btn{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(0,0,0,.1);border-radius:999px;' +
        'background:var(--wr-tp-bg,#fff);color:var(--wr-tp-text,#16233a);cursor:pointer;padding:8px 16px 8px 9px;' +
        'font-size:13px;font-weight:700;transition:transform .25s,box-shadow .25s,border-color .25s}',
      '.wr-tp-btn i{width:20px;height:20px;border-radius:50%;background:var(--wr-tp-accent,#3b82f6);' +
        'border:2px solid rgba(255,255,255,.85);box-shadow:0 0 0 1px rgba(0,0,0,.08);flex-shrink:0}',
      '.wr-tp-btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(20,40,80,.16)}',
      '.wr-tp-btn.is-active{border-color:var(--wr-tp-accent,#3b82f6);box-shadow:0 0 0 2px color-mix(in srgb,var(--wr-tp-accent,#3b82f6) 38%,transparent)}',
      '.wr-themepicker.is-swatch .wr-tp-btn{border-radius:14px;padding:10px 14px}',
      /* 深色模式：脚本切到 <html class="wr-dark">，下面用高优先级覆盖整页配色 */
      'html.wr-dark body,html.wr-dark .wr-page{background:var(--wr-dark-bg,#0f172a)!important;color:var(--wr-dark-text,#e8eef9)!important}',
      'html.wr-dark .wr-page section:not([data-wr-nobg]){background:var(--wr-dark-card,#1e293b)!important;color:var(--wr-dark-text,#e8eef9)!important}',
      'html.wr-dark h1,html.wr-dark h2,html.wr-dark h3,html.wr-dark h4,html.wr-dark b,html.wr-dark strong{color:inherit!important}',
      'html.wr-dark a:where(:not([style*="color"]):not([class*="btn"]):not([class*="cta"])){color:var(--wr-accent,#8b5cf6)!important}',
      /* 独立配色锁定：section 已用 data-wr-nobg 退出深色的背景 / 文字覆盖，这里再用高优先级保住链接与标题 */
      'html.wr-dark .wr-page .wr-color-lock a:where(:not([style*="color"]):not([class*="btn"]):not([class*="cta"])){color:var(--wr-mod-link,var(--wr-accent,#8b5cf6))!important}',
      'html.wr-dark .wr-page .wr-color-lock h1,html.wr-dark .wr-page .wr-color-lock h2,html.wr-dark .wr-page .wr-color-lock h3,html.wr-dark .wr-page .wr-color-lock h4,html.wr-dark .wr-page .wr-color-lock b,html.wr-dark .wr-page .wr-color-lock strong{color:inherit!important}',
      /* 主题样式：每个模块自己声明在深色下的样子，优先级高于上面的整页统一覆盖 */
      thDark('section.wr-th-base', 'background:' + dp.bg + '!important;color:' + dp.text + '!important'),
      thDark('section.wr-th-card', 'background:' + dp.card + '!important;color:' + dp.text + '!important'),
      thDark('section.wr-th-soft', 'background:color-mix(in srgb,var(--wr-accent,#8b5cf6) 18%,transparent)!important;color:' + dp.text + '!important'),
      thDark('section.wr-th-accent', 'background:var(--wr-accent,#8b5cf6)!important;color:var(--wr-mod-ink,#fff)!important'),
      thDark('section.wr-th-accent a:where(:not([style*="color"]):not([class*="btn"]):not([class*="cta"]))', 'color:var(--wr-mod-link,#fff)!important'),
      thDark('section.wr-th-inverse', 'background:#f8fafc!important;color:#16233a!important;--wr-mod-ink:#16233a!important;--wr-mod-link:#16233a!important'),
      thDark('section.wr-th-inverse h1,section.wr-th-inverse h2,section.wr-th-inverse h3,section.wr-th-inverse h4,section.wr-th-inverse b,section.wr-th-inverse strong', 'color:#16233a!important'),
      thDark('section.wr-th-inverse a:where(:not([style*="color"]):not([class*="btn"]):not([class*="cta"]))', 'color:#16233a!important'),
      thDark('section.wr-th-outline', 'background:transparent!important;color:' + dp.text + '!important'),
      thDark('section.wr-th-plain', 'background:transparent!important;color:' + dp.text + '!important'),
      thDark('section.wr-th-custom', 'background:var(--wr-th-bg-d,var(--wr-th-bg,transparent))!important;color:var(--wr-th-ink-d,var(--wr-th-ink,inherit))!important'),
      thDark('section.wr-th-custom.wr-mod-ink', '--wr-mod-ink:var(--wr-th-ink-d,var(--wr-th-ink))!important'),
      thDark('section.wr-th-custom.wr-mod-links a:where(:not([style*="color"]):not([class*="btn"]):not([class*="cta"]))', 'color:var(--wr-th-link-d,var(--wr-th-link,var(--wr-accent,#8b5cf6)))!important'),
      thDark('section.wr-th-base > .wr-nav .wr-nav-brand,section.wr-th-card > .wr-nav .wr-nav-brand,section.wr-th-soft > .wr-nav .wr-nav-brand,section.wr-th-outline > .wr-nav .wr-nav-brand,section.wr-th-plain > .wr-nav .wr-nav-brand', 'color:' + dp.text + '!important'),
      thDark('section.wr-th-custom > .wr-nav .wr-nav-brand', 'color:var(--wr-th-ink-d,var(--wr-th-ink,inherit))!important'),
      thDark('section.wr-th-accent > .wr-nav .wr-nav-brand', 'color:var(--wr-mod-ink,#fff)!important'),
      thDark('section.wr-th-inverse > .wr-nav .wr-nav-brand', 'color:#16233a!important'),
      /* 画布「深色预览」：把整页的默认深色也搬进编辑器，方便边改边看 */
      '.canvas.is-dark-preview{background:' + dp.bg + '!important;color:' + dp.text + '!important}',
      '.canvas.is-dark-preview section:not([data-wr-nobg]){background:' + dp.card + '!important;color:' + dp.text + '!important}',
      '.canvas.is-dark-preview h1,.canvas.is-dark-preview h2,.canvas.is-dark-preview h3,.canvas.is-dark-preview h4,.canvas.is-dark-preview b,.canvas.is-dark-preview strong{color:inherit!important}',
      '.canvas.is-dark-preview a:where(:not([style*="color"]):not([class*="btn"]):not([class*="cta"])){color:var(--wr-accent,#8b5cf6)!important}',
      '.canvas.is-dark-preview .wr-color-lock a:where(:not([style*="color"]):not([class*="btn"]):not([class*="cta"])){color:var(--wr-mod-link,var(--wr-accent,#8b5cf6))!important}',
      '.canvas.is-dark-preview .wr-color-lock h1,.canvas.is-dark-preview .wr-color-lock h2,.canvas.is-dark-preview .wr-color-lock h3,.canvas.is-dark-preview .wr-color-lock h4,.canvas.is-dark-preview .wr-color-lock b,.canvas.is-dark-preview .wr-color-lock strong{color:inherit!important}',
      /* 浮层：宿主只负责建立定位参照，浮层本身的坐标写在 .wr-layer 上 */
      '.wr-stack{position:relative}',
      '.wr-stack > .wr-layer{position:absolute!important;max-width:none}',
      '.wr-layer{pointer-events:auto}',
      /* 智能穿透：浮层容器与 section 背景不拦截点击，只有内容元素可点，避免挡住下层链接 */
      '.wr-layer[data-layer-pe="auto"]>section,.wr-layer[data-layer-pe="none"]{pointer-events:none}',
      '.wr-layer[data-layer-pe="auto"]>section *{pointer-events:auto}',
      '.wr-shadow-sm{box-shadow:0 6px 18px rgba(20,40,80,.10)}',
      '.wr-shadow-md{box-shadow:0 12px 32px rgba(20,40,80,.16)}',
      '.wr-shadow-lg{box-shadow:0 20px 52px rgba(20,40,80,.24)}'
    ].concat(fxCSS());
    // 同一组规则生成两份：导出页按视口宽度、编辑器画布按设备切换
    var mob = [
      ['.wr-nav-inner', 'padding-top:10px;padding-bottom:10px'],
      ['.wr-nav-links', 'display:none;width:100%;flex-direction:column;align-items:stretch;gap:0;margin-left:0;border-top:1px solid rgba(0,0,0,.08);padding-top:6px'],
      ['.wr-nav-links a', 'display:block;width:100%;padding:11px 0;border-bottom:1px solid rgba(0,0,0,.06)'],
      ['.wr-nav-cta', 'text-align:center;margin:8px 0'],
      ['.wr-nav-burger', 'display:block'],
      ['.wr-nav-cb:checked ~ .wr-nav-links', 'display:flex'],
      ['.wr-subnav-links,.wr-smartnav-links', 'display:none;width:100%;flex-direction:column;align-items:stretch;gap:0;margin-left:0;border-top:1px solid rgba(0,0,0,.08);padding-top:6px'],
      ['.wr-sub-link,.wr-smartnav-links a', 'display:block;width:100%;padding:11px 10px;border-bottom:1px solid rgba(0,0,0,.06)'],
      ['.wr-sub-menu', 'position:static;box-shadow:none;border:0;background:transparent;padding:0 0 6px 12px'],
      ['.wr-nav-cb:checked ~ .wr-subnav-links,.wr-nav-cb:checked ~ .wr-smartnav-links', 'display:flex'],
      ['.wr-smart-search,.wr-smart-theme', 'margin:8px 0'],
      ['.wr-cols', 'grid-template-columns:1fr!important'],
      // 手机端一律单列：清掉子块的行内跨列 / 行内宽度，避免隐式多出列
      ['.wr-nest[data-layout="row"] > *', 'grid-column:1/-1!important'],
      ['.wr-nest[data-layout="flow"] > *', 'flex:0 0 100%!important'],
      ['.wr-footer-grid', 'grid-template-columns:1fr!important;gap:20px'],
      ['.wr-gallery', 'grid-template-columns:repeat(2,1fr)!important'],
      ['.wr-gallery img', 'height:120px'],
      ['.wr-team', 'grid-template-columns:repeat(2,1fr)!important'],
      ['.wr-pricing', 'grid-template-columns:1fr!important'],
      ['.wr-features', 'grid-template-columns:1fr!important'],
      ['.wr-contact', 'grid-template-columns:1fr!important'],
      ['.wr-logos', 'gap:8px'],
      ['.wr-logo-item', 'min-width:80px;flex-basis:80px;font-size:12px'],
      ['.wr-hot-row', 'grid-template-columns:26px 1fr auto;gap:8px;padding:10px'],
      ['.wr-hot-heat', 'display:none'],
      ['.wr-feed', 'gap:12px'],
      ['.wr-qa', 'padding:20px!important'],
      ['.wr-qa-title', 'font-size:20px'],
      ['.wr-rating-item', 'grid-template-columns:64px 1fr;gap:12px;padding:12px'],
      ['.wr-rating-cover', 'width:64px;height:92px'],
      ['.wr-search-form', 'flex-direction:column'],
      ['.wr-search-form button', 'width:100%'],
      ['.wr-repo', 'padding:20px!important'],
      ['.wr-wiki', 'grid-template-columns:1fr!important;padding:20px!important'],
      ['.wr-chat', 'grid-template-columns:110px minmax(0,1fr);min-height:380px'],
      ['.wr-chat-side', 'padding:12px 8px'],
      ['.wr-awards-grid', 'grid-template-columns:1fr!important'],
      ['.wr-award.is-wide', 'grid-column:auto'],
      ['.wr-brandwall:not(.is-marquee)', 'grid-template-columns:repeat(2,1fr)!important'],
      ['.wr-brand-track .wr-brand-card', 'min-width:130px'],
      ['.wr-futype', 'padding:10px 0'],
      ['.wr-futype-line', 'letter-spacing:-.02em'],
      ['.wr-geometry', 'gap:18px'],
      ['.wr-kinetic', 'min-height:280px'],
      ['.wr-orbit', 'width:min(70vw,260px)'],
      ['.wr-wave i', 'width:4px'],
      ['.wr-hires-frame', 'max-height:340px!important'],
      ['.wr-object3d', 'min-height:300px'],
      ['.wr-profilecard', 'padding:28px 20px'],
      ['.wr-pc-avatar', 'width:78px;height:78px;font-size:32px'],
      ['.wr-stats', 'grid-template-columns:repeat(2,1fr)!important'],
      ['.wr-polars', 'grid-template-columns:repeat(2,1fr)!important'],
      ['.wr-tag-i.w5', 'font-size:21px'],
      ['.wr-jy-list', 'padding-left:22px'],
      ['.wr-colorswitch,.wr-fontsizer,.wr-themepicker', 'padding:18px 16px'],
      ['.wr-sw-dot', 'width:30px!important;height:30px!important'],
      ['.wr-tp-btns', 'gap:8px'],
      ['section', 'padding-left:18px!important;padding-right:18px!important'],
      ['img:not(.wr-media-img):not(.wr-logo-img):not(.wr-rot-logo):not(.wr-au-cover img):not(.wr-ic-nav-img):not(.wr-art-cover):not(.wr-post img):not(.wr-prod-media img):not([data-fixedw])', 'width:100%!important'],
      ['.wr-only-desktop', 'display:none!important']
    ];
    function rules(prefix) {
      return mob.map(function (r) { return prefix + r[0] + '{' + r[1] + '}'; }).join('\n');
    }
    // 开场幕样式只在该页面用得到时才输出，编辑器里始终保留（试播要用）
    var ic = introCfg();
    var sheet = (withEditor || ic.style !== 'none' || ic.hint !== 'none') ? base.concat(introCSS()) : base;
    return sheet.join('\n') + '\n' + rowStyleCSS() + '\n' +
      '@media(max-width:720px){\n' + rules('.wr-page ') + '\n}\n' +
      '@media(min-width:721px){\n.wr-page .wr-only-mobile{display:none!important}\n}\n' +
      // 画布专用规则只注入编辑器，导出页里不该留下 #canvas 这种痕迹
      (withEditor ? rules('#canvas[data-device="mobile"] ') +
        '#canvas[data-device="desktop"] .wr-only-mobile{display:none!important}\n' +
        '#canvas[data-device="tablet"] .wr-only-mobile{display:none!important}\n' +
        // 常驻动效会让画布上的模块一直漂移，排版时看不清位置，编辑器里停掉
        '#canvas .wr-loop-float,#canvas .wr-loop-pulse,#canvas .wr-loop-breathe,#canvas .wr-loop-sway{animation:none!important}\n' +
        '#canvas .wr-loop-shine::before,#canvas .wr-loop-beam::before,#canvas .wr-loop-gradient::before,#canvas .wr-loop-ring::after,' +
        '#canvas .wr-loop-marquee,#canvas .wr-loop-blink::before,#canvas .wr-loop-shimmer::after,' +
        '#canvas .wr-loop-orbit,#canvas .wr-loop-rgbshift,' +
        '#canvas .wr-brand-track,#canvas .wr-shape,#canvas .wr-orbit i,#canvas .wr-wave i,#canvas .wr-kticker,' +
        '#canvas .wr-cube,#canvas .wr-pyramid,#canvas .wr-sphere3d,#canvas .wr-ring3d,' +
        '#canvas .wr-object3d[data-tilt="1"] .wr-obj-stage,#canvas .wr-rot-stage{animation:none!important}\n' : '');
  }
  function syncComponentCSS() {
    var el = document.getElementById('wrComponentCSS');
    if (!el) {
      el = document.createElement('style');
      el.id = 'wrComponentCSS';
      document.head.appendChild(el);
    }
    el.textContent = componentCSS(true);
  }

  /* 自定义 HTML：允许任意标记，但拦掉能破坏编辑器或执行脚本的部分 ——
     <script>/<style> 整段移除（<style> 会污染整个编辑器界面）、on* 事件属性移除、
     javascript: / data:text/html 协议改为 #。属于基础净化，不是完整沙箱。 */
  function sanitizeHTML(html) {
    var s = String(html == null ? '' : html).slice(0, 30000);
    if (!s.trim()) return '';
    s = s.replace(/<\s*(script|style|object|embed|applet|link|meta|base|title)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    s = s.replace(/<\s*(script|style|object|embed|applet|link|meta|base)\b[^>]*\/?>/gi, '');
    // on* 事件：HTML 允许用 / 代替空格分隔属性，所以前面的分隔符要同时接受空格和斜杠
    s = s.replace(/([\s\/])on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '$1');
    // iframe 的 srcdoc 可以直接塞一段同源 HTML，等于绕过所有过滤
    s = s.replace(/([\s\/])srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '$1');
    s = s.replace(/(href|src|action|formaction)\s*=\s*("|')?\s*(?:javascript|vbscript)\s*:[^"'\s>]*/gi, '$1="#"');
    s = s.replace(/(href|src)\s*=\s*("|')?\s*data:text\/html[^"'\s>]*/gi, '$1="#"');
    // style 属性里也不允许出现 javascript: / expression() / behavior:
    s = s.replace(/(style\s*=\s*)(["'])([\s\S]*?)\2/gi, function (m, pre, q, body) {
      return pre + q + body.replace(/javascript\s*:/gi, '').replace(/expression\s*\(/gi, '').replace(/behavior\s*:/gi, '') + q;
    });
    s = s.replace(/expression\s*\(/gi, '');
    return s;
  }

  function blockHTML(b, childrenHTML, editor, parentBlock, animDelay, hostedSticky, layerTarget, hostedBox) {
    var p = b.p, page = state.page;
    var W = wrapStyle(b, !!editor, parentBlock, !!hostedBox);
    var inner = '';
    var head = p.title ? '<h2 style="' + css({
      'font-size': clampFont(28), margin: '0 0 22px', 'font-weight': '700',
      'text-align': p.align || 'center', color: p.color || page.text
    }) + '">' + esc(p.title) + '</h2>' : '';
    switch (b.type) {
      /* 容器：childrenHTML 由 renderBlocks 递归生成，画布版带编辑包裹，导出版为纯 HTML */
      case 'container': {
        var lay = p.layout || 'stack';
        var isRow = lay === 'row', isFlow = lay === 'flow';
        var alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
        inner = (p.title ? '<h3 style="' + css({
          'font-size': clampFont(22), margin: '0 0 16px',
          'text-align': p.align || 'left', color: p.color || page.text
        }) + '">' + esc(p.title) + '</h3>' : '') +
          '<div class="wr-nest' + (isRow ? ' wr-cols' : '') + '" data-layout="' + lay + '" style="' + css({
            display: isRow ? 'grid' : 'flex',
            'flex-direction': isFlow ? 'row' : (isRow ? '' : 'column'),
            'flex-wrap': isFlow ? 'wrap' : '',
            'grid-template-columns': isRow ? gridCols(p.cols, 3) : '',
            'align-items': alignMap[p.alignItems || 'stretch'] || 'stretch',
            gap: (p.gap == null ? 14 : p.gap) + 'px',
            color: p.color || page.text
          }) + '">' + CHILD_TOKEN + '</div>';
        break;
      }
      case 'hero':
        inner =
          (p.kicker ? '<div style="' + css({ 'font-size': '12px', 'letter-spacing': '.2em', opacity: '.75', 'margin-bottom': '16px', color: p.color || '#fff' }) + '">' + esc(p.kicker) + '</div>' : '') +
          '<h1 style="' + css({ 'font-size': clampFont(52), margin: '0 0 18px', 'line-height': '1.25', color: p.color || '#fff', 'font-weight': '800' }) + '">' + nl(p.title) + '</h1>' +
          (p.desc ? '<p style="' + css({ 'font-size': 'clamp(14px,2vw,18px)', margin: '0 auto 30px', 'max-width': '640px', 'line-height': '1.8', color: p.color || '#fff', opacity: '.82' }) + '">' + nl(p.desc) + '</p>' : '') +
          (p.btnText ? '<a href="' + esc(safeUrl(p.href, '#')) + '" style="' + css(btnSkin(p, {
            bg: page.accent, color: '#fff', radius: 10, padX: 28, padY: 13, fontSize: 15, weight: '600', shadow: 'soft'
          })) + '">' + esc(p.btnText) + '</a>' : '');
        break;
      case 'heading': {
        var tag = 'h' + (p.level || '2');
        inner = '<' + tag + ' style="' + css({ 'font-size': clampFont(p.fontSize || 36), margin: '0', 'line-height': '1.3', 'font-weight': '700', color: p.color || page.text }) + '">' + nl(p.text) + '</' + tag + '>';
        break;
      }
      case 'text':
        inner = '<p style="' + css({ 'font-size': (p.fontSize || 16) + 'px', margin: '0', 'line-height': '1.9', color: p.color || page.text, 'white-space': 'normal' }) + '">' + nl(p.text) + '</p>';
        break;
      case 'button': {
        var oneBtn = css(btnSkin(p, {
          bg: p.btnBg || page.accent, color: p.btnColor || '#ffffff',
          radius: p.radius == null ? 10 : p.radius,
          padX: 30, padY: 13, fontSize: 15, weight: '600', shadow: 'soft'
        }));
        inner = '<a href="' + esc(safeUrl(p.href, '#')) + '" style="' + oneBtn + '">' + esc(p.text) + '</a>';
        break;
      }
      case 'image': {
        // 与画廊一致走 resolveMedia：把 asset:<id> 展开成真实地址，导出页才不会破图
        var src = resolveMedia(p.src) || PLACEHOLDER_IMG;
        var alignMargin = p.align === 'center' ? '0 auto' : (p.align === 'right' ? '0 0 0 auto' : '0');
        var wRaw = String(p.width == null ? 100 : p.width).trim();
        var wCss = /px$/.test(wRaw) ? wRaw : ((parseFloat(wRaw) || 100) + '%');
        var rRaw = String(p.radius == null ? 0 : p.radius).trim();
        var rCss = /(px|%)$/.test(rRaw) ? rRaw : ((parseFloat(rRaw) || 0) + 'px');
        // 圆形头像：只给宽度的话高度会按原图比例走，圆形就拉成了椭圆。
        // 补一个等高 + object-fit:cover，和原页面的圆形裁切一致
        var extra = {};
        if (/999px|50%/.test(rCss)) {
          if (/px$/.test(wCss)) extra.height = wCss;
          else extra['aspect-ratio'] = '1 / 1';
          extra['object-fit'] = 'cover';
        }
        inner = '<img' + (/px$/.test(wCss) ? ' data-fixedw="1"' : '') + ' src="' + esc(src) + '" alt="' + esc(p.alt || '') + '" loading="lazy" decoding="async" style="' + css(Object.assign({ width: wCss, 'border-radius': rCss, margin: alignMargin, display: 'block' }, extra)) + '">' +
          (p.caption ? '<p style="' + css({ 'font-size': '13px', color: '#7c8ca6', 'margin-top': '12px', 'text-align': p.align || 'center' }) + '">' + esc(p.caption) + '</p>' : '');
        break;
      }
      case 'card': {
        var cardIconMargin = p.align === 'center' ? '0 auto 14px'
          : (p.align === 'right' ? '0 0 14px auto' : '0 0 14px 0');
        var cPadX = pnum(p, 'cardPadX', 28, 0, 80), cPadY = pnum(p, 'cardPadY', 28, 0, 80);
        var cTitle = pnum(p, 'cardTitleSize', 20, 8, 40), cText = pnum(p, 'cardTextSize', 14, 8, 40);
        var cIcon = pnum(p, 'cardIconSize', 48, 12, 160);
        inner = '<div style="' + css({ background: paint(p.cardBg, '#f3f7ff'), 'border-radius': (p.radius || 0) + 'px', padding: cPadY + 'px ' + cPadX + 'px', 'text-align': p.align || 'left', color: p.color || page.text }) + '">' +
          mediaHTML(p.emoji, { size: cIcon, font: Math.round(cIcon * 0.62), fit: 'contain', margin: cardIconMargin, alt: p.title }) +
          '<h3 style="' + css({ margin: '0 0 10px', 'font-size': cTitle + 'px', color: p.color || page.text }) + '">' + esc(p.title) + '</h3>' +
          '<p style="' + css({ margin: '0', 'font-size': cText + 'px', 'line-height': '1.8', color: p.color || page.text, opacity: '.78' }) + '">' + nl(p.desc) + '</p></div>';
        break;
      }
      case 'grid': {
        var rowsG = itemRows(p.items);
        var gIconMargin = p.align === 'right' ? '0 0 12px auto'
          : (p.align === 'left' ? '0 0 12px 0' : '0 auto 12px');
        var gPadX = pnum(p, 'cardPadX', 20, 0, 80), gPadY = pnum(p, 'cardPadY', 26, 0, 80);
        var gTitle = pnum(p, 'cardTitleSize', 17, 8, 40), gText = pnum(p, 'cardTextSize', 13, 8, 40);
        var gIcon = pnum(p, 'cardIconSize', 42, 12, 160);
        inner = (p.title ? '<h2 style="' + css({ 'font-size': clampFont(30), margin: '0 0 24px', color: p.color || page.text }) + '">' + esc(p.title) + '</h2>' : '') +
          '<div class="wr-cols" data-wr-list="items" style="display:grid;grid-template-columns:repeat(' + Math.max(1, Math.min(6, Number(p.cols) || 3)) + ',1fr);gap:16px;text-align:' + (p.align || 'center') + '">' +
          rowsG.map(function (r) {
            return '<div style="' + css({ background: paint(p.cardBg, '#f5f8ff'), 'border-radius': (p.radius || 0) + 'px', padding: gPadY + 'px ' + gPadX + 'px', color: p.color || page.text }) + '">' +
              mediaHTML(r.a, { size: gIcon, font: Math.round(gIcon * 0.66), fit: 'contain', margin: gIconMargin, alt: r.b }) +
              '<h3 style="' + css({ margin: '0 0 8px', 'font-size': gTitle + 'px', color: p.color || page.text }) + '">' + esc(r.b) + '</h3>' +
              '<p style="' + css({ margin: '0', 'font-size': gText + 'px', 'line-height': '1.7', opacity: '.75' }) + '">' + esc(r.c) + '</p></div>';
          }).join('') + '</div>';
        break;
      }
      case 'twocol': {
        var tcPadX = pnum(p, 'cardPadX', 26, 0, 80), tcPadY = pnum(p, 'cardPadY', 26, 0, 80);
        var tcTitle = pnum(p, 'cardTitleSize', 19, 8, 40), tcText = pnum(p, 'cardTextSize', 14, 8, 40);
        inner = '<div class="wr-cols" style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">' +
          [['leftTitle', 'leftText'], ['rightTitle', 'rightText']].map(function (pair) {
            return '<div style="' + css({ background: paint(p.cardBg, '#f5f8ff'), 'border-radius': (p.radius || 0) + 'px', padding: tcPadY + 'px ' + tcPadX + 'px', color: p.color || page.text }) + '">' +
              '<h3 style="' + css({ margin: '0 0 10px', 'font-size': tcTitle + 'px', color: p.color || page.text }) + '">' + esc(p[pair[0]]) + '</h3>' +
              '<p style="' + css({ margin: '0', 'font-size': tcText + 'px', 'line-height': '1.8', opacity: '.78' }) + '">' + nl(p[pair[1]]) + '</p></div>';
          }).join('') + '</div>';
        break;
      }
      case 'stats': {
        var rowsS = itemRows(p.items);
        inner = (p.title ? '<h2 style="' + css({ 'font-size': clampFont(30), margin: '0 0 24px', 'text-align': 'center', color: p.color || page.text }) + '">' + esc(p.title) + '</h2>' : '') +
          '<div class="wr-cols" data-wr-list="items" style="display:grid;grid-template-columns:repeat(' + Math.max(1, Math.min(4, rowsS.length)) + ',1fr);gap:16px;text-align:center">' +
          rowsS.map(function (r) {
            return '<div><div data-count="' + esc(r.a) + '" style="' + css({ 'font-size': 'clamp(26px,4vw,40px)', 'font-weight': '800', color: page.accent || '#3b82f6' }) + '">' + esc(r.a) + '</div>' +
              '<div style="' + css({ 'font-size': '13px', 'margin-top': '6px', color: p.color || page.text, opacity: '.7' }) + '">' + esc(r.b) + '</div></div>';
          }).join('') + '</div>';
        break;
      }
      case 'quote':
        inner = '<blockquote style="' + css({ margin: '0', 'font-size': 'clamp(18px,2.6vw,24px)', 'line-height': '1.7', 'font-weight': '500', color: p.color || page.text }) + '">“' + nl(p.text) + '”</blockquote>' +
          (p.author ? '<p style="' + css({ margin: '18px 0 0', 'font-size': '13px', opacity: '.65', color: p.color || page.text }) + '">' + esc(p.author) + '</p>' : '');
        break;
      case 'badge':
        inner = String(p.text || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean)
          .map(function (s) {
            return '<span style="' + css({ display: 'inline-block', margin: '4px', padding: '7px 15px', 'border-radius': '999px', 'font-size': '13px', background: paint(p.tagBg, '#e5f4ff'), color: p.color || page.accent }) + '">' + esc(s) + '</span>';
          }).join('');
        break;
      case 'divider': {
        var m = p.align === 'center' ? 'auto' : (p.align === 'right' ? '0 0 0 auto' : '0');
        inner = '<div style="' + css({ width: (p.lineWidth || 60) + '%', height: (p.thickness || 2) + 'px', background: paint(p.lineColor, '#dce5f2'), margin: m }) + '"></div>';
        break;
      }
      case 'spacer':
        inner = '<div style="height:' + (p.height || 40) + 'px"></div>';
        break;
      case 'video':
        inner = '<div style="' + css({ 'max-width': '620px', margin: p.align === 'center' ? '0 auto' : '0', 'border-radius': (p.radius || 0) + 'px', background: '#10203a', padding: '38px 28px', color: '#fff', 'text-align': 'center' }) + '">' +
          '<div style="' + css({ width: '58px', height: '58px', margin: '0 auto 18px', 'border-radius': '50%', background: 'rgba(255,255,255,.14)', display: 'grid', 'place-items': 'center', 'font-size': '22px' }) + '">▶</div>' +
          '<h3 style="margin:0 0 10px;font-size:22px">' + esc(p.title) + '</h3>' +
          '<p style="margin:0 0 24px;font-size:14px;opacity:.72">' + nl(p.desc) + '</p>' +
          '<a href="' + esc(safeUrl(p.url, '#')) + '" style="' + css(btnSkin(p, {
            bg: page.accent, color: '#fff', radius: 9, padX: 26, padY: 11, fontSize: 14, weight: '600', shadow: 'none'
          })) + '">' + esc(p.btnText || '播放') + '</a></div>';
        break;
      /* 滚动视频：编辑态只挂封面（避免画布反复解码视频卡顿），导出/预览才真正加载 src */
      case 'film': {
        var fSrc = filmSrcOf(p);
        var fPoster = filmPosterOf(p);
        var fMode = p.filmMode || 'scroll';
        var fW = Math.max(20, Math.min(100, Number(p.filmW) || 100));
        var fH = Math.max(120, Number(p.filmH) || 420);
        var vAttrs = ' muted playsinline preload="' + (fMode === 'scroll' ? 'auto' : 'metadata') + '"' +
          (fPoster ? ' poster="' + esc(fPoster) + '"' : '') +
          (fMode === 'loop' ? ' loop' : '') +
          (fMode === 'click' ? ' controls' : '');
        var vSrc = (!editor && fSrc) ? ' src="' + esc(fSrc) + '"' : '';
        var vInner = fSrc ? '' : '<div class="wr-film-empty">在右侧选择或上传视频</div>';
        // 编辑态不挂 src，若用户换了自备视频又没有封面，补一层说明，避免只在画布上看到一块黑
        var noteLayer = (editor && fSrc && !fPoster) ? '<span class="wr-film-note">视频已就绪 · 预览时随滚动播放</span>' : '';
        // 角标只给编辑态看，导出页不出现任何「设置面板里的词」
        var badge = editor
          ? '<span class="wr-film-badge">' + (fMode === 'scroll' ? '随滚动播放' : (fMode === 'loop' ? '循环播放' : '点击播放')) + '</span>'
          : '';
        inner = '<figure class="wr-film" data-mode="' + fMode + '" style="' + css({
          width: fW + '%', margin: '0 auto', 'border-radius': (p.radius || 0) + 'px'
        }) + '">' + '<video class="wr-film-v"' + vAttrs + vSrc + ' style="' + css({
          height: fH + 'px', 'border-radius': (p.radius || 0) + 'px'
        }) + '">' + vInner + '</video>' + noteLayer + badge +
          '<span class="wr-film-scan" aria-hidden="true"></span></figure>';
        break;
      }
      case 'form':
        inner = '<div style="' + css({ 'max-width': '520px', margin: p.align === 'center' ? '0 auto' : '0', color: p.color || page.text, 'text-align': 'left' }) + '">' +
          '<h3 style="margin:0 0 8px;font-size:24px">' + esc(p.title) + '</h3>' +
          '<p style="margin:0 0 22px;font-size:14px;opacity:.72">' + nl(p.desc) + '</p>' +
          // 纯静态演示：不用 <form>，避免点提交把字段拼进 URL 并刷新页面
          '<div class="wr-form" role="group" aria-label="联系表单（演示）" style="display:grid;gap:12px;' + phVars(p) + '">' +
          '<input type="text" aria-label="你的称呼" placeholder="你的称呼" style="' + css(inputSkin(p, { full: true, radius: 8, padX: 13, padY: 11, borderColor: '#d8e2f0' })) + '">' +
          '<input type="email" aria-label="邮箱地址" placeholder="邮箱地址" style="' + css(inputSkin(p, { full: true, radius: 8, padX: 13, padY: 11, borderColor: '#d8e2f0' })) + '">' +
          '<textarea aria-label="想说的话" placeholder="想说的话" rows="3" style="' + css(inputSkin(p, { full: true, radius: 8, padX: 13, padY: 11, borderColor: '#d8e2f0' })) + 'resize:vertical">' + '</textarea>' +
          '<button type="button" style="' + css(btnSkin(p, {
            bg: page.accent, color: '#fff', radius: 8, padX: 12, padY: 12, fontSize: 14, weight: '600', shadow: 'none',
            extra: { cursor: 'pointer' }
          })) + '">' + esc(p.btnText || '提交') + '</button>' +
          '<small style="opacity:.55;font-size:11px">演示表单，未接入后端</small></div></div>';
        break;
      /* ===== 导航与框架 ===== */
      case 'navbar': {
        var navRows = rowCells(p.navItems);
        var navId = 'wr-nav-' + b.id;
        var navLinks = navRows.map(function (r) {
          return '<a href="' + esc(safeUrl(r[1], '#')) + '">' + esc(r[0]) + '</a>';
        }).join('');
        var navBtn = p.btnText ? '<a class="wr-nav-cta" href="' + esc(safeUrl(p.navCtaHref, '#')) + '" style="' + css(btnSkin(p, {
          bg: page.accent, color: '#fff', radius: 9, padX: 18, padY: 9, fontSize: 14, weight: '600', shadow: 'none'
        })) + '">' + esc(p.btnText) + '</a>' : '';
        var navMargin = p.align === 'left' ? 'margin-left:0' : (p.align === 'center' ? 'margin:0 auto' : 'margin-left:auto');
        inner = '<nav class="wr-nav" aria-label="主导航" style="' + css({
          background: paint(p.bg, '#ffffff'), color: p.color || page.text
        }) + '"><div class="wr-nav-inner" style="' + css({
          'min-height': (p.navHeight || 64) + 'px',
          'max-width': (page.maxWidth || 960) + 'px',
          margin: '0 auto',
          padding: '0 ' + (p.padX == null ? 24 : p.padX) + 'px'
        }) + '">' +
          '<a class="wr-nav-brand" href="#top" style="' + css(brandStyle(p, 17)) + '">' +
          mediaHTML(p.emoji, { size: 30, font: 15, cls: 'wr-nav-mark', inline: true, fit: 'contain', alt: p.title }) +
          esc(p.title || '品牌名称') + '</a>' +
          '<input class="wr-nav-cb" type="checkbox" id="' + navId + '" aria-label="展开菜单" hidden>' +
          '<label class="wr-nav-burger" for="' + navId + '" aria-label="打开菜单">☰</label>' +
          '<div class="wr-nav-links" data-wr-list="navItems" style="' + navMargin + ';' + css(navVars(p)) + '">' + navLinks + navBtn + '</div>' +
          '</div></nav>';
        break;
      }
      case 'announce':
        inner = '<div class="wr-announce-inner" style="color:' + esc(p.color || '#fff') + '">' +
          mediaHTML(p.emoji, { size: 20, font: 15, inline: true, fit: 'contain' }) +
          '<span>' + nl(p.text) + '</span>' +
          (p.btnText ? '<a href="' + esc(safeUrl(p.href, '#')) + '" style="' + css(btnSkin(p, {
            auto: 'link', bg: page.accent, color: p.color || '#fff', linkColor: p.color || '#fff',
            radius: 999, padX: 12, padY: 6, fontSize: 13, weight: '600', shadow: 'none'
          })) + '">' + esc(p.btnText) + ' →</a>' : '') +
          '</div>';
        break;
      case 'breadcrumb': {
        var crumbs = rowCells(p.crumbItems);
        inner = '<nav class="wr-crumb" aria-label="面包屑" style="color:' + esc(p.color || page.text) + '">' +
          crumbs.map(function (r, i) {
            var last = i === crumbs.length - 1;
            return (i ? '<span class="wr-sep">/</span>' : '') +
              (last || !r[1] ? '<span class="wr-cur">' + esc(r[0]) + '</span>'
                : '<a href="' + esc(safeUrl(r[1], '#')) + '">' + esc(r[0]) + '</a>');
          }).join('') + '</nav>';
        break;
      }
      case 'footer': {
        var fLinks = rowCells(p.footerLinks).filter(function (r) { return String((r && r[0]) || '').trim(); });
        var hasContact = !!(p.phone || p.email || p.address);
        var fCols = 1 + (fLinks.length ? 1 : 0) + (hasContact ? 1 : 0);
        inner = '<footer style="color:' + esc(p.color || page.text) + ';' + css(footVars(p)) + '">' +
          '<div class="wr-footer-grid wr-cols" style="' + css({ 'grid-template-columns': 'repeat(' + fCols + ',1fr)' }) + '">' +
          '<div><h4>' + esc(p.title || '') + '</h4><p>' + nl(p.desc) + '</p></div>' +
          (fLinks.length ? '<div data-wr-list="footerLinks"><h4>快速链接</h4>' + fLinks.map(function (r) {
            return '<a href="' + esc(safeUrl(r[1], '#')) + '">' + esc(r[0]) + '</a>';
          }).join('') + '</div>' : '') +
          (hasContact ? '<div><h4>联系方式</h4>' +
            (p.phone ? '<p>电话：' + esc(p.phone) + '</p>' : '') +
            (p.email ? '<p>邮箱：' + esc(p.email) + '</p>' : '') +
            (p.address ? '<p>地址：' + esc(p.address) + '</p>' : '') +
            '</div>' : '') +
          '</div>' +
          (p.copyright ? '<div class="wr-footer-bottom">' + esc(p.copyright) + '</div>' : '') +
          '</footer>';
        break;
      }

      /* ===== 内容展示 ===== */
      case 'features': {
        var fRows = rowCells(p.featureItems);
        var fPadX = pnum(p, 'cardPadX', 20, 0, 80), fPadY = pnum(p, 'cardPadY', 20, 0, 80);
        var fTitle = pnum(p, 'cardTitleSize', 16, 8, 40), fText = pnum(p, 'cardTextSize', 13, 8, 40);
        var fIcon = pnum(p, 'cardIconSize', 38, 12, 160);
        inner = head + '<div class="wr-features wr-cols" data-wr-list="featureItems" style="' + css({
          'grid-template-columns': 'repeat(2,1fr)', gap: (p.gap == null ? 14 : p.gap) + 'px', color: p.color || page.text
        }) + '">' + fRows.map(function (r) {
          return '<div class="wr-feature" style="' + css({
            background: paint(p.cardBg, '#f5f8ff'), 'border-radius': (p.radius || 0) + 'px', padding: fPadY + 'px ' + fPadX + 'px'
          }) + '">' + mediaHTML(r[0] || '✓', {
            size: fIcon, font: Math.round(fIcon * 0.5), cls: 'wr-feature-ico', radius: 10, fit: 'contain', alt: r[1]
          }) + '<div><h4 style="font-size:' + fTitle + 'px">' + esc(r[1] || '') + '</h4><p style="font-size:' + fText + 'px">' + esc(r.slice(2).join(' | ')) + '</p></div></div>';
        }).join('') + '</div>';
        break;
      }
      case 'gallery': {
        var gRows = rowCells(p.galleryItems);
        inner = head + '<div class="wr-gallery" data-wr-list="galleryItems" style="' + css({
          'grid-template-columns': gridCols(p.cols, 3), gap: (p.gap == null ? 12 : p.gap) + 'px', color: p.color || page.text
        }) + '">' + gRows.map(function (r) {
          var cap = r.slice(1).join(' | ');
          return '<figure><img src="' + esc(resolveMedia(r[0]) || PLACEHOLDER_IMG) + '" alt="' + esc(cap) +
            '" loading="lazy" decoding="async" style="' +
            css({ 'border-radius': (p.radius || 0) + 'px' }) + '">' +
            (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') + '</figure>';
        }).join('') + '</div>';
        break;
      }
      case 'pricing': {
        var prRows = rowCells(p.priceItems);
        inner = head + '<div class="wr-pricing wr-cols" data-wr-list="priceItems" style="' + css({
          'grid-template-columns': gridCols(Math.min(3, Math.max(1, prRows.length)), 3),
          gap: (p.gap || 16) + 'px', color: p.color || page.text
        }) + '">' + prRows.map(function (r) {
          var feats = String(r[2] || '').split(/[；;\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
          var hot = String(r[4] || '').trim() === '1';
          var pbtn = btnSkin(p, {
            bg: page.accent, color: '#fff', radius: 9, padX: 11, padY: 11, fontSize: 14,
            weight: '600', shadow: 'none', full: true
          });
          if ((!p.btnStyle || p.btnStyle === 'auto') && !hot) {
            pbtn.background = 'rgba(59,130,246,.1)';
            pbtn.color = p.btnColor || p.color || page.text;
            pbtn.border = '0';
            pbtn['box-shadow'] = '';
          }
          return '<div class="wr-price-card" style="' + css({
            background: paint(p.cardBg, '#fff'), 'border-radius': (p.radius || 0) + 'px',
            padding: pnum(p, 'cardPadY', 28, 0, 80) + 'px ' + pnum(p, 'cardPadX', 22, 0, 80) + 'px',
            border: hot ? '2px solid ' + safeCssColor(page.accent) : '1px solid rgba(0,0,0,.08)',
            'box-shadow': hot ? '0 14px 34px rgba(30,80,180,.13)' : ''
          }) + '">' +
            (hot ? '<span class="wr-price-badge">推荐</span>' : '') +
            '<h3 style="margin:0;font-size:' + pnum(p, 'cardTitleSize', 17, 8, 40) + 'px">' + esc(r[0] || '') + '</h3>' +
            '<div class="wr-price-num">' + esc(r[1] || '') + '</div>' +
            '<ul style="font-size:' + pnum(p, 'cardTextSize', 13, 8, 40) + 'px">' + feats.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
            '<a class="wr-price-btn" href="' + esc(safeUrl(p.href, '#')) + '" style="' + css(pbtn) + '">' +
            esc(r[3] || '了解更多') + '</a></div>';
        }).join('') + '</div>';
        break;
      }
      case 'team': {
        var tRows = rowCells(p.teamItems);
        var tPadX = pnum(p, 'cardPadX', 18, 0, 80), tPadY = pnum(p, 'cardPadY', 26, 0, 80);
        var tTitle = pnum(p, 'cardTitleSize', 16, 8, 40), tText = pnum(p, 'cardTextSize', 13, 8, 40);
        var tIcon = pnum(p, 'cardIconSize', 62, 16, 160);
        inner = head + '<div class="wr-team wr-cols" data-wr-list="teamItems" style="' + css({
          'grid-template-columns': gridCols(Math.min(3, Math.max(1, tRows.length)), 3),
          gap: (p.gap || 16) + 'px', color: p.color || page.text
        }) + '">' + tRows.map(function (r) {
          return '<div style="' + css({
            background: paint(p.cardBg, '#f5f8ff'), 'border-radius': (p.radius || 0) + 'px',
            padding: tPadY + 'px ' + tPadX + 'px', 'text-align': 'center'
          }) + '">' + mediaHTML(r[0] || '🙂', {
            size: tIcon, font: Math.round(tIcon * 0.45), cls: 'wr-team-avatar', round: true, alt: r[1]
          }) +
            '<h4 style="margin:0 0 4px;font-size:' + tTitle + 'px">' + esc(r[1] || '') + '</h4>' +
            '<div style="font-size:12px;opacity:.65;margin-bottom:8px">' + esc(r[2] || '') + '</div>' +
            '<p style="margin:0;font-size:' + tText + 'px;line-height:1.7;opacity:.75">' + esc(r.slice(3).join(' | ')) + '</p></div>';
        }).join('') + '</div>';
        break;
      }
      case 'testimonial': {
        var starN = Math.max(0, Math.min(5, Number(p.stars) || 0));
        var tmPadX = pnum(p, 'cardPadX', 30, 0, 80), tmPadY = pnum(p, 'cardPadY', 34, 0, 80);
        var tmText = pnum(p, 'cardTextSize', 19, 8, 40), tmAvatar = pnum(p, 'cardIconSize', 46, 16, 160);
        inner = '<div class="wr-testimonial" style="' + css({
          'max-width': '680px', margin: '0 auto', padding: tmPadY + 'px ' + tmPadX + 'px',
          background: paint(p.cardBg, '#f5f8ff'), 'border-radius': (p.radius || 0) + 'px',
          'text-align': 'center', color: p.color || page.text
        }) + '">' +
          (starN ? '<div class="wr-stars">' + Array(starN + 1).join('★') +
            '<span style="opacity:.22">' + Array(6 - starN).join('★') + '</span></div>' : '') +
          '<blockquote style="font-size:' + tmText + 'px">“' + nl(p.text) + '”</blockquote>' +
          mediaHTML(p.avatar, {
            size: tmAvatar, font: Math.round(tmAvatar * 0.56), round: true, margin: '0 auto', bg: 'rgba(59,130,246,.1)', alt: p.author
          }) +
          '<div style="font-weight:700;font-size:14px;margin-top:6px">' + esc(p.author || '') + '</div>' +
          (p.role ? '<div style="font-size:12px;opacity:.65;margin-top:2px">' + esc(p.role) + '</div>' : '') +
          '</div>';
        break;
      }
      case 'timeline': {
        var tlRows = rowCells(p.timelineItems);
        inner = head + '<div class="wr-timeline" data-wr-list="timelineItems" style="' + css({
          'border-left-color': p.lineColor || '#dbe6f6', color: p.color || page.text,
          'max-width': '720px', margin: '0 auto'
        }) + '">' + tlRows.map(function (r) {
          return '<div class="wr-tl-item"><div class="wr-tl-date">' + esc(r[0] || '') + '</div>' +
            '<h4>' + esc(r[1] || '') + '</h4><p>' + esc(r.slice(2).join(' | ')) + '</p></div>';
        }).join('') + '</div>';
        break;
      }
      case 'progress': {
        var pgRows = rowCells(p.progressItems);
        inner = head + '<div data-wr-list="progressItems" style="' + css({
          'max-width': '680px', margin: '0 auto', color: p.color || page.text
        }) + '">' + pgRows.map(function (r) {
          var n = pct(r[1]);
          return '<div class="wr-pg-row"><div class="wr-pg-label"><span>' + esc(r[0] || '') +
            '</span><span>' + n + '%</span></div><div class="wr-pg-track">' +
            '<div class="wr-pg-fill" style="' + css({ width: n + '%', background: paint(p.barColor, page.accent) }) + '"></div>' +
            '</div></div>';
        }).join('') + '</div>';
        break;
      }
      case 'logos': {
        var lgRows = rowCells(p.logoItems);
        var lgJustify = p.align === 'left' ? 'flex-start' : (p.align === 'right' ? 'flex-end' : 'center');
        inner = head + '<div class="wr-logos" data-wr-list="logoItems" style="' + css({
          gap: (p.gap || 12) + 'px', 'justify-content': lgJustify, color: p.color || page.text
        }) + '">' + lgRows.map(function (r) {
          var st = css({ background: paint(p.cardBg, '#f5f8ff'), 'border-radius': (p.radius || 0) + 'px' });
          var content = isMediaImage(r[0])
            ? (function () {
              var src = resolveMedia(r[0]);
              return src ? '<img class="wr-logo-img" src="' + esc(src) + '" alt="' + esc(r[0]) +
                '" loading="lazy" decoding="async">' : '<span>图片已移除</span>';
            })()
            : esc(r[0]);
          return r[1]
            ? '<a class="wr-logo-item" href="' + esc(safeUrl(r[1], '#')) + '" style="' + st + '">' + content + '</a>'
            : '<span class="wr-logo-item" style="' + st + '">' + content + '</span>';
        }).join('') + '</div>';
        break;
      }
      case 'table': {
        var tb = rowCells(p.tableData);
        var th = tb.length ? tb[0] : [];
        inner = head + '<div class="wr-table-wrap"><table class="wr-table" style="color:' + esc(p.color || page.text) + '">' +
          '<thead><tr>' + th.map(function (c) {
            return '<th style="' + css({ background: paint(p.cardBg, '#eef4ff'), 'border-bottom-color': p.lineColor || '#e2eaf6' }) + '">' + esc(c) + '</th>';
          }).join('') + '</tr></thead><tbody data-wr-list="tableData">' +
          tb.slice(1).map(function (r) {
            return '<tr>' + r.map(function (c) {
              return '<td style="' + css({ 'border-bottom-color': p.lineColor || '#e2eaf6' }) + '">' + esc(c) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>';
        break;
      }
      case 'code':
        inner = '<div class="wr-code" style="' + css({ 'border-radius': (p.radius || 0) + 'px' }) + '">' +
          '<div class="wr-code-bar"><span>' + esc(p.codeLang || 'CODE') + '</span><span class="wr-dots">● ● ●</span></div>' +
          '<pre><code>' + esc(p.codeText || '') + '</code></pre></div>';
        break;

      /* ===== 转化与互动 ===== */
      case 'cta':
        inner = '<div style="' + css({
          background: paint(p.bg, page.accent), 'border-radius': (p.radius || 0) + 'px',
          padding: '44px 30px', color: p.color || '#fff', 'text-align': p.align || 'center'
        }) + '"><h2 style="' + css({ 'font-size': clampFont(32), margin: '0 0 12px' }) + '">' + nl(p.title) + '</h2>' +
          (p.desc ? '<p style="' + css({ 'font-size': '15px', margin: '0 0 26px', opacity: '.85' }) + '">' + nl(p.desc) + '</p>' : '') +
          (p.btnText ? '<a href="' + esc(safeUrl(p.href, '#')) + '" style="' + css(btnSkin(p, {
            bg: '#ffffff', color: '#1b3b6f', radius: 10, padX: 28, padY: 12, fontSize: 15, weight: '700', shadow: 'none'
          })) + '">' + esc(p.btnText) + '</a>' : '') + '</div>';
        break;
      case 'buttongroup': {
        var bgRows = rowCells(p.btnItems);
        var bgJustify = p.align === 'left' ? 'flex-start' : (p.align === 'right' ? 'flex-end' : 'center');
        inner = head + '<div class="wr-btns" data-wr-list="btnItems" style="' + css({
          display: 'flex', 'flex-wrap': 'wrap', gap: (p.gap || 12) + 'px', 'justify-content': bgJustify
        }) + '">' + bgRows.map(function (r) {
          var primary = String(r[2] || '').trim() === '1';
          return '<a href="' + esc(safeUrl(r[1], '#')) + '" style="' + css(btnSkin(p, {
            auto: primary ? 'solid' : 'outline', bg: page.accent, color: '#fff',
            radius: 10, padX: 24, padY: 11, fontSize: 14, weight: '600', shadow: 'none'
          })) + '">' + esc(r[0] || '按钮') + '</a>';
        }).join('') + '</div>';
        break;
      }
      case 'faq': {
        var fqRows = rowCells(p.faqItems);
        inner = head + '<div class="wr-faq" data-wr-list="faqItems" style="' + css({
          'max-width': '760px', margin: '0 auto', gap: (p.gap || 10) + 'px', color: p.color || page.text
        }) + '">' + fqRows.map(function (r, i) {
          return '<details' + (p.openFirst === '1' && i === 0 ? ' open' : '') + ' style="' + css({
            background: paint(p.cardBg, '#f5f8ff'), 'border-radius': (p.radius || 0) + 'px'
          }) + '"><summary>' + esc(r[0] || '') + '</summary>' +
            '<div class="wr-faq-body">' + nl(r.slice(1).join(' | ')) + '</div></details>';
        }).join('') + '</div>';
        break;
      }
      case 'notice': {
        var tones = {
          info: ['#e8f2ff', '#2c6ecb', 'ℹ'],
          success: ['#e7f7ee', '#1f8a53', '✓'],
          warning: ['#fff4e2', '#b96a08', '⚠'],
          danger: ['#ffecea', '#c43c2b', '✕']
        };
        var t = tones[p.noticeType] || tones.info;
        inner = '<div class="wr-notice" style="' + css({
          background: t[0], 'border-left': '4px solid ' + t[1], color: t[1],
          'border-radius': (p.radius || 0) + 'px', padding: '16px 20px'
        }) + '"><span class="wr-notice-ico">' + mediaHTML(p.noticeIcon || t[2], {
          size: 22, font: 19, inline: true, fit: 'contain'
        }) + '</span><div>' +
          (p.title ? '<b>' + esc(p.title) + '</b>' : '') +
          '<p>' + nl(p.text) + '</p></div></div>';
        break;
      }
      case 'contact': {
        var cItems = [['✆', '电话', p.phone], ['✉', '邮箱', p.email], ['⌖', '地址', p.address]]
          .map(function (x, i) { return { glyph: x[0], label: x[1], val: x[2], idx: i }; })
          .filter(function (x) { return x.val; });
        var cIcons = String(p.contactIcons || '').split('|').map(function (s) { return s.trim(); });
        inner = head + '<div class="wr-contact wr-cols" style="' + css({
          'grid-template-columns': 'repeat(' + Math.max(1, Math.min(3, cItems.length)) + ',1fr)',
          gap: (p.gap || 16) + 'px', color: p.color || page.text
        }) + '">' + cItems.map(function (x) {
          return '<div class="wr-contact-item" style="' + css({
            background: paint(p.cardBg, '#f5f8ff'), 'border-radius': (p.radius || 0) + 'px', padding: '24px 16px'
          }) + '">' + mediaHTML(cIcons[x.idx] || x.glyph, {
            size: 28, font: 24, margin: '0 auto 8px', fit: 'contain', alt: x.label
          }) + '<b>' + x.label + '</b><span>' + esc(x.val) + '</span></div>';
        }).join('') + '</div>';
        break;
      }
      /* ===== 社区与产品组件 ===== */
      case 'hotlist': {
        var rowsH = rowCells(p.hotItems).slice(0, 12);
        inner = head + '<ol class="wr-hotlist" data-wr-list="hotItems" style="' + css({
          display: 'grid', gap: (p.gap == null ? 8 : p.gap) + 'px', margin: '0', padding: '0',
          'list-style': 'none', 'counter-reset': 'wrHot', color: p.color || page.text
        }) + '">' + rowsH.map(function (r, i) {
          var tone = r[2] || '';
          return '<li class="wr-hot-row" style="' + css({
            display: 'grid', 'grid-template-columns': '30px 1fr auto auto', gap: '12px',
            'align-items': 'center', padding: '11px 14px', background: paint(p.cardBg, '#ffffff'),
            'border-radius': (p.radius || 12) + 'px'
          }) + '">' +
            '<b class="wr-hot-rank wr-rank-' + Math.min(i + 1, 4) + '">' + (i + 1) + '</b>' +
            '<span class="wr-hot-title">' + esc(r[0]) + '</span>' +
            (tone ? '<i class="wr-hot-badge" data-tone="' + esc(tone) + '">' + esc(tone) + '</i>' : '') +
            '<span class="wr-hot-heat">' + esc(r[1]) + '</span></li>';
        }).join('') + '</ol>';
        break;
      }
      case 'feed': {
        var rowsF = rowCells(p.feedItems).slice(0, 10);
        var isX = String(p.feedStyle || 'weibo') === 'x';
        inner = '<div class="wr-feed' + (isX ? ' is-x' : '') + '" data-wr-list="feedItems" style="' + css({
          display: 'grid', gap: (p.gap == null ? 16 : p.gap) + 'px', color: p.color || page.text
        }) + '">' + rowsF.map(function (r) {
          var likes = parseInt(r[7], 10) || 0;
          var pic = resolveMedia(r[4]);
          return '<article class="wr-post" style="' + css({
            background: paint(p.cardBg, '#ffffff'), 'border-radius': (p.radius || 16) + 'px',
            padding: isX ? '18px' : '22px'
          }) + '">' +
            '<div class="wr-post-head">' + mediaHTML(r[0], { size: isX ? 42 : 46, round: true, font: 22, alt: r[1] }) +
            '<div class="wr-post-who"><b>' + esc(r[1] || '匿名用户') + '</b>' +
            (isX ? '<span>@' + esc(String(r[1] || 'user').replace(/\s/g, '').slice(0, 12)) + '</span>' : '') +
            '<time>' + esc(r[2]) + '</time></div>' +
            (isX ? '<span class="wr-post-xmark">𝕏</span>' : '<span class="wr-post-more">⋯</span>') + '</div>' +
            '<div class="wr-post-text">' + nl(r[3]) + '</div>' +
            (pic ? '<img class="wr-post-img" src="' + esc(pic) + '" alt="" loading="lazy" decoding="async">' : '') +
            '<div class="wr-post-actions">' +
            [['↻', r[5] || '0', '转发'], ['💬', r[6] || '0', '评论'], ['♡', String(likes), '赞']].map(function (a, k) {
              return '<button type="button" class="wr-post-act' + (k === 2 ? ' wr-like' : '') + '"' +
                (k === 2 ? ' data-like="1" data-count="' + likes + '"' : '') + ' aria-label="' + a[2] + '">' +
                '<i>' + a[0] + '</i><span>' + esc(a[1]) + '</span></button>';
            }).join('') + '</div></article>';
        }).join('') + '</div>';
        break;
      }
      case 'qa': {
        var tagsQ = tagList(p.qaTags, 'wr-tag wr-qa-tag');
        inner = '<article class="wr-qa" style="' + css({
          background: paint(p.cardBg, '#ffffff'), 'border-radius': (p.radius || 16) + 'px',
          padding: '30px', color: p.color || page.text
        }) + '">' +
          '<h2 class="wr-qa-title">' + esc(p.qaQuestion) + '</h2>' +
          '<div class="wr-qa-author">' + mediaHTML(p.qaAvatar, { size: 44, round: true, font: 22, alt: p.qaAuthor }) +
          '<div><b>' + esc(p.qaAuthor) + '</b><small>' + esc(p.qaBio) + '</small></div></div>' +
          '<div class="wr-qa-body">' + nl(p.qaText) + '</div>' +
          (tagsQ ? '<div class="wr-tags">' + tagsQ + '</div>' : '') +
          '<div class="wr-qa-actions">' +
          '<button type="button" class="wr-vote" data-like="1" data-count="' + (parseInt(String(p.qaVote).replace(/[^\d]/g, ''), 10) || 0) + '">' +
          '▲ 赞同 <b>' + esc(p.qaVote) + '</b></button>' +
          '<span class="wr-qa-comments">💬 ' + esc(p.qaComments) + ' 条评论</span>' +
          '<span class="wr-qa-more">···</span></div></article>';
        break;
      }
      case 'rating': {
        var rowsR = rowCells(p.ratingItems).slice(0, 8);
        inner = head + '<div class="wr-rating-list" data-wr-list="ratingItems" style="display:grid;gap:' + (p.gap == null ? 16 : p.gap) + 'px">' +
          rowsR.map(function (r) {
            var cover = resolveMedia(r[3]);
            return '<article class="wr-rating-item" style="' + css({
              display: 'grid', 'grid-template-columns': '76px 1fr', gap: '16px', padding: '16px',
              background: paint(p.cardBg, '#ffffff'), 'border-radius': (p.radius || 14) + 'px'
            }) + '">' +
              (cover ? '<img class="wr-rating-cover" src="' + esc(cover) + '" alt="" loading="lazy" decoding="async">' :
                '<div class="wr-rating-cover wr-rating-ph">' + esc(String(r[0] || '?').slice(0, 1)) + '</div>') +
              '<div><div class="wr-rating-head"><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></div>' +
              '<div class="wr-rating-score">' + ratingStars(parseFloat(r[2], 10)) + '<strong>' + esc(r[2]) + '</strong></div>' +
              '<p>' + esc(r[4]) + '</p></div></article>';
          }).join('') + '</div>';
        break;
      }
      case 'search': {
        var act = safeUrl(p.searchAction, '');
        var suggest = tagList(p.searchSuggest, 'wr-tag wr-search-tag');
        inner = '<div class="wr-search" style="' + css({ color: p.color || page.text }) + '">' +
          (p.title ? '<h2 style="' + css({ 'font-size': clampFont(36), margin: '0 0 12px', 'text-align': 'center' }) + '">' + esc(p.title) + '</h2>' : '') +
          (p.desc ? '<p class="wr-search-desc">' + esc(p.desc) + '</p>' : '') +
          '<form class="wr-search-form" data-wr-search="1" action="' + esc(act || '#') + '" method="get" style="' + css({
            display: 'flex', gap: '10px', 'max-width': '720px', margin: '26px auto 0', padding: '8px',
            background: '#ffffff', 'border-radius': (p.radius == null || p.radius > 48 ? 999 : p.radius) + 'px',
            'box-shadow': '0 18px 50px -24px rgba(20,40,80,.5)'
          }) + ';' + phVars(p) + '">' +
          '<input type="search" name="q" placeholder="' + esc(p.searchPlaceholder || '搜索') + '" aria-label="搜索" style="' +
          css(inputSkin(p, { bg: 'transparent', borderWidth: 0, radius: 999, padX: 16, padY: 13, fontSize: 16, flex: '1' })) + '">' +
          '<button type="submit" style="' + css(btnSkin(p, {
            bg: page.accent, color: '#fff', radius: 999, padX: 26, padY: 13, fontSize: 15, weight: '600', shadow: 'none',
            extra: { border: '0', cursor: 'pointer' }
          })) + '">' + esc(p.searchBtn || '搜索') + '</button></form>' +
          (suggest ? '<div class="wr-tags wr-search-tags">' + suggest + '</div>' : '') + '</div>';
        break;
      }
      case 'repo': {
        var topics = tagList(p.repoTopics, 'wr-tag wr-repo-topic');
        var langColor = { JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Go: '#00ADD8', Rust: '#dea584', HTML: '#e34c26', CSS: '#563d7c' }[p.repoLang] || '#8b949e';
        inner = '<article class="wr-repo" style="' + css({
          background: paint(p.cardBg, '#ffffff'), 'border-radius': (p.radius || 14) + 'px',
          padding: '28px', color: p.color || '#24292f'
        }) + '">' +
          '<div class="wr-repo-top"><span class="wr-repo-mark">⌥</span>' +
          '<div><span class="wr-repo-owner">' + esc(p.repoOwner) + ' /</span> <b>' + esc(p.repoName) + '</b></div>' +
          '<span class="wr-repo-public">Public</span></div>' +
          '<p class="wr-repo-desc">' + esc(p.repoDesc) + '</p>' +
          (topics ? '<div class="wr-tags">' + topics + '</div>' : '') +
          '<div class="wr-repo-stats">' +
          '<span title="Star">★ ' + esc(p.repoStars) + '</span><span title="Fork">⑂ ' + esc(p.repoForks) +
          '</span><span title="Issue">◉ ' + esc(p.repoIssues) + '</span>' +
          '<span class="wr-repo-lang"><i style="background:' + safeCssValue(langColor) + '"></i>' + esc(p.repoLang) + '</span></div>' +
          '<div class="wr-repo-foot">更新于 ' + esc(p.repoUpdated) + ' · 由 WR Studio 生成</div></article>';
        break;
      }
      case 'wiki': {
        var inf = rowCells(p.wikiInfobox).slice(0, 10);
        var toc = rowsOf(p.wikiToc).slice(0, 10);
        var body = String(p.wikiBody || '').split(/\n\s*\n/).map(function (l) { return l.trim(); }).filter(Boolean);
        inner = '<article class="wr-wiki" style="' + css({
          display: 'grid', 'grid-template-columns': 'minmax(0,1fr) 260px', gap: '30px',
          background: paint(p.cardBg, '#ffffff'), color: p.color || '#202122',
          border: '1px solid ' + safeCssValue(p.lineColor || '#d8dee4')
        }) + '"><div class="wr-wiki-main">' +
          head +
          '<p class="wr-wiki-lead">' + esc(p.wikiLead) + '</p>' +
          (toc.length ? '<nav class="wr-wiki-toc" data-wr-list="wikiToc"><b>目录</b>' + toc.map(function (c) {
            var tl = String(c[0] || '');
            var lv = Math.min(3, Math.max(1, Number(c[1]) || 1));
            return '<a href="#' + esc(tl.replace(/[^\w\u4e00-\u9fa5-]/g, '').slice(0, 20)) + '" class="wr-toc-' + lv + '">' + esc(tl) + '</a>';
          }).join('') + '</nav>' : '') +
          body.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>' +
          '<aside class="wr-wiki-info" data-wr-list="wikiInfobox"><b>' + esc(p.title || '条目') + '</b>' +
          inf.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') +
          '</aside></article>';
        break;
      }
      case 'chat': {
        var mem = rowCells(p.chatMembers).slice(0, 8);
        var msgs = rowCells(p.chatItems).slice(0, 20);
        var roleColor = function (v) { return /^#[0-9a-f]{3,8}$/i.test(v || '') ? v : '#a78bfa'; };
        inner = '<div class="wr-chat" style="' + css({
          display: 'grid', 'grid-template-columns': '190px minmax(0,1fr)', overflow: 'hidden',
          background: paint(p.cardBg, '#313338'), color: p.color || '#f2f3f5', 'border-radius': (p.radius || 14) + 'px'
        }) + '">' +
          '<aside class="wr-chat-side" data-wr-list="chatMembers"><b class="wr-chat-server"># ' + esc(p.chatServer) + '</b>' +
          '<div class="wr-chat-channel">＃ ' + esc(p.chatChannel) + '</div><div class="wr-chat-side-label">在线 — ' + mem.length + '</div>' +
          mem.map(function (r) {
            return '<div class="wr-chat-member">' + mediaHTML(r[0], { size: 24, round: true, font: 13, alt: r[1] }) +
              '<span>' + esc(r[1]) + '</span><i class="wr-online"></i></div>';
          }).join('') + '</aside>' +
          '<div class="wr-chat-main"><div class="wr-chat-head">＃ ' + esc(p.chatChannel) + '<small>一个专注于交流与分享的频道</small></div>' +
          '<div class="wr-chat-msgs" data-wr-list="chatItems">' + msgs.map(function (r) {
            return '<div class="wr-chat-msg">' + mediaHTML(r[0], { size: 36, round: true, font: 18, alt: r[1] }) +
              '<div><p><b style="color:' + safeCssValue(roleColor(r[4])) + '">' + esc(r[1]) + '</b><time>' + esc(r[2]) + '</time></p>' +
              '<div class="wr-chat-text">' + esc(r[3]) + '</div></div></div>';
          }).join('') + '</div>' +
          '<div class="wr-chat-composer"><input type="text" placeholder="给 #' + esc(p.chatChannel) + ' 发消息" aria-label="输入消息">' +
          '<button type="button" data-chat-send="1">发送</button></div></div></div>';
        break;
      }
      case 'awards': {
        var rowsA = rowCells(p.awardItems).slice(0, 8);
        inner = '<div class="wr-awards" style="' + css({ color: p.color || '#fff' }) + '">' +
          head + (p.awardDesc ? '<p class="wr-awards-desc">' + esc(p.awardDesc) + '</p>' : '') +
          '<div class="wr-awards-grid" data-wr-list="awardItems" style="display:grid;grid-template-columns:repeat(' +
          Math.min(2, Math.max(1, Math.ceil(rowsA.length / 2))) + ',minmax(0,1fr));gap:' + (p.gap || 14) + 'px">' +
          rowsA.map(function (r, i) {
            var cover = resolveMedia(r[0]);
            return '<article class="wr-award ' + (i % 3 === 0 ? 'is-wide' : '') + '" style="' + css({
              background: paint(p.cardBg, '#111318'), 'border-radius': (p.radius || 16) + 'px', overflow: 'hidden'
            }) + '">' + (cover ? '<img src="' + esc(cover) + '" alt="" loading="lazy" decoding="async">' :
              '<div class="wr-award-cover wr-award-ph ' + (i % 4) + '">' + esc(String(r[1] || 'W').slice(0, 1)) + '</div>') +
              '<div class="wr-award-info"><small>' + esc(r[3]) + '</small><h3>' + esc(r[1]) + '</h3><span>' + esc(r[2]) + '</span></div></article>';
          }).join('') + '</div></div>';
        break;
      }
      case 'marquee': {
        var words = rowsOf(p.marqueeText).map(function (r) { return String(r[0] || '').trim(); })
          .filter(Boolean).join(' · ');
        var track = '<span>' + esc(words) + '</span><span aria-hidden="true">' + esc(words) + '</span>';
        inner = '<div class="wr-marquee' + (String(p.marqueeDir) === 'right' ? ' is-right' : '') + '" style="' + css({
          '--wr-marquee-dur': Math.max(8, Math.min(80, Number(p.marqueeSpeed) || 24)) + 's',
          color: p.color || page.text
        }) + '"><div class="wr-marquee-track">' + track + '</div></div>';
        break;
      }
      /* ===== 视觉实验组件 ===== */
      case 'brandwall': {
        var bwRows = rowCells(p.brandItems).slice(0, 16);
        var bwCard = function (r) {
          var logo = isMediaImage(r[0])
            ? (function () { var s = resolveMedia(r[0]); return s ? '<img class="wr-brand-logo" src="' + esc(s) + '" alt="' + esc(r[0]) + '" loading="lazy" decoding="async">' : '<span>' + esc(r[0]) + '</span>'; })()
            : '<span class="wr-brand-word">' + esc(r[0] || 'BRAND') + '</span>';
          var content = '<span class="wr-brand-mark">' + logo + '</span>' +
            (r[2] ? '<small>' + esc(r[2]) + '</small>' : '');
          var st = css({ background: paint(p.cardBg, '#ffffff'), 'border-radius': (p.radius || 14) + 'px' });
          return r[1]
            ? '<a class="wr-brand-card" href="' + esc(safeUrl(r[1], '#')) + '" style="' + st + '">' + content + '</a>'
            : '<div class="wr-brand-card" style="' + st + '">' + content + '</div>';
        };
        if (String(p.brandStyle) === 'marquee') {
          var bwTrack = bwRows.map(bwCard).join('');
          inner = head + '<div class="wr-brandwall is-marquee" style="' + css({
            '--wr-brand-dur': Math.max(10, Math.min(80, Number(p.brandSpeed) || 28)) + 's', gap: (p.gap || 14) + 'px'
          }) + '"><div class="wr-brand-track" data-wr-list="brandItems">' + bwTrack + '</div><div class="wr-brand-track" data-wr-list="brandItems" aria-hidden="true">' + bwTrack + '</div></div>';
        } else {
          inner = head + '<div class="wr-brandwall" data-wr-list="brandItems" style="' + css({
            display: 'grid', 'grid-template-columns': gridCols(p.brandCols, 5),
            gap: (p.gap || 12) + 'px', color: p.color || page.text
          }) + '">' + bwRows.map(bwCard).join('') + '</div>';
        }
        break;
      }
      case 'futype': {
        var ftLines = String(p.futypeText || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 4);
        var ftStyle = String(p.futypeStyle || 'neon');
        var ftSize = Math.max(36, Math.min(140, Number(p.futypeSize) || 96));
        inner = '<div class="wr-futype" data-style="' + esc(ftStyle) + '" style="' + css({
          '--wr-ft-size': ftSize + 'px', color: p.color || '#e8f2ff'
        }) + '">' +
          (ftLines.length
            ? ftLines.map(function (line, i) {
              return '<div class="wr-futype-line" data-text="' + esc(line) + '" style="--wr-ft-i:' + i + '">' + esc(line) + '</div>';
            }).join('')
            : '<div class="wr-futype-line" data-text="FUTURE">FUTURE</div>') +
          (p.futypeSub ? '<div class="wr-futype-sub">' + esc(p.futypeSub) + '</div>' : '') +
          '<span class="wr-futype-grid" aria-hidden="true"></span></div>';
        break;
      }
      case 'geometry': {
        var gsRows = rowCells(p.shapeItems).slice(0, 8);
        var gsKinds = { '圆': 'circle', '方形': 'square', '方': 'square', '三角': 'triangle', '三角形': 'triangle', '六边形': 'hexagon', '环': 'ring', '环形': 'ring', '水滴': 'drop' };
        inner = head + '<div class="wr-geometry" data-wr-list="shapeItems" style="' + css({
          '--wr-shape-size': Math.max(60, Math.min(240, Number(p.shapeSize) || 150)) + 'px',
          '--wr-shape-dur': Math.max(4, Math.min(24, Number(p.shapeSpeed) || 12)) + 's',
          color: p.color || page.text
        }) + '">' + gsRows.map(function (r, i) {
          var kind = gsKinds[String(r[0] || '').trim()] || 'circle';
          var fill = /^#|^rgb|^linear|^radial/i.test(String(r[1] || '').trim()) ? r[1] : (p.shapeFill || '#3b82f6');
          return '<span class="wr-shape" data-kind="' + kind + '" style="' + css({
            '--wr-shape-color': paint(fill, '#3b82f6'), '--wr-shape-i': i
          }) + '"><i></i></span>';
        }).join('') + '</div>';
        break;
      }
      case 'kinetic': {
        var kStyle = String(p.kineticStyle || 'orbit');
        var kLines = String(p.kineticText || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 3);
        var kText = kLines.join(' / ') || 'MOTION';
        var kInner = kStyle === 'wave'
          ? '<div class="wr-wave">' + Array(22 + 1).join('<i></i>') + '</div>'
          : (kStyle === 'ticker'
            ? '<div class="wr-kticker"><span>' + esc(kText) + ' · </span><span aria-hidden="true">' + esc(kText) + ' · </span></div>'
            : '<div class="wr-orbit"><i></i><i></i><i></i><b aria-hidden="true"></b></div>');
        inner = '<div class="wr-kinetic" data-style="' + esc(kStyle) + '" style="' + css({
          '--wr-kin-dur': Math.max(4, Math.min(30, Number(p.kineticSpeed) || 12)) + 's', color: p.color || '#fff'
        }) + '">' + kInner +
          (kStyle !== 'ticker' ? '<div class="wr-kinetic-title">' + kLines.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>' : '') +
          '</div>';
        break;
      }
      case 'hires': {
        var hrSrc = resolveMedia(p.hiSrc) || HIRES_IMG;
        var ratio = { wide: '16 / 9', pano: '21 / 9', square: '1 / 1', portrait: '3 / 4' }[p.hiRatio] || '16 / 9';
        inner = '<figure class="wr-hires" style="' + css({
          margin: '0', 'border-radius': (p.radius || 16) + 'px', overflow: 'hidden', background: '#0b1220'
        }) + '">' +
          '<div class="wr-hires-frame" style="' + css({
            'aspect-ratio': ratio, 'max-height': Math.max(220, Math.min(900, Number(p.hiHeight) || 520)) + 'px'
          }) + '">' +
          '<img src="' + esc(hrSrc) + '" alt="' + esc(p.hiAlt || '高分辨率图片') + '" loading="lazy" decoding="async" ' +
          'srcset="' + esc(hrSrc) + ' 1x, ' + esc(hrSrc) + ' 2x" ' +
          'style="' + css({ width: '100%', height: '100%', 'object-fit': 'cover', 'object-position': '50% ' + Math.max(0, Math.min(100, Number(p.hiFocusY) || 50)) + '%' }) + '">' +
          (String(p.hiOverlay) === '1' ? '<span class="wr-hires-shade" aria-hidden="true"></span>' : '') +
          '</div>' +
          (p.hiCaption ? '<figcaption>' + esc(p.hiCaption) + '</figcaption>' : '') + '</figure>';
        break;
      }
      case 'object3d': {
        var oSize = Math.max(100, Math.min(360, Number(p.objSize) || 220));
        var oShape = String(p.objShape || 'cube');
        var oStyle = css({
          '--wr-obj-size': oSize + 'px', '--wr-obj-dur': Math.max(4, Math.min(30, Number(p.objSpeed) || 12)) + 's',
          '--wr-obj-c1': paint(p.objColor1, '#3b82f6'), '--wr-obj-c2': paint(p.objColor2, '#8b5cf6'),
          color: p.color || '#dbe8ff'
        });
        var oBody = oShape === 'cube'
          ? '<div class="wr-cube"><i class="f1"></i><i class="f2"></i><i class="f3"></i><i class="f4"></i><i class="f5"></i><i class="f6"></i></div>'
          : (oShape === 'pyramid'
            ? '<div class="wr-pyramid"><i></i><i></i><i></i><i></i></div>'
            : (oShape === 'sphere' ? '<div class="wr-sphere3d"></div>' : '<div class="wr-ring3d"><i></i><i></i><i></i></div>'));
        inner = '<div class="wr-object3d" data-shape="' + esc(oShape) + '" data-tilt="' + (String(p.objTilt) === '1' ? '1' : '0') + '" style="' + oStyle + '">' +
          '<div class="wr-obj-stage">' + oBody + '</div>' +
          (p.objLabel ? '<p class="wr-obj-label">' + esc(p.objLabel) + '</p>' : '') + '</div>';
        break;
      }
      case 'profilecard': {
        var avatar = resolveMedia(p.cardAvatar);
        var initial = String(p.cardName || '我').slice(0, 1);
        var avHTML = avatar
          ? '<span class="wr-pc-avatar has-img"><img src="' + esc(avatar) + '" alt="' + esc(p.cardName || '头像') + '"></span>'
          : '<span class="wr-pc-avatar">' + esc(initial) + '</span>';
        var links = rowCells(p.cardLinks).map(function (r) {
          return '<a href="' + esc(safeUrl(r[1])) + '">' + esc(r[0] || '链接') + '</a>';
        }).join('');
        inner = '<div class="wr-profilecard' + (String(p.cardLayout) === 'left' ? ' is-left' : '') + '">' +
          avHTML +
          '<h2 class="wr-pc-name">' + esc(p.cardName || '我的名字') +
          (String(p.cardVerified) !== '0' ? '<span class="wr-pc-verified" title="已认证">✓</span>' : '') + '</h2>' +
          (p.cardRole ? '<p class="wr-pc-role">' + esc(p.cardRole) + '</p>' : '') +
          (p.cardBio ? '<p class="wr-pc-bio">' + nl(p.cardBio) + '</p>' : '') +
          (links ? '<div class="wr-pc-links" data-wr-list="cardLinks">' + links + '</div>' : '') +
          '</div>';
        break;
      }
      case 'skillbar': {
        var skillRows = rowCells(p.skillItems).map(function (r) {
          var pct = Math.round(clampNum(parseFloat(r[1]), 0, 100));
          return '<div class="wr-skill" data-pct="' + pct + '">' +
            '<div class="wr-skill-top"><b>' + esc(r[0] || '技能') + '</b><span>' + pct + '%</span></div>' +
            '<div class="wr-skill-track"><i style="width:' + (String(p.skillAnimate) === '0' ? pct + '%' : '0') +
            ';--wr-skill-w:' + pct + '%"></i></div></div>';
        }).join('');
        inner = '<div class="wr-skillbar"' + (String(p.skillAnimate) !== '0' ? ' data-animate="1"' : '') + '>' +
          (p.skillTitle ? '<h2>' + esc(p.skillTitle) + '</h2>' : '') +
          '<div class="wr-skills" data-wr-list="skillItems">' + (skillRows || '<p class="wr-empty">在右侧填写技能，每行「名称 | 熟练度」</p>') + '</div></div>';
        break;
      }
      case 'journey': {
        var events = rowCells(p.tlItems).map(function (r) {
          return '<div class="wr-jy-item"><span class="wr-jy-dot"></span>' +
            '<div class="wr-jy-year">' + esc(r[0] || '') + '</div>' +
            '<div class="wr-jy-body"><h3>' + esc(r[1] || '') + '</h3>' +
            (r[2] ? '<p>' + esc(r[2]) + '</p>' : '') + '</div></div>';
        }).join('');
        inner = '<div class="wr-journey">' +
          (p.tlTitle ? '<h2>' + esc(p.tlTitle) + '</h2>' : '') +
          '<div class="wr-jy-list" data-wr-list="tlItems">' + (events || '<p class="wr-empty">在右侧填写经历，每行「年份 | 标题 | 说明」</p>') + '</div></div>';
        break;
      }
      case 'linkhub': {
        var lhBtn = css(btnSkin(p, {
          bg: p.linkBtnBg || '#ffffff', color: p.linkBtnColor || '#1f2a44',
          radius: String(p.linkShape) === 'round' ? 12 : 16,
          padX: 20, padY: 14, fontSize: 15, weight: '700', shadow: 'soft', full: true,
          extra: { display: 'flex', 'align-items': 'center', gap: '12px', 'text-align': 'left' }
        }));
        var linkBtns = rowCells(p.linkItems).map(function (r) {
          var ico = r[2] || '↗';
          return '<a class="wr-lh-btn" href="' + esc(safeUrl(r[1])) + '" style="' + lhBtn + '">' +
            '<span class="wr-lh-ico">' + esc(ico) + '</span><span>' + esc(r[0] || '链接') + '</span><b>↗</b></a>';
        }).join('');
        inner = '<div class="wr-linkhub' + (String(p.linkShape) === 'round' ? ' is-round' : '') + '">' +
          (p.cardAvatar ? '<span class="wr-lh-avatar"><img src="' + esc(resolveMedia(p.cardAvatar) || '') + '" alt=""></span>' : '') +
          (p.linkTitle ? '<h2>' + esc(p.linkTitle) + '</h2>' : '') +
          (p.linkBio ? '<p class="wr-lh-bio">' + esc(p.linkBio) + '</p>' : '') +
          '<div class="wr-lh-btns" data-wr-list="linkItems">' + (linkBtns || '<p class="wr-empty">在右侧填写链接按钮</p>') + '</div></div>';
        break;
      }
      case 'tagcloud': {
        var tags = rowCells(p.tagItems).map(function (r) {
          var w = Math.round(clampNum(parseFloat(r[1]) || 3, 1, 5));
          var col = r[2] ? safeCssColor(r[2]) : '';
          return '<span class="wr-tag-i w' + w + '"' + (col ? ' style="--wr-tag-c:' + esc(col) + '"' : '') + '>' + esc(r[0] || '标签') + '</span>';
        }).join('');
        inner = '<div class="wr-tagcloud' + (String(p.tagStyle) === 'card' ? ' is-card' : '') +
          (String(p.tagSpread) === 'center' ? ' is-center' : '') + '">' +
          (p.tagTitle ? '<h2>' + esc(p.tagTitle) + '</h2>' : '') +
          '<div class="wr-tags" data-wr-list="tagItems">' + (tags || '<p class="wr-empty">在右侧填写标签</p>') + '</div></div>';
        break;
      }
      case 'statboard': {
        var cols = Math.round(clampNum(p.statCols, 2, 5));
        var stats = rowCells(p.statItems).map(function (r) {
          return '<div class="wr-stat"><strong>' + esc(r[0] || '0') + (r[1] ? '<em>' + esc(r[1]) + '</em>' : '') +
            '</strong><span>' + esc(r[2] || '') + '</span></div>';
        }).join('');
        inner = '<div class="wr-statboard' + (String(p.statDivider) !== '0' ? ' has-divider' : '') + '">' +
          (p.statTitle ? '<h2>' + esc(p.statTitle) + '</h2>' : '') +
          '<div class="wr-stats" data-wr-list="statItems" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' +
          (stats || '<p class="wr-empty">在右侧填写数据</p>') + '</div></div>';
        break;
      }
      case 'polaroid': {
        var cols = Math.round(clampNum(p.polarCols, 2, 5));
        var photos = rowCells(p.polarItems).map(function (r) {
          var src = resolveMedia(r[0]) || PLACEHOLDER_IMG;
          var ang = clampNum(parseFloat(r[2]) || 0, -15, 15);
          return '<figure class="wr-polar"' + (String(p.polarTilt) !== '0' ? ' style="--wr-ang:' + ang + 'deg"' : '') + '>' +
            '<span class="wr-polar-img"><img src="' + esc(src) + '" alt="' + esc(r[1] || '照片') + '" loading="lazy" decoding="async"></span>' +
            (r[1] ? '<figcaption>' + esc(r[1]) + '</figcaption>' : '') + '</figure>';
        }).join('');
        inner = '<div class="wr-polaroid">' +
          (p.polarTitle ? '<h2>' + esc(p.polarTitle) + '</h2>' : '') +
          '<div class="wr-polars" data-wr-list="polarItems" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' +
          (photos || '<p class="wr-empty">在右侧填写照片地址与说明</p>') + '</div></div>';
        break;
      }
      case 'colorswitch': {
        var swRows = rowCells(p.swColors);
        var sz = Math.round(clampNum(p.swSize, 20, 56));
        var dots = swRows.map(function (r) {
          var col = safeCssColor(r[0], '#3b82f6');
          return '<button type="button" class="wr-sw-dot" data-wr-color="' + esc(col) + '"' +
            ' style="--wr-dot:' + esc(col) + ';width:' + sz + 'px;height:' + sz + 'px"' +
            ' title="' + esc(r[1] || col) + '" aria-label="切换到' + esc(r[1] || col) + '"></button>';
        }).join('');
        inner = '<div class="wr-colorswitch" data-wr-colorswitch="1" style="' + css({
          'text-align': cv(p, 'swAlign') || 'center', 'border-radius': (p.radius || 18) + 'px',
          background: paint(p.cardBg, '#ffffff'), color: p.color || page.text
        }) + '">' + (p.swLabel ? '<div class="wr-sw-title">' + esc(p.swLabel) + '</div>' : '') +
          '<div class="wr-sw-dots' + (String(p.swShape) === 'square' ? ' is-square' : '') + '" data-wr-list="swColors">' +
          (dots || '<p class="wr-empty">在右侧填写可选颜色</p>') + '</div>' +
          (String(p.swShowName) !== '0' ? '<div class="wr-sw-names">' + swRows.map(function (r) {
            return '<span>' + esc(r[1] || r[0]) + '</span>';
          }).join('') + '</div>' : '') + '</div>';
        break;
      }
      case 'darkmode': {
        var dmToggle = '<button type="button" class="wr-dm-toggle" data-wr-darkmode="1" aria-pressed="false">' +
          '<span class="wr-dm-track"><span class="wr-dm-knob"></span></span>' +
          '<span class="wr-dm-text" data-off="' + esc(p.dmLabelOff || '🌙 深色') + '" data-on="' + esc(p.dmLabelOn || '☀️ 浅色') + '">' +
          esc(p.dmLabelOff || '🌙 深色') + '</span></button>';
        var dmBtn = '<button type="button" class="wr-dm-btn" data-wr-darkmode="1" aria-pressed="false">' +
          '<span data-off="' + esc(p.dmLabelOff || '🌙 深色') + '" data-on="' + esc(p.dmLabelOn || '☀️ 浅色') + '">' +
          esc(p.dmLabelOff || '🌙 深色') + '</span></button>';
        inner = '<div class="wr-darkmode"' + (String(p.dmStyle) === 'button' ? ' is-button' : '') + '>' +
          (String(p.dmStyle) === 'button' ? dmBtn : dmToggle) + '</div>';
        // 深色配色写到 section 上，脚本按 data-* 读取，避免每个模块内联一份
        W += ';--wr-dark-bg:' + safeCssColor(p.dmDarkBg, '#0f172a') +
          ';--wr-dark-text:' + safeCssColor(p.dmDarkText, '#e8eef9') +
          ';--wr-dark-card:' + safeCssColor(p.dmDarkCard, '#1e293b');
        break;
      }
      case 'fontsizer': {
        var fsMin = Math.round(clampNum(p.fsMin, 50, 100));
        var fsMax = Math.round(clampNum(p.fsMax, 100, 180));
        inner = '<div class="wr-fontsizer" data-wr-fontsizer="1" data-min="' + fsMin + '" data-max="' + fsMax +
          '" data-step="' + Math.round(clampNum(p.fsStep, 5, 25)) + '" style="' + css({
            'text-align': p.align || 'center', 'border-radius': (p.radius || 14) + 'px',
            background: paint(p.cardBg, '#ffffff'), color: p.color || page.text
          }) + '">' + (p.fsLabel ? '<div class="wr-fs-title">' + esc(p.fsLabel) + '</div>' : '') +
          '<div class="wr-fs-ctrl"><button type="button" data-wr-fs="down" aria-label="缩小字体">A−</button>' +
          (String(p.fsShowValue) !== '0' ? '<span class="wr-fs-value">100%</span>' : '') +
          '<button type="button" data-wr-fs="up" aria-label="放大字体">A+</button></div></div>';
        break;
      }
      case 'themepicker': {
        var tpRows = rowCells(p.tpThemes);
        var themeBtns = tpRows.map(function (r, i) {
          var ac = safeCssColor(r[1], '#3b82f6');
          var bg = safeCssColor(r[2], '#ffffff');
          var tx2 = safeCssColor(r[3], '#16233a');
          return '<button type="button" class="wr-tp-btn" data-wr-theme="' + esc(r[0] || '主题' + (i + 1)) + '"' +
            ' data-accent="' + esc(ac) + '" data-bg="' + esc(bg) + '" data-text="' + esc(tx2) + '"' +
            ' style="--wr-tp-accent:' + esc(ac) + ';--wr-tp-bg:' + esc(bg) + ';--wr-tp-text:' + esc(tx2) + '">' +
            '<i></i><span>' + esc(r[0] || '主题' + (i + 1)) + '</span></button>';
        }).join('');
        inner = '<div class="wr-themepicker' + (String(p.tpStyle) === 'swatch' ? ' is-swatch' : '') + '"' +
          ' data-wr-themepicker="1" style="' + css({
            'text-align': p.align || 'center', 'border-radius': (p.radius || 16) + 'px',
            background: paint(p.cardBg, '#ffffff'), color: p.color || page.text
          }) + '">' + (p.tpLabel ? '<div class="wr-tp-title">' + esc(p.tpLabel) + '</div>' : '') +
          '<div class="wr-tp-btns" data-wr-list="tpThemes">' + (themeBtns || '<p class="wr-empty">在右侧填写主题</p>') + '</div></div>';
        break;
      }
      /* ===== 新组件：设备样机 / 转动品牌墙 / 视频 / 轮播 / 选项卡 / 倒计时 / 对比 / 音频 ===== */
      case 'device': {
        var dKind = String(p.devKind || 'laptop');
        var screen;
        if (String(p.devMode) === 'video') {
          var dSrc = videoSrcOf(p.devVideo);
          var dPoster = videoPosterOf(p.devVideo, p.devPoster);
          var dCtl = String(p.devVideoMode) === 'control';
          // 编辑态不挂 src（避免画布反复解码卡顿），预览 / 导出版才真正加载
          var dSrcAttr = (!editor && dSrc) ? ' src="' + esc(dSrc) + '"' : '';
          var dP = dPoster ? ' poster="' + esc(dPoster) + '"' : '';
          var dNote = (editor && dSrc && !dPoster) ? '<span class="wr-dev-note">视频已就绪 · 预览时播放</span>' : '';
          screen = '<video class="wr-dev-video"' + dP + dSrcAttr + (dCtl ? ' controls' : ' muted loop playsinline autoplay') +
            ' preload="' + (dCtl ? 'metadata' : 'auto') + '"></video>' + dNote;
        } else {
          var dImg = resolveMedia(p.devScreen) || PLACEHOLDER_IMG;
          screen = '<img class="wr-dev-screen-img" src="' + esc(dImg) + '" alt="设备屏幕画面" loading="lazy" decoding="async">';
        }
        inner = '<div class="wr-device wr-dev-' + esc(dKind) + (String(p.devTilt) === '1' ? ' is-tilt' : '') +
          (String(p.devGlow) === '0' ? ' no-glow' : '') + '" style="' + css({
          '--wr-dev-frame': paint(p.devFrame, '#1d2740')
        }) + '">' +
          '<div class="wr-dev-glow" aria-hidden="true"></div>' +
          '<div class="wr-dev-body"><div class="wr-dev-cam"></div><div class="wr-dev-screen">' +
          screen + '</div></div><div class="wr-dev-base" aria-hidden="true"></div></div>';
        break;
      }
      case 'brandrotor': {
        var rRows = rowCells(p.rotItems).slice(0, 16);
        var rShape = String(p.rotShape || 'ring');
        var rN = Math.max(1, rRows.length);
        var rCards = rRows.map(function (r, i) {
          var logo = isMediaImage(r[0])
            ? (function () { var s = resolveMedia(r[0]); return s ? '<img class="wr-rot-logo" src="' + esc(s) + '" alt="' + esc(r[0]) + '" loading="lazy">' : '<span>' + esc(r[0]) + '</span>'; })()
            : '<span>' + esc(r[0] || 'BRAND') + '</span>';
          var st = css({ '--wr-rot-i': i, '--wr-rot-n': rN, background: paint(p.rotCardBg, '#ffffff') });
          var card = '<div class="wr-rot-card" style="' + st + '">' + logo + '</div>';
          return r[1] ? '<a class="wr-rot-item" href="' + esc(safeUrl(r[1], '#')) + '" style="' + st + '">' + card + '</a>'
            : '<div class="wr-rot-item" style="' + st + '">' + card + '</div>';
        }).join('');
        inner = head + '<div class="wr-brandrotor" data-shape="' + esc(rShape) + '" data-pause="' +
          (String(p.rotPause) === '1' ? '1' : '0') + '" style="' + css({
          '--wr-rot-dur': Math.max(8, Math.min(90, Number(p.rotSpeed) || 30)) + 's',
          '--wr-rot-radius': Math.max(120, Math.min(480, Number(p.rotRadius) || 260)) + 'px',
          color: p.color || page.text
        }) + '"><div class="wr-rot-stage" data-wr-list="rotItems">' + rCards + '</div></div>';
        break;
      }
      case 'videoplayer': {
        var vSrc = videoSrcOf(p.playSrc);
        var vPoster = videoPosterOf(p.playSrc, p.playPoster);
        var vMode = String(p.playMode || 'control');
        var vCtl = vMode === 'control';
        // 编辑态不挂 src，角标提示；预览 / 导出版加载真实视频
        var vpSrcAttr = (!editor && vSrc) ? ' src="' + esc(vSrc) + '"' : '';
        var vpPoster = vPoster ? ' poster="' + esc(vPoster) + '"' : '';
        var vInner = (!vSrc) ? '<div class="wr-vp-empty">在右侧选择或上传视频</div>' : '';
        var vBadge = (editor && vSrc && !vPoster) ? '<span class="wr-vp-note">视频已就绪 · 预览时' + (vCtl ? '显示控制条' : '自动播放') + '</span>' : '';
        var vEmptyPoster = (!vPoster && !vSrc) ? '' : '';
        inner = '<figure class="wr-videoplayer" style="' + css({
          width: (Math.max(40, Math.min(100, Number(p.playW) || 100))) + '%', margin: '0 auto',
          'border-radius': (p.radius || 0) + 'px', overflow: 'hidden', background: '#0b1120'
        }) + '"><div class="wr-vp-frame" style="' + css({
          'aspect-ratio': p.playRatio || '16 / 9'
        }) + '">' +
          '<video class="wr-vp-video"' + vpPoster + vpSrcAttr + (vCtl ? ' controls' : ' muted loop playsinline autoplay') +
          ' preload="' + (vCtl ? 'metadata' : 'auto') + '" style="' + css({ 'object-fit': p.playFit === 'contain' ? 'contain' : 'cover' }) + '">' + vInner + '</video>' +
          vBadge + vEmptyPoster + '</div>' +
          (p.playCaption ? '<figcaption>' + esc(p.playCaption) + '</figcaption>' : '') + '</figure>';
        break;
      }
      case 'carousel': {
        var sRows = rowCells(p.slideItems).slice(0, 12).filter(function (r) { return String(r[0] || '').trim(); });
        if (!sRows.length) sRows = [['', '在右侧添加幻灯片', ''], ['', '第二张幻灯片', ''], ['', '第三张幻灯片', '']];
        var sAuto = String(p.slideAuto) !== '0';
        var sDur = Math.max(2, Math.min(12, Number(p.slideDur) || 4));
        var slides = sRows.map(function (r, i) {
          var im = resolveMedia(r[0]);
          var img = im
            ? '<img class="wr-slide-img" src="' + esc(im) + '" alt="' + esc(r[1] || '') + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '" decoding="async">'
            : '<div class="wr-slide-ph">' + esc(r[1] || ('第 ' + (i + 1) + ' 张')) + '</div>';
          var cap = r[1] ? '<div class="wr-slide-cap"' + (p.slideCapBg ? ' style="background:' + esc(p.slideCapBg) + '"' : '') + '>' + esc(r[1]) + '</div>' : '';
          return '<div class="wr-slide' + (i === 0 ? ' is-on' : '') + '" data-i="' + i + '">' +
            (r[2] ? '<a class="wr-slide-link" href="' + esc(safeUrl(r[2], '#')) + '">' + img + '</a>' : img) + cap + '</div>';
        }).join('');
        var dots = String(p.slideNav) === '0' ? '' : '<div class="wr-slide-dots">' + sRows.map(function (_, i) {
          return '<button type="button" class="wr-slide-dot' + (i === 0 ? ' is-on' : '') + '" data-dot="' + i + '" aria-label="第 ' + (i + 1) + ' 张"></button>';
        }).join('') + '</div>';
        var arrows = String(p.slideNav) === '0' ? '' : '<button type="button" class="wr-slide-arrow prev" data-dir="-1" aria-label="上一张">‹</button>' +
          '<button type="button" class="wr-slide-arrow next" data-dir="1" aria-label="下一张">›</button>';
        inner = '<div class="wr-carousel" data-auto="' + (sAuto ? '1' : '0') + '" data-dur="' + sDur + '" data-fit="' +
          esc(p.slideFit === 'contain' ? 'contain' : 'cover') + '" style="' + css({
          height: Math.max(180, Math.min(640, Number(p.slideH) || 380)) + 'px',
          'border-radius': (p.radius || 0) + 'px'
        }) + '"><div class="wr-slide-track" data-wr-list="slideItems">' + slides + '</div>' + arrows + dots + '</div>';
        break;
      }
      case 'tabs': {
        var tRows = rowCells(p.tabItems).slice(0, 10).filter(function (r) { return String(r[0] || '').trim(); });
        if (!tRows.length) tRows = [['标签一', '在右侧填写选项卡内容'], ['标签二', '每行一个：标签 | 内容']];
        var tStyle = String(p.tabStyle || 'pill');
        var tId = 'wr-tab-' + b.id;
        var tBtns = tRows.map(function (r, i) {
          return '<button type="button" class="wr-tab-btn' + (i === 0 ? ' is-on' : '') + '" data-tab="' + i + '"' +
            ' style="--wr-tab-active:' + esc(safeCssColor(p.tabActive, '#3b82f6')) + '">' + esc(r[0]) + '</button>';
        }).join('');
        var tPanes = tRows.map(function (r, i) {
          return '<div class="wr-tab-pane' + (i === 0 ? ' is-on' : '') + '" data-pane="' + i + '">' + nl(r[1] || '') + '</div>';
        }).join('');
        inner = '<div class="wr-tabs" data-id="' + esc(tId) + '" data-style="' + esc(tStyle) + '" style="' + css({
          '--wr-tab-active': safeCssColor(p.tabActive, '#3b82f6'),
          '--wr-tab-card': paint(p.tabCardBg, '#f6f9ff'),
          'text-align': p.tabAlign === 'left' ? 'left' : 'center',
          'border-radius': (p.radius || 0) + 'px', color: p.color || page.text
        }) + '"><div class="wr-tab-bar" data-wr-list="tabItems" role="tablist">' + tBtns + '</div>' +
          '<div class="wr-tab-body">' + tPanes + '</div></div>';
        break;
      }
      case 'countdown': {
        var cdEndText = p.cdEnd || '时间到！';
        var cdToRaw = String(p.cdTo || '').trim();
        // 编辑态也算一份静态初值，画布上不至于全是 --（导出后由脚本实时接管）
        var cdInit = countdownParts(cdToRaw);
        var cdVal = function (k) { return cdInit ? String(cdInit[k]) : '--'; };
        inner = '<div class="wr-countdown" data-to="' + esc(cdToRaw) + '" data-end="' + esc(cdEndText) +
          '" data-sec="' + (String(p.cdShowSec) === '0' ? '0' : '1') + '" data-style="' + esc(p.cdStyle || 'box') + '" style="' + css({
          '--wr-cd-accent': safeCssColor(p.cdAccent, '#ffffff'),
          '--wr-cd-box': safePaint(p.cdBoxBg, 'rgba(255,255,255,.1)')
        }) + '">' + (p.cdTitle ? '<div class="wr-cd-title">' + esc(p.cdTitle) + '</div>' : '') +
          (cdInit === null ? '<div class="wr-cd-title">' + esc(cdEndText) + '</div>'
            : '<div class="wr-cd-units">' +
            '<div class="wr-cd-unit"><b data-cd="d">' + cdVal('d') + '</b><span>天</span></div>' +
            '<div class="wr-cd-unit"><b data-cd="h">' + cdVal('h') + '</b><span>时</span></div>' +
            '<div class="wr-cd-unit"><b data-cd="m">' + cdVal('m') + '</b><span>分</span></div>' +
            '<div class="wr-cd-unit wr-cd-s"><b data-cd="s">' + cdVal('s') + '</b><span>秒</span></div>' +
            '</div>') + '</div>';
        break;
      }
      case 'compare': {
        var cB = resolveMedia(p.cmpBefore) || PLACEHOLDER_IMG;
        var cA = resolveMedia(p.cmpAfter) || PLACEHOLDER_IMG;
        var cStart = Math.max(10, Math.min(90, Number(p.cmpStart) || 50));
        inner = '<div class="wr-compare" style="' + css({
          height: Math.max(200, Math.min(680, Number(p.cmpH) || 420)) + 'px',
          'border-radius': (p.radius || 0) + 'px', '--wr-cmp-pos': cStart + '%'
        }) + '">' +
          '<img class="wr-cmp-img wr-cmp-before" src="' + esc(cB) + '" alt="' + esc(p.cmpBeforeLabel || '改前') + '" loading="lazy" decoding="async">' +
          '<div class="wr-cmp-after-wrap"><img class="wr-cmp-img wr-cmp-after" src="' + esc(cA) + '" alt="' + esc(p.cmpAfterLabel || '改后') + '" loading="lazy" decoding="async"></div>' +
          '<span class="wr-cmp-tag before">' + esc(p.cmpBeforeLabel || '改前') + '</span>' +
          '<span class="wr-cmp-tag after">' + esc(p.cmpAfterLabel || '改后') + '</span>' +
          '<div class="wr-cmp-handle"><span>‹ ›</span></div>' +
          '<input class="wr-cmp-range" type="range" min="10" max="90" value="' + cStart + '" aria-label="拖动对比图片">' +
          '</div>';
        break;
      }
      case 'audioplayer': {
        var aSrc = safeAudio(p.auSrc);
        var aCover = resolveMedia(p.auCover);
        var aCoverHTML = aCover
          ? '<span class="wr-au-cover has-img"><img src="' + esc(aCover) + '" alt="封面"></span>'
          : '<span class="wr-au-cover">♫</span>';
        var aAudio = aSrc
          ? '<audio class="wr-au-audio"' + (String(p.auAuto) === '1' ? ' autoplay' : '') + ' preload="metadata" src="' + esc(aSrc) + '"></audio>'
          : '<div class="wr-au-empty">在右侧填写音频地址</div>';
        inner = '<div class="wr-audioplayer" style="' + css({
          background: paint(p.auCardBg, '#f6f9ff'), 'border-radius': (p.radius || 0) + 'px', color: p.color || page.text
        }) + '">' + aCoverHTML +
          '<div class="wr-au-info"><div class="wr-au-title">' + esc(p.auTitle || '示例曲目') + '</div>' +
          '<div class="wr-au-artist">' + esc(p.auArtist || '未知艺术家') + '</div>' + aAudio + '</div></div>';
        break;
      }
      case 'steps': {
        var stRows = rowCells(p.stepsItems);
        var stCol = String(p.stepsLayout) === 'col';
        inner = head + '<div class="wr-steps' + (stCol ? ' is-col' : '') + (String(p.stepsLine) === '0' ? ' no-line' : '') +
          '" data-shape="' + esc(p.stepsShape || 'num') + '" data-wr-list="stepsItems" style="' + css({ '--wr-step-accent': safeCssColor(p.stepsAccent, '#3b82f6') }) + '">' +
          stRows.map(function (r, i) {
            var badge = p.stepsShape === 'num' ? String(i + 1) : (p.stepsShape === 'check' ? '✓' : '');
            return '<div class="wr-step" style="' + css({
              background: paint(p.stepsCardBg, '#f5f8ff'), 'border-radius': (p.radius || 0) + 'px'
            }) + '"><span class="wr-step-badge" aria-hidden="true">' + badge + '</span>' +
              '<div class="wr-step-txt"><h4>' + esc(r[0] || '') + '</h4>' +
              (r[1] ? '<p>' + esc(r[1]) + '</p>' : '') + '</div></div>';
          }).join('') + '</div>';
        break;
      }
      case 'posts': {
        var poRows = rowCells(p.postItems);
        inner = head + '<div class="wr-posts wr-cols" data-wr-list="postItems" style="' + css({
          'grid-template-columns': gridCols(p.postCols, 3), gap: '20px', color: p.color || page.text
        }) + '">' + poRows.map(function (r) {
          var img = resolveMedia(r[0]);
          var cover = img
            ? '<img src="' + esc(img) + '" alt="' + esc(r[1] || '') + '" loading="lazy" decoding="async" style="' + css({ height: (p.postImgH || 160) + 'px' }) + '">'
            : '<div class="wr-post-nocover" style="height:' + (p.postImgH || 160) + 'px">▧</div>';
          var href = safeUrl(r[4], '');
          var titleHTML = href && href !== '#' ? '<a href="' + esc(href) + '">' + esc(r[1] || '') + '</a>' : esc(r[1] || '');
          return '<article class="wr-post" style="' + css({ background: paint(p.postCardBg, '#fff'), 'border-radius': (p.radius || 0) + 'px' }) + '">' +
            cover + '<div class="wr-post-body"><h3>' + titleHTML + '</h3>' +
            (r[2] ? '<div class="wr-post-date">' + esc(r[2]) + '</div>' : '') +
            (r[3] ? '<p>' + esc(r[3]) + '</p>' : '') + '</div></article>';
        }).join('') + '</div>';
        break;
      }
      case 'newsletter': {
        var subImg = '';
        var action = String(p.subAction || '').trim();
        var formAttr = action && safeUrl(action, '') && safeUrl(action, '') !== '#'
          ? ' action="' + esc(safeUrl(action, '')) + '" method="get"'
          : ' data-nosubmit="1"';
        inner = '<div class="wr-newsletter" style="' + css({
          background: paint(p.subCardBg, '#fff'), 'border-radius': (p.radius || 0) + 'px', color: p.color || page.text
        }) + '">' + (p.subTitle ? '<h2>' + esc(p.subTitle) + '</h2>' : '') +
          (p.subDesc ? '<p class="wr-sub-desc">' + esc(p.subDesc) + '</p>' : '') +
          '<form class="wr-sub-form"' + formAttr + ' style="' + phVars(p) + '">' +
          '<input type="email" name="email" required placeholder="' + esc(p.subPlaceholder || '输入你的邮箱地址') + '" style="' +
          css(inputSkin(p, { bg: '#ffffff', radius: 10, padX: 16, padY: 13, fontSize: 14, flex: '1' })) + '">' +
          '<button type="submit" style="' + css(btnSkin(p, {
            bg: p.subBtnBg || page.accent, color: '#fff', radius: 10, padX: 22, padY: 13,
            fontSize: 14, weight: '700', shadow: 'none', extra: { border: '0', cursor: 'pointer' }
          })) + '">' + esc(p.subBtn || '立即订阅') + '</button></form>' +
          '<div class="wr-sub-msg" hidden>订阅成功，感谢你的关注！</div></div>';
        break;
      }
      case 'product': {
        var pimg = resolveMedia(p.prodImage);
        var pHref = safeUrl(p.prodHref, '');
        var pbtnStyle = css(btnSkin(p, {
          bg: page.accent, color: '#fff', radius: 10, padX: 13, padY: 13, fontSize: 15,
          weight: '700', shadow: 'none', full: true
        }));
        inner = '<div class="wr-product" style="' + css({
          background: paint(p.prodCardBg, '#fff'), 'border-radius': (p.radius || 0) + 'px', color: p.color || page.text
        }) + '">' + (p.prodBadge ? '<span class="wr-prod-badge">' + esc(p.prodBadge) + '</span>' : '') +
          '<div class="wr-prod-media">' + (pimg
            ? '<img src="' + esc(pimg) + '" alt="' + esc(p.prodName || '') + '" loading="lazy" decoding="async">'
            : '<span class="wr-prod-ph">▧</span>') + '</div>' +
          '<div class="wr-prod-info"><h3>' + esc(p.prodName || '') + '</h3>' +
          (p.prodDesc ? '<p class="wr-prod-desc">' + esc(p.prodDesc) + '</p>' : '') +
          '<div class="wr-prod-price"><b>' + esc(p.prodPrice || '') + '</b>' +
          (p.prodOldPrice ? '<s>' + esc(p.prodOldPrice) + '</s>' : '') + '</div>' +
          (pHref && pHref !== '#'
            ? '<a class="wr-prod-btn" href="' + esc(pHref) + '" style="' + pbtnStyle + '">' + esc(p.prodBtn || '立即购买') + '</a>'
            : '<span class="wr-prod-btn is-static" style="' + pbtnStyle + '">' + esc(p.prodBtn || '立即购买') + '</span>') +
          '</div></div>';
        break;
      }
      case 'coupon': {
        var cpHref = safeUrl(p.cpHref, '');
        var cpAccent = safeCssColor(p.cpAccent, '#f0623c');
        var cpBtnStyle = css(btnSkin(p, {
          bg: cpAccent, color: '#fff', radius: 999, padX: 20, padY: 11, fontSize: 14, weight: '700', shadow: 'none'
        }));
        inner = '<div class="wr-coupon" style="' + css({
          background: paint(p.cpBg, '#fff6f2'), 'border-radius': (p.radius || 0) + 'px', '--wr-cp-accent': cpAccent, color: p.color || page.text
        }) + '"><div class="wr-cp-left"><div class="wr-cp-amount">' + esc(p.cpAmount || '') + '</div>' +
          '<div class="wr-cp-cond">' + esc(p.cpCondition || '') + '</div></div>' +
          '<div class="wr-cp-mid">' + (p.cpTitle ? '<h3>' + esc(p.cpTitle) + '</h3>' : '') +
          (p.cpCode ? '<div class="wr-cp-code">优惠码：<b>' + esc(p.cpCode) + '</b></div>' : '') + '</div>' +
          '<div class="wr-cp-right">' + (cpHref && cpHref !== '#'
            ? '<a href="' + esc(cpHref) + '" style="' + cpBtnStyle + '">' + esc(p.cpBtn || '立即领取') + '</a>'
            : '<span class="is-static" style="' + cpBtnStyle + '">' + esc(p.cpBtn || '立即领取') + '</span>') + '</div></div>';
        break;
      }
      case 'download': {
        var dlHref = safeUrl(p.dlHref, '');
        var dlBtnStyle = css(btnSkin(p, {
          bg: page.accent, color: '#fff', radius: 9, padX: 18, padY: 10, fontSize: 14, weight: '600', shadow: 'none'
        }));
        inner = '<div class="wr-download" style="' + css({
          background: paint(p.dlCardBg, '#fff'), 'border-radius': (p.radius || 0) + 'px', color: p.color || page.text
        }) + '"><span class="wr-dl-icon">' + esc(p.dlIcon || '📦') + '</span>' +
          '<div class="wr-dl-info"><div class="wr-dl-name">' + esc(p.dlName || '文件') + '</div>' +
          (p.dlMeta ? '<div class="wr-dl-meta">' + esc(p.dlMeta) + '</div>' : '') + '</div>' +
          (dlHref && dlHref !== '#'
            ? '<a class="wr-dl-btn" href="' + esc(dlHref) + '" download style="' + dlBtnStyle + '">' + esc(p.dlBtn || '下载') + '</a>'
            : '<span class="wr-dl-btn is-static" style="' + dlBtnStyle + '">' + esc(p.dlBtn || '下载') + '</span>') + '</div>';
        break;
      }
      case 'share': {
        var shBtns = shareButtons(p.sharePlatforms);
        var shMode = String(p.shareStyle) === 'icon' ? 'is-icon' : '';
        inner = '<div class="wr-share' + (shMode ? ' ' + shMode : '') + '" style="' + css({ '--wr-share-accent': safeCssColor(p.shareAccent, '#3b82f6'), color: p.color || page.text }) + '">' +
          (p.shareTitle ? '<div class="wr-share-title">' + esc(p.shareTitle) + '</div>' : '') +
          '<div class="wr-share-btns">' + (shBtns.length ? shBtns.map(function (s) {
            if (s.act === 'copy') return '<button type="button" class="wr-share-btn" data-share="copy" aria-label="' + esc(s.name) + '"><span>' + esc(s.glyph) + '</span><i>' + esc(s.name) + '</i></button>';
            if (!s.act) return '<button type="button" class="wr-share-btn" data-share="' + esc(s.name) + '" aria-label="' + esc(s.name) + '"><span>' + esc(s.glyph) + '</span><i>' + esc(s.name) + '</i></button>';
            return '<a class="wr-share-btn" data-share="' + esc(s.act) + '" href="' + esc(s.href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(s.name) + '"><span>' + esc(s.glyph) + '</span><i>' + esc(s.name) + '</i></a>';
          }).join('') : '<p class="wr-empty">在右侧填写分享平台</p>') + '</div>' +
          '<div class="wr-share-toast" hidden>链接已复制</div></div>';
        break;
      }
      case 'mapcard': {
        var mapHref = safeUrl(p.mapLink, '');
        inner = '<div class="wr-mapcard" style="' + css({
          background: paint(p.mapCardBg, '#fff'), 'border-radius': (p.radius || 0) + 'px', color: p.color || page.text
        }) + '"><div class="wr-map-ico" aria-hidden="true">⌖</div><div class="wr-map-info">' +
          (p.mapTitle ? '<h3>' + esc(p.mapTitle) + '</h3>' : '') +
          '<ul>' + (p.mapAddress ? '<li><span>⌖</span>' + esc(p.mapAddress) + '</li>' : '') +
          (p.mapPhone ? '<li><span>☎</span>' + esc(p.mapPhone) + '</li>' : '') +
          (p.mapHours ? '<li><span>◷</span>' + esc(p.mapHours) + '</li>' : '') + '</ul></div>' +
          (mapHref && mapHref !== '#'
            ? '<a class="wr-map-btn" href="' + esc(mapHref) + '" target="_blank" rel="noopener noreferrer" style="' + css(btnSkin(p, {
              bg: page.accent, color: '#fff', radius: 10, padX: 20, padY: 11, fontSize: 14, weight: '600', shadow: 'none'
            })) + '">' + esc(p.mapBtn || '查看地图') + '</a>'
            : '') + '</div>';
        break;
      }
      case 'event': {
        var evHref = safeUrl(p.evtHref, '');
        var evBtnStyle = css(btnSkin(p, {
          bg: page.accent, color: '#fff', radius: 10, padX: 22, padY: 11, fontSize: 14, weight: '700', shadow: 'none'
        }));
        inner = '<div class="wr-event" style="' + css({
          background: paint(p.bg, '#ffffff'), 'border-radius': (p.radius || 0) + 'px', color: p.color || page.text,
          border: '1px solid rgba(0,0,0,.07)'
        }) + '"><div class="wr-evt-date" style="' + css({ background: paint(p.evtAccent, '#3b82f6'), color: '#fff' }) + '">' +
          '<b>' + esc(p.evtDate || '') + '</b>' + (p.evtTime ? '<span>' + esc(p.evtTime) + '</span>' : '') + '</div>' +
          '<div class="wr-evt-body"><h3>' + esc(p.evtTitle || '') + '</h3>' +
          (p.evtDesc ? '<p>' + esc(p.evtDesc) + '</p>' : '') +
          (p.evtLocation ? '<div class="wr-evt-loc">⌖ ' + esc(p.evtLocation) + '</div>' : '') + '</div>' +
          (evHref && evHref !== '#'
            ? '<a class="wr-evt-btn" href="' + esc(evHref) + '" style="' + evBtnStyle + '">' + esc(p.evtBtn || '立即报名') + '</a>'
            : '<span class="wr-evt-btn is-static" style="' + evBtnStyle + '">' + esc(p.evtBtn || '立即报名') + '</span>') + '</div>';
        break;
      }
      case 'jobs': {
        var jRows = rowCells(p.jobItems);
        var jAccent = safeCssColor(p.jobAccent, '#3b82f6');
        var jobBtnStyle = css(btnSkin(p, {
          auto: 'outline', bg: jAccent, color: jAccent, radius: 8, padX: 16, padY: 8,
          fontSize: 13, weight: '600', shadow: 'none'
        }));
        inner = head + '<div class="wr-jobs" data-wr-list="jobItems" style="' + css({ 'border-radius': (p.radius || 0) + 'px', '--wr-job-accent': jAccent }) + '">' +
          jRows.map(function (r) {
            var jh = safeUrl(r[3], '');
            return '<div class="wr-job" style="' + css({ background: paint(p.jobCardBg, '#fff') }) + '">' +
              '<div class="wr-job-main"><b>' + esc(r[0] || '') + '</b>' +
              (r[1] ? '<span class="wr-job-loc">⌖ ' + esc(r[1]) + '</span>' : '') + '</div>' +
              (r[2] ? '<span class="wr-job-salary">' + esc(r[2]) + '</span>' : '') +
              (jh && jh !== '#'
                ? '<a class="wr-job-btn" href="' + esc(jh) + '" style="' + jobBtnStyle + '">查看详情 →</a>'
                : '') + '</div>';
          }).join('') + '</div>';
        break;
      }
      case 'iconnav': {
        var icRows = rowCells(p.navItems2);
        inner = head + '<div class="wr-iconnav wr-cols" data-wr-list="navItems2" style="' + css({ 'grid-template-columns': gridCols(p.navCols, 4), gap: '14px', color: p.color || page.text }) + '">' +
          icRows.map(function (r) {
            var ih = safeUrl(r[2], '');
            var imgSrc = isMediaImage(r[0]) ? resolveMedia(r[0]) : '';
            var icoHTML = imgSrc
              ? '<img class="wr-ic-nav-img" src="' + esc(imgSrc) + '" alt="" loading="lazy" decoding="async">'
              : '<span class="wr-ic-nav-glyph">' + esc(r[0] || '◆') + '</span>';
            var body = icoHTML + (r[1] ? '<span class="wr-ic-nav-name">' + esc(r[1]) + '</span>' : '');
            return ih && ih !== '#'
              ? '<a class="wr-ic-nav" href="' + esc(ih) + '" style="' + css({ background: paint(p.navItemBg, '#fff'), 'border-radius': (p.radius || 0) + 'px' }) + '">' + body + '</a>'
              : '<div class="wr-ic-nav" style="' + css({ background: paint(p.navItemBg, '#fff'), 'border-radius': (p.radius || 0) + 'px' }) + '">' + body + '</div>';
          }).join('') + '</div>';
        break;
      }
      case 'article': {
        var acov = resolveMedia(p.artCover);
        inner = '<article class="wr-article" style="' + css({
          background: paint(p.artCardBg, '#fff'), 'border-radius': (p.radius || 0) + 'px', 'max-width': (p.artWidth || 760) + 'px',
          color: p.color || page.text
        }) + '">' + (acov ? '<img class="wr-art-cover" src="' + esc(acov) + '" alt="' + esc(p.artTitle || '') + '" loading="lazy" decoding="async">' : '') +
          '<div class="wr-art-inner">' + (p.artTitle ? '<h1>' + esc(p.artTitle) + '</h1>' : '') +
          (p.artMeta ? '<div class="wr-art-meta">' + esc(p.artMeta) + '</div>' : '') +
          '<div class="wr-art-body">' + articleBodyHTML(p.artBody) + '</div></div></article>';
        break;
      }
      case 'subnav': {
        var subRows = rowCells(p.navItems);
        var subMap = {};
        rowCells(p.subItems).forEach(function (r) {
          var parent = String((r && r[0]) || '').trim();
          if (!parent) return;
          subMap[parent] = String((r && r[1]) || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
        });
        var subId = 'wr-subnav-' + b.id;
        var subLinks = subRows.map(function (r) {
          var label = String((r && r[0]) || '').trim();
          if (!label) return '';
          var kids = subMap[label] || [];
          var link = esc(safeUrl((r && r[1]) || '#', '#'));
          if (!kids.length) return '<a class="wr-sub-link" href="' + link + '">' + esc(label) + '</a>';
          return '<div class="wr-sub-item">' +
            '<a class="wr-sub-link" href="' + link + '">' + esc(label) + '<span class="wr-sub-caret" aria-hidden="true">⌄</span></a>' +
            '<div class="wr-sub-menu">' + kids.map(function (kid) {
              var bits = kid.split('>');
              var kl = (bits[0] || '').trim();
              var kh = esc(safeUrl((bits[1] || '#').trim(), '#'));
              return '<a href="' + kh + '">' + esc(kl) + '</a>';
            }).join('') + '</div></div>';
        }).join('');
        inner = '<nav class="wr-subnav" aria-label="二级导航" style="' + css({
          background: paint(p.bg, '#ffffff'), color: p.color || page.text
        }) + '"><div class="wr-subnav-inner" style="' + css({
          'min-height': (p.navHeight || 64) + 'px',
          'max-width': (page.maxWidth || 960) + 'px', margin: '0 auto',
          padding: '0 ' + (p.padX == null ? 24 : p.padX) + 'px'
        }) + '">' +
          '<a class="wr-nav-brand" href="#top" style="' + css(brandStyle(p, 17)) + '">' +
          mediaHTML(p.emoji, { size: 30, font: 15, cls: 'wr-nav-mark', inline: true, fit: 'contain', alt: p.title }) +
          esc(p.title || '品牌名称') + '</a>' +
          '<input class="wr-nav-cb" type="checkbox" id="' + subId + '" aria-label="展开菜单" hidden>' +
          '<label class="wr-nav-burger" for="' + subId + '" aria-label="打开菜单">☰</label>' +
          '<div class="wr-subnav-links" data-wr-list="navItems" style="' + (p.align === 'left' ? 'margin-right:auto' : 'margin-left:auto') + ';' + css(navVars(p)) + '">' +
          subLinks + (p.btnText ? '<a class="wr-nav-cta" href="' + esc(safeUrl(p.navCtaHref, '#')) + '" style="' + css(btnSkin(p, {
            bg: page.accent, color: '#fff', radius: 9, padX: 18, padY: 9, fontSize: 14, weight: '600', shadow: 'none'
          })) + '">' + esc(p.btnText) + '</a>' : '') +
          '</div></div></nav>';
        break;
      }
      case 'smartnav': {
        var smRows = rowCells(p.navItems);
        var smId = 'wr-smartnav-' + b.id;
        var smLinks = smRows.map(function (r) {
          return '<a href="' + esc(safeUrl((r && r[1]) || '#', '#')) + '">' + esc((r && r[0]) || '') + '</a>';
        }).join('');
        inner = '<nav class="wr-smartnav" aria-label="多功能导航" style="' + css({
          background: paint(p.bg, '#ffffff'), color: p.color || page.text
        }) + '"><div class="wr-subnav-inner" style="' + css({
          'min-height': (p.navHeight || 68) + 'px',
          'max-width': (page.maxWidth || 960) + 'px', margin: '0 auto',
          padding: '0 ' + (p.padX == null ? 24 : p.padX) + 'px'
        }) + '">' +
          '<a class="wr-nav-brand" href="#top" style="' + css(brandStyle(p, 17)) + '">' +
          mediaHTML(p.emoji, { size: 30, font: 15, cls: 'wr-nav-mark', inline: true, fit: 'contain', alt: p.title }) +
          esc(p.title || '品牌名称') + '</a>' +
          '<input class="wr-nav-cb" type="checkbox" id="' + smId + '" aria-label="展开菜单" hidden>' +
          '<label class="wr-nav-burger" for="' + smId + '" aria-label="打开菜单">☰</label>' +
          '<div class="wr-smartnav-links" data-wr-list="navItems" style="' + css(navVars(p)) + '">' + smLinks + '</div>' +
          (p.searchPlaceholder ? '<div class="wr-smart-search"><input type="search" placeholder="' + esc(p.searchPlaceholder) + '" aria-label="' + esc(p.searchPlaceholder) + '"><button type="button" aria-label="搜索">⌕</button></div>' : '') +
          '<button type="button" class="wr-smart-theme" data-wr-darkmode="1" aria-pressed="false" title="' + esc(p.themeBtnText || '切换主题') + '">' +
          '<span data-on="☀" data-off="☾">☾</span><em>' + esc(p.themeBtnText || '主题') + '</em></button>' +
          (p.btnText ? '<a class="wr-nav-cta" href="' + esc(safeUrl(p.navCtaHref, '#')) + '" style="' + css(btnSkin(p, {
            bg: page.accent, color: '#fff', radius: 9, padX: 18, padY: 9, fontSize: 14, weight: '600', shadow: 'none'
          })) + '">' + esc(p.btnText) + '</a>' : '') +
          '</div></nav>';
        break;
      }
      case 'dropdownbar': {
        var ddRows = rowCells(p.dropItems);
        var openFirst = String(p.openFirst || '') === '1';
        inner = head + '<div class="wr-dropdowns" data-wr-list="dropItems" style="' + css({
          '--wr-dd-bg': safeCssColor(p.cardBg, '#f6f9fc'),
          '--wr-dd-radius': (p.radius || 12) + 'px',
          gap: (p.gap == null ? 10 : p.gap) + 'px', color: p.color || page.text
        }) + '">' + ddRows.map(function (r, i) {
          var title = String((r && r[0]) || '').trim();
          if (!title) return '';
          var body = String((r && r[1]) || '').trim();
          var isLink = /^(https?:\/\/|\/\/|#|\/)/i.test(body);
          var bh = isLink
            ? '<a href="' + esc(safeUrl(body, '#')) + '">' + esc(body) + '</a>'
            : nl(body);
          return '<details class="wr-dd"' + (openFirst && i === 0 ? ' open' : '') + '>' +
            '<summary>' + esc(title) + '<span class="wr-dd-arrow" aria-hidden="true">⌄</span></summary>' +
            '<div class="wr-dd-body">' + bh + '</div></details>';
        }).join('') + '</div>';
        break;
      }
      case 'checkboxset': {
        var ckRows = rowCells(p.checkItems);
        inner = '<div class="wr-checkset" data-wr-prefix="' + esc(p.chkResult || '已选择：') + '" style="' + css({
          background: paint(p.cardBg, '#f6f9fc'), 'border-radius': (p.radius || 14) + 'px',
          color: p.color || page.text, '--wr-accent': safeCssColor(page.accent, '#3b82f6')
        }) + '">' +
          (p.title ? '<h3 class="wr-ck-title">' + esc(p.title) + '</h3>' : '') +
          (p.desc ? '<p class="wr-ck-desc">' + nl(p.desc) + '</p>' : '') +
          '<div class="wr-chk-list" data-wr-list="checkItems">' + ckRows.map(function (r) {
            var label = String((r && r[0]) || '').trim();
            if (!label) return '';
            var val = String((r && r[1]) || label).trim();
            var on = String((r && r[2]) || '').trim() === '1';
            return '<label class="wr-chk"><input type="checkbox" value="' + esc(val) + '"' + (on ? ' checked' : '') +
              '><span>' + esc(label) + '</span></label>';
          }).join('') + '</div>' +
          (p.chkBtn ? '<div class="wr-chk-actions"><button type="button" class="wr-chk-btn" style="' + css(btnSkin(p, {
            bg: page.accent, color: '#fff', radius: 9, padX: 22, padY: 10, fontSize: 14, weight: '600',
            shadow: 'none', extra: { border: '0', cursor: 'pointer', 'font-family': 'inherit' }
          })) + '">' + esc(p.chkBtn) + '</button>' +
            '<span class="wr-chk-result" hidden></span></div>' : '') +
          '</div>';
        break;
      }
      case 'html':
        inner = sanitizeHTML(p.htmlCode);
        break;
      /* ===== 单条组件：内容只有一条，样式字段和列表里的那张卡一致 ===== */
      case 'feat1': {
        var s1Icon = pnum(p, 'cardIconSize', 42, 12, 160);
        var s1Pad = pnum(p, 'cardPadY', 26, 0, 80);
        inner = '<div style="' + singleCardStyle(p, '#f5f8ff', 14, 20, 26) + ';text-align:' + (p.align || 'left') + '">' +
          mediaHTML(p.emoji, {
            size: s1Icon, font: Math.round(s1Icon * 0.66), fit: 'contain', alt: p.title,
            margin: p.align === 'center' ? '0 auto ' + (s1Pad > 0 ? 12 : 6) + 'px'
              : (p.align === 'right' ? '0 0 12px auto' : '0 0 12px')
          }) +
          '<h3 style="margin:0 0 8px;font-size:' + pnum(p, 'cardTitleSize', 17, 8, 40) + 'px">' + esc(p.title) + '</h3>' +
          '<p style="margin:0;font-size:' + pnum(p, 'cardTextSize', 13, 8, 40) + 'px;line-height:1.7;opacity:.75">' + nl(p.desc) + '</p></div>';
        break;
      }
      case 'member1': {
        var m1Icon = pnum(p, 'cardIconSize', 62, 16, 160);
        inner = '<div style="' + singleCardStyle(p, '#f5f8ff', 16, 18, 26) + ';text-align:center">' +
          mediaHTML(p.emoji, {
            size: m1Icon, font: Math.round(m1Icon * 0.45), cls: 'wr-team-avatar', round: true,
            margin: '0 auto 10px', alt: p.title
          }) +
          '<h4 style="margin:0 0 4px;font-size:' + pnum(p, 'cardTitleSize', 16, 8, 40) + 'px">' + esc(p.title) + '</h4>' +
          '<div style="font-size:12px;opacity:.65;margin-bottom:8px">' + esc(p.role) + '</div>' +
          '<p style="margin:0;font-size:' + pnum(p, 'cardTextSize', 13, 8, 40) + 'px;line-height:1.7;opacity:.75">' + nl(p.desc) + '</p></div>';
        break;
      }
      case 'plan1': {
        var plHot = String(p.hot) === '1';
        var plBtn = btnSkin(p, {
          bg: page.accent, color: '#fff', radius: 9, padX: 11, padY: 11,
          fontSize: 14, weight: '600', shadow: 'none', full: true
        });
        if ((!p.btnStyle || p.btnStyle === 'auto') && !plHot) {
          plBtn.background = 'rgba(59,130,246,.1)';
          plBtn.color = p.btnColor || p.color || page.text;
          plBtn.border = '0';
          plBtn['box-shadow'] = '';
        }
        var plFeats = String(p.desc || '').split(/[\n;；]/).map(function (s) { return s.trim(); }).filter(Boolean);
        inner = '<div class="wr-price-card" style="' + singleCardStyle(p, '#ffffff', 16, 22, 28) +
          ';border:' + (plHot ? '2px solid ' + safeCssColor(page.accent) : '1px solid rgba(0,0,0,.08)') +
          ';box-shadow:' + (plHot ? '0 14px 34px rgba(30,80,180,.13)' : 'none') + '">' +
          (plHot ? '<span class="wr-price-badge">推荐</span>' : '') +
          '<h3 style="margin:0;font-size:' + pnum(p, 'cardTitleSize', 17, 8, 40) + 'px">' + esc(p.title) + '</h3>' +
          '<div class="wr-price-num">' + esc(p.prodPrice) + '</div>' +
          '<ul style="font-size:' + pnum(p, 'cardTextSize', 13, 8, 40) + 'px">' +
          plFeats.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
          '<a class="wr-price-btn" href="' + esc(safeUrl(p.href, '#')) + '" style="' + css(plBtn) + '">' +
          esc(p.btnText || '了解更多') + '</a></div>';
        break;
      }
      case 'milestone1': {
        var msDot = safeCssColor(p.tlDotColor, '#3b82f6');
        inner = '<div class="wr-timeline" style="border-left-color:' + safeCssColor(p.tlLineColor, '#dbe6f6') +
          ';max-width:720px;--wr-accent:' + msDot + ';color:' + (p.color || page.text) + '">' +
          '<div class="wr-tl-item"><div class="wr-tl-date">' + esc(p.dateText) + '</div>' +
          '<h4 style="font-size:' + pnum(p, 'cardTitleSize', 16, 8, 40) + 'px">' + esc(p.title) + '</h4>' +
          '<p style="font-size:' + pnum(p, 'cardTextSize', 13, 8, 40) + 'px">' + nl(p.desc) + '</p></div></div>';
        break;
      }
      case 'qa1': {
        inner = '<details' + (String(p.openFirst) === '1' ? ' open' : '') + ' style="' + singleCardStyle(p, '#f5f8ff', 12, 18, 16) + '">' +
          '<summary style="cursor:pointer;font-weight:600;font-size:' + pnum(p, 'cardTitleSize', 15, 8, 40) + 'px">' +
          esc(p.title) + '</summary>' +
          '<div style="padding-top:10px;font-size:' + pnum(p, 'cardTextSize', 13, 8, 40) + 'px;line-height:1.75;opacity:.78">' +
          nl(p.desc) + '</div></details>';
        break;
      }
      case 'prog1': {
        var prN = Math.max(0, Math.min(100, Math.round(pnum(p, 'percent', 68, 0, 100))));
        inner = '<div style="max-width:680px;color:' + (p.color || page.text) + '">' +
          '<div class="wr-pg-row"><div class="wr-pg-label"><span>' + esc(p.title) + '</span><span>' + prN + '%</span></div>' +
          '<div class="wr-pg-track"><div class="wr-pg-fill" style="width:' + prN + '%;background:' +
          safeCssColor(p.barColor, page.accent) + '"></div></div></div></div>';
        break;
      }
      case 'rank1': {
        var rkNo = Math.max(1, Math.min(4, Number(p.role) || 1));
        inner = '<div class="wr-hot-row" style="display:grid;grid-template-columns:30px 1fr auto;gap:12px;align-items:center;' +
          singleCardStyle(p, '#ffffff', 12, 14, 11) + '">' +
          '<b class="wr-hot-rank wr-rank-' + rkNo + '">' + esc(p.role || '1') + '</b>' +
          '<span class="wr-hot-title">' + esc(p.title) + '</span>' +
          '<span class="wr-hot-heat">' + esc(p.desc) + '</span></div>';
        break;
      }
      case 'post1': {
        var po1Img = resolveMedia(p.src);
        inner = '<article class="wr-post" style="' + singleCardStyle(p, '#ffffff', 14, 0, 0) + ';overflow:hidden">' +
          (po1Img
            ? '<img src="' + esc(po1Img) + '" alt="' + esc(p.title) + '" loading="lazy" decoding="async" style="width:100%;height:160px;object-fit:cover;display:block">'
            : '<div class="wr-post-nocover" style="height:160px">▧</div>') +
          '<div class="wr-post-body" style="padding:16px 18px">' +
          '<h3 style="margin:0 0 6px;font-size:' + pnum(p, 'cardTitleSize', 17, 8, 40) + 'px">' +
          (p.href && p.href !== '#'
            ? '<a href="' + esc(safeUrl(p.href, '#')) + '" style="color:inherit;text-decoration:none">' + esc(p.title) + '</a>'
            : esc(p.title)) + '</h3>' +
          (p.dateText ? '<div class="wr-post-date">' + esc(p.dateText) + '</div>' : '') +
          (p.desc ? '<p style="font-size:' + pnum(p, 'cardTextSize', 13, 8, 40) + 'px">' + nl(p.desc) + '</p>' : '') +
          '</div></article>';
        break;
      }
      case 'job1': {
        var j1Accent = safeCssColor(p.jobAccent, '#3b82f6');
        var j1Href = safeUrl(p.href, '');
        var j1Btn = btnSkin(p, {
          auto: 'outline', bg: j1Accent, color: j1Accent, radius: 8,
          padX: 16, padY: 8, fontSize: 13, weight: '600', shadow: 'none'
        });
        inner = '<div class="wr-jobs" style="border-radius:' + pnum(p, 'radius', 12, 0, 120) + 'px;--wr-job-accent:' + j1Accent + '">' +
          '<div class="wr-job" style="' + singleCardStyle(p, '#ffffff', 12, 16, 14) + '">' +
          '<div class="wr-job-main"><b style="font-size:' + pnum(p, 'cardTitleSize', 15, 8, 40) + 'px">' + esc(p.title) + '</b>' +
          (p.role ? '<span class="wr-job-loc">⌖ ' + esc(p.role) + '</span>' : '') + '</div>' +
          (p.prodPrice ? '<span class="wr-job-salary">' + esc(p.prodPrice) + '</span>' : '') +
          '<a class="wr-job-btn" href="' + esc(j1Href || '#') + '" style="' + css(j1Btn) + '">查看详情 →</a>' +
          '</div></div>';
        break;
      }
      case 'shot1': {
        var shSrc = resolveMedia(p.src);
        inner = '<figure style="margin:0;text-align:' + (p.align || 'center') + '">' +
          '<img src="' + esc(shSrc || PLACEHOLDER_IMG) + '" alt="' + esc(p.caption) + '" loading="lazy" decoding="async" style="' +
          css({
            width: Math.max(10, Math.min(100, Number(p.width) || 100)) + '%',
            'border-radius': pnum(p, 'radius', 12, 0, 120) + 'px',
            display: 'block', margin: '0 auto'
          }) + '">' +
          (p.caption ? '<figcaption style="margin-top:10px;font-size:13px;opacity:.7">' + esc(p.caption) + '</figcaption>' : '') +
          '</figure>';
        break;
      }
      default:
        inner = '<p>未知模块：' + esc(b.type) + '</p>';
    }
    // 容器描边，方便在画布上辨认范围（通用边框优先）
    if (b.type === 'container' && p.lineColor && !hasOwnBorder(b)) {
      W += ';border:1px solid ' + safeCssColor(p.lineColor);
    }
    // 吸顶导航：导出态没有包裹层时 sticky 加在 section 上；
    // 但如果这个模块上挂了浮层，外层会套 .wr-stack（position:relative），
    // sticky 留在 section 上就只能在 wr-stack 那点高度里吸附 → 永远吸不住。
    // 这种情况改为把 sticky 提到 .wr-stack 宿主（见 blockWrapHTML 导出分支）。
    if (!editor && isStickyNav(b) && !hostedSticky) W += ';' + stickyCSS(b);
    var animName = animOf(p);
    var fxVars = animVars(b, animDelay);
    if (fxVars) W = fxVars + W;
    var attrs = '';
    var sid = sectionId(b);
    if (sid) attrs += ' id="' + esc(sid) + '"';
    var cls = sectionClass(b);
    if (cls) attrs += ' class="' + esc(cls) + '"';
    if (animName !== 'none') {
      attrs += ' data-anim="' + animName + '"';
      if (String(cv(p, 'animOnce')) === '1') attrs += ' data-anim-once="1"';
    }
    if (cv(p, 'boxHover') === 'tilt' || cv(p, 'boxHover') === 'tilt-glare') {
      attrs += ' data-tilt="1"' + (cv(p, 'boxHover') === 'tilt-glare' ? ' data-glare="1"' : '');
    }
    if (cv(p, 'boxHover') === 'magnet') attrs += ' data-magnet="1"';
    if (cv(p, 'boxHover') === 'dir') attrs += ' data-dir="1"';
    if (cv(p, 'loopFx') === 'typewriter') attrs += ' data-type="1"';
    // 稳定 ID：重新导入时用它把浮层的目标映射回新的模块 ID
    attrs += ' data-wr-id="' + esc(b.id) + '"';
    // 独立配色 / 主题样式：给 section 打上 data-wr-nobg，退出深色模式的整页统一覆盖
    var roleNow = themeRoleEff(p);
    if (String(cv(p, 'boxColorLock') || '') === '1' || roleNow !== 'auto') attrs += ' data-wr-nobg="1"';
    // 主题角色也写出来：没内嵌工程快照的旧导出页，靠它才能把「在主题下长什么样」还原回去
    if (roleNow !== 'auto') attrs += ' data-wr-theme="' + esc(roleNow) + '"';
    if (isOverlay(b)) {
      // 目标为空（“紧挨着的上一个模块”）或原目标被删除时，renderBlocks 会把解析后的
      // 真实宿主 ID 传进来；导出页必须写解析结果，否则重新导入时浮层会失去宿主。
      var lt = (layerTarget != null && layerTarget !== '') ? layerTarget : cv(p, 'layerTarget');
      attrs += ' data-layer-mode="overlay" data-layer-target="' + esc(String(lt || '')) + '"';
    }
    // 视差滚动：只挂在顶层、且没有进场动画 / 悬停位移 / 常驻动效的模块上，
    // 保证同一元素只有一个 transform 来源，不会互相覆盖
    if (parEligible(b, parentBlock)) attrs += ' data-par="0.055"';
    // title / 无障碍名称：直接写在 section 上
    var htip = String(cv(p, 'boxHoverTip') || '').trim();
    if (htip) attrs += ' title="' + esc(htip) + '"';
    var alab = String(cv(p, 'boxAriaLabel') || '').trim();
    if (alab) attrs += ' aria-label="' + esc(alab) + '"';
    // 整块链接：铺一层绝对定位的透明 <a> 覆盖整个模块（容器本身不铺，避免挡住子模块点击）。
    // 放进 inner 里，让下方 decorateLinks 统一处理 href 白名单与 target/rel；CSS 里把内部真实
    // 链接 / 按钮抬到更高层级，保证它们仍可点击。
    var wholeHref = String(cv(p, 'boxHref') || '').trim();
    if (wholeHref && !isContainer(b)) {
      inner += '<a class="wr-blocklink" href="' + esc(safeUrl(wholeHref, '#')) + '"' +
        (alab ? ' aria-label="' + esc(alab) + '"' : '') + '></a>';
    }
    // 先处理本模块自己的链接，再还原子块 HTML，避免父容器覆盖子块的链接设置
    var content = decorateLinks(inner, b).split(CHILD_TOKEN).join(childrenHTML || '');
    // W 里含用户可编辑的颜色 / 追加 CSS，输出前统一转义，避免闭合 style 属性注入事件
    var sec = '<section' + attrs + ' style="' + esc(W) + '">' + content + '</section>';
    // 浮层的定位放在外层，section 自己的 transform 留给进场动画 / 悬停效果
    if (isOverlay(b)) {
      return '<div class="wr-layer" data-layer-pe="' + layerPEMode(b) + '" style="' + esc(layerCSS(b)) + '">' + sec + '</div>';
    }
    return sec;
  }

  /* ---------- 递归渲染：画布与导出共用 ---------- */
  function blockWrapHTML(b, editor, parentId, index, overlays, layerTarget) {
    // 容器先递归渲染子块；编辑态带 .b-block 包裹，导出态是纯 section
    var parent = parentId ? getBlock(parentId) : null;
    var kidHTML = isContainer(b) ? renderBlocks(b.children, editor, b.id) : '';
    // 父容器设了「依次入场」时，子模块按顺序累加延迟
    var stagger = (parent && isContainer(parent)) ? Math.max(0, cnum(parent.p, 'animStagger')) : 0;
    // 导出态：吸顶导航若被浮层包裹，sticky 必须交给 .wr-stack 宿主，
    // 否则 sticky 的包含块就是那个等高的宿主，没有任何可滚动空间 → 吸顶失效
    var hostStack = !editor && (overlays || []).length > 0;
    var hostedSticky = hostStack && isStickyNav(b);
    var body = blockHTML(b, kidHTML, editor, parent, stagger * Math.max(0, index || 0), hostedSticky, layerTarget, hostStack);
    var hosted = (overlays || []).map(function (o, i) {
      var okid = isContainer(o) ? renderBlocks(o.children, editor, o.id) : '';
      // 叠在这个宿主上的浮层，导出时目标就是宿主 ID
      return blockHTML(o, okid, editor, parent, i, false, b.id);
    }).join('');
    if (!editor) {
      // 有浮层挂在这个模块上时套一层相对定位宿主；浮层自己是 .wr-layer。
      // 吸顶导航的 sticky 提到宿主上，position:sticky 本身也是定位上下文，浮层仍相对它定位。
      // 容器/弹性盒里的模块，跨列与弹性宽度也必须写在宿主上，否则 section 不再是布局子项，跨列失效。
      if (!hosted) return body;
      var hostStyle = [colCSS(b, parent), hostedSticky ? stickyCSS(b) : ''].filter(Boolean).join(';');
      return '<div class="wr-stack" data-layer-host="' + esc(b.id) + '"' +
        (hostStyle ? ' style="' + esc(hostStyle) + '"' : '') + '>' + body + hosted + '</div>';
    }
    // 包裹层只带「设备可见性」类（用于整块隐藏）；投影 / 悬停 / 自定义类只给 section，
    // 否则编辑器里父子两层各变换一次，和导出页不一致
    var vis = cv(b.p, 'boxVisibility');
    var wrapVis = vis === 'desktop' ? ' wr-only-desktop' : (vis === 'mobile' ? ' wr-only-mobile' : '');
    var sticky = stickyCSS(b);
    var overlay = isOverlay(b);
    var wrapStyle = [sizeCSS(b), colCSS(b, parent), sticky, overlay ? layerCSS(b) : ''].filter(Boolean).join(';');
    var cls = 'b-block' + (b.id === selectedId ? ' selected' : '') +
      (isContainer(b) ? ' is-nest' : '') +
      (vis === 'hidden' ? ' is-hidden' : '') + wrapVis + (sticky ? ' is-sticky' : '') +
      (overlay ? ' is-overlay' : '') + (hosted ? ' has-overlay' : '');
    var hostHTML = hosted
      ? '<div class="wr-overlay-host" data-layer-host="' + esc(b.id) + '">' +
        (overlays || []).map(function (o, i) {
          var okid = isContainer(o) ? renderBlocks(o.children, editor, o.id) : '';
          var os = (parent && isContainer(parent)) ? Math.max(0, cnum(parent.p, 'animStagger')) : 0;
          return blockWrapHTML(o, true, parentId, i, []);
        }).join('') + '</div>'
      : '';
    return '<div class="' + cls + '" data-id="' + b.id + '" data-parent="' + esc(parentId || '') + '"' +
      (overlay ? ' data-layer-pe="' + layerPEMode(b) + '"' : '') +
      ' draggable="true" style="' + esc(wrapStyle) + '">' +
      (overlay ? '<span class="b-layer-handle" data-layer="' + b.id + '" title="拖动浮层位置">✥ 浮层</span>' : '') +
      '<div class="b-handle" title="拖动排序">⋮⋮</div>' +
      '<div class="b-tools">' +
      '<button data-act="layer" title="切换为浮层 / 普通模块">' + (overlay ? '▣' : '◫') + '</button>' +
      '<button data-act="up" title="上移">↑</button>' +
      '<button data-act="down" title="下移">↓</button>' +
      '<button data-act="dup" title="复制">⧉</button>' +
      '<button data-act="del" class="del" title="删除">✕</button>' +
      '</div><span class="b-resize" data-resize="' + b.id + '" title="拖动调整宽度和高度"></span>' +
      (sticky ? '<span class="b-sticky-tag" title="已开启吸顶：滚动画布时此模块固定在顶部">⇅ 吸顶</span>' : '') +
      '<span class="b-size-tip"></span>' + body + hostHTML + '</div>';
  }
  function renderBlocks(list, editor, parentId) {
    // 导出时彻底跳过「隐藏」的模块；编辑器里仍保留，方便随时改回来
    var kids = (list || []).filter(function (b) {
      return editor || cv(b.p, 'boxVisibility') !== 'hidden';
    });
    if (!kids.length) {
      if (!editor || !parentId) return '';
      var pb = getBlock(parentId);
      var inRow = pb && pb.p.layout && pb.p.layout !== 'stack';
      var tip = inRow ? '＋ 拖入多个模块，会并排放在同一行 · 也能再放容器' : '＋ 拖入模块到这里 · 容器里还能再放容器';
      return '<div class="nest-empty" data-nest-empty="' + esc(parentId) +
        '" style="grid-column:1/-1;flex-basis:100%">' + tip + '</div>';
    }
    var normal = kids.filter(function (b) { return !isOverlay(b); });
    var overlays = kids.filter(isOverlay);
    var ids = {};
    normal.forEach(function (b) { ids[b.id] = 1; });
    /* 浮层宿主解析：
       - 目标留空 = 紧挨着的上一个普通模块（和属性面板的提示一致）；
       - 目标是另一个浮层 = 跟着它的宿主走（多层叠放在导出时拍平成同一个宿主，
         坐标本来就相对宿主计算，视觉一致）；
       - 目标被删除 / 跨层级（不在同一列表里）= 退回前面最近的普通模块；
       - 前面没有任何普通模块 = 按普通排版输出，避免出现没有定位参照的浮层飞到页面左上角。 */
    var targetOf = {}, flow = {}, hostOf = {};
    var lastNormal = null;
    var prevNormalOf = {};
    kids.forEach(function (b) {
      if (!isOverlay(b)) { lastNormal = b; hostOf[b.id] = b.id; return; }
      prevNormalOf[b.id] = lastNormal ? lastNormal.id : '';
    });
    var allIds = {};
    kids.forEach(function (b) { if (b) allIds[b.id] = 1; });
    var rawTarget = {};
    overlays.forEach(function (o) {
      var t = String(cv(o.p, 'layerTarget') || '');
      if (t && t !== o.id && allIds[t]) rawTarget[o.id] = t;
    });
    // 目标可能指向后面才定义的浮层：多轮解析直到稳定
    var moved = true;
    while (moved) {
      moved = false;
      overlays.forEach(function (o) {
        if (hostOf[o.id]) return;
        var t = rawTarget[o.id];
        if (t && hostOf[t]) { hostOf[o.id] = hostOf[t]; targetOf[o.id] = hostOf[t]; moved = true; }
      });
    }
    overlays.forEach(function (o) {
      if (hostOf[o.id]) return;
      var host = prevNormalOf[o.id];
      if (host) { targetOf[o.id] = host; hostOf[o.id] = host; }
      else flow[o.id] = 1;
    });
    var byTarget = function (id) {
      return overlays.filter(function (o) { return targetOf[o.id] === id; });
    };
    var normalHTML = normal.map(function (b, i) {
      return blockWrapHTML(b, editor, parentId, i, byTarget(b.id));
    }).join('');
    var flowHTML = overlays.filter(function (o) { return flow[o.id]; }).map(function (o, i) {
      // 没有宿主可叠：临时按普通模块渲染，不写回项目数据，用户选好目标后自动恢复
      var flat = Object.assign({}, o, { p: Object.assign({}, o.p, { layerMode: 'normal' }) });
      return blockWrapHTML(flat, editor, parentId, normal.length + i, []);
    }).join('');
    return normalHTML + flowHTML;
  }

  /* ---------- 渲染：画布 ---------- */
  var canvasRaf = 0;
  /* 属性输入用 rAF 合并：一次敲键只重绘一帧，避免长页面逐字重建整棵 DOM */
  function scheduleCanvasRender() {
    if (canvasRaf) return;
    canvasRaf = requestAnimationFrame(function () {
      canvasRaf = 0;
      renderCanvas(); renderLayers();
    });
  }
  function cancelCanvasRender() {
    if (canvasRaf) { cancelAnimationFrame(canvasRaf); canvasRaf = 0; }
  }
  function renderCanvas() {
    var c = $('#canvas');
    var sc = c.closest ? c.closest('.canvas-scroll') : null;
    var top = sc ? sc.scrollTop : 0, left = sc ? sc.scrollLeft : 0;
    // innerHTML 重建会丢掉折叠菜单 / FAQ / 复选框状态与滚动位置，这里先存后还原
    var opened = [], checked = [];
    $$('details', c).forEach(function (d, i) { if (d.open) opened.push(i); });
    $$('input[type="checkbox"]', c).forEach(function (x, i) { if (x.checked) checked.push(i); });
    c.setAttribute('data-device', device);
    // 画布本身不能裁剪内容，否则会截断 sticky 的吸附范围（见 style.css .canvas.has-sticky）
    c.classList.toggle('has-sticky', hasStickyNav());
    // 页面级配色同步到画布，编辑态与导出态保持一致
    c.style.background = state.page.bg ? safePaint(state.page.bg, '#ffffff') : '#ffffff';
    c.style.color = state.page.text ? safeCssColor(state.page.text) : '#16233a';
    if (!state.blocks.length) {
      c.innerHTML = '<div class="empty-canvas"><div class="big">✧</div><h3>画布还是空的</h3>' +
        '<p>从左边把素材拖进来，或者直接点一下素材卡片。也可以把图片文件直接拖到这里。</p></div>';
    } else {
      c.innerHTML = renderBlocks(state.blocks, true, null);
    }
    $$('details', c).forEach(function (d, i) { if (opened.indexOf(i) >= 0) d.open = true; });
    $$('input[type="checkbox"]', c).forEach(function (x, i) { if (checked.indexOf(i) >= 0) x.checked = true; });
    if (sc) { sc.scrollTop = top; sc.scrollLeft = left; }
  }

  /* ---------- 渲染：层级树 ---------- */
  function shortLabel(b) {
    var p = b.p, a = ASSET_MAP[b.type];
    if (isContainer(b)) return a.label + ' · ' + (b.children || []).length + ' 个子模块';
    var t = p.title || p.text || p.kicker || p.items || p.leftTitle || p.caption || '';
    t = String(t).split('\n')[0].replace(/[|｜]/g, ' ').trim();
    // 图片地址 / base64 / 素材引用不适合显示在层级树里
    if (/^(asset:|data:|https?:|\/\/)/i.test(t) || t.length > 120) t = '图片内容';
    if (t.length > 16) t = t.slice(0, 16) + '…';
    return a.label + (t ? ' · ' + t : '');
  }
  function renderLayers() {
    $('#layerCount').textContent = countBlocks(state.blocks) + ' 个模块';
    var box = $('#layerTree');
    if (!state.blocks.length) { box.innerHTML = '<div class="layer-empty">暂无模块</div>'; return; }
    function walk(list, depth) {
      return list.map(function (b, i) {
        var kids = isContainer(b) ? (b.children || []) : [];
        return '<div class="layer-item' + (b.id === selectedId ? ' active' : '') + '" tabindex="0" role="button" aria-label="选中模块 ' + esc(shortLabel(b)) + '" data-layer="' + b.id +
          '" data-depth="' + depth + '" style="padding-left:' + (9 + depth * 14) + 'px">' +
          '<span class="li-ico">' + (isContainer(b) ? '⬚' : esc(ASSET_MAP[b.type].ico)) + '</span>' +
          '<span class="li-txt">' + esc(shortLabel(b)) + '</span>' +
          '<span class="li-n">' + (kids.length ? kids.length + ' 子' : (i + 1)) + '</span></div>' +
          walk(kids, depth + 1);
      }).join('');
    }
    box.innerHTML = walk(state.blocks, 0);
  }

  /* ---------- 渲染：属性面板 ---------- */
  function mediaAssetOptions() {
    var opts = '<option value="">从我的图片选择…</option>';
    (state.assets || []).forEach(function (a) {
      opts += '<option value="asset:' + esc(a.id) + '">' + esc(a.name) + '</option>';
    });
    if (!(state.assets || []).length) opts += '<option value="" disabled>（还没有上传图片）</option>';
    return opts;
  }
  /* 颜色字段 = 色块预览（内嵌原生吸色器）+ 文本框 + 渐变开关
     一个字段既能存 #hex，也能存 linear-gradient(...)，导出的 CSS 完全一致。 */
  function colorFieldHTML(k, value, ph) {
    var v = value == null ? '' : String(value);
    var grad = isGradient(v);
    var g = grad ? parseGradient(v)
      : { type: 'linear', angle: 135, c1: toHexColor(v), c2: mixHex(toHexColor(v), -0.32) };
    var storeKey = (selectedId || 'page') + ':' + k;
    var open = !!gradOpen[storeKey];
    var presets = GRAD_PRESETS.map(function (pair) {
      return '<button type="button" class="grad-chip" data-grad-preset="' + pair[0] + '|' + pair[1] +
        '" title="' + pair[0] + ' → ' + pair[1] + '" aria-label="渐变 ' + pair[0] + ' 到 ' + pair[1] +
        '" style="background:linear-gradient(to right,' + pair[0] + ',' + pair[1] + ')"></button>';
    }).join('');
    return '<div class="color-field' + (grad ? ' is-grad' : '') + '">' +
      '<div class="color-row">' +
      '<span class="color-prev" style="background:' + esc(safePaint(v, '#ffffff')) + '">' +
      '<input type="color" class="color-native" data-key="' + k + '" value="' + toHexColor(v) + '" aria-label="选择颜色">' +
      '</span>' +
      '<input class="prop-input" data-key="' + k + '" value="' + esc(v) + '" placeholder="' + esc(ph || '留空为透明') + '" spellcheck="false">' +
      (canGradient(k) ? '<button type="button" class="color-mode' + (grad ? ' active' : '') + '" data-grad-toggle="' + k +
        '" title="渐变颜色" aria-label="渐变颜色" aria-expanded="' + String(open) + '">渐变</button>' : '') +
      '</div>' +
      (canGradient(k) ? '<div class="grad-editor" data-grad-editor="' + k + '" data-gtype="' + g.type + '" data-angle="' + g.angle +
        '" data-c1="' + g.c1 + '" data-c2="' + g.c2 + '"' + (open ? '' : ' hidden') + '>' +
        '<div class="grad-prev" style="background:' + esc(gradientCSS(g)) + '"></div>' +
        '<div class="grad-row"><span class="grad-lbl">类型</span><div class="seg grad-type">' +
        ['linear:线性', 'radial:径向', 'conic:锥形'].map(function (o) {
          var kv = o.split(':');
          return '<button type="button" data-gtype-set="' + kv[0] + '"' +
            (g.type === kv[0] ? ' class="active"' : '') + '>' + kv[1] + '</button>';
        }).join('') + '</div></div>' +
        '<div class="grad-row grad-angle-row"' + (g.type === 'radial' ? ' hidden' : '') + '>' +
        '<span class="grad-lbl">角度</span>' +
        '<input type="range" class="grad-angle" min="0" max="360" step="15" value="' + g.angle + '">' +
        '<span class="grad-angval">' + g.angle + '°</span></div>' +
        '<div class="grad-row grad-stops">' +
        '<label class="grad-stop"><i style="background:' + g.c1 + '"><input type="color" class="grad-c1" value="' + g.c1 + '"></i>起点</label>' +
        '<label class="grad-stop"><i style="background:' + g.c2 + '"><input type="color" class="grad-c2" value="' + g.c2 + '"></i>终点</label>' +
        '</div>' +
        '<div class="grad-presets">' + presets + '</div>' +
        '<div class="grad-actions"><button type="button" data-grad-reset="' + k + '">恢复纯色</button>' +
        '<span class="grad-note">改动即时生效</span></div>' +
        '</div>' : '') +
      '</div>';
  }
  /* 读取渐变编辑器当前状态并写回字段 */
  function applyGradientField(field) {
    var ed = $('.grad-editor', field);
    if (!ed) return;
    var g = {
      type: ed.getAttribute('data-gtype') || 'linear',
      angle: Number(ed.getAttribute('data-angle')) || 0,
      c1: ed.getAttribute('data-c1') || '#3b82f6',
      c2: ed.getAttribute('data-c2') || '#8b5cf6'
    };
    var val = gradientCSS(g);
    var text = $('input.prop-input[data-key]', field);
    var key = text ? text.getAttribute('data-key') : ed.getAttribute('data-grad-editor');
    if (text) text.value = val;
    var prev = $('.color-prev', field);
    if (prev) prev.style.background = val;
    var gp = $('.grad-prev', ed);
    if (gp) gp.style.background = val;
    field.classList.add('is-grad');
    var mode = $('.color-mode', field);
    if (mode) mode.classList.add('active');
    applyProp(key, val, text);
  }
  function handleGradInput(field, el) {
    var ed = el.closest('.grad-editor');
    if (!ed) return;
    if (el.classList.contains('grad-angle')) {
      ed.setAttribute('data-angle', String(Number(el.value) || 0));
      var lbl = $('.grad-angval', ed);
      if (lbl) lbl.textContent = (Number(el.value) || 0) + '°';
    } else if (el.classList.contains('grad-c1') || el.classList.contains('grad-c2')) {
      var which = el.classList.contains('grad-c1') ? 'data-c1' : 'data-c2';
      ed.setAttribute(which, el.value);
      var sw = el.parentNode;
      if (sw && sw.tagName === 'I') sw.style.background = el.value;
    }
    applyGradientField(field);
  }
  function handleGradClick(field, target) {
    var ed = $('.grad-editor', field);
    if (!ed) return false;
    var toggle = target.closest('[data-grad-toggle]');
    if (toggle) {
      var willOpen = ed.hidden;
      ed.hidden = !willOpen;
      gradOpen[(selectedId || 'page') + ':' + toggle.getAttribute('data-grad-toggle')] = willOpen;
      toggle.setAttribute('aria-expanded', String(willOpen));
      return true;
    }
    if (ed.hidden) return false;
    var tset = target.closest('[data-gtype-set]');
    if (tset) {
      var t = tset.getAttribute('data-gtype-set');
      ed.setAttribute('data-gtype', t);
      $$('.grad-type button', ed).forEach(function (b) { b.classList.toggle('active', b === tset); });
      var angleRow = $('.grad-angle-row', ed);
      if (angleRow) angleRow.hidden = t === 'radial';
      applyGradientField(field);
      return true;
    }
    var chip = target.closest('[data-grad-preset]');
    if (chip) {
      var pair = String(chip.getAttribute('data-grad-preset')).split('|');
      ed.setAttribute('data-c1', pair[0]);
      ed.setAttribute('data-c2', pair[1]);
      var i1 = $('.grad-c1', ed), i2 = $('.grad-c2', ed);
      if (i1) { i1.value = pair[0]; if (i1.parentNode.tagName === 'I') i1.parentNode.style.background = pair[0]; }
      if (i2) { i2.value = pair[1]; if (i2.parentNode.tagName === 'I') i2.parentNode.style.background = pair[1]; }
      applyGradientField(field);
      return true;
    }
    var reset = target.closest('[data-grad-reset]');
    if (reset) {
      var base = ed.getAttribute('data-c1') || '#3b82f6';
      var text = $('input.prop-input[data-key]', field);
      var key = text ? text.getAttribute('data-key') : reset.getAttribute('data-grad-reset');
      if (text) text.value = base;
      var prev = $('.color-prev', field);
      if (prev) prev.style.background = base;
      var native = $('.color-native', field);
      if (native) native.value = base;
      var mode = $('.color-mode', field);
      if (mode) mode.classList.remove('active');
      field.classList.remove('is-grad');
      ed.hidden = true;
      gradOpen[(selectedId || 'page') + ':' + key] = false;
      applyProp(key, base, text);
      return true;
    }
    return false;
  }

  /* 多行内容的编辑器：一行一个块，每格一个输入框，行可以加 / 删 / 上下移 */
  /* 同一个字段键在不同组件里含义可能不同（如 items：网格是图标/标题，数字统计是数值/说明） */
  function rowsFieldFor(type, key) {
    var f = FIELD_MAP[key];
    if (!f || f.type !== 'rows') return f;
    var over = type && ASSET_MAP[type] && ASSET_MAP[type].rowCols ? ASSET_MAP[type].rowCols[key] : null;
    if (!over) return f;
    return Object.assign({}, f, { cols: over, long: -1 });
  }
  /* 展开中的「某一条的独立样式」：带模块 ID，切换模块时自动收起 */
  var rowStyleOpen = { id: '', key: '', idx: -1 };
  function rowStyleIsOpen(b, key, i) {
    return !!b && rowStyleOpen.id === b.id && rowStyleOpen.key === key && rowStyleOpen.idx === i;
  }
  function toggleRowStyle(key, idx) {
    var b = getBlock(selectedId);
    if (!b) return;
    if (rowStyleIsOpen(b, key, idx)) { rowStyleOpen.id = ''; rowStyleOpen.key = ''; rowStyleOpen.idx = -1; }
    else { rowStyleOpen.id = b.id; rowStyleOpen.key = key; rowStyleOpen.idx = idx; }
    refreshRows(key);
  }
  function rowStyleHTML(f, p, i) {
    var s = rowSty(p, f.k, i) || {};
    var baseBg = toHexColor(paint(p.cardBg, '') || state.page.accent || '#f5f8ff');
    var baseInk = toHexColor(paint(p.color, '#16233a'));
    function colorRow(k, label, defVal) {
      var cur = toHexColor(paint(s[k], '') || defVal);
      return '<label class="rs-f"><span>' + label + '</span><span class="rs-cw">' +
        '<input type="color" class="rs-color" data-rs="' + k + '" data-rs-key="' + f.k + '" data-rs-idx="' + i + '" value="' + esc(cur) + '">' +
        (s[k] ? '<button type="button" class="rs-x" data-rs-clear="' + k + '" title="恢复跟随整体">✕</button>' : '') +
        '</span></label>';
    }
    function numRow(k, label, ph, min, max) {
      return '<label class="rs-f"><span>' + label + '</span>' +
        '<input type="number" class="rs-num" data-rs="' + k + '" data-rs-key="' + f.k + '" data-rs-idx="' + i + '"' +
        ' value="' + (s[k] == null ? '' : esc(String(s[k]))) + '" placeholder="' + ph + '" min="' + min + '" max="' + max + '"></label>';
    }
    return '<div class="rows-style" data-rs-box="' + f.k + '" data-rs-idx="' + i + '">' +
      '<div class="rs-head"><b>第 ' + (i + 1) + ' 条</b><em>只改这一条</em></div>' +
      '<div class="rs-grid">' +
      colorRow('bg', '底色', baseBg) +
      colorRow('color', '文字', baseInk) +
      numRow('radius', '圆角', '跟随', 0, 120) +
      numRow('padX', '左右距', '跟随', 0, 160) +
      numRow('padY', '上下距', '跟随', 0, 160) +
      numRow('icon', '图标', '跟随', 0, 160) +
      '<label class="rs-f rs-wide"><span>角标</span>' +
      '<input type="text" class="rs-txt" data-rs="badge" data-rs-key="' + f.k + '" data-rs-idx="' + i + '"' +
      ' value="' + esc(s.badge || '') + '" maxlength="10" placeholder="推荐 / HOT，留空不显示"></label>' +
      colorRow('badgeColor', '角标色', '#3b82f6') +
      '<label class="rs-f rs-check rs-wide"><input type="checkbox" data-rs="hide" data-rs-key="' + f.k + '" data-rs-idx="' + i + '"' +
      (s.hide === '1' ? ' checked' : '') + '><span>在页面上隐藏这一条</span></label>' +
      '</div>' +
      '<button type="button" class="rs-reset" data-rs-reset="1">这一条全部恢复跟随整体</button>' +
      '</div>';
  }
  function rowsBodyHTML(f, rows) {
    var b = getBlock(selectedId);
    var cols = rowsCols(f, rows);
    var names = (f.cols || []).slice();
    while (names.length < cols) names.push('第 ' + (names.length + 1) + ' 格');
    var body = rows.map(function (r, i) {
      var cells = '';
      for (var j = 0; j < cols; j++) {
        var val = r[j] == null ? '' : r[j];
        var attr = ' data-key="' + f.k + '" data-row="' + i + '" data-col="' + j + '"' +
          ' placeholder="' + esc(names[j]) + '" title="' + esc(names[j]) + '"';
        cells += (f.long === j)
          ? '<textarea class="prop-textarea rows-cell rows-long"' + attr + ' rows="2" spellcheck="false">' + esc(val) + '</textarea>'
          : '<input class="prop-input rows-cell"' + attr + ' value="' + esc(val) + '" spellcheck="false">';
      }
      var open = rowStyleIsOpen(b, f.k, i);
      var bp = b ? b.p : {};
      var hasSty = !!rowSty(bp, f.k, i);
      return '<div class="rows-item' + (open ? ' is-open' : '') + '">' +
        '<div class="rows-bar"><b>' + (i + 1) + '</b>' +
        '<button type="button" class="rows-sty' + (hasSty ? ' has-sty' : '') + '" data-row-act="style"' +
        ' aria-expanded="' + (open ? 'true' : 'false') + '"' +
        ' title="这一条单独设样式">◐</button>' +
        '<span class="rows-move">' +
        (i > 0 ? '<button type="button" data-row-act="up" title="上移">↑</button>' : '') +
        (i < rows.length - 1 ? '<button type="button" data-row-act="down" title="下移">↓</button>' : '') +
        '<button type="button" data-row-act="del" title="删除这一行">✕</button></span></div>' +
        '<div class="rows-cells' + (cols > 1 ? ' is-two' : '') + '">' + cells + '</div>' +
        (open ? rowStyleHTML(f, bp, i) : '') + '</div>';
    }).join('');
    var head = '<div class="rows-head"><span>' + (rows.length ? '共 ' + rows.length + ' 行' : '还没有内容') + '</span>' +
      (rows.length ? '<button type="button" data-row-act="clear">清空</button>' : '') + '</div>';
    var colTools = f.flexCols
      ? '<div class="rows-cols"><button type="button" data-row-act="addcol">＋ 加一列</button>' +
        (cols > 1 ? '<button type="button" data-row-act="delcol">－ 去一列</button>' : '') + '</div>'
      : '';
    var mediaTools = f.mediaRows
      ? '<div class="media-row-tools">' +
        '<button type="button" data-media="upload" data-row-key="' + f.k + '">＋ 追加图片行</button>' +
        '<select class="media-pick" data-media="asset" data-row-key="' + f.k + '">' + mediaAssetOptions() + '</select>' +
        '<input type="file" class="media-file" data-media-file="' + f.k + '" data-media-row="1" accept="image/*" hidden>' +
        '</div>'
      : '';
    return head + body +
      '<button type="button" class="rows-add" data-row-act="add">＋ 添加一行</button>' + colTools + mediaTools;
  }
  function rowsBoxHTML(f, value) {
    return '<div class="prop-rows" data-rows="' + f.k + '">' + rowsBodyHTML(f, rowsOf(value)) + '</div>';
  }
  /* 只重绘这一个编辑器，面板不整体刷新，滚动位置和输入焦点都不会丢 */
  function refreshRows(key) {
    var b = getBlock(selectedId);
    var f = FIELD_MAP[key];
    var box = $('#propPanel .prop-rows[data-rows="' + key + '"]');
    if (!b || !f || !box) return;
    box.innerHTML = rowsBodyHTML(rowsFieldFor(b.type, key) || f, rowsOf(b.p[key]));
  }
  function setRowCell(key, el) {
    var b = getBlock(selectedId);
    if (!b) return;
    var i = Number(el.getAttribute('data-row')), j = Number(el.getAttribute('data-col'));
    if (!isFinite(i) || !isFinite(j) || i < 0 || j < 0) return;
    var rows = rowsOf(b.p[key]);
    while (rows.length <= i) rows.push([]);
    while (rows[i].length <= j) rows[i].push('');
    rows[i][j] = el.value;
    b.p[key] = rows;
    scheduleCanvasRender(); scheduleHistory(); scheduleSave();
  }
  function rowAction(key, act, idx) {
    var b = getBlock(selectedId);
    if (!b) return;
    var f = rowsFieldFor(b.type, key) || { cols: [] };
    var rows = rowsOf(b.p[key]);
    var cols = rowsCols(f, rows);
    var total = rows.length;
    var styAct = '';
    if (act === 'add') {
      var nr = [];
      for (var i = 0; i < cols; i++) nr.push('');
      rows.push(nr);
    } else if (act === 'del') {
      rows.splice(idx, 1);
      styAct = 'del';
    } else if (act === 'up' && idx > 0) {
      var a = rows[idx - 1]; rows[idx - 1] = rows[idx]; rows[idx] = a;
      styAct = 'up';
    } else if (act === 'down' && idx >= 0 && idx < total - 1) {
      var c2 = rows[idx + 1]; rows[idx + 1] = rows[idx]; rows[idx] = c2;
      styAct = 'down';
    } else if (act === 'clear') {
      rows = [];
      styAct = 'clear';
    } else if (act === 'addcol') {
      rows.forEach(function (r) { r.push(''); });
    } else if (act === 'delcol') {
      if (cols <= 1) return;
      rows.forEach(function (r) { r.length = Math.max(1, r.length - 1); });
    }
    b.p[key] = rows;
    // 样式跟着那一行走：删了就没了，换位就一起换。搬完必须重算 CSS，否则视觉还停在旧索引上
    if (styAct) { shiftRowSty(b.p, key, styAct, idx); syncComponentCSS(); }
    refreshRows(key);
    scheduleCanvasRender(); scheduleHistory(); scheduleSave();
  }
  function fieldHTML(f, value, type) {
    var v = value == null ? '' : value;
    var hint = f.hint ? ' <span class="opt">' + esc(f.hint) + '</span>' : '';
    var ctrl = '';
    switch (f.type) {
      case 'media':
        ctrl = '<div class="media-field">' +
          '<div class="media-row">' +
          '<span class="media-thumb" title="' + esc(String(v).slice(0, 60)) + '">' + mediaPreview(v) + '</span>' +
          '<input class="prop-input" data-key="' + f.k + '" value="' + esc(v) +
          '" placeholder="' + esc(f.ph || 'emoji 或图片网址') + '" spellcheck="false">' +
          '</div><div class="media-tools">' +
          '<button type="button" data-media="upload" data-key="' + f.k + '"' + (f.multi ? ' data-media-multi="1"' : '') + '>＋ 上传图片</button>' +
          '<select class="media-pick" data-media="asset" data-key="' + f.k + '"' + (f.multi ? ' data-media-multi="1"' : '') + '>' + mediaAssetOptions() + '</select>' +
          '<button type="button" class="media-clear" data-media="clear" data-key="' + f.k + '" title="清空">✕</button>' +
          '<input type="file" class="media-file" data-media-file="' + f.k + '"' + (f.multi ? ' data-media-multi="1"' : '') + ' accept="image/*" hidden>' +
          '</div></div>';
        break;
      case 'textarea':
        ctrl = '<textarea class="prop-textarea" data-key="' + f.k + '"' + (f.rows ? ' rows="' + f.rows + '"' : '') + '>' + esc(v) + '</textarea>';
        if (f.mediaRows) {
          ctrl += '<div class="media-row-tools">' +
            '<button type="button" data-media="upload" data-row-key="' + f.k + '">＋ 追加图片行</button>' +
            '<select class="media-pick" data-media="asset" data-row-key="' + f.k + '">' + mediaAssetOptions() + '</select>' +
            '<input type="file" class="media-file" data-media-file="' + f.k + '" data-media-row="1" accept="image/*" hidden>' +
            '</div>';
        }
        break;
      case 'rows':
        ctrl = rowsBoxHTML(rowsFieldFor(type, f.k) || f, v);
        break;
      case 'color':
        ctrl = colorFieldHTML(f.k, v, f.ph); break;
      case 'film': {
        var picks = builtinFilmList().map(function (it) {
          var b = builtinFilm(it.id);
          var on = String(v) === 'builtin:' + it.id;
          return '<button type="button" class="film-pick' + (on ? ' is-on' : '') + '" data-film-pick="builtin:' + it.id + '">' +
            '<span class="film-pick-img"' + (b && b.poster ? ' style="background-image:url(' + esc(b.poster) + ')"' : '') + '></span>' +
            '<b>' + esc(it.name) + '</b></button>';
        }).join('');
        ctrl = '<div class="film-field">' +
          (picks ? '<div class="film-picks">' + picks + '</div>' : '') +
          '<div class="media-row"><input class="prop-input" data-key="' + f.k + '" value="' + esc(v) +
          '" placeholder="或填视频直链 / 上传本地文件" spellcheck="false"></div>' +
          '<div class="media-tools">' +
          '<button type="button" data-film="upload" data-key="' + f.k + '">＋ 上传视频</button>' +
          '<button type="button" class="media-clear" data-film="clear" data-key="' + f.k + '" title="清空">✕</button>' +
          '<input type="file" class="film-file" data-film-file="' + f.k + '" accept="video/mp4,video/webm,video/quicktime" hidden>' +
          '</div>' +
          '<p class="opt">内置示例 2.6 秒，往下滚多少就播到哪一帧；自己上传建议 1.5MB 内</p></div>';
        break;
      }
      case 'code':
        ctrl = '<textarea class="prop-textarea mono" data-key="' + f.k + '" rows="' + (f.rows || 10) +
          '" spellcheck="false" placeholder="' + esc(f.placeholder || '') + '">' + esc(v) + '</textarea>';
        break;
      case 'range':
        ctrl = '<div class="range-row"><input type="range" data-key="' + f.k + '" min="' + f.min + '" max="' + f.max + '" value="' + (Number(v) || f.min) + '">' +
          '<span class="range-val">' + (Number(v) || f.min) + (f.unit || '') + '</span></div>'; break;
      case 'number':
        ctrl = '<div class="number-row"><input type="number" class="prop-input" data-key="' + f.k + '" min="' + (f.min || 0) + '" max="' + (f.max || 9999) + '" step="10" value="' + (Number(v) || 0) + '">' +
          '<span class="number-unit">px</span></div>'; break;
      case 'seg':
        // 选项多的时候（比如 5 种开场样式）横排会挤成竖着换行，改成两列铺开
        ctrl = '<div class="seg' + (f.opts.length > 4 ? ' is-wrap' : '') + '">' + f.opts.map(function (o) {
          return '<button type="button" data-key="' + f.k + '" data-val="' + o[0] + '" class="' + (String(v) === String(o[0]) ? 'active' : '') + '">' + o[1] + '</button>';
        }).join('') + '</div>'; break;
      case 'select':
        ctrl = '<select class="prop-select" data-key="' + f.k + '">' + f.opts.map(function (o) {
          return '<option value="' + o[0] + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select>'; break;
      default:
        ctrl = '<input class="prop-input" data-key="' + f.k + '" value="' + esc(v) + '">';
    }
    // 多行内容的文字都躺在输入框里，textContent 搜不到，单独记一份给属性搜索用
    var dq = f.type === 'rows' ? rowsOf(v).map(function (r) { return r.join(' '); }).join(' ').slice(0, 400) : '';
    return '<div class="prop-field"' + (dq ? ' data-q="' + esc(dq) + '"' : '') + '><label>' + esc(f.label) + hint + '</label>' + ctrl + '</div>';
  }
  /* ---------- 标签页图标（favicon） ---------- */
  var FAVICON_MAX = 480000;          // 图标 data URI 上限：128px PNG 一般在 30KB 内，留足余量
  var FAVICON_MAX_BYTES = 8 * 1024 * 1024;
  function faviconLetter() {
    var n = String(state.name || '').trim();
    var m = n.match(/[A-Za-z0-9]/);
    if (m) return m[0].toUpperCase();
    var c = n.match(/[\u4e00-\u9fa5\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af]/);
    return c ? c[0] : 'W';
  }
  function faviconRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  var autoFavCache = { key: '', val: '' };
  /* 站点名首字 + 深色圆角底：和品牌图标同一套视觉，任何站点开箱就有个像样的标签页图标 */
  function faviconAutoData() {
    var cacheKey = faviconLetter() + '|' + String(state.name || '');
    if (autoFavCache.key === cacheKey) return autoFavCache.val;
    try {
      var S = 128;
      var cv = document.createElement('canvas');
      cv.width = cv.height = S;
      var ctx = cv.getContext('2d');
      if (!ctx) return '';
      var g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, '#182a44'); g.addColorStop(1, '#080f1b');
      faviconRoundRect(ctx, 0, 0, S, S, S * 0.22);
      ctx.fillStyle = g; ctx.fill();
      var ch = faviconLetter();
      var cjk = /[^\x00-\xff]/.test(ch);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 ' + Math.round(S * (cjk ? 0.50 : 0.56)) +
        'px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(ch, S / 2, S / 2 + S * 0.035);
      autoFavCache = { key: cacheKey, val: cv.toDataURL('image/png') };
      return autoFavCache.val;
    } catch (e) { return ''; }
  }
  /* 当前真正要用的图标地址；空字符串表示这个站点不显示图标 */
  function faviconHref() {
    var p = state.page || {};
    var mode = p.faviconMode || 'auto';
    if (mode === 'none') return '';
    if (mode === 'custom' && p.favicon) return String(p.favicon).trim();
    return faviconAutoData();
  }
  var lastEditorFavicon = null;
  /* 编辑器自己的标签页跟着变，改完一眼就能看到效果 */
  function applyEditorFavicon() {
    var link = document.getElementById('wrFavicon');
    if (!link) return;
    var href = faviconHref() || 'favicon-32.png?v=20261125f';
    if (href === lastEditorFavicon) return;
    lastEditorFavicon = href;
    link.href = href;
  }
  function faviconSizeText(u) {
    var kb = Math.round(String(u || '').length * 0.75 / 1024);
    return kb >= 1 ? '约 ' + kb + ' KB · 已内嵌进页面' : '已内嵌进页面';
  }
  function drawFaviconCanvas(img, S, fit, bg) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var ctx = cv.getContext('2d');
    if (!ctx) return '';
    if (bg) { ctx.fillStyle = safeCssColor(bg, '#ffffff'); ctx.fillRect(0, 0, S, S); }
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return '';
    var scale = fit === 'cover' ? Math.max(S / w, S / h) : Math.min(S / w, S / h);
    ctx.drawImage(img, (S - w * scale) / 2, (S - h * scale) / 2, w * scale, h * scale);
    return cv.toDataURL('image/png');
  }
  /* 上传的图片统一压成 128×128 PNG：标签页最多显示 64px，2 倍图够清晰又不撑大页面 */
  function renderFaviconImage(img, fit, bg) {
    var out = drawFaviconCanvas(img, 128, fit, bg);
    if (out && out.length > FAVICON_MAX) out = drawFaviconCanvas(img, 64, fit, bg);
    return out;
  }
  function faviconFilePicked(input) {
    var f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast('请选择图片文件', true); return; }
    if (f.size > FAVICON_MAX_BYTES) { toast('图片超过 8 MB，请先压缩', true); return; }
    var reader = new FileReader();
    reader.onerror = function () { toast('图片读取失败', true); };
    reader.onload = function (ev) {
      var raw = String(ev.target.result || '');
      if (!raw) { toast('图片读取失败', true); return; }
      var img = new Image();
      img.onerror = function () { toast('这张图片浏览器读不了，换一张试试', true); };
      img.onload = function () {
        var out = renderFaviconImage(img, state.page.faviconFit || 'contain', state.page.faviconBg || '');
        if (!out) { toast('图标生成失败，换一张试试', true); return; }
        state.page.favicon = out;
        state.page.faviconMode = 'custom';
        pushHistory(); renderAll(); scheduleSave();
        toast('✓ 标签页图标已更新，看浏览器标签');
      };
      img.src = raw;
    };
    reader.readAsDataURL(f);
  }
  function faviconFieldsHTML() {
    var p = state.page;
    var mode = p.faviconMode || 'auto';
    var href = faviconHref();
    var letter = faviconLetter();
    var html = '<div class="prop-group"><h3>标签页图标</h3>' +
      '<p class="prop-hint">浏览器标签、收藏夹、手机桌面快捷方式上显示的小图标；导出时一起内嵌进 HTML，不用另外传文件。</p>' +
      fieldHTML({
        k: '__faviconMode', label: '图标来源', type: 'seg',
        opts: [['auto', '自动'], ['custom', '上传'], ['none', '不显示']]
      }, mode);
    if (mode === 'auto') {
      html += '<div class="fav-preview"><span class="fav-chip">' +
        (href ? '<img src="' + esc(href) + '" alt="">' : '') + '</span>' +
        '<div class="fav-meta"><b>自动生成 ·「' + esc(letter) + '」</b>' +
        '<span>取站点名的第一个字，配深色圆角底；改站点名会自动跟着变</span></div></div>';
    } else if (mode === 'custom') {
      html += '<div class="fav-preview"><span class="fav-chip is-checker">' +
        (p.favicon ? '<img src="' + esc(p.favicon) + '" alt="">' : '<i>空</i>') + '</span>' +
        '<div class="fav-meta"><b>' + (p.favicon ? '已设置自定义图标' : '还没选图片') + '</b><span>' +
        (p.favicon ? esc(faviconSizeText(p.favicon)) : '正方形图片效果最好，建议 128×128 以上') +
        '</span></div></div>' +
        '<div class="media-row"><input class="prop-input" data-key="__favicon" value="' + esc(p.favicon || '') +
        '" placeholder="填图片网址，或点下面上传" spellcheck="false"></div>' +
        '<div class="media-tools">' +
        '<button type="button" data-fav-act="upload">＋ 上传图片</button>' +
        '<button type="button" class="media-clear" data-fav-act="clear" title="清空">✕</button>' +
        '<input type="file" class="fav-file" accept="image/*" hidden>' +
        '</div>' +
        fieldHTML({ k: '__faviconFit', label: '图片适配', type: 'seg', opts: [['contain', '完整放入'], ['cover', '铺满裁切']] }, p.faviconFit || 'contain') +
        fieldHTML({ k: '__faviconBg', label: '图标底色', type: 'color', ph: '留空透明' }, p.faviconBg || '') +
        '<p class="prop-hint">适配方式和底色在上传那一刻套用；想换效果，改完再传一次同一张图。直接填网址的图片按原样引用。</p>';
    } else {
      html += '<p class="prop-hint">导出后浏览器标签上不显示图标（少数浏览器会补一个默认图标）。</p>';
    }
    return html + '</div>';
  }
  function pageFieldsHTML() {
    var p = state.page;
    var rows = [
      { k: '__bg', label: '页面背景', type: 'color', v: p.bg },
      { k: '__text', label: '默认文字色', type: 'color', v: p.text },
      { k: '__accent', label: '主题强调色', type: 'color', v: p.accent },
      { k: '__maxWidth', label: '内容最大宽度', type: 'range', v: p.maxWidth, min: 600, max: 1400, unit: 'px' },
      { k: '__desc', label: '网站描述（SEO）', type: 'textarea', v: p.description, rows: 2 }
    ];
    return rows.map(function (r) {
      return fieldHTML({ k: r.k, label: r.label, type: r.type, min: r.min, max: r.max, unit: r.unit, rows: r.rows }, r.v);
    }).join('');
  }
  /* 主题样式：每个模块都能决定自己在浅色 / 深色主题下长什么样。
     放在模块面板靠前的位置（内容之后），比塞进底部「通用设置」更容易找到。 */
  function themeStyleHTML(b) {
    var role = themeRoleOf(b.p);
    var html = '<div class="prop-group theme-style-group"><h3>主题样式 · 在浅色 / 深色下长什么样</h3>' +
      fieldHTML(F.boxThemeRole, role) +
      '<p class="theme-role-note">' + esc(THEME_ROLE_NOTE[role] || '') + '</p>';
    if (role === 'custom') {
      var cf = function (k, label, hint, ph) {
        return fieldHTML({ k: k, label: label, type: 'color', hint: hint, ph: ph }, b.p[k]);
      };
      html += '<div class="theme-mode-block"><b><i></i>浅色模式下</b>' +
        cf('boxThemeLightBg', '底色', '留空则透明', '留空则透明') +
        cf('boxThemeLightText', '文字色', '', '留空跟随页面') +
        cf('boxThemeLightAccent', '强调色', '按钮 / 图标 / 高亮', '留空跟随主题') +
        cf('boxThemeLightLink', '链接色', '', '留空跟随强调色') + '</div>' +
        '<div class="theme-mode-block is-dark"><b><i></i>深色模式下</b>' +
        cf('boxThemeDarkBg', '底色', '留空沿用浅色', '留空沿用浅色') +
        cf('boxThemeDarkText', '文字色', '', '留空沿用浅色') +
        cf('boxThemeDarkAccent', '强调色', '', '留空沿用浅色') +
        cf('boxThemeDarkLink', '链接色', '', '留空沿用浅色') + '</div>';
    } else if (role !== 'auto') {
      html += '<p class="theme-role-tip">会盖过「模块配色」里的模块背景；文字 / 链接 / 强调色手动设过时以手动为准。切到深色会自动换用深色版本，点画布上方的 ☾ 可以先看效果。</p>';
    }
    return html + '</div>';
  }
  /* 通用设置：所有模块共享，按主题折叠展示 */
  var COMMON_GROUPS = [
    { title: '链接与标识', open: true, keys: ['boxHref', 'linkTarget', 'anchorId', 'extraClass', 'boxHoverTip', 'boxAriaLabel'] },
    { title: '模块配色', open: true, keys: ['boxColorLock', 'boxBg', 'boxBgImage', 'boxBgSize', 'boxBgRepeat', 'boxTextColor', 'boxAccent', 'boxLinkColor', 'boxBorderColor', 'boxBorderWidth', 'boxBorderStyle', 'boxRadius'] },
    { title: '尺寸与位置', open: false, keys: ['boxWidth', 'boxMaxWidth', 'boxMinHeight', 'boxHeight', 'boxPadY', 'boxMarginY', 'boxAlign', 'boxOverflow'] },
    { title: '层叠 / 浮层', open: false, keys: ['layerMode', 'layerTarget', 'layerX', 'layerY', 'layerW', 'layerH', 'layerZ', 'layerRotate', 'layerPointer'] },
    { title: '边框与效果', open: false, keys: ['boxShadow', 'boxOpacity', 'boxHover', 'loopFx', 'boxFilter', 'boxBlend', 'boxBackdrop', 'boxRotate', 'boxScale'] },
    { title: '文字排版', open: false, keys: ['boxFont', 'boxFontSize', 'boxLineHeight', 'boxLetterSpacing', 'boxFontWeight', 'boxTextTransform', 'boxTextDeco', 'boxTextShadow'] },
    { title: '进入动画', open: false, keys: ['animIn', 'animDur', 'animDelay', 'animEase', 'animDist', 'animOnce'] },
    { title: '显示与高级', open: false, keys: ['boxVisibility', 'boxPrintHide', 'boxCursor', 'boxPointer', 'boxCustomCSS'] }
  ];
  var SIZE_KEYS = ['boxWidth', 'boxMaxWidth', 'boxMinHeight', 'boxHeight', 'boxMarginY', 'boxAlign', 'boxOverflow', 'colSpan', 'flowWidth'];
  var commonOpen = {}; // 记住折叠状态，避免画布重绘后面板跳回默认
  function commonSettingsHTML(b, parentLayout) {
    var html = '<div class="prop-group"><h3>通用设置 · 每个模块都有</h3>' +
      '<p class="common-note">对全部组件都生效。也可以直接拖动画布里模块右下角的蓝色手柄调整大小。</p>';
    COMMON_GROUPS.forEach(function (g) {
      // boxHref 是通用字段，任何模块都能设置整块链接 → 链接打开方式始终显示
      var keys = g.keys.slice();
      // 行内布局字段只在对应父容器里出现，避免无关设置干扰
      if (g.title === '尺寸与位置') {
        if (parentLayout === 'row') keys.push('colSpan');
        else if (parentLayout === 'flow') keys.push('flowWidth');
      }
      if (g.title === '进入动画' && isContainer(b)) keys = keys.concat(['animStagger']);
      if (!keys.length) return;
      var isOpen = commonOpen[g.title] == null ? g.open : commonOpen[g.title];
      html += '<details class="common-sec" data-csec="' + esc(g.title) + '"' + (isOpen ? ' open' : '') +
        '><summary>' + g.title + '</summary><div class="common-fields">' +
        keys.map(function (k) { return fieldHTML(F[k], cv(b.p, k)); }).join('') +
        (g.title === '尺寸与位置' ? '<button type="button" data-pact="resetsize" class="common-reset">↺ 恢复默认尺寸</button>' : '') +
        (g.title === '进入动画' ? '<button type="button" data-pact="playanim" class="common-reset">▶ 在画布里试播</button>' : '') +
        (g.title === '进入动画' || g.title === '边框与效果' ? '<button type="button" data-pact="openmotion" class="common-reset">✦ 从动效库挑选</button>' : '') +
        '</div></details>';
    });
    return html + '</div>';
  }
  /* 页面级：开场动画 + 滚动提示 */
  function pageIntroHTML() {
    var p = state.page;
    function f(k, label, opts, v) { return fieldHTML({ k: k, label: label, type: 'seg', opts: opts }, v); }
    var on = introCfg().style !== 'none';
    return '<div class="prop-group"><h3>开场动画</h3>' +
      f('__introStyle', '进入网站时', [['none', '无'], ['splash', '品牌幕'], ['cursor', '光标进入'], ['veil', '幕布揭开'], ['film', '视频揭幕']], p.introStyle || 'none') +
      (p.introStyle === 'film' ? fieldHTML({ k: '__introFilm', label: '开场视频', type: 'film', hint: '选内置的「品牌揭示」，或上传自己的片子（≤1.5MB）' }, p.introFilm || '') : '') +
      (on ? f('__introDrive', '揭幕推进', [['scroll', '跟鼠标滚动'], ['auto', '自动播放']], p.introDrive || 'scroll') : '') +
      fieldHTML({ k: '__introTitle', label: '幕上标题', type: 'text', hint: '留空用页面名' }, p.introTitle || '') +
      fieldHTML({ k: '__introSub', label: '副标题', type: 'text' }, p.introSub || '') +
      (p.introStyle === 'film' ? '' : fieldHTML({ k: '__introBg', label: '幕布背景', type: 'color', hint: '支持渐变', ph: '留空用主题色' }, p.introBg || '')) +
      (on && (p.introDrive || 'scroll') === 'auto' ? fieldHTML({ k: '__introDur', label: '停留时长', type: 'range', min: 600, max: 5000, unit: 'ms' }, p.introDur) : '') +
      f('__introFreq', '播放频率', [['always', '每次'], ['session', '每会话'], ['once', '仅一次']], p.introFreq || 'session') +
      '<button type="button" data-pact="playintro" class="common-reset">▶ 试播开场动画</button>' +
      '<p class="prop-hint">' + (on
        ? ((p.introDrive || 'scroll') === 'scroll'
          ? (p.introStyle === 'film'
            ? '视频幕由鼠标滚动推进：往下滚多少，片子播到哪一帧，伪光标同时滑向「进入网站」；滚到底幕布带走、进入正文。点一下或按回车可以立刻跳过。'
            : '幕布由鼠标滚动推进：往下滚，伪光标滑向「进入网站」、底部进度条同步走；滚到底自动揭开。点一下或按回车可以立刻跳过。')
          : '自动播放：按设定时长自己走完再揭开。点击、滚动或按任意键都可以立刻跳过。')
          + '系统开启「减少动效」时不播放。'
        : '选一种样式后，进入页面时先盖一层整屏幕布，再揭开显示内容，用来营造「开场」的感觉。') + '</p></div>' +
      '<div class="prop-group"><h3>滚动提示</h3>' +
      f('__hintStyle', '提示样式', [['none', '无'], ['mouse', '滚轮鼠标'], ['arrow', '向下箭头']], p.hintStyle || 'none') +
      fieldHTML({ k: '__hintText', label: '提示文字', type: 'text' }, p.hintText || '') +
      fieldHTML({ k: '__hintColor', label: '文字颜色', type: 'color', hint: '留空跟随页面文字色', ph: '留空跟随文字色' }, p.hintColor || '') +
      '<p class="prop-hint">固定在屏幕底部，滚动 60px 后自动淡出；点击提示会往下翻一屏。只在预览和导出页出现，不挡画布编辑。</p></div>';
  }
  /* 页面级动效：整页开关 + 一键批量设置 */
  function pageFxHTML() {
    var p = state.page;
    function f(k, label, opts, v) { return fieldHTML({ k: k, label: label, type: 'seg', opts: opts }, v); }
    function on(k, label, hint) {
      return fieldHTML({ k: k, label: label, type: 'seg', opts: [['1', '开'], ['0', '关']], hint: hint }, p[k.slice(2)] || '0');
    }
    return '<div class="prop-group"><h3>动效与鼠标</h3>' +
      '<button type="button" data-pact="openmotion" class="fx-lib-btn">✦ 动效库 · ' + MOTIONS.length + ' 种效果<span>点选预览并应用 →</span></button>' +
      f('__fxLevel', '动效强度', [['1', '克制'], ['2', '标准'], ['3', '强烈']], p.fxLevel) +
      f('__cursorGlow', '光标光晕', [['1', '开'], ['0', '关']], p.cursorGlow) +
      f('__cursorStyle', '跟随光标', [['none', '无'], ['ring', '圆环'], ['dot', '圆点'], ['both', '点+环']], p.cursorStyle) +
      f('__magnet', '磁性按钮', [['1', '开'], ['0', '关']], p.magnet) +
      f('__scrollBar', '滚动进度条', [['1', '开'], ['0', '关']], p.scrollBar) +
      f('__backTop', '回到顶部按钮', [['1', '开'], ['0', '关']], p.backTop) +
      f('__reduceMotion', '尊重系统「减少动效」', [['1', '开'], ['0', '关']], p.reduceMotion) +
      '<div class="fx-quick">' +
      '<button type="button" data-pact="fx-all">✨ 为所有模块加进场动画</button>' +
      '<button type="button" data-pact="fx-hover">✧ 卡片统一加悬停上浮</button>' +
      '<button type="button" data-pact="fx-clear" class="common-reset">↺ 清除全部动效</button>' +
      '</div>' +
      '<p class="prop-hint">进场动画在「◉ 预览」和导出的 HTML 里播放，编辑器画布保持静止便于排版；每个模块还能单独设置悬停与常驻动效。</p></div>' +
      '<div class="prop-group"><h3>页面级动效</h3>' +
      on('__spotlight', '背景聚光灯', '页面背景跟着鼠标走') +
      on('__parallax', '视差滚动', '顶层图片 / 文字按不同速度移动') +
      on('__ripple', '按钮点击波纹', '点击按钮从落点扩散一圈水波') +
      on('__scrollShadow', '吸顶导航阴影', '滚动后导航条浮起一层投影') +
      on('__countUp', '数字滚动', '统计数字从 0 累加到目标值') +
      on('__trail', '光标拖尾', '鼠标划过留下渐隐光点') +
      on('__pageVeil', '页面转场', '点击站内链接时幕布过渡') +
      '<p class="prop-hint">这些都作用在整页，预览与导出页生效；系统开启「减少动效」时视差、拖尾、数字滚动会自动降级为静态。</p></div>';
  }
  /* 批量设置：一键给整页铺一层克制的动效，或全部清除 */
  var CARD_TYPES = ['card', 'grid', 'features', 'pricing', 'team', 'stats', 'gallery', 'contact', 'quote',
    'notice', 'timeline', 'progress', 'logos', 'faq', 'table', 'code', 'image', 'twocol'];
  function applyFxPreset(kind) {
    var i = 0;
    (function walk(list) {
      (list || []).forEach(function (b) {
        if (!b || !b.p) return;
        if (kind === 'all') {
          if (!isNavType(b.type)) {
            if (animOf(b.p) === 'none') b.p.animIn = 'up';
            b.p.animDelay = Math.min(600, i * 60); i++;
            if (!cnum(b.p, 'animDist')) b.p.animDist = 24;
          }
        } else if (kind === 'hover') {
          if (CARD_TYPES.indexOf(b.type) >= 0 && cv(b.p, 'boxHover') === 'none') b.p.boxHover = 'lift';
        } else if (kind === 'clear') {
          ['animIn', 'animDelay', 'animDist', 'animStagger'].forEach(function (k) { delete b.p[k]; });
          b.p.loopFx = 'none'; b.p.boxHover = 'none';
        }
        walk(b.children);
      });
    })(state.blocks);
    if (kind === 'clear') {
      state.page.fxLevel = '2'; state.page.cursorGlow = '0'; state.page.cursorStyle = 'none';
      state.page.magnet = '0'; state.page.scrollBar = '0'; state.page.backTop = '0';
      ['spotlight', 'parallax', 'ripple', 'scrollShadow', 'countUp', 'trail', 'pageVeil'].forEach(function (k) {
        state.page[k] = '0';
      });
    }
    pushHistory(); renderAll();
    toast(kind === 'all' ? '已给模块加上依次进场的淡入动画'
      : (kind === 'hover' ? '卡片已加上悬停上浮效果' : '动效已全部清除'));
  }
  /* 在画布上试播进入动画（用与导出同一份参数，WAAPI 播放一次，不改动数据） */
  function playBlockAnim(id) {
    var b = getBlock(id);
    if (!b) return;
    var key = animOf(b.p);
    if (key === 'none') { toast('先在「进入动画」里选一个效果', true); return; }
    var el = document.querySelector('#canvas .b-block[data-id="' + id + '"] section');
    if (!el || !el.animate) { toast('当前浏览器不支持动效预览', true); return; }
    var dist = Math.round(cnum(b.p, 'animDist') * fxMul()) + 'px';
    var from = ANIM[key].build(dist);
    var to = { opacity: 1 };
    if ('transform' in from) to.transform = 'none';
    if ('filter' in from) to.filter = 'blur(0px)';
    if ('clipPath' in from) to.clipPath = 'inset(0 0 0 0)';
    el.animate([from, to], {
      duration: Math.max(120, Math.round(cnum(b.p, 'animDur') * fxMul())),
      delay: Math.max(0, cnum(b.p, 'animDelay')),
      easing: animEase(b.p), fill: 'both'
    });
  }
  /* 在编辑器里试播开场幕：直接铺在当前窗口上，与导出页共用同一份标记和样式 */
  /* 编辑器里试播时的“滚动推进”：和导出页同一套进度算法，只是不用拼字符串 */
  function bindSplashDrive(sp, finish) {
    var cur = sp.querySelector('.wr-splash-cursor'), rip = sp.querySelector('.wr-splash-ripple');
    var bar = sp.querySelector('.wr-splash-bar i');
    var tip = sp.querySelector('.wr-splash-tip'), dot = tip ? tip.querySelector('.wr-mouse i') : null;
    var v = sp.querySelector('video.wr-splash-v');
    // 与导出页一致：先落到首帧，别让「封面成片」和「第一格黑场」对不上
    if (v) {
      var prime = function () { try { v.currentTime = 0.02; } catch (e) { } };
      if (v.readyState >= 1) prime(); else v.addEventListener('loadedmetadata', prime, { once: true });
    }
    var p = 0, acc = 0, raf = 0, done = false;
    var stroke = Math.max(700, Math.round((window.innerHeight || 720) * 0.85));
    function paint() {
      if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
      if (cur) {
        var e = 1 - Math.pow(1 - Math.min(1, p / 0.7), 2.6);
        var dx = (1 - e) * 0.30 * (window.innerWidth || 1280);
        var dy = (1 - e) * 0.24 * (window.innerHeight || 800);
        var sc = 1;
        if (p > 0.70 && p < 0.86) sc = p < 0.78 ? 1 - (p - 0.70) / 0.08 * 0.16 : 0.84 + (p - 0.78) / 0.08 * 0.16;
        cur.style.opacity = Math.min(1, p * 7).toFixed(3);
        cur.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')';
      }
      if (rip) {
        var r = (p - 0.66) / 0.28;
        if (r > 0 && r < 1) {
          rip.style.opacity = (r < 0.3 ? r / 0.3 : 1 - (r - 0.3) / 0.7).toFixed(3);
          rip.style.transform = 'scale(' + (0.34 + r * 2.3).toFixed(3) + ')';
        } else {
          rip.style.opacity = '0';
          rip.style.transform = 'scale(.34)';
        }
      }
      if (dot) dot.style.transform = 'translateY(' + (p * 4).toFixed(1) + 'px)';
      if (v && isFinite(v.duration) && v.duration > 0) {
        var tt = Math.min(v.duration - 0.04, p * v.duration);
        if (Math.abs(v.currentTime - tt) > 0.035) { try { v.currentTime = tt; } catch (e) { } }
      }
    }
    function draw() {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; paint(); });
    }
    function end() {
      if (done) return;
      done = true;
      detach();
      finish();
    }
    function set(q) {
      p = Math.max(0, Math.min(1, q));
      draw();
      if (p > 0.996) {
        // 与导出页一致：到头先把片子定格在末帧，再退场
        if (v && isFinite(v.duration) && v.duration > 0) { try { v.currentTime = Math.max(0, v.duration - 0.04); } catch (e) { } }
        end();
      }
    }
    function onWheel(e) {
      var d = e.deltaY || 0;
      if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= window.innerHeight || 720;
      if (!d) return;
      e.preventDefault();
      acc += d;
      set(acc / stroke);
    }
    var ty = 0, touching = false;
    function onTouchStart(e) { touching = true; ty = e.touches[0].clientY; }
    function onTouchEnd() { touching = false; }
    function onTouchMove(e) {
      if (!touching) return;
      var y = e.touches[0].clientY;
      acc += (ty - y) * 1.15; ty = y;
      set(acc / stroke);
    }
    function onKey(e) {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); end(); return; }
      var kd = e.key === 'ArrowDown' ? 0.06 : (e.key === 'PageDown' ? 0.34 : 0);
      if (kd) { e.preventDefault(); acc += stroke * kd; set(acc / stroke); }
    }
    function onClick(e) { e.preventDefault(); end(); }
    function detach() {
      removeEventListener('wheel', onWheel);
      removeEventListener('touchstart', onTouchStart);
      removeEventListener('touchend', onTouchEnd);
      removeEventListener('touchmove', onTouchMove);
      removeEventListener('keydown', onKey);
      sp.removeEventListener('click', onClick);
    }
    addEventListener('wheel', onWheel, { passive: false });
    addEventListener('touchstart', onTouchStart, { passive: true });
    addEventListener('touchend', onTouchEnd, { passive: true });
    addEventListener('touchmove', onTouchMove, { passive: true });
    addEventListener('keydown', onKey);
    sp.addEventListener('click', onClick);
    if (v) {
      try { v.pause(); } catch (e) { }
      v.addEventListener('loadedmetadata', draw, { once: true });
    }
    paint();
    return detach;
  }
  function playIntro() {
    var c = introCfg();
    if (c.style === 'none' && c.hint === 'none') { toast('先在「开场动画」里选一种样式', true); return; }
    if (document.querySelector('.wr-splash')) return;
    var root = document.documentElement;
    var sp = null, hint = null;
    if (c.style !== 'none') {
      var box = document.createElement('div');
      box.innerHTML = introHTML(c);
      sp = box.firstElementChild;
      document.body.appendChild(sp);
    }
    if (c.hint !== 'none') {
      var hb = document.createElement('div');
      hb.innerHTML = hintHTML(c);
      hint = hb.firstElementChild;
      document.body.appendChild(hint);
    }
    root.classList.add('wr-intro');
    var timer = 0, done = false, detach = null;
    var finish = function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (detach) detach();
      if (sp) sp.classList.add('is-out');
      if (hint) hint.classList.add('is-gone');
      setTimeout(function () {
        if (sp) sp.remove();
        if (hint) hint.remove();
        root.classList.remove('wr-intro');
        toast('试播结束，点「◉ 预览」可以看完整效果');
      }, 900);
    };
    var v = sp ? sp.querySelector('video.wr-splash-v') : null;
    if (sp && c.drive === 'scroll') {
      // 滚动推进：拖到底才揭开；点一下也能跳过
      detach = bindSplashDrive(sp, finish);
      timer = setTimeout(finish, 34000);
    } else if (v) {
      v.muted = true;
      var pr = v.play();
      if (pr && pr.catch) pr.catch(function () { });
      var bar = sp.querySelector('.wr-splash-bar i');
      v.addEventListener('timeupdate', function () {
        if (bar && v.duration > 0) bar.style.width = (v.currentTime / v.duration * 100).toFixed(1) + '%';
      });
      v.addEventListener('ended', function () { setTimeout(finish, 280); });
      var arm = function (d) {
        if (!isFinite(d) || d <= 0) return;
        clearTimeout(timer);
        timer = setTimeout(finish, Math.round(d * 1000) + 160);
      };
      if (v.readyState >= 1) arm(v.duration);
      else v.addEventListener('loadedmetadata', function () { arm(v.duration); }, { once: true });
      setTimeout(function () { document.addEventListener('click', finish, { once: true }); }, 80);
      timer = setTimeout(finish, 12000);   // 兜底：片子读不出来也不会把编辑器锁死
    } else {
      timer = setTimeout(finish, c.style === 'none' ? 1500 : c.dur);
    }
  }
  /* 这几组字段不按「内容 / 外观 / 布局」拆散，统一放在独立的子元素设置里 */
  var BTN_KEYS = ['btnStyle', 'btnBg', 'btnColor', 'btnRadius', 'btnPadX', 'btnPadY', 'btnFontSize', 'btnWeight', 'btnShadow', 'btnFull', 'btnBorderWidth'];
  var NAV_KEYS = ['navLinkColor', 'navLinkHover', 'navLinkSize', 'navLinkGap', 'navBrandSize'];
  var FOOT_KEYS = ['footLinkColor', 'footLinkSize', 'footLinkGap', 'footTitleSize', 'footBottomSize'];
  var INPUT_KEYS = ['inputBg', 'inputColor', 'inputPhColor', 'inputBorderColor', 'inputBorderWidth', 'inputRadius', 'inputPadX', 'inputPadY'];
  var CARD_KEYS = ['cardPadX', 'cardPadY', 'cardTitleSize', 'cardTextSize', 'cardIconSize'];
  var SUB_KEYS = BTN_KEYS.concat(NAV_KEYS, FOOT_KEYS, INPUT_KEYS, CARD_KEYS);
  function extraFields(a, keys) {
    return keys.filter(function (k) { return a.fields.indexOf(k) >= 0 && FIELD_MAP[k]; });
  }
  function extraGroupHTML(title, keys, hint) {
    if (!keys.length) return '';
    return '<div class="prop-group prop-subgroup"><h3>' + title + '</h3>' +
      (hint ? '<p class="prop-subnote">' + hint + '</p>' : '') +
      keys.map(function (k) { return fieldHTML(FIELD_MAP[k], getBlock(selectedId).p[k]); }).join('') +
      '</div>';
  }
  function renderProps() {
    var box = $('#propPanel');
    refreshLayerTargetOpts();
    // 重绘前同步采集当前展开状态（toggle 事件是异步的，直接读 DOM 更可靠）
    $$('details.common-sec', box).forEach(function (d) {
      commonOpen[d.getAttribute('data-csec')] = d.open;
    });
    var b = getBlock(selectedId);
    if (!b) {
      box.innerHTML =
        '<div class="prop-head"><h2>页面设置</h2><p>未选中模块 · 这里设置整页样式</p></div>' +
        '<div class="prop-group"><h3>全局样式</h3>' + pageFieldsHTML() + '</div>' +
        faviconFieldsHTML() +
        pageIntroHTML() +
        pageFxHTML() +
        '<div class="prop-group"><h3>页面信息</h3>' +
        '<div class="page-stat"><div><b>' + countBlocks(state.blocks) + '</b><span>模块</span></div>' +
        '<div><b>' + state.assets.length + '</b><span>图片素材</span></div></div></div>' +
        '<div class="prop-empty"><div class="big">◇</div><h3>点击画布上的模块</h3>' +
        '<p>选中后，这里会显示该模块的文字、颜色、字号、留白等可编辑项。</p></div>';
      applyPropSearch();
      return;
    }
    var a = ASSET_MAP[b.type];
    var normalFields = a.fields.filter(function (k) { return SUB_KEYS.indexOf(k) < 0; });
    var groups = [
      { title: '内容', fields: normalFields.filter(function (k) { return FIELD_MAP[k] && ['rows', 'textarea', 'text', 'code', 'select', 'media', 'film'].indexOf(FIELD_MAP[k].type) >= 0; }) },
      { title: '外观', fields: normalFields.filter(function (k) { return FIELD_MAP[k] && FIELD_MAP[k].type === 'color'; }) },
      { title: '布局', fields: normalFields.filter(function (k) { return FIELD_MAP[k] && ['range', 'seg'].indexOf(FIELD_MAP[k].type) >= 0; }) }
    ];
    var loc = findBlock(selectedId, state.blocks, null);
    var html = '<div class="prop-head"><h2>' + esc(a.label) + '</h2><p>模块 ID · ' + esc(b.id.slice(-6)) +
      (loc && loc.parentId ? '　位于容器内' : '') + '　实时生效</p></div>';
    if (isContainer(b)) {
      html += '<div class="prop-group"><h3>容器内容 · ' + (b.children || []).length + ' 个子模块</h3>' +
        '<div class="nest-add"><select class="prop-select" id="nestAddType">' +
        ASSETS.map(function (x) { return '<option value="' + x.type + '">' + esc(x.label) + '</option>'; }).join('') +
        '</select><button type="button" data-pact="addchild">＋ 添加</button></div>' +
        '<div class="nest-quick">' +
        '<button type="button" data-pact="rowify">↔ 子模块排成一行</button>' +
        '<button type="button" data-pact="flowify">⇄ 自动横排</button>' +
        '<button type="button" data-pact="stackify">↕ 纵向堆叠</button></div>' +
        '<p class="prop-hint">一行均分可设「一行放几个」（1–6 个），子模块还能单独设占几列；自动横排按子模块宽度排，放不下自动换行。手机端都会变成单列。</p></div>';
    }
    function groupHTML(g) {
      if (!g || !g.fields.length) return '';
      return '<div class="prop-group"><h3>' + g.title + '</h3>' +
        g.fields.map(function (k) { return fieldHTML(FIELD_MAP[k], b.p[k], b.type); }).join('') + '</div>';
    }
    // 先放文字内容，紧接着放按钮 / 输入框 / 导航 / 页脚这些「组件里的组件」，
    // 最后才是外观与布局，避免改按钮颜色时要一路滚到底。
    html += groupHTML(groups[0]);
    html += themeStyleHTML(b);
    html += extraGroupHTML('按钮 · 独立设置', extraFields(a, BTN_KEYS),
      '这里只改当前模块里的按钮，不影响其他模块。留空 / 跟随组件时保持原来的样子。');
    html += extraGroupHTML('输入框 · 独立设置', extraFields(a, INPUT_KEYS),
      '只改当前表单 / 搜索框里的输入框。');
    html += extraGroupHTML('卡片 / 子项 · 独立设置', extraFields(a, CARD_KEYS),
      '只改当前模块里每张卡片的内边距、标题与正文大小。');
    html += extraGroupHTML('导航文字 · 独立设置', extraFields(a, NAV_KEYS),
      '只改当前导航的菜单文字、悬停色与间距。');
    html += extraGroupHTML('页脚文字 · 独立设置', extraFields(a, FOOT_KEYS),
      '只改当前页脚的链接与栏目标题。');
    html += groupHTML(groups[1]) + groupHTML(groups[2]);
    var parent = loc && loc.parentId ? getBlock(loc.parentId) : null;
    var parentLayout = parent && isContainer(parent) ? (parent.p.layout || 'stack') : '';
    if (isStickyNav(b) && loc && loc.parentId) {
      html += '<div class="prop-group sticky-warn"><h3>⚠ 吸顶范围受限</h3>' +
        '<p class="prop-hint">导航栏在容器内部时，画布上只能在这个容器的高度范围内吸附；预览和导出时会自动把它放到页面最外层，保证整页吸顶。想在画布上也固定，请点下面按钮。</p>' +
        '<button type="button" data-pact="hoisttop" class="common-reset">↥ 移到页面最外层并置顶</button></div>';
    }
    html += commonSettingsHTML(b, parentLayout);
    html += '<div class="prop-actions">' +
      '<button data-pact="dup">⧉ 复制此模块</button>' +
      '<button data-pact="layer">' + (isOverlay(b) ? '▣ 改回普通模块' : '◫ 叠放到其他模块上') + '</button>' +
      '<button data-pact="up">↑ 向上移动</button>' +
      '<button data-pact="down">↓ 向下移动</button>' +
      (loc && loc.parentId ? '<button data-pact="lift">↥ 移出当前容器</button>' : '') +
      '<button data-pact="savecomp">✚ 存为我的组件</button>' +
      '<button data-pact="del" class="danger">✕ 删除此模块</button></div>';
    box.innerHTML = html;
    applyPropSearch();
  }

  function renderAll() {
    cancelCanvasRender();
    syncComponentCSS();
    renderAssets(); renderMyAssets(); renderComponents(); renderCanvas(); renderLayers(); renderProps();
    $('#stageTitle').textContent = state.name || '未命名页面';
    $('#projectName').value = state.name || '';
    applyEditorFavicon();
    updateHistoryButtons();
  }

  /* ---------- 选中与模块操作 ---------- */
  function selectBlock(id) {
    selectedId = id;
    cancelCanvasRender();
    renderCanvas(); renderLayers(); renderProps();
    // 窄屏属性面板是抽屉，选中模块时直接展开，省得再点一次
    if (id && window.innerWidth <= 1000) openDrawer('props');
  }
  /* 树形定位：返回所在列表、索引与父容器 id */
  function findBlock(id, list, parentId) {
    list = list || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return { block: list[i], list: list, index: i, parentId: parentId || null };
      var kids = list[i].children;
      if (kids && kids.length) {
        var r = findBlock(id, kids, list[i].id);
        if (r) return r;
      }
    }
    return null;
  }
  function getBlock(id) { var r = findBlock(id, state.blocks, null); return r ? r.block : null; }
  function listFor(parentId) {
    if (!parentId) return state.blocks;
    var r = findBlock(parentId, state.blocks, null);
    if (!r || !isContainer(r.block)) return state.blocks;
    if (!Array.isArray(r.block.children)) r.block.children = [];
    return r.block.children;
  }
  /* 防止把容器拖进自己的后代里形成循环 */
  function isInSubtree(rootId, childId) {
    var r = findBlock(rootId, state.blocks, null);
    if (!r || !childId) return false;
    function walk(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === childId) return true;
        if (walk(list[i].children || [])) return true;
      }
      return false;
    }
    return walk(r.block.children || []);
  }
  function regenIds(b) { b.id = uid(); (b.children || []).forEach(regenIds); }
  /* 把普通模块切成浮层：默认叠在紧挨着的上一个普通模块上，之后可在面板里改目标 */
  function toggleLayer(id) {
    var r = findBlock(id, state.blocks, null);
    if (!r) return;
    var b = r.block;
    if (isOverlay(b)) {
      b.p.layerMode = 'normal';
      toast('已改回普通排布');
    } else {
      var prev = null;
      for (var i = r.index - 1; i >= 0; i--) {
        if (!isOverlay(r.list[i])) { prev = r.list[i]; break; }
      }
      b.p.layerMode = 'overlay';
      b.p.layerTarget = prev ? prev.id : '';
      toast(prev ? '已叠放在「' + shortLabel(prev) + '」上，拖左上角的 ✥ 可移动'
        : '已设为浮层，请在右侧「层叠 / 浮层」里选择目标模块');
    }
    pushHistory(); renderAll();
  }
  function insertBlock(type, index, extra, parentId, silent) {
    var b = makeBlock(type, extra);
    if (!b) return;
    var list = listFor(parentId);
    var i = (index == null || index < 0 || index > list.length) ? list.length : index;
    list.splice(i, 0, b);
    selectedId = b.id;
    // 批量插入（多图拖入）时由调用方统一提交一次历史与渲染
    if (!silent) {
      pushHistory(); renderAll();
      toast('已添加「' + ASSET_MAP[type].label + '」' + (parentId ? '（容器内）' : ''));
    }
  }
  function deleteBlock(id) {
    var r = findBlock(id, state.blocks, null);
    if (!r) return;
    r.list.splice(r.index, 1);
    if (!getBlock(selectedId)) selectedId = null;
    pushHistory(); renderAll(); toast('已删除模块');
  }
  function duplicateBlock(id) {
    var r = findBlock(id, state.blocks, null);
    if (!r) return;
    var copy = clone(r.block); regenIds(copy);
    r.list.splice(r.index + 1, 0, copy);
    selectedId = copy.id;
    pushHistory(); renderAll(); toast('已复制模块');
  }
  function moveBlock(id, dir) {
    var r = findBlock(id, state.blocks, null);
    if (!r) return;
    var j = r.index + dir;
    if (j < 0 || j >= r.list.length) return;
    var t = r.list[r.index]; r.list[r.index] = r.list[j]; r.list[j] = t;
    pushHistory(); renderAll();
  }
  /* 把模块从所在容器提升到外层（排在容器后面） */
  function liftBlock(id) {
    var r = findBlock(id, state.blocks, null);
    if (!r || !r.parentId) return;
    var pr = findBlock(r.parentId, state.blocks, null);
    var outer = pr ? pr.list : state.blocks;
    var b = r.list.splice(r.index, 1)[0];
    var at = pr ? pr.index + 1 : outer.length;
    outer.splice(at, 0, b);
    selectedId = b.id;
    pushHistory(); renderAll(); toast('已移出容器');
  }
  /* 拖放：可跨任意层级移动 */
  function moveBlockTo(id, parentId, index) {
    var r = findBlock(id, state.blocks, null);
    if (!r) return;
    if (parentId === id || isInSubtree(id, parentId)) { toast('不能把模块放进它自己里面', true); return; }
    var list = listFor(parentId);
    var item = r.list.splice(r.index, 1)[0];
    var to = (index == null) ? list.length : index;
    if (r.list === list && r.index < to) to--;
    to = Math.max(0, Math.min(list.length, to));
    list.splice(to, 0, item);
    selectedId = item.id;
    pushHistory(); renderAll();
  }

  /* ---------- 拖拽 ---------- */
  function setPayload(e, obj) {
    var s = JSON.stringify(obj);
    try { e.dataTransfer.setData('text/plain', s); } catch (err) { }
    try { e.dataTransfer.setData('application/x-wr-studio', s); } catch (err) { }
    e.dataTransfer.effectAllowed = 'copyMove';
  }
  function readPayload(e) {
    var s = '';
    try { s = e.dataTransfer.getData('application/x-wr-studio') || e.dataTransfer.getData('text/plain'); } catch (err) { }
    if (!s) return null;
    try { return JSON.parse(s); } catch (err) { return null; }
  }
  var lastDrop = null;
  function removeDropLine() {
    var l = $('.drop-line', $('#canvas'));
    if (l) l.remove();
    $$('.b-block.nest-target', $('#canvas')).forEach(function (el) { el.classList.remove('nest-target'); });
    lastDrop = null;
  }
  function directBlocks(box) {
    var kids = [];
    Array.prototype.forEach.call(box.children, function (c) {
      if (c.classList && c.classList.contains('b-block')) kids.push(c);
    });
    return kids;
  }
  function nestElOf(parentId) {
    var el = null;
    $$('.b-block', $('#canvas')).forEach(function (x) {
      if (x.getAttribute('data-id') === parentId) el = x;
    });
    if (!el) return null;
    var sec = null, nest = null;
    Array.prototype.forEach.call(el.children, function (c) { if (c.tagName === 'SECTION') sec = c; });
    if (!sec) return null;
    Array.prototype.forEach.call(sec.children, function (c) {
      if (c.classList && c.classList.contains('wr-nest')) nest = c;
    });
    return nest;
  }
  /* 依据鼠标位置算出：插入到哪个列表（容器 id）、第几位 */
  function dropTarget(e) {
    var canvas = $('#canvas');
    var nest = e.target.closest ? e.target.closest('.wr-nest') : null;
    var blockEl = e.target.closest ? e.target.closest('.b-block') : null;
    var parentId = null, box = canvas, horizontal = false;

    // 落在某个容器内部 → 插入该容器的 children
    if (nest) {
      var owner = nest.parentElement && nest.parentElement.parentElement;
      if (owner && owner.classList && owner.classList.contains('b-block')) {
        parentId = owner.getAttribute('data-id');
        box = nest;
        horizontal = nest.getAttribute('data-layout') !== 'stack';
      }
    }
    if (box === canvas) {
      // 否则插入到目标块所在的同级列表；落在画布空白处则回到顶层
      if (blockEl) {
        var loc = findBlock(blockEl.getAttribute('data-id'), state.blocks, null);
        parentId = loc ? loc.parentId : null;
      } else { parentId = null; }
      if (parentId) {
        var n = nestElOf(parentId);
        if (n) { box = n; horizontal = n.getAttribute('data-layout') !== 'stack'; }
        else { parentId = null; box = canvas; }
      }
    }
    var kids = directBlocks(box), index = kids.length, i, r;
    if (horizontal && kids.length) {
      // 横向网格：先找鼠标所在行，再按 X 找插入点
      var tops = kids.map(function (k) { return k.getBoundingClientRect().top; });
      var rowTop = tops[0], best = Infinity;
      tops.forEach(function (t) {
        var d = Math.abs(t - e.clientY);
        if (d < best) { best = d; rowTop = t; }
      });
      var rowKids = kids.filter(function (k) { return Math.abs(k.getBoundingClientRect().top - rowTop) < 8; });
      var found = -1;
      for (i = 0; i < rowKids.length; i++) {
        r = rowKids[i].getBoundingClientRect();
        if (e.clientX < r.left + r.width / 2) { found = kids.indexOf(rowKids[i]); break; }
      }
      index = found >= 0 ? found : (rowKids.length ? kids.indexOf(rowKids[rowKids.length - 1]) + 1 : kids.length);
    } else {
      for (i = 0; i < kids.length; i++) {
        r = kids[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { index = i; break; }
      }
    }
    return { parentId: parentId, index: index, box: box, horizontal: horizontal };
  }
  function showDropLine(t) {
    if (lastDrop && t && lastDrop.parentId === t.parentId && lastDrop.index === t.index &&
      lastDrop.horizontal === t.horizontal && lastDrop.box === t.box) return;
    removeDropLine();
    if (!t) return;
    if (t.parentId) {
      $$('.b-block', $('#canvas')).forEach(function (el) {
        if (el.getAttribute('data-id') === t.parentId) el.classList.add('nest-target');
      });
    }
    var line = document.createElement('div');
    line.className = 'drop-line' + (t.horizontal ? ' in-row' : '');
    var kids = directBlocks(t.box);
    if (t.horizontal) {
      // 横向容器：指示线绝对定位浮在容器上，不作为网格子项，否则会凭空多出一行、布局跳动
      t.box.style.position = 'relative';
      var br = t.box.getBoundingClientRect();
      var left = 4, top = 4, height = Math.max(36, br.height - 8);
      if (t.index < kids.length) {
        var r = kids[t.index].getBoundingClientRect();
        left = r.left - br.left - 3; top = r.top - br.top; height = Math.max(24, r.height);
      } else if (kids.length) {
        var last = kids[kids.length - 1].getBoundingClientRect();
        left = last.right - br.left + 3; top = last.top - br.top; height = Math.max(24, last.height);
      }
      line.style.cssText = 'left:' + left + 'px;top:' + top + 'px;height:' + height + 'px';
      t.box.appendChild(line);
    } else if (t.index < kids.length) {
      t.box.insertBefore(line, kids[t.index]);
    } else {
      t.box.appendChild(line);
    }
    lastDrop = t;
  }
  /* ---------- 图片统一入口 ----------
     所有上传/拖入都走这里：先等比缩小 + WebP/JPEG 压缩，再存进「我的图片」，
     页面里只留 asset:<id> 短引用（渲染与导出时才展开）。这样同一张图不会在
     assets、block.p.src、history 快照里各存一份 base64，localStorage 也不会轻易爆。 */
  var IMG_MAX_EDGE = 1600, IMG_MAX_BYTES = 20 * 1024 * 1024;
  function compressImage(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onerror = function () { resolve(''); };
      reader.onload = function (ev) {
        var raw = String(ev.target.result || '');
        if (!raw) return resolve('');
        // SVG / GIF 不重绘：保留矢量与动画，也不把内联脚本带进 canvas
        if (/image\/(svg\+xml|gif)/i.test(file.type)) return resolve(raw);
        var img = new Image();
        img.onerror = function () { resolve(raw); };
        img.onload = function () {
          try {
            var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
            if (!w || !h) return resolve(raw);
            var scale = Math.min(1, IMG_MAX_EDGE / Math.max(w, h));
            if (scale === 1 && raw.length < 240000) return resolve(raw);
            var cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(w * scale));
            cv.height = Math.max(1, Math.round(h * scale));
            var ctx = cv.getContext('2d');
            if (!ctx) return resolve(raw);
            var alpha = /image\/(png|webp|avif)/i.test(file.type);
            if (!alpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            var outs = [];
            try { outs.push(cv.toDataURL('image/webp', 0.82)); } catch (e) {}
            try { outs.push(cv.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.82)); } catch (e) {}
            outs.push(raw);
            outs = outs.filter(function (s) { return /^data:image\//.test(s); });
            outs.sort(function (a, b) { return a.length - b.length; });
            resolve(outs[0] || raw);
          } catch (e) { resolve(raw); }
        };
        img.src = raw;
      };
      reader.readAsDataURL(file);
    });
  }
  function addImageAsset(file) {
    return compressImage(file).then(function (src) {
      if (!src) return null;
      var a = { id: uid(), name: String(file.name || '图片').slice(0, 120), src: src };
      // 不可变赋值：撤销历史里共享的是旧数组引用，不会被后续上传污染
      state.assets = (state.assets || []).concat([a]);
      return a;
    }).catch(function () { return null; });
  }
  function imageFiles(files) {
    return Array.prototype.slice.call(files || []).filter(function (f) {
      return /^image\//.test(f.type) && f.size < IMG_MAX_BYTES;
    });
  }
  function handleFiles(files, target) {
    var t = target || { parentId: null, index: null };
    var all = Array.prototype.slice.call(files || []);
    // 拖进来的是网页文件 → 走 HTML 导入，不当图片处理
    var page = all.filter(function (f) { return /\.html?$/i.test(f.name) || /text\/html/i.test(f.type); })[0];
    if (page) { importHtmlFile(page); return; }
    var list = imageFiles(files);
    if (!list.length) { toast('请拖入 20 MB 以内的图片文件', true); return; }
    toast('正在压缩图片…');
    Promise.all(list.map(addImageAsset)).then(function (assets) {
      var ok = assets.filter(Boolean);
      if (!ok.length) { toast('图片读取失败', true); return; }
      var base = (t.index == null || t.index < 0) ? null : t.index;
      ok.forEach(function (a, i) {
        insertBlock('image', base == null ? null : base + i,
          { src: 'asset:' + a.id, alt: a.name, caption: '' }, t.parentId, true);
      });
      pushHistory(); renderAll();
      toast('✓ 已压缩并加入 ' + ok.length + ' 张图片，放到画布');
    });
  }

  function bindDrag() {
    var canvas = $('#canvas');

    // 素材卡 / 我的素材：dragstart
    document.addEventListener('dragstart', function (e) {
      var asset = e.target.closest ? e.target.closest('.asset-card') : null;
      var mine = e.target.closest ? e.target.closest('.my-asset') : null;
      var comp = e.target.closest ? e.target.closest('.comp-card') : null;
      var block = e.target.closest ? e.target.closest('.b-block') : null;
      if (asset) { setPayload(e, { kind: 'new', type: asset.getAttribute('data-asset') }); asset.classList.add('dragging'); }
      else if (mine) { setPayload(e, { kind: 'asset', id: mine.getAttribute('data-asset-id') }); }
      else if (comp) { setPayload(e, { kind: 'comp', id: comp.getAttribute('data-comp') }); comp.classList.add('dragging'); }
      else if (block) { setPayload(e, { kind: 'move', id: block.getAttribute('data-id') }); block.classList.add('dragging'); }
    });
    document.addEventListener('dragend', function () {
      $$('.dragging').forEach(function (el) { el.classList.remove('dragging'); });
      removeDropLine(); canvas.classList.remove('drag-over');
    });

    canvas.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      canvas.classList.add('drag-over');
      showDropLine(dropTarget(e));
    });
    canvas.addEventListener('dragleave', function (e) {
      if (!canvas.contains(e.relatedTarget)) { removeDropLine(); canvas.classList.remove('drag-over'); }
    });
    canvas.addEventListener('drop', function (e) {
      e.preventDefault();
      var t = lastDrop || dropTarget(e);
      removeDropLine(); canvas.classList.remove('drag-over');

      // 直接拖入本地图片文件（也支持落进容器）
      if (e.dataTransfer.files && e.dataTransfer.files.length) { handleFiles(e.dataTransfer.files, t); return; }

      var payload = readPayload(e);
      if (!payload || !t) return;
      if (payload.kind === 'new') {
        insertBlock(payload.type, t.index, null, t.parentId);
      } else if (payload.kind === 'asset') {
        var a = state.assets.filter(function (x) { return x.id === payload.id; })[0];
        if (a) insertBlock('image', t.index, { src: 'asset:' + a.id, alt: a.name, caption: '' }, t.parentId);
      } else if (payload.kind === 'comp') {
        insertComponent(payload.id, t.index, t.parentId);
      } else if (payload.kind === 'move') {
        moveBlockTo(payload.id, t.parentId, t.index);
      }
    });
  }

  /* ---------- 属性编辑 ---------- */
  function applyProp(key, value, el) {
    if (key.indexOf('__') === 0) {
      var map = {
        __bg: 'bg', __text: 'text', __accent: 'accent', __maxWidth: 'maxWidth', __desc: 'description',
        __favicon: 'favicon', __faviconMode: 'faviconMode', __faviconFit: 'faviconFit', __faviconBg: 'faviconBg',
        __fxLevel: 'fxLevel', __cursorGlow: 'cursorGlow', __cursorStyle: 'cursorStyle',
        __magnet: 'magnet', __scrollBar: 'scrollBar', __backTop: 'backTop', __reduceMotion: 'reduceMotion',
        __introStyle: 'introStyle', __introFilm: 'introFilm', __introDrive: 'introDrive',
        __introTitle: 'introTitle', __introSub: 'introSub', __introBg: 'introBg',
        __introDur: 'introDur', __introFreq: 'introFreq',
        __hintStyle: 'hintStyle', __hintText: 'hintText', __hintColor: 'hintColor'
      };
      var pk = map[key];
      if (!pk) return;
      state.page[pk] = (pk === 'maxWidth' || pk === 'introDur') ? Number(value) : value;
      // 换了开场片，上一部片子的封面就不作数了（内置示例自带封面，不用清）
      if (pk === 'introFilm' && String(value || '').indexOf('builtin:') !== 0) state.page.introPoster = '';
      if (pk === 'accent') syncComponentCSS();
      if (pk === 'introStyle' || pk === 'introDrive') renderProps();
      // 标签页图标：立刻同步到编辑器自己的标签上，切来源时要重绘面板
      if (pk === 'favicon' || pk === 'faviconMode' || pk === 'faviconFit' || pk === 'faviconBg') {
        applyEditorFavicon();
        if (pk === 'faviconMode') renderProps();
      }
      scheduleCanvasRender(); scheduleHistory(); scheduleSave();
      return;
    }
    var b = getBlock(selectedId);
    if (!b) return;
    var f = FIELD_MAP[key];
    var val = (f && (f.type === 'range' || f.type === 'number')) ? Number(value) : value;
    b.p[key] = val;
    if (key === 'layerMode') {
      if (val === 'overlay' && !b.p.layerTarget) {
        var lr = findBlock(selectedId, state.blocks, null);
        if (lr) {
          for (var li = lr.index - 1; li >= 0; li--) {
            if (!isOverlay(lr.list[li])) { b.p.layerTarget = lr.list[li].id; break; }
          }
        }
      }
      renderProps();
    }
    if (key === 'boxThemeRole') renderProps();
    scheduleCanvasRender();
    scheduleHistory(); scheduleSave();
  }

  /* ---------- 媒体字段：上传 / 素材引用 / 追加图片行 ---------- */
  function setMediaProp(key, val, append) {
    var b = getBlock(selectedId);
    if (!b || !key) return;
    if (append && val) {
      var cur = String(b.p[key] || '').trim();
      b.p[key] = cur ? cur + ' | ' + val : val;
    } else {
      b.p[key] = val;
    }
    pushHistory(); renderAll(); scheduleSave();
  }
  function appendMediaRow(key, ref) {
    var b = getBlock(selectedId);
    if (!b || !key) return;
    var f = rowsFieldFor(b.type, key) || { cols: [] };
    var tpl = rowsOf(MEDIA_ROW_TPL[key] || '');
    var row = tpl.length ? tpl[0].slice() : [];
    var cols = Math.max((f.cols || []).length, row.length, 1);
    while (row.length < cols) row.push('');
    row[0] = ref;
    var rows = rowsOf(b.p[key]);
    rows.push(row);
    b.p[key] = rows;
    pushHistory(); renderAll(); scheduleSave();
    toast('已追加图片行，可在上面修改文字');
  }
  function mediaFilePicked(input) {
    var file = input.files && input.files[0];
    var key = input.getAttribute('data-media-file');
    var isRow = input.hasAttribute('data-media-row');
    var multi = input.hasAttribute('data-media-multi');
    input.value = '';
    if (!file || !key) return;
    if (!/^image\//.test(file.type)) { toast('请选择图片文件', true); return; }
    if (file.size > IMG_MAX_BYTES) { toast('图片超过 20 MB，请先压缩', true); return; }
    addImageAsset(file).then(function (a) {
      if (!a) { toast('图片读取失败', true); return; }
      var ref = 'asset:' + a.id;
      if (isRow) appendMediaRow(key, ref);
      else setMediaProp(key, ref, multi);
      toast('✓ 图片已压缩并加入「我的图片」');
    });
  }
  /* 视频文件：直接读成 data URI 存在字段里，导出时一起打包。
     视频转码要额外工具，上传体积上限压得比较紧，超了就引导去用直链。 */
  var FILM_MAX_BYTES = 1.5 * 1024 * 1024;
  function filmFilePicked(input) {
    var file = input.files && input.files[0];
    var key = input.getAttribute('data-film-file');
    input.value = '';
    if (!file || !key) return;
    if (!/^video\//.test(file.type)) { toast('请选择视频文件（mp4 / webm）', true); return; }
    if (!/^video\/(mp4|webm|quicktime|ogg)/.test(file.type)) {
      toast('支持 mp4 / webm，其他格式浏览器可能放不了', true);
      return;
    }
    if (file.size > FILM_MAX_BYTES) {
      toast('视频 ' + (file.size / 1048576).toFixed(1) + 'MB 偏大，建议压缩到 1.5MB 内或改用直链', true);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var data = String(reader.result || '');
      if (!/^data:video\//.test(data)) { toast('视频读取失败', true); return; }
      applyProp(key, data);
      renderProps();
      toast('✓ 视频已加入，导出时会一起打包');
    };
    reader.onerror = function () { toast('视频读取失败', true); };
    reader.readAsDataURL(file);
  }
  /* 删除素材时清掉页面里的引用，避免导出破图。
     多行字段只清空命中那一格，保留同一行用户写的标题 / 说明；
     旧项目里内联的整段 base64 副本也一并匹配（srcToo）。 */
  function purgeAssetRefs(id, srcToo) {
    var refs = ['asset:' + id];
    if (srcToo && String(srcToo).indexOf('data:image/') === 0) refs.push(srcToo);
    var n = 0;
    function isRef(cell) {
      var t = String(cell).trim();
      return refs.some(function (r) { return t === r || (r.length > 40 && t.indexOf(r) >= 0); });
    }
    function clean(v) {
      if (typeof v !== 'string' || !refs.some(function (r) { return v.indexOf(r) >= 0; })) return v;
      var changed = false;
      var lines = v.split('\n').map(function (line) {
        if (line.indexOf('|') < 0) {
          if (isRef(line)) { changed = true; return ''; }
          return line;
        }
        var touched = false;
        var cells = line.split('|').map(function (c) {
          var stripped = String(c), cellHit = false;
          refs.forEach(function (r) {
            if (r.length > 40 && stripped.indexOf(r) >= 0) { stripped = stripped.split(r).join(''); cellHit = true; }
          });
          if (!cellHit && isRef(c)) { stripped = ''; cellHit = true; }
          if (cellHit) touched = true;
          return stripped;
        });
        if (touched) changed = true;
        return cells.join(' | ');
      }).filter(function (line, i, arr) {
        // 整行都空了才丢掉；单值字段清空后要保留成空字符串
        return line.trim() !== '' || arr.length === 1;
      });
      if (changed) n++;
      return lines.join('\n');
    }
    function walk(list) {
      (list || []).forEach(function (b) {
        Object.keys(b.p || {}).forEach(function (k) { b.p[k] = clean(b.p[k]); });
        walk(b.children || []);
      });
    }
    walk(state.blocks);
    // 组件库里的片段也可能引用这张图，漏掉会导致之后插入组件时破图
    (state.components || []).forEach(function (c) { walk(c.blocks || []); });
    return n;
  }
  /* ===================================================================
     导入现有 HTML：把一个已经存在的网页拆成可编辑模块
     做法：文件塞进「不允许跑脚本」的 iframe 里渲染一遍，用 getComputedStyle
     读真实字号 / 颜色 / 对齐 / 留白 / 底色，再按语义标签归到已有组件；
     认不出的包装层会被摊平，只保留有底色或大留白的那层当容器，免得一导入几十层套娃。
     =================================================================== */
  /* 导出页里带着工程快照（图片会出现两份），上限比原来的 12MB 抬高一档；
     带快照的文件不走 iframe 渲染，直接 JSON.parse，24MB 也不卡 */
  var IMPORT_MAX_BYTES = 24 * 1024 * 1024;
  var IMP_SKIP_TAG = /^(SCRIPT|STYLE|NOSCRIPT|LINK|META|TEMPLATE|HEAD|TITLE|BASE|SOURCE|TRACK|PARAM|OBJECT|EMBED|CANVAS|AUDIO|MAP|AREA)$/;
  var IMP_INLINE = /^(SPAN|A|B|STRONG|EM|I|U|S|SMALL|CODE|KBD|MARK|SUP|SUB|LABEL|TIME|ABBR|CITE|BR|IMG|SVG|DEL|INS|Q|FONT|WBR|BDI|BDO|VAR|SAMP|BIG|STRIKE|TT|NOBR)$/;
  var impPending = null;

  function clampNum(n, a, b) { n = Number(n); if (!isFinite(n)) n = a; return Math.max(a, Math.min(b, n)); }

  /* rgb()/rgba()/命名色 → #rrggbb；太透明或认不出就返回 '' */
  function rgbToHex(v, minAlpha) {
    var s = String(v == null ? '' : v).trim();
    if (!s || s === 'transparent') return '';
    if (/^#/.test(s)) return toHexColor(s);
    var m = /^rgba?\(([^)]+)\)$/i.exec(s);
    if (!m) return safeCssColor(s) ? toHexColor(safeCssColor(s)) : '';
    var p = m[1].split(/[,\s\/]+/).filter(function (x) { return x !== ''; }).map(parseFloat);
    if (p.length < 3) return '';
    var a = p.length > 3 && isFinite(p[3]) ? p[3] : 1;
    if (a < (minAlpha == null ? 0.85 : minAlpha)) return '';
    var hex = function (n) { var x = clampNum(Math.round(n), 0, 255).toString(16); return x.length < 2 ? '0' + x : x; };
    return '#' + hex(p[0]) + hex(p[1]) + hex(p[2]);
  }

  /* 文字颜色：原页面常用半透明白（rgba(255,255,255,.6)）做层次。
     直接按 rgbToHex 会把它当「太淡」丢掉，导入后文字要么变黑要么看不见；
     这里按它背后的底色合成一个等效实色，深底浅字 / 浅底深字都能对上。 */
  function impTextColor(el, win) {
    var raw = '';
    try { raw = String(win.getComputedStyle(el).color || ''); } catch (e) { return ''; }
    var solid = rgbToHex(raw, 0.85);
    if (solid) return solid;
    var m = /^rgba?\(([^)]+)\)$/i.exec(raw);
    if (!m) return '';
    var p = m[1].split(/[,\s\/]+/).filter(function (x) { return x !== ''; }).map(parseFloat);
    if (p.length < 4 || !isFinite(p[3])) return '';
    var a = p[3];
    if (a < 0.15) return '';
    var bg = '#ffffff';
    try {
      var b = impBackdrop(el.parentElement || el, win, '#ffffff');
      if (/^#[0-9a-f]{6}$/i.test(b)) bg = b;
    } catch (e2) { }
    var mix = function (i, j) {
      return Math.round(p[i] * a + parseInt(bg.slice(j, j + 2), 16) * (1 - a));
    };
    var hx = function (n) { var x = clampNum(n, 0, 255).toString(16); return x.length < 2 ? '0' + x : x; };
    return '#' + hx(mix(0, 1)) + hx(mix(1, 3)) + hx(mix(2, 5));
  }

  /* 按钮皮肤：原页面的按钮常是渐变 / 胶囊 / 大内边距，只抄底色会把它们
     全变成「主题色小方块」。这里把底色（含渐变）、文字色、圆角、内边距、
     字号字重、阴影一起读出来，重新渲染时按钮才还是原来那颗。 */
  function impBtnSkin(btn, win) {
    if (!btn) return null;
    var s;
    try { s = win.getComputedStyle(btn); } catch (e) { return null; }
    var out = {};
    var bg = impBg(btn, win, 0.35);
    var bw = parseFloat(s.borderTopWidth) || 0;
    var bc = rgbToHex(s.borderTopColor, 0.35);
    if (bg) { out.btnStyle = 'solid'; out.btnBg = bg; }
    else if (bw >= 1 && bc) { out.btnStyle = 'outline'; out.btnBg = bc; out.btnBorderWidth = Math.max(1, Math.min(4, Math.round(bw))); }
    else { out.btnStyle = 'ghost'; }
    var ink = rgbToHex(s.color);
    if (ink) out.btnColor = ink;
    out.btnRadius = Math.round(clampNum(parseFloat(s.borderTopLeftRadius) || 0, 0, 60));
    out.btnPadX = Math.round(clampNum(parseFloat(s.paddingLeft) || 0, 0, 60));
    out.btnPadY = Math.round(clampNum(parseFloat(s.paddingTop) || 0, 0, 30));
    out.btnFontSize = Math.round(clampNum(parseFloat(s.fontSize) || 14, 10, 24));
    var fw = parseFloat(s.fontWeight) || 600;
    out.btnWeight = fw >= 800 ? '800' : (fw >= 700 ? '700' : (fw >= 600 ? '600' : '500'));
    var sh = String(s.boxShadow || '');
    if (!sh || /^none$/i.test(sh)) out.btnShadow = 'none';
    else if (/0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+\d+px/.test(sh)) out.btnShadow = 'glow';
    else {
      var bl = /(\d{2,})px/.exec(sh);
      out.btnShadow = bl && parseFloat(bl[1]) >= 26 ? 'strong' : 'soft';
    }
    return out;
  }
  /* 把按钮皮肤并进模块属性（没有按钮就原样返回） */
  function impApplyBtn(opt, btn, win) {
    var skin = impBtnSkin(btn, win);
    if (!skin) return opt;
    for (var k in skin) { if (Object.prototype.hasOwnProperty.call(skin, k)) opt[k] = skin[k]; }
    return opt;
  }

  /* 取元素的可见文字：<br> 与块级边界转成换行，再压掉多余空白 */  function impText(el) {
    if (!el) return '';
    var c = el.cloneNode(true);
    Array.prototype.slice.call(c.querySelectorAll('br')).forEach(function (b) {
      b.parentNode.replaceChild(document.createTextNode('\n'), b);
    });
    Array.prototype.slice.call(c.querySelectorAll('p,div,li,section,article,tr,ul,ol,h1,h2,h3,h4,h5,h6,figcaption')).forEach(function (b) {
      b.insertAdjacentText('afterend', '\n');
    });
    return c.textContent
      .replace(/[\t\u00a0]+/g, ' ')
      .replace(/ {2,}/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  function impShown(el, win) {
    if (!el || el.nodeType !== 1) return false;
    if (IMP_SKIP_TAG.test(el.tagName)) return false;
    var s = win.getComputedStyle(el);
    if (!s) return false;
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    if (parseFloat(s.opacity || '1') === 0) return false;
    if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')) return false;
    // 图片即使没加载出来（相对路径 404）也要保留，别把图丢掉
    if (el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'IFRAME') return true;
    var r = el.getBoundingClientRect();
    return r.width >= 2 || r.height >= 2;
  }

  /* 块级子元素（行内标签不会单独成模块，文字已经算进父级） */
  function impBlockKids(el, win) {
    return Array.prototype.slice.call(el.children || []).filter(function (c) {
      if (!impShown(c, win)) return false;
      if (!IMP_INLINE.test(c.tagName)) return true;
      // 内联元素平时并进正文，但「span.wr-media 里包一张头像」这种就是一个独立模块，
      // 过滤掉的话头像、logo、二维码会整块消失
      var im = c.tagName === 'IMG' ? c : (c.querySelector ? c.querySelector('img') : null);
      if (im) {
        var r = im.getBoundingClientRect();
        if (r.width >= 20 && r.height >= 12) return true;
      }
      // 按钮长得像按钮：有底色 / 描边 / btn 类名的 <a> 不能当普通文字吞掉，
      // 否则「容器里放一个按钮」会变成一段纯文字，链接和配色全丢
      if (c.tagName === 'A') {
        try {
          var cs = win.getComputedStyle(c);
          if (rgbToHex(cs.backgroundColor, 0.4)) return true;
          if (/btn|button|cta/i.test(String(c.className || ''))) return true;
          if (parseFloat(cs.borderTopWidth) >= 1 && !/none/.test(cs.borderTopStyle)) return true;
        } catch (e) { }
      }
      return false;
    });
  }

  /* 把 background-image 里的每个渐变单独抠出来（计算样式里常是「叠加」多个） */
  function impGradList(v) {
    var s = String(v || '');
    var out = [], re = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/gi, m;
    while ((m = re.exec(s))) {
      var start = m.index, depth = 0, end = -1;
      for (var k = start; k < s.length; k++) {
        var ch = s.charAt(k);
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { end = k + 1; break; } }
      }
      if (end < 0) break;
      out.push(s.slice(start, end).trim());
      re.lastIndex = end;
    }
    return out;
  }
  /* 背景：纯色优先，没有就看渐变（渐变块的 background-color 永远是 transparent） */
  function impBg(el, win, minAlpha) {
    if (!el || el.nodeType !== 1) return '';
    var s = win.getComputedStyle(el);
    var hex = rgbToHex(s.backgroundColor, minAlpha);
    if (hex) return hex;
    var list = impGradList(s.backgroundImage);
    if (!list.length) return '';
    // 多个叠在一起时取最底那层；带 transparent 的多半是压暗 / 高光，跳过
    var solid = list.filter(function (g) { return !/transparent/i.test(g); });
    var g = (solid.length ? solid : list).pop();
    if (!g) return '';
    // 计算样式里全是 rgb()，压成 #hex：字段里读得动，存档也不容易超长
    g = g.replace(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)/g, function (m, r, gg, b, a) {
      if (a != null && a !== '' && parseFloat(a) < 0.999) return m;
      var hex = function (n) { var x = Math.max(0, Math.min(255, parseInt(n, 10))).toString(16); return x.length < 2 ? '0' + x : x; };
      return '#' + hex(r) + hex(gg) + hex(b);
    }).replace(/,\s+/g, ',').replace(/\s{2,}/g, ' ').trim();
    return gradientOk(g) ? g : '';
  }

  /* 往上找第一层非透明底色 / 渐变，作为这层的实际背景 */
  function impBackdrop(el, win, fb) {
    var node = el;
    while (node && node.nodeType === 1) {
      var bg = impBg(node, win, 0.5);
      if (bg) return bg;
      node = node.parentElement;
    }
    return fb || '#ffffff';
  }

  /* 开场层：全屏 fixed 的 loader / intro / splash，靠脚本几秒后自己移除。
     不认出来的话它会被当成正文第一块（一块巨大的渐变 + 两行字），原页面的开场动画也就丢了。 */
  function impFindIntro(doc, win) {
    var vw = win.innerWidth || 1280, vh = win.innerHeight || 900;
    var best = null;
    var all = doc.body ? doc.body.querySelectorAll('*') : [];
    for (var i = 0; i < all.length && i < 3000; i++) {
      var el = all[i];
      if (IMP_SKIP_TAG.test(el.tagName)) continue;
      var s = win.getComputedStyle(el);
      if (!s || (s.position !== 'fixed' && s.position !== 'absolute')) continue;
      var r = el.getBoundingClientRect();
      var name = String(el.id || '') + ' ' + String(el.className || '');
      var named = /intro|loader|preload|loading|splash|curtain|opener|opening|enter|entry|boot|welcome|gate|mask/i.test(name);
      // 很多框架的写法是「HTML 里先 display:none，脚本再显形」。
      // 这类在解析时是隐藏的，但仍要认出来——否则导入后开场动画整个丢掉。
      var hidden = s.display === 'none' || s.visibility === 'hidden';
      if (hidden) {
        var isTop = el.parentElement === doc.body || /^(MAIN|DIV)$/.test(String((el.parentElement || {}).tagName || ''));
        if (!named || !isTop || s.position !== 'fixed') continue;
        var bigFs = 0;
        Array.prototype.slice.call(el.querySelectorAll('*')).slice(0, 60).forEach(function (n0) {
          var fs0 = parseFloat(win.getComputedStyle(n0).fontSize) || 0;
          if (fs0 > bigFs) bigFs = fs0;
        });
        if (!el.querySelector('video') && bigFs < 22) continue;   // 没有片子也没有大字，多半只是个没用的 loader
        r = { width: vw, height: vh, top: 0, left: 0 };
      } else {
        if (r.width < vw * 0.7 || r.height < vh * 0.55) continue;   // 固定导航只有一条，按高度就能排掉
      }
      var z = parseInt(s.zIndex, 10);
      if (!isFinite(z)) z = 0;
      if (!hidden && s.position === 'absolute') {
        // 绝对定位的开场层：必须名字像开场，且贴在文档最上面，否则可能是首屏大图
        if (!named) continue;
        if (r.top + (win.scrollY || 0) > 60) continue;
      } else if (!named && z < 100) continue;
      var score = (named ? 60 : 0) + Math.min(z, 9000) / 100 + (el.querySelector('video') ? 25 : 0) - (hidden ? 20 : 0);
      if (!best || score > best.score) {
        best = { el: el, score: score, css: s, named: named, r: r };
      }
    }
    if (!best) return null;
    var el2 = best.el;
    var txt = impText(el2);
    var lines = txt.split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 2; });
    // 标题取字号最大的那行，副标题取剩下的第一行
    var title = '', sub = '', big = 0;
    Array.prototype.slice.call(el2.querySelectorAll('*')).slice(0, 400).forEach(function (n) {
      if (n.children.length) return;
      var t = impText(n).replace(/\n/g, ' ').trim();
      if (!t || t.length > 40) return;
      var fs = parseFloat(win.getComputedStyle(n).fontSize) || 0;
      if (fs > big) { big = fs; sub = title; title = t; }
    });
    if (!title && lines.length) title = lines[0];
    if (!sub && lines.length > 1) sub = lines[1];
    // 品牌开场幕常是「一个大字母字标 + 站名」两行：按字号挑会选中那个字母（W），
    // 主标题该是站名本身。
    var nameEl = el2.querySelector('.wr-splash-name,[class*=splash-name],[class*=intro-name]');
    if (nameEl) {
      var nt = impText(nameEl).replace(/\n/g, ' ').trim();
      if (nt && nt.length <= 40) title = nt;
    }
    // 副标题常写成 <span class="...sub/slogan/tagline">，字号比正文还小，
    // 靠「字号第二大」取不到，会连带把「进入网站」按钮文字当副标题
    var subEl = el2.querySelector('.wr-splash-sub,[class*=subtitle],[class*=sub-title],[class*=slogan],[class*=tagline]');
    if (subEl && !(subEl.closest && subEl.closest('.wr-splash-cta'))) {
      var st = impText(subEl).replace(/\n/g, ' ').trim();
      if (st && st.length <= 60) sub = st;
    }
    if (title === sub) sub = '';
    var vid = el2.querySelector('video');
    var vsrc = '';
    var vposter = '';
    if (vid) {
      vsrc = vid.currentSrc || vid.getAttribute('src') || '';
      if (!vsrc) { var so = vid.querySelector('source'); if (so) vsrc = so.getAttribute('src') || ''; }
      // 片子首帧多半是黑的（logo 是慢慢亮起来的），原页面「一进来能看到东西」全靠这张封面。
      // 封面丢了，开场幕就只剩一屏纯黑 —— 用户说的「开头动画变成黑幕」就是它。
      var pp = String(vid.getAttribute('poster') || '').trim();
      if (/^data:image\//i.test(pp) && pp.length <= 700000) vposter = pp;
      else if (/^https?:\/\//i.test(pp)) vposter = pp.slice(0, 2000);
    }
    if (!vposter) {
      // 有些页面把封面写在图层背景上，而不是 video 的 poster 上
      var bgi = '';
      try { bgi = win.getComputedStyle(el2).backgroundImage || ''; } catch (e) { }
      var bm = /url\(["']?(data:image\/[^"')]+)/i.exec(bgi);
      if (bm && bm[1].length <= 700000) vposter = bm[1];
    }
    var bg = impBg(el2, win, 0.05) || '';
    if (bg && bg.length > 280) bg = '';
    // 视频源整串带走：data:video 的 base64 有好几 MB，截到固定长度就成了坏文件，
    // 播不出来只剩 <video> 的深色底 —— 用户看到的就是「开场动画变成黑幕」。
    var film = '';
    if (vsrc) {
      if (/^data:/i.test(vsrc)) {
        // 存档整份进 localStorage，超过这个长度会直接把配额顶满（自动保存失败、刷新就丢）
        if (vsrc.length <= 2500000) film = vsrc;
      } else {
        film = vsrc.slice(0, 2000);                        // 普通 URL 留足长度即可
      }
    }
    var cfg = {
      // 没拿到可用的片子就不要用 film：那个样式是深色底 + 满屏视频，缺片子等于黑屏
      style: film ? 'film' : 'splash',
      filmDropped: !!vsrc && !film && /^data:/i.test(vsrc),
      title: title.slice(0, 40),
      sub: sub.slice(0, 60),
      bg: bg,
      film: film,
      poster: vposter,
      // 原页面是「停在第 0.02 秒那张画面，等滚动推进」的，直接改成自动播会从黑帧开始循环
      drive: (function () {
        var d0 = String(el2.getAttribute('data-drive') || '').toLowerCase();
        return (d0 === 'scroll' || d0 === 'auto') ? d0 : 'auto';
      })(),
      dur: (function () {
        var raw = '';
        try {
          raw = el2.style.getPropertyValue('--wr-intro-dur') ||
            win.getComputedStyle(el2).getPropertyValue('--wr-intro-dur') || '';
        } catch (e) { }
        var m0 = /([\d.]+)\s*ms/i.exec(raw);
        var v0 = m0 ? Math.round(parseFloat(m0[1])) : 2000;
        return Math.max(600, Math.min(5000, v0));
      })()
    };
    try { el2.parentNode.removeChild(el2); } catch (e) { }
    return cfg;
  }

  /* 入场动画（AOS / IntersectionObserver 之类）在 iframe 里不会触发，元素停在 opacity:0。
     不先「解冻」，这些块会被当成隐藏元素整段丢掉——这是导入后「原来有的没了」最常见的原因。 */
  function impThaw(doc, win) {
    var st = doc.createElement('style');
    st.textContent = '*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;' +
      'animation-iteration-count:1!important;transition:none!important}';
    (doc.head || doc.documentElement).appendChild(st);
    var all = doc.body ? doc.body.querySelectorAll('*') : [];
    var n = 0;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var s = win.getComputedStyle(el);
      if (!s || s.display === 'none' || s.visibility === 'hidden') continue;
      if (parseFloat(s.opacity || '1') > 0.06) continue;
      if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;   // 只为动画准备的 0 尺寸探针
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('transform', 'none', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      n++;
    }
    return n;
  }

  /* 一组结构相同的兄弟块（图标 + 标题 + 说明）→ 三栏卡片；不像卡片就返回 null */
  function impCardRows(kids, win, hostS) {
    if (kids.length < 2 || kids.length > 6) return null;
    var multi = (/grid/.test(hostS.display) && /fr|px|%/.test(String(hostS.gridTemplateColumns || ''))) ||
      (/flex/.test(hostS.display) && /row/.test(hostS.flexDirection));
    var rows = [];
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (/^(NAV|HEADER|FOOTER|UL|OL)$/.test(kid.tagName)) return null;
      var whole = impText(kid);
      // 内容胖的不是卡片，是「一列问答 / 一段说明」：塞进 80 字的卡片会把后半段吃掉
      if (whole.length > 220) return null;
      if (kid.querySelectorAll('p,li,blockquote').length >= 3) return null;
      if ((whole.match(/[？?]/g) || []).length >= 2) return null;
      var lines = whole.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (lines.length < 2 || lines.length > 5) return null;
      var icon = '';
      if (lines.length >= 3 && /^[^\w\u4e00-\u9fa5]{1,3}$/.test(lines[0])) icon = lines.shift();
      var head = lines[0];
      if (!head || head.length > 28) return null;
      var m = /^([^\w\u4e00-\u9fa5]{1,3})\s*/.exec(head);
      if (m) { icon = icon || m[1].trim(); head = head.slice(m[0].length).trim(); }
      var desc = lines.slice(1).join(' ');
      if (!desc || desc.length > 180) return null;
      var cs = win.getComputedStyle(kid);
      var boxed = !!impBg(kid, win, 0.3) || parseFloat(cs.borderRadius) >= 6 ||
        (cs.boxShadow && cs.boxShadow !== 'none') || parseFloat(cs.borderTopWidth) >= 1;
      if (!boxed && !multi) return null;
      // 卡片里带圆形头像 / 图标图的，图片本身就是图标，别退成 ✓
      var ci = kid.querySelector('img');
      if (ci) {
        var cis = ci.getAttribute('src') || ci.currentSrc || '';
        if (isMediaImage(cis) && cis.length < 120000 && ci.getBoundingClientRect().width >= 20) icon = cis;
      }
      rows.push([(icon || '✓').replace(/\|/g, ''), head.replace(/\|/g, '/'), desc.replace(/\|/g, '/').slice(0, 80)].join(' | '));
    }
    var cs0 = win.getComputedStyle(kids[0]);
    var cbg = impBg(kids[0], win, 0.5);
    var cink = rgbToHex(cs0.color);
    var crad = Math.round(clampNum(parseFloat(cs0.borderRadius), 0, 40));
    var opt = { items: rows.join('\n'), title: '', align: 'center', padY: 36, padX: 0, cols: Math.min(Math.max(rows.length, 1), 3) };
    if (cbg) opt.cardBg = cbg;
    if (cink) opt.color = cink;
    if (crad) opt.radius = crad;
    return makeImp('grid', opt);
  }

  /* 面包屑：一条「首页 / 当前页」的层级导航，直接拍成文字会把链接全丢掉 */
  function impCrumbBlock(el, win) {
    var cls = String(el.className || '');
    if (el.parentElement && /crumb/i.test(String(el.parentElement.className || ''))) return null;
    var txt = impText(el).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    var named = /crumb/i.test(cls);
    if (!named) {
      if (el.tagName !== 'NAV' || txt.length > 60) return null;
      if (!/[\/›»>]/.test(txt)) return null;
      if (el.querySelectorAll('a').length < 1) return null;
    }
    if (!txt || txt.length > 80) return null;
    var items = [], seen = '';
    Array.prototype.slice.call(el.querySelectorAll('a')).forEach(function (a) {
      var t = impText(a).replace(/\n/g, ' ').trim().slice(0, 20);
      if (!t) return;
      items.push(t + ' | ' + (a.getAttribute('href') || '#'));
      seen = t;
    });
    if (!items.length) return null;
    // 末尾的当前页不是链接，补成「文字 | 」（空链接）
    var lastA = Array.prototype.slice.call(el.querySelectorAll('a')).pop();
    var tail = '';
    var after = lastA ? lastA.nextElementSibling : null;
    while (after) {
      var t2 = impText(after).replace(/\n/g, ' ').trim();
      if (t2 && !/^[\/›»>·|]+$/.test(t2)) { tail = t2.slice(0, 20); break; }
      after = after.nextElementSibling;
    }
    if (!tail) {
      var segs = txt.split(/\s*[\/›»]\s*/).filter(function (x) { return x.trim(); });
      if (segs.length && segs[segs.length - 1].trim() !== seen) tail = segs[segs.length - 1].trim().slice(0, 20);
    }
    if (tail) items.push(tail + ' | ');
    if (items.length < 2) return null;
    var s = win.getComputedStyle(el);
    // 留白不自己吸收：由外层 section → 包装层 → 模块这条链一路累加，
    // 自己先吸一层的话，外层再合并进来时会重复计算，面包屑就整体偏了
    var opt = {
      crumbItems: items.join('\n'),
      color: rgbToHex(s.color) || '#7a8aa3',
      align: /center/.test(s.textAlign) ? 'center' : 'left',
      padY: 0, padX: 0
    };
    var cbg = impBg(el, win, 0.4);
    if (cbg) opt.bg = cbg;
    return makeImp('breadcrumb', opt);
  }

  /* 联系表单：<div class="wr-form"> 里塞 input/textarea，标签 FORM 的老规则抓不到。
     这类容器直接产出一个 form 模块，别把 placeholder 之外的字段全丢掉 */
  function impFormBlock(el, win) {
    if (!/^(DIV|SECTION|FORM|ARTICLE|ASIDE)$/.test(el.tagName)) return null;
    var flds = Array.prototype.slice.call(el.querySelectorAll('input,textarea,select')).filter(function (f) {
      return impShown(f, win) && !/^(hidden|submit|button|reset|image)$/i.test(String(f.type || ''));
    });
    if (flds.length < 2) return null;
    if (impText(el).replace(/\s/g, '').length > 500) return null;   // 整页级的容器不整体转表单
    var fCommon = flds[0].parentElement;
    flds.forEach(function (f) { while (fCommon && !fCommon.contains(f)) fCommon = fCommon.parentElement; });
    if (fCommon !== el && fCommon.parentElement !== el) return null;  // 只有「直接装着输入框」的容器才算表单
    var s = win.getComputedStyle(el);
    var ttl = el.querySelector('h1,h2,h3,h4,legend');
    var btn = el.querySelector('button,[type=submit],.wr-btn,[class*=btn]');
    var ps = Array.prototype.slice.call(el.querySelectorAll('p')).filter(function (p) {
      return impShown(p, win) && impText(p).replace(/\s/g, '').length > 4;
    });
    var label = function (f) {
      return String(f.getAttribute('aria-label') || f.getAttribute('placeholder') || f.name || '').trim();
    };
    var names = flds.map(label).filter(Boolean);
    var opt = {
      title: ttl ? impText(ttl).split('\n')[0].slice(0, 30) : '填写表单',
      desc: ps.length ? impText(ps[0]).replace(/\n/g, ' ').slice(0, 80) : (names.length ? '留下联系方式，我们会尽快回复。' : ''),
      btnText: btn ? impText(btn).replace(/\n/g, ' ').slice(0, 8) || '提交' : '提交',
      color: rgbToHex(s.color) || '#16233a',
      radius: Math.round(clampNum(parseFloat(s.borderRadius), 0, 40)),
      padY: Math.round(clampNum((parseFloat(s.paddingTop) + parseFloat(s.paddingBottom)) / 2, 0, 120)),
      padX: Math.round(clampNum(parseFloat(s.paddingLeft), 0, 80)),
      align: /center/.test(s.textAlign) ? 'center' : 'left'
    };
    // 必须显式给 bg：表单模块自带一个 #f5f8ff 的默认底色，
    // 不覆盖的话会被当成「这块自己有底色」，外层 section 就合并不进来
    opt.bg = impBg(el, win, 0.5) || '';
    var bb = btn ? impBg(btn, win, 0.5) : '';
    if (bb && bb !== opt.bg) opt.btnBg = bb;
    // 原页面常用「margin:0 auto + text-align:left」把表单摆在中間，
    // 只看 text-align 会以为它靠左，导出后就贴边了。
    // 计算样式里 margin:auto 已经被换算成像素，所以按「左右留白是否相等」判断居中
    if (s.marginLeft === 'auto' || s.marginRight === 'auto') {
      opt.align = 'center';
    } else {
      try {
        var r = el.getBoundingClientRect(), pr = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
        if (pr && pr.width > 40 && r.width > 40) {
          var gl = r.left - pr.left, gr = pr.right - r.right;
          if (gl > 8 && Math.abs(gl - gr) < 4) opt.align = 'center';
        }
      } catch (e) { }
    }
    return makeImp('form', opt);
  }
  /* 联系方式三列：图标 + 短标签 + 值。以前每列被当成一段文字，图标、分行、卡片底色全丢 */
  function impContactRow(el, win) {
    var kids = impBlockKids(el, win);
    if (kids.length < 2 || kids.length > 4) return null;
    var KIND = [
      { key: 'phone', re: /电\s*话|手\s*机|tel|phone|热线/i, ico: '✆' },
      { key: 'email', re: /邮\s*箱|邮\s*件|e-?mail|mail/i, ico: '✉' },
      { key: 'address', re: /地\s*址|位\s*置|所在|address|location/i, ico: '⌖' }
    ];
    var found = {}, icons = {}, hit = 0, anyVal = false;
    kids.forEach(function (kid) {
      var raw = impText(kid).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      // b / span 这类内联标签不会在 impText 里换行，按叶子元素再收集一遍
      if (raw.length < 2) {
        var parts = [];
        Array.prototype.slice.call(kid.querySelectorAll('b,strong,span,em,i,small,div,p')).forEach(function (n) {
          if (n.children.length) return;
          var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
          if (t && parts.indexOf(t) < 0) parts.push(t);
        });
        if (parts.length >= 2) raw = parts;
      }
      if (raw.length < 2 || raw.length > 4) return;
      var icon = '';
      if (raw.length >= 3 && /^[^\w\u4e00-\u9fa5]{1,2}$/.test(raw[0])) icon = raw.shift();
      var lab = raw[0] || '';
      var val = raw.slice(1).join(' ').trim();
      if (!val || lab.length > 8 || val.length > 60) return;
      var k = null;
      for (var i = 0; i < KIND.length; i++) { if (KIND[i].re.test(lab)) { k = KIND[i]; break; } }
      // 标签没命中就看内容特征兜底
      if (!k) {
        if (/@/.test(val)) k = KIND[1];
        else if (/^[\d\-+()\s]{7,20}$/.test(val)) k = KIND[0];
        else if (/省|市|区|县|路|街|号/.test(val)) k = KIND[2];
      }
      if (!k) return;
      found[k.key] = val;
      icons[k.key] = icon || k.ico;
      hit++;
      anyVal = true;
    });
    // 至少两类联系方式都认出来才转成 contact 模块，否则交回通用流程
    if (hit < 2 || !anyVal) return null;
    var cs = win.getComputedStyle(kids[0]);
    var opt = {
      title: '',
      phone: found.phone || '', email: found.email || '', address: found.address || '',
      contactIcons: [icons.phone || '✆', icons.email || '✉', icons.address || '⌖'].join('|'),
      color: rgbToHex(cs.color) || '#16233a',
      radius: Math.round(clampNum(parseFloat(cs.borderRadius), 0, 40)) || 14,
      gap: Math.round(clampNum(parseFloat(win.getComputedStyle(el).columnGap) || 16, 0, 48)),
      padY: 0, padX: 0
    };
    var cbg = impBg(kids[0], win, 0.3);
    if (cbg) opt.cardBg = cbg;
    // 标题留给外层的标题块：这里再取一次会在页面上出现两遍
    return makeImp('contact', opt);
  }

  /* 技能条 / 进度列表：每行「标签 + 百分比 + 底轨」。不认的话只剩一串「游戏 0%」 */
  function impProgress(el, win) {
    var rows = Array.prototype.slice.call(el.querySelectorAll('[class*=pg-row],[class*=progress-row],[class*=skill]')).filter(function (r) {
      return impShown(r, win) && impText(r).replace(/\s/g, '').length >= 2;
    });
    // 只保留最外层的行，避免同一个结构被重复计数
    rows = rows.filter(function (r) { return !rows.some(function (o) { return o !== r && o.contains(r); }); });
    if (rows.length < 2 || rows.length > 12) return null;
    var pCommon = rows[0].parentElement;
    rows.forEach(function (r) { while (pCommon && !pCommon.contains(r)) pCommon = pCommon.parentElement; });
    if (pCommon !== el) return null;   // 只认「自己就是进度条容器」的那层
    var items = [], bar = '';
    rows.forEach(function (r) {
      var t = impText(r).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      var m = /(\d{1,3})\s*%/.exec(t);
      var lab = t.replace(/\s*\d{1,3}\s*%\s*$/, '').replace(/\s*\d{1,3}\s*%/, '').trim().slice(0, 18);
      if (!lab) return;
      items.push(lab + ' | ' + (m ? Math.min(100, parseInt(m[1], 10)) : 60));
      if (!bar) {
        var fill = r.querySelector('[class*=fill],[class*=bar]');
        if (fill) { var fb = impBg(fill, win, 0.4); if (fb) bar = fb; }
      }
    });
    if (items.length < 2) return null;
    var s = win.getComputedStyle(el);
    var host = el.closest ? el.closest('[class*=pg],[class*=progress],[class*=skill]') || el : el;
    var ht = (host === el && host.querySelector) ? host.querySelector('h1,h2,h3') : null;
    var opt = {
      progressItems: items.join('\n'),
      title: ht ? impText(ht).slice(0, 30) : '',
      color: rgbToHex(s.color) || '#16233a',
      padY: Math.round(clampNum((parseFloat(s.paddingTop) + parseFloat(s.paddingBottom)) / 2, 0, 120)),
      padX: Math.round(clampNum(parseFloat(s.paddingLeft), 0, 80))
    };
    if (bar) opt.barColor = bar;
    return makeImp('progress', opt);
  }

  /* 提示框：图标 + 小标题 + 正文的带色卡片。不认的话只剩一段 <p>，图标 / 标题 / 左边框全丢 */
  function impNotice(el, win) {
    if (!/^(DIV|SECTION|ARTICLE|ASIDE)$/.test(el.tagName)) return null;
    var cls = ' ' + String(el.className || '') + ' ';
    var hasCls = /wr-notice|callout|alert-box|tip-box/.test(cls);
    var s = win.getComputedStyle(el);
    var bl = parseFloat(s.borderLeftWidth) || 0;
    var bEl = el.querySelector('b,strong');
    var pEl = el.querySelector('p');
    var icoEl = el.querySelector('.wr-notice-ico,[class*=notice-ico],[class*=callout-ico]');
    // 类名命中，或者「左边框 + 标题 + 正文」三样齐，才算提示框
    if (!hasCls && !(bl >= 2 && bEl && pEl)) return null;
    var allText = impText(el).replace(/\s/g, '');
    if (allText.length < 3 || allText.length > 240) return null;   // 空块 / 整页容器都不转
    var title = bEl ? impText(bEl).replace(/\s+/g, ' ').trim().slice(0, 30) : '';
    var txt = pEl ? impText(pEl).replace(/\s+/g, ' ').trim() : '';
    if (!txt) {
      var lines = impText(el).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (lines.length < 2) return null;
      title = title || lines[0].slice(0, 30);
      txt = lines.slice(1).join(' ');
    }
    if (!txt) return null;
    var icon = '';
    if (icoEl) {
      icon = impText(icoEl).replace(/\s+/g, ' ').trim().slice(0, 8);
      // 图标里是「提示」这种正文字就别当图标了，避免标题出现两遍
      if (icon && icon === title) icon = '';
    }
    // 类型按主色判断：优先字色，取不到再看底色
    var key = rgbToHex(s.color) || impBg(el, win, 0.5) || '';
    var nt = 'info';
    if (/^#/.test(key)) {
      var h = key.slice(1);
      var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), hue = 0;
      if (mx !== mn) {
        if (mx === r) hue = ((g - b) / (mx - mn)) % 6;
        else if (mx === g) hue = (b - r) / (mx - mn) + 2;
        else hue = (r - g) / (mx - mn) + 4;
        hue *= 60;
        if (hue < 0) hue += 360;
      }
      var sat = mx ? (mx - mn) / mx : 0;
      if (sat > 0.18) {
        if (hue < 18 || hue >= 345) nt = 'danger';
        else if (hue < 65) nt = 'warning';
        else if (hue < 170) nt = 'success';
        else if (hue >= 180 && hue < 260) nt = 'info';
      }
    }
    // 模块的留白不自己吸收，交给外层那条链累加（避免和合并时重复计算）
    return makeImp('notice', {
      noticeType: nt, noticeIcon: icon, title: title, text: txt.slice(0, 400),
      radius: Math.round(clampNum(parseFloat(s.borderRadius), 0, 40)),
      padY: 0, padX: 0
    });
  }

  /* 折叠问答：<details> + <summary>。不认的话答案会被拍成一眼可见的段落，原来收起的效果就没了 */
  function impFaq(el, win) {
    if (!/^(DIV|SECTION|ARTICLE|ASIDE)$/.test(el.tagName)) return null;
    var ds = Array.prototype.slice.call(el.querySelectorAll('details')).filter(function (d) {
      return impShown(d, win) && d.querySelector('summary');
    });
    // 只保留最外层的 details，避免嵌套结构被重复计数
    ds = ds.filter(function (d) { return !ds.some(function (o) { return o !== d && o.contains(d); }); });
    if (ds.length < 2 || ds.length > 12) return null;
    var common = ds[0].parentElement;
    ds.forEach(function (d) { while (common && !common.contains(d)) common = common.parentElement; });
    if (!common || (common !== el && common.parentElement !== el)) return null;
    if (impText(el).replace(/\s/g, '').length > 1200) return null;   // 整页容器不整体转 FAQ
    var rows = [];
    ds.forEach(function (d) {
      var q = impText(d.querySelector('summary')).replace(/\s+/g, ' ').trim();
      var body = d.querySelector('.wr-faq-body') || d;
      var a = impText(body).replace(/\s+/g, ' ').trim();
      if (!q || !a) return;
      rows.push(q.replace(/\|/g, '/').slice(0, 60) + ' | ' + a.replace(/\|/g, '/').slice(0, 200));
    });
    if (rows.length < 2) return null;
    var s = win.getComputedStyle(el), cs = win.getComputedStyle(common), fs = win.getComputedStyle(ds[0]);
    var ht = el.querySelector('h1,h2,h3,h4');
    var opt = {
      faqItems: rows.join('\n'),
      title: ht ? impText(ht).replace(/\s+/g, ' ').trim().slice(0, 40) : '',
      openFirst: ds[0].hasAttribute('open') ? '1' : '0',
      color: rgbToHex(cs.color) || rgbToHex(s.color) || '#16233a',
      radius: Math.round(clampNum(parseFloat(fs.borderRadius), 0, 40)),
      gap: Math.round(clampNum(parseFloat(cs.rowGap) || parseFloat(cs.gap) || 10, 0, 40)),
      padY: Math.round(clampNum((parseFloat(s.paddingTop) + parseFloat(s.paddingBottom)) / 2, 0, 120)),
      padX: Math.round(clampNum(parseFloat(s.paddingLeft), 0, 80))
    };
    var cbg = impBg(ds[0], win, 0.5);
    if (cbg) opt.cardBg = cbg;
    var bg = impBg(el, win, 0.5);
    if (bg) opt.bg = bg;
    return makeImp('faq', opt);
  }

  /* 要点清单：.wr-features 里一格一格的「图标 + 标题 + 说明」。
     这是编辑器自带的 features 组件，认出来才能原样还原（图标底色、圆角、字号都对得上） */
  function impFeatures(el, win) {
    if (!/^(DIV|SECTION|ARTICLE|ASIDE)$/.test(el.tagName)) return null;
    var box = el.querySelector('.wr-features') || ((/wr-features/.test(String(el.className || ''))) ? el : null);
    if (!box) return null;
    // 只能认「自己就直接装着这块清单」的容器：
    // 再往上一层是整排多列布局，认下来会把另外两列一起吞掉
    if (box !== el && box.parentElement !== el) return null;
    var cards = Array.prototype.slice.call(box.querySelectorAll('.wr-feature')).filter(function (c) {
      return impShown(c, win) && impText(c).replace(/\s/g, '').length >= 2;
    });
    if (cards.length < 2 || cards.length > 8) return null;
    var rows = [];
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var icoEl = c.querySelector('.wr-feature-ico,.wr-media,[class*=ico]');
      var icon = icoEl ? impText(icoEl).replace(/\s+/g, ' ').trim().slice(0, 6) : '';
      var head = c.querySelector('h4,h3,h5,strong,b');
      var title = head ? impText(head).replace(/\s+/g, ' ').trim().slice(0, 30) : '';
      var ps = Array.prototype.slice.call(c.querySelectorAll('p')).filter(function (p) { return impText(p).replace(/\s/g, '').length > 1; });
      var desc = ps.length ? impText(ps[0]).replace(/\s+/g, ' ').trim().slice(0, 90) : '';
      if (!title || !desc) return null;
      rows.push([icon || '✓', title.replace(/\|/g, '/'), desc.replace(/\|/g, '/')].join(' | '));
    }
    var s = win.getComputedStyle(el), cs = win.getComputedStyle(cards[0]);
    // 标题是外层 section 里的那个 h2（组件会自己渲染成大标题），别让它再单独出一遍
    var ht = el.querySelector(':scope > h1,:scope > h2,:scope > h3') || el.querySelector('h1,h2,h3');
    var opt = {
      featureItems: rows.join('\n'),
      title: ht ? impText(ht).replace(/\s+/g, ' ').trim().slice(0, 40) : '',
      color: rgbToHex(s.color) || '#16233a',
      radius: Math.round(clampNum(parseFloat(cs.borderRadius), 0, 40)),
      gap: Math.round(clampNum(parseFloat(win.getComputedStyle(box).gap) || 14, 0, 48)),
      // 要点清单连着外层标题一起代表这个 section，所以 section 自己的留白由它带
      padY: Math.round(clampNum((parseFloat(s.paddingTop) + parseFloat(s.paddingBottom)) / 2, 0, 120)),
      padX: Math.round(clampNum(parseFloat(s.paddingLeft), 0, 80))
    };
    var cbg = impBg(cards[0], win, 0.4);
    if (cbg) opt.cardBg = cbg;
    var bg = impBg(el, win, 0.5);
    if (bg) opt.bg = bg;
    return makeImp('features', opt);
  }

  /* 模块自己的留白：自身没写就看父层。
     导航栏 / 页脚这种「section 包着 nav/footer」的结构，section 的留白才是真正生效的那圈 */
  function impPadOf(el, win) {
    var s = win.getComputedStyle(el);
    var py = (parseFloat(s.paddingTop) + parseFloat(s.paddingBottom)) / 2;
    var px = parseFloat(s.paddingLeft) || 0;
    if (!py && !px && el.parentElement) {
      try {
        var ps = win.getComputedStyle(el.parentElement);
        py = (parseFloat(ps.paddingTop) + parseFloat(ps.paddingBottom)) / 2;
        px = parseFloat(ps.paddingLeft) || 0;
      } catch (e) { }
    }
    return { padY: Math.round(clampNum(py, 0, 140)), padX: Math.round(clampNum(px, 0, 80)) };
  }

  /* 代码块：.wr-code 里一条标题栏 + <pre><code>。不认的话整块会变成一段纯文字，
     深色卡片、标题栏、「● ● ●」全丢 */
  function impCodeBlock(el, win) {
    var box = el.querySelector('.wr-code') || ((/wr-code/.test(String(el.className || ''))) ? el : null);
    if (!box) return null;
    if (box !== el && box.parentElement !== el) return null;
    // 元素里还有别的东西（标题、说明）就别整块吞掉
    if (box !== el && el.children.length > 1) return null;
    var pre = box.querySelector('pre');
    var codeEl = box.querySelector('code');
    if (!pre && !codeEl) return null;
    var src = codeEl ? (codeEl.textContent || '') : (pre ? (pre.textContent || '') : '');
    src = src.replace(/\r/g, '').replace(/^\n+|\n+$/g, '');
    if (src.length < 4) return null;
    var bar = box.querySelector('.wr-code-bar');
    var lang = bar ? impText(bar.querySelector('span') || bar).replace(/\s+/g, ' ').trim().slice(0, 20) : '';
    var s = win.getComputedStyle(el);
    var pad = impPadOf(el, win);
    var opt = {
      codeLang: lang || 'CODE',
      codeText: src.slice(0, 4000),
      radius: Math.round(clampNum(parseFloat(win.getComputedStyle(box).borderRadius), 0, 40)),
      padY: pad.padY, padX: pad.padX,
      bg: impBg(el, win, 0.5) || ''
    };
    return makeImp('code', opt);
  }

  /* 顶部公告条：图标 + 一句话 + 「查看详情 →」链接。不认的话链接会被拍成纯文字 */
  function impAnnounce(el, win) {
    var inner = el, direct = /wr-announce-inner|announce-inner/.test(String(el.className || ''));
    if (!direct) {
      if (!/^(DIV|SECTION|ASIDE|HEADER)$/.test(el.tagName)) return null;
      inner = el.querySelector('.wr-announce-inner,[class*=announce-inner]');
      if (!inner) return null;
      // 外层还包着一层有底色的卡片时别吞掉它：那层留白 / 圆角要单独还原
      if (inner.parentElement !== el && impBg(el, win, 0.5)) return null;
    }
    var t = impText(inner).replace(/\s+/g, ' ').trim();
    if (t.length < 2 || t.length > 140) return null;
    var link = Array.prototype.slice.call(inner.querySelectorAll('a[href]')).filter(function (a) { return impShown(a, win); })[0];
    var icoEl = inner.querySelector('.wr-media,[class*=emoji],[class*=announce-ico]');
    var icon = icoEl ? impText(icoEl).replace(/\s+/g, ' ').trim().slice(0, 8) : '';
    var linkTxt = link ? impText(link).replace(/\s+/g, ' ').trim() : '';
    var btn = linkTxt.replace(/[\s→›»]+$/, '').trim().slice(0, 16);
    var text = t;
    if (icon) text = text.replace(icon, '');
    if (linkTxt) text = text.replace(linkTxt, '');
    text = text.replace(/^[\s:：·•|]+|[\s:：·•|]+$/g, '').trim();
    if (!text && !btn) return null;
    var s = win.getComputedStyle(inner);
    // 底色 / 留白永远取公告内容自己的父层，不要被更外层的卡片背景带跑
    var host = inner.parentElement || el;
    var hs = win.getComputedStyle(host);
    var bg = impBg(host, win, 0.5) || '';
    return makeImp('announce', {
      text: text.slice(0, 100), emoji: icon, btnText: btn,
      href: link ? (link.getAttribute('href') || '#') : '#',
      color: rgbToHex(s.color) || '#ffffff',
      bg: bg || '#1b3b6f',
      padY: Math.round(clampNum((parseFloat(hs.paddingTop) + parseFloat(hs.paddingBottom)) / 2, 0, 40)),
      padX: Math.round(clampNum(parseFloat(hs.paddingLeft), 0, 80))
    });
  }

  /* 拍平导航 / 页脚外层时，外层的动效属性要跟着下去。
     原页面常把 wr-hover-* / wr-loop-* 写在 <section> 上，真正的 nav/footer 在里面；
     只把子节点提出来会把这层动效一起丢掉，导出后就少了下划线、流光这些效果。 */
  function impCarryFx(from, to) {
    if (!from || !from.p || !to || !to.p) return;
    ['boxHover', 'loopFx', 'boxShadow', 'animIn', 'animOnce', 'animDur', 'animDelay',
      'animEase', 'animDist', 'animStagger', 'boxBorderWidth', 'boxBorderColor',
      'boxMinHeight', 'boxWidth', 'boxAlign',
      // 外壳自己的配色也要跟着走：页脚 / 导航外面套的那层 section 往往写着
      // 「独立配色锁定 + 深色主题色」，压平后丢了这些，重新导出就退回跟随主题
      'bg', 'color', 'radius', 'boxColorLock', 'boxThemeRole',
      'boxThemeLightBg', 'boxThemeLightText', 'boxThemeLightAccent', 'boxThemeLightLink',
      'boxThemeDarkBg', 'boxThemeDarkText', 'boxThemeDarkAccent', 'boxThemeDarkLink'].forEach(function (k) {
        var v = from.p[k], d = COMMON_DEFAULTS[k];
        if (v == null || v === '' || v === d) return;
        var old = to.p[k];
        if (old == null || old === '' || old === d) to.p[k] = v;
      });
  }
  /* 容器里只装着导航 / 页脚时把它拍平：导航被包在容器里，sticky 的包含块就是容器，永远吸不住 */
  function impFlattenChrome(list) {
    var out = [];
    (list || []).forEach(function (b) {
      if (b && b.children && b.children.length) {
        b.children = impFlattenChrome(b.children);
        var chrome = b.children.filter(function (c) { return c && (isNavType(c.type) || c.type === 'footer'); });
        if (chrome.length === b.children.length) {
          b.children.forEach(function (c) { impCarryFx(b, c); });
          out = out.concat(b.children); return;
        }
      }
      out.push(b);
    });
    return out;
  }

  function impNavBlock(el, win) {
    var all = Array.prototype.slice.call(el.querySelectorAll('a[href]')).filter(function (a) { return impShown(a, win); });
    if (all.length < 2) return null;
    // 品牌名：优先 .logo/.brand，其次第一个短链接。品牌本身也是一个 <a>，别让它同时进导航项
    var brand = el.querySelector('[class*=logo],[class*=brand],.site-title,.site-name');
    var brandA = null;
    if (brand) {
      brandA = brand.closest ? brand.closest('a') : null;
      if (!brandA) {
        var bp = brand.parentElement;
        while (bp && bp !== el && !brandA) { if (bp.tagName === 'A') brandA = bp; bp = bp.parentElement; }
      }
    }
    var brandTxt = brand ? impText(brand).replace(/\n/g, ' ').trim() : '';
    var cta = all.filter(function (a) { return /btn|button|cta|primary/i.test(String(a.className || '')); }).pop() || null;
    var links = all.filter(function (a) {
      if (a === cta) return false;
      if (brandA && (a === brandA || a.contains(brandA))) return false;
      var t = impText(a).replace(/\n/g, ' ').trim();
      if (brandTxt && t === brandTxt) return false;
      return true;
    });
    var nav = links.slice(0, 6).map(function (a) {
      return (impText(a) || '链接').replace(/\n/g, ' ').slice(0, 14) + ' | ' + (a.getAttribute('href') || '#');
    }).join('\n');
    if (!nav.trim()) return null;
    var title = brandTxt;
    if (!title) {
      var first = links[0] || all.filter(function (a) { return a !== cta; })[0];
      title = first ? impText(first) : '';
    }
    if (!title) title = impText(el).split('\n')[0] || 'WR Studio';
    // 原页面的 logo 如果本身是张图，直接当图标用（比塞个 ✦ 更接近原样）
    var markSrc = '';
    if (brand) {
      var mi = brand.tagName === 'IMG' ? brand : brand.querySelector('img');
      if (mi) {
        var ms = mi.getAttribute('src') || mi.currentSrc || '';
        if (ms && ms.length < 120000) markSrc = ms;
      }
    }
    var s = win.getComputedStyle(el);
    var bg = impBg(el, win, 0.3) || '#ffffff';
    var r = el.getBoundingClientRect();
    // 吸顶：导航自己可能是 static，但外层 header/wrapper 是 fixed / sticky，也得算
    var sticky = '0';
    var node = el, d = el.ownerDocument;
    while (node && node.nodeType === 1) {
      var pst = win.getComputedStyle(node).position;
      if (/fixed|sticky/.test(pst)) { sticky = '1'; break; }
      if (node === d.body || node === d.documentElement) break;
      node = node.parentElement;
    }
    // 有些站点直接把导航写在文档流最上面（靠 scroll 脚本加类），这种也按吸顶处理
    if (sticky === '0' && r.top <= 150 && r.width >= (win.innerWidth || 1200) * 0.6) sticky = '1';
    var navOpt = {
      title: title.slice(0, 24),
      emoji: markSrc || '✦',
      navItems: nav,
      btnText: cta ? impText(cta).replace(/\n/g, ' ').slice(0, 10) : '',
      navCtaHref: cta ? (cta.getAttribute('href') || '#') : '#contact',
      sticky: sticky,
      navHeight: Math.round(clampNum(r.height, 48, 96)),
      color: impTextColor(el, win) || readableInk(bg),
      bg: bg,
      align: /center/.test(s.textAlign) ? 'center' : (/left|start/.test(s.textAlign) ? 'left' : 'right'),
      padY: impPadOf(el, win).padY,
      padX: impPadOf(el, win).padX
    };
    // 导航右侧那颗按钮（常是渐变胶囊）也照原样带回来
    impApplyBtn(navOpt, cta, win);
    return makeImp('navbar', navOpt);
  }

  function impFooterBlock(el, win) {
    var txt = impText(el);
    if (txt.length < 6 && !el.querySelector('a')) return null;
    var s = win.getComputedStyle(el);
    var bg = impBg(el, win, 0.3) || impBackdrop(el, win, '') || '#12233f';
    var links = Array.prototype.slice.call(el.querySelectorAll('a[href]')).filter(function (a) { return impShown(a, win); }).slice(0, 6);
    var mail = el.querySelector('a[href^="mailto:"]'), tel = el.querySelector('a[href^="tel:"]');
    var copy = '';
    Array.prototype.slice.call(el.querySelectorAll('p,div,span,small')).some(function (n) {
      var t = impText(n);
      if (/©|\(c\)|copyright/i.test(t) && t.length < 90) { copy = t; return true; }
      return false;
    });
    var head = el.querySelector('h1,h2,h3,h4,strong,[class*=logo],[class*=brand]');
    var title = head ? impText(head).replace(/\n/g, ' ').slice(0, 24) : '';
    if (!title) {
      // 没有标题就取第一段短文字（多半是品牌名），别把模板里的 WR Studio 硬塞给别人的站
      var line = '';
      var linkTxts = links.map(function (a) { return impText(a).trim(); });
      Array.prototype.slice.call(el.querySelectorAll('span,div,p,small,b')).some(function (n) {
        var t = impText(n).replace(/\n/g, ' ').trim();
        if (!t || t.length > 24 || /©|\(c\)|copyright/i.test(t)) return false;
        // 「关于我们 · 联系方式」这种只是把链接名拼起来，不是品牌名
        var parts = t.split(/\s*[·|、\/]\s*/).filter(Boolean);
        if (parts.length && parts.every(function (x) { return linkTxts.indexOf(x) >= 0; })) return false;
        line = t; return true;
      });
      if (!line && copy) line = copy.replace(/©[\s\S]*$/, '').replace(/\s+/g, ' ').trim().slice(0, 24);
      // 整段纯文字的页脚（「品牌 · 地址 · 邮箱」一行到底）没有子元素可挑，直接切段
      if (!line) {
        var segs = txt.split(/\n/)[0].split(/\s*[·|、]\s*/);
        if (segs[0] && segs[0].trim().length <= 24) line = segs[0].trim();
      }
      title = line;
    }
    var desc = '';
    var p = el.querySelector('p');
    if (p && impText(p) !== copy) desc = impText(p).replace(/\n/g, ' ').slice(0, 120);
    // 原页面没有的电话 / 邮箱 / 地址一律留空：别把模板里的「400-000-0000」当成本站信息
    var addr = '';
    Array.prototype.slice.call(el.querySelectorAll('p,div,span,address')).some(function (n) {
      var t = impText(n);
      if (/路|街|号|市|区|address/i.test(t) && t.length <= 60 && t !== copy) { addr = t; return true; }
      return false;
    });
    if (!addr) {
      // 一行文字里混着地址和邮箱时，按「·」切段找
      txt.split(/\n/)[0].split(/\s*[·|、]\s*/).some(function (seg) {
        var t = seg.trim();
        if (t.length >= 6 && t.length <= 40 && /路|街|号|市|区/.test(t) && !/@/.test(t)) { addr = t; return true; }
        return false;
      });
    }
    var phone = tel ? (tel.getAttribute('href') || '').replace(/^tel:/, '') : '';
    if (!phone) {
      var pv = /(?:电\s*话|手\s*机|tel|phone)\s*[:：]?\s*([\d\-+()\s]{7,22})/i.exec(txt);
      if (pv) phone = pv[1].trim();
    }
    if (!addr) {
      var av = /(?:地\s*址|address)\s*[:：]?\s*([^\n]{2,40})/i.exec(txt);
      if (av) addr = av[1].trim();
    }
    var email = mail ? (mail.getAttribute('href') || '').replace(/^mailto:/, '').split('?')[0] : '';
    if (!email) {
      var em = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(txt);
      if (em) email = em[0];
    }
    return makeImp('footer', {
      title: title || 'WR Studio',
      desc: desc,
      footerLinks: links.map(function (a) { return (impText(a) || '链接').slice(0, 12) + ' | ' + (a.getAttribute('href') || '#top'); }).join('\n'),
      copyright: copy,
      phone: phone,
      email: email,
      address: addr,
      color: impTextColor(el, win) || '#c8d6ea',
      bg: bg,
      padY: impPadOf(el, win).padY,
      padX: impPadOf(el, win).padX
    });
  }

  function impLooksHero(el, win) {
    // 主视觉只认「一块 banner」：一个标题、少量直接子节点、里面没有再套分区。
    // 否则整页 <main> 会被当成主视觉一口吞掉，后面的内容全丢。
    var h1 = el.querySelectorAll('h1').length;
    if (h1 !== 1) return false;
    if (el.querySelectorAll('section,article').length > 0) return false;
    if (el.querySelectorAll('h1,h2,h3').length > 3) return false;
    var kids = impBlockKids(el, win);
    if (!kids.length || kids.length > 6) return false;
    var r = el.getBoundingClientRect();
    if (r.height > (win.innerHeight || 800) * 1.9) return false;
    var cta = el.querySelector('a[href],button');
    var ps = el.querySelectorAll('p').length;
    if (r.height >= 320 && (cta || ps)) return true;
    return !!(cta && ps && r.height >= 240);
  }

  function impHeroBlock(el, win) {
    var h = el.querySelector('h1') || el.querySelector('h2');
    var title = impText(h).replace(/\n/g, ' ');
    if (!title) return null;
    var cta = Array.prototype.slice.call(el.querySelectorAll('a[href],button')).filter(function (a) {
      return impShown(a, win) && impText(a).length > 0;
    })[0];
    // 先认小标签，再取正文：否则 <p class="kicker"> 会被当成描述，变成「小标签说了两遍」
    var kicker = '', smallEl = null;
    smallEl = el.querySelector('[class*=kicker],[class*=eyebrow],[class*=tagline],[class*=subtitle],.tag,.label,small');
    if (smallEl && impText(smallEl).length <= 30) kicker = impText(smallEl).replace(/\n/g, ' ');
    if (!kicker) {
      var prev = h.previousElementSibling;
      while (prev && !kicker) {
        var t = impText(prev);
        if (t && t.length <= 30) { kicker = t.replace(/\n/g, ' '); smallEl = prev; }
        prev = prev.previousElementSibling;
      }
    }
    var ps = Array.prototype.slice.call(el.querySelectorAll('p')).filter(function (p) {
      if (!impShown(p, win) || p === smallEl) return false;
      var t = impText(p);
      return t.length > 3 && t !== kicker;
    });
    var desc = ps.length ? impText(ps[0]).replace(/\n/g, ' ') : '';
    var s = win.getComputedStyle(el);
    var bg = impBg(el, win, 0.5) || impBackdrop(el.parentElement, win, '#12233f');
    // 颜色取标题自己的：深色主视觉区里 <h1 style="color:#fff">，区块本身继承的却是深色文字
    var ink = rgbToHex(win.getComputedStyle(h).color) || rgbToHex(s.color);
    if (!ink || ink.toLowerCase() === bg.toLowerCase()) ink = readableInk(bg);
    var heroOpt = {
      kicker: kicker.slice(0, 24),
      title: title.slice(0, 60),
      desc: desc.slice(0, 160),
      btnText: cta ? impText(cta).replace(/\n/g, ' ').slice(0, 10) : '',
      href: cta ? (cta.getAttribute('href') || '#') : '#',
      color: ink,
      bg: bg,
      align: /center/.test(s.textAlign) ? 'center' : 'left',
      padY: impPadOf(el, win).padY,
      padX: impPadOf(el, win).padX
    };
    // 主视觉按钮的渐变 / 圆角 / 内边距也要带回来，否则会退回主题色
    impApplyBtn(heroOpt, cta, win);
    return makeImp('hero', heroOpt);
  }

  /* 单个元素 → 模块数组（返回空数组表示这层没有可编辑内容） */
  /* 原页面上的动效类 → 编辑器的动效属性。
     导出页的 CSS 本来就带 wr-hover-* / wr-loop-* 规则，只是导入时没人把这些类挂回去，
     结果悬停上浮、流光扫过、金属光泽文字这些效果全没了。 */
  var IMP_HOVER_KEYS = { 'lift': 1, 'lift-lg': 1, 'zoom': 1, 'glow': 1, 'shadow': 1, 'shine': 1, 'tilt': 1, 'tilt-glare': 1, 'magnet': 1, 'press': 1, 'outline': 1, 'border': 1, 'spot': 1, 'underline': 1, 'imgzoom': 1, 'saturate': 1, 'dir': 1, 'wipe': 1, 'glitch': 1, 'glass': 1, 'arrow': 1, 'unblur': 1, 'flip3d': 1, 'zoomblur': 1 };
  var IMP_LOOP_KEYS = { 'float': 1, 'pulse': 1, 'breathe': 1, 'shine': 1, 'beam': 1, 'gradient': 1, 'sway': 1, 'ring': 1, 'metal': 1, 'typewriter': 1, 'marquee': 1, 'blink': 1, 'shimmer': 1, 'orbit': 1, 'rgbshift': 1 };
  var IMP_ANIM_KEYS = { 'up': 1, 'down': 1, 'left': 1, 'right': 1, 'fade': 1, 'zoom': 1, 'pop': 1, 'rotate': 1, 'flip': 1, 'unfold': 1, 'swing': 1, 'skew': 1, 'mask': 1, 'rise': 1, 'blur': 1, 'blurup': 1, 'drop': 1, 'wipe': 1, 'blurzoom': 1, 'spring': 1, 'slideblur': 1 };
  function impFxOf(el) {
    var out = null;
    var cls = String((el && el.className) || '');
    var m;
    if ((m = /(?:^|\s)wr-hover-([A-Za-z0-9-]+)/.exec(cls)) && IMP_HOVER_KEYS[m[1]]) {
      out = out || {}; out.boxHover = m[1];
    }
    if ((m = /(?:^|\s)wr-loop-([A-Za-z0-9-]+)/.exec(cls)) && IMP_LOOP_KEYS[m[1]]) {
      out = out || {}; out.loopFx = m[1];
    }
    if ((m = /(?:^|\s)wr-shadow-(sm|md|lg)/.exec(cls))) {
      out = out || {}; out.boxShadow = m[1];
    }
    if (el && el.getAttribute) {
      var an = el.getAttribute('data-anim');
      if (an && IMP_ANIM_KEYS[an]) { out = out || {}; out.animIn = an; }
      var ao = el.getAttribute('data-anim-once');
      if (ao === '1' || ao === '0') { out = out || {}; out.animOnce = ao; }
    }
    return out;
  }

  /* 一条细线：高度很小、有底色、没有文字。原页面用它当区块之间的分隔线，
     不认的话这段就整个消失（颜色、宽度、上下留白全丢） */
  function impDivider(el, win) {
    var r = el.getBoundingClientRect();
    if (r.height > 10 || r.height < 1) return null;
    var par = el.parentElement;
    if (!par) return null;
    var ps = win.getComputedStyle(par);
    var content = par.getBoundingClientRect().width - (parseFloat(ps.paddingLeft) || 0) - (parseFloat(ps.paddingRight) || 0);
    if (content < 40) return null;
    if (r.width < content * 0.12) return null;
    var bg = impBg(el, win, 0.3);
    if (!bg) return null;
    var s = win.getComputedStyle(el);
    return makeImp('divider', {
      lineColor: bg,
      thickness: Math.max(1, Math.round(r.height)),
      lineWidth: Math.round(clampNum(r.width / content * 100, 10, 100)),
      align: /center/.test(s.textAlign) ? 'center' : (/right|end/.test(s.textAlign) ? 'right' : 'left'),
      padY: 0, padX: 0
    });
  }

  /* 浮层：导出页把它包在 .wr-layer 里，section 上带 data-layer-*。
     位置按目标模块的盒子换算成百分比，重新导入后还能继续当浮层拖动。 */
  function impLayerOf(el, win) {
    if (!el || !el.getAttribute || el.getAttribute('data-layer-mode') !== 'overlay') return null;
    var host = el.parentElement;
    if (!host || !/wr-layer/.test(String(host.className || ''))) return null;
    var pr = host.parentElement ? host.parentElement.getBoundingClientRect() : null;
    var hr = host.getBoundingClientRect();
    var out = {
      layerMode: 'overlay',
      layerTarget: String(el.getAttribute('data-layer-target') || ''),
      layerX: pr && pr.width ? Math.round(clampNum((hr.left - pr.left) / pr.width * 100, -100, 100)) : 8,
      layerY: pr && pr.height ? Math.round(clampNum((hr.top - pr.top) / pr.height * 100, -100, 100)) : 8,
      layerW: pr && pr.width ? Math.round(clampNum(hr.width / pr.width * 100, 10, 150)) : 46,
      layerH: Math.round(clampNum(hr.height, 0, 1200)),
      layerZ: parseInt(win.getComputedStyle(host).zIndex, 10) || 20,
      layerRotate: 0,
      // 优先读模式标记；旧版导出没有该标记时，再按旧的 computedStyle 推断
      layerPointer: host.getAttribute('data-layer-pe') ||
        (/none/.test(win.getComputedStyle(host).pointerEvents) ? 'none' : 'auto')
    };
    var rm = /rotate\(\s*(-?[\d.]+)deg\s*\)/.exec(host.style && host.style.transform || '');
    if (rm) out.layerRotate = Math.round(clampNum(parseFloat(rm[1]), -180, 180));
    return out;
  }

  function impMap(el, win, ctx) {
    var res = impMapRaw(el, win, ctx);
    var fx = impFxOf(el);
    var t = (res && res.length && res[0] && res[0].p) ? res[0].p : null;
    if (t) {
      // 导出页写了稳定 ID：保存旧→新映射，浮层的目标随后跟着换
      if (ctx && ctx.stats && el.getAttribute) {
        var oldId = el.getAttribute('data-wr-id');
        if (oldId) {
          ctx.stats.idMap = ctx.stats.idMap || {};
          ctx.stats.idMap[oldId] = res[0].id;
        }
      }
      var layer = impLayerOf(el, win);
      if (layer) Object.keys(layer).forEach(function (k) { t[k] = layer[k]; });
      /* 主题样式：新导出页有 data-wr-theme；自定义配色写在 --wr-th-* 变量上。
         不认这一步，重新导入后每个模块都会退回「跟随主题」，浅/深色下的差别就没了。 */
      try {
        var roleT = el.getAttribute && el.getAttribute('data-wr-theme');
        if (!roleT) {
          // 更早的导出页没有 data-wr-theme，但角色一直写在 class 上（wr-th-custom 等）
          var thM = /(?:^|\s)wr-th-(base|card|soft|accent|inverse|outline|plain|custom)(?:\s|$)/.exec(String(el.className || ''));
          if (thM) roleT = thM[1];
        }
        if (roleT && /^(base|card|soft|accent|inverse|outline|plain|custom)$/.test(roleT)) {
          t.boxThemeRole = roleT;
          if (roleT === 'custom') {
            var tcs = win.getComputedStyle(el);
            var tv = function (n) {
              var raw = String(tcs.getPropertyValue(n) || '').trim();
              if (!raw) return '';
              var hx = rgbToHex(raw, 0);
              return hx || '';
            };
            [['boxThemeLightBg', '--wr-th-bg'], ['boxThemeLightText', '--wr-th-ink'],
              ['boxThemeLightAccent', '--wr-th-accent'], ['boxThemeLightLink', '--wr-th-link'],
              ['boxThemeDarkBg', '--wr-th-bg-d'], ['boxThemeDarkText', '--wr-th-ink-d'],
              ['boxThemeDarkAccent', '--wr-th-accent-d'], ['boxThemeDarkLink', '--wr-th-link-d']
            ].forEach(function (pair) {
              var v = tv(pair[1]);
              if (v) t[pair[0]] = v;
            });
            // 只写了 wr-th-custom、却没写任何 --wr-th-* 颜色：等于「跟随主题」，
            // 硬留着 custom 会在深色模式下把背景刷没
            if (!t.boxThemeLightBg && !t.boxThemeLightText && !t.boxThemeLightAccent && !t.boxThemeLightLink &&
              !t.boxThemeDarkBg && !t.boxThemeDarkText && !t.boxThemeDarkAccent && !t.boxThemeDarkLink) {
              t.boxThemeRole = 'auto';
            }
          }
        }
      } catch (eTh) { }
      /* 独立配色锁定：原页面用 wr-color-lock 让这一块在深色模式下不被整页覆盖。
         不还原这个开关，重新导出后一进深色模式，渐变 hero / 品牌墙就被刷成深色卡片。 */
      try {
        if (/(?:^|\s)wr-color-lock(?:\s|$)/.test(String(el.className || ''))) t.boxColorLock = '1';
      } catch (eLock) { }
      if (fx) {
        if (fx.boxHover) t.boxHover = fx.boxHover;
        if (fx.loopFx) t.loopFx = fx.loopFx;
        if (fx.boxShadow) t.boxShadow = fx.boxShadow;
        if (fx.animIn) t.animIn = fx.animIn;
        if (fx.animOnce) t.animOnce = fx.animOnce;
      }
      // 原页面的描边（多半是 1px 浅色）也要留着，导出后卡片就还是那张卡片
      try {
        var s = win.getComputedStyle(el);
        var ws = [parseFloat(s.borderTopWidth), parseFloat(s.borderRightWidth), parseFloat(s.borderBottomWidth), parseFloat(s.borderLeftWidth)];
        var same = ws.every(function (v) { return Math.abs(v - ws[0]) < 0.5; });
        if (same && ws[0] >= 1 && ws[0] <= 10) {
          var bc = rgbToHex(s.borderTopColor, 0.5);
          if (bc) { t.boxBorderWidth = Math.round(ws[0]); t.boxBorderColor = bc; }
        }
        // 宽度 / 最小高度：原页面常见「width:95% + margin:auto」「min-height:450px」
        var mh = parseFloat(s.minHeight) || 0;
        if (mh >= 40 && mh <= 2000) t.boxMinHeight = Math.round(mh);
        // 锚点：#features / #text 这些是导航跳转的落点，丢了导航点了没反应
        var eid = String(el.id || '').trim();
        if (eid && eid !== 'top' && /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(eid)) t.anchorId = eid;
        var par = el.parentElement;
        // 浮层的宽高由外层 .wr-layer 决定，再给 section 写一次百分比，
        // 导出后会变成「49% 的 49%」，窄屏上开关文字直接折成两行
        if (par && res[0].type !== 'divider' && t.layerMode !== 'overlay') {
          var ps = win.getComputedStyle(par);
          var pr = par.getBoundingClientRect(), er = el.getBoundingClientRect();
          /* 顶层模块：父层就是 .wr-page（整页那圈宽度），它自带页面底色，
             按「外壳」跳过会把所有宽度设置都丢掉。这里直接拿页面宽度当分母，
             width:88% 才还原得回 88。 */
          var pageHost = false;
          try {
            pageHost = par === el.ownerDocument.body ||
              (par.classList && (par.classList.contains('wr-page') || par.id === 'top'));
          } catch (ePage) { }
          // 外层 section 自己有底色 / 圆角 = 它才是这块的外壳（会合并进来），
          // 这时 el 只是壳里的一段内容，它自己的宽度不能变成整块的宽度
          var parentIsShell = false;
          try { parentIsShell = !!impBg(par, win, 0.5) || parseFloat(ps.borderRadius) > 0; } catch (e1) { }
          var inner = pageHost ? pr.width : pr.width - (parseFloat(ps.paddingLeft) || 0) - (parseFloat(ps.paddingRight) || 0);
          // 多列布局（grid / flex row）里每列的宽度是布局算出来的，不是自己定的，别搬
          var multiCol = /grid/.test(ps.display) ||
            (/flex/.test(ps.display) && /row/.test(ps.flexDirection)) ||
            (s.gridTemplateColumns || '').split(/\s+/).filter(Boolean).length > 1;
          if ((pageHost || (!parentIsShell && !multiCol)) && inner > 60 && er.width > 60) {
            var ratio = er.width / inner;
            if (ratio >= 0.3 && ratio < 0.985) {
              t.boxWidth = Math.round(ratio * 100);
              var gl = er.left - (pr.left + (pageHost ? 0 : (parseFloat(ps.paddingLeft) || 0)));
              var gr = (pr.right - (pageHost ? 0 : (parseFloat(ps.paddingRight) || 0))) - er.right;
              if (Math.abs(gl - gr) < 4 && gl > 8) t.boxAlign = 'center';
              else if (gr < 4 && gl > 8) t.boxAlign = 'right';
            }
          }
        }
      } catch (e) { }
    }
    return res;
  }

  function impMapRaw(el, win, ctx) {
    var tag = el.tagName;
    var s = win.getComputedStyle(el);
    var text = impText(el);
    var align = /center/.test(s.textAlign) ? 'center' : (/right|end/.test(s.textAlign) ? 'right' : 'left');
    var color = impTextColor(el, win) || '';
    var bg = impBg(el, win, 0.5);
    var padY = Math.round(clampNum((parseFloat(s.paddingTop) + parseFloat(s.paddingBottom)) / 2, 0, 120));
    var padX = Math.round(clampNum(parseFloat(s.paddingLeft), 0, 80));
    var font = Math.round(clampNum(parseFloat(s.fontSize), 11, 80));
    var radius = Math.round(clampNum(parseFloat(s.borderRadius), 0, 40));

    if (/^H[1-6]$/.test(tag)) {
      if (!text) return [];
      ctx.used++;
      return [makeImp('heading', {
        text: text.slice(0, 200), level: tag === 'H1' ? '1' : (tag === 'H2' ? '2' : '3'),
        color: color, align: align, fontSize: font, padY: Math.min(padY, 56), padX: padX
      })];
    }
    if (tag === 'P' || tag === 'FIGCAPTION' || tag === 'DT' || tag === 'DD' || tag === 'PRE') {
      if (text.length < 2) return [];
      ctx.used++;
      return [makeImp('text', {
        text: text.slice(0, 1200), color: color, align: align, fontSize: font,
        padY: Math.min(padY, 40), padX: padX
      })];
    }
    if (tag === 'BLOCKQUOTE') {
      if (text.length < 2) return [];
      var cite = el.querySelector('cite,footer,figcaption,.author,.byline');
      var qText = text, author = '';
      if (cite) {
        author = impText(cite).replace(/\n/g, ' ').replace(/^[—–-]\s*/, '').slice(0, 30);
        // 署名单独存，正文里剔掉，否则“引用 + 署名”会一起塞进引号再配一次署名
        var c2 = el.cloneNode(true);
        Array.prototype.slice.call(c2.querySelectorAll('cite,footer,figcaption,.author,.byline')).forEach(function (x) { x.parentNode.removeChild(x); });
        qText = c2.textContent;
      }
      qText = qText.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim()
        .replace(/\s*[—–]\s*[^—–。！？]{1,22}$/, '')
        .replace(/^[\s“”"'「『‘’]+|[\s“”"'」』‘’]+$/g, '')
        .trim();
      // 原文若自带署名（「—— 沈岚」），作者从正文尾部捞回来
      if (!author) {
        var m = /[—–]\s*([^—–]{1,22})\s*$/.exec(text.replace(/\n/g, ' '));
        if (m) author = m[1].replace(/^[—–\s]+/, '').slice(0, 30);
      }
      if (!qText) return [];
      ctx.used++;
      return [makeImp('quote', {
        text: qText.slice(0, 200),
        author: author,
        color: color, bg: bg || '#f5f8ff', align: align || 'center', radius: radius || 14,
        padY: Math.min(padY, 60), padX: padX
      })];
    }
    if (tag === 'HR') { ctx.used++; return [makeImp('divider', { padY: Math.min(padY || 22, 40) })]; }
    if (tag === 'IMG') {
      var attr = el.getAttribute('src') || '';
      var src = attr;
      if (/^\/\//.test(attr)) src = location.protocol + attr;
      if (!src && el.currentSrc) src = el.currentSrc;
      if (!src) return [];
      if (/^data:image\/(svg|gif)/i.test(src)) { ctx.skipped++; return []; }
      if (/^data:/i.test(src)) ctx.dataImgs++;
      else if (/^https?:/i.test(src)) ctx.remoteImgs++;
      else ctx.localImgs++;
      var ir = el.getBoundingClientRect();
      var w = ir.width;
      var pw = el.parentElement ? el.parentElement.getBoundingClientRect().width : w;
      var host = el.parentElement;
      var hostR = host ? parseFloat(win.getComputedStyle(host).borderRadius) : 0;
      var roundish = hostR >= 40 || (host && /round|avatar/i.test(String(host.className || ''))) ||
        (ir.width > 8 && Math.abs(ir.width - ir.height) < 3 && hostR >= 8);
      // 头像 / logo 这类小图按原尺寸放：按百分比会被拉到一整行宽，卡片直接变形
      var wOpt = w < 180 ? Math.max(20, Math.round(w)) + 'px'
        : (pw > 60 ? Math.round(clampNum(w / pw * 100, 20, 100)) : 100);
      ctx.used++;
      return [makeImp('image', {
        src: src, alt: (el.getAttribute('alt') || '').slice(0, 80), caption: '',
        width: wOpt,
        radius: roundish ? '999px' : radius, align: align, padY: w < 180 ? 6 : 18, padX: 0
      })];
    }
    if (tag === 'VIDEO') {
      var vsrc = el.currentSrc || el.getAttribute('src') || '';
      if (!vsrc) { var so = el.querySelector('source'); if (so) vsrc = so.getAttribute('src') || ''; }
      if (!vsrc) return [];
      // 保留原页面的播放方式：滚动驱动 / 循环 / 点击播放，别一律降级成点击播放
      var vmode = '';
      var host = el.closest ? el.closest('[data-mode],[data-film-mode]') : null;
      if (host) vmode = String(host.getAttribute('data-mode') || host.getAttribute('data-film-mode') || '');
      var vh = el.getBoundingClientRect().height || 0;
      if (['scroll', 'loop', 'click'].indexOf(vmode) < 0) {
        if (el.autoplay && el.loop) vmode = 'loop';
        else if (el.autoplay) vmode = 'scroll';
        else vmode = vh >= 260 ? 'scroll' : 'click';
      }
      ctx.used++;
      // 原页面里片子常常是通栏、直角、无留白（<figure class="wr-film">）；
      // 直接套模块默认的 16 圆角 + 24 留白，会变成一张深色圆角卡片，和原样对不上
      var fHost = (el.closest && el.closest('figure,.wr-film,[class*=film],[class*=video]')) || el.parentElement || el;
      var fst = null;
      try { fst = win.getComputedStyle(fHost); } catch (e) { }
      // 片子外面那圈留白常常写在更外层（section 上），只看 figure 会把 24~40px 的上下留白丢掉，
      // 导出后视频块就会比原页面「顶上去」一截
      try {
        if (fst && !parseFloat(fst.paddingTop) && fHost.parentElement && fHost.parentElement !== el.ownerDocument.body) {
          var pst = win.getComputedStyle(fHost.parentElement);
          if (parseFloat(pst.paddingTop) >= 8 && parseFloat(pst.paddingTop) <= 60) fst = pst;
        }
      } catch (e) { }
      var fPad = fst ? Math.round((parseFloat(fst.paddingTop) + parseFloat(fst.paddingBottom)) / 2) : 0;
      var fPadX = fst ? Math.round(parseFloat(fst.paddingLeft) || 0) : 0;
      var fRad = fst ? Math.round(clampNum(parseFloat(fst.borderRadius), 0, 40)) : radius;
      return [makeImp('film', {
        filmSrc: vsrc, filmMode: vmode,
        filmH: Math.round(clampNum(vh, 240, 720)),
        filmPoster: el.getAttribute('poster') || '',
        radius: isFinite(fRad) ? fRad : radius,
        padY: isFinite(fPad) ? Math.min(fPad, 60) : 0,
        padX: isFinite(fPadX) ? Math.min(fPadX, 60) : 0,
        // 原页面外层是透明的，深色来自 .wr-film 自己的底色；这里别再给外层补一层
        bg: ''
      })];
    }
    if (tag === 'IFRAME') {
      var isrc = el.getAttribute('src') || el.getAttribute('data-src') || '';
      if (!isrc || /^about:/.test(isrc) || /google|doubleclick|analytics/i.test(isrc)) { ctx.skipped++; return []; }
      ctx.used++;
      return [makeImp('video', {
        title: (el.getAttribute('title') || '嵌入内容').slice(0, 40),
        desc: '从原页面导入的嵌入框架', url: isrc, btnText: '打开链接',
        padY: Math.min(padY, 60), padX: padX
      })];
    }
    if (tag === 'TABLE') {
      var rows = Array.prototype.slice.call(el.querySelectorAll('tr')).map(function (tr) {
        return Array.prototype.slice.call(tr.children).map(function (td) { return impText(td).replace(/\n/g, ' '); }).join(' | ');
      }).filter(function (r) { return r.trim(); });
      if (!rows.length) return [];
      ctx.used++;
      return [makeImp('text', { text: rows.join('\n').slice(0, 1200), color: color, align: 'left', fontSize: Math.min(font, 16), padY: Math.min(padY, 40), padX: padX })];
    }
    if (tag === 'UL' || tag === 'OL' || tag === 'DL') {
      var lis = Array.prototype.slice.call(el.querySelectorAll('li')).filter(function (li) { return impShown(li, win); });
      var items = lis.map(function (li) { return impText(li).replace(/\n/g, ' '); })
        .filter(function (t) { return t && t.length <= 120; });
      if (!items.length) {
        if (el.querySelector('a')) return impMapGeneric(el, win, ctx);
        return [];
      }
      // 「图标 / 标题 / 一行说明」这种卡片列表还原成三栏特性，比一串 · 好看得多
      var cards = impListCards(lis, win);
      if (cards) { ctx.used++; return [cards]; }
      ctx.used++;
      var chips = items.length >= 2 && items.length <= 8 && items.every(function (t) { return t.length <= 16; }) && !/[。；;，,]/.test(items.join(''));
      if (chips) return [makeImp('badge', { text: items.join(', '), color: color || '#1c6bb5', align: align, padY: Math.min(padY || 20, 32), padX: padX })];
      return [makeImp('text', {
        text: items.map(function (t) { return '· ' + t; }).join('\n').slice(0, 1200),
        color: color, align: align, fontSize: Math.min(font, 18), padY: 14, padX: padX
      })];
    }
    if (tag === 'FORM') {
      var legend = el.querySelector('legend,h2,h3');
      ctx.used++;
      return [makeImp('form', {
        title: legend ? impText(legend).slice(0, 30) : '填写表单',
        desc: '从原页面导入的表单区域，提交后需要自行接入后端',
        btnText: (el.querySelector('button,[type=submit]') ? impText(el.querySelector('button,[type=submit]')).slice(0, 8) : '') || '提交',
        color: color || '#16233a', bg: bg || '#f5f8ff', radius: radius || 16
      })];
    }
    if (tag === 'BUTTON' || tag === 'A') {
      if (!text) return [];
      var href = tag === 'A' ? (el.getAttribute('href') || '#') : (el.getAttribute('data-href') || '#');
      var btnish = tag === 'BUTTON' || /btn|button|cta/i.test(String(el.className || '')) || !!bg;
      if (!btnish) {
        // 普通文字链接：当一段文字留着，链接地址记在 hint 里没意义，直接保留文字
        ctx.used++;
        return [makeImp('text', { text: text.slice(0, 200), color: color, align: align, fontSize: font, padY: Math.min(padY, 24), padX: padX })];
      }
      ctx.used++;
      return [makeImp('button', {
        text: text.replace(/\n/g, ' ').slice(0, 16), href: href,
        btnBg: bg || '#3b82f6', btnColor: color || readableInk(bg || '#3b82f6'),
        radius: radius || 10, align: align,
        padY: Math.min(padY, 40), padX: padX
      })];
    }
    if (tag === 'NAV' || tag === 'HEADER') {
      var nb = impNavBlock(el, win);
      if (nb) { ctx.used++; return [nb]; }
      return impMapGeneric(el, win, ctx);
    }
    if (tag === 'FOOTER') {
      var fb = impFooterBlock(el, win);
      if (fb) { ctx.used++; return [fb]; }
      return impMapGeneric(el, win, ctx);
    }
    return impMapGeneric(el, win, ctx);
  }

  /* 图标 + 标题 + 说明的列表 → 三栏特性卡片；不像卡片就返回 null */
  function impListCards(lis, win) {
    if (lis.length < 2 || lis.length > 6) return null;
    var rows = [];
    for (var i = 0; i < lis.length; i++) {
      var lines = impText(lis[i]).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (lines.length < 2) return null;
      var head = lines[0], icon = '✓';
      var m = /^([^\w\u4e00-\u9fa5]{1,3})\s*/.exec(head);
      if (m) { icon = m[1].trim(); head = head.slice(m[0].length).trim(); }
      if (!head || head.length > 24) return null;
      var desc = lines.slice(1).join(' ');
      if (!desc) return null;
      rows.push([icon.replace(/\|/g, ''), head.replace(/\|/g, '/'), desc.replace(/\|/g, '/').slice(0, 80)].join(' | '));
    }
    // 卡片的底色 / 文字色 / 圆角也照抄原列表，别让暖色页面里冒出一排冷蓝卡片
    var cs = win.getComputedStyle(lis[0]);
    var cbg = impBg(lis[0], win, 0.5);
    var cink = rgbToHex(cs.color);
    var crad = Math.round(clampNum(parseFloat(cs.borderRadius), 0, 40));
    var opt = { items: rows.join('\n'), title: '', align: 'center', padY: 36, cols: Math.min(Math.max(rows.length, 1), 3) };
    if (cbg) opt.cardBg = cbg;
    if (cink) opt.color = cink;
    if (crad) opt.radius = crad;
    return makeImp('grid', opt);
  }

  /* 一行多列里的列本身已经很窄了：里面再横排会碎成一字一行，压回纵向 */
  function impDewrap(b) {
    if (!b) return b;
    if (b.type === 'grid' && b.p && Number(b.p.cols) > 1) b.p.cols = 1;
    if (b.type === 'container' && b.p && b.p.layout === 'row') b.p.layout = 'stack';
    (b.children || []).forEach(impDewrap);
    return b;
  }

  /* 编辑器自己导出的「社区与产品」组件，重新导入时认回原组件类型。
     只靠通用流程会把热搜、聊天、仓库卡全拍成一段段文字，编辑能力就丢了。 */
  function impSiteBlock(el, win) {
    var hostEl = el;
    var cls = String(el.className || '');
    var types = [
      ['wr-hotlist', 'hotlist'], ['wr-feed', 'feed'], ['wr-qa', 'qa'], ['wr-rating-list', 'rating'],
      ['wr-search', 'search'], ['wr-repo', 'repo'], ['wr-wiki', 'wiki'], ['wr-chat', 'chat'],
      ['wr-awards', 'awards'], ['wr-marquee', 'marquee'], ['wr-logos', 'logos'],
      ['wr-brandwall', 'brandwall'], ['wr-brandrotor', 'brandrotor'], ['wr-futype', 'futype'], ['wr-geometry', 'geometry'],
      ['wr-kinetic', 'kinetic'], ['wr-hires', 'hires'], ['wr-object3d', 'object3d'],
      ['wr-profilecard', 'profilecard'], ['wr-skillbar', 'skillbar'], ['wr-journey', 'journey'],
      ['wr-linkhub', 'linkhub'], ['wr-tagcloud', 'tagcloud'], ['wr-statboard', 'statboard'], ['wr-polaroid', 'polaroid'],
      ['wr-colorswitch', 'colorswitch'], ['wr-darkmode', 'darkmode'], ['wr-fontsizer', 'fontsizer'], ['wr-themepicker', 'themepicker']
    ];
    var type = '';
    for (var i = 0; i < types.length; i++) { if (cls.indexOf(types[i][0]) >= 0) { type = types[i][1]; break; } }
    if (!type && el.tagName === 'SECTION') {
      // 导出页里某些组件的内部容器带类名，而 section 本身只有动效类
      var hit = el.querySelector('.wr-hotlist,.wr-feed,.wr-qa,.wr-rating-list,.wr-search,.wr-repo,.wr-wiki,.wr-chat,.wr-awards,.wr-marquee,.wr-logos,' +
        '.wr-brandwall,.wr-brandrotor,.wr-futype,.wr-geometry,.wr-kinetic,.wr-hires,.wr-object3d,' +
        '.wr-profilecard,.wr-skillbar,.wr-journey,.wr-linkhub,.wr-tagcloud,.wr-statboard,.wr-polaroid,' +
        '.wr-colorswitch,.wr-darkmode,.wr-fontsizer,.wr-themepicker');
      if (hit) {
        for (var j = 0; j < types.length; j++) { if (hit.className && String(hit.className).indexOf(types[j][0]) >= 0) { type = types[j][1]; el = hit; break; } }
      }
    }
    if (!type) return null;
    var q = function (s) { return el.querySelector(s); };
    // 组件容器（.wr-futype 等）常常只是 section 里的一层，底色 / 留白 / 对齐都在外层；
    // 只读容器会把整块的背景和间距丢掉（远看就是「渐变没了、文字贴边」）。
    var qh = function (s) { return hostEl.querySelector(s); };
    var qa = function (s) { return Array.prototype.slice.call(el.querySelectorAll(s)); };
    var qqa = function (n, s) { return n ? Array.prototype.slice.call(n.querySelectorAll(s)) : []; };
    var tx = function (n) { return n ? String(n.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
    var hs0 = win.getComputedStyle(hostEl);
    var pad = impPadOf(hostEl, win);
    var opt = {
      padY: pad.padY, padX: pad.padX,
      align: /center/.test(hs0.textAlign) ? 'center' : (/right|end/.test(hs0.textAlign) ? 'right' : 'left'),
      color: impTextColor(el, win) || impTextColor(hostEl, win) || ''
    };
    var iconOf = function (n) {
      if (!n) return '';
      var im = n.querySelector ? n.querySelector('img') : null;
      return (im && (im.getAttribute('src') || im.currentSrc)) || tx(n);
    };
    if (type === 'hotlist') {
      opt.title = tx(q('h2'));
      opt.hotItems = qa('.wr-hot-row').map(function (r) {
        return [tx(qqa(r, '.wr-hot-title')[0]), tx(qqa(r, '.wr-hot-heat')[0]), tx(qqa(r, '.wr-hot-badge')[0])].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
    } else if (type === 'feed') {
      opt.feedStyle = /is-x/.test(String(q('.wr-feed') ? q('.wr-feed').className : cls)) ? 'x' : 'weibo';
      opt.feedItems = qa('.wr-post').map(function (r) {
        var acts = qqa(r, '.wr-post-act');
        var av = qqa(r, '.wr-media')[0], pic = qqa(r, '.wr-post-img')[0];
        return [iconOf(av), tx(qqa(r, '.wr-post-who b')[0]), tx(qqa(r, 'time')[0]),
          tx(qqa(r, '.wr-post-text')[0]), (pic && pic.getAttribute('src')) || '',
          tx(acts[0] && acts[0].querySelector('span')), tx(acts[1] && acts[1].querySelector('span')),
          tx(acts[2] && acts[2].querySelector('span'))].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
    } else if (type === 'qa') {
      opt.qaQuestion = tx(q('.wr-qa-title'));
      opt.qaAuthor = tx(q('.wr-qa-author b'));
      opt.qaBio = tx(q('.wr-qa-author small'));
      opt.qaAvatar = iconOf(q('.wr-qa-author .wr-media'));
      opt.qaText = q('.wr-qa-body') ? String(q('.wr-qa-body').textContent || '').trim() : '';
      opt.qaVote = tx(q('.wr-vote b'));
      opt.qaComments = tx(q('.wr-qa-comments')).replace(/[^\d].*$/, '');
      opt.qaTags = qa('.wr-tag').map(tx).join(', ');
    } else if (type === 'rating') {
      opt.title = tx(q('h2'));
      opt.ratingItems = qa('.wr-rating-item').map(function (r) {
        var cover = qqa(r, 'img, .wr-rating-ph')[0];
        return [tx(qqa(r, '.wr-rating-head b')[0]), tx(qqa(r, '.wr-rating-head span')[0]),
          tx(qqa(r, '.wr-rating-score strong')[0]), (cover && cover.tagName === 'IMG' ? cover.getAttribute('src') : ''),
          tx(qqa(r, 'p')[0])].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
    } else if (type === 'search') {
      var form = q('form');
      opt.title = tx(q('h2')); opt.desc = tx(q('.wr-search-desc'));
      opt.searchPlaceholder = form ? (form.querySelector('input') || {}).placeholder || '' : '';
      opt.searchBtn = form ? tx(form.querySelector('button')) : '';
      opt.searchAction = form ? (form.getAttribute('action') || '') : '';
      opt.searchSuggest = qa('.wr-tag').map(tx).join(', ');
    } else if (type === 'repo') {
      opt.repoOwner = tx(q('.wr-repo-owner')).replace(/\/\s*$/, '').trim();
      opt.repoName = tx(q('.wr-repo-top b'));
      opt.repoDesc = tx(q('.wr-repo-desc'));
      var st = qa('.wr-repo-stats > span');
      opt.repoStars = tx(st[0]).replace(/^[^\d]*/, '');
      opt.repoForks = tx(st[1]).replace(/^[^\d]*/, '');
      opt.repoIssues = tx(st[2]).replace(/^[^\d]*/, '');
      opt.repoLang = tx(q('.wr-repo-lang')).trim();
      opt.repoTopics = qa('.wr-repo-topic').map(tx).join(', ');
      opt.repoUpdated = tx(q('.wr-repo-foot')).replace(/^更新于\s*/, '').split(' · ')[0];
    } else if (type === 'wiki') {
      opt.title = tx(q('.wr-wiki-main h2') || q('.wr-wiki-info > b'));
      opt.wikiLead = tx(q('.wr-wiki-lead'));
      opt.wikiInfobox = qa('.wr-wiki-info div').map(function (r) {
        return tx(qqa(r, 'dt')[0]) + ' | ' + tx(qqa(r, 'dd')[0]);
      }).filter(function (s) { return s.indexOf('|') > 0; }).join('\n');
      opt.wikiToc = qa('.wr-wiki-toc a').map(tx).join('\n');
      opt.wikiBody = qa('.wr-wiki-main > p').slice(1).map(function (p0) { return tx(p0); }).join('\n\n');
    } else if (type === 'chat') {
      opt.chatServer = tx(q('.wr-chat-server')).replace(/^#\s*/, '');
      opt.chatChannel = tx(q('.wr-chat-channel')).replace(/^＃\s*/, '');
      opt.chatMembers = qa('.wr-chat-member').map(function (r) {
        return iconOf(qqa(r, '.wr-media')[0]) + ' | ' + tx(qqa(r, 'span')[0]);
      }).filter(function (s) { return s.indexOf('|') > 0; }).join('\n');
      opt.chatItems = qa('.wr-chat-msg').map(function (r) {
        return [iconOf(qqa(r, '.wr-media')[0]), tx(qqa(r, 'b')[0]), tx(qqa(r, 'time')[0]),
          tx(qqa(r, '.wr-chat-text')[0]), ''];
      }).filter(function (a) { return a.join('').trim(); }).map(function (a) { return a.join(' | '); }).join('\n');
    } else if (type === 'awards') {
      opt.title = tx(q('h2')); opt.awardDesc = tx(q('.wr-awards-desc'));
      opt.awardItems = qa('.wr-award').map(function (r) {
        var im = qqa(r, 'img')[0];
        return [(im && im.getAttribute('src')) || '', tx(qqa(r, 'h3')[0]),
          tx(qqa(r, '.wr-award-info span')[0]), tx(qqa(r, '.wr-award-info small')[0])].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
    } else if (type === 'marquee') {
      opt.marqueeText = tx(qa('.wr-marquee-track span')[0]);
      opt.marqueeDir = /is-right/.test(String(q('.wr-marquee') || el).className) ? 'right' : 'left';
      var dur = parseFloat(win.getComputedStyle(q('.wr-marquee-track') || el).animationDuration) || 24;
      opt.marqueeSpeed = Math.round(dur);
    } else if (type === 'logos') {
      // 合作品牌墙：一排小徽标，常被拍成「标题 + 一串文字」，认回来才能单独改
      var lgs = q('.wr-logos') || el;
      opt.logoItems = qa('.wr-logo-item').map(function (r) {
        var lim = r.querySelector('img');
        var label = lim ? (lim.getAttribute('src') || '') : tx(r);
        var lhref = r.tagName === 'A' ? (r.getAttribute('href') || '') : '';
        return [label, lhref].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
      opt.color = rgbToHex(win.getComputedStyle(lgs).color) || opt.color;
      var lgc = q('.wr-logo-item');
      if (lgc) opt.cardBg = impBg(lgc, win, 0.5) || '';
      if (!opt.logoItems) return null;
    } else if (type === 'brandwall') {
      var bw = q('.wr-brandwall') || el;
      opt.title = tx(q('h2'));
      opt.brandStyle = /is-marquee/.test(String(bw.className || '')) ? 'marquee' : 'grid';
      opt.brandItems = qa('.wr-brand-card').map(function (r) {
        var a = r.tagName === 'A' ? (r.getAttribute('href') || '') : '';
        return [iconOf(qqa(r, '.wr-brand-mark')[0]), a, tx(qqa(r, 'small')[0])].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
      var bwCols = (win.getComputedStyle(bw).gridTemplateColumns || '').split(/\s+/).filter(Boolean).length;
      if (bwCols >= 2) opt.brandCols = bwCols;
      var bwDur = parseFloat(win.getComputedStyle(q('.wr-brand-track') || bw).animationDuration) || 0;
      if (bwDur) opt.brandSpeed = Math.round(bwDur);
      var bwc = q('.wr-brand-card');
      if (bwc) opt.cardBg = impBg(bwc, win, 0.5) || '';
    } else if (type === 'brandrotor') {
      // 3D 环形品牌墙：卡片是绝对定位 + transform，按普通列表解析会整块丢掉
      var rr = q('.wr-brandrotor') || el;
      var rrs = win.getComputedStyle(rr);
      // 标题（「感谢与我们」这种）写在 section 里、转子容器外面，只问容器会丢
      opt.title = tx(q('h2')) || tx(qh('h2'));
      opt.rotShape = rr.getAttribute && rr.getAttribute('data-shape') === 'sphere' ? 'sphere' : 'ring';
      opt.rotPause = rr.getAttribute && rr.getAttribute('data-pause') === '0' ? '0' : '1';
      opt.rotSpeed = Math.round(clampNum(parseFloat(rrs.getPropertyValue('--wr-rot-dur')) || 30, 8, 90));
      opt.rotRadius = Math.round(clampNum(parseFloat(rrs.getPropertyValue('--wr-rot-radius')) || 260, 120, 480));
      opt.rotItems = qa('.wr-rot-item').map(function (r) {
        var im = r.querySelector('img');
        var label = im ? (im.getAttribute('src') || im.getAttribute('alt') || '') : tx(r.querySelector('.wr-rot-card span') || r);
        var href = r.tagName === 'A' ? (r.getAttribute('href') || '') : '';
        return [label, href].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
      var rc = q('.wr-rot-card');
      if (rc) opt.rotCardBg = impBg(rc, win, 0.5) || '#ffffff';
      if (!opt.rotItems) return null;
    } else if (type === 'futype') {
      var ft = q('.wr-futype') || el;
      opt.futypeText = qa('.wr-futype-line').map(tx).join('\n');
      opt.futypeSub = tx(q('.wr-futype-sub'));
      opt.futypeStyle = ft.getAttribute && ft.getAttribute('data-style') || 'neon';
      opt.futypeSize = Math.round(clampNum(parseFloat(win.getComputedStyle(q('.wr-futype-line') || ft).fontSize), 36, 140));
    } else if (type === 'geometry') {
      var gs = q('.wr-geometry') || el;
      opt.title = tx(q('h2'));
      var kindBack = { circle: '圆', square: '方', triangle: '三角', hexagon: '六边形', ring: '环', drop: '水滴' };
      opt.shapeItems = qa('.wr-shape').map(function (n) {
        var k = kindBack[n.getAttribute && n.getAttribute('data-kind') || 'circle'] || '圆';
        var fill = rgbToHex(win.getComputedStyle(n.querySelector('i') || n).backgroundColor, 0.4) || '';
        return k + ' | ' + fill;
      }).filter(function (s) { return s.indexOf('|') > 0; }).join('\n');
      opt.shapeSize = Math.round(clampNum(parseFloat(win.getComputedStyle(gs).getPropertyValue('--wr-shape-size')) || 150, 60, 240));
      opt.shapeSpeed = Math.round(clampNum(parseFloat(win.getComputedStyle(gs).getPropertyValue('--wr-shape-dur')) || 12, 4, 24));
    } else if (type === 'kinetic') {
      var kn = q('.wr-kinetic') || el;
      opt.kineticStyle = kn.getAttribute && kn.getAttribute('data-style') || 'orbit';
      opt.kineticText = qa('.wr-kinetic-title span').map(tx).join('\n') || tx(qa('.wr-kticker span')[0]).replace(/·\s*$/, '').trim();
      opt.kineticSpeed = Math.round(clampNum(parseFloat(win.getComputedStyle(kn).getPropertyValue('--wr-kin-dur')) || 12, 4, 30));
    } else if (type === 'hires') {
      var hi = q('.wr-hires') || el;
      var im = q('.wr-hires img');
      opt.hiSrc = im ? (im.getAttribute('src') || '') : '';
      opt.hiAlt = im ? (im.getAttribute('alt') || '') : '';
      var ar = win.getComputedStyle(q('.wr-hires-frame') || hi).aspectRatio || '16 / 9';
      opt.hiRatio = /21/.test(ar) ? 'pano' : (/1\s*\/\s*1/.test(ar) ? 'square' : (/3\s*\/\s*4/.test(ar) ? 'portrait' : 'wide'));
      opt.hiHeight = Math.round(clampNum(parseFloat(win.getComputedStyle(q('.wr-hires-frame') || hi).maxHeight) || 520, 220, 900));
      opt.hiCaption = tx(q('.wr-hires figcaption'));
      opt.hiOverlay = q('.wr-hires-shade') ? '1' : '0';
    } else if (type === 'object3d') {
      var ob = q('.wr-object3d') || el;
      opt.objShape = ob.getAttribute && ob.getAttribute('data-shape') || 'cube';
      opt.objLabel = tx(q('.wr-obj-label'));
      var obs = win.getComputedStyle(ob);
      opt.objSize = Math.round(clampNum(parseFloat(obs.getPropertyValue('--wr-obj-size')) || 220, 100, 360));
      opt.objSpeed = Math.round(clampNum(parseFloat(obs.getPropertyValue('--wr-obj-dur')) || 12, 4, 30));
      opt.objColor1 = toHexColor(obs.getPropertyValue('--wr-obj-c1').trim() || '#3b82f6');
      opt.objColor2 = toHexColor(obs.getPropertyValue('--wr-obj-c2').trim() || '#8b5cf6');
      opt.objTilt = ob.getAttribute && ob.getAttribute('data-tilt') === '1' ? '1' : '0';
    } else if (type === 'profilecard') {
      var pc = q('.wr-profilecard') || el;
      var nameEl = q('.wr-pc-name');
      opt.cardName = nameEl ? tx(nameEl).replace(/✓\s*$/, '').trim() : '';
      opt.cardRole = tx(q('.wr-pc-role'));
      opt.cardBio = q('.wr-pc-bio') ? String(q('.wr-pc-bio').textContent || '').trim() : '';
      var pcAv = q('.wr-pc-avatar');
      opt.cardAvatar = pcAv && pcAv.querySelector('img') ? (pcAv.querySelector('img').getAttribute('src') || '') : '';
      opt.cardLinks = qa('.wr-pc-links a').map(function (a) {
        return tx(a) + ' | ' + (a.getAttribute('href') || '');
      }).filter(function (s) { return s.indexOf('|') > 0; }).join('\n');
      opt.cardVerified = q('.wr-pc-verified') ? '1' : '0';
      opt.cardLayout = /is-left/.test(String(pc.className || '')) ? 'left' : 'center';
      var pcb = impBg(pc, win, 0.5); if (pcb) opt.cardBg = pcb;
    } else if (type === 'skillbar') {
      opt.skillTitle = tx(q('.wr-skillbar h2'));
      opt.skillItems = qa('.wr-skill').map(function (r) {
        return tx(qqa(r, '.wr-skill-top b')[0]) + ' | ' + tx(qqa(r, '.wr-skill-top span')[0]).replace(/%$/, '');
      }).filter(function (s) { return s.indexOf('|') > 0; }).join('\n');
      var sb = q('.wr-skillbar');
      opt.skillAnimate = sb && sb.getAttribute('data-animate') === '1' ? '1' : '0';
      var bar = q('.wr-skill-track i');
      if (bar) { opt.skillColor = toHexColor(win.getComputedStyle(bar).backgroundColor) || '#6d5efc'; }
      var track = q('.wr-skill-track');
      if (track) { opt.skillTrack = toHexColor(win.getComputedStyle(track).backgroundColor) || '#e8ecf5'; }
    } else if (type === 'journey') {
      opt.tlTitle = tx(q('.wr-journey h2'));
      opt.tlItems = qa('.wr-jy-item').map(function (r) {
        return [tx(qqa(r, '.wr-jy-year')[0]), tx(qqa(r, '.wr-jy-body h3')[0]),
          qqa(r, '.wr-jy-body p')[0] ? String(qqa(r, '.wr-jy-body p')[0].textContent || '').trim() : ''].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
      var dot = q('.wr-jy-dot');
      if (dot) opt.tlDotColor = toHexColor(win.getComputedStyle(dot).backgroundColor) || '#6d5efc';
      var listEl = q('.wr-jy-list');
      if (listEl) { var lc = win.getComputedStyle(listEl, '::before').backgroundColor; if (lc) opt.tlLineColor = toHexColor(lc) || '#dfe6f5'; }
    } else if (type === 'linkhub') {
      opt.linkTitle = tx(q('.wr-linkhub h2'));
      opt.linkBio = tx(q('.wr-lh-bio'));
      opt.linkItems = qa('.wr-lh-btn').map(function (a) {
        return [tx(qqa(a, 'span:nth-of-type(2)')[0] || a.querySelector('span')), a.getAttribute('href') || '',
          tx(qqa(a, '.wr-lh-ico')[0])].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
      var lh = q('.wr-linkhub');
      opt.linkShape = /is-round/.test(String(lh && lh.className || '')) ? 'round' : 'pill';
      var lbtn = q('.wr-lh-btn');
      if (lbtn) {
        var lbs = win.getComputedStyle(lbtn);
        opt.linkBtnBg = toHexColor(lbs.backgroundColor) || '#ffffff';
        opt.linkBtnColor = toHexColor(lbs.color) || '#1f2a44';
      }
      var lhav = q('.wr-lh-avatar img');
      if (lhav) opt.cardAvatar = lhav.getAttribute('src') || '';
    } else if (type === 'tagcloud') {
      opt.tagTitle = tx(q('.wr-tagcloud h2'));
      var tc = q('.wr-tagcloud');
      opt.tagStyle = /is-card/.test(String(tc && tc.className || '')) ? 'card' : 'pill';
      opt.tagSpread = /is-center/.test(String(tc && tc.className || '')) ? 'center' : 'wrap';
      opt.tagItems = qa('.wr-tag-i').map(function (n) {
        var m = /w([1-5])/.exec(String(n.className || ''));
        var w = m ? m[1] : '3';
        var col = rgbToHex(win.getComputedStyle(n).color, 0.5) || '';
        return tx(n) + ' | ' + w + (col ? ' | ' + col : '');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
    } else if (type === 'statboard') {
      opt.statTitle = tx(q('.wr-statboard h2'));
      var sbd = q('.wr-statboard');
      opt.statDivider = /has-divider/.test(String(sbd && sbd.className || '')) ? '1' : '0';
      var statsEl = q('.wr-stats');
      if (statsEl) {
        var colsN = (win.getComputedStyle(statsEl).gridTemplateColumns || '').split(/\s+/).filter(Boolean).length;
        if (colsN >= 2) opt.statCols = colsN;
      }
      var strong = q('.wr-stat strong');
      if (strong) opt.statAccent = toHexColor(win.getComputedStyle(strong).color) || '#6d5efc';
      opt.statItems = qa('.wr-stat').map(function (r) {
        var st = qqa(r, 'strong')[0];
        var em = st && st.querySelector('em');
        return [st ? String(st.textContent || '').replace(String(em ? em.textContent : ''), '').trim() : '',
          em ? tx(em) : '', tx(qqa(r, 'span')[0])].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
    } else if (type === 'polaroid') {
      opt.polarTitle = tx(q('.wr-polaroid h2'));
      var pld = q('.wr-polaroid');
      var polarsEl = q('.wr-polars');
      if (polarsEl) {
        var pcols = (win.getComputedStyle(polarsEl).gridTemplateColumns || '').split(/\s+/).filter(Boolean).length;
        if (pcols >= 2) opt.polarCols = pcols;
      }
      var firstPolar = q('.wr-polar');
      opt.polarTilt = firstPolar && win.getComputedStyle(firstPolar).getPropertyValue('--wr-ang').trim() ? '1' : '0';
      opt.polarItems = qa('.wr-polar').map(function (f) {
        var im = f.querySelector('img');
        var ang = win.getComputedStyle(f).getPropertyValue('--wr-ang').trim();
        return [(im && im.getAttribute('src')) || '', tx(qqa(f, 'figcaption')[0]), ang.replace('deg', '') || '0'].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
    } else if (type === 'colorswitch') {
      var cw = q('.wr-colorswitch') || el;
      opt.swLabel = tx(q('.wr-sw-title'));
      var cwAlign = /center/.test(win.getComputedStyle(cw).textAlign) ? 'center'
        : (/right|end/.test(win.getComputedStyle(cw).textAlign) ? 'right' : 'left');
      opt.swAlign = cwAlign;
      var dotsEls = qa('.wr-sw-dot');
      var nameEls = qa('.wr-sw-names span');
      var dotSize = dotsEls[0] ? parseFloat(win.getComputedStyle(dotsEls[0]).width) : 0;
      if (dotSize) opt.swSize = Math.round(clampNum(dotSize, 20, 56));
      opt.swShape = dotsEls[0] && /square/.test(String(dotsEls[0].className || '')) ? 'square' : 'round';
      opt.swShowName = nameEls.length ? '1' : '0';
      opt.swColors = dotsEls.map(function (d, i) {
        var col = d.getAttribute('data-wr-color') || d.title || '#3b82f6';
        return col + ' | ' + (nameEls[i] ? tx(nameEls[i]) : (d.title || col));
      }).filter(function (s) { return s.indexOf('|') > 0; }).join('\n');
      opt.cardBg = impBg(cw, win, 0.5) || '#ffffff';
    } else if (type === 'darkmode') {
      var dmt = q('[data-wr-darkmode]');
      var dmText = dmt ? (dmt.querySelector('[data-on],[data-off]') || dmt) : null;
      opt.dmLabelOff = dmText ? (dmText.getAttribute('data-off') || tx(dmText)) : '🌙 深色';
      opt.dmLabelOn = dmText ? (dmText.getAttribute('data-on') || '') : '☀️ 浅色';
      opt.dmStyle = q('.wr-dm-btn') ? 'button' : 'toggle';
      var dsec = el.tagName === 'SECTION' ? el : (el.closest ? el.closest('section') : null);
      if (dsec) {
        var dcs = win.getComputedStyle(dsec);
        var b1 = dcs.getPropertyValue('--wr-dark-bg').trim(), t1 = dcs.getPropertyValue('--wr-dark-text').trim(), c1 = dcs.getPropertyValue('--wr-dark-card').trim();
        if (b1) opt.dmDarkBg = toHexColor(b1);
        if (t1) opt.dmDarkText = toHexColor(t1);
        if (c1) opt.dmDarkCard = toHexColor(c1);
      }
    } else if (type === 'fontsizer') {
      var fsEl = q('.wr-fontsizer') || el;
      opt.fsLabel = tx(q('.wr-fs-title'));
      opt.fsMin = Math.round(clampNum(parseFloat(fsEl.getAttribute && fsEl.getAttribute('data-min')) || 80, 50, 100));
      opt.fsMax = Math.round(clampNum(parseFloat(fsEl.getAttribute && fsEl.getAttribute('data-max')) || 130, 100, 180));
      opt.fsStep = Math.round(clampNum(parseFloat(fsEl.getAttribute && fsEl.getAttribute('data-step')) || 10, 5, 25));
      opt.fsShowValue = q('.wr-fs-value') ? '1' : '0';
      opt.cardBg = impBg(fsEl, win, 0.5) || '#ffffff';
    } else if (type === 'themepicker') {
      var tpk = q('.wr-themepicker') || el;
      opt.tpLabel = tx(q('.wr-tp-title'));
      opt.tpStyle = /is-swatch/.test(String(tpk.className || '')) ? 'swatch' : 'chip';
      opt.tpThemes = qa('.wr-tp-btn').map(function (b) {
        return [b.getAttribute('data-wr-theme') || '', b.getAttribute('data-accent') || '',
          b.getAttribute('data-bg') || '', b.getAttribute('data-text') || ''].join(' | ');
      }).filter(function (s) { return s.replace(/[|\s]/g, ''); }).join('\n');
      opt.cardBg = impBg(tpk, win, 0.5) || '#ffffff';
    }
    // 组件底色 / 圆角：导出页把样式写在 section 上，容器自己往往是透明的，
    // 所以容器取不到就往外层找 —— 渐变色块（futype / brandrotor）全靠这一步。
    var s = win.getComputedStyle(el);
    var bg = impBg(el, win, 0.5) || (hostEl !== el ? impBg(hostEl, win, 0.5) : '');
    if (bg) opt.bg = bg;
    // 深色开关 / 字号调节这类是「浮在页面上的控件」，原页面本来就没有底色；
    // 留着组件默认的浅灰底，导出后会多出一条横条。
    else if (type === 'darkmode' || type === 'fontsizer') opt.bg = 'transparent';
    var rad = Math.round(clampNum(parseFloat(s.borderRadius) || (hostEl !== el ? parseFloat(hs0.borderRadius) : 0), 0, 48));
    if (rad) opt.radius = rad;
    return makeImp(type, opt);
  }

  /* 「文章列表」：一排 .wr-post（封面 + 标题 + 日期 + 摘要 + 链接）。
     通用卡片流程会把它拍成「图标 + 标题 + 说明」的网格 —— 封面缩成小图标、
     日期黏进正文、链接丢失。认出原组件，这些字段才能各归各位。 */
  function impPostsOf(el, win) {
    if (!el || !el.children) return null;
    var hostEl = el;
    if (!/(?:^|\s)wr-posts(?:\s|$)/.test(String(el.className || ''))) {
      var inner = el.querySelector ? el.querySelector('.wr-posts') : null;
      if (!inner || inner.parentElement !== el) return null;
      // 外层还有标题 / 说明等别的东西就别整块吞掉
      if (impBlockKids(el, win).length > 1) return null;
      el = inner;
    }
    var cards = Array.prototype.slice.call(el.children).filter(function (c) {
      var cc = String(c.className || '');
      if (!/(?:^|\s)wr-post(?:\s|$)/.test(cc)) return false;
      return !/wr-post-(body|img|date|text|act|who|media|nocover)/.test(cc);
    });
    if (cards.length < 2) return null;
    var rows = [], imgH = 0, cardBg = '', cardInk = '', cardRad = 0;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var im = c.querySelector('img');
      var src = im ? (im.getAttribute('src') || im.currentSrc || '') : '';
      var titleEl = c.querySelector('h1,h2,h3,h4,.wr-post-title');
      var dateEl = c.querySelector('.wr-post-date,time');
      var descEl = c.querySelector('p,.wr-post-excerpt,.wr-post-desc');
      var linkEl = (titleEl && titleEl.querySelector('a')) || c.querySelector('a[href]');
      var title = titleEl ? impText(titleEl).replace(/\n/g, ' ').trim() : '';
      if (!title) return null;
      var date = dateEl ? impText(dateEl).replace(/\n/g, ' ').trim() : '';
      var desc = descEl ? impText(descEl).replace(/\n/g, ' ').trim() : '';
      // 摘要把日期剔掉：日期有独立字段，别在正文里再说一遍
      if (date && desc.indexOf(date) === 0) desc = desc.slice(date.length).trim();
      var cs0 = win.getComputedStyle(c);
      if (im) {
        var ih = im.getBoundingClientRect().height;
        if (ih > 40) imgH = Math.max(imgH, Math.round(ih));
      }
      if (!cardBg) cardBg = impBg(c, win, 0.35);
      if (!cardInk) cardInk = rgbToHex(cs0.color) || '';
      if (!cardRad) cardRad = Math.round(clampNum(parseFloat(cs0.borderTopLeftRadius) || 0, 0, 40));
      rows.push([src.replace(/\|/g, '%7C'), title.replace(/\|/g, '/').slice(0, 60),
        date.replace(/\|/g, '/').slice(0, 24), desc.replace(/\|/g, '/').slice(0, 120),
        (linkEl && linkEl.getAttribute('href')) || ''].join(' | '));
    }
    var cs = win.getComputedStyle(el);
    var tpl = String(cs.gridTemplateColumns || '');
    var cols = tpl.split(/\s+/).filter(function (v) { return /px|%|fr|em|rem|vw/.test(v); }).length;
    if (!cols) cols = Math.min(cards.length, 3);
    var pad = impPadOf(el, win);
    return makeImp('posts', {
      title: '', postItems: rows.join('\n'), postCols: String(Math.min(Math.max(cols, 1), 4)),
      postCardBg: cardBg || '#ffffff', postImgH: imgH || 160,
      radius: cardRad || 14, color: cardInk || '',
      align: /center/.test(cs.textAlign) ? 'center' : 'left',
      padY: pad.padY, padX: pad.padX,
      bg: impBg(el, win, 0.5) || (hostEl !== el ? impBg(hostEl, win, 0.5) : '') || ''
    });
  }

  /* 容器类：主视觉 → 递归子节点 → 需要时包一层容器 */
  function impMapGeneric(el, win, ctx) {
    var s = win.getComputedStyle(el);
    var align = /center/.test(s.textAlign) ? 'center' : (/right|end/.test(s.textAlign) ? 'right' : 'left');
    var color = impTextColor(el, win) || '';
    var bg = impBg(el, win, 0.5);
    var padY = Math.round(clampNum((parseFloat(s.paddingTop) + parseFloat(s.paddingBottom)) / 2, 0, 120));
    var padX = Math.round(clampNum(parseFloat(s.paddingLeft), 0, 80));
    var radius = Math.round(clampNum(parseFloat(s.borderRadius), 0, 40));
    var kids = impBlockKids(el, win);

    // 这几类在通用流程里会被拍成「一串文字」，先按语义单独认
    if (ctx.depth < 6) {
      try {
        var sb = impSiteBlock(el, win);
        if (sb) { ctx.used++; return [sb]; }
        var cb2 = impCodeBlock(el, win);
        if (cb2) { ctx.used++; return [cb2]; }
        var fsb = impFeatures(el, win);
        if (fsb) { ctx.used++; return [fsb]; }
        var fqb = impFaq(el, win);
        if (fqb) { ctx.used++; return [fqb]; }
        var ab = impAnnounce(el, win);
        if (ab) { ctx.used++; return [ab]; }
        var nc = impNotice(el, win);
        if (nc) { ctx.used++; return [nc]; }
        var fb = impFormBlock(el, win);
        if (fb) { ctx.used++; return [fb]; }
        var cb0 = impContactRow(el, win);
        if (cb0) { ctx.used++; return [cb0]; }
        var pb = impProgress(el, win);
        if (pb) { ctx.used++; return [pb]; }
        var crb = impCrumbBlock(el, win);
        if (crb) { ctx.used++; return [crb]; }
      } catch (e0) { try { console.warn('import special skip', e0); } catch (e1) { } }
    }

    // 叶子节点：只剩图片就按图片导入（<div class="fig"><img></div> 以前整块丢掉）
    if (!kids.length) {
      var imgs = Array.prototype.slice.call(el.querySelectorAll('img')).filter(function (im) { return impShown(im, win); });
      var t = impText(el);
      if (imgs.length && t.replace(/\s/g, '').length < 2) {
        var picOut = [];
        imgs.slice(0, 4).forEach(function (im) { picOut = picOut.concat(impMap(im, win, ctx)); });
        if (picOut.length) return picOut;
      }
      if (t.length < 2) {
        // 没文字的叶子节点：可能是分隔细线，别直接丢掉
        var dv = impDivider(el, win);
        if (dv) { ctx.used++; return [dv]; }
        return [];
      }
      ctx.used++;
      return [makeImp('text', {
        text: t.slice(0, 1200), color: color, align: align,
        fontSize: Math.round(clampNum(parseFloat(s.fontSize), 11, 80)),
        padY: Math.min(padY, 40), padX: padX
      })];
    }
    if (!ctx.heroDone && /^(SECTION|DIV|ARTICLE|MAIN|HEADER|ASIDE)$/.test(el.tagName) && impLooksHero(el, win)) {
      var hb = impHeroBlock(el, win);
      if (hb) { ctx.heroDone = true; ctx.used++; return [hb]; }
    }
    // 文章列表先单独认：封面 / 日期 / 摘要 / 链接各有字段，不能被拍成通用卡片
    var postsB = impPostsOf(el, win);
    if (postsB) { ctx.used++; return [postsB]; }
    // 一组「图标 + 标题 + 说明」的兄弟块 → 三栏卡片（否则会被拆成一段段零散文字）
    var cardRow = impCardRows(kids, win, s);
    if (cardRow) { ctx.used++; return [cardRow]; }
    // 每列只递归一次：先拿到每个原始子元素对应的模块，后面按列打包
    var perKid = kids.map(function (c) {
      try { return impMap(c, win, ctx); }
      catch (e) { try { console.warn('import skip', c, e); } catch (e2) { } return []; }
    });
    var inner = [];
    perKid.forEach(function (one) { inner = inner.concat(one); });
    if (!inner.length) return [];

    // 原页面是一行多列（grid 或 flex row）就按「原列」还原。
    // 关键是按列打包：直接按模块数分栏，会把某列内部的标题 / 段落摊到相邻列去。
    var tpl = String(s.gridTemplateColumns || '').trim();
    var nCol = 0;
    if (/grid/.test(s.display) && tpl && tpl !== 'none') {
      nCol = tpl.split(/\s+/).filter(function (v) { return /px|%|fr|em|rem|vw/.test(v); }).length;
    } else if (/flex/.test(s.display) && /row/.test(s.flexDirection)) {
      nCol = kids.length;
    }
    if (nCol >= 2 && kids.length >= 2 && kids.length <= Math.max(nCol, 2)) {
      var colsArr = [];
      perKid.forEach(function (one) {
        if (!one.length) return;
        if (one.length === 1) { colsArr.push(impDewrap(one[0])); return; }
        var wcol = makeImp('container', {
          bg: '', color: color || '#16233a', lineColor: '',
          layout: 'stack', padY: 0, padX: 0, title: '', align: align
        });
        wcol.children = one.map(impDewrap);
        colsArr.push(wcol);
      });
      if (colsArr.length >= 2) {
        var rowBox = makeImp('container', {
          bg: bg || '', color: color || '#16233a', lineColor: '',
          layout: 'row', cols: Math.min(colsArr.length, 4),
          gap: Math.round(clampNum(parseFloat(s.columnGap) || parseFloat(s.gap) || 14, 0, 48)),
          padY: 0, padX: Math.min(padX, 80), radius: radius, align: align, title: ''
        });
        rowBox.children = colsArr;
        ctx.used++;
        return [rowBox];
      }
      if (colsArr.length === 1) return [colsArr[0]];
    }

    // 只有「真有视觉外框」的才包容器，否则一层层 div 会套出满地缩进
    var styleBox = (!!bg && bg !== '#ffffff') || padY >= 60 || (padX >= 40 && padY >= 32 && inner.length >= 2);
    // 外层有实底色 / 圆角，里层自己也带底色：这是「卡片里嵌一条横幅」的两层视觉。
    // 合并会把外层的圆角和留白串到里层上（通栏公告条会变成一枚圆角胶囊），必须保留外层。
    var layerClash = !!bg && bg.toLowerCase() !== '#ffffff' && !!(inner[0] && inner[0].p && inner[0].p.bg);
    // 单子元素、无底色、无多列、padding 不大 = 纯包装层，直接穿透
    if (inner.length === 1 && !styleBox) {
      var pass = inner[0];
      // 外层那圈底色也是包装层的一部分：白底 section 里放一列卡片，
      // 卡片区的底该是白的，不能退回组件默认的浅灰。
      if (pass && pass.p && bg && !pass.p.bg && !/^(navbar|footer|hero|film)$/.test(pass.type)) pass.p.bg = bg;
      // 包装层的留白是「套在外面的」，要加到子模块上（取最大值会吃掉内层那圈）
      if (pass && pass.p && padX >= 12 && !/^(navbar|footer)$/.test(pass.type)) {
        pass.p.padX = Math.min((Number(pass.p.padX) || 0) + Math.min(padX, 80), 120);
      }
      // 纵向同理。媒体块（视频/图片）自己已经算过外层留白，动了就会重复，这里只补空缺
      if (pass && pass.p && padY >= 8 && /^(film|image|video)$/.test(pass.type)) {
        if (!(Number(pass.p.padY) || 0)) pass.p.padY = Math.min(padY, 60);
      } else if (pass && pass.p && padY >= 4 && !/^(navbar|footer)$/.test(pass.type)) {
        pass.p.padY = Math.min((Number(pass.p.padY) || 0) + Math.min(padY, 120), 160);
      }
      return inner;
    }
    // 只有一个子模块时不要套壳：把外层的留白 / 底色交给它，否则层级会虚高
    if (inner.length === 1 && styleBox && !layerClash && ctx.depth < 4) {
      var only = inner[0];
      if (only && only.p && !isNavType(only.type) && only.type !== 'footer') {
        // 留白是「叠」上去的：原页面是 外层section(24) 套 内层section(24)，内容离边 48px。
        // 合并成一块后必须相加，取最大值会把内层那圈留白吃掉，元素整体往边上贴
        only.p.padY = Math.min((Number(only.p.padY) || 0) + Math.min(padY, 120), 160);
        if (padX >= 12) only.p.padX = Math.min((Number(only.p.padX) || 0) + Math.min(padX, 80), 120);
        if (bg && bg.toLowerCase() !== '#ffffff' && !only.p.bg && only.type !== 'film') only.p.bg = bg;
        if (radius && !only.p.radius) only.p.radius = radius;
        ctx.used++;
        return [only];
      }
    }
    if (styleBox && ctx.depth < 4) {
      ctx.depth++;
      var cb = makeImp('container', {
        // 原页面没有边框 / 底色就别硬塞（容器的默认值是给示例用的）
        bg: bg || '',
        color: color || '#16233a',
        lineColor: '',
        layout: 'stack', cols: 3, gap: 14,
        padY: Math.max(20, padY), padX: Math.max(16, padX),
        radius: radius,
        align: align, title: ''
      });
      cb.children = inner;
      ctx.depth--;
      ctx.used++;
      return [cb];
    }
    return inner;
  }

  /* 扫一遍渲染好的文档 → blocks + 页面级配色 */
  function impScan(doc, win, stats) {
    var ctx = { depth: 0, heroDone: false, used: 0, stats: stats };
    var body = doc.body;
    var blocks = [];
    // 顺序很重要：先认出开场层（它是 fixed 全屏，解冻之后反而糊住整页），再解冻入场动画
    var intro = null;
    try { intro = impFindIntro(doc, win); } catch (e) { }
    try { stats.thawed = impThaw(doc, win); } catch (e) { }
    try { stats.scripts = doc.querySelectorAll('script').length; } catch (e) { }
    try { stats.textLen = (body.innerText || '').replace(/\s+/g, '').length; } catch (e) { }
    stats.intro = intro || null;
    // 先扫一遍原页面里按钮/强调块的底色，作为「主题强调色」的候选
    var accents = [];
    Array.prototype.slice.call(doc.querySelectorAll('a[href],button,[class*=btn],[class*=button],[class*=cta]')).slice(0, 16).forEach(function (a) {
      var aS = win.getComputedStyle(a);
      var bgc = rgbToHex(aS.backgroundColor, 0.6);
      if (!bgc) {
        // 渐变按钮：拿第一个色标当强调色，至少色系对得上
        var g0 = impGradList(aS.backgroundImage)[0];
        if (g0) bgc = toHexColor(g0);
      }
      if (bgc && accents.indexOf(bgc) < 0) accents.push(bgc);
    });
    /* 本站导出的页把正文放在 <main class="wr-page"> 里，body 只负责页面底色。
       从 body 起扫会把整页拍成「一个大容器套所有模块」，宽度 / 留白全被外层吃掉；
       有 .wr-page 就从它的子节点起算，模块层级才和原来一致。 */
    var root = doc.querySelector('main.wr-page') || body;
    impBlockKids(root, win).forEach(function (c) {
      // 一个模块解析崩了不能拖垮整页：跳过它，其余照常导入
      try {
        blocks = blocks.concat(impMap(c, win, ctx));
      } catch (e) {
        try { console.warn('import skip', c, e); } catch (e2) { }
        try { stats.failed = (stats.failed || 0) + 1; } catch (e3) { }
      }
    });
    // 顶层如果是几个同名容器套着同一段，合并成一个（很多站点喜欢套三层 wrapper）
    var page = {};
    var bs = win.getComputedStyle(body);
    page.bg = impBg(body, win, 0.5) || '';
    page.text = rgbToHex(bs.color) || '';
    var title = String(doc.title || '').replace(/\s+/g, ' ').trim();
    if (title) page.name = title.slice(0, 60);
    // 标签页图标：原页面已经有 ico（多半是内嵌的 data URI），就照原样带走；
    // 不读的话导入后会自动生成一个「首字」图标，和原站对不上。
    try {
      var icoLink = doc.querySelector('link[rel~="icon"],link[rel="apple-touch-icon"]');
      var icoHref = icoLink ? String(icoLink.getAttribute('href') || '').trim() : '';
      if (/^data:image\//i.test(icoHref) && icoHref.length < 700000) {
        page.favicon = icoHref; page.faviconMode = 'custom';
      } else if (/^https?:\/\//i.test(icoHref) && icoHref.length < 400) {
        page.favicon = icoHref; page.faviconMode = 'custom';
      }
    } catch (eIco) { }
    try {
      var md = doc.querySelector('meta[name="description"]');
      var mdTx = md ? String(md.getAttribute('content') || '').replace(/\s+/g, ' ').trim() : '';
      if (mdTx && mdTx.length <= 200 && !page.description) page.description = mdTx;
    } catch (eMd) { }
    // 主色：先看原页面按钮的底色（有饱和度的才算），没有再退回模块里的 btnBg
    function saturated(hex) {
      if (!hex) return false;
      var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), bl = parseInt(hex.slice(5, 7), 16);
      return Math.max(r, g, bl) - Math.min(r, g, bl) > 24 && (r + g + bl) < 720;
    }
    var accent = '';
    for (var ai = 0; ai < accents.length && !accent; ai++) {
      if (saturated(accents[ai])) accent = accents[ai];
    }
    if (!accent) {
      (function pick(list) {
        list.some(function (b) {
          var hex = b.p && b.p.btnBg ? rgbToHex(b.p.btnBg, 0.6) : '';
          if (saturated(hex)) { accent = hex; return true; }
          if (b.children && b.children.length) return pick(b.children);
          return false;
        });
      })(blocks);
    }
    if (accent) page.accent = accent;
    stats.used = ctx.used;
    try {
      var links = doc.querySelectorAll('link[rel~="stylesheet"]');
      var inline = doc.querySelectorAll('style');
      if (links.length && !inline.length) stats.extCss = links.length;
    } catch (e) { }
    if (intro) page.intro = intro;
    // 底部那条「滑动鼠标 / 向下滚动」提示：导入时整块丢掉，导出后首屏底部就空了
    try {
      var hintEl = doc.querySelector('.wr-scrollhint,[class*=scrollhint],[class*=scroll-hint],[class*=scrolltip],[class*=scroll-tip]');
      if (!hintEl) {
        var cand = doc.querySelectorAll('body a,body span,body div');
        for (var hi = 0; hi < cand.length && hi < 500; hi++) {
          var hc = cand[hi];
          var hs = win.getComputedStyle(hc);
          if (hs.position !== 'fixed' && hs.position !== 'absolute') continue;
          var ht0 = (hc.textContent || '').replace(/\s+/g, '');
          if (!ht0 || ht0.length > 14) continue;
          if (!/滑动|滚动|向下|下滑|scroll/i.test(ht0)) continue;
          if (hc.getBoundingClientRect().top < (win.innerHeight || 800) * 0.5) continue;
          hintEl = hc; break;
        }
      }
      if (hintEl) {
        var htxt = (hintEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20) || '滑动鼠标';
        var hcls = String(hintEl.className || '') + htxt;
        page.hint = {
          style: /arrow|down|↓|箭头/i.test(hcls) ? 'arrow' : 'mouse',
          text: htxt,
          color: rgbToHex(win.getComputedStyle(hintEl).color) || ''
        };
      }
    } catch (e) { }
    return { blocks: blocks, page: page };
  }

  function countTypes(blocks, out) {
    out = out || {};
    (blocks || []).forEach(function (b) {
      var label = (ASSET_MAP[b.type] && ASSET_MAP[b.type].label) || b.type;
      out[label] = (out[label] || 0) + 1;
      if (b.children && b.children.length) countTypes(b.children, out);
    });
    return out;
  }

  /* 导出页里内嵌的工程快照。有它就不该再猜：颜色 / 渐变 / 宽度 / 主题 / 组件类型全在 JSON 里。
     手工改过 HTML（删了几个 section）时快照会过期，这种情况退回结构解析。 */
  function impModelOf(html) {
    var m = /<script[^>]*id=["']wr-model["'][^>]*>([\s\S]*?)<\/script>/i.exec(String(html || ''));
    if (!m) return null;
    var txt = String(m[1] || '').replace(/^\s+|\s+$/g, '');
    if (!txt) return null;
    var data = null;
    try { data = JSON.parse(txt); } catch (e) { return null; }
    if (!data || !Array.isArray(data.blocks) || !data.blocks.length) return null;
    // 页面上的 <section data-wr-id> 数量要和快照里一致，否则说明页面被改过
    var domCount = (String(html).match(/<section[^>]*data-wr-id="/gi) || []).length;
    var modelCount = countBlocks(data.blocks);
    if (domCount && modelCount !== domCount) {
      try { console.warn('wr-model 与页面结构不一致（' + modelCount + ' vs ' + domCount + '），改用结构解析'); } catch (e2) { }
      return null;
    }
    return data;
  }

  function impModelPending(model, fileName) {
    var clean = null;
    try {
      clean = sanitizeProject({
        name: typeof model.name === 'string' ? model.name : '',
        page: model.page && typeof model.page === 'object' ? model.page : {},
        blocks: model.blocks, assets: [], components: []
      });
    } catch (e) { clean = null; }
    if (!clean || !clean.blocks.length) return false;
    // 重新发 ID：导入到的项目里可能已经有一模一样的 ID（尤其是原地再导入一次）
    var map = {}, all = [];
    (function walk(list) {
      (list || []).forEach(function (b) {
        var old = b.id;
        b.id = uid();
        if (old) map[old] = b.id;
        all.push(b);
        if (b.children && b.children.length) walk(b.children);
      });
    })(clean.blocks);
    (function fix(list) {
      (list || []).forEach(function (b) {
        if (b.p && b.p.layerMode === 'overlay' && b.p.layerTarget && map[b.p.layerTarget]) {
          b.p.layerTarget = map[b.p.layerTarget];
        }
        if (b.children && b.children.length) fix(b.children);
      });
    })(clean.blocks);
    var dataImgs = 0, remoteImgs = 0;
    all.forEach(function (b) {
      Object.keys(b.p || {}).forEach(function (k) {
        var v = b.p[k];
        if (typeof v !== 'string' || v.length < 24) return;
        if (/^data:image\//i.test(v)) dataImgs++;
        else if (/^https?:\/\/[^\s]+\.(png|jpe?g|gif|webp|svg|avif)/i.test(v)) remoteImgs++;
      });
    });
    impPending = {
      name: fileName || '未命名.html',
      blocks: clean.blocks,
      page: clean.page,
      pageName: clean.name,
      exact: true,
      stats: {
        dataImgs: dataImgs, remoteImgs: remoteImgs, localImgs: 0,
        skipped: 0, used: all.length, extCss: 0
      },
      total: all.length
    };
    clearTimeout(toastTimer);
    $('#toast').classList.remove('show');
    showImportModal();
    return true;
  }

  /* 渲染 + 解析：先摆一个隐藏 iframe，150ms 后读结构 */
  function importHtmlText(html, fileName) {
    if (!/<(body|div|section|main|p|h1|table)\b/i.test(html)) { toast('这个文件里没有可识别的网页结构', true); return; }
    // 本站导出的页面自带工程快照，直接还原（这是最准的一条路）
    var model = impModelOf(html);
    if (model && impModelPending(model, fileName)) return;
    toast('正在解析页面结构…');
    var frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-14000px;top:0;width:1280px;height:1100px;border:0;opacity:0;pointer-events:none';
    var settled = false;
    var finish = function () {
      if (settled) return;
      settled = true;
      var stats = { dataImgs: 0, remoteImgs: 0, localImgs: 0, skipped: 0, used: 0, extCss: 0 };
      var res = { blocks: [], page: {} };
      try {
        res = impScan(frame.contentDocument, frame.contentWindow, stats);
      } catch (err) {
        try { console.warn(err); } catch (e) { }
        try { window.__wrImpErr = String((err && err.stack) || err); } catch (e) { }
      }
      frame.remove();
      if (!res.blocks.length) { toast('没能从这个页面里认出可编辑的模块', true); return; }
      // 先把「只包着导航 / 页脚的壳」拍平再数：弹窗和 toast 的模块数才对得上画布
      var flatBlocks = impFlattenChrome(res.blocks);
      impPending = {
        name: fileName || '未命名.html', blocks: flatBlocks, page: res.page || {},
        stats: stats, total: countBlocks(flatBlocks)
      };
      showImportModal();
    };
    frame.addEventListener('load', function () { setTimeout(finish, 120); });
    frame.srcdoc = html;
    document.body.appendChild(frame);
    setTimeout(finish, 2600);   // 外链样式、大图卡住时也别一直转
  }

  function showImportModal() {
    var st = impPending;
    if (!st) return;
    var types = countTypes(st.blocks, {});
    var chips = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; })
      .map(function (k) { return '<span class="imp-chip">' + esc(k) + '<i>' + types[k] + '</i></span>'; }).join('');
    $('#impFile').textContent = st.name;
    $('#impCount').textContent = st.total || countBlocks(st.blocks);
    $('#impChips').innerHTML = chips;
    var notes = [];
    if (st.exact) {
      notes.push('这是本站导出的页面，已按原样还原：颜色、渐变、宽度、主题样式和组件类型都不会被重新猜一遍');
      if (st.stats.dataImgs) notes.push(st.stats.dataImgs + ' 处内嵌图片一起带过来');
      if (st.stats.remoteImgs) notes.push(st.stats.remoteImgs + ' 张外链图片保留原地址');
    }
    if (st.stats.localImgs) notes.push('有 ' + st.stats.localImgs + ' 张图片是相对路径（如 images/a.png），导入后打不开，需要重新上传');
    if (st.stats.remoteImgs) notes.push(st.stats.remoteImgs + ' 张外链图片保留原地址');
    if (st.stats.dataImgs) notes.push(st.stats.dataImgs + ' 张内嵌图片直接带过来');
    if (st.stats.extCss) notes.push('这个页面有 ' + st.stats.extCss + ' 个外部 CSS 文件，读不到里面的样式：只拿到结构和文字，颜色字号需要手动再过一遍');
    if (st.stats.skipped) notes.push('跳过 ' + st.stats.skipped + ' 个图标 / 装饰元素');
    if (st.stats.thawed) notes.push('有 ' + st.stats.thawed + ' 处入场动画停在透明状态，已按动画播完的样子导入');
    if (st.stats.failed) notes.push('有 ' + st.stats.failed + ' 个区块结构太绕没解析出来，已跳过，其余照常导入');
    if (st.stats.intro && st.stats.intro.style) {
      var it = st.stats.intro;
      notes.push('认出原页面的开场动画' + (it.title ? '「' + it.title + '」' : '') +
        '，会还原成' + (it.style === 'film' ? '视频揭幕' : '品牌幕') + '（在「页面 → 开场动画」里可改）');
      if (it.filmDropped) notes.push('开场视频体积过大（超过约 1.8MB），没有一起带过来，先用幕布背景顶上；需要的话在「页面 → 开场动画」里重新上传');
    }
    if (st.stats.scripts && st.stats.textLen < 240) {
      notes.push('这个页面的正文是脚本生成的（HTML 里只有 ' + st.stats.scripts + ' 个 script），只按静态结构导入，内容可能不全');
    }
    if (!st.exact) {
      notes.push('样式只保留关键项（字号、颜色、对齐、留白、底色含渐变），复杂布局会被拍平成模块顺序');
      notes.push('已识别的悬停 / 常驻动效和进场动画会还原到「动效」设置里；原页面的视差与复杂脚本交互仍需在编辑器中调整');
    }
    $('#impNotes').innerHTML = notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    // 每次打开都回到「替换」：上一次选了追加再导一次，很容易把内容悄悄翻倍
    var rm = document.querySelector('input[name="impMode"][value="replace"]');
    var am = document.querySelector('input[name="impMode"][value="append"]');
    if (rm) rm.checked = true;
    if (am) {
      var ai = am.parentNode.querySelector('i');
      var nowN = state.blocks.length;
      if (ai) ai.textContent = nowN
        ? '保留现有 ' + nowN + ' 个模块，把导入的接在后面'
        : '保留现有内容，把导入的模块接在后面';
    }
    // 解析中的提示可以收了，别在弹窗底下挂着
    clearTimeout(toastTimer);
    $('#toast').classList.remove('show');
    $('#importModal').hidden = false;
    $('#impApply').focus();
  }

  function closeImportModal() {
    $('#importModal').hidden = true;
    impPending = null;
  }

  function applyImport(mode) {
    var st = impPending;
    if (!st) return;
    var append = mode === 'append';
    var before = countBlocks(state.blocks);
    // 带工程快照的导入已经是原结构，拍平导航 / 页脚反而会改变层级
    if (!st.exact) st.blocks = impFlattenChrome(st.blocks);
    // 浮层里记的是原页面的模块 ID，映射成本次导入生成的新 ID
    var idMap = (st.stats && st.stats.idMap) || {};
    (function mapTargets(list) {
      (list || []).forEach(function (b) {
        if (b && b.p && b.p.layerMode === 'overlay' && idMap[b.p.layerTarget]) {
          b.p.layerTarget = idMap[b.p.layerTarget];
        }
        if (b && b.children) mapTargets(b.children);
      });
    })(st.blocks);
    state.blocks = append ? state.blocks.concat(st.blocks) : st.blocks;
    if (!append && st.exact) {
      /* 原样还原：整份页面设置都回来（宽度、字体、标签页图标、动效开关…），
         不再只挑 bg / text / accent 三项，否则导入后页面宽度和字体都会变回默认 */
      state.page = Object.assign(defaultState().page, st.page || {});
      if (st.pageName) state.name = st.pageName;
      $('#projectName').value = state.name || '';
      $('#stageTitle').textContent = state.name || '未命名页面';
      syncComponentCSS();
    } else if (!append) {
      var pg = st.page || {};
      if (pg.bg) state.page.bg = pg.bg;
      if (pg.text) state.page.text = pg.text;
      if (pg.accent) { state.page.accent = pg.accent; syncComponentCSS(); }
      // 原页面的标签页图标 / 站点描述一起带过来
      if (pg.favicon) {
        state.page.favicon = String(pg.favicon).slice(0, 700000);
        state.page.faviconMode = 'custom';
        try { applyEditorFavicon(); } catch (eFav) { }
      }
      if (pg.description) state.page.description = String(pg.description).slice(0, 200);
      if (pg.name) {
        state.name = pg.name;
        $('#projectName').value = pg.name;
        $('#stageTitle').textContent = pg.name;
      }
      // 原页面有开场层就还原成开场幕；没有就保持空白，别硬塞一个
      var intro = pg.intro;
      if (intro && intro.style) {
        var filmOk = intro.style === 'film' && /^(https?:|data:)/i.test(String(intro.film || ''));
        state.page.introStyle = filmOk ? 'film' : 'splash';
        state.page.introFilm = filmOk ? intro.film : '';
        state.page.introPoster = filmOk ? String(intro.poster || '').slice(0, 700000) : '';
        state.page.introTitle = intro.title || '';
        state.page.introSub = intro.sub || '';
        state.page.introBg = intro.bg || '';
        // 原页面是「先停一帧、滚动推进」就别改成自动播放：片子第一帧多半是黑的，
        // 自动播会变成一屏黑幕还循环
        state.page.introDur = Math.max(600, Math.min(5000, Number(intro.dur) || 2000));
        state.page.introDrive = intro.drive === 'scroll' ? 'scroll' : 'auto';
        // 导入进来的站，用户多半要反复打开验证；默认每次进入都播（面板里可改每会话 / 仅一次）
        state.page.introFreq = 'always';
      } else {
        state.page.introStyle = 'none';
      }
      state.page.hintStyle = 'none';
      if (pg.hint && pg.hint.style) {
        state.page.hintStyle = HINT_STYLES.indexOf(pg.hint.style) >= 0 ? pg.hint.style : 'mouse';
        if (pg.hint.text) state.page.hintText = String(pg.hint.text).slice(0, 24);
        state.page.hintColor = pg.hint.color || '';
      }
    }
    /* 按钮底色刚好等于页面主色时，交回「跟随主题」：以后换主色，CTA 还能一起变。
       不这么做的话，导入后每颗按钮都会被锁死成导入那一刻的蓝色。 */
    if (!st.exact) {
      (function relink(list) {
        var acc = String((state.page && state.page.accent) || '').toLowerCase();
        if (!acc) return;
        (function walk(arr) {
          (arr || []).forEach(function (b) {
            var p = (b && b.p) || {};
            if (String(p.btnStyle) === 'solid' && String(p.btnBg || '').toLowerCase() === acc) {
              p.btnStyle = 'auto'; p.btnBg = ''; p.btnColor = '';
            }
            if (b && b.children) walk(b.children);
          });
        })(list);
      })(state.blocks);
    }
    selectedId = null;
    pushHistory(); renderAll();
    closeImportModal();
    toast('✓ 已导入 ' + countBlocks(st.blocks) + ' 个模块' + (append ? '（追加到末尾）' : '（替换原画布，可撤销）'));
  }

  /* 选文件 → 读文本 → 解析 */
  function pickHtmlFile() { $('#importHtmlFile').click(); }
  function importHtmlFile(file) {
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) { toast('HTML 文件超过 24MB，太大了解析不动', true); return; }
    var reader = new FileReader();
    reader.onload = function (e) { importHtmlText(String(e.target.result || ''), file.name); };
    reader.onerror = function () { toast('读取文件失败', true); };
    reader.readAsText(file);
  }

  function bindProps() {
    var box = $('#propPanel');
    box.addEventListener('input', function (e) {
      var el = e.target, key = el.getAttribute('data-key');
      // 渐变编辑器里的滑杆 / 色标不带 data-key，先单独处理
      var gfield = el.closest ? el.closest('.color-field') : null;
      if (gfield && el.closest('.grad-editor')) { handleGradInput(gfield, el); return; }
      // 单条样式：底色 / 文字色 / 圆角 / 内边距 / 图标 / 角标 / 隐藏
      var rsKey = el.getAttribute('data-rs');
      if (rsKey) {
        var rsBox = el.closest('.rows-style');
        var rsB = getBlock(selectedId);
        if (rsBox && rsB) {
          var rsField = rsBox.getAttribute('data-rs-box');
          var rsIdx = Number(rsBox.getAttribute('data-rs-idx'));
          var rsVal = (el.type === 'checkbox') ? (el.checked ? '1' : '') : el.value;
          setRowSty(rsB.p, rsField, rsIdx, rsKey, rsVal);
          syncComponentCSS();
          // 只更新这一行的「有个性」标记，不整体重绘，输入焦点不丢
          var rsItem = el.closest('.rows-item');
          var rsBtn = rsItem ? rsItem.querySelector('.rows-sty') : null;
          if (rsBtn) rsBtn.classList.toggle('has-sty', !!rowSty(rsB.p, rsField, rsIdx));
          scheduleHistory(); scheduleSave();
        }
        return;
      }
      if (!key) return;
      // 多行内容里的单个格子：只改这一格，整行数据留在数组里
      if (el.hasAttribute('data-row')) { setRowCell(key, el); return; }
      syncColorRow(el);
      // 媒体字段：边输入边刷新缩略图（不重绘面板，避免打断输入）
      if (el.closest && el.closest('.media-field')) {
        var mf = el.closest('.media-field');
        var th = $('.media-thumb', mf);
        if (th) { th.innerHTML = mediaPreview(el.value); th.title = String(el.value).slice(0, 60); }
      }
      if (el.type === 'range') {
        var v = el.parentNode.querySelector('.range-val');
        if (v) v.textContent = el.value + ((FIELD_MAP[key] && FIELD_MAP[key].unit) || (key === '__maxWidth' ? 'px' : (key === '__introDur' ? 'ms' : '')));
      }
      applyProp(key, el.value, el);
    });
    box.addEventListener('change', function (e) {
      var el = e.target;
      // 单条样式的颜色 / 数字：input 事件里已经写好了，这里不再重复
      if (el.getAttribute && el.getAttribute('data-rs')) return;
      if (el.matches && el.matches('input[data-media-file]')) { mediaFilePicked(el); return; }
      if (el.matches && el.matches('input[data-film-file]')) { filmFilePicked(el); return; }
      if (el.matches && el.matches('input.fav-file')) { faviconFilePicked(el); return; }
      if (el.classList && el.classList.contains('media-pick')) {
        var val = el.value;
        if (!val) return;
        var rk = el.getAttribute('data-row-key');
        if (rk) appendMediaRow(rk, val);
        else setMediaProp(el.getAttribute('data-key'), val, el.hasAttribute('data-media-multi'));
        return;
      }
      var key = el.getAttribute('data-key');
      if (!key) return;
      syncColorRow(el);
      if (el.tagName === 'SELECT' || el.type === 'color') applyProp(key, el.value, el);
    });
    box.addEventListener('click', function (e) {
      // 标签页图标：上传 / 清空
      var favBtn = e.target.closest ? e.target.closest('[data-fav-act]') : null;
      if (favBtn) {
        var fact = favBtn.getAttribute('data-fav-act');
        if (fact === 'upload') {
          var fin = $('.fav-file', box);
          if (fin) fin.click();
        } else if (fact === 'clear') {
          state.page.favicon = '';
          state.page.faviconMode = 'auto';
          pushHistory(); renderAll(); scheduleSave();
          toast('已清空自定义图标，回到按站点名生成');
        }
        return;
      }
      // 多行内容：加行 / 删行 / 上下移 / 加列
      var rbtn = e.target.closest ? e.target.closest('[data-row-act]') : null;
      if (rbtn) {
        var rbox = rbtn.closest('.prop-rows');
        if (rbox) {
          var rkey = rbox.getAttribute('data-rows');
          var rrow = rbtn.closest('.rows-item');
          var ridx = rrow ? Array.prototype.indexOf.call(rbox.querySelectorAll('.rows-item'), rrow) : -1;
          var ract = rbtn.getAttribute('data-row-act');
          // 「◐」只是展开这一条的样式，不动数据
          if (ract === 'style') { toggleRowStyle(rkey, ridx); return; }
          rowAction(rkey, ract, ridx);
          return;
        }
      }
      // 单条样式：清除某一项 / 整条恢复
      var rsX = e.target.closest ? e.target.closest('[data-rs-clear]') : null;
      if (rsX) {
        var xs = rsX.closest('.rows-style');
        var xb = getBlock(selectedId);
        if (xs && xb) {
          setRowSty(xb.p, xs.getAttribute('data-rs-box'), Number(xs.getAttribute('data-rs-idx')), rsX.getAttribute('data-rs-clear'), '');
          syncComponentCSS(); refreshRows(xs.getAttribute('data-rs-box'));
          scheduleHistory(); scheduleSave();
        }
        return;
      }
      var rsReset = e.target.closest ? e.target.closest('[data-rs-reset]') : null;
      if (rsReset) {
        var rb2 = rsReset.closest('.rows-style');
        var rb3 = getBlock(selectedId);
        if (rb2 && rb3) {
          var rk2 = rb2.getAttribute('data-rs-box');
          if (rb3.p.__rs) delete rb3.p.__rs[rk2];
          syncComponentCSS(); refreshRows(rk2);
          scheduleHistory(); scheduleSave();
        }
        return;
      }
      var cfield = e.target.closest ? e.target.closest('.color-field') : null;
      if (cfield && handleGradClick(cfield, e.target)) return;
      var pick = e.target.closest ? e.target.closest('[data-film-pick]') : null;
      if (pick) {
        var pv = pick.getAttribute('data-film-pick');
        // 字段键不写死：模块级是 filmSrc，开场幕是 __introFilm
        var fwrap = pick.closest ? pick.closest('.film-field') : null;
        var pin = fwrap ? fwrap.querySelector('input.prop-input[data-key]') : null;
        var pkey = pin ? pin.getAttribute('data-key') : 'filmSrc';
        applyProp(pkey, pv);
        // 只同步这一块 DOM：重绘整张属性面板会让按钮闪一下，也没必要重拼三张封面
        $$('.film-pick', pick.parentNode).forEach(function (x) { x.classList.toggle('is-on', x === pick); });
        if (pin) pin.value = pv;
        return;
      }
      var fbtn = e.target.closest ? e.target.closest('[data-film]') : null;
      if (fbtn) {
        var fa = fbtn.getAttribute('data-film');
        var fk = fbtn.getAttribute('data-key');
        if (fa === 'clear') {
          applyProp(fk, '');
          var cwrap = fbtn.closest('.film-field');
          if (cwrap) {
            $$('.film-pick', cwrap).forEach(function (x) { x.classList.remove('is-on'); });
            var cin = cwrap.querySelector('input[data-key="' + fk + '"]');
            if (cin) cin.value = '';
          }
          return;
        }
        if (fa === 'upload') {
          var ffield = fbtn.closest('.prop-field');
          var ffile = ffield ? $('.film-file', ffield) : null;
          if (ffile) ffile.click();
        }
        return;
      }
      var mbtn = e.target.closest ? e.target.closest('[data-media]') : null;
      if (mbtn) {
        var ma = mbtn.getAttribute('data-media');
        var mk = mbtn.getAttribute('data-key') || mbtn.getAttribute('data-row-key');
        if (ma === 'clear') { setMediaProp(mk, '', false); return; }
        if (ma === 'upload') {
          var mfield = mbtn.closest('.prop-field');
          var mfile = mfield ? $('.media-file', mfield) : null;
          if (mfile) mfile.click();
        }
        return;
      }
      var seg = e.target.closest ? e.target.closest('.seg button') : null;
      if (seg) {
        var key = seg.getAttribute('data-key'), val = seg.getAttribute('data-val');
        $$('.seg button[data-key="' + key + '"]', box).forEach(function (btn) { btn.classList.toggle('active', btn === seg); });
        applyProp(key, val, seg);
        return;
      }
      var act = e.target.closest ? e.target.closest('[data-pact]') : null;
      if (act && !selectedId) {
        var pa = act.getAttribute('data-pact');
        if (pa === 'fx-all') applyFxPreset('all');
        else if (pa === 'fx-hover') applyFxPreset('hover');
        else if (pa === 'fx-clear') applyFxPreset('clear');
        else if (pa === 'playintro') playIntro();
        else if (pa === 'openmotion') openMotion();
        return;
      }
      if (act && selectedId) {
        var a = act.getAttribute('data-pact');
        if (a === 'dup') duplicateBlock(selectedId);
        else if (a === 'layer') toggleLayer(selectedId);
        else if (a === 'del') deleteBlock(selectedId);
        else if (a === 'up') moveBlock(selectedId, -1);
        else if (a === 'down') moveBlock(selectedId, 1);
        else if (a === 'lift') liftBlock(selectedId);
        else if (a === 'savecomp') openCompModal();
        else if (a === 'playanim') playBlockAnim(selectedId);
        else if (a === 'openmotion') openMotion();
        else if (a === 'hoisttop') { moveBlockTo(selectedId, null, 0); toast('已移到页面最外层，吸顶现在对整个页面生效'); }
        else if (a === 'addchild') {
          var selType = $('#nestAddType', box);
          if (selType && getBlock(selectedId)) insertBlock(selType.value, null, null, selectedId);
        } else if (a === 'rowify' || a === 'flowify' || a === 'stackify') {
          var cb = getBlock(selectedId);
          if (cb && isContainer(cb)) {
            cb.p.layout = a === 'rowify' ? 'row' : (a === 'flowify' ? 'flow' : 'stack');
            if (a === 'rowify') cb.p.cols = Math.max(1, Math.min(6, (cb.children || []).length || 3));
            pushHistory(); renderAll();
            toast(a === 'rowify' ? '子模块已排成一行' : (a === 'flowify' ? '已改为自动横排' : '已改为纵向堆叠'));
          }
        } else if (a === 'resetsize') {
          var rb = getBlock(selectedId);
          if (rb) {
            SIZE_KEYS.forEach(function (k) { delete rb.p[k]; });
            pushHistory(); renderAll(); toast('尺寸已恢复默认');
          }
        }
      }
    });
  }

  /* ---------- 拖动调整模块大小 ---------- */
  function bindResize() {
    var canvas = $('#canvas');
    var sess = null;
    canvas.addEventListener('pointerdown', function (e) {
      var handle = e.target.closest ? e.target.closest('.b-resize') : null;
      if (!handle) return;
      var wrap = handle.closest('.b-block');
      if (!wrap) return;
      var id = wrap.getAttribute('data-id');
      var b = getBlock(id);
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      // 先量尺寸：选中会重绘画布，之后再取 rect 会拿到已脱离文档的节点（0×0）
      var rect = wrap.getBoundingClientRect();
      var w0 = Math.max(20, Math.min(100, cnum(b.p, 'boxWidth')));
      var useHeight = cnum(b.p, 'boxHeight') > 0;
      var h0 = useHeight ? cnum(b.p, 'boxHeight') : cnum(b.p, 'boxMinHeight');
      if (selectedId !== id) {
        selectBlock(id);
        var fresh = canvas.querySelector('.b-block[data-id="' + id + '"]');
        if (fresh) wrap = fresh;
      }
      sess = {
        id: id, wrap: wrap, x0: e.clientX, y0: e.clientY,
        pw: Math.max(40, rect.width / (w0 / 100)),
        w0: w0, h0: h0, useHeight: useHeight,
        hBase: h0 || rect.height, w: w0, h: h0
      };
      wrap.setAttribute('draggable', 'false');
      document.body.classList.add('is-resizing');
      var tip = wrap.querySelector(':scope > .b-size-tip');
      if (tip) { tip.classList.add('show'); tip.textContent = w0 + '% × ' + Math.round(rect.height) + 'px'; }
    });
    document.addEventListener('pointermove', function (e) {
      if (!sess) return;
      var dx = e.clientX - sess.x0, dy = e.clientY - sess.y0;
      // 轻微竖向抖动不算改高度，避免只拖宽度时给每个模块都写上最小高度
      var w = Math.max(20, Math.min(100, Math.round(sess.w0 + dx / sess.pw * 100)));
      var h = Math.abs(dy) < 8 ? sess.h0 : Math.max(0, Math.round(sess.hBase + dy));
      sess.w = w; sess.h = h;
      sess.wrap.style.width = w + '%';
      if (sess.useHeight) sess.wrap.style.height = h ? h + 'px' : '';
      else sess.wrap.style.minHeight = h ? h + 'px' : '';
      var tip = sess.wrap.querySelector(':scope > .b-size-tip');
      if (tip) tip.textContent = w + '% × ' + (h || Math.round(sess.hBase)) + 'px';
      e.preventDefault();
    });
    function endResize() {
      if (!sess) return;
      var s = sess; sess = null;
      document.body.classList.remove('is-resizing');
      var changed = (s.w !== s.w0) || (s.h !== s.h0);
      if (changed) {
        var b = getBlock(s.id);
        if (b) {
          b.p.boxWidth = s.w;
          if (s.useHeight) b.p.boxHeight = s.h;
          else b.p.boxMinHeight = s.h;
          pushHistory();
        }
        scheduleSave();
      }
      renderAll();
      if (changed) toast('模块尺寸已调整为 ' + s.w + '%' + (s.h ? ' × ' + s.h + 'px' : ''));
    }
    document.addEventListener('pointerup', endResize);
    document.addEventListener('pointercancel', endResize);
  }

  /* ---------- 拖动浮层：相对目标模块改 layerX / layerY ---------- */
  function bindLayerDrag() {
    var canvas = $('#canvas');
    var sess = null;
    canvas.addEventListener('pointerdown', function (e) {
      var handle = e.target.closest ? e.target.closest('.b-layer-handle') : null;
      if (!handle) return;
      var wrap = handle.closest('.b-block');
      if (!wrap || !wrap.classList.contains('is-overlay')) return;
      var id = wrap.getAttribute('data-id');
      var b = getBlock(id);
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      if (selectedId !== id) {
        selectBlock(id);
        var fresh = canvas.querySelector('.b-block[data-id="' + id + '"]');
        if (fresh) wrap = fresh;
      }
      var host = wrap.parentElement;
      var hr = host ? host.getBoundingClientRect() : wrap.getBoundingClientRect();
      sess = {
        id: id, wrap: wrap, host: host,
        x0: e.clientX, y0: e.clientY,
        px: hr.left + (cnum(b.p, 'layerX') / 100) * hr.width,
        py: hr.top + (cnum(b.p, 'layerY') / 100) * hr.height,
        w: Math.max(1, hr.width), h: Math.max(1, hr.height),
        x: cnum(b.p, 'layerX'), y: cnum(b.p, 'layerY')
      };
      wrap.setAttribute('draggable', 'false');
      document.body.classList.add('is-layer-drag');
    });
    document.addEventListener('pointermove', function (e) {
      if (!sess) return;
      var x = Math.max(-100, Math.min(100, Math.round((sess.px + e.clientX - sess.x0 - sess.host.getBoundingClientRect().left) / sess.w * 100)));
      var y = Math.max(-100, Math.min(100, Math.round((sess.py + e.clientY - sess.y0 - sess.host.getBoundingClientRect().top) / sess.h * 100)));
      sess.x = x; sess.y = y;
      sess.wrap.style.left = x + '%';
      sess.wrap.style.top = y + '%';
      e.preventDefault();
    });
    function endLayerDrag() {
      if (!sess) return;
      var s = sess; sess = null;
      document.body.classList.remove('is-layer-drag');
      var b = getBlock(s.id);
      if (b) {
        b.p.layerX = s.x; b.p.layerY = s.y;
        pushHistory(); scheduleSave();
      }
      renderAll();
      toast('浮层位置：' + s.x + '% / ' + s.y + '%');
    }
    document.addEventListener('pointerup', endLayerDrag);
    document.addEventListener('pointercancel', endLayerDrag);
  }

  /* ---------- 导出 HTML ---------- */
  var lastExportInfo = { hoisted: 0, sticky: false };
  /* sticky 的吸附范围由「包含块」决定：导航栏放在容器里时，只能吸附这个容器的高度，
     滚过容器就消失。预览和导出时把嵌套的吸顶导航提升到页面最外层（只改输出用的副本，
     不改动编辑器里的项目结构），保证用户勾选「吸顶」后看到的就是整页吸顶。 */
  /* 浅拷贝节点与属性对象即可：字符串（含 base64 图片）按引用共享，
     避免每次预览/导出都把整棵树 JSON 序列化一遍。 */
  function cloneTree(list) {
    return (list || []).map(function (b) {
      var c = Object.assign({}, b, { p: Object.assign({}, b.p || {}) });
      if (Array.isArray(b.children)) c.children = cloneTree(b.children);
      return c;
    });
  }
  /* 导出前把浮层目标写实：空目标（= 上一个模块）与失效目标在这里解析成真实 ID。
     必须在 hoist 之前做，否则「叠在容器内吸顶导航上的浮层」会因为没有显式 target
     而漏掉提升，导航被提到顶层后浮层就成了孤儿。 */
  function resolveLayerTargets(list) {
    (list || []).forEach(function (b) {
      if (b && b.children && b.children.length) resolveLayerTargets(b.children);
    });
    var allIds = {};
    (list || []).forEach(function (b) { if (b) allIds[b.id] = 1; });
    var last = null;
    (list || []).forEach(function (b) {
      if (!b) return;
      if (!isOverlay(b)) { last = b; return; }
      b.p = b.p || {};
      var t = String(cv(b.p, 'layerTarget') || '');
      // 指向任意同层模块（含浮层）都算有效；只有空目标/失效目标才改写成上一个普通模块
      if (t && t !== b.id && allIds[t]) return;
      if (last) b.p.layerTarget = last.id;
    });
  }
  function outputBlocks() {
    // 浮层靠「和宿主在同一层级、layerTarget 指向宿主 id」来配对。
    // 吸顶导航被提升到顶层时，叠在它上面的浮层必须跟着一起提升，
    // 否则浮层留在原容器里找不到宿主，变成没有定位参照的孤立浮层。
    var cloned = cloneTree(state.blocks || []);
    resolveLayerTargets(cloned);
    // 第一遍：找出所有会被 hoist 的吸顶导航（depth>0）
    var hoistNavIds = {};
    (function mark(arr, depth) {
      (arr || []).forEach(function (b) {
        if (!b) return;
        if (depth > 0 && isStickyNav(b)) hoistNavIds[b.id] = 1;
        mark(b.children, depth + 1);
      });
    })(cloned, 0);
    // 第二遍：把「层叠目标是待提升导航」的浮层也标记要一起提升（含嵌套浮层的链式传递）
    var hoistLayerIds = {};
    function markLayers(arr) {
      (arr || []).forEach(function (b) {
        if (!b) return;
        if (b.p && b.p.layerMode === 'overlay' && hoistNavIds[String(b.p.layerTarget || '')]) {
          hoistLayerIds[b.id] = 1;
        }
        markLayers(b.children);
      });
    }
    markLayers(cloned);
    // 链式：若某浮层 A 叠在浮层 B 上，而 B 要提升，则 A 也要提升
    var changed = true;
    while (changed) {
      changed = false;
      markLayers(cloned);
      (function chain(arr) {
        (arr || []).forEach(function (b) {
          if (!b) return;
          if (b.p && b.p.layerMode === 'overlay' && hoistLayerIds[String(b.p.layerTarget || '')] && !hoistLayerIds[b.id]) {
            hoistLayerIds[b.id] = 1; changed = true;
          }
          chain(b.children);
        });
      })(cloned);
    }
    var topNavs = [], topLayers = [];
    function walk(arr, depth) {
      var out = [];
      (arr || []).forEach(function (b) {
        if (!b) return;
        if (isContainer(b) && Array.isArray(b.children)) b.children = walk(b.children, depth + 1);
        if (depth > 0 && isStickyNav(b)) {
          // 移到顶层后清掉行内布局参数，避免残留 grid-column / flex 宽度
          b.p = b.p || {};
          b.p.colSpan = 1;
          b.p.flowWidth = 0;
          topNavs.push(b);
        } else if (hoistLayerIds[b.id]) {
          b.p = b.p || {};
          b.p.colSpan = 1;
          b.p.flowWidth = 0;
          topLayers.push(b);
        } else out.push(b);
      });
      return out;
    }
    var list = walk(cloned, 0);
    // 导航在前、其浮层紧随其后，确保 byTarget 在同一顶层里完成配对
    if (topNavs.length || topLayers.length) list = topNavs.concat(topLayers).concat(list);
    return { list: list, hoisted: topNavs.length };
  }
  /* 导出前扫一遍：决定要不要注入动效脚本、需要哪些能力 */
  function fxFlags() {
    var f = pageFx(), anim = 0, tilt = 0, spot = 0, magnetHover = 0, par = 0, count = 0, dirHover = 0, typing = 0;
    (function walk(list) {
      (list || []).forEach(function (b) {
        if (!b || !b.p) return;
        if (animOf(b.p) !== 'none') anim++;
        if (cv(b.p, 'boxHover') === 'tilt' || cv(b.p, 'boxHover') === 'tilt-glare') tilt++;
        if (cv(b.p, 'boxHover') === 'spot') spot++;
        if (cv(b.p, 'boxHover') === 'magnet') magnetHover++;
        if (cv(b.p, 'boxHover') === 'dir') dirHover++;
        if (cv(b.p, 'loopFx') === 'typewriter') typing++;
        if (b.type === 'stats') count++;
        if (parEligible(b, null)) par++;
        walk(b.children);
      });
    })(state.blocks);
    f.anim = anim; f.tilt = tilt; f.spot = spot; f.magnetHover = magnetHover;
    f.parN = par; f.countN = count; f.dirN = dirHover; f.typeN = typing;
    f.intro = introCfg();
    f.any = !!(anim || f.glow || f.cursor !== 'none' || f.magnet || f.bar || f.top || tilt || spot || magnetHover ||
      dirHover || typing ||
      f.spotlight || f.par || f.ripple || f.shadow || f.count || f.trail || f.veil || f.grain ||
      f.intro.style !== 'none' || f.intro.hint !== 'none');
    return f;
  }
  /* 头部脚本：在首帧之前就决定要不要盖幕布，避免页面先闪一下再被盖住。
     关闭 JS 时不加 .wr-intro，幕布保持 display:none，内容照常可见。 */
  function introGateJS(c) {
    var k = JSON.stringify(c.key);
    var seen = c.freq === 'session'
      ? 'seen=sessionStorage.getItem(k)==="1";'
      : (c.freq === 'once' ? 'seen=localStorage.getItem(k)==="1";' : '');
    return '(function(){try{var k=' + k + ',seen=false;' +
      (seen ? 'try{' + seen + '}catch(e){}' : '') +
      'if(seen)return;' +
      'if(' + (c.respect ? '(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)' : 'false') + ')return;' +
      'document.documentElement.classList.add("wr-intro");' +
      // 兜底：正文脚本万一没跑起来，10 秒后也把幕布撤掉，页面不会被永久锁住
      'setTimeout(function(){document.documentElement.classList.remove("wr-intro")},' + (c.drive === 'scroll' ? 40000 : 12000) + ');' +
      '}catch(e){}})();';
  }
  /* 幕布退场 + 滚动提示的滚动淡出 */
  function introScript(c) {
    var L = [];
    var k = JSON.stringify(c.key);
    if (c.style !== 'none') {
      L.push('var sp=document.querySelector(".wr-splash"),spRoot=document.documentElement;');
      L.push('if(sp&&spRoot.classList.contains("wr-intro")){');
      L.push('var spDone=false,spTimer=0;');
      L.push('var spV=sp.querySelector("video.wr-splash-v"),spCur=sp.querySelector(".wr-splash-cursor"),' +
        'spRip=sp.querySelector(".wr-splash-ripple"),spBar=sp.querySelector(".wr-splash-bar i"),' +
        'spTip=sp.querySelector(".wr-splash-tip"),spDot=spTip?spTip.querySelector(".wr-mouse i"):null;');
      L.push('var spEnd=function(){if(spDone)return;spDone=true;clearTimeout(spTimer);');
      if (!c.noStore) {
        L.push('try{' + (c.freq === 'session' ? 'sessionStorage.setItem(' + k + ',"1");' : '') +
          (c.freq === 'once' ? 'localStorage.setItem(' + k + ',"1");' : '') + '}catch(e){}');
      }
      L.push('if(spV){try{spV.pause()}catch(e){}}');
      L.push('if(spTip){spTip.classList.add("is-gone")}');
      L.push('sp.classList.add("is-out");');
      L.push('setTimeout(function(){spRoot.classList.remove("wr-intro");if(sp.parentNode)sp.parentNode.removeChild(sp);},900);};');

      if (c.drive === 'scroll') {
        /* 滚动推进：滚轮 / 触摸 / 方向键把进度往前推，光标、涟漪、进度条、片子全按这一个进度画 */
        L.push('var spP=0,spAcc=0,spRaf=0,spStroke=Math.max(700,Math.round((window.innerHeight||720)*0.85));');
        L.push('var spSeek=function(){if(!spV||spDone)return;var d=spV.duration;if(!isFinite(d)||d<=0)return;' +
          'var tt=Math.min(d-0.04,spP*d);if(Math.abs((spV.currentTime||0)-tt)>0.035){try{spV.currentTime=tt}catch(e){}}};');
        L.push('var spPaint=function(){');
        L.push('if(spBar)spBar.style.width=(spP*100).toFixed(2)+"%";');
        L.push('if(spCur){var e=1-Math.pow(1-Math.min(1,spP/0.7),2.6);');
        L.push('var dx=((1-e)*0.30*(window.innerWidth||1280)).toFixed(1),dy=((1-e)*0.24*(window.innerHeight||800)).toFixed(1);');
        L.push('var sc=1;if(spP>0.70&&spP<0.86){sc=spP<0.78?1-(spP-0.70)/0.08*0.16:0.84+(spP-0.78)/0.08*0.16;}');
        L.push('spCur.style.opacity=Math.min(1,spP*7).toFixed(3);');
        L.push('spCur.style.transform="translate("+dx+"px,"+dy+"px) scale("+sc.toFixed(3)+")";}');
        L.push('if(spRip){var r=(spP-0.66)/0.28;');
        L.push('if(r>0&&r<1){spRip.style.opacity=(r<0.3?r/0.3:1-(r-0.3)/0.7).toFixed(3);' +
          'spRip.style.transform="scale("+(0.34+r*2.3).toFixed(3)+")";}else{spRip.style.opacity="0";spRip.style.transform="scale(.34)";}}');
        L.push('if(spDot)spDot.style.transform="translateY("+(spP*4).toFixed(1)+"px)";');
        L.push('spSeek();};');
        L.push('var spDraw=function(){if(spRaf)return;spRaf=1;requestAnimationFrame(function(){spRaf=0;spPaint();});};');
        L.push('var spSet=function(v){spP=Math.max(0,Math.min(1,v));spDraw();');
        // 到头这一帧要单独补一次 seek：spEnd 会把 spDone 置真，之后 rAF 里的 spSeek 就不干活了，
        // 片子会停在倒数一格，最后那下 logo 定格看不到
        L.push('if(spP>0.996){if(spV){var fd=spV.duration;if(isFinite(fd)&&fd>0){try{spV.currentTime=Math.max(0,fd-0.04)}catch(e){}}}spEnd();}};');
        L.push('var spStep=function(d){spAcc+=d;spSet(spAcc/spStroke);};');
        L.push('addEventListener("wheel",function(e){if(spDone)return;var d=e.deltaY||0;' +
          'if(e.deltaMode===1)d*=16;else if(e.deltaMode===2)d*=window.innerHeight||720;if(!d)return;' +
          'e.preventDefault();spStep(d);},{passive:false});');
        L.push('var spTy=0,spTouch=false;');
        L.push('addEventListener("touchstart",function(e){spTouch=true;spTy=e.touches[0].clientY;},{passive:true});');
        L.push('addEventListener("touchend",function(){spTouch=false;},{passive:true});');
        L.push('addEventListener("touchmove",function(e){if(!spTouch||spDone)return;' +
          'var y=e.touches[0].clientY;spStep((spTy-y)*1.15);spTy=y;},{passive:true});');
        L.push('addEventListener("keydown",function(e){if(spDone)return;' +
          'if(e.key==="Enter"||e.key==="Escape"||e.key===" "){e.preventDefault();spEnd();return;}' +
          'var kd=e.key==="ArrowDown"?0.06:(e.key==="PageDown"?0.34:0);if(kd){e.preventDefault();spStep(spStroke*kd);}});');
        L.push('sp.addEventListener("click",function(e){e.preventDefault();spEnd();});');
        L.push('if(spV){try{spV.pause()}catch(e){}' +
          'spV.addEventListener("loadedmetadata",spDraw,{once:true});if(spV.readyState>=1)spDraw();}');
        // 封面图是片子的最后一帧，不 seek 一下就一直挂在那儿：往下滚第一格会「从成片突然跳回黑场」。
        // 这里先落到 0.02s，把真正的首帧画出来，做到「看到哪一帧 = 滚到哪一格」。
        // 但原页面带了封面时不能这么干：首帧是黑的，一进来就变成一屏黑幕 —— 让封面留在原地，
        // 等用户真的开始滚动（spSeek 算出的 tt 变化）再切到片子上。
        if (!c.filmPoster) {
          L.push('if(spV){var spPrime=function(){try{spV.currentTime=0.02}catch(e){}};' +
            'if(spV.readyState>=1)spPrime();else spV.addEventListener("loadedmetadata",spPrime,{once:true});}');
        }
        L.push('spPaint();');
        // 兜底：一直不滚也不会被锁死
        L.push('spTimer=setTimeout(spEnd,' + (c.style === 'film' ? 34000 : 26000) + ');');
      } else {
        L.push('var spUntil=Date.now()+' + Math.max(600, Number(c.dur) || 2000) + ';');
        // 片子播完 / 加载失败都别立刻收幕：至少把「停留时长」走完，否则短片子只会闪一下
        L.push('var spSoft=function(){var left=spUntil-Date.now();if(left>0){clearTimeout(spTimer);spTimer=setTimeout(spEnd,left);return;}spEnd();};');
        L.push('var spArm=function(ms){clearTimeout(spTimer);spTimer=setTimeout(spEnd,Math.max(900,ms));};');
        L.push('spArm(' + c.dur + ');');
        if (c.style === 'film') {
          L.push('if(spV){try{spV.muted=true;var spPr=spV.play();if(spPr&&spPr.catch)spPr.catch(function(){});}catch(e){}');
          L.push('var spFit=function(){var d=spV.duration;if(!isFinite(d)||d<=0)return;' +
            'spArm(Math.max(' + Math.max(600, Number(c.dur) || 2000) + ', d*1000-260));};');
          L.push('if(spV.readyState>=1)spFit();else spV.addEventListener("loadedmetadata",spFit,{once:true});');
          L.push('spV.addEventListener("timeupdate",function(){if(spBar&&spV.duration>0)' +
            'spBar.style.width=(spV.currentTime/spV.duration*100).toFixed(2)+"%"});');
          L.push('spV.addEventListener("ended",function(){if(spBar)spBar.style.width="100%";setTimeout(spSoft,300)});');
          L.push('spV.addEventListener("error",function(){setTimeout(spSoft,600)});}');
        }
        L.push('["click","touchstart","keydown"].forEach(function(ev){addEventListener(ev,function(){spEnd()},{passive:true,once:true})});');
      }
      L.push('}else if(sp&&sp.parentNode){sp.parentNode.removeChild(sp);}');
    }
    if (c.hint !== 'none') {
      L.push('var hn=document.querySelector(".wr-scrollhint");');
      L.push('if(hn){');
      /* 滚轮线跟着真实滚动量走：滚动多远偏多少，停下 170ms 后回弹，不再是自播动画 */
      L.push('var hw=hn.querySelector(".wr-mouse i"),hy=(window.scrollY||document.documentElement.scrollTop||0),ht=0,hacc=0;');
      L.push('var hnOn=function(){var y=window.scrollY||document.documentElement.scrollTop||0,d=y-hy;hy=y;');
      L.push('if(hw&&d){hacc+=d;var off=Math.max(-7,Math.min(7,hacc*.8));');
      L.push('hw.classList.add("is-live");hw.style.transform="translateY("+off.toFixed(1)+"px)";hw.style.opacity="1";');
      L.push('clearTimeout(ht);ht=setTimeout(function(){hacc=0;hw.classList.remove("is-live");hw.style.transform="";hw.style.opacity="";},170);}');
      L.push('hn.classList.toggle("is-gone",y>90);};');
      L.push('addEventListener("scroll",hnOn,{passive:true});hnOn();');
      L.push('hn.addEventListener("click",function(e){e.preventDefault();var ss=document.querySelectorAll(".wr-page>section");');
      L.push('var y=ss.length>1?ss[1].getBoundingClientRect().top+(window.scrollY||0):innerHeight*.92;');
      L.push('scrollTo({top:Math.max(0,y-70),behavior:reduce?"auto":"smooth"})});}');
    }
    return L.join('\n');
  }
  /* 导出页脚本：滚动进场 + 光标光晕 / 圆环 / 磁性按钮 / 3D 倾斜 / 光斑 / 进度条。
     整体 try/catch，出错就撤掉 .wr-js，绝不让内容停在隐藏状态。 */
  function fxScript(f) {
    var L = [];
    L.push('(function(){try{');
    L.push('var reduce=' + (f.respect ? '!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)' : 'false') + ';');
    if (f.intro && (f.intro.style !== 'none' || f.intro.hint !== 'none')) L.push(introScript(f.intro));
    if (f.anim) {
      L.push('var items=[].slice.call(document.querySelectorAll("[data-anim]"));');
      L.push('if(items.length){');
      L.push('if(reduce||!("IntersectionObserver" in window)){items.forEach(function(el){el.classList.add("wr-in")});}else{');
      L.push('var io=new IntersectionObserver(function(es){es.forEach(function(en){var el=en.target;');
      L.push('if(en.isIntersecting){el.classList.add("wr-in");if(el.getAttribute("data-anim-once")==="1")io.unobserve(el);}');
      L.push('else if(el.getAttribute("data-anim-once")!=="1"){el.classList.remove("wr-in");}});},');
      // 阈值取 0 + 顶部留 180px 余量：进场动画的起始位移可能把贴顶元素推出视口，
      // 阈值太高会导致它永远等不到「可见」，一直停在隐藏状态。
      L.push('{threshold:0,rootMargin:"180px 0px -6% 0px"});');
      L.push('items.forEach(function(el){io.observe(el)});}}');
    }
    var pointer = f.glow || f.cursor !== 'none';
    var wantRing = f.cursor === 'ring' || f.cursor === 'both';
    var wantDot = f.cursor === 'dot' || f.cursor === 'both';
    if (pointer) {
      L.push('var fine=window.matchMedia?matchMedia("(hover:hover) and (pointer:fine)").matches:true;');
      L.push('if(fine){');
      if (f.glow) L.push('var gp=document.createElement("div");gp.className="wr-glow";document.body.appendChild(gp);');
      if (wantRing) L.push('var rg=document.createElement("div");rg.className="wr-ring";document.body.appendChild(rg);');
      if (wantDot) L.push('var dt=document.createElement("div");dt.className="wr-dot";document.body.appendChild(dt);');
      L.push('var px=innerWidth/2,py=innerHeight/2,sx=px,sy=py,rx=px,ry=py;');
      L.push('addEventListener("pointermove",function(e){px=e.clientX;py=e.clientY;' +
        (f.glow ? 'gp.style.opacity="1";' : '') +
        (wantRing ? 'rg.style.opacity=".7";' : '') +
        (wantDot ? 'dt.style.opacity=".9";' : '') + '},{passive:true});');
      if (wantRing) {
        L.push('document.addEventListener("pointerover",function(e){if(e.target.closest&&e.target.closest("a,button"))rg.classList.add("is-hot")});');
        L.push('document.addEventListener("pointerout",function(e){if(e.target.closest&&e.target.closest("a,button"))rg.classList.remove("is-hot")});');
      }
      L.push('(function loop(){sx+=(px-sx)*.16;sy+=(py-sy)*.16;rx+=(px-rx)*.3;ry+=(py-ry)*.3;');
      if (f.glow) L.push('gp.style.transform="translate3d("+sx.toFixed(1)+"px,"+sy.toFixed(1)+"px,0)";');
      if (wantRing) L.push('rg.style.transform="translate3d("+rx.toFixed(1)+"px,"+ry.toFixed(1)+"px,0)";');
      if (wantDot) L.push('dt.style.transform="translate3d("+px+"px,"+py+"px,0)";');
      L.push('requestAnimationFrame(loop)})();');
      L.push('}');
    }
    if (f.magnet) {
      L.push('[].forEach.call(document.querySelectorAll("[data-wr-btn]"),function(el){');
      L.push('el.classList.add("wr-magnet");');
      L.push('el.addEventListener("pointermove",function(e){var r=el.getBoundingClientRect();');
      L.push('el.style.transform="translate("+((e.clientX-r.left-r.width/2)*.16).toFixed(1)+"px,"+((e.clientY-r.top-r.height/2)*.2).toFixed(1)+"px)";});');
      L.push('el.addEventListener("pointerleave",function(){el.style.transform="";});});');
    }
    if (f.tilt) {
      L.push('[].forEach.call(document.querySelectorAll("[data-tilt]"),function(el){');
      L.push('el.addEventListener("pointermove",function(e){var r=el.getBoundingClientRect();');
      L.push('var dx=(e.clientX-r.left)/r.width-.5,dy=(e.clientY-r.top)/r.height-.5,gl=el.getAttribute("data-glare")==="1";');
      L.push('el.style.transform="perspective(900px) rotateX("+(-dy*(gl?9:7)).toFixed(2)+"deg) rotateY("+(dx*(gl?9:7)).toFixed(2)+"deg)";');
      L.push('if(gl){el.style.setProperty("--wr-gx",((dx+.5)*100).toFixed(1)+"%");el.style.setProperty("--wr-gy",((dy+.5)*100).toFixed(1)+"%");}});');
      L.push('el.addEventListener("pointerleave",function(){el.style.transform="";});});');
    }
    /* 磁吸跟随：位移只取指针与中心的偏移，移开用 CSS 过渡弹回 */
    if (f.magnetHover) {
      L.push('[].forEach.call(document.querySelectorAll("[data-magnet]"),function(el){');
      L.push('el.addEventListener("pointermove",function(e){var r=el.getBoundingClientRect();');
      L.push('var dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;');
      L.push('el.style.transform="translate("+(dx*.12).toFixed(1)+"px,"+(dy*.16).toFixed(1)+"px)";});');
      L.push('el.addEventListener("pointerleave",function(){el.style.transform="";});});');
    }
    if (f.spot) {
      L.push('[].forEach.call(document.querySelectorAll(".wr-hover-spot"),function(el){');
      L.push('el.addEventListener("pointermove",function(e){var r=el.getBoundingClientRect();');
      L.push('el.style.setProperty("--wr-mx",(e.clientX-r.left)+"px");');
      L.push('el.style.setProperty("--wr-my",(e.clientY-r.top)+"px");});});');
    }
    /* 方向感知：从指针进入的那条边反向滑进来，位移量固定 16px */
    if (f.dirN) {
      L.push('[].forEach.call(document.querySelectorAll("[data-dir]"),function(el){');
      L.push('if(!el.animate)return;');
      L.push('el.addEventListener("pointerenter",function(e){if(reduce)return;');
      L.push('var r=el.getBoundingClientRect();if(!r.width||!r.height)return;');
      L.push('var ax=(e.clientX-r.left)/r.width-.5,ay=(e.clientY-r.top)/r.height-.5;');
      L.push('if(Math.abs(ax)>Math.abs(ay)){ax=ax>0?1:-1;ay=0}else{ay=ay>0?1:-1;ax=0}');
      L.push('el.animate([{transform:"translate3d("+(ax*16)+"px,"+(ay*16)+"px,0)",opacity:.86},' +
        '{transform:"translate3d(0,0,0)",opacity:1}],{duration:520,easing:"cubic-bezier(.22,1,.36,1)"});});});');
    }
    /* 打字机：把标题文字清空后逐字打出来。只处理纯文字节点，遇到图文混排就跳过 */
    if (f.typeN) {
      L.push('[].forEach.call(document.querySelectorAll("[data-type]"),function(el){');
      L.push('if(reduce)return;');
      L.push('var t=el.querySelector("h1,h2,h3")||el.querySelector("p,b");if(!t)return;');
      L.push('if(t.querySelector("img,div,section,ul,ol,table,svg"))return;');
      L.push('var txt=(t.textContent||"").replace(/\\s+/g," ").trim();');
      L.push('if(txt.length<2||txt.length>120)return;');
      L.push('t.textContent="";var cur=document.createElement("span");cur.className="wr-type-cursor";t.appendChild(cur);');
      L.push('var i=0;var step=function(){if(i>=txt.length){setTimeout(function(){cur.remove()},900);return}');
      L.push('t.insertBefore(document.createTextNode(txt.charAt(i)),cur);i++;');
      L.push('setTimeout(step,34+Math.random()*46)};setTimeout(step,320);});');
    }
    if (f.bar) L.push('var bar=document.createElement("div");bar.className="wr-progress";document.body.appendChild(bar);');
    if (f.top) {
      L.push('var bt=document.createElement("button");bt.type="button";bt.className="wr-top";');
      L.push('bt.setAttribute("aria-label","回到顶部");bt.textContent="\\u2191";document.body.appendChild(bt);');
      L.push('bt.addEventListener("click",function(){scrollTo({top:0,behavior:reduce?"auto":"smooth"})});');
    }
    if (f.bar || f.top) {
      L.push('var onScroll=function(){var h=document.documentElement;var max=h.scrollHeight-h.clientHeight;');
      L.push('var y=h.scrollTop||document.body.scrollTop||0;');
      if (f.bar) L.push('if(bar)bar.style.width=(max>0?(y/max*100):0)+"%";');
      if (f.top) L.push('if(bt)bt.classList.toggle("is-on",y>420);');
      L.push('};addEventListener("scroll",onScroll,{passive:true});onScroll();');
    }
    /* 页面级：聚光灯 / 吸顶阴影 / 视差 / 波纹 / 数字滚动 / 光标拖尾 / 转场幕 */
    if (f.spotlight) {
      // 变量名不能叫 sp：开场幕脚本里已经有一个 sp，同名会把幕布节点和聚光灯串在一起
      L.push('var spotEl=document.createElement("div");spotEl.className="wr-spot";document.body.appendChild(spotEl);');
      L.push('addEventListener("pointermove",function(e){spotEl.style.setProperty("--wr-sx",e.clientX+"px");' +
        'spotEl.style.setProperty("--wr-sy",e.clientY+"px");spotEl.classList.add("is-on");},{passive:true});');
    }
    if (f.shadow) {
      L.push('var sn=[].slice.call(document.querySelectorAll(".wr-sticky-nav"));');
      L.push('if(sn.length){var onSh=function(){var y=window.scrollY||document.documentElement.scrollTop;' +
        'sn.forEach(function(el){el.classList.toggle("is-scrolled",y>8)})};' +
        'addEventListener("scroll",onSh,{passive:true});onSh();}');
    }
    if (f.parN) {
      L.push('var pars=[].slice.call(document.querySelectorAll("[data-par]"));');
      L.push('if(pars.length&&!reduce){var parItems=[];');
      L.push('var measure=function(){parItems.forEach(function(it){it.el.style.translate="";});' +
        'var y0=window.scrollY||document.documentElement.scrollTop;' +
        'parItems=pars.map(function(el){var r=el.getBoundingClientRect();' +
        'return {el:el,s:parseFloat(el.getAttribute("data-par"))||.05,h:r.height,top:r.top+y0};});};');
      L.push('var onP=function(){var vh=innerHeight,y0=window.scrollY||document.documentElement.scrollTop;' +
        'parItems.forEach(function(it){var c=(it.top-y0)+it.h/2-vh/2;' +
        'it.el.style.translate="0 "+(-c*it.s).toFixed(2)+"px";});};');
      L.push('measure();onP();addEventListener("scroll",onP,{passive:true});' +
        'addEventListener("resize",function(){measure();onP();});}');
    }
    if (f.ripple) {
      L.push('document.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest("a,button");if(!t)return;');
      L.push('var r=t.getBoundingClientRect(),s=Math.max(r.width,r.height)*1.7;');
      L.push('if(getComputedStyle(t).position==="static")t.style.position="relative";t.style.overflow="hidden";');
      L.push('var d=document.createElement("span");d.className="wr-ripple";d.style.width=d.style.height=s+"px";');
      L.push('d.style.left=(e.clientX-r.left-s/2)+"px";d.style.top=(e.clientY-r.top-s/2)+"px";t.appendChild(d);');
      L.push('setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},700);});');
    }
    if (f.count && f.countN) {
      L.push('var cvs=[].slice.call(document.querySelectorAll("[data-count]"));');
      L.push('if(cvs.length){');
      L.push('var runC=function(el){if(el.getAttribute("data-cdone")==="1")return;el.setAttribute("data-cdone","1");');
      L.push('var t=el.getAttribute("data-count")||"",m=/^([^\\d\\-+]*)([-+]?[\\d,]*\\.?\\d+)([\\s\\S]*)$/.exec(t);if(!m)return;');
      L.push('var pre=m[1],num=parseFloat(m[2].replace(/,/g,"")),suf=m[3],dec=(m[2].split(".")[1]||"").length,st=null;');
      L.push('if(!isFinite(num))return;var step=function(ts){if(!st)st=ts;var p=Math.min(1,(ts-st)/900),e=1-Math.pow(1-p,3);');
      L.push('el.textContent=pre+(num*e).toFixed(dec)+suf;if(p<1)requestAnimationFrame(step);else el.textContent=t;};requestAnimationFrame(step);};');
      L.push('if(reduce||!("IntersectionObserver" in window)){cvs.forEach(runC);}else{');
      L.push('var io2=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){runC(en.target);io2.unobserve(en.target);}});},{threshold:.35});');
      L.push('cvs.forEach(function(el){io2.observe(el)});}}');
    }
    if (f.trail) {
      L.push('var lastT=0;addEventListener("pointermove",function(e){var n=Date.now();if(n-lastT<48)return;lastT=n;');
      L.push('var d=document.createElement("i");d.className="wr-trail";d.style.left=e.clientX+"px";d.style.top=e.clientY+"px";');
      L.push('document.body.appendChild(d);setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},780);},{passive:true});');
    }
    if (f.grain) {
      L.push('var gr=document.createElement("div");gr.className="wr-grain";document.body.appendChild(gr);');
    }
    if (f.veil) {
      L.push('var vv=document.createElement("div");vv.className="wr-veil";document.body.appendChild(vv);');
      L.push('document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");');
      L.push('if(!a||a.target==="_blank")return;var h=a.getAttribute("href")||"";');
      L.push('if(!h||h.charAt(0)==="#"||/^(?:javascript|mailto|tel|data):/i.test(h))return;');
      L.push('if(a.host&&location.host&&a.host!==location.host)return;');
      L.push('e.preventDefault();vv.classList.add("is-in");setTimeout(function(){location.href=a.href},430);});');
    }
    var hasIntro = !!(f.intro && f.intro.style !== 'none');
    L.push('}catch(e){document.documentElement.classList.remove("wr-js","wr-force"' + (hasIntro ? ',"wr-intro"' : '') + ');' +
      (hasIntro ? 'var sp2=document.querySelector(".wr-splash");if(sp2&&sp2.parentNode)sp2.parentNode.removeChild(sp2);' : '') +
      '}})();');
    return L.join('\n');
  }
  /* ---------- 社区组件：点赞 / 发消息 / 空搜索表单的轻量脚本 ---------- */
  function socialFlags() {
    var n = 0;
    (function walk(list) {
      (list || []).forEach(function (b) {
        if (!b) return;
        if (b.type === 'feed' || b.type === 'qa' || b.type === 'chat' || b.type === 'search' ||
            b.type === 'skillbar' || b.type === 'polaroid') n++;
        walk(b.children);
      });
    })(state.blocks);
    return n;
  }
  function socialScript() {
    return [
      '(function(){try{',
      '[].forEach.call(document.querySelectorAll("[data-like]"),function(el){',
      'var label=el.querySelector("span")||el.querySelector("b"),base=parseInt((el.getAttribute("data-count")||"").replace(/[^\\d]/g,""),10)||0;',
      'var start=label?label.textContent:"",on=false;',
      'el.addEventListener("click",function(){on=!on;el.classList.toggle("is-liked",on);',
      'if(label&&/^\\d+$/.test(start))label.textContent=String(base+(on?1:0));});});',
      '[].forEach.call(document.querySelectorAll("form[data-wr-search]"),function(f){',
      'var a=f.getAttribute("action")||"";if(a&&a!=="#")return;',
      'f.addEventListener("submit",function(e){e.preventDefault();});});',
      '[].forEach.call(document.querySelectorAll("[data-chat-send]"),function(btn){',
      'var root=btn.closest(".wr-chat-main");if(!root)return;',
      'var input=root.querySelector(".wr-chat-composer input"),box=root.querySelector(".wr-chat-msgs");',
      'var send=function(){if(!input||!box)return;var v=(input.value||"").trim();if(!v)return;',
      'var row=document.createElement("div");row.className="wr-chat-msg";',
      'var av=document.createElement("span");av.className="wr-media round";av.style.cssText="width:36px;height:36px;display:grid;place-items:center;background:#5865f2;font-size:18px;flex-shrink:0";av.textContent="🙂";',
      'var wrap=document.createElement("div"),meta=document.createElement("p"),who=document.createElement("b"),tm=document.createElement("time"),txt=document.createElement("div");',
      'who.textContent="我";who.style.color="#a78bfa";tm.textContent="刚刚";txt.className="wr-chat-text";txt.textContent=v;',
      'meta.appendChild(who);meta.appendChild(tm);wrap.appendChild(meta);wrap.appendChild(txt);',
      'row.appendChild(av);row.appendChild(wrap);box.appendChild(row);input.value="";box.scrollTop=box.scrollHeight;};',
      'btn.addEventListener("click",send);if(input)input.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();send();}});});',
      // 技能条：滚动进入视口时把进度条从 0 增长到目标宽度
      '[].forEach.call(document.querySelectorAll(".wr-skillbar[data-animate=\\"1\\"]"),function(box){',
      'var bars=[].slice.call(box.querySelectorAll(".wr-skill-track i")),run=function(){',
      'bars.forEach(function(i){i.style.width=i.getAttribute("data-w")||i.style.getPropertyValue("--wr-skill-w")||"0";});};',
      'bars.forEach(function(i){i.setAttribute("data-w",i.style.getPropertyValue("--wr-skill-w")||"0");});',
      'if(!("IntersectionObserver" in window)){run();return;}',
      'var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){run();io.disconnect();}});},{threshold:.25});',
      'io.observe(box);});',
      '}catch(e){}})();'
    ].join('\n');
  }
  /* ---------- 网页外观控制：颜色切换 / 深色模式 / 字号 / 主题 ---------- */
  var APPEARANCE_TYPES = { colorswitch: 1, darkmode: 1, fontsizer: 1, themepicker: 1, smartnav: 1 };
  function appearanceFlags() {
    var n = 0;
    (function walk(list) {
      (list || []).forEach(function (b) {
        if (!b) return;
        if (APPEARANCE_TYPES[b.type]) n++;
        walk(b.children);
      });
    })(state.blocks);
    return n;
  }
  /* 首帧恢复脚本：放在 head，避免切过主题的用户刷新时先闪一下默认色。
     key 与 appearanceScript 保持一致。 */
  function appearanceRestoreJS() {
    var L = ['(function(){try{'];
    L.push('var a=localStorage.getItem("wrAppAccent");if(a)document.documentElement.style.setProperty("--wr-accent",a);');
    L.push('var b=localStorage.getItem("wrAppBg");if(b)document.documentElement.style.setProperty("--wr-page-bg",b);');
    L.push('var c=localStorage.getItem("wrAppText");if(c)document.documentElement.style.setProperty("--wr-page-text",c);');
    L.push('if(localStorage.getItem("wrAppDark")==="1")document.documentElement.classList.add("wr-dark");');
    L.push('var d=localStorage.getItem("wrAppDarkVars");if(d){d=JSON.parse(d);var r=document.documentElement.style;' +
      'r.setProperty("--wr-dark-bg",d.bg||"#0f172a");r.setProperty("--wr-dark-text",d.text||"#e8eef9");' +
      'r.setProperty("--wr-dark-card",d.card||"#1e293b");}');
    L.push('var z=parseInt(localStorage.getItem("wrAppZoom"),10);if(z&&z>=50&&z<=180){var apz=function(){' +
      'var pg=document.querySelector(".wr-page");if(pg)pg.style.zoom=(z/100).toFixed(2);' +
      'else if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apz);};' +
      'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apz);else apz();}');
    L.push('}catch(e){}})();');
    return L.join('');
  }
  function appearanceScript() {
    return [
      '(function(){try{',
      'var root=document.documentElement,LS=window.localStorage;',
      'var put=function(k,v){try{LS.setItem(k,v)}catch(e){}};',
      // 把当前深色配色变量固化到 root：从第一个 darkmode section 读取（section 上已写 --wr-dark-*）
      '(function(){var d=document.querySelector("[data-wr-darkmode]");if(!d)return;',
      'var s=d.closest("section"),cs=s?getComputedStyle(s):getComputedStyle(d);',
      'var bg=cs.getPropertyValue("--wr-dark-bg").trim(),tx=cs.getPropertyValue("--wr-dark-text").trim(),cd=cs.getPropertyValue("--wr-dark-card").trim();',
      'if(bg)root.style.setProperty("--wr-dark-bg",bg);if(tx)root.style.setProperty("--wr-dark-text",tx);if(cd)root.style.setProperty("--wr-dark-card",cd);})();',
      // 颜色切换按钮：改强调色，同步 meta theme-color
      '[].forEach.call(document.querySelectorAll(".wr-sw-dot[data-wr-color]"),function(dot){',
      'var col=dot.getAttribute("data-wr-color");',
      'var apply=function(){root.style.setProperty("--wr-accent",col);put("wrAppAccent",col);',
      'var mt=document.querySelector(\'meta[name="theme-color"]\');if(mt)mt.setAttribute("content",col);',
      '[].forEach.call(document.querySelectorAll(".wr-sw-dot"),function(d){d.classList.toggle("is-active",d===dot);});};',
      'if(root.style.getPropertyValue("--wr-accent")===col)dot.classList.add("is-active");',
      'dot.addEventListener("click",apply);});',
      // 深色模式开关
      '[].forEach.call(document.querySelectorAll("[data-wr-darkmode]"),function(btn){',
      'var sync=function(){var on=root.classList.contains("wr-dark");btn.setAttribute("aria-pressed",on?"true":"false");',
      'var t=btn.querySelector("[data-on],[data-off]");if(t)t.textContent=on?(t.getAttribute("data-on")||""):(t.getAttribute("data-off")||"");};',
      'sync();btn.addEventListener("click",function(){var on=!root.classList.contains("wr-dark");',
      'root.classList.toggle("wr-dark",on);put("wrAppDark",on?"1":"0");',
      'var g=function(n,f){return root.style.getPropertyValue(n)||f};',
      'put("wrAppDarkVars",JSON.stringify({bg:g("--wr-dark-bg","#0f172a"),text:g("--wr-dark-text","#e8eef9"),card:g("--wr-dark-card","#1e293b")}));',
      '[].forEach.call(document.querySelectorAll("[data-wr-darkmode]"),sync);});});',
      // 字号调节：用 --wr-font-scale 缩放 .wr-page 的字体（rem/em），并同步按钮状态
      '[].forEach.call(document.querySelectorAll(".wr-fontsizer[data-wr-fontsizer]"),function(box){',
      'var min=parseInt(box.getAttribute("data-min"),10)||80,max=parseInt(box.getAttribute("data-max"),10)||130,',
      'step=parseInt(box.getAttribute("data-step"),10)||10;',
      'var lab=box.querySelector(".wr-fs-value"),pg=document.querySelector(".wr-page");',
      'var cur=parseInt(LS.getItem("wrAppZoom"),10)||100;',
      'var apply=function(){cur=Math.max(min,Math.min(max,cur));if(pg)pg.style.zoom=(cur/100).toFixed(2);',
      'if(lab)lab.textContent=cur+"%";put("wrAppZoom",String(cur));};apply();',
      '[].forEach.call(box.querySelectorAll("[data-wr-fs]"),function(b){',
      'b.addEventListener("click",function(){cur+=(b.getAttribute("data-wr-fs")==="up"?step:-step);apply();});});});',
      // 主题切换器：一次设置强调色 / 背景 / 文字，并同步 meta
      '[].forEach.call(document.querySelectorAll(".wr-tp-btn[data-wr-theme]"),function(btn){',
      'var apply=function(){root.style.setProperty("--wr-accent",btn.getAttribute("data-accent"));',
      'root.style.setProperty("--wr-page-bg",btn.getAttribute("data-bg"));',
      'root.style.setProperty("--wr-page-text",btn.getAttribute("data-text"));',
      'put("wrAppAccent",btn.getAttribute("data-accent"));put("wrAppBg",btn.getAttribute("data-bg"));put("wrAppText",btn.getAttribute("data-text"));',
      'var mt=document.querySelector(\'meta[name="theme-color"]\');if(mt)mt.setAttribute("content",btn.getAttribute("data-accent"));',
      '[].forEach.call(document.querySelectorAll(".wr-tp-btn"),function(b){b.classList.toggle("is-active",b===btn);});};',
      'btn.addEventListener("click",apply);});',
      '}catch(e){}})();'
    ].join('\n');
  }
  /* ---------- 滚动视频：统计需要注入哪几种播放逻辑 ---------- */
  function filmFlags() {
    var n = { scroll: 0, loop: 0, click: 0, any: 0 };
    (function walk(list) {
      (list || []).forEach(function (b) {
        if (!b) return;
        if (b.type === 'film') {
          n.any++;
          var m = (b.p && b.p.filmMode) || 'scroll';
          if (n[m] != null) n[m]++;
        }
        walk(b.children);
      });
    })(state.blocks);
    return n;
  }
  /* 滚动进度播放：元素从视口底部进入到完全离开顶部，映射成 0→1 的播放进度。
     只按差值节流地写 currentTime，不做任何自动播放，跟着滚动条走。 */
  function filmScript() {
    return [
      '(function(){',
      'var boxes=[].slice.call(document.querySelectorAll(".wr-film"));',
      'if(!boxes.length)return;',
      'var clamp=function(v){return v<0?0:(v>1?1:v)};',
      'var unlock=function(v){try{var pr=v.play();if(pr&&pr.catch)pr.catch(function(){});else v.pause&&v.pause();}catch(e){}};',
      'boxes.forEach(function(box){',
      'var v=box.querySelector("video");if(!v)return;',
      'var mode=box.getAttribute("data-mode")||"scroll";',
      'var dur=0,want=-1,raf=0;',
      'var scan=box.querySelector(".wr-film-scan");',
      'var sync=function(){dur=v.duration||0;};',
      'if(v.readyState>=1)sync();else v.addEventListener("loadedmetadata",sync);',
      'if(mode==="loop"){',
      'v.muted=true;',
      'if(!("IntersectionObserver" in window)){unlock(v);return;}',
      'var io=new IntersectionObserver(function(es){es.forEach(function(e){',
      'if(e.isIntersecting){var pr=v.play();if(pr&&pr.catch)pr.catch(function(){});}else{v.pause();}',
      '});},{threshold:.25});io.observe(box);',
      'v.addEventListener("loadedmetadata",function(){try{v.currentTime=0;}catch(e){}});',
      'return;}',
      'if(mode!=="scroll")return;',
      'v.pause&&v.pause();',
      'var apply=function(){',
      'raf=0;',
      'if(!dur)return;',
      'var r=box.getBoundingClientRect(),vh=innerHeight,h=r.height;',
      // 行程取「视口高」和「元素高」中较大的那个：
      // 视频比屏幕矮时，顶到视口顶就播完，不会因为页面滚动空间不够而停在中途
      'var range=vh>h?vh:h;',
      'var p=clamp((vh-r.top)/range);',
      'if(scan)scan.style.setProperty("--wr-film-p",p.toFixed(3));',
      'var t=p*dur;',
      'if(Math.abs(t-want)>0.03){want=t;try{v.currentTime=t;}catch(e){}}',
      '};',
      'var tick=function(){if(!raf)raf=requestAnimationFrame(apply);};',
      'addEventListener("scroll",tick,{passive:true});',
      'addEventListener("resize",tick);',
      'v.addEventListener("loadedmetadata",function(){sync();apply();});',
      // iOS 首次 seek 前需要一次播放解锁，静音短暂播放再暂停
      'if(/iP(hone|ad|od)/.test(navigator.userAgent)){',
      'document.addEventListener("touchstart",function(){unlock(v);}, {once:true,passive:true});}',
      'apply();',
      '});',
      '})();'
    ].join('\n');
  }
  /* ---------- 新组件交互：轮播 / 选项卡 / 倒计时 / 图片对比 ---------- */
  function interactiveFlags() {
    var n = { carousel: 0, tabs: 0, countdown: 0, compare: 0, newsletter: 0, share: 0, checkbox: 0, any: 0 };
    (function walk(list) {
      (list || []).forEach(function (b) {
        if (!b) return;
        if (b.type === 'carousel') { n.carousel++; n.any++; }
        if (b.type === 'tabs') { n.tabs++; n.any++; }
        if (b.type === 'countdown') { n.countdown++; n.any++; }
        if (b.type === 'compare') { n.compare++; n.any++; }
        if (b.type === 'newsletter') { n.newsletter++; n.any++; }
        if (b.type === 'share') { n.share++; n.any++; }
        if (b.type === 'checkboxset') { n.checkbox++; n.any++; }
        walk(b.children);
      });
    })(state.blocks);
    return n;
  }
  function interactiveScript(f) {
    var L = ['(function(){'];
    if (f.carousel) {
      L.push(
        '[].forEach.call(document.querySelectorAll(".wr-carousel"),function(box){',
        'var slides=[].slice.call(box.querySelectorAll(".wr-slide")),',
        'dots=[].slice.call(box.querySelectorAll(".wr-slide-dot"));',
        'if(slides.length<2)return;',
        'var cur=0,timer=null,dur=Math.max(2,parseInt(box.getAttribute("data-dur"),10)||4)*1000;',
        'var show=function(i){cur=(i+slides.length)%slides.length;',
        'slides.forEach(function(s,k){s.classList.toggle("is-on",k===cur)});',
        'dots.forEach(function(d,k){d.classList.toggle("is-on",k===cur)});};',
        'var stop=function(){if(timer){clearInterval(timer);timer=null;}};',
        'var start=function(){if(box.getAttribute("data-auto")==="1"&&!timer)timer=setInterval(function(){show(cur+1)},dur);};',
        '[].forEach.call(box.querySelectorAll(".wr-slide-arrow"),function(a){',
        'a.addEventListener("click",function(){show(cur+(parseInt(a.getAttribute("data-dir"),10)||1));stop();start();});});',
        'dots.forEach(function(d){d.addEventListener("click",function(){show(parseInt(d.getAttribute("data-dot"),10)||0);stop();start();});});',
        'start();',
        '});'
      );
    }
    if (f.tabs) {
      L.push(
        '[].forEach.call(document.querySelectorAll(".wr-tabs"),function(box){',
        'var btns=[].slice.call(box.querySelectorAll(".wr-tab-btn")),',
        'panes=[].slice.call(box.querySelectorAll(".wr-tab-pane"));',
        'btns.forEach(function(btn,i){btn.addEventListener("click",function(){',
        'btns.forEach(function(b,k){b.classList.toggle("is-on",k===i)});',
        'panes.forEach(function(pn,k){pn.classList.toggle("is-on",k===i)});',
        '});});',
        '});'
      );
    }
    if (f.countdown) {
      L.push(
        'var cds=[].slice.call(document.querySelectorAll(".wr-countdown"));',
        'if(cds.length){',
        'var parts=function(to){var t=Date.parse(String(to||"").replace(/-/g,"/").replace("T"," "));',
        'if(isNaN(t))return null;var d=t-Date.now();if(d<=0)return null;var s=Math.floor(d/1000);',
        'return {d:Math.floor(s/86400),h:Math.floor(s/3600)%24,m:Math.floor(s/60)%60,s:s%60};};',
        'var pad=function(n){return n<10?"0"+n:""+n;};',
        'var tick=function(){cds.forEach(function(box){',
        'var p=parts(box.getAttribute("data-to")),units=box.querySelector(".wr-cd-units");',
        'if(!p){if(units)units.outerHTML="<div class=\\"wr-cd-title\\">"+(box.getAttribute("data-end")||"时间到！")+"</div>";return;}',
        'var set=function(k,v){var el=box.querySelector("[data-cd=\\""+k+"\\"]");if(el)el.textContent=String(v);};',
        'set("d",p.d);set("h",pad(p.h));set("m",pad(p.m));set("s",pad(p.s));',
        '});};',
        'tick();setInterval(tick,1000);',
        '}'
      );
    }
    if (f.compare) {
      L.push(
        '[].forEach.call(document.querySelectorAll(".wr-compare"),function(box){',
        'var r=box.querySelector(".wr-cmp-range");if(!r)return;',
        'var apply=function(){box.style.setProperty("--wr-cmp-pos",r.value+"%");};',
        'r.addEventListener("input",apply);apply();',
        '});'
      );
    }
    if (f.newsletter) {
      L.push(
        '[].forEach.call(document.querySelectorAll(".wr-sub-form[data-nosubmit]"),function(form){',
        'form.addEventListener("submit",function(e){e.preventDefault();',
        'var box=form.parentNode,msg=box.querySelector(".wr-sub-msg");',
        'if(msg)msg.hidden=false;});',
        '});'
      );
    }
    if (f.share) {
      L.push(
        '[].forEach.call(document.querySelectorAll(".wr-share"),function(box){',
        'var toast=box.querySelector(".wr-share-toast");',
        'var flash=function(){if(!toast)return;toast.hidden=false;setTimeout(function(){toast.hidden=true;},1800);};',
        '[].forEach.call(box.querySelectorAll("[data-share=\\"copy\\"]"),function(btn){',
        'btn.addEventListener("click",function(){',
        'var url=location.href;',
        'var done=function(){flash();};',
        'if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(done,function(){fallback();});}else{fallback();}',
        'function fallback(){var ta=document.createElement("textarea");ta.value=url;ta.style.position="fixed";ta.style.opacity="0";',
        'document.body.appendChild(ta);ta.select();try{document.execCommand("copy");}catch(e){}document.body.removeChild(ta);done();}',
        '});});',
        '[].forEach.call(box.querySelectorAll("[data-share=\\"wechat\\"]"),function(btn){',
        'btn.addEventListener("click",function(){flash();});});',
        '});'
      );
    }
    if (f.checkbox) {
      L.push(
        '[].forEach.call(document.querySelectorAll(".wr-checkset"),function(box){',
        'var btn=box.querySelector(".wr-chk-btn"),res=box.querySelector(".wr-chk-result");',
        'if(!btn||!res)return;',
        'btn.addEventListener("click",function(){',
        'var vals=[].slice.call(box.querySelectorAll("input[type=checkbox]:checked")).map(function(i){return i.value;});',
        'res.textContent=(box.getAttribute("data-wr-prefix")||"")+vals.join("、");',
        'res.hidden=false;});});'
      );
    }
    L.push('})();');
    return L.join('\n');
  }

  /* 导出时把整份工程一起写进页面（<script type="application/json" id="wr-model">）。
     同一个页面再导入时直接按原样还原：颜色、渐变、宽度、主题样式、组件类型都不用靠猜。
     只写「结构 + 样式」不写素材表；素材引用在序列化时展开成真实 data URI，导入方拿到就能用。
     超过 4MB 就不写了（再多会把导出的 HTML 撑到导入上限附近），退化为结构解析。 */
  var MODEL_MAX_BYTES = 4 * 1024 * 1024;
  function exportModelJSON() {
    try {
      var mk = function (pageObj) {
        return JSON.stringify({
          v: 1,
          name: state.name,
          page: pageObj,
          blocks: state.blocks
        }, function (k, v) {
          if (typeof v === 'string' && v.indexOf('asset:') === 0) {
            var real = '';
            try { real = resolveMedia(v) || ''; } catch (e) { }
            return real || v;
          }
          return v;
        });
      };
      var raw = mk(state.page);
      if (raw && raw.length > MODEL_MAX_BYTES) {
        // 开场片常常是几 MB 的 data URI：体积超限时先把它摘掉再试一次，
        // 别为了一个可选动画把整份工程快照丢掉（结构 / 颜色 / 主题比开场片重要）
        var slim = Object.assign({}, state.page);
        delete slim.introFilm;
        delete slim.introPoster;
        raw = mk(slim);
      }
      if (!raw || raw.length > MODEL_MAX_BYTES) {
        try { console.warn('工程快照过大（' + Math.round(String(raw || '').length / 1024) + 'KB），本次导出不内嵌'); } catch (e) { }
        return '';
      }
      // 别让 JSON 里的 </script> 提前闭合标签
      return raw.replace(/</g, '\\u003c');
    } catch (e) { return ''; }
  }

  function exportHTML() {
    var p = state.page;
    var font = p.font === 'serif'
      ? 'Georgia,"Songti SC","SimSun",serif'
      : '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif';
    var out = outputBlocks();
    var body = renderBlocks(out.list, false, null);
    var fx = fxFlags();
    lastExportInfo = { hoisted: out.hoisted, sticky: hasStickyNav(out.list), fx: fx };
    var title = esc(String(state.name || '我的网页'));
    var desc = esc(String(p.description || '').trim() || String(state.name || '我的网页'));
    var accent = safeCssColor(p.accent);
    // 首帧之前就要把 .wr-intro 挂上，否则页面会先闪一下再被幕布盖住
    var headJs = [];
    if (fx.anim) headJs.push('document.documentElement.classList.add("wr-js"' + (fx.respect ? '' : ',"wr-force"') + ');');
    if (fx.intro.style !== 'none') headJs.push(introGateJS(fx.intro));
    var hasAppearance = appearanceFlags() > 0;
    if (hasAppearance) headJs.push(appearanceRestoreJS());
    // 标签页图标：没设就用站点名首字生成的图标，导出的单文件 HTML 也有自己的标签页图标
    var favHref = faviconHref();
    var favTags = '<link rel="icon" href="' + esc(favHref || 'data:,') + '">\n' +
      (favHref ? '<link rel="apple-touch-icon" href="' + esc(favHref) + '">\n' : '');
    var modelJson = exportModelJSON();
    var modelTag = modelJson ? '<script type="application/json" id="wr-model">' + modelJson + '</script>\n' : '';
    return '<!doctype html>\n' +
      '<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + title + '</title>\n' +
      favTags +
      '<meta name="description" content="' + desc + '">\n' +
      '<meta name="theme-color" content="' + accent + '">\n' +
      '<meta property="og:type" content="website">\n' +
      '<meta property="og:title" content="' + title + '">\n' +
      '<meta property="og:description" content="' + desc + '">\n' +
      '<meta name="generator" content="WR Studio">\n' +
      '<style>\n' +
      '*,*::before,*::after{box-sizing:border-box}\n' +
      'html{scroll-behavior:smooth;overscroll-behavior:contain}\n' +
      '@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}\n' +
      'body{margin:0;background:var(--wr-page-bg,' + paint(p.bg, '#ffffff') + ');color:var(--wr-page-text,' + (p.text ? safeCssColor(p.text) : '#16233a') + ');font-family:' + font + ';line-height:1.7;-webkit-font-smoothing:antialiased}\n' +
      'img{max-width:100%;display:block}\n' +
      'a{color:' + accent + '}\n' +
      'input,textarea,button{font-family:inherit}\n' +
      // 有吸顶导航时不能给 .wr-page 加 overflow（hidden/auto 会把它变成吸附容器，
      // clip 在部分浏览器同样会截断 sticky）；无吸顶时只裁横向，保留纵向阴影与自定义定位
      '.wr-page{max-width:' + Number(p.maxWidth || 960) + 'px;margin:0 auto;background:var(--wr-page-bg,' + paint(p.bg, '#ffffff') + ')' +
        (lastExportInfo.sticky ? ';overflow:visible' : ';overflow-x:clip;overflow-y:visible') + '}\n' +
      '.wr-page section{width:100%}\n' +
      '@media print{\n' +
      '.wr-page{max-width:none!important}\n' +
      'body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}\n' +
      'section{break-inside:avoid}\n' +
      '.wr-nav-burger,.wr-nav-cb,.wr-form,button,.wr-video-btn{display:none!important}\n' +
      'a{text-decoration:none}\n' +
      '}\n' +
      componentCSS(false) + '\n' +
      '</style>\n' +
      (headJs.length ? '<script>' + headJs.join('') + '</script>\n' : '') +
      '</head>\n<body>\n' + introHTML(fx.intro) + '<main class="wr-page" id="top">\n' + body + '\n</main>\n' + modelTag + hintHTML(fx.intro) +
      (fx.any ? '<script>\n' + fxScript(fx) + '\n</script>\n' : '') +
      (socialFlags() ? '<script>\n' + socialScript() + '\n</script>\n' : '') +
      (hasAppearance ? '<script>\n' + appearanceScript() + '\n</script>\n' : '') +
      (filmFlags().any ? '<script>\n' + filmScript() + '\n</script>\n' : '') +
      (interactiveFlags().any ? '<script>\n' + interactiveScript(interactiveFlags()) + '\n</script>\n' : '') +
      '</body>\n</html>\n';
  }
  function fileName(ext) {
    var base = String(state.name || '我的网页').replace(/[\\/:*?"<>|]/g, '_').trim() || '我的网页';
    return base + '.' + ext;
  }
  function download(text, name, mime) {
    var blob = new Blob([text], { type: mime || 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('✓ HTML 代码已复制到剪贴板'); })
        .catch(function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('✓ HTML 代码已复制'); }
    catch (e) { toast('复制失败，请改用「导出 HTML」', true); }
    ta.remove();
  }

  /* ---------- 预览 ---------- */
  function openPreview() {
    var frame = $('#previewFrame');
    frame.setAttribute('data-device', device);
    previewMode = true;
    frame.srcdoc = exportHTML();
    previewMode = false;
    var sub = $('#previewSub');
    if (sub) {
      sub.textContent = lastExportInfo.hoisted
        ? '已自动把 ' + lastExportInfo.hoisted + ' 个容器内的吸顶导航放到页面顶部'
        : (lastExportInfo.sticky ? '吸顶导航已开启 · 滚动页面查看效果' : '与导出的 HTML 完全一致');
    }
    $('#previewModal').hidden = false;
    $$('.modal-devices .dev-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-pdevice') === device); });
  }
  function closeModals() {
    $('#previewModal').hidden = true;
    $('#helpModal').hidden = true;
    if ($('#motionModal')) $('#motionModal').hidden = true;
    $('#previewFrame').srcdoc = '';
    if (!$('#compModal').hidden) closeCompModal();
  }

  /* ---------- 共享交互状态 ---------- */
  var DEVICE_LABELS = { desktop: '桌面 · 960px', tablet: '平板 · 768px', mobile: '手机 · 390px' };
  function setDevice(d) {
    device = DEVICE_LABELS[d] ? d : 'desktop';
    $$('.device-switch .dev-btn').forEach(function (x) {
      x.classList.toggle('active', x.getAttribute('data-device') === device);
    });
    $$('.modal-devices .dev-btn').forEach(function (x) {
      x.classList.toggle('active', x.getAttribute('data-pdevice') === device);
    });
    $('#deviceLabel').textContent = DEVICE_LABELS[device];
    cancelCanvasRender();
    renderCanvas();
  }
  /* 窄屏把左右面板变成抽屉，而不是直接隐藏导致无法编辑 */
  function openDrawer(which) {
    var left = $('.panel-left'), right = $('.panel-right'), mask = $('#drawerMask');
    left.classList.toggle('open', which === 'assets');
    right.classList.toggle('open', which === 'props');
    mask.hidden = false;
    $('#toggleAssets').setAttribute('aria-expanded', String(which === 'assets'));
    $('#toggleProps').setAttribute('aria-expanded', String(which === 'props'));
  }
  function closeDrawers() {
    var left = $('.panel-left'), right = $('.panel-right'), mask = $('#drawerMask');
    var wasOpen = left.classList.contains('open') || right.classList.contains('open');
    left.classList.remove('open'); right.classList.remove('open');
    mask.hidden = true;
    $('#toggleAssets').setAttribute('aria-expanded', 'false');
    $('#toggleProps').setAttribute('aria-expanded', 'false');
    return wasOpen;
  }
  /* 颜色字段是一组控件（色块 / 吸色器 / 文本框），保持三者同步 */
  function syncColorRow(el) {
    var field = el.closest && el.closest('.color-field');
    if (!field) return;
    var picker = $('.color-native', field);
    var text = $('input.prop-input[data-key]', field);
    var prev = $('.color-prev', field);
    var mode = $('.color-mode', field);
    if (!picker || !text) return;
    if (el === picker) {
      text.value = picker.value;
      if (prev) prev.style.background = picker.value;
      field.classList.remove('is-grad');
      if (mode) mode.classList.remove('active');
    } else if (el === text) {
      var val = text.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) picker.value = val;
      if (prev) prev.style.background = safePaint(val, '#ffffff');
      var grad = isGradient(val);
      field.classList.toggle('is-grad', grad);
      if (mode) mode.classList.toggle('active', grad);
    }
  }
  /* 属性项很多，支持按标签文字过滤；重绘面板后会自动重新应用 */
  function applyPropSearch(q) {
    var box = $('#propPanel'), input = $('#propSearch');
    q = String(q == null ? (input ? input.value : '') : q).trim().toLowerCase();
    $$('.prop-field', box).forEach(function (f) {
      var txt = f.textContent + ' ' + (f.getAttribute('data-q') || '');
      f.hidden = !!q && txt.toLowerCase().indexOf(q) < 0;
    });
    $$('.prop-group, details.common-sec', box).forEach(function (g) {
      var any = $$('.prop-field', g).some(function (f) { return !f.hidden; });
      g.hidden = !!q && !any;
      if (q && !g.hidden && g.tagName === 'DETAILS') g.open = true;
    });
  }

  /* ---------- 动效库 ----------
     参考 web motion showcase 的分类方式：进入 / 悬停 / 常驻 / 页面。
     卡片里的预览直接用导出页同一套 wr-* 类，所以「看到的」就是「导出后的」。 */
  var MOTION_CATS = [
    { id: 'anim', name: '进入', hint: '滚动到可视区域时播放' },
    { id: 'hover', name: '悬停', hint: '鼠标移上去才触发' },
    { id: 'loop', name: '常驻', hint: '一直循环，做氛围' },
    { id: 'page', name: '页面 / 光标', hint: '整页生效，开关式' }
  ];
  var MOTIONS = [
    /* --- 进入 --- */
    { cat: 'anim', key: 'up', name: '上移淡入', en: 'Fade In Up', desc: '从下方浮入，最百搭的入场。' },
    { cat: 'anim', key: 'down', name: '下移淡入', en: 'Fade In Down', desc: '自上方落下，适合接在标题后。' },
    { cat: 'anim', key: 'left', name: '向右滑入', en: 'Slide From Left', desc: '从左侧推入，配合图片更自然。' },
    { cat: 'anim', key: 'right', name: '向左滑入', en: 'Slide From Right', desc: '从右侧推入，适合并列卡片。' },
    { cat: 'anim', key: 'fade', name: '纯淡入', en: 'Fade In', desc: '只改透明度，最克制。' },
    { cat: 'anim', key: 'zoom', name: '缩放淡入', en: 'Zoom In', desc: '从 92% 放大到原始大小。' },
    { cat: 'anim', key: 'pop', name: '弹入放大', en: 'Pop In', desc: '从 72% 弹起，配「回弹」缓动。' },
    { cat: 'anim', key: 'rotate', name: '旋转淡入', en: 'Rotate In', desc: '轻微转角进入，活泼一点。' },
    { cat: 'anim', key: 'flip', name: '翻转展开', en: 'Flip In', desc: '沿 X 轴翻起，像卡片立起来。' },
    { cat: 'anim', key: 'unfold', name: '3D 翻开', en: '3D Unfold', desc: '沿 Y 轴翻开，带透视纵深。' },
    { cat: 'anim', key: 'swing', name: '摆动入场', en: 'Swing In', desc: '一边摆动一边落位。' },
    { cat: 'anim', key: 'skew', name: '斜切入场', en: 'Skew In', desc: '斜切变形，偏运动风。' },
    { cat: 'anim', key: 'mask', name: '遮罩揭示', en: 'Mask Reveal', desc: '像幕布一样自下而上揭开。' },
    { cat: 'anim', key: 'rise', name: '遮罩升起', en: 'Mask Rise', desc: '遮罩 + 位移，文字逐行升起的质感。' },
    { cat: 'anim', key: 'blur', name: '模糊聚焦', en: 'Blur In', desc: '从高斯模糊到清晰，画展感。' },
    { cat: 'anim', key: 'blurup', name: '模糊上移', en: 'Blur Up', desc: '模糊 + 上浮同时收敛。' },
    { cat: 'anim', key: 'drop', name: '垂落入场', en: 'Drop In', desc: '从上方 2 倍距离落下。' },
    { cat: 'anim', key: 'wipe', name: '横向擦除', en: 'Wipe Reveal', desc: '像下拉幕布一样横向揭开。' },
    { cat: 'anim', key: 'blurzoom', name: '模糊放大', en: 'Blur Zoom', desc: '从模糊的放大状态收回来，画展感。' },
    { cat: 'anim', key: 'spring', name: '弹跳入场', en: 'Spring In', desc: '略微歪着弹进来，配回弹曲线。' },
    { cat: 'anim', key: 'slideblur', name: '模糊滑入', en: 'Blur Slide', desc: '一边滑入一边聚焦，适合图片。' },
    /* --- 悬停 --- */
    { cat: 'hover', key: 'lift', name: '悬停上浮', en: 'Hover Lift', desc: '上移 6px，最通用的提拉反馈。' },
    { cat: 'hover', key: 'lift-lg', name: '大幅上浮', en: 'Big Lift', desc: '上移 14px 并轻微放大。' },
    { cat: 'hover', key: 'zoom', name: '放大', en: 'Hover Zoom', desc: '整体放大 3%，不改变布局。' },
    { cat: 'hover', key: 'glow', name: '柔光发光', en: 'Accent Glow', desc: '主题色投影，按钮 / 卡片都合适。' },
    { cat: 'hover', key: 'shadow', name: '阴影增强', en: 'Hover Shadow', desc: '只加深投影，元素像被光托起。' },
    { cat: 'hover', key: 'shine', name: '扫光掠过', en: 'Shine Sweep', desc: '一道斜光从左侧扫过。' },
    { cat: 'hover', key: 'tilt', name: '3D 倾斜', en: '3D Tilt', desc: '跟随鼠标轻微倾斜。' },
    { cat: 'hover', key: 'tilt-glare', name: '镜面反光', en: 'Glass Glare Tilt', desc: '3D 倾斜 + 跟随光标的菲涅尔高光。' },
    { cat: 'hover', key: 'magnet', name: '磁吸跟随', en: 'Magnetic', desc: '指针靠近时元素被轻轻吸过去。' },
    { cat: 'hover', key: 'press', name: '按压回弹', en: 'Press Down', desc: '按下时下沉 2px 再弹回。' },
    { cat: 'hover', key: 'outline', name: '描边高亮', en: 'Outline', desc: '出现主题色描边，适合选中态。' },
    { cat: 'hover', key: 'border', name: '流光描边', en: 'Border Beam', desc: '高亮光柱沿边框绕圈。' },
    { cat: 'hover', key: 'spot', name: '光标光斑', en: 'Spotlight Card', desc: '卡片内跟着光标走的柔光。' },
    { cat: 'hover', key: 'underline', name: '下划线展开', en: 'Underline Reveal', desc: '底部线条从左向右伸展。' },
    { cat: 'hover', key: 'imgzoom', name: '图片放大', en: 'Image Zoom', desc: '内部图片放大 8%，圆角不溢出。' },
    { cat: 'hover', key: 'saturate', name: '图片增彩', en: 'Saturation Shift', desc: '从低饱和过渡到全彩。' },
    { cat: 'hover', key: 'dir', name: '方向感知划入', en: 'Direction Aware', desc: '从鼠标进来的那一侧滑入。' },
    { cat: 'hover', key: 'wipe', name: '遮罩揭示', en: 'Hover Wipe', desc: '主题色遮罩从左向右铺开。' },
    { cat: 'hover', key: 'glitch', name: '故障抖动', en: 'Glitch Shake', desc: '轻微抖动 + 色散，赛博 / 作品站风格。' },
    { cat: 'hover', key: 'glass', name: '毛玻璃抬升', en: 'Glass Lift', desc: '背景模糊、内描边亮起并轻轻抬起。' },
    { cat: 'hover', key: 'arrow', name: '箭头滑动', en: 'Arrow Slide', desc: '右箭头向右滑出，适合按钮和链接。' },
    { cat: 'hover', key: 'unblur', name: '图片去模糊', en: 'Image Unblur', desc: '图片由虚到实，像镜头对焦。' },
    { cat: 'hover', key: 'flip3d', name: '3D 翻转', en: '3D Flip', desc: '悬停沿 Y 轴翻面，带透视纵深。' },
    { cat: 'hover', key: 'zoomblur', name: '模糊缩放', en: 'Blur Zoom', desc: '图片从轻微模糊放大回到清晰。' },
    /* --- 常驻 --- */
    { cat: 'loop', key: 'float', name: '上下浮动', en: 'Float', desc: '5.5 秒一个来回，很轻。' },
    { cat: 'loop', key: 'pulse', name: '呼吸缩放', en: 'Pulse', desc: '2.5% 的缩放呼吸。' },
    { cat: 'loop', key: 'breathe', name: '光晕呼吸', en: 'Glow Breathe', desc: '投影一亮一暗地呼吸。' },
    { cat: 'loop', key: 'shine', name: '流光扫过', en: 'Loop Shine', desc: '每隔几秒扫过一道光。' },
    { cat: 'loop', key: 'beam', name: '流光边框', en: 'Border Beam', desc: '渐变光柱绕边框匀速转圈。' },
    { cat: 'loop', key: 'gradient', name: '渐变流动', en: 'Gradient Flow', desc: '彩色柔光在底色里缓慢流动。' },
    { cat: 'loop', key: 'sway', name: '轻微摇摆', en: 'Sway', desc: '±0.7° 的摆动，像挂着的牌子。' },
    { cat: 'loop', key: 'ring', name: '光圈扩散', en: 'Ring Pulse', desc: '一圈描边向外扩散后消失。' },
    { cat: 'loop', key: 'metal', name: '金属光泽文字', en: 'Metallic Shimmer', desc: '标题刷上一层会流动的银色高光。' },
    { cat: 'loop', key: 'typewriter', name: '打字机', en: 'Typewriter', desc: '逐字敲出标题，末尾带闪烁光标。' },
    { cat: 'loop', key: 'marquee', name: '横向跑马灯', en: 'Marquee Drift', desc: '整块轻微横移；完整的循环文字用「跑马灯标题」组件。' },
    { cat: 'loop', key: 'blink', name: '在线呼吸点', en: 'Live Dot', desc: '右上角亮起一枚呼吸的在线状态点。' },
    { cat: 'loop', key: 'shimmer', name: '骨架微光', en: 'Skeleton Shine', desc: '一道高光反复扫过，适合加载占位。' },
    { cat: 'loop', key: 'orbit', name: '轨道旋转', en: 'Orbit Drift', desc: '轻微旋转 + 上浮，给卡片一点太空感。' },
    { cat: 'loop', key: 'rgbshift', name: '色差闪烁', en: 'RGB Shift', desc: '标题偶尔出现品红 / 青色错位，赛博风。' },
    /* --- 页面 / 光标 --- */
    { cat: 'page', key: 'spotlight', name: '背景聚光灯', en: 'Page Spotlight', desc: '整页背景跟着鼠标亮起一块光。' },
    { cat: 'page', key: 'parallax', name: '视差滚动', en: 'Parallax Scroll', desc: '顶层图片 / 文字按不同速度移动。' },
    { cat: 'page', key: 'ripple', name: '点击波纹', en: 'Button Ripple', desc: '点按钮从落点扩散一圈水波。' },
    { cat: 'page', key: 'scrollShadow', name: '滚动导航阴影', en: 'Scroll Shadow', desc: '滚动后吸顶导航浮起一层投影。' },
    { cat: 'page', key: 'countUp', name: '数字滚动', en: 'Count Up', desc: '统计数字从 0 缓动到目标值。' },
    { cat: 'page', key: 'trail', name: '光标拖尾', en: 'Cursor Trail', desc: '鼠标划过留下渐隐光点。' },
    { cat: 'page', key: 'pageVeil', name: '页面转场', en: 'Page Veil', desc: '点击站内链接时幕布过渡。' },
    { cat: 'page', key: 'grain', name: '颗粒质感', en: 'Film Grain', desc: '整页叠一层极淡噪点，创作站常用。' }
  ];
  var PAGE_MO_GLYPH = {
    spotlight: '◎', parallax: '▤', ripple: '◌', scrollShadow: '▁', countUp: '128', trail: '⋯', pageVeil: '▮', grain: '▦'
  };
  var MO_THUMB = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E" +
    "%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E" +
    "%3Cstop stop-color='%236ab0ff'/%3E%3Cstop offset='.55' stop-color='%234b7cff'/%3E%3Cstop offset='1' stop-color='%238b5cf6'/%3E" +
    "%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='80' fill='url(%23g)'/%3E%3C/svg%3E";
  var motionTab = 'all';

  function motionState(m) {
    if (m.cat === 'page') return state.page[m.key] === '1';
    var b = selectedId ? getBlock(selectedId) : null;
    if (!b) return false;
    return m.cat === 'anim' ? animOf(b.p) === m.key
      : (m.cat === 'hover' ? cv(b.p, 'boxHover') === m.key : cv(b.p, 'loopFx') === m.key);
  }
  function motionCardHTML(m) {
    var on = motionState(m);
    var stage;
    if (m.cat === 'page') {
      stage = '<div class="mo-stage mo-stage-page"><span class="mo-glyph mo-glyph-' + m.key + '">' + (PAGE_MO_GLYPH[m.key] || '✦') + '</span></div>';
    } else {
      var cls = m.cat === 'anim' ? '' : ' wr-' + m.cat + '-' + m.key;
      stage = '<div class="mo-stage' + (m.cat === 'anim' ? ' wr-force' : '') + '">' +
        '<div class="mo-tile' + cls + (m.cat === 'anim' ? ' wr-in' : '') + '"' + (m.cat === 'anim' ? ' data-anim="' + m.key + '"' : '') + '>' +
        '<img alt="" src="' + MO_THUMB + '"><b>Aa</b></div></div>';
    }
    return '<button type="button" class="mo-card' + (on ? ' is-on' : '') + '" data-mo-cat="' + m.cat + '" data-mo-key="' + m.key + '">' +
      stage +
      '<span class="mo-name">' + m.name + (on ? '<i class="mo-on">已应用</i>' : '') + '</span>' +
      '<span class="mo-en">' + m.en + '</span>' +
      '<span class="mo-desc">' + m.desc + '</span>' +
      (m.cat === 'page' ? '<span class="mo-switch' + (on ? ' is-on' : '') + '">' + (on ? '已开启' : '点击开启') + '</span>' : '') +
      '</button>';
  }
  function renderMotionTabs() {
    var box = $('#motionTabs');
    if (!box) return;
    var all = [{ id: 'all', name: '全部' }].concat(MOTION_CATS);
    box.innerHTML = all.map(function (c) {
      var n = c.id === 'all' ? MOTIONS.length : MOTIONS.filter(function (m) { return m.cat === c.id; }).length;
      return '<button type="button" class="mo-tab' + (motionTab === c.id ? ' active' : '') + '" data-mo-tab="' + c.id + '">' +
        c.name + '<i>' + n + '</i></button>';
    }).join('');
  }
  function renderMotionGrid() {
    var body = $('#motionBody');
    if (!body) return;
    renderMotionTabs();
    var html = '';
    MOTION_CATS.forEach(function (cat) {
      if (motionTab !== 'all' && motionTab !== cat.id) return;
      var items = MOTIONS.filter(function (m) { return m.cat === cat.id; });
      if (!items.length) return;
      html += '<section class="mo-sec"><h4>' + cat.name + '<small>' + items.length + ' 种 · ' + cat.hint + '</small></h4>' +
        '<div class="mo-grid">' + items.map(motionCardHTML).join('') + '</div></section>';
    });
    if (!html) html = '<p class="mo-empty">这一类还没有效果。</p>';
    body.innerHTML = html;
    var sub = $('#motionSub');
    if (sub) {
      var b = selectedId ? getBlock(selectedId) : null;
      sub.textContent = b
        ? '当前模块：' + (ASSET_MAP[b.type] ? ASSET_MAP[b.type].label : b.type) + ' · 点卡片即可应用'
        : '先在画布选中模块再点效果；页面级效果可直接开关';
    }
    // 进入动画：默认就是终态（不会出现空白卡片），渲染后再统一倒回去重播一遍
    var anims = $$('.mo-card[data-mo-cat="anim"] .mo-tile', body);
    if (anims.length) {
      requestAnimationFrame(function () {
        anims.forEach(function (el) { el.classList.remove('wr-in'); });
        requestAnimationFrame(function () {
          anims.forEach(function (el, i) {
            el.style.setProperty('--wr-adelay', Math.min(600, i * 45) + 'ms');
            el.classList.add('wr-in');
          });
        });
      });
      // 兜底：万一动画帧被节流（后台标签页等），1.2 秒后强制回到终态
      setTimeout(function () {
        anims.forEach(function (el) { el.classList.add('wr-in'); });
      }, 1200);
    }
  }
  function openMotion() {
    if (!selectedId && motionTab === 'all') motionTab = 'all';
    $('#motionModal').hidden = false;
    renderMotionGrid();
  }
  function closeMotion() { $('#motionModal').hidden = true; }
  function applyMotion(card) {
    var cat = card.getAttribute('data-mo-cat');
    var key = card.getAttribute('data-mo-key');
    var m = null;
    MOTIONS.forEach(function (x) { if (x.cat === cat && x.key === key) m = x; });
    if (!m) return;
    if (cat === 'page') {
      state.page[key] = state.page[key] === '1' ? '0' : '1';
      pushHistory(); renderAll(); renderMotionGrid();
      toast((state.page[key] === '1' ? '已开启：' : '已关闭：') + m.name);
      return;
    }
    var b = selectedId ? getBlock(selectedId) : null;
    if (!b) { toast('先在画布上选中一个模块，再点效果应用', true); return; }
    if (cat === 'anim') b.p.animIn = key;
    else if (cat === 'hover') b.p.boxHover = key;
    else b.p.loopFx = key;
    pushHistory(); renderAll(); renderMotionGrid();
    toast('已应用到当前模块：' + m.name);
  }
  /* 动效库里的打字机演示：只演这一块，不碰画布 */
  function typeTile(tile) {
    var t = tile && tile.querySelector('b');
    if (!t) return;
    var full = t.getAttribute('data-full') || t.textContent || 'Aa';
    t.setAttribute('data-full', full);
    if (t.wrTimer) clearTimeout(t.wrTimer);
    t.textContent = '';
    var cur = document.createElement('i');
    cur.className = 'wr-type-cursor';
    t.appendChild(cur);
    var i = 0;
    (function step() {
      if (i >= full.length) { t.wrTimer = setTimeout(function () { if (cur.parentNode) cur.remove(); }, 900); return; }
      t.insertBefore(document.createTextNode(full.charAt(i)), cur);
      i++;
      t.wrTimer = setTimeout(step, 120);
    })();
  }
  function bindMotion() {
    var modal = $('#motionModal');
    if (!modal) return;
    $('#closeMotion').addEventListener('click', closeMotion);
    $('#motionTabs').addEventListener('click', function (e) {
      var t = e.target.closest('[data-mo-tab]');
      if (!t) return;
      motionTab = t.getAttribute('data-mo-tab');
      renderMotionGrid();
      $('#motionBody').scrollTop = 0;
    });
    $('#motionBody').addEventListener('click', function (e) {
      var card = e.target.closest('.mo-card');
      if (card) applyMotion(card);
    });
    // 悬停卡片时在预览块上补 .is-hover / 重播进场，等于「鼠标一动就能看到效果」
    $('#motionBody').addEventListener('pointerover', function (e) {
      var card = e.target.closest('.mo-card');
      if (!card || card.contains(e.relatedTarget)) return;
      var tile = $('.mo-tile', card);
      if (!tile) return;
      if (card.getAttribute('data-mo-cat') === 'anim') {
        tile.style.setProperty('--wr-adelay', '0ms');
        tile.classList.remove('wr-in');
        void tile.offsetWidth;
        tile.classList.add('wr-in');
      } else {
        tile.classList.add('is-hover');
        // 打字机在导出页靠注入脚本播放，预览块这里用同一套节奏演一遍
        if (card.getAttribute('data-mo-key') === 'typewriter') typeTile(tile);
      }
    });
    $('#motionBody').addEventListener('pointerout', function (e) {
      var card = e.target.closest('.mo-card');
      if (!card || card.contains(e.relatedTarget)) return;
      var tile = $('.mo-tile', card);
      if (tile) tile.classList.remove('is-hover');
    });
  }

  /* ---------- 顶栏与其它交互 ---------- */
  function bindUI() {
    $('#toggleAssets').addEventListener('click', function () {
      if ($('.panel-left').classList.contains('open')) closeDrawers(); else openDrawer('assets');
    });
    $('#toggleProps').addEventListener('click', function () {
      if ($('.panel-right').classList.contains('open')) closeDrawers(); else openDrawer('props');
    });
    $('#drawerMask').addEventListener('click', closeDrawers);
    $('#propSearch').addEventListener('input', function (e) { applyPropSearch(e.target.value); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1000) closeDrawers(); });
    $('#undoBtn').addEventListener('click', undo);
    $('#redoBtn').addEventListener('click', redo);
    $('#previewBtn').addEventListener('click', openPreview);
    // 深色预览：只给画布加类，让组件 CSS 里的深色规则在编辑器里也生效，导出内容不受影响
    if ($('#darkPreviewBtn')) {
      $('#darkPreviewBtn').addEventListener('click', function () {
        var c = $('#canvas'), btn = $('#darkPreviewBtn');
        var on = !c.classList.contains('is-dark-preview');
        c.classList.toggle('is-dark-preview', on);
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        toast(on ? '深色预览：画布已切到深色，导出不受影响' : '已回到浅色预览');
      });
    }
    if ($('#motionBtn')) $('#motionBtn').addEventListener('click', openMotion);
    // 鼠标落在预览框外的空白处、或页面滚到边界产生滚动链时，把滚轮转发进 iframe 文档。
    // 否则滚动的是弹层本身，整个 iframe 被滚走，吸顶看起来就失效了。
    $('.modal-body').addEventListener('wheel', function (e) {
      if ($('#previewModal').hidden) return;
      var frame = $('#previewFrame');
      // 目标是 iframe 说明是页面滚到边界后的滚动链，外层已禁止滚动，无需重复转发
      if (e.target === frame) return;
      var win = frame.contentWindow;
      if (!win) return;
      e.preventDefault();
      try {
        win.scrollTo({ top: win.pageYOffset + e.deltaY, left: 0, behavior: 'instant' });
      } catch (err) { /* 尚未加载完成时忽略 */ }
    }, { passive: false });
    $('#closePreview').addEventListener('click', closeModals);
    $('#closeHelp').addEventListener('click', closeModals);
    $('#saveBtn').addEventListener('click', function () { saveNow(false); });
    $('#exportBtn').addEventListener('click', function () {
      download(exportHTML(), fileName('html'));
      toast('✓ 已导出 ' + fileName('html'));
    });

    $$('.device-switch .dev-btn').forEach(function (b) {
      b.addEventListener('click', function () { setDevice(b.getAttribute('data-device')); });
    });
    $$('.modal-devices .dev-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        // 预览里的设备宽度与编辑器保持同一状态，关闭预览后不会跳回桌面
        setDevice(b.getAttribute('data-pdevice'));
        $('#previewFrame').setAttribute('data-device', device);
      });
    });

    $('#projectName').addEventListener('input', function (e) {
      state.name = e.target.value;
      $('#stageTitle').textContent = state.name || '未命名页面';
      applyEditorFavicon();
      scheduleHistory(); scheduleSave();
    });

    // 更多菜单
    var moreBtn = $('#moreBtn'), menu = $('#moreMenu');
    moreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      moreBtn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', function () { menu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); });
    menu.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      menu.hidden = true;
      if (act === 'exportJson') {
        download(JSON.stringify(state, null, 2), fileName('json'), 'application/json;charset=utf-8');
        toast('✓ 项目 JSON 已导出');
      } else if (act === 'import') {
        $('#importFile').click();
      } else if (act === 'importHtml') {
        pickHtmlFile();
      } else if (act === 'copyHtml') {
        copyText(exportHTML());
      } else if (act === 'loadSample') {
        state.blocks = sampleBlocks(); selectedId = null;
        pushHistory(); renderAll(); toast('已载入示例页面');
      } else if (act === 'help') {
        $('#helpModal').hidden = false;
      } else if (act === 'clear') {
        if (window.confirm('确定清空画布上的所有模块吗？此操作可以撤销。')) {
          state.blocks = []; selectedId = null;
          pushHistory(); renderAll(); toast('画布已清空');
        }
      }
    });
    $('#importFile').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var clean = sanitizeProject(JSON.parse(ev.target.result));
          if (!clean) throw new Error('格式不正确');
          state = clean;
          selectedId = null;
          history = []; hIdx = -1;
          pushHistory(); renderAll();
          toast('✓ 项目已导入');
        } catch (err) { toast('导入失败：不是有效的项目 JSON', true); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // 导入 HTML 文件（现有网页 → 可编辑模块）
    $('#importHtmlBtn').addEventListener('click', function () { pickHtmlFile(); });
    $('#importHtmlFile').addEventListener('change', function (e) {
      var f = e.target.files[0];
      e.target.value = '';
      importHtmlFile(f);
    });
    $('#impApply').addEventListener('click', function () {
      var picked = document.querySelector('input[name="impMode"]:checked');
      applyImport(picked ? picked.value : 'replace');
    });
    $('#impCancel').addEventListener('click', closeImportModal);
    $('#closeImport').addEventListener('click', closeImportModal);
    $('#importModal').addEventListener('click', function (e) {
      if (e.target === this) closeImportModal();
    });

    // 图片上传
    $('#imageUpload').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      if (files.length) addAssetsOnly(files);
      e.target.value = '';
    });

    // 左侧素材：分组折叠 / 搜索 / 点击直接添加
    $('#assetSearch').addEventListener('input', function (e) {
      assetQuery = e.target.value;
      renderAssets();
    });
    $('#assetGrid').addEventListener('click', function (e) {
      var head = e.target.closest ? e.target.closest('.group-head') : null;
      if (head) {
        var k = head.getAttribute('data-toggle-group');
        collapsedGroups[k] = !collapsedGroups[k];
        renderAssets();
        return;
      }
      var card = e.target.closest ? e.target.closest('.asset-card') : null;
      if (card) {
        var sel = selectedId ? findBlock(selectedId, state.blocks, null) : null;
        var pid = sel ? (isContainer(sel.block) ? sel.block.id : sel.parentId) : null;
        insertBlock(card.getAttribute('data-asset'), null, null, pid);
      }
    });
    $('#myAssets').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del-asset]');
      if (del) {
        var id = del.getAttribute('data-del-asset');
        var gone = state.assets.filter(function (a) { return a.id === id; })[0];
        var cleared = purgeAssetRefs(id, gone && gone.src);
        state.assets = state.assets.filter(function (a) { return a.id !== id; });
        pushHistory(); renderAll();
        toast('素材已删除' + (cleared ? '，已清除 ' + cleared + ' 处引用' : ''));
        return;
      }
      var card = e.target.closest('.my-asset');
      if (card) {
        var a = state.assets.filter(function (x) { return x.id === card.getAttribute('data-asset-id'); })[0];
        if (a) {
          var msel = selectedId ? findBlock(selectedId, state.blocks, null) : null;
          var mpid = msel ? (isContainer(msel.block) ? msel.block.id : msel.parentId) : null;
          insertBlock('image', null, { src: 'asset:' + a.id, alt: a.name, caption: '' }, mpid);
        }
      }
    });

    // 我的组件：点击插入 / 重命名 / 删除
    $('#compGrid').addEventListener('click', function (e) {
      var exp = e.target.closest ? e.target.closest('[data-comp-export]') : null;
      if (exp) {
        var one = (state.components || []).filter(function (x) { return x.id === exp.getAttribute('data-comp-export'); })[0];
        if (one) downloadModules([one], 'wr-module-' + one.name + '.json');
        return;
      }
      var edit = e.target.closest ? e.target.closest('[data-comp-edit]') : null;
      if (edit) { openCompModal(edit.getAttribute('data-comp-edit')); return; }
      var del = e.target.closest ? e.target.closest('[data-comp-del]') : null;
      if (del) { deleteComponent(del.getAttribute('data-comp-del')); return; }
      var card = e.target.closest ? e.target.closest('.comp-card') : null;
      if (card) {
        var csel = selectedId ? findBlock(selectedId, state.blocks, null) : null;
        var cpid = csel ? (isContainer(csel.block) ? csel.block.id : csel.parentId) : null;
        insertComponent(card.getAttribute('data-comp'), null, cpid);
      }
    });
    // 模块文件：上传 / 导出 / 云端同步
    var moduleUpload = $('#moduleUpload');
    if (moduleUpload) moduleUpload.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var json;
        try { json = JSON.parse(String(reader.result)); }
        catch (err) { toast('不是有效的 JSON 文件', true); return; }
        importModules(json, '文件');
      };
      reader.onerror = function () { toast('读取文件失败', true); };
      reader.readAsText(file);
    });
    var exportAll = $('#moduleExportAll');
    if (exportAll) exportAll.addEventListener('click', function () {
      downloadModules(state.components || [], 'wr-modules.json');
    });
    function cloudReady() {
      var P = window.WRPortal;
      if (!P || !P.mode || P.mode() !== 'flask' || !P.currentUser()) {
        toast('请先登录，并通过 Flask 后端打开编辑器', true);
        return false;
      }
      return true;
    }
    var cloudUp = $('#moduleCloudUp');
    if (cloudUp) cloudUp.addEventListener('click', function () {
      if (!cloudReady()) return;
      var list = state.components || [];
      if (!list.length) { toast('还没有模块可上传', true); return; }
      window.WRPortal.saveModules(list).then(function (res) {
        if (res.ok) toast('✓ 已上传 ' + list.length + ' 个模块到账号');
        else toast(res.msg || '上传失败', true);
      });
    });
    var cloudDown = $('#moduleCloudDown');
    if (cloudDown) cloudDown.addEventListener('click', function () {
      if (!cloudReady()) return;
      window.WRPortal.loadModules().then(function (res) {
        if (!res.ok) { toast(res.msg || '读取失败', true); return; }
        importModules({ components: res.items }, '账号');
      });
    });
    // 组件命名弹层
    $('#compIcoPick').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-ico]') : null;
      if (b) pickCompIcon(b.getAttribute('data-ico'));
    });
    $('#compSave').addEventListener('click', submitCompModal);
    $('#compCancel').addEventListener('click', closeCompModal);
    $('#closeComp').addEventListener('click', closeCompModal);
    $('#compName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitCompModal(); }
    });

    // 画布：选中 & 工具条
    $('#canvas').addEventListener('click', function (e) {
      // 编辑器里的链接只作展示，不能真的跳转或打开新标签页
      if (e.target.closest && e.target.closest('a[href]')) e.preventDefault();
      // 社交组件的按钮也只作展示，点了就选中模块，不触发点赞 / 发送
      if (e.target.closest && e.target.closest('[data-like],[data-chat-send]')) e.preventDefault();
      // 外观控件（颜色/深色/字号/主题）在画布里只作展示，不真的改编辑器主题
      if (e.target.closest && e.target.closest('[data-wr-color],[data-wr-darkmode],[data-wr-fs],[data-wr-theme]')) e.preventDefault();
      if (e.target.closest && e.target.closest('.b-resize')) return;
      // 折叠菜单 / FAQ 属于纯 CSS 交互：选中模块但不重绘画布，否则展开状态会被重置
      if (e.target.closest && (e.target.closest('.wr-nav-burger') || e.target.closest('.wr-nav-cb') || e.target.closest('.wr-faq summary'))) {
        var ib = e.target.closest('.b-block');
        if (ib) {
          $$('.b-block.selected', $('#canvas')).forEach(function (el) { el.classList.remove('selected'); });
          ib.classList.add('selected');
          selectedId = ib.getAttribute('data-id');
          renderLayers(); renderProps();
        }
        return;
      }
      var tool = e.target.closest ? e.target.closest('.b-tools button') : null;
      var block = e.target.closest ? e.target.closest('.b-block') : null;
      if (!block) { if (selectedId) selectBlock(null); return; }
      var id = block.getAttribute('data-id');
      if (tool) {
        var act = tool.getAttribute('data-act');
        if (act === 'del') deleteBlock(id);
        else if (act === 'dup') duplicateBlock(id);
        else if (act === 'up') moveBlock(id, -1);
        else if (act === 'down') moveBlock(id, 1);
        else if (act === 'layer') toggleLayer(id);
        return;
      }
      selectBlock(id);
    });
    $('#canvas').addEventListener('submit', function (e) {
      // 搜索框在画布里只预览样式，不真的提交到外部站点
      e.preventDefault();
    });
    $('#canvas').addEventListener('dragstart', function (e) {
      var block = e.target.closest ? e.target.closest('.b-block') : null;
      if (block) {
        setPayload(e, { kind: 'move', id: block.getAttribute('data-id') });
        block.classList.add('dragging');
      }
    });

    // 层级树
    $('#layerTree').addEventListener('click', function (e) {
      var item = e.target.closest('.layer-item');
      if (item) selectBlock(item.getAttribute('data-layer'));
    });

    // 键盘
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#previewModal').hidden || !$('#helpModal').hidden || !$('#compModal').hidden || !$('#motionModal').hidden) { closeModals(); return; }
        if (closeDrawers()) return;
        if (selectedId) { selectBlock(null); return; }
      }
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      // 素材卡 / 我的组件 / 层级项也可用键盘激活
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches &&
          e.target.matches('.asset-card, .my-asset, .comp-card, .layer-item')) {
        e.preventDefault(); e.target.click(); return;
      }
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (selectedId) duplicateBlock(selectedId); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(false); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteBlock(selectedId); }
    });
  }

  function addAssetsOnly(files) {
    var list = imageFiles(files);
    if (!list.length) { toast('请选择 20 MB 以内的图片文件', true); return; }
    toast('正在压缩图片…');
    Promise.all(list.map(addImageAsset)).then(function (assets) {
      var ok = assets.filter(Boolean);
      if (!ok.length) { toast('图片读取失败', true); return; }
      pushHistory(); renderAll();
      toast('✓ 已压缩并上传 ' + ok.length + ' 张图片，可拖到画布使用');
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    var restored = loadLocal();
    bindUI(); bindProps(); bindDrag(); bindResize(); bindLayerDrag(); bindMotion();
    history = [snapshot()]; hIdx = 0;
    renderAll();
    if (raw && !restored) {
      // 数据损坏时留一份副本，别用示例页面悄悄覆盖用户内容
      try { localStorage.setItem(STORAGE_KEY + '-backup', raw); } catch (e) {}
      toast('上次项目数据无法读取，已保留备份；当前载入示例页面', true);
    } else if (restored) {
      toast('已恢复上次编辑的项目');
    } else {
      setTimeout(function () { toast('从左侧拖一个素材到画布开始吧 ✦'); }, 450);
    }
  }
  init();
  // 调试出口（只读，导出页不含这段）
  try {
    window.__wrDebug = function () {
      return { name: state.name, page: state.page, blocks: state.blocks };
    };
  } catch (e) { }
  /* 站点桥接：供门户首页载入模板 / 项目、读取当前项目。
     载入时走同一套 sanitizeProject 白名单，和导入 JSON 完全等价，避免脏数据进画布。 */
  try {
    window.__wrSite = {
      getProject: function () { return JSON.parse(JSON.stringify(state)); },
      loadProject: function (data) {
        var clean = sanitizeProject(data);
        if (!clean) return false;
        state = clean;
        selectedId = null;
        history = [snapshot()]; hIdx = 0;
        renderAll(); writeLocal();
        return true;
      },
      currentDraftExists: function () {
        try { return !!localStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
      }
    };
  } catch (e) { }
})();
