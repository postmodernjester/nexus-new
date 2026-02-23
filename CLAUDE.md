# NEXUS — Claude Code Session Notes

## Project Overview
NEXUS is a professional network/CRM tool built with **Next.js App Router** + **Supabase** (PostgreSQL, Auth, RLS).
Pages: Chronicle (timeline), Resume, Network (D3 force graph), Contacts, World (public directory).

## Tech Stack
- Next.js 14 App Router, `'use client'` pages
- Supabase (auth, database with RLS, no storage buckets — images stored as base64 data URLs)
- D3.js for network graph
- Inline styles throughout (no CSS modules/Tailwind classes)
- TypeScript strict mode

## Key Architecture Decisions
- **No Supabase Storage**: Client-side anon key can't create buckets. Images use `FileReader.readAsDataURL()` and store base64 in DB columns.
- **Key links**: Stored in `supabase.auth.updateUser({ data: { key_links } })` as user_metadata fallback, because `profiles.key_links` JSONB column may not exist. Loading checks both `profile.key_links` and `authUser.user_metadata?.key_links`.
- **Chronicle saves**: Use progressive retry — try with all fields, then drop `updated_at`, then drop `image_url`, then base fields only. Some columns (`image_url`, `description`) may not exist on `chronicle_entries`.
- **Git commits**: Always use `--no-gpg-sign` flag (GPG signing fails in this environment). Always commit `tsconfig.tsbuildinfo` separately if needed.

## Current Status (End of Session 10 — Feb 23, 2026)

### What's Working

**Chronicle** — Fully functional timeline visualization:
- Zoom (scroll-wheel + slider), drag to move, resize handles, fuzzy date edges
- Geography bands behind columns, age decade markers from birthday
- Click-through cycling for overlapping items
- Zoom range expanded to 60yr max, scroll position persists across reloads
- Double-click grid → new entry, double-click axis → new geography
- Work entries use unified WorkModal (LinkedIn-style with skills, location, engagement type)
- Education entries editable from chronicle with date/color/note

**Resume** — Full professional profile page:
- Experience section (traditional list format) with show_on_resume filtering
- Projects section (visual tile cards with photo support, base64 data URLs)
- Education section with institution/degree/field/dates
- Skills section (extracted from work entries)
- Key Links section (stored in user_metadata as fallback)
- Profile photo + birthday/age display
- Resume visibility toggle (is_public on profiles table)

**Network** — D3 force graph:
- Recency-based opacity (recent contacts more visible)
- Similarity clustering (shared company/skills)
- Looser physics for better readability
- Smart filter with softened fade on filtered-out nodes
- Ghost links cleaned up (no more phantom edges)

**Contacts** — CRM dossier pages:
- Header → AI Summary → Notes & Research → Resume View → Pending Actions → Edit Contact
- Resume view shows linked user's actual data (work/education/projects) via RLS
- Synergy section showing shared skills/companies between you and contact
- Auto-generate dossier summary when linking a contact
- Recent sort works correctly
- Link/unlink flow for connecting contacts to Nexus user profiles

**World** (NEW) — Public user directory:
- People tab: browse all Nexus users, see name/headline/company
- Companies tab: browse companies with employee counts
- Invitation workflow: send link invitations to connect
- Privacy controls: email hidden from non-linked users, resume visibility toggle
- Unlink button for removing connections
- Relationship types standardized to 6 canonical values: `colleague`, `friend`, `mentor`, `mentee`, `acquaintance`, `other`
- Contact merge flow when linking (merges existing contact data with linked profile)
- Clickable rows navigate to user profile pages
- Account self-delete functionality

**Invite System:**
- Contact-aware invite links with duplicate prevention
- `accept_link_invitation` RPC handles bidirectional contact creation
- Email auto-merge: when accepting an invitation, existing contacts matching by email get linked

### Architecture Patterns

**Phase 2 optional columns**: When saving to tables that may have columns added after initial creation (like `work_entries`), use a two-phase insert pattern:
1. Phase 1: Insert with guaranteed base columns only
2. Phase 2: Update with optional columns (`chronicle_color`, `chronicle_fuzzy_start`, `remote_type`, `ai_skills_extracted`, etc.), silently skip if columns don't exist (`.then(() => {}, () => {})`)

**SECURITY DEFINER RPCs**: For operations that need to bypass RLS (like creating contacts for both users during a connection), use Postgres functions with `SECURITY DEFINER` instead of client-side operations. Key RPC: `connect_users(inviter_id, invitee_id)`.

### In-Progress: Chronicle Dark Theme Demo

A dark-themed copy of the Chronicle at `/chronicle-v2` for demonstration purposes. See `docs/chronicle-v2-dark-demo.md` for full details.

**Done:**
- `src/components/chronicle/theme.ts` — Theme interface + LIGHT_THEME + DARK_THEME (midnight/gold scheme)
- `src/components/chronicle-v2/ToolbarDark.tsx` — Dark toolbar
- `src/components/chronicle-v2/ChronicleModalDark.tsx` — Dark entry modal
- `src/components/chronicle-v2/ChronicleGeoModalDark.tsx` — Dark geography modal

**TODO:**
- `src/components/chronicle-v2/ChronicleCanvasDark.tsx` — Main canvas (copy of ChronicleCanvas with dark theme tokens)
- `src/app/chronicle-v2/page.tsx` — Route page

### Key Files
- `src/components/chronicle/ChronicleCanvas.tsx` — Timeline visualization (~1800 lines)
- `src/components/chronicle/theme.ts` — Theme definitions (light + dark)
- `src/app/resume/page.tsx` — Resume data input page
- `src/app/resume/components/WorkModal.tsx` — Unified work entry editor (LinkedIn-style)
- `src/app/contacts/[id]/page.tsx` — Contact dossier page
- `src/app/world/page.tsx` — Public user directory
- `src/app/world/[id]/page.tsx` — Individual user profile page
- `src/app/network/page.tsx` — D3 network graph
- `src/lib/chronicle.ts` — Chronicle CRUD with resilient saves
- `src/lib/supabase.ts` — Supabase client
- `src/lib/connections.ts` — Connection/invitation helpers
- `docs/chronicle-v2-dark-demo.md` — Dark theme demo handoff doc

### SQL Migrations (in `supabase/migrations/`)
1. `20260222_add_image_url.sql` — adds `image_url TEXT` to `chronicle_entries`
2. `20260222_connected_resume_rls.sql` — RLS policies for linked contacts to view resume data
3. `20260222_connect_users_rpc_and_contacts_rls.sql` — SECURITY DEFINER `connect_users()` RPC + contacts RLS

### Session History
**Session 1**: Geography double-click, scroll offset, colors, work fields, nav tabs, network clustering
**Session 2**: Profile→Resume rename, chronicle modal, image upload, icon buttons, linked profiles, contact nav, zoom, edit modal
**Session 3**: Projects not showing, image upload, network single-click, geography band, chronicle click-through, key links, network filter
**Session 4**: Education in wrong resume section, geography save resilience, click-through double-fire fix, key links save (user_metadata), photo upload bucket→base64, geography opacity, key links position, contact page restructure (notes moved up, resume view added), RLS policies for linked contacts
**Session 5**: Fix direct connect (swapped inviter/invitee IDs + move to SECURITY DEFINER RPC for bidirectional contact creation), fix 2nd degree network (contacts RLS policy for connected users)
**Session 6**: Network improvements (recency opacity, looser physics, similarity clustering, smart filter), refactor large pages into modules, contact fixes (sort, auto-dossier, edit after linking), Skills section on resume, Synergy section on contact page
**Session 7**: Unified WorkModal (LinkedIn-style editor with skills extraction, location type, engagement type, is_current), resume visual overhaul (tiles for projects, traditional list for experience, profile photo, birthday/age), save resilience (Phase 2 optional columns pattern), chronicle zoom range increase (60yr), scroll position persistence
**Session 8**: Contact-aware invite links with duplicate prevention, link/unlink flow for contacts, project save UUID fix, ghost link cleanup on network page
**Session 9**: World page (People/Companies tabs, invitation workflow, privacy controls, unlink, relationship type standardization to 6 canonical values), company page Supabase client fix (was causing logout), account self-delete, resume visibility toggle, email privacy for non-linked users, clickable people list rows, world profile page fix
**Session 10**: Contact merge flow when linking via World page, email auto-merge in accept_link_invitation, chronicle dark theme demo (theme.ts + 3 dark components created, main canvas + route still TODO)
