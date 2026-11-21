/* ============================================================
   建站工坊 · 内置模板库
   每个模板是一份「项目数据」：name / page / blocks / assets / components。
   blocks 里只写关键字段，其余由编辑器的 normalizeBlocks 自动补全默认值，
   和编辑器自带的示例页面用的是同一套组件系统，套用后即可自由编辑。
   仅在本站脚本作用域内暴露 window.WR_TEMPLATES（只读数据）。
   ============================================================ */
(function () {
  function block(type, p) {
    return { id: '', type: type, p: p || {} };   // id 留空，编辑器载入时生成
  }
  function page(o) {
    var base = {
      bg: '#ffffff', text: '#16233a', accent: '#3b82f6', maxWidth: 960, font: 'system', description: '',
      fxLevel: '2', cursorGlow: '0', cursorStyle: 'none', magnet: '1',
      scrollBar: '1', backTop: '1', reduceMotion: '1',
      spotlight: '0', parallax: '0', ripple: '0', scrollShadow: '0', countUp: '0', trail: '0', pageVeil: '0',
      introStyle: 'none', introFilm: '', introPoster: '', introDrive: 'scroll', introTitle: '', introSub: '', introBg: '', introDur: 2000, introFreq: 'once',
      hintStyle: 'none', hintText: '滑动鼠标', hintColor: ''
    };
    return Object.assign(base, o || {});
  }
  function proj(name, pageObj, blocks) {
    return { name: name, page: pageObj, blocks: blocks, assets: [], components: [] };
  }

  var T = [
    {
      id: 'corporate',
      name: '企业官网',
      category: '企业商务',
      desc: '适合公司、工作室展示形象与服务，含导航、主视觉、服务、数据、团队、问答与页脚。',
      tags: ['导航', '主视觉', '服务', '团队'],
      color: '#2563eb',
      emoji: '🏢',
      data: proj('企业官网', page({ accent: '#2563eb', bg: '#ffffff' }), [
        block('navbar', { title: '云岚科技', emoji: '◆', navItems: '首页 | #top\n服务 | #service\n关于 | #about\n联系 | #contact', btnText: '联系我们', navCtaHref: '#contact', bg: '#ffffff', color: '#16233a' }),
        block('hero', { kicker: 'YUNLAN TECH', title: '让技术，成为你增长的底气', desc: '我们为成长型企业提供稳定、可扩展的数字化解决方案，从想法到落地，一路同行。', btnText: '了解我们的服务', href: '#service', color: '#ffffff', bg: '#12233f', align: 'center', padY: 88 }),
        block('stats', { title: '', items: '12 | 年行业经验\n300+ | 服务客户\n98% | 客户好评', bg: '#f5f8ff', padY: 44 }),
        block('heading', { text: '我们的服务', fontSize: 32, padY: 44, color: '#16233a', align: 'center' }),
        block('grid', { items: '🏗️ | 定制开发 | 从需求到上线，打造真正契合业务的 products\n📊 | 数据洞察 | 让每一个决策都有数据支撑\n🛡️ | 稳定运维 | 7×24 保障，让你专注业务本身', cols: 3, cardBg: '#f5f8ff', padY: 40 }),
        block('team', { title: '核心团队', cardBg: '#f5f8ff', padY: 44 }),
        block('testimonial', { text: '合作三年，交付一直很稳。技术扎实，沟通也顺畅，是难得的长期伙伴。', author: '张先生', role: '某制造集团 · 数字化负责人', cardBg: '#f5f8ff', padY: 44 }),
        block('faq', { title: '常见问题', cardBg: '#f5f8ff', padY: 44 }),
        block('cta', { title: '准备好开启合作了吗？', desc: '告诉我们你的想法，一起把它变成现实。', btnText: '立即联系', href: '#contact', bg: '#2563eb', padY: 56 }),
        block('footer', { title: '云岚科技', desc: '专注成长型企业的数字化伙伴。', phone: '400-000-0000', email: 'hello@yunlan.example', copyright: '© 2026 云岚科技 · 保留所有权利', bg: '#12233f' })
      ])
    },
    {
      id: 'portfolio',
      name: '个人作品集',
      category: '个人展示',
      desc: '设计师、开发者、自由职业者展示作品与个人简介，简洁有格调。',
      tags: ['主视觉', '画廊', '关于', '联系'],
      color: '#7c3aed',
      emoji: '🎨',
      data: proj('个人作品集', page({ accent: '#7c3aed', bg: '#faf9ff', font: 'system' }), [
        block('navbar', { title: 'LIN STUDIO', emoji: '✦', navItems: '首页 | #top\n作品 | #works\n关于 | #about\n联系 | #contact', btnText: '聊聊合作', navCtaHref: '#contact', bg: '#ffffff' }),
        block('hero', { kicker: 'CREATIVE DESIGNER', title: '你好，我是林一', desc: '独立设计师 & 前端开发者。用设计与代码，做有温度的数字作品。', btnText: '看看作品', href: '#works', color: '#ffffff', bg: '#1a1033', align: 'left', padY: 92 }),
        block('heading', { text: '精选作品', fontSize: 32, padY: 44, align: 'center' }),
        block('gallery', { title: '', cols: 3, gap: 14, padY: 32 }),
        block('twocol', { leftTitle: '关于我', leftText: '六年设计与开发经验，服务过品牌、互联网与文创客户。相信好的作品，来自对细节的较真。', rightTitle: '我能做什么', rightText: '品牌视觉、网页设计、前端开发、交互原型。从一张草图到可上线的完整页面。', cardBg: '#ffffff', padY: 44 }),
        block('quote', { text: '保持好奇，保持动手。', author: '— 我的信条', bg: '#f0ebff', padY: 40 }),
        block('contact', { title: '一起做点有趣的东西', phone: '', email: 'hello@linstudio.example', address: '远程协作 · 全球', cardBg: '#ffffff', padY: 44 }),
        block('footer', { title: 'LIN STUDIO', desc: '设计与代码，皆源于热爱。', phone: '', email: 'hello@linstudio.example', bg: '#1a1033' })
      ])
    },
    {
      id: 'saas',
      name: 'SaaS 产品页',
      category: '产品推广',
      desc: '软件、App、工具产品的落地页，突出卖点、价格方案与行动号召。',
      tags: ['主视觉', '特性', '价格', '问答'],
      color: '#0ea5e9',
      emoji: '🚀',
      data: proj('SaaS 产品页', page({ accent: '#0ea5e9', bg: '#ffffff' }), [
        block('announce', { text: '全新 2.0 版本发布，限时免费试用', emoji: '🎉', btnText: '立即体验', href: '#cta', bg: '#0369a1' }),
        block('navbar', { title: 'Flowly', emoji: '⚡', navItems: '功能 | #features\n价格 | #pricing\nFAQ | #faq', btnText: '免费试用', navCtaHref: '#cta', bg: '#ffffff' }),
        block('hero', { kicker: 'WORK SMARTER', title: '把团队协作，变得前所未有的简单', desc: '任务、文档、沟通一站式完成。少一点切换，多一点专注，让好想法更快落地。', btnText: '免费开始使用', href: '#cta', color: '#ffffff', bg: 'linear-gradient(135deg,#0c4a6e,#0284c7)', align: 'center', padY: 92 }),
        block('logos', { title: '已有 2000+ 团队在用', padY: 36 }),
        block('features', { title: '为什么选择 Flowly', cardBg: '#f0f9ff', padY: 44 }),
        block('pricing', { title: '简单透明的价格', cardBg: '#ffffff', bg: '#f0f9ff', padY: 44 }),
        block('testimonial', { text: '上线两周，团队效率肉眼可见地提升了，界面也很好上手。', author: '李女士', role: '创业团队 · COO', cardBg: '#f0f9ff', padY: 44 }),
        block('faq', { title: '常见问题', cardBg: '#f0f9ff', padY: 44 }),
        block('cta', { title: '今天就用起来', desc: '免费试用 14 天，无需信用卡。', btnText: '免费开始', href: '#top', bg: '#0284c7', padY: 56 }),
        block('footer', { title: 'Flowly', desc: '让协作更简单。', email: 'hi@flowly.example', bg: '#0c4a6e' })
      ])
    },
    {
      id: 'shop',
      name: '电商落地页',
      category: '电商零售',
      desc: '商品推广与活动页，突出产品卖点、用户评价与购买引导。',
      tags: ['主视觉', '商品', '评价', '购买'],
      color: '#e11d48',
      emoji: '🛍️',
      data: proj('电商落地页', page({ accent: '#e11d48', bg: '#fffafb' }), [
        block('navbar', { title: '好物研究所', emoji: '🛍️', navItems: '首页 | #top\n精选 | #features\n评价 | #reviews', btnText: '立即选购', navCtaHref: '#cta', bg: '#ffffff' }),
        block('hero', { kicker: 'NEW ARRIVAL', title: '把日常，过成喜欢的样子', desc: '精选生活好物，用心挑选每一件。为平凡的日子，添一点恰到好处的美好。', btnText: '查看精选', href: '#features', color: '#ffffff', bg: 'linear-gradient(135deg,#9f1239,#e11d48)', align: 'center', padY: 88 }),
        block('heading', { text: '本周精选', fontSize: 32, padY: 40, align: 'center' }),
        block('grid', { items: '🕯️ | 香氛蜡烛 | 温柔香气，治愈一整天的疲惫\n☕ | 手冲咖啡套装 | 从研磨到冲泡，享受仪式感\n📔 | 质感手账 | 记录生活里值得记住的小事', cols: 3, cardBg: '#ffffff', padY: 36 }),
        block('testimonial', { text: '包装很用心，实物比图片还好看，已经推荐给朋友了！', author: '小雨', role: '真实买家', stars: 5, cardBg: '#ffffff', padY: 44 }),
        block('stats', { title: '', items: '10万+ | 满意顾客\n4.9 | 平均评分\n30天 | 无忧退换', bg: '#fff1f2', padY: 40 }),
        block('cta', { title: '喜欢就带回家', desc: '现在下单，享受限时优惠。', btnText: '立即选购', href: '#top', bg: '#e11d48', padY: 52 }),
        block('footer', { title: '好物研究所', desc: '认真挑选每一件生活好物。', email: 'hi@haowu.example', bg: '#4c0519' })
      ])
    },
    {
      id: 'event',
      name: '活动会议页',
      category: '活动推广',
      desc: '峰会、沙龙、发布会页面，含日程安排、演讲嘉宾与报名引导。',
      tags: ['主视觉', '日程', '嘉宾', '报名'],
      color: '#ea580c',
      emoji: '🎤',
      data: proj('活动会议页', page({ accent: '#ea580c', bg: '#fffbf7' }), [
        block('announce', { text: '早鸟票开售中，限时 7 折', emoji: '🎫', btnText: '立即报名', href: '#cta', bg: '#9a3412' }),
        block('navbar', { title: '2026 创作者大会', emoji: '🎤', navItems: '大会介绍 | #top\n日程 | #agenda\n嘉宾 | #speakers', btnText: '报名参会', navCtaHref: '#cta', bg: '#ffffff' }),
        block('hero', { kicker: 'CREATOR SUMMIT 2026', title: '2026 创作者大会', desc: '两天，三十场分享，和一千位同行者一起，聊聊内容、创作与未来。', btnText: '立即报名', href: '#cta', color: '#ffffff', bg: 'linear-gradient(135deg,#7c2d12,#ea580c)', align: 'center', padY: 92 }),
        block('stats', { title: '', items: '2 | 天精彩内容\n30+ | 场主题分享\n1000+ | 位创作者', bg: '#fff7ed', padY: 40 }),
        block('heading', { text: '大会议程', fontSize: 32, padY: 40, align: 'center' }),
        block('timeline', { title: '', timelineItems: '09:00 | 签到入场 | 领取物料，自由交流\n10:00 | 开场 keynote | 主题：创作的下一种可能\n14:00 | 圆桌论坛 | 内容创作者的变现之路\n16:30 | 工作坊 | 从 0 到 1 打造个人品牌', bg: '#fff7ed', padY: 40 }),
        block('team', { title: '演讲嘉宾', cardBg: '#ffffff', padY: 44 }),
        block('cta', { title: '席位有限，先到先得', desc: '和一千位创作者一起，遇见新的可能。', btnText: '立即报名', href: '#top', bg: '#ea580c', padY: 52 }),
        block('footer', { title: '创作者大会', desc: '每年一创作者的聚会。', email: 'hi@creatorconf.example', bg: '#7c2d12' })
      ])
    },
    {
      id: 'blog',
      name: '博客 / 文章页',
      category: '内容资讯',
      desc: '个人博客或内容站，含文章列表、作者卡片与订阅引导。',
      tags: ['导航', '文章', '作者', '订阅'],
      color: '#059669',
      emoji: '📝',
      data: proj('博客 / 文章页', page({ accent: '#059669', bg: '#fafdfb', font: 'system' }), [
        block('navbar', { title: '慢读', emoji: '📖', navItems: '首页 | #top\n文章 | #posts\n关于 | #about', btnText: '订阅', navCtaHref: '#cta', bg: '#ffffff' }),
        block('hero', { kicker: 'SLOW READING', title: '慢下来，读点有意思的', desc: '关于设计、技术与生活的独立思考。不求快，只求每次阅读都有一点收获。', btnText: '开始阅读', href: '#posts', color: '#16233a', bg: '#ecfdf5', align: 'left', padY: 80 }),
        block('heading', { text: '最近文章', fontSize: 30, padY: 40, align: 'left' }),
        block('posts', { title: '', postCols: 2, padY: 32 }),
        block('quote', { text: '写作，是把思考整理清楚的过程。', author: '— 站长手记', bg: '#d1fae5', padY: 36 }),
        block('newsletter', { subTitle: '订阅更新', subDesc: '有新文章时，第一时间通知你。', bg: '#ecfdf5', padY: 44 }),
        block('footer', { title: '慢读', desc: '一份认真写字的小站。', email: 'hi@slowread.example', bg: '#064e3b' })
      ])
    }
  ];

  try { window.WR_TEMPLATES = T; } catch (e) { }
})();
