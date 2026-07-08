"use client";

import { useState } from "react";

import { useAdminUsers } from "@/components/admin/hooks/use-admin-users";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { GlassCard } from "@/components/ui/panel";
import { useAuth } from "@/providers/auth-provider";

import type { AdminUser } from "@/lib/types";

type PendingAction =
  | { kind: "role"; user: AdminUser; nextRole: "admin" | "user" }
  | { kind: "active"; user: AdminUser; nextActive: boolean };

const LAST_ADMIN_HINT = "The last active admin cannot be demoted or deactivated.";

/** Admin-only user list with role and activation management. */
export function AdminUsersPage() {
  const { user: viewer } = useAuth();
  const { users, loading, loadError, actionError, pendingUserId, applyUpdate } = useAdminUsers();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Mirror of the API's invariant (AdminUserService rejects it with a 400):
  // disable the destructive buttons up front instead of letting the click fail.
  const activeAdminCount = users.filter((row) => row.role === "admin" && row.is_active).length;
  const isLastActiveAdmin = (row: AdminUser) =>
    row.role === "admin" && row.is_active && activeAdminCount <= 1;

  const confirmAction = async () => {
    if (!pendingAction) return;
    const patch =
      pendingAction.kind === "role"
        ? { role: pendingAction.nextRole }
        : { is_active: pendingAction.nextActive };
    await applyUpdate(pendingAction.user.id, patch);
    setPendingAction(null);
  };

  const confirmTitle = pendingAction
    ? pendingAction.kind === "role"
      ? `Change ${pendingAction.user.email} to ${pendingAction.nextRole}?`
      : pendingAction.nextActive
        ? `Reactivate ${pendingAction.user.email}?`
        : `Deactivate ${pendingAction.user.email}?`
    : "";
  const confirmDescription = pendingAction
    ? pendingAction.user.id === viewer?.id
      ? "You are changing your own account."
      : "The change takes effect immediately."
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Users</h1>
        <p className="text-sm text-slate-400">
          Manage roles and access. The last remaining admin cannot be demoted or deactivated.
        </p>
      </div>
      {(loadError || actionError) && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {loadError || actionError}
        </p>
      )}
      <GlassCard>
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-400">Loading users…</p>
        ) : (
          <DataTable
            rows={users}
            rowKey={(row) => row.id}
            emptyMessage="No users yet."
            columns={[
              {
                key: "email",
                header: "User",
                render: (row) => (
                  <div>
                    <p className="font-medium text-white">{row.full_name || row.email}</p>
                    <p className="text-xs text-slate-400">{row.email}</p>
                  </div>
                ),
              },
              {
                key: "role",
                header: "Role",
                render: (row) => (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium capitalize text-slate-200">
                    {row.role}
                  </span>
                ),
              },
              {
                key: "is_active",
                header: "Status",
                render: (row) => (row.is_active ? "Active" : "Deactivated"),
              },
              { key: "collection_count", header: "Collections" },
              { key: "document_count", header: "Documents" },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <div
                    className="flex gap-2"
                    title={isLastActiveAdmin(row) ? LAST_ADMIN_HINT : undefined}
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isLastActiveAdmin(row)}
                      loading={pendingUserId === row.id}
                      onClick={() =>
                        setPendingAction({
                          kind: "role",
                          user: row,
                          nextRole: row.role === "admin" ? "user" : "admin",
                        })
                      }
                    >
                      {row.role === "admin" ? "Demote to user" : "Make admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isLastActiveAdmin(row)}
                      loading={pendingUserId === row.id}
                      onClick={() =>
                        setPendingAction({ kind: "active", user: row, nextActive: !row.is_active })
                      }
                    >
                      {row.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </GlassCard>
      <ConfirmDialog
        open={pendingAction !== null}
        title={confirmTitle}
        description={confirmDescription}
        loading={pendingAction ? pendingUserId === pendingAction.user.id : false}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
