"use client";

import { useId, useState } from "react";

import { ProviderKindBadges } from "@/components/connections/ProviderKindBadges";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { createConnection, validateConnectionConfig } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import type { ProviderConnection, ProviderTypeInfo } from "@/lib/types";

interface AddConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  authToken: string;
  providerTypes: ProviderTypeInfo[];
  existingConnections: ProviderConnection[];
  onCreated: (connection: ProviderConnection) => void;
}

/**
 * The generic add-connection flow: pick a provider type, then fill a form
 * rendered from that type's `config_fields` catalog. A new provider type
 * needs zero new form code here — secret fields mask, URL/string fields are
 * plain inputs, and the pre-save probe runs against `/api/connections/validate`.
 */
export function AddConnectionDialog({
  open,
  onClose,
  authToken,
  providerTypes,
  existingConnections,
  onCreated,
}: AddConnectionDialogProps) {
  const titleId = useId();
  const [selectedType, setSelectedType] = useState<ProviderTypeInfo | null>(null);
  const [label, setLabel] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  const reset = () => {
    setSelectedType(null);
    setLabel("");
    setConfig({});
    setError(null);
    setProbeMessage(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const selectableTypes = providerTypes.filter((type) => {
    if (type.builtin) return false;
    if (type.max_connections_per_user == null) return true;
    const count = existingConnections.filter(
      (connection) => connection.provider_type === type.provider_type,
    ).length;
    return count < type.max_connections_per_user;
  });

  const handlePickType = (type: ProviderTypeInfo) => {
    setSelectedType(type);
    setLabel(type.label);
    setConfig({});
    setError(null);
    setProbeMessage(null);
  };

  const buildConfigPayload = () => {
    const payload: Record<string, string> = {};
    for (const field of selectedType?.config_fields ?? []) {
      const value = (config[field.name] ?? "").trim();
      if (value) {
        payload[field.name] = value;
      }
    }
    return payload;
  };

  const missingRequired = (selectedType?.config_fields ?? []).some(
    (field) => field.required && !(config[field.name] ?? "").trim(),
  );

  const handleProbe = async () => {
    if (!selectedType) return;
    setProbing(true);
    setError(null);
    setProbeMessage(null);
    try {
      const result = await validateConnectionConfig(
        authToken,
        selectedType.provider_type,
        buildConfigPayload(),
      );
      if (result.valid) {
        setProbeMessage(result.message ?? "Connected.");
      } else {
        setError(result.message ?? "Validation failed.");
      }
    } catch (probeError) {
      setError(getErrorMessage(probeError, "Unable to validate the connection."));
    } finally {
      setProbing(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedType) return;
    setSubmitting(true);
    setError(null);
    setProbeMessage(null);
    try {
      const created = await createConnection(authToken, {
        provider_type: selectedType.provider_type,
        label: label.trim() || selectedType.label,
        config: buildConfigPayload(),
      });
      onCreated(created);
      handleClose();
    } catch (createError) {
      setError(getErrorMessage(createError, "Unable to add the connection."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <ModalOverlay open={open} onClose={handleClose} labelledBy={titleId}>
      <div className="w-full max-w-lg rounded-3xl border border-hairline bg-canvas-raised p-6">
        <h2 id={titleId} className="text-lg font-semibold text-primary">
          {selectedType ? `Connect ${selectedType.label}` : "Add a provider"}
        </h2>
        {!selectedType ? (
          <div className="mt-4 space-y-2">
            {selectableTypes.map((type) => (
              <button
                key={type.provider_type}
                type="button"
                onClick={() => handlePickType(type)}
                className="w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-left transition hover:border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {type.label}
                      {type.recommended && (
                        <span className="ml-2 rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-violet">
                          Recommended
                        </span>
                      )}
                    </p>
                  </div>
                  <ProviderKindBadges kinds={type.kinds} />
                </div>
              </button>
            ))}
            {selectableTypes.length === 0 && (
              <p className="text-sm text-muted">Every available provider is already connected.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <ProviderKindBadges kinds={selectedType.kinds} />
              {selectedType.docs_url && (
                <a
                  href={selectedType.docs_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent-cyan underline-offset-2 hover:underline"
                >
                  {selectedType.provider_type === "ollama"
                    ? "Get Ollama"
                    : `Get a ${selectedType.label} API key`}
                </a>
              )}
            </div>
            <Field label="Label" hint="A name for this connection (e.g. Homelab Ollama).">
              <TextInput value={label} onChange={(event) => setLabel(event.target.value)} />
            </Field>
            {selectedType.config_fields.map((field) => (
              <Field
                key={field.name}
                label={field.label}
                hint={field.required ? undefined : "Optional."}
              >
                <TextInput
                  type={field.kind === "secret" ? "password" : "text"}
                  placeholder={field.placeholder ?? undefined}
                  value={config[field.name] ?? ""}
                  onChange={(event) =>
                    setConfig((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                />
              </Field>
            ))}
            {error && <p className="text-sm text-data-neg">{error}</p>}
            {probeMessage && <p className="text-sm text-data-pos">{probeMessage}</p>}
            <div
              className={cn(
                "flex items-center justify-between gap-2 border-t border-hairline pt-4",
              )}
            >
              <Button type="button" variant="ghost" onClick={() => setSelectedType(null)}>
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleProbe}
                  loading={probing}
                  disabled={missingRequired || submitting}
                >
                  Test
                </Button>
                <Button
                  type="button"
                  onClick={handleCreate}
                  loading={submitting}
                  disabled={missingRequired || probing}
                >
                  Add connection
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
