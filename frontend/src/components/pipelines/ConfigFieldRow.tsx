"use client";

import { useMemo, useRef, useState } from "react";

import { ParameterFieldCard, ParameterInput } from "@/components/ui/parameter-controls";
import { expressionSource } from "@/lib/expressions";

import { ExpressionInput } from "./ExpressionInput";
import { buildSuggestions } from "./lib/expression-suggest";
import { formatConfigValue, getInputValue } from "./lib/pipeline-config";
import { SuggestionListbox } from "./SuggestionListbox";

import type { Suggestion } from "./lib/expression-suggest";
import type { PipelineConfigField } from "./lib/pipeline-config";
import type { StaticEnvironment } from "./lib/variable-env";
import type { PipelineValidationIssue } from "@/lib/types";

type ConfigFieldRowProps = {
  field: PipelineConfigField;
  nodeId: string;
  config: Record<string, unknown>;
  env: StaticEnvironment;
  disabled: boolean;
  issue?: PipelineValidationIssue;
  /** Set (or clear with `undefined`) one config key. */
  onValueChange: (key: string, value: unknown | undefined) => void;
  onLiteralChange: (field: PipelineConfigField, raw: string | boolean) => void;
};

const IDENTIFIER_START = /^[a-z_]$/i;

/**
 * One schema-driven config field, switchable between its typed literal
 * control and expression mode (`{"$expr": ...}` on the wire). The ƒx toggle
 * appears on every scalar field; identity fields keep it but enforce the
 * static-only rule live. Literal number fields are variable-aware too:
 * focusing one offers the matching variables, and picking one — or typing a
 * letter — converts the field to expression mode without losing focus.
 */
export function ConfigFieldRow({
  field,
  nodeId,
  config,
  env,
  disabled,
  issue,
  onValueChange,
  onLiteralChange,
}: ConfigFieldRowProps) {
  const rawValue = config[field.key];
  const source = expressionSource(rawValue);
  const isExpression = source !== null;
  const inputId = `node-${nodeId}-${field.key}`;
  const issueId = issue ? `${inputId}-validation` : undefined;
  const helper = isExpression
    ? field.staticOnly
      ? "Constants only — this field identifies infrastructure."
      : undefined
    : field.defaultValue !== undefined
      ? `Default: ${formatConfigValue(field.defaultValue)}`
      : field.required
        ? "Required"
        : undefined;

  const canToggle = field.exprType !== null && !disabled;
  const numericLiteral =
    !isExpression && (field.input === "number" || field.input === "integer") && canToggle;

  const anchorRef = useRef<HTMLDivElement>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [convertedFocus, setConvertedFocus] = useState(false);
  const suggestions = useMemo(
    () =>
      numericLiteral
        ? buildSuggestions(env, {
            expectedType: field.exprType,
            staticOnly: field.staticOnly,
          }).filter((suggestion) => suggestion.kind === "variable" && suggestion.name !== "query")
        : [],
    [numericLiteral, env, field.exprType, field.staticOnly],
  );

  const convertToExpression = (seed: string) => {
    setSuggestOpen(false);
    setConvertedFocus(true);
    onValueChange(field.key, { $expr: seed });
  };

  const handleLiteralKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!numericLiteral) return;
    if (IDENTIFIER_START.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      // A letter in a number field can only mean a variable reference.
      event.preventDefault();
      convertToExpression(event.key);
      return;
    }
    if (!suggestOpen || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      setActiveIndex((index) => Math.max(index - 1, 0));
      event.preventDefault();
    } else if (event.key === "Enter") {
      convertToExpression(suggestions[activeIndex]?.insertText ?? suggestions[0].insertText);
      event.preventDefault();
    } else if (event.key === "Escape") {
      setSuggestOpen(false);
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleAcceptSuggestion = (suggestion: Suggestion) => {
    convertToExpression(suggestion.insertText);
  };

  return (
    <ParameterFieldCard
      label={field.label}
      description={field.description}
      helper={helper}
      error={issue?.message}
      errorId={issueId}
      controlId={inputId}
      actionLabel={canToggle ? (isExpression ? "literal" : "ƒx") : undefined}
      onAction={
        canToggle
          ? () => {
              setConvertedFocus(false);
              onValueChange(field.key, isExpression ? undefined : { $expr: "" });
            }
          : undefined
      }
    >
      {isExpression ? (
        <ExpressionInput
          id={inputId}
          aria-label={`${field.label} expression`}
          value={source}
          onChange={(next) => onValueChange(field.key, { $expr: next })}
          env={env}
          expectedType={field.exprType}
          staticOnly={field.staticOnly}
          autoFocus={convertedFocus}
        />
      ) : (
        <div
          ref={anchorRef}
          onFocusCapture={() => {
            if (numericLiteral) {
              setActiveIndex(0);
              setSuggestOpen(true);
            }
          }}
          onBlurCapture={() => setSuggestOpen(false)}
          onKeyDownCapture={handleLiteralKeyDown}
        >
          <ParameterInput
            id={inputId}
            ariaInvalid={issue?.severity === "error"}
            ariaDescribedBy={issueId}
            input={field.input}
            value={getInputValue(field, config)}
            min={field.min}
            max={field.max}
            step={field.step}
            placeholder={field.placeholder}
            options={field.options}
            disabled={disabled}
            onChange={(nextValue) => onLiteralChange(field, nextValue)}
          />
          {suggestOpen && suggestions.length > 0 ? (
            <SuggestionListbox
              listId={`${inputId}-suggestions`}
              anchorRef={anchorRef}
              suggestions={suggestions}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onAccept={handleAcceptSuggestion}
            />
          ) : null}
        </div>
      )}
    </ParameterFieldCard>
  );
}
