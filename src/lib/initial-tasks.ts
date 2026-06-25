export type DayKey = "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado";

export const DAYS: { key: DayKey; label: string }[] = [
  { key: "segunda", label: "SEGUNDA" },
  { key: "terca", label: "TERÇA" },
  { key: "quarta", label: "QUARTA" },
  { key: "quinta", label: "QUINTA" },
  { key: "sexta", label: "SEXTA" },
  { key: "sabado", label: "SÁBADO" },
];

export const USERS = ["Miguel", "Davi", "Danelle", "Eduardo"] as const;
export type UserName = (typeof USERS)[number];

export type WeekTasks = Record<DayKey, string[]>;

export const INITIAL_TASKS: Record<UserName, WeekTasks> = {
  Miguel: {
    segunda: [
      "arrumar a cama",
      "arrumar a mesa de estudos",
      "arrumar o quarto (guardar objetos fora do lugar, varrer e passar pano molhado)",
      "varrer quarto da mamãe",
    ],
    terca: [
      "tirar lixo dos banheiros",
      "limpar vaso com álcool",
      "limpar entrada da casa (varrer e passar pano)",
    ],
    quarta: [
      "organizar roupas do guarda-roupa",
      "limpar fogão",
      "varrer e passar pano na cozinha",
    ],
    quinta: ["varrer o corredor e passar pano", "varrer a varanda e a sala"],
    sexta: [
      "limpar Air fryer",
      "limpar entrada da casa e passar pano (limpar móvel)",
      "retirar o lixo do wc",
      "limpar o vaso com álcool",
    ],
    sabado: ["ajudar a cozinhar", "varrer e passar pano na cozinha"],
  },
  Davi: {
    segunda: [
      "arrumar a cama",
      "arrumar mesa de estudos",
      "arrumar o quarto (guardar objetos fora do lugar, varrer e passar pano molhado)",
      "varrer e passar pano na cozinha",
    ],
    terca: [
      "lavar pia dos banheiros",
      "varrer e passar pano molhado no chão banheiro",
      "cuidar das plantas",
      "varrer a varanda",
    ],
    quarta: [
      "trocar roupa de cama de daniel",
      "limpar a cozinha e passar pano molhado",
      "organizar roupas do guarda roupa",
    ],
    quinta: [
      "varrer a sala e passar pano",
      "limpar móvel da sala, portas da sala e colocar lençol do sofá para lavar",
      "organizar a cozinha",
    ],
    sexta: [
      "trocar roupas de cama do Davi e miguel",
      "aquários",
      "limpar fogão",
      "limpar pia do banheiro",
      "varrer e passar pano no WC",
    ],
    sabado: [
      "ajudar a cozinhar",
      "varrer a sala e passar pano",
      "limpar varanda",
      "cuidar das plantas",
    ],
  },
  Danelle: {
    segunda: [
      "lavar panos de chão",
      "lavar roupas de minha cama e todas as toalhas de banho",
      "limpar geladeira",
      "limpar espelhos dos w.c. e lavar",
      "limpar Box e vaso com água sanitária",
    ],
    terca: [],
    quarta: [],
    quinta: [],
    sexta: [],
    sabado: [],
  },
  Eduardo: {
    segunda: [],
    terca: [],
    quarta: [],
    quinta: [],
    sexta: [],
    sabado: [
      "limpar o ar condicionado",
      "limpar ventiladores",
      "limpar em baixo do sofá",
    ],
  },
};

export type UserTheme = "blue" | "emerald" | "amber" | "pink" | "slate";

export interface ThemeConfig {
  name: string;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  accentBg: string;
  accentText: string;
  badgeBg: string;
  badgeText: string;
  checkboxAccent: string;
  printHeaderBg: string;
  printBorder: string;
  printBg: string;
  printText: string;
}

export const THEMES: Record<UserTheme, ThemeConfig> = {
  blue: {
    name: "Azul Clássico",
    cardBg: "bg-blue-50/50 dark:bg-blue-950/20",
    cardBorder: "border-blue-200/60 dark:border-blue-800/40",
    textColor: "text-blue-900 dark:text-blue-100",
    accentBg: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
    accentText: "text-white",
    badgeBg: "bg-blue-100 dark:bg-blue-900/40",
    badgeText: "text-blue-800 dark:text-blue-200",
    checkboxAccent: "accent-blue-600",
    printHeaderBg: "#dbeafe",
    printBorder: "#3b82f6",
    printBg: "#eff6ff",
    printText: "#1e3a8a",
  },
  emerald: {
    name: "Verde Esmeralda",
    cardBg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    cardBorder: "border-emerald-200/60 dark:border-emerald-800/40",
    textColor: "text-emerald-900 dark:text-emerald-100",
    accentBg: "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600",
    accentText: "text-white",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/40",
    badgeText: "text-emerald-800 dark:text-emerald-200",
    checkboxAccent: "accent-emerald-600",
    printHeaderBg: "#d1fae5",
    printBorder: "#10b981",
    printBg: "#ecfdf5",
    printText: "#064e3b",
  },
  amber: {
    name: "Laranja Sunset",
    cardBg: "bg-amber-50/50 dark:bg-amber-950/20",
    cardBorder: "border-amber-200/60 dark:border-amber-800/40",
    textColor: "text-amber-900 dark:text-amber-100",
    accentBg: "bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600",
    accentText: "text-white",
    badgeBg: "bg-amber-100 dark:bg-amber-900/40",
    badgeText: "text-amber-800 dark:text-amber-200",
    checkboxAccent: "accent-amber-600",
    printHeaderBg: "#fef3c7",
    printBorder: "#f59e0b",
    printBg: "#fffbeb",
    printText: "#78350f",
  },
  pink: {
    name: "Rosa Lavanda",
    cardBg: "bg-pink-50/50 dark:bg-pink-950/20",
    cardBorder: "border-pink-200/60 dark:border-pink-800/40",
    textColor: "text-pink-900 dark:text-pink-100",
    accentBg: "bg-pink-600 hover:bg-pink-700 dark:bg-pink-500 dark:hover:bg-pink-600",
    accentText: "text-white",
    badgeBg: "bg-pink-100 dark:bg-pink-900/40",
    badgeText: "text-pink-800 dark:text-pink-200",
    checkboxAccent: "accent-pink-600",
    printHeaderBg: "#fce7f3",
    printBorder: "#ec4899",
    printBg: "#fdf2f8",
    printText: "#831843",
  },
  slate: {
    name: "Cinza Moderno",
    cardBg: "bg-slate-50/50 dark:bg-slate-950/20",
    cardBorder: "border-slate-200/60 dark:border-slate-800/40",
    textColor: "text-slate-900 dark:text-slate-100",
    accentBg: "bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600",
    accentText: "text-white",
    badgeBg: "bg-slate-100 dark:bg-slate-900/40",
    badgeText: "text-slate-800 dark:text-slate-200",
    checkboxAccent: "accent-slate-600",
    printHeaderBg: "#f1f5f9",
    printBorder: "#64748b",
    printBg: "#f8fafc",
    printText: "#0f172a",
  },
};

export const ICONS = [
  { char: "🏠", label: "Casa" },
  { char: "🧹", label: "Vassoura" },
  { char: "🧼", label: "Sabão" },
  { char: "🌟", label: "Estrela" },
  { char: "🪴", label: "Planta" },
  { char: "🍕", label: "Pizza" },
  { char: "🐾", label: "Patinha" },
  { char: "📚", label: "Livros" },
];

export const DEFAULT_USER_SETTINGS: Record<UserName, { theme: UserTheme; icon: string; customBgColor: string; customTextColor: string }> = {
  Miguel: { theme: "blue", icon: "🧹", customBgColor: "#eff6ff", customTextColor: "#1d4ed8" },
  Davi: { theme: "emerald", icon: "🪴", customBgColor: "#f0fdf4", customTextColor: "#15803d" },
  Danelle: { theme: "pink", icon: "🧼", customBgColor: "#fdf2f8", customTextColor: "#be185d" },
  Eduardo: { theme: "slate", icon: "🏠", customBgColor: "#f8fafc", customTextColor: "#334155" },
};