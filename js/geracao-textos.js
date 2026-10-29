import { TEXTO_BASE } from "./configuracao-carta.js";

const FORMAS = {
  masculino: {
    ESTARRECIDO: "estarrecido",
    IMPEDIDO: "impedido",
    LIDER: "o líder",
    CALADO: "calado",
    PRESO: "preso",
    CENSURADO: "censurado",
    PRIMEIRO: "o primeiro",
  },
  feminino: {
    ESTARRECIDO: "estarrecida",
    IMPEDIDO: "impedida",
    LIDER: "a líder",
    CALADO: "calada",
    PRESO: "presa",
    CENSURADO: "censurada",
    PRIMEIRO: "a primeira",
  },
};

export function createLetterText(version, gender, department) {
  const forms = FORMAS[gender] || FORMAS.feminino;
  const opening = (gender === "feminino" ? version.aberturaFeminina : version.abertura).replace("{DEQUE}", department);
  return TEXTO_BASE.replace(/\{([A-Z_]+)\}/g, function (match, key) {
    if (key === "ABERTURA") return opening;
    if (key === "EU_SOU") return gender === "feminino" ? version.euSouFeminino : version.euSou;
    return forms[key] || match;
  });
}

export function createInstagramText(version, gender, department) {
  const forms = FORMAS[gender] || FORMAS.feminino;
  const opening = (gender === "feminino" ? version.aberturaFeminina : version.abertura).replace("{DEQUE}", department);
  return [
    "Dirijo-me ao povo brasileiro e à comunidade internacional como " + opening + ".",
    "Na noite de domingo, vi " +
      forms.ESTARRECIDO +
      " uma fraude se concretizar diante dos meus olhos. Uma impossibilidade matemática. Até agora, não há sequer uma única resposta crível.",
    "Quero deixar claro: não fugi. Saí de um regime de exceção para poder ser " +
      forms.LIDER +
      " que o meu povo merece. Liderarei a oposição daqui. Direi o que vocês, aí, não podem dizer, e assumirei os riscos que vocês não podem correr.",
    "Esta luta não terminou no dia 25 de outubro. Ela só termina quando eu tomar posse. E esse dia vai chegar.",
    "Que Deus abençoe o Brasil.",
  ];
}
