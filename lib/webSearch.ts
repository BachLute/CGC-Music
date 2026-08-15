// Generic web search helper used to find a venue's official website.
//
// ASSUMPTION: this implements search via the Google Custom Search JSON API,
// since it's the simplest to wire up with just two env vars. If your app's
// existing venue-discovery flow already has its own search helper, DELETE
// this file and point the import in `lib/contactInfo.ts` at that one
// instead — it just needs to expose a function with this same shape:
// `searchWeb(query: string, count?: number) => Promise<WebSearchResult[]>`.

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function searchWeb(query: string, count = 5): Promise<WebSearchResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !engineId) {
    throw new Error(
      "GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_ENGINE_ID are not set. See README.md."
    );
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", engineId);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(count, 10)));

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    items?: { title: string; link: string; snippet: string }[];
  };

  return (data.items ?? []).map((item) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet,
  }));
}
