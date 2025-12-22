"use client";

import { addEdge, useEdgesState, useNodesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";

import { Loader } from "@/components/ui/loader";
import { GlassCard } from "@/components/ui/panel";
import {
  activatePipelineVersion,
  createPipeline,
  fetchPipelineNodes,
  fetchPipelines,
  listPipelineVersions,
  updatePipeline,
  validatePipeline,
} from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

import {
  buildDefaultDefinition,
  buildNodeCatalog,
  createDefaultNodePosition,
  createId,
  toFlowEdges,
  toFlowNodes,
  toPipelineDefinition,
} from "./pipeline-utils";
import { PipelineCanvas } from "./PipelineCanvas";
import { PipelineHeader } from "./PipelineHeader";
import { PipelineInspector } from "./PipelineInspector";
import { PipelineNotice } from "./PipelineNotice";
import { PipelineRevisions } from "./PipelineRevisions";
import { PipelineSavePanel } from "./PipelineSavePanel";
import { PipelineSidebar } from "./PipelineSidebar";

import type { PipelineNodeData } from "./PipelineNode";
import type { NodeSpec, Pipeline, PipelineKind, PipelineVersion } from "@/lib/types";
import type { Connection, Edge, Node } from "@xyflow/react";

export function PipelineBuilder() {
  const { token } = useAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [nodeSpecs, setNodeSpecs] = useState<NodeSpec[]>([]);
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  useEffect(() => {
    const authToken = token ?? "";
    if (!authToken) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [pipelinesResponse, nodesResponse] = await Promise.all([
          fetchPipelines(authToken),
          fetchPipelineNodes(authToken),
        ]);
        if (cancelled) return;
        setPipelines(pipelinesResponse);
        setNodeSpecs(nodesResponse);
        setSelectedPipeline(pipelinesResponse[0] ?? null);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load pipelines.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedPipeline || nodeSpecs.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    setNodes(toFlowNodes(selectedPipeline.definition, nodeSpecs));
    setEdges(toFlowEdges(selectedPipeline.definition));
    setSelectedNodeId(null);
  }, [selectedPipeline, nodeSpecs, setNodes, setEdges]);

  useEffect(() => {
    const authToken = token ?? "";
    if (!authToken || !selectedPipeline) {
      setVersions([]);
      return;
    }
    let cancelled = false;

    async function loadVersions() {
      try {
        const data = await listPipelineVersions(selectedPipeline.id, authToken);
        if (!cancelled) setVersions(data);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load versions.");
        }
      }
    }

    loadVersions();
    return () => {
      cancelled = true;
    };
  }, [selectedPipeline, token]);

  useEffect(() => {
    if (!selectedNode) {
      setConfigDraft("");
      return;
    }
    setConfigDraft(JSON.stringify(selectedNode.data.config ?? {}, null, 2));
  }, [selectedNode]);

  const handleConnect = (connection: Connection) => {
    setEdges((prev) =>
      addEdge(
        {
          ...connection,
          id: createId(),
          type: "smoothstep",
        },
        prev,
      ),
    );
  };

  const handleAddNode = (spec: NodeSpec) => {
    const nodeId = createId();
    const newNode: Node<PipelineNodeData> = {
      id: nodeId,
      type: "pipelineNode",
      position: createDefaultNodePosition(nodes.length),
      data: {
        label: spec.label,
        nodeType: spec.type,
        description: spec.description,
        inputs: spec.input_ports,
        outputs: spec.output_ports,
        config: spec.default_config ?? {},
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(nodeId);
  };

  const handleApplyConfig = () => {
    if (!selectedNode) return;
    try {
      const parsed = JSON.parse(configDraft || "{}");
      setNodes((prev) =>
        prev.map((node) =>
          node.id === selectedNode.id ? { ...node, data: { ...node.data, config: parsed } } : node,
        ),
      );
      setMessage("Node configuration updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid JSON configuration.");
    }
  };

  const handleSavePipeline = async () => {
    const authToken = token ?? "";
    if (!authToken || !selectedPipeline) return;
    setValidating(true);
    setMessage(null);
    try {
      const definition = toPipelineDefinition(nodes, edges);
      const validation = await validatePipeline(authToken, definition);
      if (!validation.valid) {
        setMessage(`Validation failed: ${validation.errors.join(" ")}`);
        return;
      }
      setSaving(true);
      const updated = await updatePipeline(selectedPipeline.id, authToken, {
        definition,
        change_summary: changeSummary || "Updated pipeline definition.",
      });
      setPipelines((prev) =>
        prev.map((pipeline) => (pipeline.id === updated.id ? updated : pipeline)),
      );
      setSelectedPipeline(updated);
      setChangeSummary("");
      setMessage("Pipeline saved as a new version.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save pipeline.");
    } finally {
      setSaving(false);
      setValidating(false);
    }
  };

  const handleCreatePipeline = async (kind: PipelineKind) => {
    const authToken = token ?? "";
    if (!authToken) return;
    setSaving(true);
    setMessage(null);
    try {
      const definition = buildDefaultDefinition(kind);
      const created = await createPipeline(authToken, {
        name: `New ${kind === "ingestion" ? "Ingestion" : "Retrieval"} Pipeline`,
        kind,
        definition,
        change_summary: "Initial pipeline scaffold.",
      });
      setPipelines((prev) => [created, ...prev]);
      setSelectedPipeline(created);
      setChangeSummary("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create pipeline.");
    } finally {
      setSaving(false);
    }
  };

  const handleActivateVersion = async (version: PipelineVersion) => {
    const authToken = token ?? "";
    if (!authToken || !selectedPipeline) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await activatePipelineVersion(
        selectedPipeline.id,
        version.version,
        authToken,
      );
      setPipelines((prev) =>
        prev.map((pipeline) => (pipeline.id === updated.id ? updated : pipeline)),
      );
      setSelectedPipeline(updated);
      setMessage(`Activated version ${version.version}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to activate version.");
    } finally {
      setSaving(false);
    }
  };

  const handleLabelChange = (label: string) => {
    if (!selectedNode) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNode.id ? { ...node, data: { ...node.data, label } } : node,
      ),
    );
  };

  const catalogByCategory = useMemo(() => buildNodeCatalog(nodeSpecs), [nodeSpecs]);

  return (
    <div className="space-y-6">
      <PipelineHeader onCreatePipeline={handleCreatePipeline} />

      {message && <PipelineNotice message={message} />}

      {loading ? (
        <GlassCard className="flex items-center justify-center rounded-3xl p-10">
          <Loader className="h-6 w-6" />
        </GlassCard>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr_320px]">
          <PipelineSidebar
            pipelines={pipelines}
            selectedPipelineId={selectedPipeline?.id}
            catalog={catalogByCategory}
            onSelectPipeline={setSelectedPipeline}
            onAddNode={handleAddNode}
          />

          <PipelineCanvas
            nodes={nodes}
            edges={edges}
            selectedPipeline={selectedPipeline}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeSelect={setSelectedNodeId}
          />

          <div className="space-y-6">
            <PipelineInspector
              selectedNode={selectedNode}
              configDraft={configDraft}
              onConfigDraftChange={setConfigDraft}
              onLabelChange={handleLabelChange}
              onApplyConfig={handleApplyConfig}
            />

            <PipelineSavePanel
              changeSummary={changeSummary}
              onChangeSummary={setChangeSummary}
              onSave={handleSavePipeline}
              saving={saving}
              validating={validating}
            />

            <PipelineRevisions
              versions={versions}
              currentVersion={selectedPipeline?.current_version}
              saving={saving}
              onActivate={handleActivateVersion}
            />
          </div>
        </div>
      )}
    </div>
  );
}
