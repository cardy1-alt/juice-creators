import React, { SVGProps } from 'react';
import {
  Interfaces,
  Food,
  ECommerce,
  Misc,
  Health,
  Arrow,
  Finance,
  Objects,
  Logos,
} from 'doodle-icons';

// ─── Icon mapping — maps lucide-react names to doodle equivalents ───────────
const ICON_MAP: Record<string, React.FC<SVGProps<SVGSVGElement>>> = {
  // Interface
  search: Interfaces.Search,
  heart: Interfaces.Heart,
  zap: Interfaces.Zap,
  filter: Interfaces.Filter,
  home: Interfaces.Home,
  star: Interfaces.Star,
  grid: Interfaces.Grid,
  doc: Interfaces.Doc,
  bell: Interfaces.Bell,
  tick: Interfaces.Tick,
  check: Interfaces.Tick,
  'check-circle': Interfaces.Tick,
  'check-circle-2': Interfaces.Tick,
  logout: Interfaces.Logout,
  link: Interfaces.Link,
  'external-link': Interfaces.Link,
  flag: Interfaces.Flag,
  close: Interfaces.Cross,
  x: Interfaces.Cross,
  'x-circle': Interfaces.Cross,
  user: Interfaces.User,
  users: Interfaces.UserAdd,
  clock: Interfaces.Clock,
  copy: Interfaces.Copy,
  camera: Interfaces.Camera,
  video: Interfaces.VideoCamera,
  'video-off': Interfaces.VideoCamera,
  caution: Interfaces.Caution,
  'alert-circle': Interfaces.Caution,
  'alert-triangle': Interfaces.Caution,
  lock: Interfaces.Lock,
  plus: Interfaces.Note,
  shield: Interfaces.Shield,
  hide: Interfaces.Hide,
  'eye-off': Interfaces.Hide,
  unhide: Interfaces.Unhide,
  eye: Interfaces.Unhide,
  'location-pin': Interfaces.LocationPin,
  'map-pin': Interfaces.LocationPin,
  navigation: Interfaces.Navigation,
  mail: Interfaces.Mail,
  message: Interfaces.Message,
  'message-square': Interfaces.Message,
  setting: Interfaces.Setting,
  settings: Interfaces.Setting,
  sync: Interfaces.Sync,
  'refresh-cw': Interfaces.Sync,
  megaphone: Interfaces.Megaphone,
  info: Interfaces.Info,
  bulb: Interfaces.Bulb,
  lightbulb: Interfaces.Bulb,
  pause: Interfaces.Pause,
  'pause-circle': Interfaces.Pause,
  scan: Interfaces.Scan,
  'scan-line': Interfaces.Scan,
  pen: Interfaces.Pen,
  pencil: Interfaces.Pen,
  analytics: Interfaces.Analytics,
  'bar-chart': Interfaces.Analytics,
  'bar-chart-3': Interfaces.Analytics,
  globe: Interfaces.Globe,
  checklist: Interfaces.Checklist,
  'clipboard-list': Interfaces.Checklist,
  'thumbs-up': Interfaces.ThumbsUp,
  trophy: Interfaces.Trophy,
  play: Interfaces.Play,
  photo: Interfaces.Photo,
  sparkles: Interfaces.MagicWand,
  'magic-wand': Interfaces.MagicWand,
  'layout-grid': Interfaces.Grid,
  'layout-dashboard': Interfaces.Dashboard,
  dashboard: Interfaces.Dashboard,
  'more-horizontal': Interfaces.Menu,
  menu: Interfaces.Menu,
  'sliders-horizontal': Interfaces.Filter,
  gift: Interfaces.Gift,
  'badge-check': Interfaces.Shield,
  'file-text': Interfaces.Doc,
  minus: Interfaces.Minimize,
  infinity: Interfaces.Shuffle,

  // Food
  cutlery: Food.Cutlery,
  'utensils-crossed': Food.Cutlery,
  drink: Food.Drink,
  cake: Food.Cake,

  // E-commerce
  tag: ECommerce.Tag,
  bag: ECommerce.Bag,
  'shopping-bag': ECommerce.Bag,
  shop: ECommerce.Shop,
  store: ECommerce.Shop,
  qr: ECommerce.Qr,
  'qr-code': ECommerce.Qr,

  // Misc
  coffee: Misc.CoffeeCup1,
  'coffee-cup': Misc.CoffeeCup1,
  'paint-brush': Objects.PaintBrush,
  palette: Objects.PaintBrush,
  fire: Misc.Fire,

  // Health
  'heart-beat': Health.HeartBeat,
  dumbbell: Health.HeartBeat,
  stethoscope: Health.Stethoscope,

  // Arrows
  'arrow-left': Arrow.ArrowSingleLeft,
  'arrow-right': Arrow.ArrowSingleRight,
  'chevron-left': Arrow.ChevronsLeft,
  'chevron-right': Arrow.ChevronsRight,

  // Finance
  wallet: Finance.Wallet,

  // Objects
  frame: Objects.Frame,
  'movie-clapper': Objects.MovieClapper,
  film: Objects.MovieClapper,
  guitar: Objects.Guitar,

  // Logos
  instagram: Logos.Instagram,

  // Category-specific aliases
  scissors: Objects.Frame,
  flower: Interfaces.Tree,
  'flower-2': Interfaces.Tree,
  'graduation-cap': Interfaces.Doc,
  wrench: Interfaces.Setting,
  'paw-print': Health.HeartBeat,
  'building-2': ECommerce.Shop,
};

// ─── Wrapper component ──────────────────────────────────────────────────────
export interface DoodleIconProps extends SVGProps<SVGSVGElement> {
  name: string;
  size?: number;
}

export function DoodleIcon({ name, size = 24, className, style, ...rest }: DoodleIconProps) {
  const IconComponent = ICON_MAP[name.toLowerCase()];
  if (!IconComponent) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={{ fill: 'currentColor', ...style }} {...rest}>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return <IconComponent width={size} height={size} className={className} style={{ fill: 'currentColor', ...style }} {...rest} />;
}

// ─── Direct component re-exports for category system ────────────────────────
export const DoodleCutlery = Food.Cutlery;
export const DoodleScissors = Objects.Frame;
export const DoodleDumbbell = Health.HeartBeat;
export const DoodleBag = ECommerce.Bag;
export const DoodleCoffee = Misc.CoffeeCup1;
export const DoodlePaintBrush = Objects.PaintBrush;
export const DoodleFlower = Interfaces.Tree;
export const DoodlePawPrint = Health.HeartBeat;
export const DoodleGradCap = Interfaces.Doc;
export const DoodleWrench = Interfaces.Setting;
export const DoodleShop = ECommerce.Shop;
