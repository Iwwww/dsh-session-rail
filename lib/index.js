/**
 * Host half of `dsh-session-rail`.
 *
 * The feature is browser presentation only, so the host plane contributes
 * nothing: the Loader row exists to carry the package's `dsh.client`
 * declaration, and the browser bundle does the work.
 */

/** Host plugin body — nothing to contribute on the host plane. */
export function apply() {}
