"use client";

/**
 * src/app/verify/RedirectCountdown.tsx
 *
 * Thin client island — renders a live countdown and triggers router.push
 * after `seconds` elapses. Embedded in the otherwise-server-rendered verify page.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  seconds: number;
  href: string;
}

export default function RedirectCountdown({ seconds, href }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const router = useRouter();

  useEffect(() => {
    if (remaining <= 0) {
      router.push(href);
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, href, router]);

  return (
    <span>
      Redirecting to Sign In in{" "}
      <strong>{remaining}</strong>{" "}
      {remaining === 1 ? "second" : "seconds"}…
    </span>
  );
}
