# MyOS 个人作品网站

MyOS 是一个中文优先的单页个人作品网站。它借用桌面系统的熟悉操作来组织个人资料、代表作品和创作实验，并使用原创渐变壁纸与玻璃质感界面。

## 功能

- 桌面菜单栏、应用快捷方式、Dock 与本地时间
- 欢迎、作品、关于我、实验室、联系我、设置和废纸篓七个应用
- 应用单例窗口，支持聚焦、拖拽、八方向缩放、最小化、最大化、关闭和居中
- Spotlight 搜索，可快速查找应用、作品和关键词
- 浅色、深色、跟随系统三种主题，以及三档玻璃效果
- 小于 768px 时自动切换为移动端应用启动器和全屏应用
- 键盘操作、焦点样式、减少动态效果与高对比度适配

## 替换为你的内容

个人内容统一维护在 [`content/portfolio.ts`](./content/portfolio.ts)，无需修改窗口系统：

- 修改 `systemName`、`ownerName`、`role`、`location` 等个人资料。
- 在 `projects` 中替换代表作品的标题、简介、成果、标签与强调色。
- 在 `experiments` 中替换个人实验。
- 更新 `about`、`contact` 和 `trash` 中的介绍、联系方式与内容。
- 如需调整应用名称、图标、是否显示在桌面或 Dock，以及默认窗口大小，修改 `appDefinitions`。

当前示例不使用外部图片。后续添加作品图片时，建议将文件放入 `public/` 并使用站内路径引用。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
git clone https://github.com/jimmmy-192/my-work.git
cd my-work
npm ci
npm run dev
```

在另一台电脑上只需要安装 Node.js 22 或更高版本，再执行以上命令。项目不依赖本机私有文件、环境变量、数据库或外部 API。

构建、检查与测试：

```bash
npm run build
npm run lint
npm test
```

## GitHub Pages

网站地址：<https://jimmmy-192.github.io/my-work/>

每次向 `main` 分支推送后，GitHub Actions 会自动构建并发布完整网站。发布内容来自 `dist/client`，并自动适配 `/my-work/` 子路径。

## Vercel

导入仓库并选择 Vite。仓库中的 `vercel.json` 已设置构建命令 `npm run build` 和输出目录 `dist/client`。Vercel 构建会导出静态首页，并使用域名根路径 `/` 加载资源。

Vercel 和 GitHub Pages 使用浏览器本地设置；账号与跨设备同步由 ChatGPT Sites 的 Worker 提供。

## 目录结构

```text
portfolio-os/
├── app/
│   ├── os/                 # 桌面、窗口管理器与七个应用视图
│   ├── globals.css         # 视觉、响应式与无障碍样式
│   ├── layout.tsx          # 页面元数据与根布局
│   └── page.tsx            # 网站入口
├── content/
│   └── portfolio.ts        # 个人资料、作品和应用配置
├── public/                 # 本地静态资源
└── tests/                  # 窗口逻辑与页面渲染测试
```

## 数据与隐私

当前版本是纯前端作品网站，不接入后端、账号、数据库或外部 API。主题与玻璃效果偏好仅保存在访客当前设备的浏览器中；窗口位置不会持久化，刷新后会恢复默认桌面布局。
