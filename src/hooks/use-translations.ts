import { useTranslations as useNextIntlTranslations } from 'next-intl';

export function useAppTranslations(namespace?: string) {
  return useNextIntlTranslations(namespace);
}

export { useTranslations } from 'next-intl';