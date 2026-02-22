import { GraphNode } from "../types";

interface NetworkTooltipProps {
  hoveredNode: GraphNode | null;
  tooltipPos: { x: number; y: number };
}

export default function NetworkTooltip({ hoveredNode, tooltipPos }: NetworkTooltipProps) {
  if (!hoveredNode) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: tooltipPos.x + 12,
        top: tooltipPos.y - 10,
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "10px",
        padding: "12px 16px",
        zIndex: 50,
        pointerEvents: "none",
        maxWidth: "280px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {hoveredNode.type === "their_contact" ? (
        <>
          {/* 2nd degree: job title only */}
          {hoveredNode.role && (
            <div style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0" }}>
              {hoveredNode.role}
            </div>
          )}
          <div style={{ color: "#475569", fontSize: "11px", marginTop: "4px" }}>
            2nd degree
          </div>
        </>
      ) : (
        <>
          {/* 1st degree + self: full name, title, company */}
          <div style={{ fontWeight: 600, fontSize: "14px", color: "#e2e8f0" }}>
            {hoveredNode.fullName}
          </div>
          {hoveredNode.role && (
            <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
              {hoveredNode.role}
              {hoveredNode.company ? ` at ${hoveredNode.company}` : ""}
            </div>
          )}
          {!hoveredNode.role && hoveredNode.company && (
            <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
              {hoveredNode.company}
            </div>
          )}
          {hoveredNode.type === "connected_user" && (
            <div style={{ color: "#475569", fontSize: "11px", marginTop: "4px" }}>
              NEXUS user
            </div>
          )}
        </>
      )}
    </div>
  );
}
