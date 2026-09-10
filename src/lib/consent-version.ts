/**
 * Canonical consent version — single source of truth.
 *
 * Zero dependencies (no zod, no supabase) so it can be safely imported
 * from middleware.ts, layouts, schemas, and Server Actions without
 * dragging heavy modules into the middleware bundle.
 *
 * Increment when the consent text changes. Patients must re-accept
 * after a version bump for required purposes.
 *
 * @see W3 from code review Sprint 3
 * @see docs/talitha-data-architecture.md §consents
 */
export const CURRENT_CONSENT_VERSION = "1.0"
