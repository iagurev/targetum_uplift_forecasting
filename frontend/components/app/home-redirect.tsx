"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/app/providers/auth-provider";

export function HomeRedirect() {
  const router = useRouter();
  const { isReady, token } = useAuth();

  useEffect(() => {
    if (!isReady) {
      return;
    }
    router.replace(token ? "/dashboard" : "/login");
  }, [isReady, router, token]);

  return (
    <div className="pilot-loading-screen">
      <div className="pilot-loading-screen-stack">
        <div className="pilot-spinner pilot-spinner-lg" />
      </div>
    </div>
  );
}
