"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Role = "patient" | "doctor" | "admin";

export function RequireAuth({
  allowedRoles,
  requireSuperAdmin = false,
  children,
}: {
  allowedRoles: Role[];
  requireSuperAdmin?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading, isLoggingOut } = useAuth();

  useEffect(() => {
    if (isLoading || isLoggingOut) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      router.replace("/");
      return;
    }

    if (requireSuperAdmin && !user.is_super_admin) {
      router.replace("/admin/payments");
    }
  }, [user, isLoading, isLoggingOut, allowedRoles, requireSuperAdmin, router]);

  if (
    isLoading ||
    isLoggingOut ||
    !user ||
    !allowedRoles.includes(user.role) ||
    (requireSuperAdmin && !user.is_super_admin)
  ) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <p className="text-sm text-ink-700/70">Memuat...</p>
      </div>
    );
  }

  return <>{children}</>;
}
