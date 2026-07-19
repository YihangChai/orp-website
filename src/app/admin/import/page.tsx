"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { parseImportText } from "@/lib/admin-import/parseImportText";
import { buildPreviewRows } from "@/lib/admin-import/buildPreviewRows";
import { validateImportRows } from "@/lib/admin-import/validateImportRows";
import type {
  BulkImportResult,
  BulkImportReuseCandidate,
  ImportValidationError,
  PreviewImportRow,
  SubjectCode,
} from "@/lib/admin-import/types";

const sampleText = `届别	班级名称	合作学校	学科	小老师姓名	小老师邮箱后缀	学生名单	学生年级
2025-2026	秋叶班	河北某小学	英语	柴一航	24	小明、小红、小刚	四年级
2025-2026	小溪班	河北某小学	数学	薛喆天	24	小亮、小雨	五年级`;

function safeText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * 数据库存 english/math，页面统一显示中文。
 */
function getSubjectLabel(subject: string | null | undefined) {
  if (subject === "english") return "英语";
  if (subject === "math") return "数学";
  return "未设置";
}

function getSubjectBadgeClass(subject: string | null | undefined) {
  if (subject === "english") {
    return "bg-sky-50 text-sky-700";
  }

  if (subject === "math") {
    return "bg-violet-50 text-violet-700";
  }

  return "bg-stone-100 text-stone-600";
}

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
  const [importResult, setImportResult] = useState<BulkImportResult | null>(
    null
  );
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);

  const [reuseCandidates, setReuseCandidates] = useState<
    BulkImportReuseCandidate[]
  >([]);

  const importResultRef = useRef<HTMLDivElement | null>(null);

  const parseError = useMemo(() => {
    if (!hasParsed) return "";

    try {
      parseImportText(importText);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "解析导入文本失败。";
    }
  }, [hasParsed, importText]);

  const parsedRows = useMemo(() => {
    if (!hasParsed || parseError) return [];

    try {
      return parseImportText(importText);
    } catch {
      return [];
    }
  }, [hasParsed, parseError, importText]);

  const rows = useMemo(() => {
    return buildPreviewRows(parsedRows);
  }, [parsedRows]);

  const errors = useMemo(() => {
    if (!hasParsed || parseError) return [];

    try {
      return validateImportRows(rows);
    } catch (error) {
      return [
        {
          rowNumber: 0,
          field: "unknown",
          message: error instanceof Error ? error.message : "格式检查失败。",
        },
      ] as ImportValidationError[];
    }
  }, [hasParsed, parseError, rows]);

  const classCount = useMemo(() => {
    const classKeys = new Set(
      rows
        .filter(
          (row) =>
            safeText(row.cohortName) &&
            safeText(row.className) &&
            safeText(row.school)
        )
        .map(
          (row) =>
            `${safeText(row.cohortName)}__${safeText(
              row.className
            )}__${safeText(row.school)}`
        )
    );

    return classKeys.size;
  }, [rows]);

  const teacherCount = useMemo(() => {
    const teacherKeys = new Set(
      rows
        .map((row) => safeText(row.teacherEmail).toLowerCase())
        .filter(Boolean)
    );

    return teacherKeys.size;
  }, [rows]);

  const uniqueStudentCount = useMemo(() => {
    const studentKeys = new Set<string>();

    rows.forEach((row) => {
      row.studentNames.forEach((studentName) => {
        const normalizedName = safeText(studentName);

        if (normalizedName) {
          studentKeys.add(normalizedName);
        }
      });
    });

    return studentKeys.size;
  }, [rows]);

  const studentSeatCount = useMemo(() => {
    return rows.reduce((sum, row) => sum + row.studentNames.length, 0);
  }, [rows]);

  const cohortNames = useMemo(() => {
    return Array.from(
      new Set(rows.map((row) => safeText(row.cohortName)).filter(Boolean))
    );
  }, [rows]);

  const subjectNames = useMemo(() => {
    return Array.from(
      new Set(rows.map((row) => getSubjectLabel(row.subject)).filter(Boolean))
    );
  }, [rows]);

  const canConfirmImport =
    hasParsed &&
    rows.length > 0 &&
    errors.length === 0 &&
    !parseError &&
    importText.trim().length > 0;

  function resetImportState() {
    setMessage("");
    setImportResult(null);
    setReuseCandidates([]);
    setIsPreviewOpen(true);
  }

  function handleUseSample() {
    setImportText(sampleText);
    setHasParsed(false);
    resetImportState();
  }

  function handleClear() {
    setImportText("");
    setHasParsed(false);
    resetImportState();
  }

  function handlePreview() {
    setHasParsed(true);
    resetImportState();
  }

  async function submitBulkImport(allowReuseArchived: boolean) {
    setIsImporting(true);
    setMessage("");
    setImportResult(null);

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
          rows,
          allowReuseArchived,
        }),
      });

      const data = await response.json();

      if (response.status === 409 && data.requiresReuseConfirmation) {
        setReuseCandidates(data.reuseCandidates || []);
        setMessage(
          data.message ||
            "系统发现已封存账号。请确认是否复用并恢复这些账号。"
        );
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || "导入请求失败。");
      }

      setReuseCandidates([]);
      setImportResult(data.result);

      setMessage(
        `导入完成：创建班级 ${data.result.createdClasses} 个，创建小老师 ${data.result.createdTeachers} 个，创建学生 ${data.result.createdStudents} 个，恢复账号 ${data.result.restoredAccounts || 0} 个，失败 ${data.result.failed} 条。请立即复制或下载新账号初始密码清单。`
      );

      setTimeout(() => {
        importResultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "导入请求失败。";

      setMessage(errorMessage);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleConfirmImport() {
    if (!canConfirmImport) {
      setMessage("请先完成预览并修正格式问题。");
      return;
    }

    const confirmed = window.confirm(
      `确认正式导入吗？\n\n当前预计导入：\n班级 ${classCount} 个\n学科 ${subjectNames.join("、") || "未设置"}\n小老师 ${teacherCount} 位\n不重复学生 ${uniqueStudentCount} 名\n班级学生席位 ${studentSeatCount} 个\n\n创建班级属于正常开班流程，不需要多管理员确认。\n系统会直接创建新账号、生成初始密码，并绑定班级关系。如果发现已封存账号，系统会先要求你确认是否复用。`
    );

    if (!confirmed) return;

    setReuseCandidates([]);
    await submitBulkImport(false);
  }

  async function handleConfirmReuseArchivedAccounts() {
    if (reuseCandidates.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `确认复用并恢复这 ${reuseCandidates.length} 个已封存账号吗？\n\n请确认这些账号确实是继续参加 ORP 的原成员，而不是重名或账号规则错误。`
    );

    if (!confirmed) return;

    await submitBulkImport(true);
  }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-[#2f5d50]">
              Admin / 批量导入
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              批量导入账号与班级
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              这里用于正常开班导入。管理员粘贴分班文本后，先预览真实班级、小老师和学生名单；确认无误后直接创建届别、班级、老师账号、学生账号和绑定关系。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/classes"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回班级查询
            </Link>

            <Link
              href="/admin"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
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
                  届别、班级名称、合作学校、学科、小老师姓名、小老师邮箱后缀、学生名单、学生年级
                </span>
                。学科请填写“英语”或“数学”。系统存储时会保存为 english / math，页面显示为中文。
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
                  学科会写入班级和老师：
                  <span className="font-semibold text-emerald-800">
                    {" "}
                    英语 → english，数学 → math
                  </span>
                  。学生不单独存学科，学生学科由所在班级推导。
                </p>

                <p>
                  小老师姓名 + 邮箱后缀 → 拼音 + 后缀 → 学校邮箱。
                  <span className="font-semibold text-emerald-800">
                    {" "}
                    柴一航 + 24 → chaiyihang24@shphschool.com
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
                  如果系统发现 archived 账号，会先进入复用确认。后续可在封存账号回顾界面继续查看这些账号的处理记录。
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
              setImportResult(null);
              setReuseCandidates([]);
            }}
            rows={12}
            placeholder="从 Excel 或 Google Sheets 复制导入表，然后粘贴到这里。"
            className="mt-5 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 font-mono text-sm leading-7 outline-none transition focus:border-emerald-500 focus:bg-white"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isImporting}
              className="rounded-full bg-[#2f5d50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              预览
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!canConfirmImport || isImporting}
              className="rounded-full border border-emerald-700 px-6 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? "正在导入..." : "确认导入并直接创建"}
            </button>
          </div>
        </section>

        {hasParsed && (
          <ImportPreviewSection
            rows={rows}
            errors={errors}
            parseError={parseError}
            classCount={classCount}
            teacherCount={teacherCount}
            uniqueStudentCount={uniqueStudentCount}
            studentSeatCount={studentSeatCount}
            cohortNames={cohortNames}
            subjectNames={subjectNames}
            isPreviewOpen={isPreviewOpen}
            onTogglePreview={() => setIsPreviewOpen((prev) => !prev)}
          />
        )}

        {reuseCandidates.length > 0 && (
          <ArchivedReuseConfirmationPanel
            candidates={reuseCandidates}
            onConfirm={handleConfirmReuseArchivedAccounts}
            isImporting={isImporting}
          />
        )}

        {importResult && (
          <div ref={importResultRef} id="import-result">
            <ImportResultPanel result={importResult} />
          </div>
        )}
      </section>
    </main>
  );
}

type ImportPreviewSectionProps = {
  rows: PreviewImportRow[];
  errors: ImportValidationError[];
  parseError: string;
  classCount: number;
  teacherCount: number;
  uniqueStudentCount: number;
  studentSeatCount: number;
  cohortNames: string[];
  subjectNames: string[];
  isPreviewOpen: boolean;
  onTogglePreview: () => void;
};

function ImportPreviewSection({
  rows,
  errors,
  parseError,
  classCount,
  teacherCount,
  uniqueStudentCount,
  studentSeatCount,
  cohortNames,
  subjectNames,
  isPreviewOpen,
  onTogglePreview,
}: ImportPreviewSectionProps) {
  return (
    <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-bold text-emerald-950">导入预览</h2>

          <p className="mt-2 text-sm leading-7 text-stone-600">
            这里展示系统解析后的真实班级、学科、小老师、学生名单和自动生成账号。正式导入前，请逐行确认，尤其注意学科、重名学生、重名老师和班级名。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {errors.length === 0 && !parseError && rows.length > 0 && (
            <span className="w-fit rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              格式检查通过
            </span>
          )}

          <button
            type="button"
            onClick={onTogglePreview}
            className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            {isPreviewOpen ? "收起预览" : "展开预览"}
          </button>
        </div>
      </div>

      {parseError && (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">解析失败</p>

          <p className="mt-2 text-sm text-red-700">{parseError}</p>
        </div>
      )}

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
          <div className="mt-5 grid gap-3 sm:grid-cols-6">
            <div className="rounded-2xl bg-[#fffdf4] p-4">
              <p className="text-sm text-stone-500">届别</p>

              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {cohortNames.length}
              </p>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                {cohortNames.join("、")}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fffdf4] p-4">
              <p className="text-sm text-stone-500">学科</p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {subjectNames.length}
              </p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                {subjectNames.join("、")}
              </p>
            </div>

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
              <p className="text-sm text-stone-500">不重复学生数量</p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {uniqueStudentCount}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fffdf4] p-4">
              <p className="text-sm text-stone-500">班级学生席位</p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {studentSeatCount}
              </p>
            </div>
          </div>

          {!isPreviewOpen ? (
            <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
              预览已收起。当前将导入 {classCount} 个班级，{teacherCount}{" "}
              位小老师，{uniqueStudentCount} 位不重复学生。
            </p>
          ) : (
            <div className="mt-5 max-h-[560px] overflow-auto rounded-2xl border border-emerald-100">
              <table className="w-full min-w-[1400px] border-collapse bg-white text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#fffdf4] text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">行号</th>
                    <th className="px-4 py-3 font-semibold">届别</th>
                    <th className="px-4 py-3 font-semibold">班级</th>
                    <th className="px-4 py-3 font-semibold">学校</th>
                    <th className="px-4 py-3 font-semibold">学科</th>
                    <th className="px-4 py-3 font-semibold">小老师</th>
                    <th className="px-4 py-3 font-semibold">邮箱后缀</th>
                    <th className="px-4 py-3 font-semibold">老师邮箱</th>
                    <th className="px-4 py-3 font-semibold">学生名单</th>
                    <th className="px-4 py-3 font-semibold">人数</th>
                    <th className="px-4 py-3 font-semibold">年级</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.rowNumber}-${row.className}-${row.teacherName}`}
                      className="border-t border-emerald-50"
                    >
                      <td className="px-4 py-3 align-top text-stone-500">
                        {row.rowNumber}
                      </td>

                      <td className="px-4 py-3 align-top text-stone-700">
                        {row.cohortName || "-"}
                      </td>

                      <td className="px-4 py-3 align-top font-semibold text-emerald-950">
                        {row.className || "-"}
                      </td>

                      <td className="px-4 py-3 align-top text-stone-700">
                        {row.school || "-"}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getSubjectBadgeClass(
                            row.subject
                          )}`}
                        >
                          {getSubjectLabel(row.subject)}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top text-stone-700">
                        {row.teacherName || "-"}
                      </td>

                      <td className="px-4 py-3 align-top text-stone-700">
                        {row.teacherEnteringYear || "-"}
                      </td>

                      <td className="px-4 py-3 align-top font-mono text-xs text-stone-700">
                        {row.teacherEmail || "-"}
                      </td>

                      <td className="px-4 py-3 align-top text-stone-700">
                        <div className="flex flex-wrap gap-2">
                          {row.studentNames.length > 0 ? (
                            row.studentNames.map((studentName, index) => (
                              <span
                                key={`${row.rowNumber}-${studentName}-${index}`}
                                className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                              >
                                {studentName}
                              </span>
                            ))
                          ) : (
                            <span className="text-red-700">暂无学生</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top font-semibold text-stone-700">
                        {row.studentNames.length}
                      </td>

                      <td className="px-4 py-3 align-top text-stone-700">
                        {row.studentGrade || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
            <p className="font-bold">导入确认规则</p>

            <p className="mt-1">
              点击确认导入后，系统会直接创建届别、班级、老师账号、学生账号和班级绑定关系。创建属于正常开班流程，不需要多管理员确认。后续修改、移除、删除/封存、整届封存、密码重置才进入维护中心审批。
            </p>
          </div>
        </>
      )}
    </section>
  );
}

type ArchivedReuseConfirmationPanelProps = {
  candidates: BulkImportReuseCandidate[];
  onConfirm: () => void;
  isImporting: boolean;
};

function ArchivedReuseConfirmationPanel({
  candidates,
  onConfirm,
  isImporting,
}: ArchivedReuseConfirmationPanelProps) {
  return (
    <section className="mt-6 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 shadow-sm md:p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-bold text-amber-950">
            发现已封存账号，需要确认是否复用
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-7 text-amber-800">
            系统发现导入名单中有账号以前已经存在，但当前状态是 archived。
            如果这些人是继续参加 ORP 的原成员，可以复用原账号并恢复为 active；
            如果是重名或账号规则错误，请不要确认，先回到导入表修改。这里的数据也为后续“封存账号回顾界面”预留。
          </p>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isImporting}
          className="w-fit rounded-full bg-amber-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isImporting ? "正在恢复并导入..." : "确认复用并恢复账号"}
        </button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-amber-100 bg-white">
        <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
          <thead className="bg-[#fffdf4] text-stone-600">
            <tr>
              <th className="px-4 py-3 font-semibold">行号</th>
              <th className="px-4 py-3 font-semibold">角色</th>
              <th className="px-4 py-3 font-semibold">姓名</th>
              <th className="px-4 py-3 font-semibold">登录账号</th>
              <th className="px-4 py-3 font-semibold">学科</th>
              <th className="px-4 py-3 font-semibold">当前状态</th>
              <th className="px-4 py-3 font-semibold">将绑定到班级</th>
              <th className="px-4 py-3 font-semibold">说明</th>
            </tr>
          </thead>

          <tbody>
            {candidates.map((candidate, index) => (
              <tr
                key={`${candidate.role}-${candidate.loginAccount}-${index}`}
                className="border-t border-amber-50"
              >
                <td className="px-4 py-3 text-stone-500">
                  {candidate.rowNumber}
                </td>

                <td className="px-4 py-3 text-stone-700">
                  {candidate.role === "teacher" ? "小老师" : "学生"}
                </td>

                <td className="px-4 py-3 font-semibold text-emerald-950">
                  {candidate.name}
                </td>

                <td className="px-4 py-3 font-mono text-xs text-stone-700">
                  {candidate.loginAccount}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getSubjectBadgeClass(
                      candidate.subject
                    )}`}
                  >
                    {getSubjectLabel(candidate.subject)}
                  </span>
                </td>

                <td className="px-4 py-3 text-amber-800">
                  {candidate.currentStatus}
                </td>

                <td className="px-4 py-3 text-stone-700">
                  {candidate.className}
                </td>

                <td className="px-4 py-3 text-stone-600">
                  {candidate.reason}
                  {candidate.needsManualReview && (
                    <span className="ml-2 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                      建议人工复核
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ImportResultPanelProps = {
  result: BulkImportResult;
};

function ImportResultPanel({ result }: ImportResultPanelProps) {
  const createdAccounts = result.accounts.filter(
    (account) => account.status === "created"
  );

  const existingAccounts = result.accounts.filter(
    (account) => account.status === "existing"
  );

  const restoredAccounts = result.accounts.filter(
    (account) => account.status === "restored"
  );

  const failedAccounts = result.accounts.filter(
    (account) => account.status === "failed"
  );

  function buildAccountText() {
    const lines = [
      "ORP 新账号初始密码清单",
      "说明：初始密码只在创建账号时显示一次，请妥善保存。",
      "",
      "角色\t姓名\t登录账号\t初始密码\t班级\t学科",
      ...createdAccounts.map((account) =>
        [
          account.role === "teacher" ? "小老师" : "学生",
          account.name,
          account.loginAccount,
          account.initialPassword,
          account.className,
          getSubjectLabel(account.subject),
        ].join("\t")
      ),
    ];

    return lines.join("\n");
  }

  async function handleCopyAccounts() {
    if (createdAccounts.length === 0) {
      alert("本次没有新创建账号，因此没有可复制的初始密码。");
      return;
    }

    try {
      await navigator.clipboard.writeText(buildAccountText());
      alert("账号清单已复制。请粘贴到安全的位置保存。");
    } catch {
      alert("复制失败。请手动选中表格内容复制。");
    }
  }

  function handleDownloadAccounts() {
    if (createdAccounts.length === 0) {
      alert("本次没有新创建账号，因此没有可下载的初始密码。");
      return;
    }

    const content = buildAccountText();
    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const timestamp = new Date()
      .toISOString()
      .replaceAll(":", "-")
      .replaceAll(".", "-");

    link.href = url;
    link.download = `orp-accounts-${timestamp}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function ImportStatsBox() {
    return (
      <div className="mt-5 rounded-2xl border border-amber-100 bg-white p-4">
        <p className="text-sm font-bold text-amber-900">本次导入统计</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-6">
          <div className="rounded-2xl bg-[#fffdf4] p-4">
            <p className="text-sm text-stone-500">创建班级</p>
            <p className="mt-1 text-3xl font-bold text-emerald-950">
              {result.createdClasses}
            </p>
          </div>

          <div className="rounded-2xl bg-[#fffdf4] p-4">
            <p className="text-sm text-stone-500">创建小老师</p>
            <p className="mt-1 text-3xl font-bold text-emerald-950">
              {result.createdTeachers}
            </p>
          </div>

          <div className="rounded-2xl bg-[#fffdf4] p-4">
            <p className="text-sm text-stone-500">创建学生</p>
            <p className="mt-1 text-3xl font-bold text-emerald-950">
              {result.createdStudents}
            </p>
          </div>

          <div className="rounded-2xl bg-[#fffdf4] p-4">
            <p className="text-sm text-stone-500">恢复账号</p>
            <p className="mt-1 text-3xl font-bold text-amber-800">
              {result.restoredAccounts || 0}
            </p>
          </div>

          <div className="rounded-2xl bg-[#fffdf4] p-4">
            <p className="text-sm text-stone-500">跳过已存在</p>
            <p className="mt-1 text-3xl font-bold text-emerald-950">
              {result.skippedExisting}
            </p>
          </div>

          <div className="rounded-2xl bg-[#fffdf4] p-4">
            <p className="text-sm text-stone-500">失败</p>
            <p className="mt-1 text-3xl font-bold text-red-700">
              {result.failed}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <p className="text-sm text-stone-500">老师班级绑定</p>
            <p className="mt-1 text-2xl font-bold text-emerald-950">
              {result.teacherBindings}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <p className="text-sm text-stone-500">学生班级绑定</p>
            <p className="mt-1 text-2xl font-bold text-emerald-950">
              {result.studentBindings}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function AccountSummaryList({
    title,
    description,
    accounts,
    tone,
  }: {
    title: string;
    description: string;
    accounts: typeof result.accounts;
    tone: "amber" | "stone" | "red";
  }) {
    const wrapperClass =
      tone === "red"
        ? "border-red-100 bg-red-50"
        : tone === "amber"
        ? "border-amber-100 bg-amber-50"
        : "border-stone-100 bg-[#fffdf4]";

    const titleClass =
      tone === "red"
        ? "text-red-700"
        : tone === "amber"
        ? "text-amber-900"
        : "text-stone-800";

    const textClass =
      tone === "red"
        ? "text-red-700"
        : tone === "amber"
        ? "text-amber-900"
        : "text-stone-700";

    return (
      <div className={`mt-6 rounded-2xl border p-4 ${wrapperClass}`}>
        <p className={`text-sm font-bold ${titleClass}`}>{title}</p>

        <p className="mt-2 text-sm leading-7 text-stone-600">{description}</p>

        <div className="mt-3 space-y-2">
          {accounts.map((account, index) => (
            <p
              key={`${account.role}-${account.loginAccount}-${index}`}
              className={`text-sm ${textClass}`}
            >
              {account.role === "teacher" ? "小老师" : "学生"}：
              {account.name}（{account.loginAccount || "无账号"}）-
              {account.className} - {getSubjectLabel(account.subject)}
              {account.message ? `：${account.message}` : ""}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-bold text-emerald-950">
            导入结果：请立即保存新账号初始密码
          </h2>

          <p className="mt-2 text-sm leading-7 text-stone-600">
            下面是本次导入的执行结果。新创建账号的初始密码只会在这里显示，请在离开页面前复制或下载保存。
          </p>
        </div>

        {result.failed === 0 ? (
          <span className="w-fit rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            导入成功
          </span>
        ) : (
          <span className="w-fit rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
            有失败项
          </span>
        )}
      </div>

      {createdAccounts.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-bold text-amber-900">
                新账号初始密码清单
              </p>

              <p className="mt-2 text-sm leading-7 text-amber-800">
                重要：这些初始密码只会在本次导入后显示一次。请在刷新、关闭或离开页面前复制或下载保存。如果丢失，系统无法查看原密码，只能重置密码。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyAccounts}
                className="rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-950"
              >
                复制账号清单
              </button>

              <button
                type="button"
                onClick={handleDownloadAccounts}
                className="rounded-full border border-amber-800 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                下载账号清单
              </button>
            </div>
          </div>

          <ImportStatsBox />

          <div className="mt-4 overflow-x-auto rounded-2xl border border-amber-100 bg-white">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-[#fffdf4] text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">角色</th>
                  <th className="px-4 py-3 font-semibold">姓名</th>
                  <th className="px-4 py-3 font-semibold">登录账号</th>
                  <th className="px-4 py-3 font-semibold">初始密码</th>
                  <th className="px-4 py-3 font-semibold">班级</th>
                  <th className="px-4 py-3 font-semibold">学科</th>
                </tr>
              </thead>

              <tbody>
                {createdAccounts.map((account, index) => (
                  <tr
                    key={`${account.role}-${account.loginAccount}-${index}`}
                    className="border-t border-amber-50"
                  >
                    <td className="px-4 py-3 text-stone-700">
                      {account.role === "teacher" ? "小老师" : "学生"}
                    </td>

                    <td className="px-4 py-3 font-semibold text-emerald-950">
                      {account.name}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-stone-700">
                      {account.loginAccount}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs font-bold text-amber-900">
                      {account.initialPassword}
                    </td>

                    <td className="px-4 py-3 text-stone-700">
                      {account.className}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getSubjectBadgeClass(
                          account.subject
                        )}`}
                      >
                        {getSubjectLabel(account.subject)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">
            本次没有新创建账号
          </p>

          <p className="mt-2 text-sm leading-7 text-emerald-800">
            系统没有生成新的初始密码。可能是因为本次导入的老师或学生账号之前已经存在，系统复用了已有账号，或者恢复了已封存账号。
          </p>

          <ImportStatsBox />
        </div>
      )}

      {restoredAccounts.length > 0 && (
        <AccountSummaryList
          title="已恢复账号"
          description="这些账号之前处于 archived 状态。本次导入时管理员已确认复用，系统已恢复为 active 并绑定到新班级。"
          accounts={restoredAccounts}
          tone="amber"
        />
      )}

      {existingAccounts.length > 0 && (
        <AccountSummaryList
          title="已存在账号"
          description="这些账号之前已经创建过，系统复用了已有账号，不会显示原密码。"
          accounts={existingAccounts}
          tone="stone"
        />
      )}

      {failedAccounts.length > 0 && (
        <AccountSummaryList
          title="失败项目"
          description="这些项目没有成功导入，请根据错误信息修正数据后重新导入。"
          accounts={failedAccounts}
          tone="red"
        />
      )}
    </section>
  );
}