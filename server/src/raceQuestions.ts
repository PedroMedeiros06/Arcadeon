// Banco de perguntas da Corrida do Conhecimento.
// Lote inicial escrito a mao pra desenvolvimento. O banco completo (300-500) vira de fonte
// externa via script de importacao — ver plano/notas do Obsidian.

export type RaceCategory =
  | "historia"
  | "geografia"
  | "ciencias"
  | "matematica"
  | "tecnologia"
  | "arte-cultura"
  | "esportes"
  | "lingua-portuguesa"
  | "curiosidades";

export type RaceDifficulty = 1 | 2 | 3;

export interface RaceQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  category: RaceCategory;
  difficulty: RaceDifficulty;
}

export const CATEGORY_LABELS: Record<RaceCategory, string> = {
  historia: "História",
  geografia: "Geografia",
  ciencias: "Ciências",
  matematica: "Matemática",
  tecnologia: "Tecnologia",
  "arte-cultura": "Arte & Cultura",
  esportes: "Esportes",
  "lingua-portuguesa": "Língua Portuguesa",
  curiosidades: "Curiosidades",
};

export const RACE_QUESTIONS: RaceQuestion[] = [
  // historia
  { id: "his-001", question: "Em que ano o Brasil declarou sua independência?", options: ["1500", "1808", "1822", "1889"], correctIndex: 2, category: "historia", difficulty: 1 },
  { id: "his-002", question: "Quem proclamou a República no Brasil?", options: ["Dom Pedro II", "Marechal Deodoro da Fonseca", "Getúlio Vargas", "Tiradentes"], correctIndex: 1, category: "historia", difficulty: 1 },
  { id: "his-003", question: "Qual civilização construiu Machu Picchu?", options: ["Astecas", "Maias", "Incas", "Olmecas"], correctIndex: 2, category: "historia", difficulty: 2 },
  { id: "his-004", question: "Em que ano caiu o Muro de Berlim?", options: ["1985", "1989", "1991", "1995"], correctIndex: 1, category: "historia", difficulty: 2 },
  { id: "his-005", question: "Qual lei aboliu a escravidão no Brasil em 1888?", options: ["Lei do Ventre Livre", "Lei Eusébio de Queirós", "Lei Áurea", "Lei dos Sexagenários"], correctIndex: 2, category: "historia", difficulty: 1 },
  { id: "his-006", question: "Quem foi o primeiro imperador de Roma?", options: ["Júlio César", "Augusto", "Nero", "Constantino"], correctIndex: 1, category: "historia", difficulty: 3 },
  { id: "his-007", question: "A Revolução Francesa começou em qual ano?", options: ["1776", "1789", "1815", "1848"], correctIndex: 1, category: "historia", difficulty: 2 },

  // geografia
  { id: "geo-001", question: "Qual é a capital da Austrália?", options: ["Sydney", "Melbourne", "Camberra", "Perth"], correctIndex: 2, category: "geografia", difficulty: 2 },
  { id: "geo-002", question: "Qual é o maior oceano do planeta?", options: ["Atlântico", "Índico", "Ártico", "Pacífico"], correctIndex: 3, category: "geografia", difficulty: 1 },
  { id: "geo-003", question: "Qual é a capital do Japão?", options: ["Seul", "Tóquio", "Pequim", "Bangkok"], correctIndex: 1, category: "geografia", difficulty: 1 },
  { id: "geo-004", question: "Qual é o maior estado brasileiro em área?", options: ["Pará", "Mato Grosso", "Amazonas", "Minas Gerais"], correctIndex: 2, category: "geografia", difficulty: 1 },
  { id: "geo-005", question: "Qual é a montanha mais alta do mundo?", options: ["K2", "Monte Everest", "Aconcágua", "Kilimanjaro"], correctIndex: 1, category: "geografia", difficulty: 1 },
  { id: "geo-006", question: "Qual país tem o maior número de fusos horários?", options: ["Rússia", "Estados Unidos", "França", "China"], correctIndex: 2, category: "geografia", difficulty: 3 },
  { id: "geo-007", question: "Qual rio passa pela cidade do Cairo?", options: ["Tigre", "Nilo", "Congo", "Eufrates"], correctIndex: 1, category: "geografia", difficulty: 2 },
  { id: "geo-008", question: "Qual é a capital do Canadá?", options: ["Toronto", "Vancouver", "Montreal", "Ottawa"], correctIndex: 3, category: "geografia", difficulty: 2 },

  // ciencias
  { id: "cie-001", question: "Qual é o maior planeta do Sistema Solar?", options: ["Terra", "Marte", "Júpiter", "Saturno"], correctIndex: 2, category: "ciencias", difficulty: 1 },
  { id: "cie-002", question: "Qual é o símbolo químico do ouro?", options: ["Ag", "Au", "Go", "Or"], correctIndex: 1, category: "ciencias", difficulty: 2 },
  { id: "cie-003", question: "Quantos ossos tem o corpo humano adulto?", options: ["186", "206", "226", "256"], correctIndex: 1, category: "ciencias", difficulty: 2 },
  { id: "cie-004", question: "Qual gás as plantas absorvem na fotossíntese?", options: ["Oxigênio", "Nitrogênio", "Gás carbônico", "Hidrogênio"], correctIndex: 2, category: "ciencias", difficulty: 1 },
  { id: "cie-005", question: "Qual planeta é conhecido como Planeta Vermelho?", options: ["Vênus", "Marte", "Mercúrio", "Júpiter"], correctIndex: 1, category: "ciencias", difficulty: 1 },
  { id: "cie-006", question: "Qual é a organela responsável pela respiração celular?", options: ["Ribossomo", "Lisossomo", "Mitocôndria", "Complexo de Golgi"], correctIndex: 2, category: "ciencias", difficulty: 2 },
  { id: "cie-007", question: "Qual é o elemento químico mais abundante no universo?", options: ["Oxigênio", "Hélio", "Carbono", "Hidrogênio"], correctIndex: 3, category: "ciencias", difficulty: 3 },
  { id: "cie-008", question: "A que temperatura a água ferve ao nível do mar?", options: ["90 °C", "100 °C", "110 °C", "120 °C"], correctIndex: 1, category: "ciencias", difficulty: 1 },

  // matematica
  { id: "mat-001", question: "Quanto é 7 × 8?", options: ["54", "56", "58", "64"], correctIndex: 1, category: "matematica", difficulty: 1 },
  { id: "mat-002", question: "Qual é a raiz quadrada de 144?", options: ["11", "12", "13", "14"], correctIndex: 1, category: "matematica", difficulty: 1 },
  { id: "mat-003", question: "Quantos graus tem a soma dos ângulos internos de um triângulo?", options: ["90°", "180°", "270°", "360°"], correctIndex: 1, category: "matematica", difficulty: 1 },
  { id: "mat-004", question: "Quanto é 15% de 200?", options: ["15", "20", "30", "35"], correctIndex: 2, category: "matematica", difficulty: 2 },
  { id: "mat-005", question: "Qual destes números é primo?", options: ["21", "27", "29", "33"], correctIndex: 2, category: "matematica", difficulty: 2 },
  { id: "mat-006", question: "Quantos lados tem um hexágono?", options: ["5", "6", "7", "8"], correctIndex: 1, category: "matematica", difficulty: 1 },
  { id: "mat-007", question: "Quanto é 2 elevado a 10?", options: ["512", "1000", "1024", "2048"], correctIndex: 2, category: "matematica", difficulty: 3 },

  // tecnologia
  { id: "tec-001", question: "O que significa a sigla CPU?", options: ["Central Processing Unit", "Computer Power Unit", "Central Program Utility", "Core Processing Utility"], correctIndex: 0, category: "tecnologia", difficulty: 2 },
  { id: "tec-002", question: "Quantos bits tem um byte?", options: ["4", "8", "16", "32"], correctIndex: 1, category: "tecnologia", difficulty: 1 },
  { id: "tec-003", question: "Qual linguagem é usada para estruturar páginas web?", options: ["HTML", "Python", "SQL", "C++"], correctIndex: 0, category: "tecnologia", difficulty: 1 },
  { id: "tec-004", question: "Quem é considerado o criador da World Wide Web?", options: ["Bill Gates", "Steve Jobs", "Tim Berners-Lee", "Alan Turing"], correctIndex: 2, category: "tecnologia", difficulty: 3 },
  { id: "tec-005", question: "Qual é o sistema de numeração usado internamente pelos computadores?", options: ["Decimal", "Binário", "Romano", "Hexadecimal"], correctIndex: 1, category: "tecnologia", difficulty: 1 },
  { id: "tec-006", question: "O que significa a sigla RAM?", options: ["Read Access Memory", "Random Access Memory", "Rapid Action Module", "Remote Access Machine"], correctIndex: 1, category: "tecnologia", difficulty: 2 },

  // arte-cultura
  { id: "art-001", question: "Quem pintou a Mona Lisa?", options: ["Michelangelo", "Leonardo da Vinci", "Rafael", "Van Gogh"], correctIndex: 1, category: "arte-cultura", difficulty: 1 },
  { id: "art-002", question: "Quem escreveu 'Dom Casmurro'?", options: ["José de Alencar", "Machado de Assis", "Jorge Amado", "Clarice Lispector"], correctIndex: 1, category: "arte-cultura", difficulty: 1 },
  { id: "art-003", question: "Quem pintou 'Abaporu'?", options: ["Anita Malfatti", "Di Cavalcanti", "Tarsila do Amaral", "Candido Portinari"], correctIndex: 2, category: "arte-cultura", difficulty: 2 },
  { id: "art-004", question: "Quem compôs a 'Nona Sinfonia'?", options: ["Mozart", "Bach", "Beethoven", "Chopin"], correctIndex: 2, category: "arte-cultura", difficulty: 2 },
  { id: "art-005", question: "Quem escreveu 'Romeu e Julieta'?", options: ["Charles Dickens", "William Shakespeare", "Miguel de Cervantes", "Victor Hugo"], correctIndex: 1, category: "arte-cultura", difficulty: 1 },
  { id: "art-006", question: "Em que ano aconteceu a Semana de Arte Moderna em São Paulo?", options: ["1902", "1922", "1942", "1964"], correctIndex: 1, category: "arte-cultura", difficulty: 3 },

  // esportes
  { id: "esp-001", question: "Quantos jogadores um time de futebol tem em campo?", options: ["9", "10", "11", "12"], correctIndex: 2, category: "esportes", difficulty: 1 },
  { id: "esp-002", question: "Quantas Copas do Mundo de futebol masculino o Brasil venceu?", options: ["3", "4", "5", "6"], correctIndex: 2, category: "esportes", difficulty: 1 },
  { id: "esp-003", question: "Em qual esporte se usa o termo 'ace'?", options: ["Futebol", "Tênis", "Basquete", "Natação"], correctIndex: 1, category: "esportes", difficulty: 2 },
  { id: "esp-004", question: "Quantos pontos vale uma cesta de fora do arco no basquete?", options: ["1", "2", "3", "4"], correctIndex: 2, category: "esportes", difficulty: 1 },
  { id: "esp-005", question: "De quantos em quantos anos acontecem os Jogos Olímpicos de Verão?", options: ["2", "3", "4", "5"], correctIndex: 2, category: "esportes", difficulty: 1 },
  { id: "esp-006", question: "Qual piloto brasileiro foi tricampeão de Fórmula 1 e morreu em 1994?", options: ["Nelson Piquet", "Emerson Fittipaldi", "Ayrton Senna", "Rubens Barrichello"], correctIndex: 2, category: "esportes", difficulty: 2 },
  { id: "esp-007", question: "Qual é a distância oficial de uma maratona?", options: ["21,1 km", "36 km", "42,195 km", "50 km"], correctIndex: 2, category: "esportes", difficulty: 3 },

  // lingua-portuguesa
  { id: "lin-001", question: "Qual é o plural de 'cidadão'?", options: ["Cidadões", "Cidadães", "Cidadãos", "Cidadans"], correctIndex: 2, category: "lingua-portuguesa", difficulty: 2 },
  { id: "lin-002", question: "Qual palavra está escrita corretamente?", options: ["Excessão", "Exceção", "Esceção", "Execção"], correctIndex: 1, category: "lingua-portuguesa", difficulty: 2 },
  { id: "lin-003", question: "Qual é o antônimo de 'efêmero'?", options: ["Passageiro", "Duradouro", "Rápido", "Frágil"], correctIndex: 1, category: "lingua-portuguesa", difficulty: 3 },
  { id: "lin-004", question: "Qual é o sinônimo de 'feliz'?", options: ["Triste", "Contente", "Cansado", "Bravo"], correctIndex: 1, category: "lingua-portuguesa", difficulty: 1 },
  { id: "lin-005", question: "Quantas sílabas tem a palavra 'paralelepípedo'?", options: ["5", "6", "7", "8"], correctIndex: 2, category: "lingua-portuguesa", difficulty: 3 },
  { id: "lin-006", question: "Qual classe de palavra indica ação, estado ou fenômeno?", options: ["Substantivo", "Adjetivo", "Verbo", "Advérbio"], correctIndex: 2, category: "lingua-portuguesa", difficulty: 1 },

  // curiosidades
  { id: "cur-001", question: "Quantas patas tem uma aranha?", options: ["6", "8", "10", "12"], correctIndex: 1, category: "curiosidades", difficulty: 1 },
  { id: "cur-002", question: "Qual é o maior mamífero do mundo?", options: ["Elefante-africano", "Baleia-azul", "Girafa", "Tubarão-baleia"], correctIndex: 1, category: "curiosidades", difficulty: 1 },
  { id: "cur-003", question: "Quantos corações tem um polvo?", options: ["1", "2", "3", "4"], correctIndex: 2, category: "curiosidades", difficulty: 3 },
  { id: "cur-004", question: "Qual é o único mamífero capaz de voar de verdade?", options: ["Esquilo-voador", "Morcego", "Colugo", "Petauro"], correctIndex: 1, category: "curiosidades", difficulty: 2 },
  { id: "cur-005", question: "Quantas cores tem o arco-íris na divisão tradicional?", options: ["5", "6", "7", "8"], correctIndex: 2, category: "curiosidades", difficulty: 1 },
  { id: "cur-006", question: "Qual animal é o símbolo da WWF?", options: ["Tigre", "Panda-gigante", "Coala", "Urso-polar"], correctIndex: 1, category: "curiosidades", difficulty: 2 },
  { id: "cur-007", question: "Qual fruta tem as sementes do lado de fora?", options: ["Uva", "Morango", "Kiwi", "Maçã"], correctIndex: 1, category: "curiosidades", difficulty: 2 },
];

/** Falha no load do modulo se o banco tiver erro estrutural — melhor quebrar o boot que servir pergunta quebrada. */
function validateQuestions(questions: RaceQuestion[]): void {
  const ids = new Set<string>();
  for (const q of questions) {
    if (ids.has(q.id)) throw new Error(`raceQuestions: id duplicado ${q.id}`);
    ids.add(q.id);
    if (q.options.length !== 4) throw new Error(`raceQuestions: ${q.id} precisa de 4 opcoes`);
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== 4) {
      throw new Error(`raceQuestions: ${q.id} tem opcoes repetidas`);
    }
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
      throw new Error(`raceQuestions: ${q.id} correctIndex invalido`);
    }
    if (!(q.category in CATEGORY_LABELS)) throw new Error(`raceQuestions: ${q.id} categoria invalida`);
  }
}

validateQuestions(RACE_QUESTIONS);
