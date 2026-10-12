"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LeaveConfirmModal } from "@/components/LeaveConfirmModal";

type LeaveTarget = "room" | "hub";

interface LeaveGuardOptions {
  /** true enquanto o jogador esta numa sala/partida que seria perdida ao sair */
  active: boolean;
  /** sai da sala (emit leave-room + limpa estado); chamado so depois do "Sair" */
  onLeave: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  /** avisa tambem ao fechar a aba / recarregar (o texto do navegador nao e customizavel) */
  warnOnUnload?: boolean;
}

/**
 * Confirmacao antes de sair do jogo, para todos os caminhos:
 * - botoes do jogo / header: chame requestLeave("room") ou requestLeave("hub");
 * - botao voltar do Android/navegador: intercepta com uma entrada sentinela no historico;
 * - fechar aba / F5: beforeunload (so quando warnOnUnload).
 * Renderize `leaveDialog` uma vez no JSX do jogo.
 */
export function useLeaveGuard({
  active,
  onLeave,
  title = "Sair da sala?",
  message = "Você vai sair da partida em andamento.",
  confirmLabel = "Sair",
  warnOnUnload = true,
}: LeaveGuardOptions) {
  const router = useRouter();
  const [pending, setPending] = useState<LeaveTarget | null>(null);
  const onLeaveRef = useRef(onLeave);
  const sentinelRef = useRef(false);
  const ignorePopRef = useRef(false);

  // perdeu a sala por fora (session-lost, expulsao): fecha o dialogo pendente pra nao reaparecer na proxima sala
  if (!active && pending) setPending(null);

  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  // botao voltar: uma entrada sentinela no topo do historico absorve o "voltar"
  useEffect(() => {
    if (!active) return;
    ignorePopRef.current = false;
    window.history.pushState({ leaveGuard: true }, "", window.location.href);
    sentinelRef.current = true;

    function onPop() {
      if (ignorePopRef.current) {
        ignorePopRef.current = false;
        return;
      }
      // o voltar consumiu a sentinela: recoloca e pergunta
      window.history.pushState({ leaveGuard: true }, "", window.location.href);
      sentinelRef.current = true;
      setPending("room");
    }
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      sentinelRef.current = false;
    };
  }, [active]);

  // fechar aba / recarregar
  useEffect(() => {
    if (!active || !warnOnUnload) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active, warnOnUnload]);

  const requestLeave = useCallback(
    (target: LeaveTarget = "room") => {
      if (!active) {
        onLeaveRef.current();
        if (target === "hub") router.push("/");
        return;
      }
      setPending(target);
    },
    [active, router],
  );

  const stay = useCallback(() => setPending(null), []);

  const confirm = useCallback(() => {
    const target = pending;
    setPending(null);
    // devolve a sentinela pra nao sobrar uma entrada duplicada no historico (pro hub nao precisa: sai da pagina)
    if (sentinelRef.current && target !== "hub") {
      sentinelRef.current = false;
      ignorePopRef.current = true;
      window.history.back();
    }
    onLeaveRef.current();
    if (target === "hub") router.push("/");
  }, [pending, router]);

  const leaveDialog = pending ? (
    <LeaveConfirmModal title={title} message={message} confirmLabel={confirmLabel} onStay={stay} onConfirm={confirm} />
  ) : null;

  return { requestLeave, leaveDialog };
}
