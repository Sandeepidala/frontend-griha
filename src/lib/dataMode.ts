/**
 * Without a backend URL the app runs in demo mode: API requests are answered by an in-browser
 * backend (lib/demoBackend) that keeps its data in localStorage and starts out with example
 * projects, so a static deploy (e.g. Netlify) works on its own.
 */
export const DEMO_MODE = !import.meta.env.VITE_API_BASE_URL

/**
 * Google/Facebook/Apple, SSO, phone OTP and password reset are simulated in the browser. The backend
 * has no endpoints for them yet, so they're only offered in demo mode, where the demo backend backs them.
 */
export const SIMULATED_AUTH_AVAILABLE = DEMO_MODE

/** Seeded on the real backend too (backend/scripts/seed_demo.py), so the sign-in hint shows in every mode. */
export const DEMO_EMAIL = 'sandeep.gowda@movingwalls.com'
export const DEMO_PASSWORD = 'griha1234'
