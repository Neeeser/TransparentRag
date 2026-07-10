import { apiFetch } from "@/lib/api/client";

import type { SetupBootstrapRequest, SetupBootstrapResponse, SetupStatus } from "@/lib/types";

export async function fetchSetupStatus(token: string): Promise<SetupStatus> {
  return apiFetch<SetupStatus>("/api/setup/status", { token });
}

export async function bootstrapSetup(
  token: string,
  payload: SetupBootstrapRequest,
): Promise<SetupBootstrapResponse> {
  return apiFetch<SetupBootstrapResponse>("/api/setup/bootstrap", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}
