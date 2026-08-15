import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * next-intl request config — SCAFFOLDING ONLY, not active yet.
 *
 * Per the next-intl App Router setup docs, this file is meant to be picked
 * up automatically by the `createNextIntlPlugin()` wrapper in
 * `next.config.ts` (via its default path, `./i18n/request.ts`). That plugin
 * wrapper has NOT been added yet, and there is no `app/[locale]/` segment
 * or `middleware.ts` for `requestLocale` to resolve from — so today this
 * module is inert: nothing imports or calls it.
 *
 * Activating it is a dedicated follow-up, out of scope here, that should
 * NOT run concurrently with other page-editing work since it touches every
 * route file:
 *   1. Move all routes from `app/*` to `app/[locale]/*`.
 *   2. Add root `middleware.ts` via `createMiddleware(routing)` from
 *      "next-intl/middleware".
 *   3. Wrap `next.config.ts` with `createNextIntlPlugin()` from
 *      "next-intl/plugin" pointing at this file.
 *   4. Update `app/layout.tsx` to accept `params: { locale }`, call
 *      `setRequestLocale`/`NextIntlClientProvider`, and read messages via
 *      `getMessages()`.
 *   5. Add translated catalogs alongside `frontend/messages/en.json` for
 *      each additional `routing.locales` entry.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as (typeof routing.locales)[number])
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
