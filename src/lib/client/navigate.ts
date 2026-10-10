/**
 * A full page load rather than a client-side transition. Used after anything
 * that changes *whose* data the server should render -- signing in or out,
 * switching or creating a household -- so the root layout (theme), the SWR
 * cache and every server component start fresh instead of showing a mix of
 * the old and new household.
 */
export function hardNavigate(path: string) {
  window.location.assign(path);
}
