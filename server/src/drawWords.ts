import { randomInt } from "crypto";

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
  // ---------- ampliacao (setembro/2026) ----------
  ...group("animal", 1, [
    "burro", "ganso", "grilo", "barata", "mosca", "lesma", "pombo", "peixinho", "cachorrinho", "gatinho",
  ]),
  ...group("animal", 2, [
    "leão-marinho", "texugo", "lontra", "iguana", "salamandra", "jabuti", "piranha", "pelicano", "arara",
    "gavião", "peixe-palhaço", "lula", "ostra", "enguia", "bode", "pônei", "joão-de-barro",
  ]),
  ...group("animal", 3, [
    "axolote", "peixe-boi", "mico-leão-dourado", "boto", "carrapato", "cupim", "sanguessuga", "pulga",
    "ouriço-do-mar", "lagartixa", "siri", "tatu-bola", "anta", "quati",
  ]),
  ...group("objeto", 1, [
    "prego", "corda", "fita", "cola", "bolsa", "cesta", "vaso", "pincel", "apito", "sino", "almofada",
    "tapete", "cortina", "caderno", "chupeta", "mamadeira",
  ]),
  ...group("objeto", 2, [
    "funil", "peneira", "ralador", "saca-rolhas", "abridor de latas", "cadeira de rodas", "muleta", "berço",
    "carrinho de bebê", "fralda", "baú", "corrente", "ímã", "cortador de unha", "estilingue", "bengala",
    "boia", "cofre", "escorregador", "gangorra", "balanço", "cadeira de praia", "guarda-sol",
  ]),
  ...group("objeto", 3, [
    "ratoeira", "desentupidor", "espanador", "colete salva-vidas", "filtro dos sonhos", "pêndulo",
    "relógio cuco", "globo de neve", "ventosa", "lava-louças", "máquina de costura", "ferro de passar",
    "tábua de passar", "varal", "fechadura", "campainha", "porta-retrato",
  ]),
  ...group("comida", 1, ["manteiga", "mel", "gelatina", "chá", "bolacha", "ovo de páscoa", "pão doce"]),
  ...group("comida", 2, [
    "cereal", "nugget", "brownie", "linguiça", "pimentão", "rabanete", "beterraba", "romã", "maracujá",
    "goiaba", "jabuticaba", "caju", "salame", "picanha", "pão francês", "biscoito recheado",
  ]),
  ...group("comida", 3, [
    "canjica", "cocada", "paçoca", "pé de moleque", "risoto", "nhoque", "caldo de cana", "carambola",
    "sagu", "vatapá", "bolo de rolo", "baião de dois", "arroz-doce",
  ]),
  ...group("profissao", 1, ["vendedor", "fazendeiro", "babá", "atleta"]),
  ...group("profissao", 2, [
    "pedreiro", "costureira", "barbeiro", "frentista", "entregador", "guarda de trânsito", "comissário de bordo",
    "surfista", "lixeiro", "cowboy",
  ]),
  ...group("profissao", 3, [
    "paleontólogo", "cartógrafo", "tatuador", "chaveiro", "psicólogo", "florista", "confeiteiro", "leiloeiro",
    "influenciador",
  ]),
  ...group("lugar", 1, ["loja", "rua", "estrada", "fonte", "poço", "torre", "túnel", "praça", "sorveteria"]),
  ...group("lugar", 2, [
    "celeiro", "moinho", "feira", "delegacia", "correio", "aquário", "estufa", "canteiro de obras",
    "salão de beleza", "barbearia", "lavanderia", "garagem", "varanda", "quadra", "pista de skate",
  ]),
  ...group("lugar", 3, [
    "torre de pisa", "big ben", "taj mahal", "pão de açúcar", "esfinge", "monte everest", "cânion",
    "manguezal", "mesquita", "ilha deserta", "estação de esqui", "cratera",
  ]),
  ...group("acao", 1, [
    "pular corda", "lavar", "tomar banho", "escovar os dentes", "jogar bola", "beijar", "tomar sorvete",
  ]),
  ...group("acao", 2, [
    "mastigar", "piscar", "tocar violão", "passear com o cachorro", "fazer compras", "cortar cabelo",
    "lavar louça", "passar roupa", "acampar", "velejar", "fazer careta", "tirar selfie", "bater palmas",
    "espreguiçar", "coçar",
  ]),
  ...group("acao", 3, [
    "soluçar", "engasgar", "maquiar", "fazer ioga", "espiar", "fazer malabarismo", "ficar de castigo",
    "levar bronca", "perder o ônibus", "cair da cama", "ter um pesadelo",
  ]),
  ...group("natureza", 1, ["céu", "gota", "galho", "ninho", "lua cheia", "boneco de neve"]),
  ...group("natureza", 2, [
    "vento", "pôr do sol", "orquídea", "trigo", "musgo", "duna", "penhasco", "trevo de quatro folhas",
    "vitória-régia", "carvalho", "salgueiro", "granizo", "estrela cadente",
  ]),
  ...group("natureza", 3, ["geada", "gêiser", "estalagmite", "maré alta", "chuva de meteoros", "ipê", "caatinga", "cerrado"]),
  ...group("veiculo", 1, ["ônibus escolar", "carro de polícia", "barco a vela", "carrinho"]),
  ...group("veiculo", 2, [
    "veleiro", "iate", "caiaque", "limusine", "carro de corrida", "trem-bala", "bonde", "empilhadeira",
    "quadriciclo", "caminhão-tanque", "betoneira",
  ]),
  ...group("veiculo", 3, [
    "catamarã", "zepelim", "ônibus espacial", "sidecar", "carro alegórico", "diligência", "gôndola",
    "hovercraft", "trem fantasma", "bondinho",
  ]),
  ...group("esporte", 1, ["corrida", "balé", "pesca", "queimada", "pega-pega", "esconde-esconde"]),
  ...group("esporte", 2, [
    "futebol americano", "canoagem", "remo", "vôlei de praia", "hipismo", "sumô", "luta livre", "frescobol",
    "peteca", "amarelinha", "cabo de guerra", "bola de gude",
  ]),
  ...group("esporte", 3, [
    "biatlo", "bobsled", "pentatlo", "slackline", "parkour", "bungee jump", "rapel", "kitesurfe",
    "windsurfe", "corrida de saco", "stand up paddle",
  ]),
  ...group("fantasia", 1, ["anjo", "caveira", "papai noel", "abóbora de halloween"]),
  ...group("fantasia", 2, [
    "vassoura voadora", "caldeirão", "chapéu de bruxa", "anão", "ogro", "yeti", "fada madrinha",
    "coelho da páscoa", "fada do dente", "espada mágica", "sapo príncipe",
  ]),
  ...group("fantasia", 3, [
    "iara", "cuca", "boto cor-de-rosa", "quimera", "basilisco", "leviatã", "ciborgue", "golem",
    "dragão chinês", "cavaleiro sem cabeça",
  ]),

  // ---------- corpo ----------
  ...group("corpo", 1, [
    "nariz", "olho", "boca", "orelha", "mão", "pé", "dente", "cabelo", "coração", "dedo", "perna", "braço",
    "língua", "unha",
  ]),
  ...group("corpo", 2, [
    "sobrancelha", "umbigo", "cérebro", "joelho", "cotovelo", "bigode", "barba", "pulmão", "osso", "careca",
    "sardas", "tatuagem", "trança", "rabo de cavalo",
  ]),
  ...group("corpo", 3, [
    "impressão digital", "dentadura", "aparelho dentário", "músculo", "estômago", "coluna vertebral",
    "covinha", "olheira", "dor de cabeça", "arrepio", "cicatriz",
  ]),

  // ---------- roupas e acessorios ----------
  ...group("roupa", 1, [
    "saia", "bota", "pijama", "cinto", "biquíni", "cachecol", "avental", "brinco", "colar", "pulseira",
    "chinelo", "sandália", "jaqueta", "touca", "shorts",
  ]),
  ...group("roupa", 2, [
    "macacão", "capa de chuva", "uniforme", "máscara", "peruca", "suspensório", "gorro", "maiô", "sunga",
    "salto alto", "tiara", "laço", "óculos de sol",
  ]),
  ...group("roupa", 3, [
    "smoking", "quimono", "cartola", "sobretudo", "monóculo", "espartilho", "poncho", "sombrero", "turbante",
    "colete", "galocha", "gravata-borboleta", "vestido de noiva",
  ]),

  // ---------- tecnologia ----------
  ...group("tecnologia", 1, ["tablet", "notebook", "tomada", "pilha", "antena", "videogame", "drone", "calculadora"]),
  ...group("tecnologia", 2, [
    "satélite", "carregador", "pen drive", "selfie", "emoji", "wi-fi", "senha", "código de barras",
    "caixa de som", "webcam", "relógio inteligente", "controle de videogame", "radar",
  ]),
  ...group("tecnologia", 3, [
    "realidade virtual", "impressora 3d", "painel solar", "cabo usb", "torre de celular", "holograma",
    "chip", "bateria fraca", "tela quebrada", "vírus de computador", "robô aspirador",
  ]),

  // ---------- musica ----------
  ...group("musica", 1, ["nota musical", "pandeiro", "xilofone", "triângulo", "chocalho", "rádio"]),
  ...group("musica", 2, [
    "trombone", "tuba", "violoncelo", "berimbau", "cuíca", "ukulele", "banjo", "gaita", "maraca",
    "castanhola", "disco de vinil", "partitura", "caixa de música", "megafone",
  ]),
  ...group("musica", 3, [
    "órgão", "clarinete", "orquestra", "banda de rock", "karaokê", "dj", "coral", "fanfarra", "roda de samba",
  ]),

  // ---------- Brasil (festas e cultura) ----------
  ...group("brasil", 1, ["carnaval", "fogueira", "samba", "festa junina", "bandeira do brasil"]),
  ...group("brasil", 2, [
    "quadrilha", "balão junino", "bandeirinha", "chimarrão", "pau de sebo", "escola de samba", "abadá",
    "trio elétrico", "quentão",
  ]),
  ...group("brasil", 3, [
    "bumba meu boi", "frevo", "carranca", "maracatu", "cordel", "mestre-sala", "porta-bandeira",
    "baiana do acarajé",
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

// ---------- sorteio ----------
//
// Cada dificuldade tem um "baralho" global (compartilhado por todas as salas do processo),
// embaralhado com crypto. As palavras saem do topo e so voltam quando o baralho inteiro acaba:
// abrir sala nova nao faz as mesmas palavras reaparecerem logo no comeco. Dentro da sala, nada
// que ja foi oferecido reaparece, as 3 opcoes sao de categorias diferentes e o tema dos ultimos
// turnos e evitado quando possivel.

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const decks = new Map<Difficulty, WordEntry[]>();

function deckFor(difficulty: Difficulty): WordEntry[] {
  let deck = decks.get(difficulty);
  if (!deck || deck.length === 0) {
    deck = shuffle(DRAW_WORDS.filter((w) => w.difficulty === difficulty));
    decks.set(difficulty, deck);
  }
  return deck;
}

/** Tira do baralho a primeira palavra que passa no filtro; se nenhuma passar, retorna null. */
function drawFromDeck(difficulty: Difficulty, accept: (w: WordEntry) => boolean): WordEntry | null {
  const deck = deckFor(difficulty);
  const index = deck.findIndex(accept);
  if (index === -1) return null;
  const [entry] = deck.splice(index, 1);
  return entry;
}

/**
 * Uma opcao de cada dificuldade (facil, media, dificil), nessa ordem. Relaxa as restricoes aos
 * poucos (tema recente, depois categoria repetida) e, no limite, reembaralha o baralho; so repete
 * palavra da sala se a dificuldade inteira ja tiver sido usada nela.
 */
export function pickWordOptions(usedWords: Set<string>, recentCategories: string[] = []): WordEntry[] {
  const options: WordEntry[] = [];
  for (const difficulty of [1, 2, 3] as const) {
    const taken = new Set(options.map((o) => o.category));
    const fresh = (w: WordEntry) => !usedWords.has(w.word);
    const attempts: ((w: WordEntry) => boolean)[] = [
      (w) => fresh(w) && !taken.has(w.category) && !recentCategories.includes(w.category),
      (w) => fresh(w) && !taken.has(w.category),
      fresh,
    ];
    let entry: WordEntry | null = null;
    for (const accept of attempts) {
      entry = drawFromDeck(difficulty, accept);
      if (entry) break;
    }
    if (!entry) {
      // baralho global sem nada novo pra essa sala: reembaralha e tenta de novo
      decks.delete(difficulty);
      entry = drawFromDeck(difficulty, fresh) ?? deckFor(difficulty)[randomInt(deckFor(difficulty).length)];
    }
    options.push(entry);
  }
  return options;
}
