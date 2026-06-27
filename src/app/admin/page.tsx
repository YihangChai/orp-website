"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SearchItem = {
  id: string;
  type:
    | "class"
    | "teacher"
    | "student"
    | "record"
    | "student_message"
    | "parent_message";
  title: string;
  subtitle: string;
  description: string;
  status: string;
  href: string;
};

type AdminStat = {
  label: string;
  value: string;
  note: string;
};

type PendingRequest = {
  id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  target_name: string;
  status: string;
  approvals_count: number;
  required_approvals: number;
  note: string | null;
};

const navItems = [
  ["总览", "/admin"],
  ["班级管理", "/admin/classes"],
  ["小老师管理", "/admin/teachers"],
  ["学生管理", "/admin/students"],
  ["课程记录", "/admin/records"],
  ["教学目标", "/admin/goals"],
  ["留言中心", "/admin/messages"],
  ["数据统计", "/admin/stats"],
];

function getTypeLabel(type: SearchItem["type"]) {
  if (type === "class") return "班级";
  if (type === "teacher") return "小老师";
  if (type === "student") return "学生";
  if (type === "record") return "课程";
  if (type === "student_message") return "学生留言";
  return "家长反馈";
}

function getTypeStyle(type: SearchItem["type"]) {
  if (type === "class") return "bg-emerald-50 text-emerald-700";
  if (type === "teacher") return "bg-blue-50 text-blue-700";
  if (type === "student") return "bg-amber-50 text-amber-700";
  if (type === "record") return "bg-stone-100 text-stone-700";
  if (type === "student_message") return "bg-rose-50 text-rose-700";
  return "bg-purple-50 text-purple-700";
}

function getSearchTypeFilter(keyword: string) {
  if (
    keyword.includes("小老师") ||
    keyword.includes("老师") ||
    keyword.includes("teacher")
  ) {
    return "teacher";
  }
  if (
    keyword.includes("学生") ||
    keyword.includes("student")
  ) {
    return "student";
  }
  return "all";
}

function getActionTypeLabel(actionType: string) {
  if (actionType === "delete_class") return "删除班级申请";
  if (actionType === "archive_cohort") return "封存整届申请";
  return actionType;
}

function getStatusLabel(status: string) {
  if (status === "active") return "运行中";
  if (status === "archived") return "已封存";
  if (status === "delete_requested") return "删除申请中";
  if (status === "pending") return "待确认";
  if (status === "completed") return "已完成";
  if (status === "canceled") return "已取消";
  return status;
}

export default function AdminPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<AdminStat[]>([
    { label: "班级", value: "-", note: "正在读取" },
    { label: "学生", value: "-", note: "正在读取" },
    { label: "小老师", value: "-", note: "正在读取" },
    { label: "课程记录", value: "-", note: "正在读取" },
    { label: "学生留言", value: "-", note: "正在读取" },
    { label: "家长反馈", value: "-", note: "正在读取" },
  ]);
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const keyword = searchTerm.trim().toLowerCase();
  const hasSearchTerm = keyword.length > 0;

  const filteredItems = useMemo(() => {
  if (!keyword) return [];

  const typeFilter = getSearchTypeFilter(keyword);

  return searchItems.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) {
      return false;
    }

    const searchableText = [
      item.title,
      item.subtitle,
      item.description,
      item.status,
      getTypeLabel(item.type),
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(keyword);
  });
  }, [keyword, searchItems]);

  async function getCount(
    tableName: string,
    options?: {
      column?: string;
      value?: string;
      gteColumn?: string;
      gteValue?: string;
    }
  ) {
    let query = supabase
      .from(tableName)
      .select("id", { count: "exact", head: true });

    if (options?.column && options?.value) {
      query = query.eq(options.column, options.value);
    }

    if (options?.gteColumn && options?.gteValue) {
      query = query.gte(options.gteColumn, options.gteValue);
    }

    const { count, error } = await query;

    if (error) {
      console.error(`Count error on ${tableName}:`, error.message);
      return 0;
    }

    return count || 0;
  }

  async function fetchAdminOverview() {
    setIsLoading(true);
    setMessage("");

    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const [
        activeClassCount,
        studentCount,
        teacherCount,
        lessonRecordCount,
        studentCommentCount,
        weeklyStudentCommentCount,
        parentMessageCount,
        pendingRequestCount,
      ] = await Promise.all([
        getCount("classes", { column: "status", value: "active" }),
        getCount("students", { column: "status", value: "active" }),
        getCount("teachers", { column: "status", value: "active" }),
        getCount("lesson_records"),
        getCount("student_lesson_comments"),
        getCount("student_lesson_comments", {
          gteColumn: "created_at",
          gteValue: oneWeekAgo.toISOString(),
        }),
        getCount("parent_messages"),
        getCount("admin_action_requests", {
          column: "status",
          value: "pending",
        }),
      ]);

      setStats([
        {
          label: "班级",
          value: String(activeClassCount),
          note: "正在运行",
        },
        {
          label: "学生",
          value: String(studentCount),
          note: "人",
        },
        {
          label: "小老师",
          value: String(teacherCount),
          note: "人",
        },
        {
          label: "课程记录",
          value: String(lessonRecordCount),
          note: "累计提交",
        },
        {
          label: "学生留言",
          value: String(studentCommentCount),
          note: `本周新增 ${weeklyStudentCommentCount} 条`,
        },
        {
          label: "家长反馈",
          value: String(parentMessageCount),
          note: "累计收到",
        },
      ]);

      const [
        classResult,
        teacherResult,
        studentResult,
        lessonResult,
        studentCommentResult,
        parentMessageResult,
        requestResult,
      ] = await Promise.all([
        supabase
          .from("classes")
          .select(
            `
            id,
            name,
            school,
            status,
            cohort_id,
            cohorts(name),
            class_teachers(
              teachers(name)
            ),
            class_students(
              students(name)
            )
          `
          )
          .order("created_at", { ascending: false })
          .limit(80),

        supabase
          .from("teachers")
          .select("id, name, email, status")
          .order("created_at", { ascending: false })
          .limit(80),

        supabase
          .from("students")
          .select("id, name, note, status")
          .order("created_at", { ascending: false })
          .limit(120),

        supabase
          .from("lesson_records")
          .select(
            "id, lesson_title, lesson_date, duration_minutes, lesson_content_and_feedback, homework, next_plan"
          )
          .order("lesson_date", { ascending: false })
          .limit(100),

        supabase
          .from("student_lesson_comments")
          .select("id, student_name, comment, created_at")
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("parent_messages")
          .select("id, student_name, parent_name, message, created_at")
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("admin_action_requests")
          .select(
            "id, action_type, target_type, target_id, target_name, status, approvals_count, required_approvals, note"
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const possibleErrors = [
        classResult.error,
        teacherResult.error,
        studentResult.error,
        lessonResult.error,
        studentCommentResult.error,
        parentMessageResult.error,
        requestResult.error,
      ].filter(Boolean);

      if (possibleErrors.length > 0) {
        console.error(possibleErrors);
        setMessage(
          "部分数据读取失败。页面仍会显示已经成功读取的数据，请检查 Supabase 表权限或字段是否完整。"
        );
      }

      const classItems: SearchItem[] = ((classResult.data || []) as any[]).map(
        (classItem) => {
          const teacherNames =
            classItem.class_teachers
              ?.map((item: any) => item.teachers?.name)
              .filter(Boolean) || [];

          const studentNames =
            classItem.class_students
              ?.map((item: any) => item.students?.name)
              .filter(Boolean) || [];

          return {
            id: `class-${classItem.id}`,
            type: "class",
            title: classItem.name || "未命名班级",
            subtitle: `班级 · ${classItem.cohorts?.name || "未设置届别"} · ${
              teacherNames.length > 0
                ? `小老师 ${teacherNames.join("、")}`
                : "暂未分配小老师"
            }`,
            description: `${classItem.school || "暂未填写合作学校"} · ${
              studentNames.length
            } 名学生 · 状态：${getStatusLabel(classItem.status)}`,
            status: getStatusLabel(classItem.status),
            href: `/admin/classes/${classItem.id}`,
          };
        }
      );

      const teacherItems: SearchItem[] = (teacherResult.data || []).map(
        (teacher: any) => ({
          id: `teacher-${teacher.id}`,
          type: "teacher",
          title: teacher.name || "未命名小老师",
          subtitle: "小老师",
          description: teacher.email
            ? `邮箱：${teacher.email}`
            : "暂未填写邮箱。后续可以在小老师管理页补充更多信息。",
          status: getStatusLabel(teacher.status || "active"),
          href: `/admin/teachers/${teacher.id}`,
        })
      );

      const studentItems: SearchItem[] = (studentResult.data || []).map(
        (student: any) => ({
          id: `student-${student.id}`,
          type: "student",
          title: student.name || "未命名学生",
          subtitle: "学生",
          description:
            student.note || "暂未填写学生备注。后续可以在学生详情页查看学习情况。",
          status: getStatusLabel(student.status || "active"),
          href: `/admin/students/${student.id}`,
        })
      );

      const lessonItems: SearchItem[] = (lessonResult.data || []).map(
        (lesson: any) => ({
          id: `record-${lesson.id}`,
          type: "record",
          title: lesson.lesson_title || "未命名课程记录",
          subtitle: `课程记录 · ${lesson.lesson_date || "未填写日期"} · ${
            lesson.duration_minutes || 0
          } 分钟`,
          description:
            lesson.lesson_content_and_feedback ||
            lesson.next_plan ||
            lesson.homework ||
            "暂无课程内容摘要。",
          status: "已记录",
          href: `/admin/records/${lesson.id}`,
        })
      );

      const studentMessageItems: SearchItem[] = (
        studentCommentResult.data || []
      ).map((comment: any) => ({
        id: `student-message-${comment.id}`,
        type: "student_message",
        title: `${comment.student_name || "学生"} 的留言`,
        subtitle: `学生留言 · ${new Date(comment.created_at).toLocaleDateString(
          "zh-CN"
        )}`,
        description: comment.comment || "暂无留言内容。",
        status: "已收到",
        href: `/admin/messages`,
      }));

      const parentMessageItems: SearchItem[] = (
        parentMessageResult.data || []
      ).map((messageItem: any) => ({
        id: `parent-message-${messageItem.id}`,
        type: "parent_message",
        title: `${messageItem.parent_name || "家长"} 的反馈`,
        subtitle: `家长反馈 · ${messageItem.student_name || "未填写学生"} · ${new Date(
          messageItem.created_at
        ).toLocaleDateString("zh-CN")}`,
        description: messageItem.message || "暂无反馈内容。",
        status: "已收到",
        href: `/admin/messages`,
      }));

      setSearchItems([
        ...classItems,
        ...teacherItems,
        ...studentItems,
        ...lessonItems,
        ...studentMessageItems,
        ...parentMessageItems,
      ]);

      setPendingRequests((requestResult.data || []) as PendingRequest[]);
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? `读取管理员首页失败：${error.message}`
          : "读取管理员首页失败：未知错误。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchAdminOverview();
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f5e9] text-stone-800">
      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm">
          <h1 className="mt-2 text-2xl font-bold text-emerald-950">
            管理后台
          </h1>

          <p className="mt-3 text-xs leading-6 text-stone-500">
            管理班级、成员、课程记录和留言反馈。
          </p>

          <nav className="mt-6 space-y-2 text-sm">
            {navItems.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className={`block rounded-2xl px-4 py-2.5 font-semibold transition ${
                  href === "/admin"
                    ? "bg-[#2f5d50] text-white"
                    : "text-stone-600 hover:bg-[#fffdf4] hover:text-emerald-800"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="space-y-6">
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-7">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-semibold text-[#2f5d50]">Admin</p>

                <h2 className="mt-2 text-3xl font-bold text-emerald-950">
                  ORP 运营总览
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
                  首页展示整体概况、全站搜索和高风险待确认操作。具体管理仍放在对应模块里处理，避免首页被大量记录淹没。
                </p>
              </div>

              <button
                type="button"
                onClick={fetchAdminOverview}
                disabled={isLoading}
                className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "正在刷新..." : "刷新数据"}
              </button>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                {message}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                >
                  <p className="text-sm text-stone-500">{stat.label}</p>

                  <p className="mt-1 text-3xl font-bold text-emerald-950">
                    {stat.value}
                  </p>

                  <p className="mt-1 text-xs text-stone-500">{stat.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold text-emerald-950">
                  全站搜索
                </h2>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  搜索班级、学生、小老师、课程记录或留言。默认不展开数据，输入关键词后再显示结果。
                </p>
              </div>

              {hasSearchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="w-fit rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                >
                  清空搜索
                </button>
              )}
            </div>

            <div className="mt-5">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="搜索：班级名 / 学生名 / 小老师名 / 课程主题 / 家长留言..."
                className="w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span>可搜索：</span>

              {["班级", "学生", "小老师", "课程记录", "留言"].map(
                (exampleKeyword) => (
                  <button
                    key={exampleKeyword}
                    type="button"
                    onClick={() => setSearchTerm(exampleKeyword)}
                    className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    {exampleKeyword}
                  </button>
                )
              )}
            </div>

            {!hasSearchTerm && (
              <div className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                输入关键词后，这里会显示 Supabase 中匹配的真实数据。为了避免首页过载，系统不会默认展开所有班级和记录。
              </div>
            )}

            {hasSearchTerm && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-stone-600">
                  找到 {filteredItems.length} 条结果
                </p>

                {filteredItems.length === 0 ? (
                  <div className="mt-3 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                    没有找到相关内容。可以换一个关键词，比如班级名、学生名、小老师名或课程主题。
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {filteredItems.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="block rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4 transition hover:border-emerald-300 hover:bg-white"
                      >
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTypeStyle(
                                  item.type
                                )}`}
                              >
                                {getTypeLabel(item.type)}
                              </span>

                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-500">
                                {item.status}
                              </span>
                            </div>

                            <h3 className="mt-2 text-base font-bold text-emerald-950">
                              {item.title}
                            </h3>

                            <p className="mt-1 text-sm text-stone-500">
                              {item.subtitle}
                            </p>

                            <p className="mt-2 text-sm leading-6 text-stone-600">
                              {item.description}
                            </p>
                          </div>

                          <span className="text-sm font-semibold text-emerald-700">
                            查看 →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-[1.75rem] border border-dashed border-emerald-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h2 className="text-xl font-bold text-emerald-950">
                  待处理问题
                </h2>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  MVP 阶段这里先显示高风险操作申请，例如删除班级申请、整届封存申请。系统报错工单可以等 MVP 完成后再做。
                </p>
              </div>

              <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                待处理 {pendingRequests.length}
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                目前没有待处理的高风险操作申请。
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {pendingRequests.map((request) => (
                  <Link
                    key={request.id}
                    href={
                      request.action_type === "archive_cohort"
                        ? "/admin/classes"
                        : request.action_type === "delete_class"
                        ? "/admin/classes"
                        : "/admin"
                    }
                    className="block rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4 transition hover:border-emerald-300 hover:bg-white"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                            {getActionTypeLabel(request.action_type)}
                          </span>

                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-500">
                            {request.approvals_count}/
                            {request.required_approvals} 已确认
                          </span>
                        </div>

                        <h3 className="mt-2 text-base font-bold text-emerald-950">
                          {request.target_name}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {request.note ||
                            "需要管理员进入对应模块继续确认或取消。"}
                        </p>
                      </div>

                      <span className="text-sm font-semibold text-emerald-700">
                        去处理 →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}