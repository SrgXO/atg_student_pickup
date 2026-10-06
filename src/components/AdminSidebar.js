"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="min-h-screen w-64 shrink-0 bg-black p-6 text-white">
      <h1 className="text-2xl font-bold">
        ATG
      </h1>

      <p className="mt-1 text-sm text-gray-400">
        Admin Console
      </p>

      <nav className="mt-8 space-y-3">
        <NavLink
          href="/admin"
          label="Dashboard"
          pathname={pathname}
        />

        <NavLink
          href="/admin/queue"
          label="Queue Monitor"
          pathname={pathname}
        />

        <NavLink
          href="/admin/duty"
          label="Duty Schedule"
          pathname={pathname}
        />

        <NavLink
          href="/admin/logs"
          label="Pickup Logs"
          pathname={pathname}
        />

        <NavLink
          href="/admin/users"
          label="User Management"
          pathname={pathname}
        />
        <LogoutButton className="w-full rounded-lg border border-gray-700 px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-900 hover:text-white">
            Logout
          </LogoutButton>

        
      </nav>
    </aside>
  );
}

function NavLink({
  href,
  label,
  pathname,
}) {
  const active =
    href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`block rounded-lg px-4 py-3 text-sm ${
        active
          ? "bg-white text-black"
          : "text-gray-300 hover:bg-gray-800"
      }`}
    >
      {label}
    </Link>
  );
}