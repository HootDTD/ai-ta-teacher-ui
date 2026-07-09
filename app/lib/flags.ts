// NEXT_PUBLIC_APOLLO_ONLY=1 pins this deployment to the Apollo pilot surface:
// the Hoot-specific console sections (AI Tuning = retrieval weights, Reports =
// AI-use reports) are hidden, since the student deployment has Hoot Q&A off
// (backend HOOT_QA_ENABLED=0). Materials, Concepts, Problem Sets, and Invites
// stay — they feed Apollo provisioning. Build-time inlined (NEXT_PUBLIC_*), so
// the flag is per Railway service (pilot prod = on, staging = off).
export const APOLLO_ONLY = ['1', 'true', 'yes', 'on'].includes(
  (process.env.NEXT_PUBLIC_APOLLO_ONLY ?? '').trim().toLowerCase(),
);
