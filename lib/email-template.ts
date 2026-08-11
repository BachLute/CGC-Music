import type { Venue } from "./types";

export const SENDER_NAME = "Christopher Dunn";
export const SENDER_TITLE = "Classical Guitarist, Classical Guitar Ceremonies";

export interface EmailDraft {
  subject: string;
  body: string;
}

/** Deterministic mail-merge style draft — no LLM call, always available offline. */
export function draftEmail(venue: Venue): EmailDraft {
  const location = [venue.city, venue.state].filter(Boolean).join(", ");
  const locationClause = location ? ` in ${location}` : "";

  const subject = `Complimentary Trial Performance for ${venue.name}`;

  const body = `Hi ${venue.name} team,

My name is Christopher Dunn, and I'm a classical guitarist with Classical Guitar Ceremonies. I came across ${venue.name}${locationClause} and thought your guests might enjoy live classical guitar for ceremonies, receptions, or other events you host.

I'd love to offer a complimentary trial performance at ${venue.name} so you can hear the music firsthand and see how it fits your space, with no obligation. I can play a short set of classical, Spanish, and contemporary pieces suited to weddings and elegant gatherings.

Would you be open to a quick call or a short in-person session to discuss timing? I'm happy to work around your schedule.

Thank you for your time, and I hope to hear from you soon.

Warmly,
${SENDER_NAME}
${SENDER_TITLE}`;

  return { subject, body };
}
