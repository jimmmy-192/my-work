import {
  ArrowRight,
  AtSign,
  Check,
  ChevronLeft,
  CornerDownLeft,
  ExternalLink,
  FileText,
  FlaskConical,
  House,
  LayoutGrid,
  Maximize2,
  Minus,
  Minimize2,
  Search,
  Settings2,
  SunMoon,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppId } from "./window-manager";

const APP_ICONS: Record<AppId, LucideIcon> = {
  welcome: House,
  work: LayoutGrid,
  about: UserRound,
  lab: FlaskConical,
  contact: AtSign,
  settings: Settings2,
  trash: Trash2,
};

const SYSTEM_ICONS = {
  appearance: SunMoon,
  search: Search,
  arrowRight: ArrowRight,
  externalLink: ExternalLink,
  check: Check,
  return: CornerDownLeft,
  file: FileText,
  minimize: Minus,
  maximize: Maximize2,
  restore: Minimize2,
  close: X,
  back: ChevronLeft,
} satisfies Record<string, LucideIcon>;

export type SystemIconName = keyof typeof SYSTEM_ICONS;

interface SharedIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

interface AppIconProps extends SharedIconProps {
  appId: AppId;
}

interface SystemIconProps extends SharedIconProps {
  name: SystemIconName;
}

function IconGlyph({
  icon: Icon,
  size,
  strokeWidth,
  className,
}: SharedIconProps & { icon: LucideIcon }) {
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
    />
  );
}

export function AppIcon({
  appId,
  size = 28,
  strokeWidth = 1.9,
  className,
}: AppIconProps) {
  return (
    <IconGlyph
      icon={APP_ICONS[appId]}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
    />
  );
}

export function SystemIcon({
  name,
  size = 16,
  strokeWidth = 1.8,
  className,
}: SystemIconProps) {
  return (
    <IconGlyph
      icon={SYSTEM_ICONS[name]}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
    />
  );
}
