"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { connectDirectly } from "@/lib/connections";
import Link from "next/link";

type ConnectState =
  | "loading"
  | "not-found"
  | "self"
  | "not-logged-in"
  | "already-connected"
  | "connecting"
  | "connected"
  | "error";

export default function ConnectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const targetUserId = params.userId as string;
  const contactId = searchParams.get("contact"); // optional: sender's existing contact card

  const [state, setState] = useState<ConnectState>("loading");
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    handleConnect();
  }, [targetUserId]);

  async function handleConnect() {
    setState("loading");

    // 1. Fetch target user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, headline, bio")
      .eq("id", targetUserId)
      .single();

    if (profileError || !profile) {
      setState("not-found");
      return;
    }
    setTargetProfile(profile);

    // 2. Check if logged in
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setState("not-logged-in");
      return;
    }

    // 3. Self-check
    if (user.id === targetUserId) {
      setState("self");
      return;
    }

    // 4. Check if already connected
    const { data: existingConnection } = await supabase
      .from("connections")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(inviter_id.eq.${targetUserId},invitee_id.eq.${user.id}),and(inviter_id.eq.${user.id},invitee_id.eq.${targetUserId})`
      )
      .limit(1)
      .single();

    if (existingConnection) {
      setState("already-connected");
      return;
    }

    // 5. Connect using contact-aware bidirectional linking
    setState("connecting");

    const result = await connectDirectly(user.id, targetUserId, contactId);

    if (result.success) {
      setState("connected");
    } else {
      setErrorMsg(result.error || "Failed to connect");
      setState("error");
    }
  }

  // --- RENDER ---

  if (state === "loading" || state === "connecting") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "16px",
          }}
        >
          <svg
            style={{ animation: "spin 1s linear infinite", width: 20, height: 20 }}
            viewBox="0 0 24 24"
          >
            <circle
              opacity="0.25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              opacity="0.75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {state === "connecting" ? "Connecting…" : "Loading…"}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (state === "not-found") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            width: "100%",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔍</div>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#fff",
              marginBottom: "8px",
            }}
          >
            User not found
          </h2>
          <p style={{ color: "#94a3b8", marginBottom: "24px" }}>
            This invite link doesn't match any user.
          </p>
          <Link
            href="/"
            style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}
          >
            Go to NEXUS
          </Link>
        </div>
      </div>
    );
  }

  const ProfileCard = () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginBottom: "24px",
      }}
    >
      {targetProfile?.avatar_url ? (
        <img
          src={targetProfile.avatar_url}
          alt=""
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "#a78bfa22",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#a78bfa",
            fontSize: "24px",
            fontWeight: "bold",
          }}
        >
          {targetProfile?.full_name?.charAt(0) || "?"}
        </div>
      )}
      <div>
        <h3
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "#fff",
            margin: 0,
          }}
        >
          {targetProfile?.full_name}
        </h3>
        {targetProfile?.headline && (
          <p
            style={{
              color: "#94a3b8",
              fontSize: "14px",
              margin: "4px 0 0 0",
            }}
          >
            {targetProfile.headline}
          </p>
        )}
      </div>
    </div>
  );

  if (state === "not-logged-in") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            width: "100%",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🤝</div>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#fff",
              marginBottom: "16px",
            }}
          >
            Connect on NEXUS
          </h2>
          <ProfileCard />
          <p style={{ color: "#94a3b8", marginBottom: "24px" }}>
            <span style={{ color: "#fff", fontWeight: 500 }}>
              {targetProfile?.full_name}
            </span>{" "}
            wants to connect with you on NEXUS.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <Link
              href={`/signup?connect=${targetUserId}${contactId ? `&contact=${contactId}` : ''}`}
              style={{
                display: "block",
                padding: "12px",
                background: "#a78bfa",
                color: "#0f172a",
                fontWeight: 600,
                borderRadius: "8px",
                textDecoration: "none",
                textAlign: "center",
                fontSize: "15px",
              }}
            >
              Create Account & Connect
            </Link>
            <Link
              href={`/login?next=/connect/${targetUserId}${contactId ? `?contact=${contactId}` : ''}`}
              style={{
                display: "block",
                padding: "12px",
                background: "#0f172a",
                color: "#e2e8f0",
                fontWeight: 600,
                borderRadius: "8px",
                textDecoration: "none",
                textAlign: "center",
                fontSize: "15px",
                border: "1px solid #334155",
              }}
            >
              Sign In & Connect
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === "self") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            width: "100%",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🪞</div>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#fff",
              marginBottom: "8px",
            }}
          >
            That's you!
          </h2>
          <p style={{ color: "#94a3b8", marginBottom: "24px" }}>
            You can't connect with yourself. Share this link with others to
            connect.
          </p>
          <Link
            href="/dashboard"
            style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (state === "already-connected") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            width: "100%",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>✅</div>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#fff",
              marginBottom: "8px",
            }}
          >
            Already connected
          </h2>
          <ProfileCard />
          <p style={{ color: "#94a3b8", marginBottom: "24px" }}>
            You and{" "}
            <span style={{ color: "#fff", fontWeight: 500 }}>
              {targetProfile?.full_name}
            </span>{" "}
            are already connected on NEXUS.
          </p>
          <Link
            href="/dashboard"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "#a78bfa",
              color: "#0f172a",
              fontWeight: 600,
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (state === "connected") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            width: "100%",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "16px",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🎉</div>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#fff",
              marginBottom: "16px",
            }}
          >
            Connected!
          </h2>
          <ProfileCard />
          <p style={{ color: "#94a3b8", marginBottom: "24px" }}>
            You and{" "}
            <span style={{ color: "#fff", fontWeight: 500 }}>
              {targetProfile?.full_name}
            </span>{" "}
            are now connected on NEXUS. You can see each other's networks.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <Link
              href="/network"
              style={{
                display: "block",
                padding: "12px",
                background: "#a78bfa",
                color: "#0f172a",
                fontWeight: 600,
                borderRadius: "8px",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              View Network
            </Link>
            <Link
              href="/dashboard"
              style={{
                display: "block",
                padding: "12px",
                background: "#0f172a",
                color: "#e2e8f0",
                fontWeight: 600,
                borderRadius: "8px",
                textDecoration: "none",
                textAlign: "center",
                border: "1px solid #334155",
              }}
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: "400px",
          width: "100%",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "16px",
          padding: "32px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            color: "#fff",
            marginBottom: "8px",
          }}
        >
          Something went wrong
        </h2>
        <p style={{ color: "#94a3b8", marginBottom: "24px" }}>{errorMsg}</p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <button
            onClick={() => handleConnect()}
            style={{
              padding: "12px",
              background: "#a78bfa",
              color: "#0f172a",
              fontWeight: 600,
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "15px",
            }}
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            style={{
              display: "block",
              padding: "12px",
              color: "#94a3b8",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
