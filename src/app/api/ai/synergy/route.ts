import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { myProfile, mySkills, myWork, myEducation, contactInfo, contactWork, contactEducation, contactChronicle } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const prompt = `You are analyzing two professionals for a networking CRM to find synergies between them.

ME (the user):
${myProfile}

My skills & interests:
${mySkills || "None listed"}

My work history:
${myWork || "None listed"}

My education:
${myEducation || "None listed"}

THE CONNECTION (someone in my network):
${contactInfo}

Their work history:
${contactWork || "None listed"}

Their education:
${contactEducation || "None listed"}

Their projects/chronicle:
${contactChronicle || "None listed"}

Write exactly three short paragraphs. Each should be 2-4 sentences, conversational but substantive. Be specific — reference actual details from both profiles. Don't be generic.

PARAGRAPH 1 - HOW I COULD HELP THEM:
Based on my skills, experience, and interests, identify concrete ways I might be useful to this connection. Think about introductions I could make, expertise I could share, projects where my background would complement theirs, or industries/domains where I have knowledge they might need. Be specific.

PARAGRAPH 2 - HOW THEY MIGHT HELP ME:
Based on their background, identify what they could offer me. Think about their industry knowledge, network access, skills I lack, mentorship potential, or career/project opportunities their position enables. Be specific.

PARAGRAPH 3 - COMMON GROUND FOR CONVERSATION:
Look for non-obvious shared experiences or interests — not just direct overlaps. Consider: geographic proximity (same city/region at overlapping times even if different schools/companies), generational similarities (similar age = similar cultural touchpoints), adjacent industries that share vocabulary, parallel career arcs, shared hobbies or interests that might not be immediately obvious. Be creative but grounded in the data. If there's very little overlap, say so honestly and suggest the one or two things they might bond over.

Respond in this exact format:
HELP_THEM: [paragraph]
HELP_ME: [paragraph]
COMMON_GROUND: [paragraph]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 800,
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

    const helpThemMatch = text.match(/HELP_THEM:\s*([\s\S]*?)(?=HELP_ME:|$)/i);
    const helpMeMatch = text.match(/HELP_ME:\s*([\s\S]*?)(?=COMMON_GROUND:|$)/i);
    const commonMatch = text.match(/COMMON_GROUND:\s*([\s\S]*?)$/i);

    const helpThem = helpThemMatch ? helpThemMatch[1].trim() : "";
    const helpMe = helpMeMatch ? helpMeMatch[1].trim() : "";
    const commonGround = commonMatch ? commonMatch[1].trim() : "";

    return NextResponse.json({ helpThem, helpMe, commonGround });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("AI synergy error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
