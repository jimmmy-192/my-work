import {
  ArrowRight,
  AtSign,
  Check,
  ChevronLeft,
  CircleHelp,
  CornerDownLeft,
  ExternalLink,
  FileText,
  FlaskConical,
  House,
  Info,
  LayoutGrid,
  Maximize2,
  Minus,
  Minimize2,
  Move,
  Search,
  Settings2,
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
  help: CircleHelp,
  info: Info,
  move: Move,
  settings: Settings2,
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

function opticalStrokeWidth(size: number) {
  if (size <= 14) return 1.5;
  if (size <= 18) return 1.6;
  if (size <= 22) return 1.75;
  if (size <= 30) return 1.9;
  return 2.2;
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
  strokeWidth,
  className,
}: AppIconProps) {
  return (
    <IconGlyph
      icon={APP_ICONS[appId]}
      size={size}
      strokeWidth={strokeWidth ?? opticalStrokeWidth(size)}
      className={className}
    />
  );
}

export function SystemIcon({
  name,
  size = 16,
  strokeWidth,
  className,
}: SystemIconProps) {
  return (
    <IconGlyph
      icon={SYSTEM_ICONS[name]}
      size={size}
      strokeWidth={strokeWidth ?? opticalStrokeWidth(size)}
      className={className}
    />
  );
}
