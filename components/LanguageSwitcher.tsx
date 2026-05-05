'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  
  // Get current locale from URL
  // pathname = "/en/dashboard" → currentLocale = "en"
  const currentLocale = pathname.split('/')[1];
  
  console.log('Current pathname:', pathname);
  console.log('Current locale:', currentLocale);
  
  const switchLanguage = () => {
    // Toggle between en and am
    const newLocale = currentLocale === 'en' ? 'am' : 'en';
    
    // Replace locale in URL
    // "/en/dashboard" → "/am/dashboard"
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    
    console.log('Switching to:', newLocale);
    console.log('New path:', newPath);
    
    // Navigate to new URL with refresh
    router.push(newPath);
    router.refresh();
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={switchLanguage}
      className="gap-2"
    >
      <Languages className="h-4 w-4" />
      {currentLocale === 'en' ? 'አማርኛ' : 'English'}
    </Button>
  );
}
