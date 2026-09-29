import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { portfolioContent } from "../../content/portfolio";
import { AppIcon, SystemIcon } from "./icons";
import { DOCK_MIN_SIZE, DOCK_MAX_SIZE } from "./dock-magnification";
import type {
  CloudAccount,
  CloudSyncStatus,
  GlassPreference,
  ThemePreference,
} from "./cloud-preferences";
import type { WallpaperPreference } from "./preferences";
import type { WallpaperPhoto } from "./wallpaper-carousel";
import { canRemoveWallpaper } from "./wallpaper-carousel";
import { prepareWallpaper } from "./prepare-wallpaper";
import { saveLocalWallpaperImages } from "./wallpaper-storage";
import type { AppId } from "./window-manager";

interface AppContentProps {
  appId: AppId;
  openApp: (id: AppId) => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  glass: GlassPreference;
  setGlass: (glass: GlassPreference) => void;
  dockGlass: boolean;
  setDockGlass: (enabled: boolean) => void;
  dockSize: number;
  setDockSize: (size: number) => void;
  wallpaper: WallpaperPreference;
  setWallpaper: (wallpaper: WallpaperPreference) => void;
  wallpaperPhotos: WallpaperPhoto[];
  concealedWallpaperIds: string[];
  toggleWallpaperVisibility: (id: string) => void;
  addWallpaperPhotos: (photos: WallpaperPhoto[]) => void;
  removeWallpaperPhoto: (id: string) => void;
  reorderWallpaperPhotos: (ids: string[]) => void;
  cloudSyncStatus: CloudSyncStatus;
  cloudAccount: CloudAccount | null;
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
            style={{ "--project-accent": project.accent } as CSSProperties}
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
        <span><AppIcon appId="contact" size={46} /></span>
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
              {value === option.value ? <SystemIcon name="check" size={15} /> : null}
            </i>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function WallpaperGroup({
  photos,
  concealedIds,
  onToggleVisibility,
  onAdd,
  onRemove,
  onReorder,
}: {
  photos: WallpaperPhoto[];
  concealedIds: string[];
  onToggleVisibility: (id: string) => void;
  onAdd: (photos: WallpaperPhoto[]) => void;
  onRemove: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [message, setMessage] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const preparingRef = useRef(false);
  const concealed = new Set(concealedIds);
  const visibleCount = photos.filter((photo) => !concealed.has(photo.id)).length;

  const movePhoto = (id: string, offset: number) => {
    const ids = photos.map((photo) => photo.id);
    const from = ids.indexOf(id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    onReorder(ids);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || preparingRef.current) return;

    preparingRef.current = true;
    setPreparing(true);
    try {
      const selected = Array.from(files);
      const prepared: WallpaperPhoto[] = [];
      // Process one full-resolution image at a time, and publish only a completed batch.
      for (const [index, file] of selected.entries()) {
        setMessage(`正在校准与优化 ${index + 1}/${selected.length}…`);
        prepared.push(await prepareWallpaper(file));
      }
      setMessage("正在保存优化后的壁纸…");
      const saved = await saveLocalWallpaperImages(prepared).catch(() => {
        throw new Error("图片已优化，但本机保存失败。请检查浏览器存储空间后重试，图片尚未加入轮播。");
      });
      onAdd(saved);
      setMessage(`已优化并加入 ${saved.length} 张壁纸`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "壁纸处理失败，尚未加入，请重试");
    } finally {
      preparingRef.current = false;
      setPreparing(false);
    }
  };

  return (
    <fieldset className="setting-group wallpaper-group">
      <legend>桌面背景</legend>
      <div className="wallpaper-manager">
        <div className="wallpaper-manager-heading">
          <span><strong>照片轮播</strong><small>{visibleCount ? `${visibleCount} 张轮播，每 1 分钟切换` : "全部壁纸已隐藏"}{photos.length > visibleCount ? ` · ${photos.length - visibleCount} 张已隐藏` : ""}</small></span>
          <label className={`wallpaper-upload-button${preparing ? " is-preparing" : ""}`}>
            {preparing ? "优化中…" : "上传图片"}
            <input type="file" accept="image/*" multiple disabled={preparing} onChange={(event) => { void handleFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
          </label>
        </div>
        {message ? <p className="wallpaper-manager-message" role="status">{message}</p> : null}
        <ol className="wallpaper-sort-list" aria-label="壁纸轮播顺序" aria-busy={preparing}>
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              draggable
              className={[draggedId === photo.id ? "is-dragging" : "", concealed.has(photo.id) ? "is-hidden" : ""].filter(Boolean).join(" ")}
              onDragStart={() => setDraggedId(photo.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (!draggedId || draggedId === photo.id) return;
                const ids = photos.map((item) => item.id).filter((id) => id !== draggedId);
                ids.splice(index, 0, draggedId);
                onReorder(ids);
                setDraggedId(null);
              }}
            >
              <span className="wallpaper-sort-handle" aria-hidden="true">⋮⋮</span>
              <span className="wallpaper-sort-preview" title={photo.width && photo.height ? `${photo.width} × ${photo.height}` : undefined} style={{ backgroundImage: `url("${photo.url}")` }} />
              <span className="wallpaper-sort-name"><strong>{photo.name}</strong><small>{index === 0 ? "首张保留" : photo.custom ? "自定义" : "内置"}{concealed.has(photo.id) ? " · 已隐藏" : ""}</small></span>
              <span className="wallpaper-sort-actions">
                <button type="button" className="wallpaper-visibility" aria-label={`${concealed.has(photo.id) ? "显示" : "隐藏"}${photo.name}`} onClick={() => {
                  onToggleVisibility(photo.id);
                  setMessage(`${concealed.has(photo.id) ? "已显示" : "已隐藏"}「${photo.name}」`);
                }}>{concealed.has(photo.id) ? "显示" : "隐藏"}</button>
                <button type="button" aria-label={`上移${photo.name}`} disabled={index === 0} onClick={() => movePhoto(photo.id, -1)}>↑</button>
                <button type="button" aria-label={`下移${photo.name}`} disabled={index === photos.length - 1} onClick={() => movePhoto(photo.id, 1)}>↓</button>
                <button type="button" className="wallpaper-remove" aria-label={`删除${photo.name}`} title={index === 0 ? "第一张壁纸不能删除" : "删除壁纸"} disabled={!canRemoveWallpaper(photos, photo.id)} onClick={() => { onRemove(photo.id); setMessage(`已删除「${photo.name}」`); }}>×</button>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </fieldset>
  );
}

function SettingsApp({
  theme,
  setTheme,
  glass,
  setGlass,
  dockGlass,
  setDockGlass,
  dockSize,
  setDockSize,
  wallpaperPhotos,
  concealedWallpaperIds,
  toggleWallpaperVisibility,
  addWallpaperPhotos,
  removeWallpaperPhoto,
  reorderWallpaperPhotos,
  cloudSyncStatus,
  cloudAccount,
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
        intro="登录后，主题、玻璃效果、壁纸与轮播顺序会自动同步到你的其他设备。"
      />
      <div className={`settings-sync settings-sync-${cloudSyncStatus}`} role="status">
        <span className="settings-sync-dot" aria-hidden="true" />
        <span>
          <strong>
            {cloudSyncStatus === "checking" ? "正在检查云端设置" : null}
            {cloudSyncStatus === "saving" ? "正在保存到云端" : null}
            {cloudSyncStatus === "synced" ? "已保存到云端" : null}
            {cloudSyncStatus === "signed-out" ? "登录后开启跨设备同步" : null}
            {cloudSyncStatus === "unavailable" ? "当前使用本机保存" : null}
            {cloudSyncStatus === "error" ? "云端暂时未保存" : null}
          </strong>
          <small>
            {cloudSyncStatus === "synced" && cloudAccount
              ? cloudAccount.email
              : cloudSyncStatus === "signed-out"
                ? "当前设置仍会安全保留在这台设备"
                : cloudSyncStatus === "unavailable"
                  ? "在 ChatGPT Site 中打开即可使用云同步"
                  : cloudSyncStatus === "error"
                    ? "已保留本机副本，稍后修改时会再次尝试"
                    : "主题和壁纸会自动保持一致"}
          </small>
        </span>
        {cloudSyncStatus === "signed-out" ? (
          <a href="/signin-with-chatgpt?return_to=%2F" target="_top">
            登录 ChatGPT
          </a>
        ) : null}
      </div>
      <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
        <WallpaperGroup photos={wallpaperPhotos} concealedIds={concealedWallpaperIds} onToggleVisibility={toggleWallpaperVisibility} onAdd={addWallpaperPhotos} onRemove={removeWallpaperPhoto} onReorder={reorderWallpaperPhotos} />
        <ChoiceGroup label="主题" value={theme} options={themeOptions} onChange={setTheme} />
        <div className="setting-size-row">
          <div className="setting-size-heading">
            <label htmlFor="dock-size">Dock 大小</label>
            <output htmlFor="dock-size">{dockSize}</output>
          </div>
          <div className="setting-size-control">
            <span aria-hidden="true">小</span>
            <input id="dock-size" type="range" min={DOCK_MIN_SIZE} max={DOCK_MAX_SIZE} step="1" value={dockSize} aria-valuetext={`${dockSize} 像素`} onChange={(event) => setDockSize(Number(event.target.value))} />
            <span aria-hidden="true">大</span>
          </div>
        </div>
        <div className="setting-toggle-row">
          <span>
            <strong id="dock-glass-label">Dock 玻璃</strong>
            <small id="dock-glass-description">{dockGlass ? "透明玻璃底座承托图标" : "图标直接悬浮在桌面上"}</small>
          </span>
          <button
            type="button"
            className="setting-switch"
            role="switch"
            aria-checked={dockGlass}
            aria-labelledby="dock-glass-label"
            aria-describedby="dock-glass-description"
            onClick={() => setDockGlass(!dockGlass)}
          ><span aria-hidden="true" /></button>
        </div>
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
          dockGlass={props.dockGlass}
          setDockGlass={props.setDockGlass}
          dockSize={props.dockSize}
          setDockSize={props.setDockSize}
          wallpaper={props.wallpaper}
          setWallpaper={props.setWallpaper}
          wallpaperPhotos={props.wallpaperPhotos}
          concealedWallpaperIds={props.concealedWallpaperIds}
          toggleWallpaperVisibility={props.toggleWallpaperVisibility}
          addWallpaperPhotos={props.addWallpaperPhotos}
          removeWallpaperPhoto={props.removeWallpaperPhoto}
          reorderWallpaperPhotos={props.reorderWallpaperPhotos}
          cloudSyncStatus={props.cloudSyncStatus}
          cloudAccount={props.cloudAccount}
        />
      );
    case "trash":
      return <TrashApp />;
  }
}
