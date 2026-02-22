# NEXUS — Claude Code Session Notes

## Project Overview
NEXUS is a professional network/CRM tool built with **Next.js App Router** + **Supabase** (PostgreSQL, Auth, RLS).
Pages: Chronicle (timeline), Resume, Network (D3 force graph), Contacts.

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

## Current Status (End of Session 4 — Feb 22, 2026)

### What's Working
- Chronicle timeline with zoom, drag, fuzzy edges, geography bands (low opacity)
- Click-through cycling overlapping items (mousedown no longer calls selectEntry)
- Resume page with Experience, Projects, Education, Key Links sections
- Photo upload on projects (base64 data URL) — **requires `image_url` column on `chronicle_entries`**
- Contact dossier page with: Header → AI Summary → Notes & Research → Resume View → Pending Actions → Edit Contact
- Resume view on contact page: paper-style (cream bg, serif fonts) showing linked user's name/headline/bio/experience/projects/education/key links

### Outstanding Issue: Resume View on Contact Page May Not Show Real Data
The resume-style view now always renders (falls back to contact's own name/role if profile query fails), but **the linked user's actual resume data (work entries, chronicle entries, education) may still return empty** if RLS policies haven't been applied.

**User needs to run this SQL in Supabase SQL Editor:**
```sql
DROP POLICY IF EXISTS "Connected users can view chronicle entries" ON public.chronicle_entries;
DROP POLICY IF EXISTS "Connected users can view education" ON public.education;
DROP POLICY IF EXISTS "Linked contact owners can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Linked contact owners can view work entries" ON public.work_entries;
DROP POLICY IF EXISTS "Linked contact owners can view chronicle entries" ON public.chronicle_entries;
DROP POLICY IF EXISTS "Linked contact owners can view education" ON public.education;

CREATE POLICY "Linked contact owners can view profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE owner_id = auth.uid() AND linked_profile_id = profiles.id)
  );
CREATE POLICY "Linked contact owners can view work entries" ON public.work_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE owner_id = auth.uid() AND linked_profile_id = work_entries.user_id)
  );
CREATE POLICY "Linked contact owners can view chronicle entries" ON public.chronicle_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE owner_id = auth.uid() AND linked_profile_id = chronicle_entries.user_id)
  );
CREATE POLICY "Linked contact owners can view education" ON public.education
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE owner_id = auth.uid() AND linked_profile_id = education.user_id)
  );
```

Also needs: `ALTER TABLE chronicle_entries ADD COLUMN IF NOT EXISTS image_url TEXT;`

**The user said they ran the SQL but the resume still didn't show.** Possible reasons:
1. The first SQL attempt (without DROP IF EXISTS) may have failed partway, and the user may not have run the corrected version yet
2. The contact may not actually have a `linked_profile_id` set
3. The linked profile's `is_public` may be false and the RLS policy may not be taking effect
4. Check browser console for `[contact]` logs if debugging is needed (logging was removed but can be re-added)

**Next step when resuming**: Ask user to confirm the SQL ran without errors, or check if the resume view is now showing with the fallback (contact's own name). If it shows just the name with no work/education data, the RLS policies need to be verified. If nothing shows at all, the contact may not have `linked_profile_id`.

### SQL Migrations Needed (in order)
All in `supabase/migrations/`:
1. `20260222_add_image_url.sql` — adds `image_url TEXT` to `chronicle_entries`
2. `20260222_connected_resume_rls.sql` — RLS policies for linked contacts to view resume data

### Key Files
- `/home/user/nexus-new/src/app/contacts/[id]/page.tsx` — Contact dossier page (~2086 lines)
- `/home/user/nexus-new/src/app/resume/page.tsx` — Resume data input page
- `/home/user/nexus-new/src/components/chronicle/ChronicleCanvas.tsx` — Timeline visualization
- `/home/user/nexus-new/src/lib/chronicle.ts` — Chronicle CRUD with resilient upsertPlace
- `/home/user/nexus-new/src/lib/supabase.ts` — Supabase client

### Session History (cumulative ~30+ fixes across 4 sessions)
**Session 1**: Geography double-click, scroll offset, colors, work fields, nav tabs, network clustering
**Session 2**: Profile→Resume rename, chronicle modal, image upload, icon buttons, linked profiles, contact nav, zoom, edit modal
**Session 3**: Projects not showing, image upload, network single-click, geography band, chronicle click-through, key links, network filter
**Session 4**: Education in wrong resume section, geography save resilience, click-through double-fire fix, key links save (user_metadata), photo upload bucket→base64, geography opacity, key links position, contact page restructure (notes moved up, resume view added), RLS policies for linked contacts
