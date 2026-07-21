"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type TokenizerConsentDialogProps = {
  modelId: string | null;
  remember: boolean;
  loading: boolean;
  onRememberChange: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function TokenizerConsentDialog({
  modelId,
  remember,
  loading,
  onRememberChange,
  onConfirm,
  onCancel,
}: TokenizerConsentDialogProps) {
  return (
    <ConfirmDialog
      open={modelId !== null}
      title="Download tokenizer?"
      description={
        modelId ? `Download tokenizer (~0.5 MB) from huggingface.co for “${modelId}”?` : undefined
      }
      confirmLabel="Download tokenizer"
      rememberLabel="Remember this choice"
      rememberChecked={remember}
      loading={loading}
      onRememberChange={onRememberChange}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
