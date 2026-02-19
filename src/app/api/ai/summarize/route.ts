import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contactInfo, notes, urls } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

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
          if (!res.ok) return `[${url}: failed to fetch, status ${res.status}]`;
          const html = await res.text();
          const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 4000);
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
        ? `\n\nSource material from linked pages:\n${urlContents.join("\n\n")}`
        : "";

    const prompt = `You are writing two things about a person for a networking CRM, based ONLY on the linked source material below.

TASK 1 - FULL SUMMARY:
Write 3-5 sentences in a measured, academic tone. Be factual and specific. Include age/DOB and location if found. State their current role, organization, industry, career highlights. No promotional language. No speculation.

TASK 2 - ONE-LINER:
Write a single short phrase (under 15 words) that captures what this person does in a descriptive, slightly expanded way. Not just their job title — explain what they actually do. Examples:
- "Veteran entertainment attorney specializing in talent deals"
- "Serial tech founder building AI tools for healthcare"
- "Award-winning documentary filmmaker and media executive"
- "Investment banker focused on mid-market M&A transactions"

Contact context:
${contactInfo}
${urlSection}

${urlContents.length === 0 ? "No source URLs provided. Use only the contact fields above." : ""}

Respond in this exact format:
SUMMARY: [your 3-5 sentence summary]
ONELINER: [your one-line description]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", response.status, errBody);
      return NextResponse.json(
        { error: "Anthropic API error " + response.status + ": " + errBody },
        { status: 500 }
      );
    }

    const data = await response.json();
    const text =
      data.content && data.content[0] && data.content[0].type === "text"
        ? data.content[0].text
        : "";

    // Parse SUMMARY and ONELINER
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=ONELINER:|$)/i);
    const onelinerMatch = text.match(/ONELINER:\s*(.*)/i);

    const summary = summaryMatch ? summaryMatch[1].trim() : text.trim();
    const oneliner = onelinerMatch ? onelinerMatch[1].trim() : "";

    return NextResponse.json({ summary, oneliner });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("AI summarize error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
