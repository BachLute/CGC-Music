export const VENUE_STATUSES = [
  "New",
  "Contacted",
  "Follow-up Needed",
  "Booked",
  "Passed",
  "Opted Out",
] as const;

export type VenueStatus = (typeof VENUE_STATUSES)[number];

export interface Venue {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  venue_type: string | null;
  capacity: number | null;
  notes: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: VenueStatus;
  date_added: string;
  date_last_contacted: string | null;
  source_profile_id: number | null;
  source_profile_name: string | null;
}

export interface SearchProfile {
  id: number;
  name: string;
  criteria: string;
  schedule: string;
  active: boolean;
  created_at: string;
  last_run_at: string | null;
}

export interface RunResult {
  queriesRun: number;
  found: number;
  inserted: number;
  duplicates: number;
  skippedInvalid: number;
}
