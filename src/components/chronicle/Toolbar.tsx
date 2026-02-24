import React from 'react'

interface ToolbarProps {
  sliderPos: number
  zoomLabel: string
  zoomDragRef: React.MutableRefObject<boolean>
  zoomFromTrack: (clientX: number) => void
  onOpenSettings: () => void
}

export default function Toolbar({ sliderPos, zoomLabel, zoomDragRef, zoomFromTrack, onOpenSettings }: ToolbarProps) {
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', borderBottom: '2px solid #1a1812',
      background: '#f6f1e6', zIndex: 60, height: 40,
    }}>
      <div style={{
        padding: '0 14px', borderRight: '1px solid #d8d0c0', height: '100%',
        display: 'flex', alignItems: 'center',
        fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic', fontSize: 12, color: '#5a5040',
      }}>
        chronicle
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderRight: '1px solid #d8d0c0', height: '100%' }}>
        <label style={{ fontSize: '7.5px', letterSpacing: '.15em', color: '#9a8e78' }}>SCALE</label>
        <div
          id="chr-zoom-track"
          onMouseDown={(e) => { zoomDragRef.current = true; zoomFromTrack(e.clientX); e.preventDefault() }}
          style={{ position: 'relative', width: 170, height: 3, background: '#d8d0c0', borderRadius: 2, cursor: 'pointer' }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${sliderPos * 100}%`, background: '#9a8e78', borderRadius: 2, pointerEvents: 'none' }} />
          <div style={{
            position: 'absolute', top: '50%', left: `${sliderPos * 100}%`,
            transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%',
            background: '#1a1812', cursor: 'grab', boxShadow: '0 1px 4px rgba(0,0,0,.25)',
            transition: zoomDragRef.current ? 'none' : 'left 0.08s ease-out',
          }} />
        </div>
        <span style={{ fontSize: 9, color: '#9a8e78', minWidth: 34 }}>{zoomLabel}</span>
      </div>

      <div style={{ flex: 1, padding: '0 14px', fontSize: '7.5px', color: '#d8d0c0', letterSpacing: '.06em', lineHeight: 1.5 }}>
        dbl-click axis → add geography &nbsp;·&nbsp; dbl-click column → new entry &nbsp;·&nbsp; drag body → move &nbsp;·&nbsp; drag edge → resize &nbsp;·&nbsp; del → delete
      </div>

      {/* Gear icon — column settings */}
      <button
        onClick={onOpenSettings}
        title="Column settings"
        style={{
          flexShrink: 0, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', borderLeft: '1px solid #d8d0c0', cursor: 'pointer',
          color: '#9a8e78', fontSize: 15, padding: 0, transition: 'color .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#5a5040')}
        onMouseLeave={e => (e.currentTarget.style.color = '#9a8e78')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.86 1.5h2.28l.35 1.77a5.5 5.5 0 0 1 1.32.77l1.72-.57.94 1.63-1.37 1.2a5.5 5.5 0 0 1 0 1.4l1.37 1.2-.94 1.63-1.72-.57a5.5 5.5 0 0 1-1.32.77l-.35 1.77H6.86l-.35-1.77a5.5 5.5 0 0 1-1.32-.77l-1.72.57-.94-1.63 1.37-1.2a5.5 5.5 0 0 1 0-1.4l-1.37-1.2.94-1.63 1.72.57a5.5 5.5 0 0 1 1.32-.77L6.86 1.5Z" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      </button>
    </div>
  )
}
