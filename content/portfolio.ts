import type { AppId } from "../app/os/window-manager";

export interface AppDefinition {
  id: AppId;
  title: string;
  icon: string;
  accent: string;
  desktop: boolean;
  dock: boolean;
  description: string;
  defaultBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  minSize?: {
    width: number;
    height: number;
  };
}

export const portfolioContent = {
  systemName: "MyOS",
  ownerName: "你的名字",
  monogram: "M",
  role: "产品设计师 · 体验创造者",
  location: "上海 / 远程协作",
  availability: "目前开放新的合作机会",
  hero: {
    eyebrow: "MYOS · PERSONAL PORTFOLIO",
    title: "你好，我是你的名字。",
    intro:
      "我把复杂的业务问题，整理成清晰、自然并且让人愿意使用的数字体验。这里收藏着我的代表作品、实验和持续发生的思考。",
  },
  stats: [
    { value: "06+", label: "年产品体验设计" },
    { value: "18", label: "个项目从想法到上线" },
    { value: "04", label: "个正在进行的探索" },
  ],
  projects: [
    {
      id: "aurora-console",
      number: "01",
      title: "Aurora 智能经营工作台",
      category: "B 端产品 · 体验策略",
      year: "2026",
      summary:
        "为多角色经营团队重构从目标拆解、数据诊断到任务协作的完整链路，让重要决策不再淹没在报表里。",
      outcome: "核心任务完成时间缩短 42%",
      tags: ["产品策略", "复杂系统", "Design System"],
      accent: "#6b79ff",
    },
    {
      id: "seed-ai",
      number: "02",
      title: "Seed AI 创作伙伴",
      category: "AI 产品 · 交互设计",
      year: "2025",
      summary:
        "将模糊的创作意图转化为可编辑的工作流，在自动生成与用户掌控感之间找到更可信的平衡。",
      outcome: "首周创作留存提升 28%",
      tags: ["AI 交互", "原型验证", "多模态"],
      accent: "#c56cf0",
    },
    {
      id: "mori-city",
      number: "03",
      title: "Mori 城市生活地图",
      category: "C 端产品 · 服务体验",
      year: "2024",
      summary:
        "围绕周末探索场景设计更轻松的发现与收藏体验，让地点、朋友和当下心情自然地连接起来。",
      outcome: "收藏后的到访转化提升 19%",
      tags: ["用户研究", "移动体验", "品牌表达"],
      accent: "#ff8f63",
    },
  ],
  experiments: [
    {
      id: "living-type",
      title: "会呼吸的字体",
      status: "持续更新",
      summary: "根据阅读速度与环境光线改变字重、字距和节奏的一组可变字体实验。",
      tags: ["Variable Font", "Motion"],
      symbol: "Aa",
    },
    {
      id: "memory-radio",
      title: "记忆电台",
      status: "原型中",
      summary: "把一周的照片、短句和声音整理成三分钟的私人播客。",
      tags: ["Generative AI", "Audio"],
      symbol: "◉",
    },
    {
      id: "soft-cursor",
      title: "柔软光标",
      status: "已归档",
      summary: "探索不同情绪和操作意图下，指针形态与触感反馈可以如何变化。",
      tags: ["Creative Coding", "Haptics"],
      symbol: "↗",
    },
  ],
  about: {
    heading: "设计不是把界面做漂亮，\n而是让复杂的事变得好理解。",
    paragraphs: [
      "我是你的名字，一名关注产品策略与交互体验的设计师。我喜欢进入模糊的问题，从用户、业务和技术的交叉处找到可以真正被推进的方向。",
      "过去几年，我参与过效率工具、内容平台和 AI 产品的从零到一，也搭建过服务多个团队的设计系统。工作之外，我在记录城市、研究动效，以及做一些不急着有答案的小实验。",
    ],
    principles: [
      { title: "先理解，再表达", text: "把问题讲清楚，通常比立刻画出答案更重要。" },
      { title: "真实地一起工作", text: "让设计进入协作现场，而不是停留在交付物里。" },
      { title: "为细节保留余地", text: "好的体验，经常藏在那些没有被要求的半步里。" },
    ],
    facts: ["现居上海", "偏爱清晨工作", "正在学习创意编程", "随身带着一台小相机"],
  },
  contact: {
    heading: "一起做点有意思的事。",
    intro:
      "如果你正在构思一款新产品、想重整一段复杂体验，或只是想聊聊设计与 AI，欢迎给我写信。",
    responseTime: "通常会在 2 个工作日内回复",
    links: [
      { label: "邮箱", value: "hello@yourname.design", href: "mailto:hello@yourname.design" },
      { label: "LinkedIn", value: "你的名字", href: "https://www.linkedin.com" },
      { label: "小红书", value: "@你的名字", href: "https://www.xiaohongshu.com" },
    ],
  },
  trash: {
    items: [
      { name: "第 17 版首页", meta: "被更简单的版本替代", date: "8 月 12 日" },
      { name: "一定会火的社交 App", meta: "后来发现大家只想好好聊天", date: "7 月 28 日" },
      { name: "完美方案.final.final", meta: "世界上并没有完美方案", date: "6 月 03 日" },
    ],
    note: "这里装着没有被采用的方向。它们不是失败，只是帮我走到了别处。",
  },
} as const;

export const appDefinitions: AppDefinition[] = [
  {
    id: "welcome",
    title: "欢迎",
    icon: "⌂",
    accent: "#5d6fff",
    desktop: true,
    dock: true,
    description: "从这里认识我和这套个人系统",
    defaultBounds: { x: 132, y: 96, width: 760, height: 560 },
    minSize: { width: 520, height: 420 },
  },
  {
    id: "work",
    title: "作品",
    icon: "▦",
    accent: "#7868ee",
    desktop: true,
    dock: true,
    description: "三个代表性的产品与体验设计项目",
    defaultBounds: { x: 196, y: 72, width: 900, height: 640 },
    minSize: { width: 620, height: 460 },
  },
  {
    id: "about",
    title: "关于我",
    icon: "◎",
    accent: "#3aa68c",
    desktop: true,
    dock: true,
    description: "我的经历、方法和一些个人侧面",
    defaultBounds: { x: 252, y: 104, width: 780, height: 580 },
    minSize: { width: 560, height: 420 },
  },
  {
    id: "lab",
    title: "实验室",
    icon: "✦",
    accent: "#bd62df",
    desktop: true,
    dock: true,
    description: "没有客户需求的小型创作实验",
    defaultBounds: { x: 318, y: 86, width: 820, height: 600 },
    minSize: { width: 560, height: 420 },
  },
  {
    id: "contact",
    title: "联系我",
    icon: "@",
    accent: "#e46e78",
    desktop: true,
    dock: true,
    description: "合作邀请与日常交流的入口",
    defaultBounds: { x: 376, y: 128, width: 680, height: 500 },
    minSize: { width: 480, height: 380 },
  },
  {
    id: "settings",
    title: "设置",
    icon: "◇",
    accent: "#657585",
    desktop: false,
    dock: true,
    description: "调整主题与玻璃效果",
    defaultBounds: { x: 430, y: 126, width: 620, height: 480 },
    minSize: { width: 460, height: 380 },
  },
  {
    id: "trash",
    title: "废纸篓",
    icon: "⌫",
    accent: "#789b91",
    desktop: true,
    dock: true,
    description: "被放弃的方案和诚实的反思",
    defaultBounds: { x: 500, y: 146, width: 610, height: 470 },
    minSize: { width: 440, height: 360 },
  },
];
