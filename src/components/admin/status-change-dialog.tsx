import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatStatus } from "@/lib/format";

type StatusChangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingCode: string;
  currentStatus: string;
  newStatus: string;
  receiverEmail: string | null;
  receiverName: string;
  pending?: boolean;
  onConfirm: (description?: string) => void;
};

export function StatusChangeDialog({
  open,
  onOpenChange,
  trackingCode,
  currentStatus,
  newStatus,
  receiverEmail,
  receiverName,
  pending,
  onConfirm,
}: StatusChangeDialogProps) {
  const [note, setNote] = useState("");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) {
          onOpenChange(v);
          if (!v) setNote("");
        }
      }}
    >
      <AlertDialogContent className="rounded-2xl sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl">
            Update shipment status
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <p>
                Change <span className="tracking-code font-semibold">{trackingCode}</span>{" "}
                from <strong>{formatStatus(currentStatus)}</strong> to{" "}
                <strong className="text-accent">{formatStatus(newStatus)}</strong>.
              </p>
              {receiverEmail ? (
                <div className="flex items-start gap-2 rounded-xl border border-success/25 bg-success/10 px-3 py-2.5 text-success">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm">
                    <span className="font-semibold">{receiverName}</span> will be notified at{" "}
                    <span className="font-medium">{receiverEmail}</span> via email.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-destructive">
                  No client email on this shipment — the customer will not be notified.
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="status-note">Note for timeline (optional)</Label>
          <Textarea
            id="status-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Departed origin warehouse"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            className="btn-accent rounded-full"
            disabled={pending}
            onClick={() => onConfirm(note.trim() || undefined)}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating…
              </>
            ) : (
              "Confirm & notify"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
