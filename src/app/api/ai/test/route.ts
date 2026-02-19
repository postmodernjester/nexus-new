import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: "No ANTHROPIC_API_KEY env var found" });
  }

  const keyPreview = apiKey.slice(0, 10) + "..." + apiKey.slice(-4);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 50,
        messages: [{ role: "user", content: "Say hello in exactly 3 words." }],
      }),
    });

    const body = await response.text();

    return NextResponse.json({
      keyPreview,
      status: response.status,
      response: body,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      keyPreview,
      error: msg,
    });
  }
}
