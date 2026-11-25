import { useState } from "react";
import { Pencil, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { dateKey, routineEditPatch, excludeOccurrence, type Routine } from "@/lib/monthly";

type Props = {
  routine: Routine;
  date: Date;
  onUpdate: (id: string, patch: Partial<Routine>) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
};

export function RoutineActions({ routine, date, onUpdate, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(routine.title);
  const [mode, setMode] = useState<"monthly" | "once">(routine.specific_date ? "once" : "monthly");
  const [day, setDay] = useState(String(routine.day_of_month ?? date.getDate()));
  const [specificDate, setSpecificDate] = useState(routine.specific_date ?? dateKey(date));

  const isRecurring = !routine.specific_date && routine.day_of_month != null;
  const dateFormatted = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

  const edit = () => {
    setTitle(routine.title);
    setMode(routine.specific_date ? "once" : "monthly");
    setDay(String(routine.day_of_month ?? date.getDate()));
    setSpecificDate(routine.specific_date ?? dateKey(date));
    setEditing(true);
  };
  const save = async () => {
    const patch = routineEditPatch(title, mode, Number(day), specificDate);
    if (!patch || busy) return;
    setBusy(true);
    try {
      if (await onUpdate(routine.id, patch)) {
        toast.success("Rotina atualizada");
        setEditing(false);
      }
    } finally { setBusy(false); }
  };
  const removeAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await onRemove(routine.id)) {
        setDeleting(false);
      }
    } finally { setBusy(false); }
  };
  const removeOccurrence = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updatedCompleted = excludeOccurrence(routine.completed, date);
      if (await onUpdate(routine.id, { completed: updatedCompleted })) {
        toast.success("Ocorrência excluída com sucesso");
        setDeleting(false);
      }
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-0.5 no-print">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={edit} title="Editar rotina mensal" aria-label="Editar rotina mensal"><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(true)} title="Excluir rotina mensal" aria-label="Excluir rotina mensal"><Trash2 className="h-4 w-4" /></Button>
      </div>
      <Dialog open={editing} onOpenChange={(open) => { if (!busy) setEditing(open); }}>
        <DialogContent className="no-print max-w-[calc(100%-2rem)] sm:max-w-lg rounded-lg">
          <DialogHeader>
            <DialogTitle>Editar rotina mensal</DialogTitle>
            <DialogDescription>{routine.user_name} · {mode === "monthly" ? "A alteração vale para todos os meses, no calendário e na semana." : "A alteração vale para esta rotina no calendário e na semana."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
            <label className="block space-y-1 text-sm font-medium">Nome da rotina
              <input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
            </label>
            <fieldset disabled={busy} className="space-y-2 text-sm">
              <legend className="mb-2 font-medium">Repetição</legend>
              <label className="flex items-center gap-2"><input type="radio" checked={mode === "monthly"} onChange={() => setMode("monthly")} /> Todo mês</label>
              <label className="flex items-center gap-2"><input type="radio" checked={mode === "once"} onChange={() => setMode("once")} /> Somente nesta data</label>
            </fieldset>
            {mode === "monthly" ? (
              <label className="block space-y-1 text-sm font-medium">Dia do mês
                <input type="number" min={1} max={31} step={1} required value={day} onChange={(e) => setDay(e.target.value)} disabled={busy} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
              </label>
            ) : (
              <label className="block space-y-1 text-sm font-medium">Data da rotina
                <input type="date" required value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} disabled={busy} className="w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-foreground" />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(false)}>Cancelar</Button>
              <Button type="submit" disabled={busy || !routineEditPatch(title, mode, Number(day), specificDate)}>{busy ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleting} onOpenChange={(open) => { if (!busy) setDeleting(open); }}>
        <AlertDialogContent className="no-print max-w-[calc(100%-2rem)] sm:max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rotina mensal?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {isRecurring ? (
                <>
                  A rotina <strong>“{routine.title}”</strong> se repete todo mês. Deseja apagar somente desta data ou excluir as repetições também?
                </>
              ) : (
                <>
                  Deseja excluir a rotina <strong>“{routine.title}”</strong> de {routine.user_name}? Ela será removida do calendário e da semana.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isRecurring ? (
            <div className="flex flex-col gap-2.5 py-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeOccurrence()}
                className="flex flex-col items-start p-3 rounded-lg border border-border hover:bg-muted/70 transition-colors text-left cursor-pointer disabled:opacity-50"
              >
                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Apagar somente esta ocorrência ({dateFormatted})
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  Exclui apenas do dia {dateFormatted}. A tarefa continuará repetindo nos outros meses.
                </span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void removeAll()}
                className="flex flex-col items-start p-3 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors text-left cursor-pointer disabled:opacity-50"
              >
                <span className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Excluir todas as repetições
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  Apaga a rotina por completo de todos os meses, no calendário e na semana.
                </span>
              </button>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            {!isRecurring && (
              <Button variant="destructive" disabled={busy} onClick={() => void removeAll()}>
                {busy ? "Excluindo…" : "Excluir"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}