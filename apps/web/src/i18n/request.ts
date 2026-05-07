import { getRequestConfig } from "next-intl/server";

export const locales = ["tr", "en", "de", "es", "fr", "it", "pt", "ar", "ru", "zh", "ja"];
export const defaultLocale = "tr";

export default getRequestConfig(async ({ locale }) => {
  const safeLocale: string = locales.includes(locale as string) ? (locale as string) : defaultLocale;
  const messages = (await import(`../../messages/${safeLocale}.json`)).default;
  return { messages, locale: safeLocale };
});
