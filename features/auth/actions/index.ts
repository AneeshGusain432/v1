"use server";

import { prisma } from "@/lib/db";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function onBoardUser() {
  const { userId } = await auth();

  if (!userId) return;

  const clerkUser = await currentUser();

  if (!clerkUser) return;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;

  const name =
    clerkUser.fullName ??
    ([clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      null);

  await prisma.user.upsert({
    where: {
      clerkId: userId,
    },
    create: {
      clerkId: userId,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      name,
      imageUrl: clerkUser.imageUrl,
    },
    update: {
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      name,
      imageUrl: clerkUser.imageUrl,
    },
  });
}

export async function getCurrentUser() {
  try {
    const user = await currentUser();
    if (!user) {
      return null;
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        imageUrl: true,
        clerkId: true,
      },
    });

    return dbUser;
  } catch (error) {
    console.log("Error fetching current user:", error);
    return;
  }
}
