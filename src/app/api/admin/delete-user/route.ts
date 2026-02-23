import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function verifyAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId || user.id !== adminId) return null;
  return user;
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (userId === admin.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const log: string[] = [];

  try {
    // 1. Get all contact IDs owned by this user (to delete their notes)
    const { data: userContacts } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("owner_id", userId);
    const contactIds = (userContacts || []).map((c: any) => c.id);

    // 2. Delete notes on user's contacts
    if (contactIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("contact_notes")
        .delete()
        .in("contact_id", contactIds);
      log.push(`contact_notes by contact_id: ${error ? error.message : "ok"}`);
    }

    // 3. Delete notes owned by user (safety net)
    {
      const { error } = await supabaseAdmin
        .from("contact_notes")
        .delete()
        .eq("owner_id", userId);
      log.push(`contact_notes by owner_id: ${error ? error.message : "ok"}`);
    }

    // 4. Delete user's contacts
    {
      const { error } = await supabaseAdmin
        .from("contacts")
        .delete()
        .eq("owner_id", userId);
      log.push(`contacts: ${error ? error.message : "ok"}`);
    }

    // 5. Unlink other people's contacts that reference this user
    {
      const { error } = await supabaseAdmin
        .from("contacts")
        .update({ linked_profile_id: null })
        .eq("linked_profile_id", userId);
      log.push(`unlink others' contacts: ${error ? error.message : "ok"}`);
    }

    // 6. Delete connections (both directions)
    {
      const { error: e1 } = await supabaseAdmin
        .from("connections")
        .delete()
        .eq("inviter_id", userId);
      const { error: e2 } = await supabaseAdmin
        .from("connections")
        .delete()
        .eq("invitee_id", userId);
      log.push(`connections: ${e1 ? e1.message : "ok"} / ${e2 ? e2.message : "ok"}`);
    }

    // 7. Delete link invitations (both directions)
    {
      const { error: e1 } = await supabaseAdmin
        .from("link_invitations")
        .delete()
        .eq("from_user_id", userId);
      const { error: e2 } = await supabaseAdmin
        .from("link_invitations")
        .delete()
        .eq("to_user_id", userId);
      log.push(`link_invitations: ${e1 ? e1.message : "ok"} / ${e2 ? e2.message : "ok"}`);
    }

    // 8. Delete work entries
    {
      const { error } = await supabaseAdmin
        .from("work_entries")
        .delete()
        .eq("user_id", userId);
      log.push(`work_entries: ${error ? error.message : "ok"}`);
    }

    // 9. Delete education
    {
      const { error } = await supabaseAdmin
        .from("education")
        .delete()
        .eq("user_id", userId);
      log.push(`education: ${error ? error.message : "ok"}`);
    }

    // 10. Delete skills
    {
      const { error } = await supabaseAdmin
        .from("skills")
        .delete()
        .eq("user_id", userId);
      log.push(`skills: ${error ? error.message : "ok"}`);
    }

    // 11. Delete chronicle entries
    {
      const { error } = await supabaseAdmin
        .from("chronicle_entries")
        .delete()
        .eq("user_id", userId);
      log.push(`chronicle_entries: ${error ? error.message : "ok"}`);
    }

    // 12. Delete chronicle places
    {
      const { error } = await supabaseAdmin
        .from("chronicle_places")
        .delete()
        .eq("user_id", userId);
      log.push(`chronicle_places: ${error ? error.message : "ok"}`);
    }

    // 13. Try optional tables (may not exist)
    for (const [table, col] of [
      ["projects", "user_id"],
      ["experiences", "user_id"],
      ["notes", "owner_id"],
      ["communications", "owner_id"],
      ["financial_transactions", "owner_id"],
      ["media_items", "user_id"],
      ["relationship_edges", "source_user_id"],
    ] as const) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(col, userId);
      log.push(`${table}: ${error ? error.message : "ok"}`);
    }

    // 14. Delete profile
    {
      const { error } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", userId);
      log.push(`profile: ${error ? error.message : "ok"}`);
    }

    // 15. Delete auth user
    {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      log.push(`auth user: ${error ? error.message : "ok"}`);
    }

    return NextResponse.json({ success: true, log });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg, log }, { status: 500 });
  }
}
