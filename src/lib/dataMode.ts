/**
 * Without a backend URL the app runs in demo mode: API requests are answered by an in-browser
 * backend (lib/demoBackend) that keeps its data in localStorage and starts out with example
 * projects, so a static deploy (e.g. Netlify) works on its own.
 */
export const DEMO_MODE = !import.meta.env.VITE_API_BASE_URL

export const DEMO_EMAIL = 'sandeep.gowda@movingwalls.com'
export const DEMO_PASSWORD = 'griha1234'
