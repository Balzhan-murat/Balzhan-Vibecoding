"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, Search, History, Settings, LogOut, BriefcaseIcon } from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/dashboard", label: "Поиск", icon: Search },
  { href: "/history", label: "История", icon: History },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-500 text-white flex flex-col">
        <div className="p-6 border-b border-brand-600">
          <div className="flex items-center gap-2">
            <BriefcaseIcon className="w-7 h-7 text-blue-300" />
            <div>
              <div className="font-bold text-sm">Виртуальный</div>
              <div className="font-bold text-sm">Рекрутер</div>
              <div className="text-xs text-blue-300 mt-0.5">QAZAQ-ASTYQ GROUP</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                pathname.startsWith(href)
                  ? "bg-white/20 text-white font-medium"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-brand-600">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-blue-200 hover:bg-white/10 hover:text-white transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
