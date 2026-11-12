import { Suspense } from "react";
import { onBoardUser } from "@/features/auth/actions";

export default function RootGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <Onboarding />
      </Suspense>
    </>
  );
}

async function Onboarding() {
  await onBoardUser();
  return null;
}
