"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { parseImportText } from "@/lib/admin-import/parseImportText";
import { buildPreviewRows } from "@/lib/admin-import/buildPreviewRows";
import { validateImportRows } from "@/lib/admin-import/validateImportRows";
import type { PreviewImportRow } from "@/lib/admin-import/types";
import { supabase } from "@/lib/supabaseClient";

const sampleText = `届别	班级名称	合作学校	小老师姓名	学生名单	学生年级
2026暑期	秋叶班	河北某小学	Ethan	小明、小红、小刚	四年级
2026暑期	小溪班	河北某小学	Mario	小亮、小雨	五年级`;

export default function AdminImportPage() {
  return (
    <AdminGuard>
      <AdminImportContent />
    </AdminGuard>
  );
}

function AdminImportContent() {
  const [importText, setImportText] = useState("");
  const [hasParsed, setHasParsed] = useState(false);
  const [message, setMessage] = useState("");

  const parsedRows = useMemo(() => {
    if (!hasParsed) return [];
    return parseImportText(importText);
  }, [hasParsed, importText]);

  const rows = useMemo(() => {
    return buildPreviewRows(parsedRows);
  }, [parsedRows]);

  const errors = useMemo(() => {
    if (!hasParsed) return [];
    return validateImportRows(rows);
  }, [hasParsed, rows]);

  const classCount = useMemo(() => {
    const classKeys = new Set(
      rows
        .filter((row) => row.cohortName && row.className && row.school)
        .map((row) => `${row.cohortName}__${row.className}__${row.school}`)
    );

    return classKeys.size;
  }, [rows]);

  const teacherCount = useMemo(() => {
    const teacherKeys = new Set(
      rows
        .filter((row) => row.teacherEmail)
        .map((row) => row.teacherEmail)
    );

    return teacherKeys.size;
  }, [rows]);

  const studentCount = useMemo(() => {
    return rows.filter((row) => row.studentName).length;
  }, [rows]);

  const canConfirmImport =
    hasParsed &&
    rows.length > 0 &&
    errors.length === 0 &&
    importText.trim().length > 0;

  function handleUseSample() {
    setImportText(sampleText);
    setHasParsed(false);
    setMessage("");
  }

  function handleClear() {
    setImportText("");
    setHasParsed(false);
    setMessage("");
  }

  function handlePreview() {
    setHasParsed(true);
    setMessage("");
  }

    async function handleConfirmImport() {
    if (!canConfirmImport) {
        setMessage("请先完成预览并修正格式问题。");
        return;
    }

    const confirmed = window.confirm(
        `确认提交导入测试吗？\n\n当前预计导入：\n班级 ${classCount} 个\n小老师 ${teacherCount} 位\n学生 ${studentCount} 名\n\n这一版暂时不会真正创建账号，只测试 API 通道。`
    );

    if (!confirmed) return;

    setMessage("");

    try {
        const {
        data: { session },
        error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
        setMessage("当前登录状态异常，请重新登录。");
        return;
        }

        const response = await fetch("/api/admin/bulk-import", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            rows: parsedRows,
        }),
        });

        const data = await response.json();

        if (!response.ok) {
        throw new Error(data.message || "导入请求失败。");
        }

        setMessage(
        `API 测试成功：服务器已收到 ${data.receivedRows} 行数据。调用管理员：${data.requestedBy}。`
        );
    } catch (error) {
        const errorMessage =
        error instanceof Error ? error.message : "导入请求失败。";

        setMessage(errorMessage);
    }
    }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              批量导入账号与班级
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              这里用于一次性创建届别、班级、老师账号、学生账号，并自动绑定老师和学生到对应班级。管理员只需要粘贴基础名单，系统会根据姓名自动生成登录账号。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/classes"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回班级管理
            </Link>

            <Link
              href="/admin"
              className="w-fit rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
            >
              返回管理员主页
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        )}

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-7">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-2xl font-bold text-emerald-950">
                粘贴导入表
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                从 Excel 或 Google Sheets 复制表格后粘贴到这里。推荐列顺序：
                <span className="font-semibold text-emerald-800">
                  {" "}
                  届别、班级名称、合作学校、小老师姓名、学生姓名、学生年级
                </span>
                。系统会自动根据老师和学生姓名生成邮箱前缀、学生用户名和登录邮箱。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUseSample}
                className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
              >
                使用示例
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                清空
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl bg-[#fffdf4] p-4 text-sm leading-7 text-stone-600">
              <p className="font-semibold text-emerald-900">示例格式：</p>

              <p className="mt-2 overflow-x-auto whitespace-pre text-xs leading-6">
                {sampleText}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm leading-7 text-stone-600">
              <p className="font-semibold text-emerald-900">自动生成规则</p>

              <div className="mt-2 space-y-2">
                <p>
                  小老师姓名 → 拼音 → 学校邮箱，例如：
                  <span className="font-semibold text-emerald-800">
                    {" "}
                    张三 → zhangsan@学校邮箱后缀
                  </span>
                </p>

                <p>
                  学生姓名 → 拼音用户名 → ORP 内部登录邮箱，例如：
                  <span className="font-semibold text-emerald-800">
                    {" "}
                    小明 → xiaoming / xiaoming@orp.local
                  </span>
                </p>

                <p>
                  如果出现重名导致账号重复，系统会在预览阶段提示错误，正式导入前必须处理。
                </p>
              </div>
            </div>
          </div>

          <textarea
            value={importText}
            onChange={(event) => {
              setImportText(event.target.value);
              setHasParsed(false);
              setMessage("");
            }}
            rows={12}
            placeholder="从 Excel 或 Google Sheets 复制导入表，然后粘贴到这里。"
            className="mt-5 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 font-mono text-sm leading-7 outline-none transition focus:border-emerald-500 focus:bg-white"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePreview}
              className="rounded-full bg-[#2f5d50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              预览
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!canConfirmImport}
              className="rounded-full border border-emerald-700 px-6 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              确认导入
            </button>
          </div>
        </section>

        {hasParsed && (
          <ImportPreviewSection
            rows={rows}
            errors={errors}
            classCount={classCount}
            teacherCount={teacherCount}
            studentCount={studentCount}
          />
        )}
      </section>
    </main>
  );
}

type ImportPreviewSectionProps = {
  rows: PreviewImportRow[];
  errors: {
    rowNumber: number;
    field: string;
    message: string;
  }[];
  classCount: number;
  teacherCount: number;
  studentCount: number;
};

function ImportPreviewSection({
  rows,
  errors,
  classCount,
  teacherCount,
  studentCount,
}: ImportPreviewSectionProps) {
  return (
    <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-bold text-emerald-950">导入预览</h2>

          <p className="mt-2 text-sm leading-7 text-stone-600">
            这里展示系统解析后的名单，以及自动生成的登录账号。正式导入前，请先确认账号是否正确，尤其注意重名学生和重名老师。
          </p>
        </div>

        {errors.length === 0 && rows.length > 0 && (
          <span className="w-fit rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            格式检查通过
          </span>
        )}
      </div>

      {errors.length > 0 && (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">
            发现 {errors.length} 个格式问题
          </p>

          <div className="mt-3 space-y-2">
            {errors.map((error, index) => (
              <p key={index} className="text-sm text-red-700">
                第 {error.rowNumber} 行：{error.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
          没有解析出可导入的数据。请检查是否已经粘贴表格内容。
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#fffdf4] p-4">
              <p className="text-sm text-stone-500">预计班级数量</p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {classCount}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fffdf4] p-4">
              <p className="text-sm text-stone-500">预计小老师数量</p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {teacherCount}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fffdf4] p-4">
              <p className="text-sm text-stone-500">预计学生数量</p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {studentCount}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-emerald-100">
            <table className="w-full min-w-[1200px] border-collapse bg-white text-left text-sm">
              <thead className="bg-[#fffdf4] text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">行号</th>
                  <th className="px-4 py-3 font-semibold">届别</th>
                  <th className="px-4 py-3 font-semibold">班级</th>
                  <th className="px-4 py-3 font-semibold">学校</th>
                  <th className="px-4 py-3 font-semibold">小老师</th>
                  <th className="px-4 py-3 font-semibold">老师邮箱</th>
                  <th className="px-4 py-3 font-semibold">学生</th>
                  <th className="px-4 py-3 font-semibold">年级</th>
                  <th className="px-4 py-3 font-semibold">学生用户名</th>
                  <th className="px-4 py-3 font-semibold">学生登录邮箱</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.rowNumber}-${row.studentName}-${row.studentUsername}`}
                    className="border-t border-emerald-50"
                  >
                    <td className="px-4 py-3 text-stone-500">
                      {row.rowNumber}
                    </td>

                    <td className="px-4 py-3 text-stone-700">
                      {row.cohortName || "-"}
                    </td>

                    <td className="px-4 py-3 font-semibold text-emerald-950">
                      {row.className || "-"}
                    </td>

                    <td className="px-4 py-3 text-stone-700">
                      {row.school || "-"}
                    </td>

                    <td className="px-4 py-3 text-stone-700">
                      {row.teacherName || "-"}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-stone-700">
                      {row.teacherEmail || "-"}
                    </td>

                    <td className="px-4 py-3 text-stone-700">
                      {row.studentName || "-"}
                    </td>

                    <td className="px-4 py-3 text-stone-700">
                      {row.studentGrade || "-"}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-stone-700">
                      {row.studentUsername || "-"}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-stone-700">
                      {row.studentAuthEmail || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}