"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Role = "patient" | "doctor" | "admin";

export function RequireAuth({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[];
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      router.replace("/");
    }
  }, [user, isLoading, allowedRoles, router]);

  if (isLoading || !user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <p className="text-sm text-ink-700/70">Memuat...</p>
      </div>
    );
  }

  return <>{children}</>;
}