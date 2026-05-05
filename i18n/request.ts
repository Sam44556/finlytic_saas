import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({locale}) => {
  // Ensure locale has a fallback
  const validLocale = locale || 'en';
  
  console.log('i18n/request.ts - Received locale:', locale);
  console.log('i18n/request.ts - Using locale:', validLocale);
  
  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default
  };
});
