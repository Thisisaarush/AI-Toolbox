export type LogoShape = "circle" | "rounded" | "square"
export type LogoSize = 400 | 512 | 1024

export interface LogoPreset {
  id: string
  bg: string
  iconColor: string
  label: string
}

export const LOGO_PRESETS: LogoPreset[] = [
  { id: "electric", bg: "#6366f1", iconColor: "#ffffff", label: "Electric" },
  { id: "midnight", bg: "#0f172a", iconColor: "#6366f1", label: "Midnight" },
  { id: "forest", bg: "#166534", iconColor: "#86efac", label: "Forest" },
  { id: "sunset", bg: "#ea580c", iconColor: "#fef3c7", label: "Sunset" },
  { id: "ocean", bg: "#0369a1", iconColor: "#bae6fd", label: "Ocean" },
  { id: "rose", bg: "#be123c", iconColor: "#fce7f3", label: "Rose" },
  { id: "gold", bg: "#92400e", iconColor: "#fde68a", label: "Gold" },
  { id: "slate", bg: "#334155", iconColor: "#f8fafc", label: "Slate" },
  { id: "purple", bg: "#7e22ce", iconColor: "#f3e8ff", label: "Purple" },
  { id: "clean", bg: "#f8fafc", iconColor: "#0f172a", label: "Clean" },
]

export const ICON_LIST = [
  "Zap", "Star", "Heart", "Rocket", "Globe", "Code2", "Cpu", "Database",
  "Shield", "Lock", "Key", "Cloud", "Server", "Wifi", "Terminal", "GitBranch",
  "Package", "Box", "Layers", "Layout", "Grid", "PieChart", "BarChart2", "TrendingUp",
  "DollarSign", "CreditCard", "ShoppingBag", "Store", "Briefcase", "Building2",
  "Users", "User", "UserCheck", "MessageSquare", "Mail", "Bell", "Bookmark", "Flag",
  "Map", "Compass", "Target", "Trophy", "Award", "Crown", "Gem", "Diamond",
  "Leaf", "Flower2", "Sun", "Moon", "Sparkles", "Wand2", "Flame", "Zap",
  "Atom", "Hexagon", "Triangle", "Circle", "Square",
  "Camera", "ImageIcon", "Video", "Music", "Headphones", "Mic", "Volume2", "Radio",
  "Book", "BookOpen", "Pen", "Edit", "FileText", "Clipboard", "List", "CheckCircle2",
  "Settings", "Sliders", "Wrench", "Hammer", "Scissors", "Puzzle", "Link",
]
