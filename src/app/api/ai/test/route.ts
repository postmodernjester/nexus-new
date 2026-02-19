import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: "No ANTHROPIC_API_KEY env var found" });
  }

  const keyPreview = apiKey.slice(0, 10) + "..." + apiKey.slice(-4);

  // Try multiple models to find one that works
  const models = [
    "claude-3-haiku-20240307",
    "claude-3-sonnet-20240229",
    "claude-3-opus-20240229",
    "claude-3-5-haiku-20241022",
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-20240620",
  ];

  const results: Record<string, number> = {};

  for (const model of models) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
      results[model] = response.status;
    } catch {
      results[model] = 0;
    }
  }

  return NextResponse.json({
    keyPreview,
    modelResults: results,
  });
}
