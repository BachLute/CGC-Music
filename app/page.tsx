import Dashboard from "./components/Dashboard";
import SetupNotice from "./components/SetupNotice";
import { listVenues } from "@/lib/venues";
import type { Venue } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let venues: Venue[] = [];
  let dbError: string | null = null;

  try {
    venues = await listVenues();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Could not connect to the database.";
  }

  if (dbError) {
    return <SetupNotice error={dbError} />;
  }

  return <Dashboard initialVenues={venues} />;
}
