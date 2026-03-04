"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useNetworkingStore, type MindMapNode } from "@/lib/stores/networkingStore";

interface DragState {
  nodeId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export function MindMap() {
  const selectedGroupId = useNetworkingStore((s) => s.selectedGroupId);
  const nodes = useNetworkingStore((s) => s.mindMapNodes);
  const isMember = useNetworkingStore((s) => s.isMember);
  const updateMindMapNode = useNetworkingStore((s) => s.updateMindMapNode);
  const addMindMapNode = useNetworkingStore((s) => s.addMindMapNode);
  const removeMindMapNode = useNetworkingStore((s) => s.removeMindMapNode);

  const [creatingFor, setCreatingFor] = useState<string | null>(null); // parentId or "root"
  const [inlineValue, setInlineValue] = useState("");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // SVG viewBox pan
  const [viewBox, setViewBox] = useState({ x: -400, y: -300, w: 800, h: 600 });

  // Fit viewBox to nodes
  useEffect(() => {
    if (nodes.length === 0) {
      setViewBox({ x: -400, y: -300, w: 800, h: 600 });
      return;
    }
    const padding = 200;
    const xs = nodes.map((n) => n.positionX);
    const ys = nodes.map((n) => n.positionY);
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;
    setViewBox({
      x: minX,
      y: minY,
      w: Math.max(maxX - minX, 400),
      h: Math.max(maxY - minY, 300),
    });
  }, [nodes]);

  // Focus inline input when creatingFor changes
  useEffect(() => {
    if (creatingFor) {
      setInlineValue("");
      // Small delay to let foreignObject render
      requestAnimationFrame(() => {
        inlineInputRef.current?.focus();
      });
    }
  }, [creatingFor]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, node: MindMapNode) => {
      if (!isMember) return;
      e.stopPropagation();
      setSelectedNode(node.id);
      setDragState({
        nodeId: node.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: node.positionX,
        origY: node.positionY,
      });
    },
    [isMember]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !svgRef.current) return;
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      const dx = (e.clientX - dragState.startX) * scaleX;
      const dy = (e.clientY - dragState.startY) * scaleY;
      updateMindMapNode(dragState.nodeId, {
        positionX: dragState.origX + dx,
        positionY: dragState.origY + dy,
      });
    },
    [dragState, viewBox, updateMindMapNode]
  );

  const handleMouseUp = useCallback(async () => {
    if (!dragState || !selectedGroupId) {
      setDragState(null);
      return;
    }
    const node = nodes.find((n) => n.id === dragState.nodeId);
    if (node) {
      await fetch(
        `/api/networking/groups/${selectedGroupId}/mindmap/${dragState.nodeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positionX: node.positionX,
            positionY: node.positionY,
          }),
        }
      ).catch(() => {});
    }
    setDragState(null);
  }, [dragState, nodes, selectedGroupId]);

  async function handleCreateNode(label: string, parentId: string | null) {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(
        `/api/networking/groups/${selectedGroupId}/mindmap`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, parentId }),
        }
      );
      if (res.ok) {
        const node = await res.json();
        addMindMapNode(node);
      }
    } catch {
      // ignore
    }
    setCreatingFor(null);
  }

  async function handleDeleteNode(nodeId: string) {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(
        `/api/networking/groups/${selectedGroupId}/mindmap/${nodeId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        removeMindMapNode(nodeId);
        setSelectedNode(null);
      }
    } catch {
      // ignore
    }
  }

  // Compute where the inline "new node" circle should appear
  function getNewNodePosition(): { x: number; y: number } {
    if (creatingFor === "root") {
      return { x: 0, y: 0 };
    }
    const parent = nodes.find((n) => n.id === creatingFor);
    if (!parent) return { x: 0, y: 0 };
    // Offset below-right of parent
    const childCount = nodes.filter((n) => n.parentId === parent.id).length;
    const angle = -Math.PI / 4 + (childCount * Math.PI) / 6;
    const dist = 120;
    return {
      x: parent.positionX + Math.cos(angle) * dist,
      y: parent.positionY + Math.sin(angle) * dist,
    };
  }

  if (!isMember) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Join the group to collaborate on the mind map
        </p>
      </div>
    );
  }

  const newNodePos = creatingFor ? getNewNodePosition() : null;
  const newNodeRadius = creatingFor === "root" ? 50 : 40;

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground">Mind Map</h4>
        <button
          onClick={() => setCreatingFor("root")}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/[0.06] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Root
        </button>
      </div>

      {/* SVG Canvas */}
      <div className="flex-1 overflow-hidden rounded-lg border border-border/50 bg-secondary/30">
        {nodes.length === 0 && !creatingFor ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Add a root node to get started
            </p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="h-full w-full"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Edges */}
            {nodes
              .filter((n) => n.parentId)
              .map((node) => {
                const parent = nodes.find((p) => p.id === node.parentId);
                if (!parent) return null;
                return (
                  <line
                    key={`edge-${node.id}`}
                    x1={parent.positionX}
                    y1={parent.positionY}
                    x2={node.positionX}
                    y2={node.positionY}
                    stroke="var(--border)"
                    strokeWidth="2"
                  />
                );
              })}

            {/* Edge from parent to new node being created */}
            {creatingFor && creatingFor !== "root" && newNodePos && (
              <line
                x1={nodes.find((n) => n.id === creatingFor)?.positionX ?? 0}
                y1={nodes.find((n) => n.id === creatingFor)?.positionY ?? 0}
                x2={newNodePos.x}
                y2={newNodePos.y}
                stroke="var(--primary)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                opacity={0.5}
              />
            )}

            {/* Nodes */}
            {nodes.map((node) => (
              <g
                key={node.id}
                onMouseDown={(e) => handleMouseDown(e, node)}
                style={{ cursor: dragState?.nodeId === node.id ? "grabbing" : "grab" }}
              >
                {/* Circle */}
                <circle
                  cx={node.positionX}
                  cy={node.positionY}
                  r={node.parentId ? 40 : 50}
                  fill={
                    selectedNode === node.id
                      ? "rgba(220, 38, 38, 0.12)"
                      : node.parentId
                      ? "white"
                      : "rgba(220, 38, 38, 0.06)"
                  }
                  stroke={
                    selectedNode === node.id
                      ? "var(--primary)"
                      : "var(--border)"
                  }
                  strokeWidth={selectedNode === node.id ? 2 : 1}
                />
                {/* Label */}
                <text
                  x={node.positionX}
                  y={node.positionY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="select-none pointer-events-none"
                  fill="var(--foreground)"
                  fontSize={node.parentId ? 14 : 16}
                  fontWeight={node.parentId ? 400 : 600}
                >
                  {node.label.length > 12
                    ? node.label.slice(0, 10) + "..."
                    : node.label}
                </text>

                {/* Add child button — larger */}
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingFor(node.id);
                    setSelectedNode(node.id);
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={node.positionX + (node.parentId ? 36 : 46)}
                    cy={node.positionY - (node.parentId ? 30 : 40)}
                    r={16}
                    fill="white"
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    opacity={0.85}
                  />
                  <text
                    x={node.positionX + (node.parentId ? 36 : 46)}
                    y={node.positionY - (node.parentId ? 30 : 40)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--primary)"
                    fontSize="20"
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    +
                  </text>
                </g>
              </g>
            ))}

            {/* Inline input circle for new node */}
            {creatingFor && newNodePos && (
              <g>
                <circle
                  cx={newNodePos.x}
                  cy={newNodePos.y}
                  r={newNodeRadius}
                  fill="white"
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <foreignObject
                  x={newNodePos.x - newNodeRadius + 4}
                  y={newNodePos.y - 12}
                  width={(newNodeRadius - 4) * 2}
                  height={24}
                >
                  <input
                    ref={inlineInputRef}
                    value={inlineValue}
                    onChange={(e) => {
                      const words = e.target.value.trim().split(/\s+/).filter(Boolean).length;
                      if (words <= 12) setInlineValue(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && inlineValue.trim()) {
                        handleCreateNode(
                          inlineValue.trim(),
                          creatingFor === "root" ? null : creatingFor
                        );
                      } else if (e.key === "Escape") {
                        setCreatingFor(null);
                      }
                    }}
                    onBlur={() => setCreatingFor(null)}
                    placeholder="Label..."
                    maxLength={200}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      textAlign: "center",
                      fontSize: "13px",
                      color: "var(--foreground)",
                    }}
                  />
                </foreignObject>
              </g>
            )}
          </svg>
        )}
      </div>

      {/* Delete button for selected node */}
      {selectedNode && !creatingFor && (
        <button
          onClick={() => handleDeleteNode(selectedNode)}
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      )}
    </div>
  );
}
