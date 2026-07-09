"use client";

import { X } from "lucide-react";
import { type RefObject, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { cn } from "@/lib/utils";

import type { PromptDetails } from "@/lib/types";
import type { Components } from "react-markdown";

type PromptEditorSection = {
  id: string;
  label: string;
  scope: "base" | "collection";
  details: PromptDetails | null;
  draft: string;
  hasChanges: boolean;
  saving: boolean;
  error: string | null;
};

interface PromptEditorOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  sections: PromptEditorSection[];
  activeSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  onDraftChange: (sectionId: string, value: string) => void;
  onSave: (sectionId: string) => void;
  onReset: (sectionId: string) => void;
  onInsertVariable: (sectionId: string, varName: string) => void;
  promptPreviewMarkdown: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  markdownComponents: Components;
}

export const PromptEditorOverlay = ({
  isOpen,
  onClose,
  sections,
  activeSectionId,
  onSelectSection,
  onDraftChange,
  onSave,
  onReset,
  onInsertVariable,
  promptPreviewMarkdown,
  inputRef,
  markdownComponents,
}: PromptEditorOverlayProps) => {
  const titleId = useId();

  if (!isOpen || sections.length === 0) {
    return null;
  }

  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const variables = activeSection.details?.variables ?? [];
  const contextEntries = Object.entries(activeSection.details?.context ?? {});
  const previewSource = promptPreviewMarkdown?.trim() ? promptPreviewMarkdown : "_No content yet._";
  const headerLabel = activeSection.scope === "base" ? "Base prompt" : "Tool prompt";

  return (
    <ModalOverlay open onClose={onClose} labelledBy={titleId} backdropClassName="bg-canvas/80">
      <div className="flex h-[85vh] w-full max-w-6xl flex-col rounded-3xl border border-hairline bg-canvas-raised p-6 text-primary shadow-elevation-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-meta">System prompt</p>
            <h2 id={titleId} className="text-2xl font-semibold text-primary">
              Edit prompt sections
            </h2>
            <p className="text-sm text-muted">
              Tune the base instructions and tool snippets. The preview shows the full prompt that
              the model will see.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline p-0 text-muted"
            onClick={onClose}
            aria-label="Close prompt editor"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {sections.map((section) => {
            const isActive = section.id === activeSection.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelectSection(section.id)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.3em] transition",
                  isActive
                    ? "border-accent-violet bg-accent-violet/20 text-primary"
                    : "border-hairline bg-surface text-muted hover:border-strong hover:text-primary",
                )}
              >
                <span className="flex items-center gap-2">
                  {section.label}
                  {section.hasChanges && <span className="h-1.5 w-1.5 rounded-full bg-data-warn" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="flex w-full flex-1 flex-col rounded-2xl border border-hairline bg-surface p-4 lg:w-1/2">
              <div className="flex items-center justify-between">
                <label
                  className="text-sm font-semibold text-primary"
                  htmlFor="system-prompt-editor"
                >
                  {headerLabel} template
                </label>
                <button
                  type="button"
                  className="text-xs text-accent-violet transition hover:brightness-110"
                  onClick={() => onReset(activeSection.id)}
                >
                  Revert to default
                </button>
              </div>
              <textarea
                id="system-prompt-editor"
                ref={inputRef}
                className="mt-3 min-h-[300px] flex-1 resize-none rounded-2xl border border-hairline bg-surface px-4 py-3 font-mono text-sm text-primary outline-none focus:border-accent-violet"
                value={activeSection.draft}
                onChange={(event) => onDraftChange(activeSection.id, event.target.value)}
                placeholder="Write instructions with Markdown. Use {{variable}} placeholders."
              />
              <p className="mt-3 text-xs text-meta">
                Leave blank to fall back to the default prompt shipped with Ragworks.
              </p>
            </div>
            <div className="flex w-full flex-1 flex-col rounded-2xl border border-hairline bg-surface p-4 lg:w-1/2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary">Rendered preview</p>
                <span className="text-xs text-meta">
                  {activeSection.details?.is_custom ? "Custom template" : "Default template"}
                </span>
              </div>
              <div className="mt-3 flex-1 overflow-hidden rounded-2xl border border-hairline bg-surface p-4">
                <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {previewSource}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-hairline bg-surface p-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
                Variables
              </p>
              <p className="mt-1 text-xs text-meta">
                Click a variable to insert it at the cursor. Each one renders with current metadata.
              </p>
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                {variables.map((variable) => (
                  <button
                    key={variable.name}
                    type="button"
                    className="w-full rounded-2xl border border-hairline bg-surface px-3 py-2 text-left transition hover:border-accent-violet/60 hover:bg-surface-strong"
                    onClick={() => onInsertVariable(activeSection.id, variable.name)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code className="rounded bg-surface-strong px-2 py-0.5 text-[12px] text-accent-violet">
                        {`{{${variable.name}}}`}
                      </code>
                      {variable.example && (
                        <span className="text-[11px] text-meta">
                          Example: <span className="text-body">{variable.example}</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-body">{variable.description}</p>
                  </button>
                ))}
                {variables.length === 0 && (
                  <p className="text-sm text-meta">No template variables available.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-hairline bg-surface p-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
                Example context
              </p>
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1 text-xs">
                {contextEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-3 border-b border-hairline py-1 last:border-b-0"
                  >
                    <span className="truncate text-meta">{key}</span>
                    <span className="max-w-[60%] truncate text-right text-body">{value}</span>
                  </div>
                ))}
                {contextEntries.length === 0 && (
                  <p className="text-meta">Context not available yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-hairline pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          {activeSection.error && <p className="text-sm text-data-neg">{activeSection.error}</p>}
          <div className="flex flex-1 justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => onSave(activeSection.id)}
              loading={activeSection.saving}
              disabled={!activeSection.hasChanges || activeSection.saving}
              className="px-5"
            >
              Save prompt
            </Button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};
