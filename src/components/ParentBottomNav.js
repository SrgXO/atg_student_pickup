"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  CirclePlus,
  Clock3,
  UserRound,
} from "lucide-react";

export default function ParentBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Home",
      href: "/parent",
      icon: House,
    },
    {
      label: "Pickup",
      href: "/parent/pickup",
      icon: CirclePlus,
    },
    {
      label: "Status",
      href: "/parent/status",
      icon: Clock3,
    },
    {
      label: "Profile",
      href: "/parent/profile",
      icon: UserRound,
    },
  ];

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm">
      <div className="grid grid-cols-4 rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-lg backdrop-blur"> 
        
        {navItems.map((item) => { 
          const Icon = item.icon;

          const isActive =
            item.href === "/parent"
              ? pathname === "/parent"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-medium transition ${
                isActive
                  ? "bg-black text-white"
                  : "text-gray-400 hover:bg-gray-50 hover:text-black"
              }`}
            >
              <Icon size={20} strokeWidth={1.8} />

              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}