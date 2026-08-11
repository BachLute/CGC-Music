import ProfilesManager from "../components/ProfilesManager";
import SetupNotice from "../components/SetupNotice";
import { listProfiles } from "@/lib/profiles";
import type { SearchProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  let profiles: SearchProfile[] = [];
  let dbError: string | null = null;

  try {
    profiles = await listProfiles();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Could not connect to the database.";
  }

  if (dbError) {
    return <SetupNotice error={dbError} />;
  }

  return <ProfilesManager initialProfiles={profiles} />;
}
