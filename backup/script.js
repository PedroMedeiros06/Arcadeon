const maxAttempts = 6;
const wordLength = 5;

const gameGrid = document.getElementById("game");
const keyboard = document.getElementById("keyboard");

let validWords = []; // Palavras válidas carregadas do dicionário
let targetWord = ""; // Palavra secreta
let currentGuess = "";
let currentRow = 0;

const keyButtons = {}; // Para guardar os botões do teclado

// Bloqueia o teclado até o dicionário carregar
keyboard.style.pointerEvents = "none";

// Cria a modal para mostrar mensagens de vitória/derrota
const modal = document.createElement("div");
modal.style.position = "fixed";
modal.style.top = "0";
modal.style.left = "0";
modal.style.width = "100vw";
modal.style.height = "100vh";
modal.style.backgroundColor = "rgba(0,0,0,0.7)";
modal.style.display = "flex";
modal.style.justifyContent = "center";
modal.style.alignItems = "center";
modal.style.zIndex = "1000";
modal.style.visibility = "hidden"; // fica oculta inicialmente

const modalContent = document.createElement("div");
modalContent.style.backgroundColor = "#1e293b"; // cor tipo slate-800
modalContent.style.color = "white";
modalContent.style.padding = "2rem";
modalContent.style.borderRadius = "12px";
modalContent.style.textAlign = "center";
modalContent.style.maxWidth = "90%";
modalContent.style.boxShadow = "0 0 20px rgba(0,0,0,0.5)";
modal.appendChild(modalContent);

const modalMessage = document.createElement("p");
modalMessage.style.fontSize = "1.5rem";
modalMessage.style.marginBottom = "1.5rem";
modalContent.appendChild(modalMessage);

const modalButton = document.createElement("button");
modalButton.textContent = "Jogar novamente";
modalButton.style.padding = "0.5rem 1rem";
modalButton.style.fontSize = "1rem";
modalButton.style.border = "none";
modalButton.style.borderRadius = "6px";
modalButton.style.backgroundColor = "#2563eb"; // azul-600
modalButton.style.color = "white";
modalButton.style.cursor = "pointer";

modalButton.addEventListener("click", () => {
  modal.style.visibility = "hidden";
  resetGame();
});
modalContent.appendChild(modalButton);

document.body.appendChild(modal);

// Carrega o dicionário externo (arquivo txt com uma palavra por linha)
async function loadDictionary() {
  try {
    const response = await fetch('words.txt');
    const text = await response.text();
    validWords = text
      .split('\n')
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length === wordLength);

    console.log("Dicionário carregado:", validWords);

    targetWord = validWords[Math.floor(Math.random() * validWords.length)];
    console.log("Palavra secreta:", targetWord);

    keyboard.style.pointerEvents = "auto";
  } catch (error) {
    console.error("Erro ao carregar dicionário:", error);
  }
}

loadDictionary();

for (let i = 0; i < maxAttempts; i++) {
  const row = document.createElement("div");
  row.className = "flex gap-2 justify-center";
  for (let j = 0; j < wordLength; j++) {
    const box = document.createElement("div");
    box.className = "w-12 h-12 border text-xl font-bold flex items-center justify-center uppercase bg-slate-300/20 border-none rounded-md";
    row.appendChild(box);
  }
  gameGrid.appendChild(row);
}

const keysLayout = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Enter", "Z", "X", "C", "V", "B", "N", "M", "Back"]
];

keysLayout.forEach(rowKeys => {
  const row = document.createElement("div");
  row.className = "flex gap-1";

  rowKeys.forEach(key => {
    const btn = document.createElement("button");
    btn.textContent = key;
    btn.className = `
      px-3 py-2 rounded-md bg-slate-600 text-white font-semibold
      hover:bg-slate-500 transition min-w-[40px]
      ${key === "Enter" || key === "Back" ? "flex-1" : ""}
    `;
    keyButtons[key.toLowerCase()] = btn;

    btn.addEventListener("click", () => handleKey(key));
    row.appendChild(btn);
  });

  keyboard.appendChild(row);
});

function handleKey(key) {
  if (currentRow >= maxAttempts) return;

  if (key === "Enter") {
    if (currentGuess.length < wordLength) return;
    if (!validWords.includes(currentGuess)) {
      // Pode colocar uma mensagem de erro se quiser
      return;
    }
    checkGuess();
    return;
  }

  if (key === "Back") {
    currentGuess = currentGuess.slice(0, -1);
  } else if (/^[a-zA-Z]$/.test(key) && currentGuess.length < wordLength) {
    currentGuess += key.toLowerCase();
  }

  updateGrid();
}

function updateGrid() {
  const row = gameGrid.children[currentRow];
  for (let i = 0; i < wordLength; i++) {
    const box = row.children[i];
    box.textContent = currentGuess[i] ? currentGuess[i].toUpperCase() : "";
  }
}

function checkGuess() {
  const guess = currentGuess;
  const row = gameGrid.children[currentRow];

  for (let i = 0; i < wordLength; i++) {
    const letter = guess[i];
    const box = row.children[i];
    const keyBtn = keyButtons[letter];

    if (letter === targetWord[i]) {
      box.classList.add("bg-green-600", "text-white");
      updateKeyColor(keyBtn, "green");
    } else if (targetWord.includes(letter)) {
      box.classList.add("bg-yellow-500", "text-white");
      updateKeyColor(keyBtn, "yellow");
    } else {
      box.classList.add("bg-gray-600", "text-white");
      updateKeyColor(keyBtn, "gray");
    }
  }

  if (guess === targetWord) {
    showModal(`Parabéns! Você acertou em ${currentRow + 1} tentativa(s)!`);
  } else if (currentRow === maxAttempts - 1) {
    showModal(`Fim de jogo! A palavra era: <strong>${targetWord.toUpperCase()}</strong>`);
  }

  currentRow++;
  currentGuess = "";
}

function updateKeyColor(button, color) {
  if (!button) return;
  const colors = {
    green: "bg-green-600",
    yellow: "bg-yellow-500",
    gray: "bg-gray-600"
  };

  if (
    (color === "yellow" && button.classList.contains(colors.green)) ||
    (color === "gray" && (button.classList.contains(colors.green) || button.classList.contains(colors.yellow)))
  ) {
    return;
  }

  button.classList.remove("bg-slate-600", "bg-green-600", "bg-yellow-500", "bg-gray-600");
  button.classList.add(colors[color]);
}

function showModal(message) {
  modalMessage.innerHTML = message;
  modal.style.visibility = "visible";
}

function resetGame() {
  // Resetar variáveis
  currentGuess = "";
  currentRow = 0;

  // Limpar grid
  for (let i = 0; i < maxAttempts; i++) {
    const row = gameGrid.children[i];
    for (let j = 0; j < wordLength; j++) {
      const box = row.children[j];
      box.textContent = "";
      box.className = "w-12 h-12 border text-xl font-bold flex items-center justify-center uppercase bg-slate-300/20 border-none rounded-md";
    }
  }

  // Resetar cores do teclado
  Object.values(keyButtons).forEach(btn => {
    btn.classList.remove("bg-green-600", "bg-yellow-500", "bg-gray-600");
    btn.classList.add("bg-slate-600");
  });

  // Escolher nova palavra secreta
  targetWord = validWords[Math.floor(Math.random() * validWords.length)];
  console.log("Nova palavra secreta:", targetWord);
}

// Eventos do teclado físico
document.addEventListener("keydown", (e) => {
  const key = e.key;
  if (key === "Backspace") handleKey("Back");
  else if (key === "Enter") handleKey("Enter");
  else if (/^[a-zA-Z]$/.test(key)) handleKey(key.toUpperCase());
});