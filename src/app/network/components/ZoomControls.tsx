import { RefObject, useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";

interface ZoomControlsProps {
  svgRef: RefObject<SVGSVGElement | null>;
  zoomRef: RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>;
}

const TRACK_W = 170;
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;

function scaleToSlider(scale: number): number {
  return (Math.log(scale) - Math.log(MIN_SCALE)) / (Math.log(MAX_SCALE) - Math.log(MIN_SCALE));
}

function sliderToScale(pos: number): number {
  return Math.exp(Math.log(MIN_SCALE) + pos * (Math.log(MAX_SCALE) - Math.log(MIN_SCALE)));
}

function formatZoomLabel(scale: number): string {
  return Math.round(scale * 100) + "%";
}

export default function ZoomControls({ svgRef, zoomRef }: ZoomControlsProps) {
  const [sliderPos, setSliderPos] = useState(() => scaleToSlider(1));
  const draggingRef = useRef(false);
  const rafRef = useRef<number>(0);

  // Sync slider from D3 zoom transform using rAF polling.
  // This avoids the timing issue where the D3 zoom behavior hasn't been
  // created yet when this component's effect runs.
  useEffect(() => {
    let lastK = 1;
    const sync = () => {
      if (svgRef.current) {
        const k = d3.zoomTransform(svgRef.current).k;
        if (k !== lastK) {
          lastK = k;
          setSliderPos(scaleToSlider(k));
        }
      }
      rafRef.current = requestAnimationFrame(sync);
    };
    rafRef.current = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(rafRef.current);
  }, [svgRef]);

  const applyZoom = useCallback((pos: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const clamped = Math.max(0, Math.min(1, pos));
    const newScale = sliderToScale(clamped);
    const svg = d3.select(svgRef.current);
    const currentTransform = d3.zoomTransform(svgRef.current);

    // Zoom centered on the viewport center (where the self node is)
    const cx = svgRef.current.clientWidth / 2;
    const cy = svgRef.current.clientHeight / 2;
    const svgCenter = currentTransform.invert([cx, cy]);
    const newTransform = d3.zoomIdentity
      .translate(cx, cy)
      .scale(newScale)
      .translate(-svgCenter[0], -svgCenter[1]);

    (svg as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>)
      .call(zoomRef.current.transform, newTransform);
    setSliderPos(clamped);
  }, [svgRef, zoomRef]);

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    draggingRef.current = true;
    applyZoom(pos);
  }, [applyZoom]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const track = document.getElementById("net-zoom-track");
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      applyZoom(pos);
    };
    const handleMouseUp = () => { draggingRef.current = false; };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [applyZoom]);

  const scale = sliderToScale(sliderPos);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        display: "flex",
        alignItems: "center",
        gap: "9px",
        zIndex: 20,
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(8px)",
        padding: "8px 14px",
        borderRadius: "10px",
        border: "1px solid #334155",
      }}
    >
      <span style={{ fontSize: "7.5px", letterSpacing: ".15em", color: "#64748b", textTransform: "uppercase" }}>
        SCALE
      </span>
      <div
        id="net-zoom-track"
        onMouseDown={handleTrackClick}
        style={{
          position: "relative",
          width: TRACK_W,
          height: 3,
          background: "#334155",
          borderRadius: 2,
          cursor: "pointer",
        }}
      >
        {/* Fill */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${sliderPos * 100}%`,
            background: "#64748b",
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
        {/* Thumb */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${sliderPos * 100}%`,
            transform: "translate(-50%,-50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#94a3b8",
            cursor: "grab",
            boxShadow: "0 1px 4px rgba(0,0,0,.4)",
          }}
        />
      </div>
      <span style={{ fontSize: 9, color: "#64748b", minWidth: 34 }}>
        {formatZoomLabel(scale)}
      </span>
    </div>
  );
}
