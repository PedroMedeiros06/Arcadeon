"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_ROOM_CONFIG, type CofreRoomConfig } from "@/lib/cofre/types";
import { CofreConfigFields, chipClass } from "./CofreConfigFields";

const inputClass =
  "w-full rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2.5 font-bold text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:border-[var(--game-accent)] focus:outline-none";

export function OnlineLobby({
  defaultName,
  isNameLocked,
  connected,
  joinError,
  notice,
  onCreate,
  onJoin,
  onBack,
}: {
  defaultName: string;
  isNameLocked: boolean;
  connected: boolean;
  joinError: string | null;
  notice: string | null;
  onCreate: (config: CofreRoomConfig, name: string) => void;
  onJoin: (name: string, code: string) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [typedName, setName] = useState(defaultName);
  // logado: nome vem da conta e nao e editavel
  const name = isNameLocked ? defaultName : typedName;
  const [code, setCode] = useState("");
  const [config, setConfig] = useState<CofreRoomConfig>(DEFAULT_ROOM_CONFIG);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-sm font-bold text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div>
        <h2 className="text-2xl font-black text-[var(--fg)]">Salas online</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Cada um na sua vez. Quem levar mais espólio vence.</p>
      </div>
      {notice && <p className="text-sm font-bold text-[var(--danger)]">{notice}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setMode("create")} className={chipClass(mode === "create")}>
          Criar sala
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setMode("join")} className={chipClass(mode === "join")}>
          Entrar com código
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-[var(--fg)]">Seu nome</span>
        <input
          value={name}
          maxLength={10}
          readOnly={isNameLocked}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          className={`${inputClass} ${isNameLocked ? "opacity-70" : ""}`}
        />
      </label>

      {mode === "create" ? (
        <>
          <CofreConfigFields config={config} onChange={setConfig} />
          <button
            type="button"
            disabled={!name.trim() || !connected}
            onClick={() => onCreate(config, name.trim())}
            className="rounded-2xl bg-[var(--game-accent)] py-3 text-lg font-black text-white shadow-md transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            Criar sala
          </button>
        </>
      ) : (
        <>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && code.length === 5 && connected) onJoin(name.trim(), code);
            }}
            placeholder="Código da sala"
            maxLength={5}
            className={`${inputClass} text-center font-mono text-lg tracking-widest`}
          />
          {joinError && <p className="text-center text-sm font-bold text-[var(--danger)]">{joinError}</p>}
          <button
            type="button"
            disabled={!name.trim() || code.length !== 5 || !connected}
            onClick={() => onJoin(name.trim(), code)}
            className="rounded-2xl bg-[var(--game-accent)] py-3 text-lg font-black text-white shadow-md transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            Entrar
          </button>
        </>
      )}
      {!connected && <p className="text-center text-xs font-semibold text-[var(--fg-muted)]">Conectando ao servidor...</p>}
    </div>
  );
}
