"use client";

import { useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDisconnectGoogle,
  useGoogleConnection,
  useStartGoogleConnect,
} from "@/modules/admin/application/use-orientation";
import {
  googleCardState,
  googleErrorMessage,
} from "@/modules/admin/application/orientation-google-presentation";

const WORKSPACE_NOTE =
  "Gmail pessoal corta a chamada em grupo com 60 minutos. Use turmas de até 55 minutos ou uma conta Google Workspace.";

/** Conta Google de quem dá as aulas: o Meet de cada turma nasce na agenda dela. */
export function GoogleAccountCard() {
  const query = useGoogleConnection();
  const start = useStartGoogleConnect();
  const disconnect = useDisconnectGoogle();
  const [confirming, setConfirming] = useState(false);

  const view = query.data ?? null;
  const state = googleCardState(view);
  if (state === "hidden") return null;

  const email = view?.connection?.googleEmail ?? "";

  const handleConnect = async () => {
    try {
      const { url } = await start.mutateAsync(undefined);
      if (typeof url !== "string" || !url.startsWith("https://accounts.google.com/")) {
        toast.error(googleErrorMessage(undefined));
        return;
      }
      window.location.assign(url);
    } catch {
      toast.error(googleErrorMessage(undefined));
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync(undefined);
      toast.success("Conta Google desconectada.");
      setConfirming(false);
    } catch {
      toast.error("Não deu para desconectar agora. Tente de novo.");
    }
  };

  const connectLabel = state === "needs-reconnect" ? "Conectar de novo" : "Conectar Google Agenda";

  return (
    <div className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eca826]/10">
          <CalendarDays className="h-5 w-5 text-[#eca826]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#1d1d1b]">Minha conta Google</h3>

          {state === "not-configured" && (
            <p className="mt-1 text-xs text-[#737373]">A conexão com o Google ainda não foi configurada no servidor.</p>
          )}
          {state === "disconnected" && (
            <p className="mt-1 text-xs text-[#737373]">
              Conecte a sua conta Google para as suas turmas ganharem o link do Meet sozinhas, na sua agenda.
            </p>
          )}
          {state === "connected" && (
            <>
              <p className="mt-1 text-sm text-[#1d1d1b]">{email ? `Conectado como ${email}.` : "Conectado."}</p>
              <p className="mt-1 text-xs text-[#737373]">{WORKSPACE_NOTE}</p>
            </>
          )}
          {state === "needs-reconnect" && (
            <p className="mt-1 text-sm text-red-600">
              {view?.connection?.lastError || "A conexão com o Google precisa ser refeita."}
            </p>
          )}

          {(state === "disconnected" || state === "needs-reconnect") && (
            <div className="mt-4">
              <Button className="w-full sm:w-auto" onClick={handleConnect} disabled={start.isPending}>
                {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {connectLabel}
              </Button>
            </div>
          )}
          {state === "connected" && (
            <div className="mt-4">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setConfirming(true)}>
                Desconectar
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !disconnect.isPending && setConfirming(open)}>
        <DialogContent className="max-h-[55vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Desconectar a conta Google?</DialogTitle>
            <DialogDescription>
              {email
                ? `Desconectar a conta ${email}? As turmas já criadas continuam com o link.`
                : "Desconectar a conta Google? As turmas já criadas continuam com o link."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={disconnect.isPending}>
              Manter
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={disconnect.isPending}>
              {disconnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
