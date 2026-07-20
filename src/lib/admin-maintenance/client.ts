import { supabase } from "@/lib/supabaseClient";

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  const token = data.session?.access_token;

  if (!token) {
    throw new Error("当前登录状态异常，请重新登录。");
  }

  return token;
}

async function maintenanceFetch(path: string, init?: RequestInit) {
  const token = await getAccessToken();

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "维护操作失败。");
  }

  return result;
}

export async function fetchMaintenanceOverview() {
  return maintenanceFetch("/api/admin/maintenance");
}

export async function createMaintenanceRequest(params: {
  actionType: string;
  targetType: string;
  targetId: string;
  targetName: string;
  note?: string;
  actionPayload?: Record<string, unknown>;
}) {
  return maintenanceFetch("/api/admin/maintenance", {
    method: "POST",
    body: JSON.stringify({
      action: "create_request",
      ...params,
    }),
  });
}

export async function approveMaintenanceRequest(requestId: string) {
  return maintenanceFetch("/api/admin/maintenance", {
    method: "POST",
    body: JSON.stringify({
      action: "approve_request",
      requestId,
    }),
  });
}

export async function cancelMaintenanceRequest(requestId: string) {
  return maintenanceFetch("/api/admin/maintenance", {
    method: "POST",
    body: JSON.stringify({
      action: "cancel_request",
      requestId,
    }),
  });
}