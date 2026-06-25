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