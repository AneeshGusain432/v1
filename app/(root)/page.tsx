import { Navbar } from "@/components/home/navbar";
import { HomeBackground } from "@/components/home/home-background";

import { PromptInput } from "@/components/home/prompt-input";
import { ProjectGrid } from "@/features/projects/components/project-grid";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <HomeBackground />
      <Navbar />
      <main className="flex flex-1 flex-col items-center px-4 pb-16 pt-28">
        <div className="flex w-full max-w-3xl flex-col items-center gap-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            What do you want to create?
          </h1>
          <PromptInput />
        </div>

        <div className="mt-16 w-full max-w-5xl">
          <ProjectGrid />
        </div>
      </main>
    </div>
  );
}
