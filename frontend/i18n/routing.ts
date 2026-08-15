import { defineRouting } from "next-intl/routing";

/**
 * next-intl routing config — SCAFFOLDING ONLY.
 *
 * This is not wired into the app yet. The app currently has no `[locale]`
 * route segment, no `middleware.ts`, and `next.config.ts` is not wrapped
 * with `createNextIntlPlugin`, so nothing reads this file at request time
 * today.
 *
 * It exists so that a later, dedicated migration (moving every route under
 * `app/[locale]/`, adding `middleware.ts`, wrapping `next.config.ts`, and
 * updating `app/layout.tsx` to accept `params.locale` and render
 * `NextIntlClientProvider`) has the locale list and defaults already
 * decided, instead of re-deriving them mid-migration.
 *
 * See `frontend/i18n/request.ts` for how this feeds the request config, and
 * `frontend/messages/en.json` for the message catalog it points at.
 *
 * Add more locales here as translated catalogs (`frontend/messages/<locale>.json`)
 * are added.
 */
export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
});

export type AppLocale = (typeof routing.locales)[number];
