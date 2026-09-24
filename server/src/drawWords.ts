export type Difficulty = 1 | 2 | 3;

export interface WordEntry {
  word: string;
  category: string;
  difficulty: Difficulty;
}

// Palavras com acento/hifen/espaco normais: a comparacao do palpite ignora acento, hifen e espaco
// (ver normalizeGuess em drawRooms.ts), entao "guarda chuva" acerta "guarda-chuva".
// 1 = facil (objeto comum, 1 traco resolve), 2 = media, 3 = dificil (composta, pouco comum ou
// exige cena/contexto pra desenhar).
function group(category: string, difficulty: Difficulty, words: string[]): WordEntry[] {
  return words.map((word) => ({ word, category, difficulty }));
}

const RAW_WORDS: WordEntry[] = [
  // ---------- animais ----------
  ...group("animal", 1, [
    "cachorro", "gato", "elefante", "girafa", "leão", "tigre", "urso", "coelho", "cavalo", "vaca",
    "porco", "galinha", "pato", "peixe", "cobra", "sapo", "macaco", "zebra", "pinguim", "rato",
    "lobo", "ovelha", "borboleta", "abelha", "aranha", "tartaruga", "baleia", "golfinho", "formiga",
    "minhoca", "caracol", "joaninha", "pássaro", "pintinho", "cabra", "galo", "jacaré", "panda",
    "tubarão", "polvo",
  ]),
  ...group("animal", 2, [
    "caranguejo", "crocodilo", "canguru", "coruja", "morcego", "esquilo", "raposa", "camelo",
    "rinoceronte", "hipopótamo", "papagaio", "águia", "coala", "flamingo", "pavão", "cisne", "gorila",
    "leopardo", "lagosta", "cavalo-marinho", "estrela-do-mar", "água-viva", "preguiça", "tucano",
    "lhama", "ouriço", "foca", "morsa", "castor", "mosquito", "libélula", "lagarta", "camaleão",
    "avestruz", "veado", "alce", "gaivota", "peru", "pica-pau", "hamster",
  ]),
  ...group("animal", 3, [
    "ornitorrinco", "tamanduá", "louva-a-deus", "baiacu", "lêmure", "narval", "suricato", "capivara",
    "tatu", "arraia", "escorpião", "centopeia", "vaga-lume", "beija-flor", "urubu", "orca", "hiena",
    "girino", "bicho-pau", "bicho-da-seda",
  ]),

  // ---------- objetos ----------
  ...group("objeto", 1, [
    "cadeira", "mesa", "porta", "janela", "livro", "caneta", "lápis", "telefone", "relógio", "óculos",
    "chapéu", "sapato", "camisa", "mochila", "espelho", "chave", "garrafa", "copo", "prato", "faca",
    "garfo", "colher", "panela", "sofá", "cama", "escova de dente", "sabão", "toalha", "vela",
    "lâmpada", "tesoura", "martelo", "escada", "balde", "vassoura", "mala", "carteira", "anel", "coroa",
    "bola", "pipa", "boneca", "balão", "presente", "violão", "tambor", "piano", "câmera", "cadeado",
    "meia", "luva", "calça", "vestido", "boné", "gravata", "pente", "televisão", "computador", "celular",
    "fone de ouvido", "dado", "lixeira", "envelope", "régua", "borracha", "tijolo", "caixa", "xícara",
    "moeda", "guitarra",
  ]),
  ...group("objeto", 2, [
    "guarda-chuva", "bandeira", "travesseiro", "ventilador", "geladeira", "fogão", "micro-ondas",
    "liquidificador", "torradeira", "secador de cabelo", "controle remoto", "teclado", "mouse",
    "impressora", "lanterna", "bússola", "binóculo", "microfone", "trompete", "flauta", "violino",
    "sanfona", "saxofone", "âncora", "cabide", "grampeador", "clipe", "abajur", "aspirador", "regador",
    "cofrinho", "ampulheta", "termômetro", "seringa", "capacete", "patins", "algema", "mapa", "globo",
    "prendedor de roupa", "esponja", "rolo de massa", "chaleira", "parafuso", "chave de fenda",
    "serrote", "alicate", "pá", "carrinho de mão", "pneu", "bateria", "lupa", "bumerangue",
  ]),
  ...group("objeto", 3, [
    "estetoscópio", "microscópio", "telescópio", "catapulta", "armadura", "espantalho", "cata-vento",
    "candelabro", "harpa", "balança", "metrônomo", "periscópio", "marionete", "cubo mágico",
    "pé de cabra", "caleidoscópio", "extintor de incêndio", "paraquedas", "fita cassete", "disquete",
    "vitrola", "máquina de escrever", "carrinho de supermercado", "rede de dormir", "dominó", "joystick",
    "tripé", "escada rolante", "gaita de foles", "montanha-russa", "roda-gigante",
  ]),

  // ---------- comida ----------
  ...group("comida", 1, [
    "pizza", "hambúrguer", "sorvete", "bolo", "pão", "queijo", "ovo", "banana", "maçã", "uva",
    "melancia", "morango", "laranja", "limão", "cenoura", "batata", "tomate", "cebola", "milho", "arroz",
    "feijão", "pipoca", "chocolate", "bala", "biscoito", "torta", "café", "leite", "suco", "sanduíche",
    "salada", "sushi", "pastel", "pirulito", "cachorro-quente", "batata frita", "rosquinha", "pera",
    "cereja", "abacate", "coco", "brigadeiro", "picolé", "salsicha", "melão",
  ]),
  ...group("comida", 2, [
    "abacaxi", "macarrão", "churrasco", "coxinha", "pão de queijo", "panqueca", "waffle", "lasanha",
    "espeto", "tapioca", "açaí", "brócolis", "alface", "pepino", "berinjela", "abóbora", "pimenta",
    "alho", "kiwi", "manga", "mamão", "pêssego", "framboesa", "amendoim", "castanha", "cupcake",
    "milkshake", "taco", "omelete", "bacon", "frango assado", "sopa", "algodão-doce", "ovo frito",
    "iogurte", "espaguete", "chiclete", "bolo de aniversário",
  ]),
  ...group("comida", 3, [
    "feijoada", "moqueca", "fondue", "estrogonofe", "cuscuz", "acarajé", "pamonha", "ramen", "paella",
    "croissant", "pretzel", "burrito", "marshmallow", "churros", "quindim", "pudim", "empada", "esfiha",
    "kebab",
  ]),

  // ---------- profissoes / pessoas ----------
  ...group("profissao", 1, [
    "médico", "professor", "bombeiro", "policial", "cozinheiro", "pintor", "músico", "piloto",
    "dentista", "pescador", "palhaço", "mago", "pirata", "rei", "rainha", "princesa", "carteiro",
    "jogador de futebol", "enfermeira", "cantor", "soldado", "motorista", "bailarina",
  ]),
  ...group("profissao", 2, [
    "marinheiro", "cientista", "advogado", "agricultor", "astronauta", "cavaleiro", "mecânico",
    "carpinteiro", "fotógrafo", "jardineiro", "padeiro", "açougueiro", "salva-vidas", "juiz", "detetive",
    "garçom", "cabeleireiro", "veterinário", "arqueólogo", "mergulhador", "lenhador", "encanador",
    "eletricista", "faxineiro", "goleiro",
  ]),
  ...group("profissao", 3, [
    "samurai", "arquiteto", "engenheiro", "programador", "ventríloquo", "malabarista", "domador de leões",
    "meteorologista", "apicultor", "astrônomo", "escultor", "maestro", "acrobata", "mímico", "alfaiate",
    "ferreiro", "bibliotecário", "youtuber",
  ]),

  // ---------- lugares ----------
  ...group("lugar", 1, [
    "praia", "montanha", "floresta", "deserto", "castelo", "escola", "hospital", "fazenda", "cidade",
    "ponte", "ilha", "igreja", "parque", "farol", "iglu", "casa", "piscina", "jardim", "supermercado",
    "padaria", "estádio", "circo", "cinema", "banheiro", "cozinha",
  ]),
  ...group("lugar", 2, [
    "vulcão", "cachoeira", "aeroporto", "zoológico", "biblioteca", "caverna", "pirâmide", "museu",
    "prisão", "shopping", "restaurante", "acampamento", "estação de trem", "posto de gasolina",
    "parquinho", "quarto", "sala de aula", "oásis", "pântano", "porto", "rodoviária", "hotel", "teatro",
    "academia", "farmácia",
  ]),
  ...group("lugar", 3, [
    "torre eiffel", "estátua da liberdade", "cristo redentor", "muralha da china", "coliseu",
    "laboratório", "planetário", "labirinto", "geleira", "arquipélago", "parque de diversões",
    "estação espacial", "observatório", "catedral", "esgoto", "sótão", "porão", "calabouço", "cemitério",
    "torre de controle",
  ]),

  // ---------- acoes ----------
  ...group("acao", 1, [
    "correr", "nadar", "pular", "dançar", "cantar", "dormir", "chorar", "rir", "voar", "pescar",
    "cozinhar", "escrever", "desenhar", "lutar", "comer", "beber", "ler", "andar de bicicleta", "chutar",
    "abraçar", "acenar", "cair", "sentar",
  ]),
  ...group("acao", 2, [
    "escalar", "surfar", "mergulhar", "pintar", "espirrar", "bocejar", "tropeçar", "empurrar", "puxar",
    "varrer", "costurar", "plantar", "regar", "remar", "patinar", "esquiar", "fotografar", "gritar",
    "sussurrar", "cochilar", "malhar", "meditar", "tricotar", "assobiar", "roncar",
  ]),
  ...group("acao", 3, [
    "sonhar", "pensar", "esquecer", "procurar", "mentir", "esconder", "tremer", "derreter", "flutuar",
    "equilibrar", "hipnotizar", "discutir", "economizar", "desmaiar", "apostar", "votar", "reciclar",
    "fofocar", "mudar de casa",
  ]),

  // ---------- natureza / clima / espaco ----------
  ...group("natureza", 1, [
    "sol", "lua", "estrela", "nuvem", "chuva", "neve", "raio", "fogo", "árvore", "flor", "folha", "cacto",
    "cogumelo", "rio", "mar", "lago", "pedra", "grama", "onda",
  ]),
  ...group("natureza", 2, [
    "arco-íris", "tornado", "furacão", "cometa", "planeta", "girassol", "rosa", "palmeira", "pinheiro",
    "bambu", "tronco", "semente", "raiz", "areia", "gelo", "trovão", "meteoro", "coqueiro", "tulipa",
    "samambaia",
  ]),
  ...group("natureza", 3, [
    "terremoto", "eclipse", "neblina", "galáxia", "buraco negro", "aurora boreal", "tsunami", "avalanche",
    "constelação", "iceberg", "estalactite", "orvalho", "lava", "fóssil", "recife de coral", "redemoinho",
    "sistema solar",
  ]),

  // ---------- veiculos ----------
  ...group("veiculo", 1, [
    "carro", "moto", "bicicleta", "avião", "navio", "barco", "trem", "ônibus", "caminhão", "foguete",
    "trator", "skate", "táxi", "ambulância", "caminhão de bombeiro",
  ]),
  ...group("veiculo", 2, [
    "helicóptero", "submarino", "patinete", "balão de ar quente", "metrô", "jet ski", "canoa", "lancha",
    "carroça", "trenó", "van", "caminhão de lixo", "guindaste", "escavadeira",
  ]),
  ...group("veiculo", 3, [
    "disco voador", "dirigível", "teleférico", "triciclo", "monociclo", "planador", "carro de fórmula 1",
    "tanque de guerra", "jangada", "caravela", "riquixá", "rolo compressor",
  ]),

  // ---------- esportes ----------
  ...group("esporte", 1, ["futebol", "basquete", "vôlei", "tênis", "boxe", "pingue-pongue", "karatê", "natação"]),
  ...group("esporte", 2, [
    "golfe", "beisebol", "boliche", "surfe", "judô", "esgrima", "hóquei", "rugby", "handebol", "ciclismo",
    "arco e flecha", "sinuca", "patinação", "dardos", "ginástica",
  ]),
  ...group("esporte", 3, [
    "polo aquático", "salto com vara", "curling", "badminton", "escalada", "paraquedismo",
    "levantamento de peso", "nado sincronizado", "xadrez", "capoeira", "salto ornamental", "maratona",
    "tiro ao alvo", "asa-delta",
  ]),

  // ---------- fantasia / folclore ----------
  ...group("fantasia", 1, [
    "fantasma", "dragão", "bruxa", "robô", "unicórnio", "sereia", "fada", "monstro", "zumbi", "vampiro",
    "super-herói", "dinossauro",
  ]),
  ...group("fantasia", 2, [
    "alienígena", "lobisomem", "múmia", "ninja", "gnomo", "duende", "gigante", "ciclope", "esqueleto",
    "varinha mágica", "tesouro", "poção", "bola de cristal", "tapete voador", "castelo assombrado",
  ]),
  ...group("fantasia", 3, [
    "centauro", "fênix", "minotauro", "medusa", "pégaso", "kraken", "hidra", "grifo", "gênio da lâmpada",
    "saci", "curupira", "mula sem cabeça", "boitatá", "frankenstein", "pé grande", "elfo", "troll",
    "cavalo de troia",
  ]),
];

/** Mesma normalizacao usada no palpite: sem acento, sem hifen/espaco, minusculo. */
export function normalizeWord(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, "");
}

// remove duplicadas (mesma palavra normalizada), mantendo a primeira ocorrencia
const seen = new Set<string>();
export const DRAW_WORDS: WordEntry[] = RAW_WORDS.filter((entry) => {
  const key = normalizeWord(entry.word);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

function randomFrom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Uma opcao de cada dificuldade (facil, media, dificil), nessa ordem, nunca repetindo palavra ja
 * usada/oferecida na sala. Se uma dificuldade esgotar, reaproveita palavras dela (lista enorme,
 * so acontece em sessoes muito longas).
 */
export function pickWordOptions(usedWords: Set<string>): WordEntry[] {
  const options: WordEntry[] = [];
  for (const difficulty of [1, 2, 3] as const) {
    const sameDifficulty = DRAW_WORDS.filter((w) => w.difficulty === difficulty);
    const fresh = sameDifficulty.filter((w) => !usedWords.has(w.word));
    options.push(randomFrom(fresh.length > 0 ? fresh : sameDifficulty));
  }
  return options;
}
