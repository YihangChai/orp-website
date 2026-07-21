"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

/**
 * admin/page 页面原则：
 * 1. AdminGuard 负责确认当前用户是否是管理员。
 * 2. 初始进入 admin 主页时，只读取运营总览和待处理申请。
 * 3. 全站搜索不预加载数据，只有用户点击搜索后才查数据库。
 * 4. 后续如果数据变多，可以把搜索升级为数据库 view / RPC / full-text search。
 */

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

type AdminOverviewData = {
  stats: AdminStat[];
  pendingRequests: PendingRequest[];
};

type ClassSearchRow = {
  id: string;
  name: string | null;
  school: string | null;
  status: string;
  cohort_id: string | null;
  cohorts: {
    name: string;
  } | null;
  class_teachers:
    | {
        teachers: {
          name: string;
        } | null;
      }[]
    | null;
  class_students:
    | {
        students: {
          name: string;
        } | null;
      }[]
    | null;
};

type TeacherSearchRow = {
  id: string;
  name: string | null;
  email: string | null;
  status: string | null;
};

type StudentSearchRow = {
  id: string;
  name: string | null;
  note: string | null;
  status: string | null;
};

type LessonSearchRow = {
  id: string;
  lesson_title: string | null;
  lesson_date: string | null;
  duration_minutes: number | null;
  lesson_content_and_feedback: string | null;
  homework: string | null;
  next_plan: string | null;
};

type StudentCommentSearchRow = {
  id: string;
  student_name: string | null;
  comment: string | null;
  created_at: string;
};

type ParentMessageSearchRow = {
  id: string;
  student_name: string | null;
  parent_name: string | null;
  message: string | null;
  created_at: string;
};

type CountOptions = {
  column?: string;
  value?: string;
  gteColumn?: string;
  gteValue?: string;
};

const navItems = [
  ["总览", "/admin"],
  ["班级管理", "/admin/classes"],
  ["小老师管理", "/admin/teachers"],
  ["学生管理", "/admin/students"],
  ["留言中心", "/admin/comments"],
  ["数据统计", "/admin/stats"],
  ["维护中心", "/admin/maintenance"]
];

const initialStats: AdminStat[] = [
  { label: "班级", value: "-", note: "正在读取" },
  { label: "学生", value: "-", note: "正在读取" },
  { label: "小老师", value: "-", note: "正在读取" },
  { label: "课程记录", value: "-", note: "正在读取" },
  { label: "学生留言", value: "-", note: "正在读取" },
  { label: "家长反馈", value: "-", note: "正在读取" },
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
    keyword.includes("班级") ||
    keyword.includes("class")
  ) {
    return "class";
  }

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

  if (
    keyword.includes("课程") ||
    keyword.includes("记录") ||
    keyword.includes("lesson") ||
    keyword.includes("record")
  ) {
    return "record";
  }

  if (
    keyword.includes("留言") ||
    keyword.includes("反馈") ||
    keyword.includes("message") ||
    keyword.includes("comment")
  ) {
    return "message";
  }

  return "all";
}

function isGenericTypeKeyword(keyword: string) {
  const genericKeywords = [
    "班级",
    "class",
    "小老师",
    "老师",
    "teacher",
    "学生",
    "student",
    "课程",
    "记录",
    "lesson",
    "record",
    "留言",
    "反馈",
    "message",
    "comment",
  ];

  return genericKeywords.includes(keyword);
}

function getActionTypeLabel(actionType: string) {
  if (actionType === "delete_class") return "删除班级申请";
  if (actionType === "archive_cohort") return "封存整届申请";
  if (actionType === "create_class") return "创建班级申请";
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

async function getCount(tableName: string, options?: CountOptions) {
  let query = supabase
    .from(tableName)
    .select("id", { count: "exact", head: true });

  if (options?.column && options.value !== undefined) {
    query = query.eq(options.column, options.value);
  }

  if (options?.gteColumn && options.gteValue !== undefined) {
    query = query.gte(options.gteColumn, options.gteValue);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`读取 ${tableName} 数量失败：${error.message}`);
  }

  return count ?? 0;
}

async function loadAdminOverviewData(): Promise<AdminOverviewData> {
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
    requestResult,
  ] = await Promise.all([
    getCount("classes", {
      column: "status",
      value: "active",
    }),

    getCount("students", {
      column: "status",
      value: "active",
    }),

    getCount("teachers", {
      column: "status",
      value: "active",
    }),

    getCount("lesson_records"),

    getCount("student_lesson_comments"),

    getCount("student_lesson_comments", {
      gteColumn: "created_at",
      gteValue: oneWeekAgo.toISOString(),
    }),

    getCount("parent_messages"),

    supabase
      .from("admin_action_requests")
      .select(
        "id, action_type, target_type, target_id, target_name, status, approvals_count, required_approvals, note"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (requestResult.error) {
    throw new Error(
      `读取待处理申请失败：${requestResult.error.message}`
    );
  }

  const stats: AdminStat[] = [
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
  ];

  return {
    stats,
    pendingRequests: (requestResult.data ?? []) as PendingRequest[],
  };
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminHomeContent />
    </AdminGuard>
  );
}

function AdminHomeContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [pageData, setPageData] = useState<AdminOverviewData>({
    stats: initialStats,
    pendingRequests: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

  const keyword = searchTerm.trim().toLowerCase();
  const hasSearchTerm = keyword.length > 0;

  async function refreshAdminOverview() {
    setIsLoading(true);
    setMessage("");

    try {
      const loadedData = await loadAdminOverviewData();
      setPageData(loadedData);
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

    function buildTextSearchConditions(
      columns: string[],
      activeKeyword: string
    ) {
      if (isGenericTypeKeyword(activeKeyword)) {
        return "";
      }

      const searchPattern = `%${activeKeyword}%`;

      return columns
        .map((column) => `${column}.ilike.${searchPattern}`)
        .join(",");
    }

  async function loadSearchResults(
    activeKeyword: string
  ): Promise<SearchItem[]> {
    const typeFilter = getSearchTypeFilter(activeKeyword);

    const shouldSearchClass =
      typeFilter === "all" || typeFilter === "class";

    const shouldSearchTeacher =
      typeFilter === "all" || typeFilter === "teacher";

    const shouldSearchStudent =
      typeFilter === "all" || typeFilter === "student";

    const shouldSearchRecord =
      typeFilter === "all" || typeFilter === "record";

    const shouldSearchMessage =
      typeFilter === "all" || typeFilter === "message";

    const classSearchConditions = buildTextSearchConditions(
      ["name", "school", "status"],
      activeKeyword
    );

    const teacherSearchConditions = buildTextSearchConditions(
      ["name", "email", "status"],
      activeKeyword
    );

    const studentSearchConditions = buildTextSearchConditions(
      ["name", "note", "status"],
      activeKeyword
    );

    const lessonSearchConditions = buildTextSearchConditions(
      [
        "lesson_title",
        "lesson_content_and_feedback",
        "homework",
        "next_plan",
      ],
      activeKeyword
    );

    const studentCommentSearchConditions = buildTextSearchConditions(
      ["student_name", "comment"],
      activeKeyword
    );

    const parentMessageSearchConditions = buildTextSearchConditions(
      ["student_name", "parent_name", "message"],
      activeKeyword
    );

    const classBaseQuery = supabase
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
      .limit(30);

    const teacherBaseQuery = supabase
      .from("teachers")
      .select("id, name, email, status")
      .order("created_at", { ascending: false })
      .limit(30);

    const studentBaseQuery = supabase
      .from("students")
      .select("id, name, note, status")
      .order("created_at", { ascending: false })
      .limit(40);

    const lessonBaseQuery = supabase
      .from("lesson_records")
      .select(
        "id, lesson_title, lesson_date, duration_minutes, lesson_content_and_feedback, homework, next_plan"
      )
      .order("lesson_date", { ascending: false })
      .limit(40);

    const studentCommentBaseQuery = supabase
      .from("student_lesson_comments")
      .select("id, student_name, comment, created_at")
      .order("created_at", { ascending: false })
      .limit(40);

    const parentMessageBaseQuery = supabase
      .from("parent_messages")
      .select("id, student_name, parent_name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(40);

    const [
      classResult,
      teacherResult,
      studentResult,
      lessonResult,
      studentCommentResult,
      parentMessageResult,
    ] = await Promise.all([
      shouldSearchClass
        ? classSearchConditions
          ? classBaseQuery.or(classSearchConditions)
          : classBaseQuery
        : Promise.resolve({
            data: [] as ClassSearchRow[],
            error: null,
          }),

      shouldSearchTeacher
        ? teacherSearchConditions
          ? teacherBaseQuery.or(teacherSearchConditions)
          : teacherBaseQuery
        : Promise.resolve({
            data: [] as TeacherSearchRow[],
            error: null,
          }),

      shouldSearchStudent
        ? studentSearchConditions
          ? studentBaseQuery.or(studentSearchConditions)
          : studentBaseQuery
        : Promise.resolve({
            data: [] as StudentSearchRow[],
            error: null,
          }),

      shouldSearchRecord
        ? lessonSearchConditions
          ? lessonBaseQuery.or(lessonSearchConditions)
          : lessonBaseQuery
        : Promise.resolve({
            data: [] as LessonSearchRow[],
            error: null,
          }),

      shouldSearchMessage
        ? studentCommentSearchConditions
          ? studentCommentBaseQuery.or(studentCommentSearchConditions)
          : studentCommentBaseQuery
        : Promise.resolve({
            data: [] as StudentCommentSearchRow[],
            error: null,
          }),

      shouldSearchMessage
        ? parentMessageSearchConditions
          ? parentMessageBaseQuery.or(parentMessageSearchConditions)
          : parentMessageBaseQuery
        : Promise.resolve({
            data: [] as ParentMessageSearchRow[],
            error: null,
          }),
    ]);

    const possibleErrors = [
      classResult.error,
      teacherResult.error,
      studentResult.error,
      lessonResult.error,
      studentCommentResult.error,
      parentMessageResult.error,
    ].filter((error) => error !== null);

    if (possibleErrors.length > 0) {
      console.error(possibleErrors);

      setSearchMessage(
        "部分搜索结果读取失败。请检查相关表字段或 RLS 权限。"
      );
    }

    const classRows = (classResult.data ?? []) as unknown as ClassSearchRow[];

    const teacherRows = (
      teacherResult.data ?? []
    ) as unknown as TeacherSearchRow[];

    const studentRows = (
      studentResult.data ?? []
    ) as unknown as StudentSearchRow[];

    const lessonRows = (
      lessonResult.data ?? []
    ) as unknown as LessonSearchRow[];

    const studentCommentRows = (
      studentCommentResult.data ?? []
    ) as unknown as StudentCommentSearchRow[];

    const parentMessageRows = (
      parentMessageResult.data ?? []
    ) as unknown as ParentMessageSearchRow[];

    const classItems: SearchItem[] = classRows.map((classItem) => {
      const teacherNames =
        classItem.class_teachers
          ?.map((item) => item.teachers?.name)
          .filter((name): name is string => Boolean(name)) ?? [];

      const studentNames =
        classItem.class_students
          ?.map((item) => item.students?.name)
          .filter((name): name is string => Boolean(name)) ?? [];

      return {
        id: `class-${classItem.id}`,
        type: "class",
        title: classItem.name || "未命名班级",
        subtitle: `班级 · ${
          classItem.cohorts?.name || "未设置届别"
        } · ${
          teacherNames.length > 0
            ? `小老师 ${teacherNames.join("、")}`
            : "暂未分配小老师"
        }`,
        description: `${
          classItem.school || "暂未填写合作学校"
        } · ${studentNames.length} 名学生 · 状态：${getStatusLabel(
          classItem.status
        )}`,
        status: getStatusLabel(classItem.status),
        href: `/admin/classes/${classItem.id}`,
      };
    });

    const teacherItems: SearchItem[] = teacherRows.map((teacher) => ({
      id: `teacher-${teacher.id}`,
      type: "teacher",
      title: teacher.name || "未命名小老师",
      subtitle: "小老师",
      description: teacher.email
        ? `邮箱：${teacher.email}`
        : "暂未填写邮箱。后续可以在小老师管理页补充更多信息。",
      status: getStatusLabel(teacher.status || "active"),
      href: `/admin/teachers/${teacher.id}`,
    }));

    const studentItems: SearchItem[] = studentRows.map((student) => ({
      id: `student-${student.id}`,
      type: "student",
      title: student.name || "未命名学生",
      subtitle: "学生",
      description:
        student.note ||
        "暂未填写学生备注。后续可以在学生详情页查看学习情况。",
      status: getStatusLabel(student.status || "active"),
      href: `/admin/students/${student.id}`,
    }));

    const lessonItems: SearchItem[] = lessonRows.map((lesson) => ({
      id: `record-${lesson.id}`,
      type: "record",
      title: lesson.lesson_title || "未命名课程记录",
      subtitle: `课程记录 · ${
        lesson.lesson_date || "未填写日期"
      } · ${lesson.duration_minutes || 0} 分钟`,
      description:
        lesson.lesson_content_and_feedback ||
        lesson.next_plan ||
        lesson.homework ||
        "暂无课程内容摘要。",
      status: "已记录",
      href: `/admin/records/${lesson.id}`,
    }));

    const studentMessageItems: SearchItem[] = studentCommentRows.map(
      (comment) => ({
        id: `student-message-${comment.id}`,
        type: "student_message",
        title: `${comment.student_name || "学生"} 的留言`,
        subtitle: `学生留言 · ${new Date(
          comment.created_at
        ).toLocaleDateString("zh-CN")}`,
        description: comment.comment || "暂无留言内容。",
        status: "已收到",
        href: "/admin/comments",
      })
    );

    const parentMessageItems: SearchItem[] = parentMessageRows.map(
      (messageItem) => ({
        id: `parent-message-${messageItem.id}`,
        type: "parent_message",
        title: `${messageItem.parent_name || "家长"} 的反馈`,
        subtitle: `家长反馈 · ${
          messageItem.student_name || "未填写学生"
        } · ${new Date(messageItem.created_at).toLocaleDateString(
          "zh-CN"
        )}`,
        description: messageItem.message || "暂无反馈内容。",
        status: "已收到",
        href: "/admin/comments",
      })
    );

    return [
      ...classItems,
      ...teacherItems,
      ...studentItems,
      ...lessonItems,
      ...studentMessageItems,
      ...parentMessageItems,
    ];
  }

  async function handleSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const activeKeyword = searchTerm.trim().toLowerCase();

    if (!activeKeyword) {
      setSearchMessage("请先输入搜索关键词。");
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchMessage("");
    setSearchResults([]);

    try {
      const results = await loadSearchResults(activeKeyword);
      setSearchResults(results);

      if (results.length === 0) {
        setSearchMessage("没有找到相关内容。");
      }
    } catch (error) {
      console.error(error);

      setSearchMessage(
        error instanceof Error
          ? `搜索失败：${error.message}`
          : "搜索失败：未知错误。"
      );
    } finally {
      setIsSearching(false);
    }
  }

  function clearSearch() {
    setSearchTerm("");
    setSearchResults([]);
    setHasSearched(false);
    setSearchMessage("");
  }

  useEffect(() => {
  let isCancelled = false;

  async function loadPage() {
    try {
      const loadedData = await loadAdminOverviewData();

      if (isCancelled) {
        return;
      }

      setPageData(loadedData);
    } catch (error) {
      if (isCancelled) {
        return;
      }

      console.error(error);

      setMessage(
        error instanceof Error
          ? `读取管理员首页失败：${error.message}`
          : "读取管理员首页失败：未知错误。"
      );
    } finally {
      if (!isCancelled) {
        setIsLoading(false);
      }
    }
  }

  void loadPage();

  return () => {
    isCancelled = true;
  };
}, []);

  const { stats, pendingRequests } = pageData;

  return (
    <main className="min-h-screen bg-[#f6f5e9] text-stone-800">
      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm">
          <h1 className="mt-2 text-2xl font-bold text-emerald-950">
            管理后台
          </h1>

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
                <h2 className="mt-2 text-3xl font-bold text-emerald-950">
                  ORP 运营总览
                </h2>
              </div>

              <button
                type="button"
                onClick={refreshAdminOverview}
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
                <h2 className="text-xl font-bold text-emerald-950">全站搜索</h2>
              </div>

              {hasSearchTerm && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="w-fit rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                >
                  清空搜索
                </button>
              )}
            </div>

            <form
              onSubmit={handleSearch}
              className="mt-5 flex flex-col gap-3 md:flex-row"
            >
              <input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSearchMessage("");
                }}
                placeholder="搜索：班级名 / 学生名 / 小老师名 / 课程主题 / 家长留言..."
                className="w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />

              <button
                type="submit"
                disabled={isSearching || searchTerm.trim().length === 0}
                className="w-fit rounded-2xl bg-[#2f5d50] px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSearching ? "搜索中..." : "搜索"}
              </button>
            </form>

            {searchMessage && (
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                {searchMessage}
              </div>
            )}

            {hasSearched && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-stone-600">
                  找到 {searchResults.length} 条结果
                </p>

                {isSearching ? (
                  <div className="mt-3 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                    正在搜索数据库...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="mt-3 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                    没有找到相关内容。
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {searchResults.map((item) => (
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
                    href="/admin/maintenance"
                    className="block rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4 transition hover:border-emerald-300 hover:bg-white"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                            {getActionTypeLabel(request.action_type)}
                          </span>

                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-500">
                            {request.approvals_count}/{request.required_approvals} 已确认
                          </span>
                        </div>

                        <h3 className="mt-2 text-base font-bold text-emerald-950">
                          {request.target_name}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {request.note || "需要管理员进入维护中心继续确认或取消。"}
                        </p>
                      </div>

                      <span className="text-sm font-semibold text-emerald-700">
                        去维护中心 →
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