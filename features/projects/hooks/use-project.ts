import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProject, getProjectById, getProjects } from "../actions";

export type ActionError = {
  error: string;
};

function isActionError(value: unknown): value is ActionError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ActionError).error === "string"
  );
}

async function unwrapActionResult<T>(result: T | { error: string }): Promise<T> {
  if (isActionError(result)) {
    throw new Error(result.error);
  }

  return result;
}

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value: string) => unwrapActionResult(await createProject(value)),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};

export const useGetProjects = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => unwrapActionResult(await getProjects()),
    enabled: options?.enabled,
  });
};

export const useGetProject = useGetProjects;

export const useGetProjectById = (id: string) => {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => unwrapActionResult(await getProjectById(id)),
  });
};
