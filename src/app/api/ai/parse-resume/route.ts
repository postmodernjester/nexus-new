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

    const systemPrompt = `You are an expert resume parser. Extract ALL structured work experience and education entries from the provided text.${nameHint}

CRITICAL: You MUST extract BOTH work experience AND education. Do NOT return an empty work array if there is any employment history in the text. LinkedIn copy-pastes are messy — work harder to find every role.

LINKEDIN COPY-PASTE GUIDE:
LinkedIn text is noisy. You'll see sections like Activity, About, Featured, Experience, Education, Skills, Recommendations, etc. all mashed together. Here's how to handle it:

1. EXPERIENCE SECTION: Look for job titles followed by company names, date ranges ("Jan 2020 - Present", "2018 - 2020", "3 yrs 2 mos"), and optional location/description. LinkedIn often formats as:
   - "Title\nCompany · Full-time\nDate range · Duration\nLocation"
   - Or: "Title at Company\nDate range"
   - Or: "Company\nTitle\nDates"
   - Sometimes roles under the same company are grouped: "Company\n4 yrs 6 mos\nTitle 1\nDate range\nTitle 2\nDate range"

2. IGNORE completely: endorsement counts ("99+"), "Show all X experiences", "People also viewed", "Activity" posts, skill assessments, connection counts, follower counts, "See credential", mutual connections, ads, recommended profiles.

3. MULTIPLE ROLES AT SAME COMPANY: LinkedIn groups them. Extract each role separately with the same company name.

4. SHORT/SPARSE DATA: If dates or descriptions are missing, still extract the entry with whatever is available. A job title + company with no dates is still a valid work entry.

RULES:
- Extract EVERY work position and education entry — err on the side of including too many rather than too few
- Dates: YYYY-MM-DD format. Month+year → 1st of month. Year only → January 1st.
- Current/Present roles: is_current=true, end_date=null
- engagement_type: full-time, part-time, contract, freelance, consulting, volunteer, internship, project-based, self-employed. Default "full-time".
- location_type: onsite, remote, hybrid. Omit if unknown.
- Preserve description text when available
- Deduplicate identical roles (common in LinkedIn paste)

Respond with ONLY valid JSON (no markdown fences, no commentary):
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

    // Pre-process LinkedIn text: dedup doubled lines, strip cruft
    let cleanedText = text;
    if (text) {
      // LinkedIn's copy-paste duplicates every line (accessibility text).
      // "TitleTitle" → "Title", "Oct 2023 - Present · 2 yrsOct 2023 to Present · 2 yrs" → "Oct 2023 - Present · 2 yrs"
      const dedup = (line: string): string => {
        if (line.length < 8) return line;
        const mid = Math.floor(line.length / 2);
        const norm = (s: string) => s.replace(/ to /g, " - ").replace(/\s+/g, " ").trim();
        for (const m of [mid, mid - 1, mid + 1, mid - 2, mid + 2]) {
          if (m < 3 || m >= line.length - 2) continue;
          const first = line.slice(0, m);
          const second = line.slice(m);
          if (first === second) return first;
          if (norm(first) === norm(second)) return first;
        }
        return line;
      };

      cleanedText = text
        .split("\n")
        .map((line: string) => {
          let t = line.trim();
          // Strip LinkedIn bullet markers (* )
          t = t.replace(/^\*\s*/, "");
          // Strip "…see more" suffix
          t = t.replace(/…see more$/i, "").trim();
          // Drop skill endorsement lines ("X, Y and +N skills")
          if (/and \+\d+ skills?$/i.test(t)) return "";
          // Deduplicate doubled text
          t = dedup(t);
          return t;
        })
        .filter((line: string) => line.length > 0)
        .join("\n")
        // Remove "Show all X ..." navigation links
        .replace(/Show all \d+ experiences?/gi, "")
        .replace(/Show all \d+ education/gi, "")
        .replace(/Show \d+ more experiences?/gi, "")
        // Remove endorsement counts like "99+" or "· 99+"
        .replace(/·?\s*\d+\+?\s*endorsements?/gi, "")
        // Remove "People also viewed" and everything after (usually at the bottom)
        .replace(/People also viewed[\s\S]*$/i, "")
        // Remove "More activity" / "Show all activity" blocks
        .replace(/Show all activity[\s\S]*?(?=Experience|Education|About|$)/i, "")
        // Remove connection/follower counts
        .replace(/\d+\+?\s*connections?/gi, "")
        .replace(/\d+\+?\s*followers?/gi, "")
        // Remove "See credential" links
        .replace(/See credential/gi, "")
        // Collapse excessive whitespace (3+ newlines → 2)
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

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
        text: `Parse the following resume/profile text and extract all work experience and education entries as structured JSON.\n\n---\n${cleanedText}\n---`,
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
