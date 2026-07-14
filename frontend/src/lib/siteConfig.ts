/**
 * URL for “Book a demo” CTAs sitewide.
 * Paste your Calendly / HubSpot / etc. link below, or set VITE_DEMO_BOOKING_URL.
 */
const DEMO_BOOKING_URL_FALLBACK = '';

export const DEMO_BOOKING_URL =
  (import.meta.env.VITE_DEMO_BOOKING_URL as string | undefined)?.trim() ||
  DEMO_BOOKING_URL_FALLBACK;
