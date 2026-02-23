import React from 'react'
import { DARK_THEME as T } from '../chronicle/theme'

interface ToolbarProps {
  sliderPos: number
  zoomLabel: string
  zoomDragRef: React.MutableRefObject<boolean>
  zoomFromTrack: (clientX: number) => void
}

export default function ToolbarDark({ sliderPos, zoomLabel, zoomDragRef, zoomFromTrack }: ToolbarProps) {
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', borderBottom: `2px solid ${T.borderStrong}`,
      background: T.panelBg, zIndex: 60, height: 40,
    }}>
      <div style={{
        padding: '0 14px', borderRight: `1px solid ${T.borderLight}`, height: '100%',
        display: 'flex', alignItems: 'center',
        fontFamily: T.fontHeading, fontStyle: 'italic', fontSize: 12, color: T.textSecondary,
      }}>
        chronicle
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderRight: `1px solid ${T.borderLight}`, height: '100%' }}>
        <label style={{ fontSize: '7.5px', letterSpacing: '.15em', color: T.textMuted }}>SCALE</label>
        <div
          id="chr-zoom-track"
          onMouseDown={(e) => { zoomDragRef.current = true; zoomFromTrack(e.clientX); e.preventDefault() }}
          style={{ position: 'relative', width: 110, height: 3, background: T.zoomTrackBg, borderRadius: 2, cursor: 'pointer' }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${sliderPos * 100}%`, background: T.zoomTrackFill, borderRadius: 2, pointerEvents: 'none' }} />
          <div style={{
            position: 'absolute', top: '50%', left: `${sliderPos * 100}%`,
            transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%',
            background: T.zoomThumbBg, cursor: 'grab', boxShadow: T.zoomThumbShadow,
          }} />
        </div>
        <span style={{ fontSize: 9, color: T.textMuted, minWidth: 34 }}>{zoomLabel}</span>
      </div>

      <div style={{ padding: '0 14px', fontSize: '7.5px', color: T.textFaint, letterSpacing: '.06em', lineHeight: 1.5 }}>
        dbl-click axis → add geography &nbsp;·&nbsp; dbl-click column → new entry &nbsp;·&nbsp; drag body → move &nbsp;·&nbsp; drag edge → resize &nbsp;·&nbsp; del → delete
      </div>
    </div>
  )
}
