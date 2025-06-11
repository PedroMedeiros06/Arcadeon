const maxAttempts = 6;
const wordLength = 5;

const gameGrid = document.getElementById("game");
const keyboard = document.getElementById("keyboard");

let startTime = null

let validWords = [];
let targetWord = "";
let currentGuess = "";
let currentRow = 0;

const keyButtons = {};

keyboard.style.pointerEvents = "none";

const modal = document.getElementById("modal");
const resultD = document.getElementById("resultD");
const resultH = document.getElementById("resultH")
const resetBtn = document.getElementById("restartGame")
const timeText = document.getElementById("resultTime")

async function loadDictionary() {
  try {
    const response = await fetch('../src/words5.txt');
    const text = await response.text();
    validWords = text
      .split('\n')
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length === wordLength);

    console.log("Dicionário carregado:", validWords);

    targetWord = validWords[Math.floor(Math.random() * validWords.length)];
    startTime = Date.now
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
  const letterCount = {};

  // Conta quantas vezes cada letra aparece na palavra-alvo
  for (let letter of targetWord) {
    letterCount[letter] = (letterCount[letter] || 0) + 1;
  }

  // Primeiro passo: marcar verdes
  const colors = Array(wordLength).fill("gray");
  for (let i = 0; i < wordLength; i++) {
    if (guess[i] === targetWord[i]) {
      colors[i] = "green";
      letterCount[guess[i]]--;
    }
  }

  // Segundo passo: marcar amarelos (apenas se ainda houver aquela letra restante)
  for (let i = 0; i < wordLength; i++) {
    if (colors[i] === "gray" && targetWord.includes(guess[i]) && letterCount[guess[i]] > 0) {
      colors[i] = "yellow";
      letterCount[guess[i]]--;
    }
  }

  // Aplica cores na interface
  for (let i = 0; i < wordLength; i++) {
    const box = row.children[i];
    const letter = guess[i];
    const keyBtn = keyButtons[letter];

    box.textContent = letter.toUpperCase();

    if (colors[i] === "green") {
      box.classList.add("bg-green-600", "text-white");
      updateKeyColor(keyBtn, "green");
    } else if (colors[i] === "yellow") {
      box.classList.add("bg-yellow-500", "text-white");
      updateKeyColor(keyBtn, "yellow");
    } else {
      box.classList.add("bg-gray-600", "text-white");
      updateKeyColor(keyBtn, "gray");
    }
  }

  const attempt = currentRow + 1;

  const endTime = Date.now();
  const elapsedSeconds = Math.floor((endTime - startTime) / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeString = `${minutes}m ${seconds}s`;

  if (guess === targetWord) {
    let feedback = "";

    if (attempt === 1) feedback = "Você é um gênio!";
    else if (attempt <= 3) feedback = "Incrível!";
    else if (attempt <= 5) feedback = "Muito bom!";
    else feedback = "Na última! Quase!";

    showModal('VITORIA', `Parabéns! Você acertou em ${attempt} tentativa(s)!<br><strong>${feedback}</strong>`, `Tempo: <strong>${timeString}</strong>`);
  } else if (currentRow === maxAttempts - 1) {
    showModal('DERROTA', `Fim de jogo! A palavra era: <strong>${targetWord.toUpperCase()}</strong>`, `Tempo: <strong>${timeString}</strong>`);
  }

  currentRow++;
  currentGuess = "";
}

function updateKeyColor(button, color) {
  if (!button) return;
  const colors = {
    green: "bg-green-600",
    yellow: "bg-yellow-500",
    gray: "bg-gray-800"
  };

  if (
    (color === "yellow" && button.classList.contains(colors.green)) ||
    (color === "gray" && (button.classList.contains(colors.green) || button.classList.contains(colors.yellow)))
  ) {
    return;
  }

  button.classList.remove("bg-slate-600", "bg-green-600", "bg-yellow-500", "bg-gray-600", "bg-gray-800");
  button.classList.add(colors[color]);
}


function showModal(result, message, time) {
  resultH.innerHTML = result
  resultD.innerHTML = message;
  timeText.innerHTML = time
  modal.classList.remove("hidden");
}

function resetGame() {
  currentGuess = "";
  currentRow = 0;
  startTime = Date.now();

  modal.classList.add("hidden")

  for (let i = 0; i < maxAttempts; i++) {
    const row = gameGrid.children[i];
    for (let j = 0; j < wordLength; j++) {
      const box = row.children[j];
      box.textContent = "";
      box.className = "w-12 h-12 border text-xl font-bold flex items-center justify-center uppercase bg-slate-300/20 border-none rounded-md";
    }
  }

  Object.values(keyButtons).forEach(btn => {
    btn.classList.remove("bg-green-600", "bg-yellow-500", "bg-gray-600");
    btn.classList.add("bg-slate-600");
  });

  targetWord = validWords[Math.floor(Math.random() * validWords.length)];
  console.log("Nova palavra secreta:", targetWord);
}

// Suporte a teclado físico
document.addEventListener("keydown", (e) => {
  const key = e.key;
  if (key === "Backspace") handleKey("Back");
  else if (key === "Enter") handleKey("Enter");
  else if (/^[a-zA-Z]$/.test(key)) handleKey(key.toUpperCase());
});

resetBtn.addEventListener("click", () => resetGame())