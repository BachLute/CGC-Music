import Anthropic from "@anthropic-ai/sdk";
import { createVenue, findVenueByNameCity } from "./venues";
import { getProfile, updateProfile } from "./profiles";
import type { RunResult } from "./types";
import { enrichVenueContact } from "./enrichVenueContact";

const MODEL = "claude-opus-5";
const MAX_RESUMES = 3;

const SYSTEM_PROMPT = `You are a research assistant helping a classical guitarist (Classical Guitar Ceremonies) find music and entertainment venues to pitch for paid performances — wedding venues, hotels, restaurants, wineries, event spaces, churches, country clubs, retirement/senior living communities, and similar places that host live music.

You will be given a search profile's free-text criteria describing what kind of venues to find (e.g. a region, venue type, or other qualifiers).

IMPORTANT — coverage strategy: Do NOT run a single broad search. Break the criteria into several narrower searches — for example per city, county, neighborhood, or venue sub-type implied by the criteria — and run at least 4 to 10 distinct web searches covering different sub-areas or categories before compiling your answer. This finds meaningfully more venues than one broad query.

For each candidate venue, only include it if you are reasonably confident it is a real, currently operating venue that plausibly hosts live music or events. Do not invent or guess contact details — if a phone, email, or website isn't verifiable from search results, omit that field (use null) rather than fabricating it. Public email addresses are uncommon for venues; only include one if you actually found it published.

When you are completely done researching, respond with ONLY a single fenced code block like:
\`\`\`json
[
  {
    "name": "Venue Name",
    "city": "City",
    "state": "ST",
    "venue_type": "Wedding venue",
    "capacity": 150,
    "phone": "555-555-5555",
    "email": null,
    "website": "https://example.com",
    "notes": "Short note on why this venue fits, e.g. hosts outdoor ceremonies."
  }
]
\`\`\`
Output no other text before or after the code block. If you find no qualifying venues, output an empty array \`[]\` in the same fenced format.`;

interface RawVenue {
  name?: unknown;
  city?: unknown;
  state?: unknown;
  venue_type?: unknown;
  capacity?: unknown;
  phone?: unknown;
  email?: unknown;
  website?: unknown;
  notes?: unknown;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}

function collectText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export async function runSearchProfile(profileId: number): Promise<RunResult> {
  const profile = await getProfile(profileId);
  if (!profile) throw new Error("Search profile not found");
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable must be set to run a search.");
  }

  // No explicit timeout override — the SDK's default (10 min) comfortably fits
  // inside the route's maxDuration, and streaming avoids the "large max_tokens
  // without streaming" guard entirely.
  const client = new Anthropic();

  const userMessage = `Search profile name: ${profile.name}\n\nCriteria:\n${profile.criteria}`;
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  const requestParams = {
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 20 }],
  };

  let response = await client.messages
    .stream({ ...requestParams, messages })
    .finalMessage();

  let resumes = 0;
  let searchToolUses = 0;
  for (const block of response.content) {
    if (block.type === "server_tool_use" && block.name === "web_search") searchToolUses++;
  }

  while (response.stop_reason === "pause_turn" && resumes < MAX_RESUMES) {
    messages = [
      { role: "user", content: userMessage },
      { role: "assistant", content: response.content },
    ];
    response = await client.messages.stream({ ...requestParams, messages }).finalMessage();
    resumes++;
    for (const block of response.content) {
      if (block.type === "server_tool_use" && block.name === "web_search") searchToolUses++;
    }
  }

  if (response.stop_reason === "refusal") {
    throw new Error("The search request was declined. Try narrowing or rephrasing the criteria.");
  }

  const text = collectText(response.content);
  let parsed: unknown;
  try {
    parsed = extractJson(text);
  } catch {
    throw new Error("Could not parse venue results from the search response.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Search response was not a JSON array of venues.");
  }

  const result: RunResult = {
    queriesRun: searchToolUses,
    found: parsed.length,
    inserted: 0,
    duplicates: 0,
    skippedInvalid: 0,
  };

  for (const raw of parsed as RawVenue[]) {
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) {
      result.skippedInvalid++;
      continue;
    }
    const city = typeof raw.city === "string" && raw.city.trim() ? raw.city.trim() : null;

    const exists = await findVenueByNameCity(name, city);
    if (exists) {
      result.duplicates++;
      continue;
    }

      const candidate = {
        name,
        city,
        state: typeof raw.state === "string" && raw.state.trim() ? raw.state.trim() : null,
        venue_type:
          typeof raw.venue_type === "string" && raw.venue_type.trim() ? raw.venue_type.trim() : null,
        capacity: typeof raw.capacity === "number" ? Math.round(raw.capacity) : null,
        phone: typeof raw.phone === "string" && raw.phone.trim() ? raw.phone.trim() : null,
        email: typeof raw.email === "string" && raw.email.trim() ? raw.email.trim() : null,
        website: typeof raw.website === "string" && raw.website.trim() ? raw.website.trim() : null,
        notes: typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null,
      };

      const enriched = await enrichVenueContact(candidate);

      await createVenue({
        ...enriched,
        status: "New",
        source_profile_id: profile.id,
        source_profile_name: profile.name,
      });
      result.inserted++;
  }

  await updateProfile(profile.id, { last_run_at: new Date().toISOString() });

  return result;
}
