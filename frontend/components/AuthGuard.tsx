"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";

// Wrap any page content with this to require login.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="p-8">
        <Spinner label="Checking your session..." />
      </div>
    );
  }

  return <>{children}</>;
}
