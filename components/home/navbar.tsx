"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "../ui/mode-toggle";

export function Navbar() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="pointer-events-auto flex h-12 w-full max-w-3xl items-center justify-between rounded-full border border-border/50 bg-background/70 px-4 shadow-sm backdrop-blur-xl supports-backdrop-filter:bg-background/50">
        <Link href="/" className="flex items-center">
          {/* logo */}
          <h2 className="font-semibold text-lg">v1</h2>
        </Link>
        <div className="flex items-center gap-3">
          <ModeToggle />
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton>
              <Button size="sm" className="rounded-full">
                Sign in
              </Button>
            </SignInButton>
          </Show>
        </div>
      </nav>
    </header>
  );
}
