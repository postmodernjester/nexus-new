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

  const { userId, email } = await req.json();
  if (!userId || !email) {
    return NextResponse.json({ error: "userId and email required" }, { status: 400 });
  }

  // Update auth email
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { email }
  );
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Also update profiles.email if the column exists
  await supabaseAdmin
    .from("profiles")
    .update({ email })
    .eq("id", userId);

  return NextResponse.json({ success: true });
}
