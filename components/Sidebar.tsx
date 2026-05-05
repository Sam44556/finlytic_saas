"use client"

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Wallet, 
  LayoutDashboard, 
  Receipt, 
  PiggyBank, 
  Target, 
  BarChart3, 
  Bot, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from 'next-intl';  // Import translation hook
import { LanguageSwitcher } from "@/components/LanguageSwitcher";  // Import language switcher
import { toast } from "sonner";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/transactions", key: "transactions", icon: Receipt },
  { href: "/budgets", key: "budgets", icon: PiggyBank },
  { href: "/goals", key: "goals", icon: Target },
  { href: "/reports", key: "reports", icon: BarChart3 },
  { href: "/assistant", key: "assistant", icon: Bot },
  { href: "/settings", key: "settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const t = useTranslations('nav');  // Load translations from 'nav' section
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Get current locale from pathname
  const locale = pathname.split('/')[1] || 'en';

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      router.push("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg border"
      >
        {mobileMenuOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-40
          transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <Link href={`/${locale}/dashboard`} className="flex items-center gap-3" onClick={closeMobileMenu}>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl">Finlytic</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const fullPath = `/${locale}${item.href}`;
              const isActive = pathname === fullPath;
              return (
                <Link
                  key={item.href}
                  href={fullPath}
                  onClick={closeMobileMenu}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all
                    ${
                      isActive
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/50'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{t(item.key)}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sign Out Button */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
            {/* Language Switcher */}
            <div className="px-4">
              <LanguageSwitcher />
            </div>
            
            <button
              onClick={() => {
                handleSignOut();
                closeMobileMenu();
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 w-full transition-all"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>{t('signOut')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Spacer for desktop */}
      <div className="hidden lg:block w-64 shrink-0" />
    </>
  );
}
