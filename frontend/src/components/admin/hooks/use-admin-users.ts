"use client";

import { useCallback, useState } from "react";

import { fetchAdminUsers, updateAdminUser } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useApiQuery } from "@/lib/use-api-query";
import { useAuth } from "@/providers/auth-provider";

import type { AdminUserUpdate } from "@/lib/types";

/** Owns the admin users list and role/active mutations with an error channel. */
export function useAdminUsers() {
  const { token } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const { data, loading, error, reload } = useApiQuery(
    () => fetchAdminUsers(token ?? ""),
    [token],
    { enabled: Boolean(token) },
  );

  const applyUpdate = useCallback(
    async (userId: string, patch: AdminUserUpdate) => {
      if (!token) return;
      setActionError(null);
      setPendingUserId(userId);
      try {
        await updateAdminUser(token, userId, patch);
        reload();
      } catch (err) {
        setActionError(getErrorMessage(err, "Failed to update user."));
      } finally {
        setPendingUserId(null);
      }
    },
    [token, reload],
  );

  return {
    users: data ?? [],
    loading,
    loadError: error,
    actionError,
    pendingUserId,
    applyUpdate,
  };
}
