# Chronicle Integration — Handoff Context for Claude Code

## Repo
`postmodernjester/nexus-new` — Next.js app deployed on Netlify

## App Structure
```
src/
  app/
    layout.tsx          — root layout with Nav
    dashboard/page.tsx  — main dashboard
    contacts/           — contact pages
    companies/          — company pages
    resume/page.tsx     — public resume
    network/page.tsx    — network visualization
    login/ signup/      — auth
  components/
    Nav.tsx             — sidebar navigation (horizontal top bar, not sidebar)
    ExperienceModal.tsx — modal for work entries
  lib/
    supabase.ts         — server supabase client
    supabase/client.ts  — browser supabase client (createClient function)
    connections.ts      — connection helpers
    interactions.ts     — interaction helpers
    types.ts            — TypeScript types
  testing/
    chronicle.html      — 853-line standalone HTML prototype (SOURCE OF TRUTH for UI)
```

## Task: Convert Chronicle HTML → Next.js Page

### What Chronicle Is
A visual timeline/workspace where users place entries (work, projects, personal, residences, tech, people) on a zoomable vertical timeline with horizontal category columns. Think spreadsheet-meets-timeline with drag, resize, and zoom.

### The HTML Prototype (`src/testing/chronicle.html`) Has:
- **6 columns:** Work, Projects, Personal, Residences, Tech, People — each color-coded
- **Vertical time axis** on the left showing years (with age) from ~1979 to present
- **Geography bands** — horizontal colored bands behind everything showing where user lived
- **Zoom slider** in toolbar — changes pixels-per-month, affecting detail level
- **Double-click column** to add new entry, **click year axis** to add geography
- **Drag entries** to move vertically (change dates), **resize handles** top/bottom
- **People** rendered as dots with vertical tails (ongoing relationships)
- **Fuzzy dates** — entries can have blurred top/bottom edges for approximate dates
- **Tooltip on hover** showing entry details
- **Delete key** removes selected entry
- **Escape** deselects / closes modals

### Color Palette (from HTML — PRESERVE EXACTLY)
```css
--bg: #f0ead8;        /* warm parchment background */
--paper: #f6f1e6;     /* slightly lighter paper */
--ink: #1a1812;       /* near-black ink */
--ink-mid: #5a5040;   /* medium ink */
--ink-dim: #9a8e78;   /* dim ink */
--ink-faint: #d8d0c0; /* faint ink */
```

Column colors:
- Work: `#4070a8` (blues)
- Projects: `#508038` (greens)
- Personal: `#a85060` (pinks/reds)
- Residences: `#806840` (browns)
- Tech: `#986020` (oranges)
- People: `#7050a8` (purples)
- Geography: earthy pastels like `#c0b484`, `#b8c8a8`, `#c0a890`

### Font Stack
```css
@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;1,400&family=DM+Mono:wght@300;400;500&display=swap');
/* Body: 'DM Mono', monospace */
/* Logo/headers: 'Libre Baskerville', serif, italic */
```

### Supabase Tables

**Existing tables to add canvas columns to:**
- `work_entries` — has title, organization, start_date, end_date, etc.
- `contacts` — has full_name, company, role, etc.

**New tables to create:**

```sql
CREATE TABLE chronicle_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'project', 'personal', 'tech', 'milestone'
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT, -- format: 'YYYY-MM'
  end_date TEXT,   -- format: 'YYYY-MM' or null
  canvas_col TEXT, -- column id: 'project', 'personal', 'tech'
  color TEXT,
  fuzzy_start BOOLEAN DEFAULT false,
  fuzzy_end BOOLEAN DEFAULT false,
  note TEXT,
  show_on_resume BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chronicle_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  start_date TEXT, -- 'YYYY-MM'
  end_date TEXT,
  color TEXT,
  fuzzy_start BOOLEAN DEFAULT false,
  fuzzy_end BOOLEAN DEFAULT false,
  note TEXT,
  show_on_resume BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add canvas columns to existing tables
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS chronicle_color TEXT;
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS chronicle_fuzzy_start BOOLEAN DEFAULT false;
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS chronicle_fuzzy_end BOOLEAN DEFAULT false;
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS chronicle_note TEXT;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS chronicle_color TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS chronicle_fuzzy_start BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS chronicle_fuzzy_end BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS chronicle_note TEXT;
```

### What to Build

**Files to create:**

1. **`src/app/chronicle/page.tsx`** — Route page, wraps ChronicleCanvas
2. **`src/components/chronicle/ChronicleCanvas.tsx`** — Main canvas: renders axis, grid, columns, entries, handles zoom/pan/scroll
3. **`src/components/chronicle/ChronicleEntry.tsx`** — Single entry card (draggable, resizable, fuzzy edges)
4. **`src/components/chronicle/ChroniclePerson.tsx`** — Person dot + tail component
5. **`src/components/chronicle/ChroniclePlace.tsx`** — Geography band component
6. **`src/components/chronicle/ChronicleToolbar.tsx`** — Top toolbar with zoom slider
7. **`src/components/chronicle/ChronicleModal.tsx`** — Add/edit entry modal
8. **`src/components/chronicle/ChronicleGeoModal.tsx`** — Add/edit geography modal
9. **`src/lib/chronicle.ts`** — Supabase CRUD: load all data, save entry, delete entry, save place, etc.

**Files to modify:**

10. **`src/components/Nav.tsx`** — Add `{ href: '/chronicle', label: 'Chronicle' }` to NAV_ITEMS, between Network and Contacts

### Existing Supabase Client Pattern
```typescript
// src/lib/supabase/client.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}
```

### Nav Pattern
```typescript
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/network',   label: 'Network' },
  { href: '/chronicle',  label: 'Chronicle' },  // ← ADD THIS
  { href: '/contacts',  label: 'Contacts' },
  { href: '/resume',    label: 'My Profile' },
];
```

### Key Implementation Notes

1. **This is NOT a free-form canvas.** Entries are positioned in COLUMNS (x = column index × column width) and vertically by DATE (y = months from start year × pixels-per-month). Dragging only changes y position (dates). Moving between columns = changing category.

2. **Zoom changes `pxPerMonth`** — at low zoom, only titles show. At higher zoom, dates and notes appear. The zoom slider goes from 0.3× to 3.0×.

3. **People are special** — they render as a colored dot with a label and a long vertical "tail" line extending to present day (ongoing relationship). No resize handles.

4. **Geography bands** span full width behind everything, are semi-transparent, and have fuzzy edges when dates are approximate.

5. **The scroll container** scrolls vertically (through time) and horizontally (if columns overflow). The year axis is `position: sticky; left: 0` so it stays visible during horizontal scroll.

6. **Snap to month** — after dragging, positions snap to nearest month boundary.

7. **Data flow:** On mount, load from Supabase. On save/drag-end, upsert to Supabase. Keep local state in React for responsiveness, sync to DB.

8. **All entry dates use 'YYYY-MM' string format** (not full dates). The prototype uses this throughout.

### Architecture Decision
Build it as ONE large client component (`ChronicleCanvas.tsx`) that manages all the rendering and interaction state internally, similar to how the HTML prototype works. Don't over-componentize — the tight coupling between zoom state, drag state, and rendering makes splitting into many small components more complex than helpful. Modal components can be separate files though.
