import { NextResponse } from "next/server";

/**
 * POST /api/ai/parse-resume
 *
 * Accepts either plain text (e.g. copy-pasted from LinkedIn) or a base64 PDF,
 * and returns structured work + education entries extracted by Claude.
 *
 * Body: { text?: string, pdf_base64?: string, person_name?: string }
 * Returns: { work: ParsedWork[], education: ParsedEducation[] }
 */

export interface ParsedWork {
  title: string;
  company: string;
  location?: string;
  location_type?: string;
  engagement_type?: string;
  start_date?: string;       // YYYY-MM-DD
  end_date?: string | null;  // null = current
  is_current: boolean;
  description?: string;
}

export interface ParsedEducation {
  institution: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string | null;
  is_current: boolean;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, pdf_base64, person_name } = body;

    if (!text && !pdf_base64) {
      return NextResponse.json(
        { error: "Provide either text or pdf_base64" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const nameHint = person_name ? `\nThe person's name is: ${person_name}` : "";

    const systemPrompt = `You are an expert resume parser. Extract structured work experience and education entries from the provided resume text or document.${nameHint}

IMPORTANT RULES:
- Extract EVERY work position and education entry you can find
- For LinkedIn copy-paste: ignore navigation cruft, ads, "People also viewed", skill endorsements counts, etc. Focus on the actual experience and education sections.
- Dates should be in YYYY-MM-DD format. If only month+year given, use the 1st of the month (e.g., "Jan 2020" → "2020-01-01"). If only a year, use January 1st.
- If a role is listed as current or "Present", set is_current to true and end_date to null
- For engagement_type, use one of: full-time, part-time, contract, freelance, consulting, volunteer, internship, project-based, self-employed. Default to "full-time" if not specified.
- For location_type, use: onsite, remote, or hybrid. Omit if unknown.
- Preserve description text as-is when available (bullet points, paragraphs, etc.)
- Deduplicate: if the same role appears twice (common in LinkedIn paste), keep only one

Respond with ONLY valid JSON in this exact format (no markdown fences, no commentary):
{
  "work": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State" or null,
      "location_type": "onsite" or null,
      "engagement_type": "full-time",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD" or null,
      "is_current": false,
      "description": "Role description..." or null
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Bachelor of Science" or null,
      "field_of_study": "Computer Science" or null,
      "start_date": "YYYY-MM-DD" or null,
      "end_date": "YYYY-MM-DD" or null,
      "is_current": false
    }
  ]
}`;

    // Build the user message content
    const content: any[] = [];

    if (pdf_base64) {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdf_base64,
        },
      });
      content.push({
        type: "text",
        text: "Parse this resume PDF and extract all work experience and education entries as structured JSON.",
      });
    } else {
      content.push({
        type: "text",
        text: `Parse the following resume/profile text and extract all work experience and education entries as structured JSON.\n\n---\n${text}\n---`,
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content }],
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
    const raw =
      data.content && data.content[0] && data.content[0].type === "text"
        ? data.content[0].text
        : "";

    // Strip markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    let parsed: { work: ParsedWork[]; education: ParsedEducation[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response as JSON:", cleaned.slice(0, 500));
      return NextResponse.json(
        { error: "AI returned invalid JSON", raw: cleaned.slice(0, 1000) },
        { status: 500 }
      );
    }

    // Normalize
    if (!Array.isArray(parsed.work)) parsed.work = [];
    if (!Array.isArray(parsed.education)) parsed.education = [];

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Parse resume error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
