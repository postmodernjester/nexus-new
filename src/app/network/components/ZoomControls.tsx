import { RefObject } from "react";
import * as d3 from "d3";

interface ZoomControlsProps {
  svgRef: RefObject<SVGSVGElement | null>;
  zoomRef: RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>;
}

export default function ZoomControls({ svgRef, zoomRef }: ZoomControlsProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        zIndex: 20,
      }}
    >
      {[
        { label: "+", delta: 1.4 },
        { label: "\u2013", delta: 1 / 1.4 },
      ].map(({ label, delta }) => (
        <button
          key={label}
          onClick={() => {
            if (!svgRef.current || !zoomRef.current) return;
            const svg = d3.select(svgRef.current);
            (svg as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>)
              .transition()
              .duration(250)
              .call(zoomRef.current.scaleBy, delta);
          }}
          style={{
            width: "36px",
            height: "36px",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
            color: "#94a3b8",
            fontSize: "18px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
