import { getRequestConfig } from 'next-intl/server';
import { Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) as Locale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'UTC',
    now: new Date()
  };
});