"use client"

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wallet, LayoutDashboard, Receipt, Wallet2, Target, BarChart3, Bot, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/budgets", label: "Budgets", icon: Wallet2 },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      router.push("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Wallet className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Finlytic</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </nav>
  );
}
