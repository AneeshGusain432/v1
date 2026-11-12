import React from 'react'
import { ProjectView } from '@/components/projects/project-view';
import { auth } from '@clerk/nextjs/server';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await auth.protect();
  const { id } = await params;

  return <ProjectView projectId={id} />;
}