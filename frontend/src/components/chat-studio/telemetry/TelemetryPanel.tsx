"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Share2,
  PanelRightClose,
  RotateCcw,
  SlidersHorizontal,
  MessageCircle,
  NotebookPen,
  Layers,
  GripVertical,
} from "lucide-react";
import { memo, useCallback, useMemo, useState, type ReactNode } from "react";

import { DEFAULT_STREAMING_ENABLED } from "@/components/chat-studio/chat-constants";
import { markdownComponents } from "@/components/chat-studio/chat-utils";
import { CollectionToolsCard } from "@/components/chat-studio/telemetry/CollectionToolsCard";
import { CollectionVitalsCard } from "@/components/chat-studio/telemetry/CollectionVitalsCard";
import { ModelParametersCard } from "@/components/chat-studio/telemetry/ModelParametersCard";
import { ModelSelectorCard } from "@/components/chat-studio/telemetry/ModelSelectorCard";
import { ProviderRoutingCard } from "@/components/chat-studio/telemetry/ProviderRoutingCard";
import { StreamingSettingsCard } from "@/components/chat-studio/telemetry/StreamingSettingsCard";
import { SystemPromptCard } from "@/components/chat-studio/telemetry/SystemPromptCard";
import { UsageCard } from "@/components/chat-studio/telemetry/UsageCard";
import { TelemetrySection } from "@/components/chat-studio/TelemetrySection";
import { Button } from "@/components/ui/button";

import type {
  TelemetryCollectionsProps,
  TelemetryModelProps,
  TelemetryParametersProps,
  TelemetryPromptsProps,
  TelemetryProviderProps,
  TelemetrySectionsProps,
  TelemetryStreamingProps,
  TelemetryUsageProps,
} from "@/components/chat-studio/types";
import type { RunSettingsSectionKey } from "@/lib/types";

interface TelemetrySectionConfig {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  sectionId?: string;
  overrideActive?: boolean;
  content: ReactNode;
}

interface SortableTelemetryItemProps {
  id: RunSettingsSectionKey;
  config: TelemetrySectionConfig;
}

const SortableTelemetryItem = ({ id, config }: SortableTelemetryItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
    }),
    [transform, transition],
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`transition-opacity ${isDragging ? "opacity-40" : ""}`}
    >
      <TelemetrySection
        title={config.title}
        description={config.description}
        icon={config.icon}
        isOpen={config.isOpen}
        onToggle={config.onToggle}
        sectionId={config.sectionId}
        overrideActive={config.overrideActive}
        headerAction={
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Reorder ${config.title}`}
            title="Drag to reorder"
            {...attributes}
            {...listeners}
            className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-slate-400 transition ${
              isDragging ? "bg-white/10 text-white" : "hover:bg-white/10 hover:text-white"
            } cursor-grab active:cursor-grabbing touch-none`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        }
        isDragging={isDragging}
      >
        {config.content}
      </TelemetrySection>
    </div>
  );
};

interface TelemetryPanelProps {
  onClose: () => void;
  sections: TelemetrySectionsProps;
  prompts: TelemetryPromptsProps;
  collections: TelemetryCollectionsProps;
  streaming: TelemetryStreamingProps;
  model: TelemetryModelProps;
  provider: TelemetryProviderProps;
  parameters: TelemetryParametersProps;
  usage: TelemetryUsageProps;
}

const TelemetryPanelComponent = ({
  onClose,
  sections,
  prompts,
  collections,
  streaming,
  model,
  provider,
  parameters,
  usage,
}: TelemetryPanelProps) => {
  const { sectionIds, sectionOrder, onSectionOrderChange } = sections;
  const {
    systemPromptCustom,
    promptSections,
    promptPreviewMarkdown,
    promptLoading,
    promptError,
    promptGeneratedAt,
    systemPromptOpen,
    onSystemPromptToggle,
    onPromptEdit,
  } = prompts;
  const {
    collections: collectionList,
    selectedToolCollectionIds,
    onToggleToolCollection,
    onClearToolCollections,
    collectionsLoading,
    collectionsError,
    pineconeConfigured,
    collectionToolsOpen,
    onCollectionToolsToggle,
    vitalsOpen,
    onVitalsToggle,
    collection,
    collectionCount,
    documentCount,
  } = collections;
  const { streamingOptionsOpen, onStreamingOptionsToggle, streamingEnabled, onStreamingToggle } =
    streaming;
  const {
    modelSelectorOpen,
    onModelSelectorToggle,
    modelSearchTerm,
    onModelSearchChange,
    modelSortOption,
    onModelSortChange,
    toolReadyModels,
    filteredModelCatalog,
    modelsLoading,
    modelsError,
    selectedModelKey,
    onSelectModel,
    currentModelInfo,
    toolsEnabled,
  } = model;
  const {
    providerPreferencesOpen,
    onProviderPreferencesToggle,
    providerForm,
    setProviderForm,
    providerDirectory,
    providerDirectoryLoading,
    providerDirectoryError,
    providerModelSlug,
    providerSearchTerm,
    onProviderSearchChange,
    providerRuleCount,
    resetProviderPreferences,
  } = provider;
  const {
    modelParametersOpen,
    onModelParametersToggle,
    visibleParameterDefinitions,
    parameterOverrides,
    activeParameterCount,
    resetAllParameters,
    handleNumberParameterChange,
    handleBooleanParameterChange,
    handleTextParameterChange,
    handleSelectParameterChange,
    handleClearParameter,
    formatDefaultParameter,
  } = parameters;
  const {
    usageOpen,
    onUsageToggle,
    usage: usageBreakdown,
    contextWindow,
    contextConsumed,
    onExportChatHistory,
  } = usage;
  const streamingOverrideActive = streamingEnabled !== DEFAULT_STREAMING_ENABLED;
  const promptDescription = promptLoading
    ? "Loading prompt..."
    : promptError
      ? "Prompt unavailable"
      : `${promptSections.length} section${promptSections.length === 1 ? "" : "s"} ready`;
  const toolsDescription =
    selectedToolCollectionIds.length === 0
      ? "No collections enabled"
      : `${selectedToolCollectionIds.length} collection${
          selectedToolCollectionIds.length === 1 ? "" : "s"
        } active`;
  const [activeId, setActiveId] = useState<RunSettingsSectionKey | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as RunSettingsSectionKey);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      if (!event.over || event.active.id === event.over.id) {
        return;
      }
      const activeKey = event.active.id as RunSettingsSectionKey;
      const overKey = event.over.id as RunSettingsSectionKey;
      const oldIndex = sectionOrder.indexOf(activeKey);
      const newIndex = sectionOrder.indexOf(overKey);
      if (oldIndex < 0 || newIndex < 0) {
        return;
      }
      onSectionOrderChange(arrayMove(sectionOrder, oldIndex, newIndex));
    },
    [onSectionOrderChange, sectionOrder],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const sectionConfig: Record<RunSettingsSectionKey, TelemetrySectionConfig> = {
    systemPrompt: {
      title: "System prompt",
      description: promptDescription,
      icon: <NotebookPen className="h-4 w-4 text-amber-300" />,
      isOpen: systemPromptOpen,
      onToggle: onSystemPromptToggle,
      sectionId: sectionIds.systemPrompt,
      overrideActive: systemPromptCustom,
      content: (
        <SystemPromptCard
          promptPreviewMarkdown={promptPreviewMarkdown}
          promptSections={promptSections}
          promptLoading={promptLoading}
          promptError={promptError}
          generatedAt={promptGeneratedAt}
          onEdit={onPromptEdit}
          markdownComponents={markdownComponents}
        />
      ),
    },
    collectionTools: {
      title: "Collection tools",
      description: toolsDescription,
      icon: <Layers className="h-4 w-4 text-cyan-300" />,
      isOpen: collectionToolsOpen,
      onToggle: onCollectionToolsToggle,
      sectionId: sectionIds.collectionTools,
      overrideActive: selectedToolCollectionIds.length > 0,
      content: (
        <CollectionToolsCard
          collections={collectionList}
          selectedCollectionIds={selectedToolCollectionIds}
          onToggle={onToggleToolCollection}
          onClear={onClearToolCollections}
          pineconeConfigured={pineconeConfigured}
          collectionsLoading={collectionsLoading}
          collectionsError={collectionsError}
        />
      ),
    },
    streaming: {
      title: "Streaming",
      description: streamingEnabled ? "Live tokens enabled" : "Responses buffered until completion",
      icon: <Share2 className="h-4 w-4 text-emerald-300" />,
      isOpen: streamingOptionsOpen,
      onToggle: onStreamingOptionsToggle,
      sectionId: sectionIds.streaming,
      overrideActive: streamingOverrideActive,
      content: (
        <StreamingSettingsCard streamingEnabled={streamingEnabled} onToggle={onStreamingToggle} />
      ),
    },
    modelRouting: {
      title: "Model routing",
      description: currentModelInfo?.name || selectedModelKey || "Select a chat model",
      icon: <RotateCcw className="h-4 w-4 text-violet-300" />,
      isOpen: modelSelectorOpen,
      onToggle: onModelSelectorToggle,
      sectionId: sectionIds.modelRouting,
      content: (
        <ModelSelectorCard
          currentModelInfo={currentModelInfo}
          selectedModelKey={selectedModelKey}
          toolReadyModels={toolReadyModels}
          filteredModelCatalog={filteredModelCatalog}
          modelSearchTerm={modelSearchTerm}
          onSearchChange={onModelSearchChange}
          sortOption={modelSortOption}
          onSortChange={onModelSortChange}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          toolsEnabled={toolsEnabled}
          onSelectModel={onSelectModel}
        />
      ),
    },
    providerRouting: {
      title: "Provider routing",
      description:
        providerRuleCount === 0
          ? "Load balance across top providers"
          : `${providerRuleCount} routing rule${providerRuleCount === 1 ? "" : "s"} configured`,
      icon: <Share2 className="h-4 w-4 text-emerald-300" />,
      isOpen: providerPreferencesOpen,
      onToggle: onProviderPreferencesToggle,
      sectionId: sectionIds.providerRouting,
      overrideActive: providerRuleCount > 0,
      content: (
        <ProviderRoutingCard
          providerForm={providerForm}
          setProviderForm={setProviderForm}
          providerDirectory={providerDirectory}
          providerDirectoryLoading={providerDirectoryLoading}
          providerDirectoryError={providerDirectoryError}
          providerModelSlug={providerModelSlug}
          providerSearchTerm={providerSearchTerm}
          onProviderSearchChange={onProviderSearchChange}
          providerRuleCount={providerRuleCount}
          resetProviderPreferences={resetProviderPreferences}
        />
      ),
    },
    vitals: {
      title: "Collection vitals",
      description: "Current ingestion settings",
      icon: <MessageCircle className="h-4 w-4 text-cyan-300" />,
      isOpen: vitalsOpen,
      onToggle: onVitalsToggle,
      sectionId: sectionIds.vitals,
      content: (
        <CollectionVitalsCard
          collection={collection}
          collectionCount={collectionCount}
          documentCount={documentCount}
        />
      ),
    },
    modelParameters: {
      title: "Model parameters",
      description: currentModelInfo
        ? `${activeParameterCount} override${activeParameterCount === 1 ? "" : "s"} active`
        : "Load model metadata",
      icon: <SlidersHorizontal className="h-4 w-4 text-violet-300" />,
      isOpen: modelParametersOpen,
      onToggle: onModelParametersToggle,
      sectionId: sectionIds.modelParameters,
      overrideActive: activeParameterCount > 0,
      content: (
        <ModelParametersCard
          currentModelInfo={currentModelInfo}
          visibleParameterDefinitions={visibleParameterDefinitions}
          parameterOverrides={parameterOverrides}
          activeParameterCount={activeParameterCount}
          resetAllParameters={resetAllParameters}
          handleNumberParameterChange={handleNumberParameterChange}
          handleBooleanParameterChange={handleBooleanParameterChange}
          handleTextParameterChange={handleTextParameterChange}
          handleSelectParameterChange={handleSelectParameterChange}
          handleClearParameter={handleClearParameter}
          formatDefaultParameter={formatDefaultParameter}
          modelsError={modelsError}
          modelsLoading={modelsLoading}
        />
      ),
    },
    usage: {
      title: "Usage",
      description: contextWindow
        ? `${contextConsumed.toLocaleString()} / ${contextWindow.toLocaleString()} tokens`
        : `${contextConsumed.toLocaleString()} tokens consumed`,
      isOpen: usageOpen,
      onToggle: onUsageToggle,
      sectionId: sectionIds.usage,
      content: (
        <UsageCard
          usage={usageBreakdown}
          contextWindow={contextWindow}
          contextConsumed={contextConsumed}
          onExport={onExportChatHistory}
        />
      ),
    },
  };
  const activeConfig = activeId ? sectionConfig[activeId] : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Context</p>
          <h2 className="text-xl font-semibold text-white">Run settings</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 p-0 text-slate-300"
          onClick={onClose}
          aria-label="Close run settings"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
      <DndContext
        sensors={sensors}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="relative mt-4 min-h-0 flex-1 overflow-y-auto">
          <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-4 pb-6">
              {sectionOrder.map((key) => (
                <SortableTelemetryItem key={key} id={key} config={sectionConfig[key]} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
            {activeConfig ? (
              <div className="origin-top-left scale-[1.02] shadow-[0_20px_45px_rgba(0,0,0,0.45)]">
                <TelemetrySection
                  title={activeConfig.title}
                  description={activeConfig.description}
                  icon={activeConfig.icon}
                  isOpen={activeConfig.isOpen}
                  onToggle={activeConfig.onToggle}
                  sectionId={activeConfig.sectionId}
                  overrideActive={activeConfig.overrideActive}
                  headerAction={
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-slate-200">
                      <GripVertical className="h-3.5 w-3.5" />
                    </div>
                  }
                  isDragging
                >
                  {activeConfig.content}
                </TelemetrySection>
              </div>
            ) : null}
          </DragOverlay>
        </div>
      </DndContext>
    </div>
  );
};

export const TelemetryPanel = memo(TelemetryPanelComponent);
