import { postJson } from "./fetcher";
import { setPreferredMemberId } from "./member-preference";
import { hardNavigate } from "./navigate";

/**
 * Clears everything this browser holds for the signed-in household: the
 * session, the remembered "who's using this device" member, and the service
 * worker's cached pages -- otherwise the next person to use a shared device
 * could see the previous household's dashboard while offline.
 */
export async function clearLocalHouseholdState() {
  setPreferredMemberId(null);
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Cache Storage unavailable -- nothing to clear.
  }
}

export async function signOut() {
  await postJson("/api/auth/logout", {}).catch(() => undefined);
  await clearLocalHouseholdState();
  hardNavigate("/login");
}
