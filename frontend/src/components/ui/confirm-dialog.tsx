"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { GlassCard } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  confirmText?: string;
  rememberLabel?: string;
  rememberChecked?: boolean;
  onRememberChange?: (checked: boolean) => void;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  confirmText,
  rememberLabel,
  rememberChecked = false,
  onRememberChange,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const [typedText, setTypedText] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    setTypedText("");
  }

  const confirmBlocked = Boolean(confirmText) && typedText !== confirmText;

  return (
    <ModalOverlay open={open} onClose={onCancel} labelledBy={titleId}>
      <GlassCard className="w-full max-w-lg rounded-[2rem] border border-hairline bg-canvas-raised/95 p-6 text-primary">
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
            Confirm action
          </p>
          <h2 id={titleId} className="text-xl font-semibold text-primary">
            {title}
          </h2>
          {description ? <p className="text-sm leading-relaxed text-body">{description}</p> : null}
          {confirmText ? (
            <Field
              label={
                <>
                  Type <span className="font-semibold text-primary">{confirmText}</span> to confirm
                </>
              }
            >
              <TextInput
                autoComplete="off"
                value={typedText}
                onChange={(event) => setTypedText(event.target.value)}
              />
            </Field>
          ) : null}
          {rememberLabel && onRememberChange ? (
            <label className="flex items-center gap-3 text-sm text-body">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-strong bg-transparent accent-[var(--accent-violet)]"
                checked={rememberChecked}
                onChange={(event) => onRememberChange(event.target.checked)}
              />
              <span>{rememberLabel}</span>
            </label>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            disabled={confirmBlocked}
            className={cn(
              confirmVariant === "danger" &&
                "bg-data-neg text-white shadow-lg shadow-data-neg/30 hover:brightness-110",
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </GlassCard>
    </ModalOverlay>
  );
}
