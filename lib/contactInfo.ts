// Core contact-lookup logic: given a venue, find its official website (or
// use the one already on file), then scan its homepage plus any
// Contact/About/Staff pages it links to for a phone number and email.
//
// Pure lookup logic, no database access here — see `venueContactService.ts`
// for the DB-integrated helpers used by the API routes.

import * as cheerio from "cheerio";
import { searchWeb } from "./webSearch";

export interface VenueContactLookup {
  id: string | number;
  name: string;
  address?: string | null;
  website?: string | null;
}

export interface ContactInfoResult {
  phone: string | null;
  email: string | null;
  website: string | null;
  source: string | null; // URL where the phone/email were actually found
}

const AGGREGATOR_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "yelp.com",
  "weddingwire.com",
  "theknot.com",
  "google.com",
  "tripadvisor.com",
  "yellowpages.com",
  "bbb.org",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "pinterest.com",
  "youtube.com",
];

const CONTACT_LINK_PATTERN = /contact|about|staff|team|reach.?us|get.?in.?touch/i;

const PHONE_PATTERN = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const NON_EMAIL_TLDS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "css", "js"]);
const JUNK_EMAIL_DOMAINS = [
  "sentry.io",
  "wixpress.com",
  "godaddy.com",
  "cloudflare.com",
  "example.com",
  "wordpress.com",
  "schema.org",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAggregator(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return AGGREGATOR_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return true;
  }
}

function cleanEmails(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const match of raw) {
    const email = match.trim().toLowerCase();
    const tld = email.split(".").pop() ?? "";
    if (NON_EMAIL_TLDS.has(tld)) continue;
    if (JUNK_EMAIL_DOMAINS.some((d) => email.endsWith(`@${d}`) || email.includes(`.${d}`))) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }

  // Prefer a generic business inbox over a personal-looking one when several are found.
  const preferred = out.find((e) => /^(info|contact|events?|booking|hello|office)@/i.test(e));
  return preferred ? [preferred, ...out.filter((e) => e !== preferred)] : out;
}

function cleanPhones(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const match of raw) {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 10) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);
    out.push(match.trim());
  }

  return out;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VenueContactBot/1.0)" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function extractFromHtml(html: string): { phones: string[]; emails: string[] } {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const mailtoEmails = $('a[href^="mailto:"]')
    .map((_, el) => $(el).attr("href")?.replace(/^mailto:/i, "").split("?")[0] ?? "")
    .get()
    .filter(Boolean);

  const telPhones = $('a[href^="tel:"]')
    .map((_, el) => $(el).attr("href")?.replace(/^tel:/i, "") ?? "")
    .get()
    .filter(Boolean);

  const text = $("body").text();
  const textEmails = text.match(EMAIL_PATTERN) ?? [];
  const textPhones = text.match(PHONE_PATTERN) ?? [];

  return {
    phones: cleanPhones([...telPhones, ...textPhones]),
    emails: cleanEmails([...mailtoEmails, ...textEmails]),
  };
}

function findSubPageLinks($: ReturnType<typeof cheerio.load>, baseUrl: string): string[] {
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text();
    if (!href) return;
    if (!CONTACT_LINK_PATTERN.test(href) && !CONTACT_LINK_PATTERN.test(text)) return;

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname === new URL(baseUrl).hostname) {
        links.add(resolved.toString());
      }
    } catch {
      // Unparsable href (e.g. "javascript:void(0)") — ignore.
    }
  });

  return Array.from(links).slice(0, 3);
}

async function findOfficialWebsite(venue: VenueContactLookup): Promise<string | null> {
  if (venue.website) return venue.website;

  const query = `"${venue.name}" ${venue.address ?? ""} wedding venue official website`.trim();
  const results = await searchWeb(query, 5);
  const candidate = results.find((r) => !isAggregator(r.url));
  return candidate?.url ?? null;
}

/**
 * Looks up a venue's phone and email: finds its official website (or uses
 * the one already on file), then scans the homepage plus up to 3 linked
 * Contact/About/Staff pages for a phone number and email address.
 */
export async function findContactInfo(venue: VenueContactLookup): Promise<ContactInfoResult> {
  const website = await findOfficialWebsite(venue);
  if (!website) {
    return { phone: null, email: null, website: null, source: null };
  }

  const homepageHtml = await fetchHtml(website);
  if (!homepageHtml) {
    return { phone: null, email: null, website, source: null };
  }

  const pagesToCheck: { url: string; html: string }[] = [{ url: website, html: homepageHtml }];

  const $ = cheerio.load(homepageHtml);
  const subPageUrls = findSubPageLinks($, website);
  for (const url of subPageUrls) {
    await sleep(300); // be polite to the venue's server
    const html = await fetchHtml(url);
    if (html) pagesToCheck.push({ url, html });
  }

  let bestPhone: string | null = null;
  let bestEmail: string | null = null;
  let source: string | null = null;

  for (const page of pagesToCheck) {
    const { phones, emails } = extractFromHtml(page.html);
    if (!bestPhone && phones.length > 0) {
      bestPhone = phones[0];
      source = page.url;
    }
    if (!bestEmail && emails.length > 0) {
      bestEmail = emails[0];
      source = source ?? page.url;
    }
    if (bestPhone && bestEmail) break;
  }

  return { phone: bestPhone, email: bestEmail, website, source };
}
