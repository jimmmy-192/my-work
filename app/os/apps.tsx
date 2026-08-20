import { portfolioContent } from "../../content/portfolio";
import { AppIcon, SystemIcon } from "./icons";
import { WALLPAPER_OPTIONS } from "./preferences";
import type { WallpaperPreference } from "./preferences";
import type { AppId } from "./window-manager";

type ThemePreference = "system" | "light" | "dark";
type GlassPreference = "clear" | "standard" | "readable";

interface AppContentProps {
  appId: AppId;
  openApp: (id: AppId) => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  glass: GlassPreference;
  setGlass: (glass: GlassPreference) => void;
  wallpaper: WallpaperPreference;
  setWallpaper: (wallpaper: WallpaperPreference) => void;
}

function AppHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <header className="app-heading">
      <p className="app-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {intro ? <p className="app-intro">{intro}</p> : null}
    </header>
  );
}

function WelcomeApp({ openApp }: Pick<AppContentProps, "openApp">) {
  const { hero, ownerName, role, availability, stats } = portfolioContent;

  return (
    <article className="app-view welcome-view">
      <div className="welcome-hero">
        <div className="welcome-copy">
          <p className="app-eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p className="welcome-role">{role}</p>
          <p className="welcome-intro">{hero.intro}</p>
          <div className="app-actions">
            <button className="primary-action" type="button" onClick={() => openApp("work")}>
              浏览作品 <span aria-hidden="true"><SystemIcon name="arrowRight" size={16} /></span>
            </button>
            <button className="secondary-action" type="button" onClick={() => openApp("about")}>
              关于我
            </button>
          </div>
        </div>
        <div className="welcome-portrait" aria-label={`${ownerName}的个人标识`}>
          <span className="portrait-orbit portrait-orbit-one" aria-hidden="true" />
          <span className="portrait-orbit portrait-orbit-two" aria-hidden="true" />
          <strong aria-hidden="true">{portfolioContent.monogram}</strong>
          <small>{availability}</small>
        </div>
      </div>
      <dl className="stat-grid" aria-label="个人经历概览">
        {stats.map((stat) => (
          <div className="stat-item" key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function WorkApp() {
  return (
    <article className="app-view work-view">
      <AppHeader
        eyebrow="SELECTED WORK · 2024—2026"
        title="代表作品"
        intro="从问题定义到最终上线，这些项目记录了我如何与团队一起把复杂的事情向前推进。"
      />
      <div className="project-grid">
        {portfolioContent.projects.map((project) => (
          <article
            className="project-card"
            key={project.id}
            style={{ "--project-accent": project.accent } as React.CSSProperties}
          >
            <div className="project-visual" aria-hidden="true">
              <span className="project-number">{project.number}</span>
              <span className="project-shape project-shape-one" />
              <span className="project-shape project-shape-two" />
            </div>
            <div className="project-body">
              <div className="project-meta">
                <span>{project.category}</span>
                <time>{project.year}</time>
              </div>
              <h3>{project.title}</h3>
              <p>{project.summary}</p>
              <strong className="project-outcome">{project.outcome}</strong>
              <ul className="tag-list" aria-label={`${project.title}关键词`}>
                {project.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}

function AboutApp({ openApp }: Pick<AppContentProps, "openApp">) {
  const { about, ownerName, role, location } = portfolioContent;

  return (
    <article className="app-view about-view">
      <AppHeader eyebrow="ABOUT · 关于我" title={about.heading} />
      <div className="about-layout">
        <aside className="profile-card">
          <div className="profile-mark" aria-hidden="true">{portfolioContent.monogram}</div>
          <h3>{ownerName}</h3>
          <p>{role}</p>
          <span>{location}</span>
        </aside>
        <div className="about-story">
          {about.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <ul className="fact-list" aria-label="关于我的几个事实">
            {about.facts.map((fact) => <li key={fact}>{fact}</li>)}
          </ul>
        </div>
      </div>
      <section className="principles-section" aria-labelledby="principles-title">
        <h3 id="principles-title">我的工作原则</h3>
        <div className="principle-grid">
          {about.principles.map((principle, index) => (
            <article className="principle-card" key={principle.title}>
              <span aria-hidden="true">0{index + 1}</span>
              <h4>{principle.title}</h4>
              <p>{principle.text}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="app-actions">
        <button className="primary-action" type="button" onClick={() => openApp("contact")}>聊聊合作</button>
      </div>
    </article>
  );
}

function LabApp() {
  return (
    <article className="app-view lab-view">
      <AppHeader
        eyebrow="PLAYGROUND · 不急着有答案"
        title="实验室"
        intro="一些由好奇心开始的短小实验。它们允许失败，也经常意外地回到正式项目里。"
      />
      <div className="experiment-grid">
        {portfolioContent.experiments.map((experiment) => (
          <article className="experiment-card" key={experiment.id}>
            <div className="experiment-symbol" aria-hidden="true">{experiment.symbol}</div>
            <div className="experiment-status"><span aria-hidden="true" />{experiment.status}</div>
            <h3>{experiment.title}</h3>
            <p>{experiment.summary}</p>
            <ul className="tag-list" aria-label={`${experiment.title}关键词`}>
              {experiment.tags.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </article>
  );
}

function ContactApp() {
  const { contact } = portfolioContent;

  return (
    <article className="app-view contact-view">
      <div className="contact-orb" aria-hidden="true">
        <span><AppIcon appId="contact" size={46} strokeWidth={1.75} /></span>
      </div>
      <AppHeader eyebrow="CONTACT · SAY HELLO" title={contact.heading} intro={contact.intro} />
      <p className="response-note"><span aria-hidden="true" />{contact.responseTime}</p>
      <address className="contact-list">
        {contact.links.map((link) => (
          <a href={link.href} key={link.label} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}>
            <span>{link.label}</span>
            <strong>{link.value}</strong>
            <i aria-hidden="true"><SystemIcon name="externalLink" size={16} /></i>
          </a>
        ))}
      </address>
    </article>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; description: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="setting-group">
      <legend>{label}</legend>
      <div className="setting-options">
        {options.map((option) => (
          <button
            className={`setting-option${value === option.value ? " is-selected" : ""}`}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            key={option.value}
          >
            <span className={`setting-swatch setting-swatch-${option.value}`} aria-hidden="true" />
            <span><strong>{option.label}</strong><small>{option.description}</small></span>
            <i aria-hidden="true">
              {value === option.value ? <SystemIcon name="check" size={15} strokeWidth={2.2} /> : null}
            </i>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function WallpaperGroup({
  value,
  onChange,
}: {
  value: WallpaperPreference;
  onChange: (value: WallpaperPreference) => void;
}) {
  return (
    <fieldset className="setting-group wallpaper-group">
      <legend>桌面背景</legend>
      <div className="wallpaper-options">
        {WALLPAPER_OPTIONS.map((option) => (
          <button
            className={`setting-option wallpaper-option${value === option.value ? " is-selected" : ""}`}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            key={option.value}
          >
            <span
              className={`wallpaper-preview wallpaper-preview-${option.value}`}
              aria-hidden="true"
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
            <i aria-hidden="true">
              {value === option.value ? <SystemIcon name="check" size={15} strokeWidth={2.2} /> : null}
            </i>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SettingsApp({
  theme,
  setTheme,
  glass,
  setGlass,
  wallpaper,
  setWallpaper,
}: Omit<AppContentProps, "appId" | "openApp">) {
  const themeOptions = [
    { value: "system", label: "跟随系统", description: "自动匹配设备外观" },
    { value: "light", label: "浅色", description: "明亮、通透的桌面" },
    { value: "dark", label: "深色", description: "更适合弱光环境" },
  ] as const;
  const glassOptions = [
    { value: "clear", label: "清透", description: "更多壁纸色彩穿透" },
    { value: "standard", label: "标准", description: "清晰与氛围的平衡" },
    { value: "readable", label: "高可读", description: "降低透明度与动态效果" },
  ] as const;

  return (
    <article className="app-view settings-view">
      <AppHeader
        eyebrow="PREFERENCES"
        title="外观设置"
        intro="背景选择只保存在当前浏览器，不会改变访客看到的默认背景。"
      />
      <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
        <WallpaperGroup value={wallpaper} onChange={setWallpaper} />
        <ChoiceGroup label="主题" value={theme} options={themeOptions} onChange={setTheme} />
        <ChoiceGroup label="玻璃效果" value={glass} options={glassOptions} onChange={setGlass} />
      </form>
      <p className="settings-footnote">MyOS 也会遵循设备的“减少动态效果”和“增加对比度”辅助功能设置。</p>
    </article>
  );
}

function TrashApp() {
  const { trash } = portfolioContent;

  return (
    <article className="app-view trash-view">
      <AppHeader eyebrow="ARCHIVE · 废纸篓" title="被放弃，但没有消失" intro={trash.note} />
      <ul className="trash-list" aria-label="已放弃的方案">
        {trash.items.map((item) => (
          <li key={item.name}>
            <span className="trash-file-icon" aria-hidden="true">
              <SystemIcon name="file" size={20} />
            </span>
            <span><strong>{item.name}</strong><small>{item.meta}</small></span>
            <time>{item.date}</time>
          </li>
        ))}
      </ul>
      <p className="trash-caption">保留一点不完美，提醒自己设计是一段过程。</p>
    </article>
  );
}

export function AppContent(props: AppContentProps) {
  switch (props.appId) {
    case "welcome":
      return <WelcomeApp openApp={props.openApp} />;
    case "work":
      return <WorkApp />;
    case "about":
      return <AboutApp openApp={props.openApp} />;
    case "lab":
      return <LabApp />;
    case "contact":
      return <ContactApp />;
    case "settings":
      return (
        <SettingsApp
          theme={props.theme}
          setTheme={props.setTheme}
          glass={props.glass}
          setGlass={props.setGlass}
          wallpaper={props.wallpaper}
          setWallpaper={props.setWallpaper}
        />
      );
    case "trash":
      return <TrashApp />;
  }
}
