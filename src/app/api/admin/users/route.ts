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

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [authRes, profilesRes, contactsRes, connectionsRes, invitationsRes, notesRes, workRes] =
    await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id, full_name, is_public, profile_photo_url, avatar_url, created_at"),
      supabaseAdmin.from("contacts").select("id, owner_id"),
      supabaseAdmin.from("connections").select("inviter_id, invitee_id, status"),
      supabaseAdmin.from("link_invitations").select("from_user_id, to_user_id, status"),
      supabaseAdmin.from("contact_notes").select("id, owner_id"),
      supabaseAdmin.from("work_entries").select("id, user_id"),
    ]);

  const authUsers = authRes.data?.users || [];
  const profiles = profilesRes.data || [];
  const contacts = contactsRes.data || [];
  const connections = connectionsRes.data || [];
  const invitations = invitationsRes.data || [];
  const notes = notesRes.data || [];
  const workEntries = workRes.data || [];

  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

  const users = authUsers.map((u) => {
    const profile = profileMap.get(u.id) as any;
    const contactCount = contacts.filter((c: any) => c.owner_id === u.id).length;
    const noteCount = notes.filter((n: any) => n.owner_id === u.id).length;
    const workCount = workEntries.filter((w: any) => w.user_id === u.id).length;

    const linkedCount = connections.filter(
      (c: any) => c.status === "accepted" && (c.inviter_id === u.id || c.invitee_id === u.id)
    ).length;

    const pendingInvitesSent = invitations.filter(
      (i: any) => i.from_user_id === u.id && i.status === "pending"
    ).length;

    const pendingInvitesReceived = invitations.filter(
      (i: any) => i.to_user_id === u.id && i.status === "pending"
    ).length;

    return {
      id: u.id,
      email: u.email || "",
      fullName: profile?.full_name || "No profile",
      isPublic: profile?.is_public ?? false,
      hasProfile: !!profile,
      photo: profile?.profile_photo_url || profile?.avatar_url || null,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at || null,
      contactCount,
      noteCount,
      workCount,
      linkedCount,
      pendingInvitesSent,
      pendingInvitesReceived,
    };
  });

  users.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return NextResponse.json({ users, adminId: admin.id });
}
