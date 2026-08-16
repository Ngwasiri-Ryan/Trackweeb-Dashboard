import { Loader2 } from "lucide-react";
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

type DeleteShipmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingCode: string;
  pending?: boolean;
  onConfirm: () => void;
};

export function DeleteShipmentDialog({
  open,
  onOpenChange,
  trackingCode,
  pending,
  onConfirm,
}: DeleteShipmentDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <AlertDialogContent className="rounded-2xl sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl">Delete shipment?</AlertDialogTitle>
          <AlertDialogDescription>
            This archives <span className="tracking-code font-semibold">{trackingCode}</span>.
            It will be removed from active lists but can be restored from the backend if needed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            className="rounded-full"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete shipment"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
