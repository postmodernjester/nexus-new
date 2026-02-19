import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contactInfo, notes, urls } = body;

    // Fetch URL contents in parallel
    const urlContents: string[] = [];
    if (urls && urls.length > 0) {
      const fetches = urls.slice(0, 5).map(async (url: string) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; NexusCRM/1.0; +https://nexus.app)",
            },
          });
          clearTimeout(timeout);
          if (!res.ok) return `[${url}: failed to fetch]`;
          const html = await res.text();
          // Strip HTML tags, keep text
          const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 3000);
          return `[Content from ${url}]:\n${text}`;
        } catch {
          return `[${url}: could not be retrieved]`;
        }
      });
      const results = await Promise.all(fetches);
      urlContents.push(...results);
    }

    const urlSection =
      urlContents.length > 0
        ? `\n\nWeb content retrieved from links:\n${urlContents.join("\n\n")}`
        : "";

    const prompt = `You are writing a professional dossier entry about a person for a private networking CRM. Your audience is the CRM owner — a professional who wants a concise, useful summary of who this person is.

Write 3-5 sentences in a measured, academic tone. Be factual and specific. Include:
- Their current role, organization, and field of work
- Notable career history, achievements, or expertise if available
- Any relevant context about how the CRM owner knows them
- Key professional details that would be useful for networking

Do not use flowery or promotional language. Do not speculate. Do not use phrases like "is a visionary" or "passionate about." Just state facts clearly. If information is sparse, say what you can and keep it short.

Contact information from CRM:
${contactInfo}

Notes and research entries:
${notes || "(No notes entered yet)"}${urlSection}

Write the dossier summary:`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ summary: text.trim() });
  } catch (error: any) {
    console.error("AI summarize error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate summary" },
      { status: 500 }
    );
  }
}
