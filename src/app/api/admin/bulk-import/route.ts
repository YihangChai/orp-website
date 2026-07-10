import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildPreviewRows } from "@/lib/admin-import/buildPreviewRows";
import { validateImportRows } from "@/lib/admin-import/validateImportRows";
import type { ParsedImportRow } from "@/lib/admin-import/types";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) return null;

  if (!authorization.startsWith("Bearer ")) return null;

  return authorization.replace("Bearer ", "");
}

async function getCurrentAdminFromRequest(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("缺少登录凭证，请重新登录。");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase 环境变量缺失。");
  }

  const supabaseWithUserToken = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseWithUserToken.auth.getUser();

  if (userError || !user) {
    throw new Error("无法识别当前登录用户，请重新登录。");
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admins")
    .select("id, name, email, status")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError) {
    throw new Error(`检查管理员身份失败：${adminError.message}`);
  }

  if (!admin) {
    throw new Error("当前账号不是 active 管理员，不能执行批量导入。");
  }

  return admin;
}

export async function POST(request: Request) {
  try {
    const currentAdmin = await getCurrentAdminFromRequest(request);

    const body = await request.json();

    const parsedRows = (body.rows || []) as ParsedImportRow[];

    const previewRows = buildPreviewRows(parsedRows);

    const validationErrors = validateImportRows(previewRows);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          message: "导入数据存在格式问题。",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "API 已经收到导入数据。下一步会接入真正的账号创建逻辑。",
      requestedBy: currentAdmin.name,
      receivedRows: previewRows.length,
      preview: {
        classCount: new Set(
          previewRows.map(
            (row) => `${row.cohortName}__${row.className}__${row.school}`
          )
        ).size,
        teacherCount: new Set(previewRows.map((row) => row.teacherEmail)).size,
        studentCount: previewRows.length,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "批量导入失败。";

    return NextResponse.json(
      {
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}