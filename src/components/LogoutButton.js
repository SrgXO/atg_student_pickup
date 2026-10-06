"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton({
  className = "",
  children = "Logout",
}) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={className}
    >
      {children}
    </button>
  );
}