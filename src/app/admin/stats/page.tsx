"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

/**
 * admin/statistics 数据统计页面原则：
 * 1. 本页面展示 ORP 全部届别的总数据，不负责单个学生/老师/班级详情。
 * 2. 统计重点是项目整体规模、课程活跃度、出勤情况、留言反馈、届别对比。
 * 3. MVP 阶段不接入真实用户体验埋点，但预留 UX 指标区。
 * 4. 以后可接入 form_submissions / analytics_events / page_views 等表。
 */

type CohortRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
};

type ClassRow = {
  id: string;
  name: string;
  school: string | null;
  status: string;
  cohort_id: string | null;
};

type StudentRow = {
  id: string;
  status: string;
};

type TeacherRow = {
  id: string;
  status: string;
};

type ClassStudentRow = {
  class_id: string;
  student_id: string;
};

type ClassTeacherRow = {
  class_id: string;
  teacher_id: string;
};

type LessonRecordRow = {
  id: string;
  class_id: string | null;
  lesson_date: string;
  duration_minutes: number | null;
};

type AttendanceRow = {
  student_id: string;
  lesson_record_id: string;
  is_present: boolean;
};

type TeachingGoalRow = {
  id: string;
  class_id: string | null;
  status: string | null;
};

type StudentCommentRow = {
  id: string;
  created_at: string;
};

type ParentMessageRow = {
  id: string;
  created_at: string;
};

type StatisticsData = {
  cohorts: CohortRow[];
  classes: ClassRow[];
  students: StudentRow[];
  teachers: TeacherRow[];
  classStudents: ClassStudentRow[];
  classTeachers: ClassTeacherRow[];
  lessons: LessonRecordRow[];
  attendance: AttendanceRow[];
  goals: TeachingGoalRow[];
  studentComments: StudentCommentRow[];
  parentMessages: ParentMessageRow[];
};

type CohortSummary = {
  cohortId: string;
  cohortName: string;
  cohortStatus: string;
  classCount: number;
  activeClassCount: number;
  studentCount: number;
  teacherCount: number;
  lessonCount: number;
  totalHours: number;
  recentThirtyDaysLessonCount: number;
};

function isActive(status: string | null | undefined) {
  return status === "active";
}

function isArchived(status: string | null | undefined) {
  return status === "archived" || status === "completed";
}

function formatHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function formatPercent(value: number | null) {
  if (value === null) return "暂无";
  return `${Math.round(value * 100)}%`;
}

function isWithinRecentThirtyDays(dateString: string) {
  const lessonDate = new Date(dateString);
  const today = new Date();
  const thirtyDaysAgo = new Date();

  thirtyDaysAgo.setDate(today.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  return lessonDate >= thirtyDaysAgo && lessonDate <= today;
}

function getCohortStatusLabel(status: string) {
  if (status === "active") return "运行中";
  if (status === "archived") return "已封存";
  if (status === "completed") return "已封存";
  return status;
}

function getCohortStatusClassName(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (isArchived(status)) return "bg-stone-100 text-stone-500";
  return "bg-amber-50 text-amber-700";
}

function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div>
      <div className="flex justify-between gap-3 text-xs text-stone-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>

      <div className="mt-2 h-2 rounded-full bg-stone-100">
        <div
          className="h-2 rounded-full bg-emerald-700"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

async function fetchOptionalTable<T>(
  tableName: string,
  selectQuery: string
): Promise<T[]> {
  const { data, error } = await supabase
    .from(tableName)
    .select(selectQuery)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(`Optional statistics table failed: ${tableName}`, error);
    return [];
  }

  return (data ?? []) as T[];
}

async function fetchStatisticsData(): Promise<StatisticsData> {
  const [
    cohortResult,
    classResult,
    studentResult,
    teacherResult,
    classStudentResult,
    classTeacherResult,
    lessonResult,
    attendanceResult,
    goalResult,
    studentComments,
    parentMessages,
  ] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id, name, status, created_at")
      .order("created_at", { ascending: false }),

    supabase
      .from("classes")
      .select("id, name, school, status, cohort_id"),

    supabase
      .from("students")
      .select("id, status"),

    supabase
      .from("teachers")
      .select("id, status"),

    supabase
      .from("class_students")
      .select("class_id, student_id"),

    supabase
      .from("class_teachers")
      .select("class_id, teacher_id"),

    supabase
      .from("lesson_records")
      .select("id, class_id, lesson_date, duration_minutes")
      .order("lesson_date", { ascending: false }),

    supabase
      .from("lesson_attendance")
      .select("student_id, lesson_record_id, is_present"),

    supabase
      .from("teaching_goals")
      .select("id, class_id, status"),

    fetchOptionalTable<StudentCommentRow>(
      "student_lesson_comments",
      "id, created_at"
    ),

    fetchOptionalTable<ParentMessageRow>(
      "parent_messages",
      "id, created_at"
    ),
  ]);

  if (cohortResult.error) {
    throw new Error(`读取届别失败：${cohortResult.error.message}`);
  }

  if (classResult.error) {
    throw new Error(`读取班级失败：${classResult.error.message}`);
  }

  if (studentResult.error) {
    throw new Error(`读取学生失败：${studentResult.error.message}`);
  }

  if (teacherResult.error) {
    throw new Error(`读取小老师失败：${teacherResult.error.message}`);
  }

  if (classStudentResult.error) {
    throw new Error(
      `读取学生班级关系失败：${classStudentResult.error.message}`
    );
  }

  if (classTeacherResult.error) {
    throw new Error(
      `读取小老师班级关系失败：${classTeacherResult.error.message}`
    );
  }

  if (lessonResult.error) {
    throw new Error(`读取课程记录失败：${lessonResult.error.message}`);
  }

  if (attendanceResult.error) {
    throw new Error(`读取出勤记录失败：${attendanceResult.error.message}`);
  }

  if (goalResult.error) {
    throw new Error(`读取学习目标失败：${goalResult.error.message}`);
  }

  return {
    cohorts: (cohortResult.data ?? []) as CohortRow[],
    classes: (classResult.data ?? []) as ClassRow[],
    students: (studentResult.data ?? []) as StudentRow[],
    teachers: (teacherResult.data ?? []) as TeacherRow[],
    classStudents: (classStudentResult.data ?? []) as ClassStudentRow[],
    classTeachers: (classTeacherResult.data ?? []) as ClassTeacherRow[],
    lessons: (lessonResult.data ?? []) as LessonRecordRow[],
    attendance: (attendanceResult.data ?? []) as AttendanceRow[],
    goals: (goalResult.data ?? []) as TeachingGoalRow[],
    studentComments,
    parentMessages,
  };
}

export default function AdminStatisticsPage() {
  return (
    <AdminGuard>
      <AdminStatisticsContent />
    </AdminGuard>
  );
}

function AdminStatisticsContent() {
  const [data, setData] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");



  useEffect(() => {
    let isCancelled = false;

    async function loadStatistics() {
      try {
        const loadedData = await fetchStatisticsData();

        if (isCancelled) {
          return;
        }

        setData(loadedData);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setMessage(
          error instanceof Error ? error.message : "读取统计数据失败。"
        );
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadStatistics();

    return () => {
      isCancelled = true;
    };
  }, []);

  const statistics = useMemo(() => {
    if (!data) return null;

    const {
      cohorts,
      classes,
      students,
      teachers,
      classStudents,
      classTeachers,
      lessons,
      attendance,
      goals,
      studentComments,
      parentMessages,
    } = data;

    const classById = new Map<string, ClassRow>();

    classes.forEach((classItem) => {
      classById.set(classItem.id, classItem);
    });

    const totalMinutes = lessons.reduce(
      (sum, lesson) => sum + (lesson.duration_minutes || 0),
      0
    );

    const recentThirtyDaysLessons = lessons.filter((lesson) =>
      isWithinRecentThirtyDays(lesson.lesson_date)
    );

    const recentThirtyDaysClassIds = new Set(
      recentThirtyDaysLessons
        .map((lesson) => lesson.class_id)
        .filter(Boolean) as string[]
    );

    const presentCount = attendance.filter((item) => item.is_present).length;
    const attendanceRate =
      attendance.length > 0 ? presentCount / attendance.length : null;

    const activeClasses = classes.filter((item) => isActive(item.status));
    const activeStudents = students.filter((item) => isActive(item.status));
    const activeTeachers = teachers.filter((item) => isActive(item.status));
    const activeGoals = goals.filter(
      (goal) => goal.status === "active" || !goal.status
    );

    const cohortSummaries: CohortSummary[] = cohorts.map((cohort) => {
      const cohortClasses = classes.filter(
        (classItem) => classItem.cohort_id === cohort.id
      );

      const cohortClassIds = new Set(cohortClasses.map((item) => item.id));

      const cohortStudentIds = new Set<string>();

      classStudents.forEach((relation) => {
        if (cohortClassIds.has(relation.class_id)) {
          cohortStudentIds.add(relation.student_id);
        }
      });

      const cohortTeacherIds = new Set<string>();

      classTeachers.forEach((relation) => {
        if (cohortClassIds.has(relation.class_id)) {
          cohortTeacherIds.add(relation.teacher_id);
        }
      });

      const cohortLessons = lessons.filter((lesson) => {
        if (!lesson.class_id) return false;
        return cohortClassIds.has(lesson.class_id);
      });

      const cohortRecentLessons = cohortLessons.filter((lesson) =>
        isWithinRecentThirtyDays(lesson.lesson_date)
      );

      const cohortMinutes = cohortLessons.reduce(
        (sum, lesson) => sum + (lesson.duration_minutes || 0),
        0
      );

      return {
        cohortId: cohort.id,
        cohortName: cohort.name,
        cohortStatus: cohort.status,
        classCount: cohortClasses.length,
        activeClassCount: cohortClasses.filter((item) => isActive(item.status))
          .length,
        studentCount: cohortStudentIds.size,
        teacherCount: cohortTeacherIds.size,
        lessonCount: cohortLessons.length,
        totalHours: formatHours(cohortMinutes),
        recentThirtyDaysLessonCount: cohortRecentLessons.length,
      };
    });

    const maxCohortLessonCount = Math.max(
      1,
      ...cohortSummaries.map((item) => item.lessonCount)
    );

    const latestLessonDate = lessons[0]?.lesson_date || null;

    const messageCount = studentComments.length + parentMessages.length;

    return {
      totalCohorts: cohorts.length,
      activeCohortCount: cohorts.filter((item) => isActive(item.status)).length,
      totalClasses: classes.length,
      activeClassCount: activeClasses.length,
      totalStudents: students.length,
      activeStudentCount: activeStudents.length,
      totalTeachers: teachers.length,
      activeTeacherCount: activeTeachers.length,
      totalLessonCount: lessons.length,
      totalHours: formatHours(totalMinutes),
      recentThirtyDaysLessonCount: recentThirtyDaysLessons.length,
      recentThirtyDaysActiveClassCount: recentThirtyDaysClassIds.size,
      attendanceRate,
      activeGoalCount: activeGoals.length,
      messageCount,
      latestLessonDate,
      cohortSummaries,
      maxCohortLessonCount,
      classById,
    };
  }, [data]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-600">正在读取 ORP 数据统计...</p>
        </section>
      </main>
    );
  }

  if (message || !statistics) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">读取失败</h1>

          <p className="mt-3 text-sm text-stone-600">
            {message || "统计数据不存在。"}
          </p>

          <Link
            href="/admin"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回管理员首页
          </Link>
        </section>
      </main>
    );
  }

  const uxMetrics = [
    {
      title: "课程记录填写率",
      value: "未接入",
      description: "以后可统计：老师进入填写页后，最终成功提交课程记录的比例。",
    },
    {
      title: "平均填写时长",
      value: "未接入",
      description: "以后可统计：从打开课程记录表单到提交成功的平均耗时。",
    },
    {
      title: "学生留言率",
      value: "未接入",
      description: "以后可统计：学生查看课程记录后，留下反馈的比例。",
    },
    {
      title: "页面访问路径",
      value: "未接入",
      description: "以后可统计：学生、老师、管理员最常访问的页面和跳转路径。",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-[#2f5d50]">
              Admin / 数据统计
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              ORP 数据统计
            </h1>
          </div>

          <Link
            href="/admin"
            className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回管理员首页
          </Link>
        </div>

        <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-sm font-semibold text-stone-500">
                ORP 累计运行概览
              </p>

              <h2 className="mt-3 text-2xl font-bold leading-snug text-emerald-950">
                ORP 目前累计服务{" "}
                <span className="text-emerald-700">
                  {statistics.totalStudents}
                </span>{" "}
                名学生，产生{" "}
                <span className="text-emerald-700">
                  {statistics.totalLessonCount}
                </span>{" "}
                条课程记录，累计约{" "}
                <span className="text-emerald-700">
                  {statistics.totalHours}
                </span>{" "}
                小时教学记录。
              </h2>

              <p className="mt-4 text-sm leading-7 text-stone-600">
                近 30 天共有 {statistics.recentThirtyDaysLessonCount} 条课程记录，
                涉及 {statistics.recentThirtyDaysActiveClassCount} 个活跃班级。
                最近一条课程记录日期为{" "}
                {statistics.latestLessonDate || "暂无记录"}。
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-[#fffdf4] p-4">
                  <p className="text-xs text-stone-500">当前学生</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-950">
                    {statistics.activeStudentCount}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    全部 {statistics.totalStudents}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#fffdf4] p-4">
                  <p className="text-xs text-stone-500">当前小老师</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-950">
                    {statistics.activeTeacherCount}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    全部 {statistics.totalTeachers}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#fffdf4] p-4">
                  <p className="text-xs text-stone-500">平均出勤率</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-950">
                    {formatPercent(statistics.attendanceRate)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    基于已记录出勤
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-emerald-100 bg-[#fffdf4] p-5">
              <h2 className="text-lg font-bold text-emerald-950">
                运营健康摘要
              </h2>

              <div className="mt-5 space-y-5">
                <ProgressBar
                  label="活跃班级"
                  value={statistics.activeClassCount}
                  max={Math.max(1, statistics.totalClasses)}
                />

                <ProgressBar
                  label="近 30 天活跃班级"
                  value={statistics.recentThirtyDaysActiveClassCount}
                  max={Math.max(1, statistics.activeClassCount)}
                />

                <ProgressBar
                  label="进行中学习目标"
                  value={statistics.activeGoalCount}
                  max={Math.max(1, data?.goals.length || 1)}
                />

                <ProgressBar
                  label="留言与反馈"
                  value={statistics.messageCount}
                  max={Math.max(1, statistics.totalLessonCount)}
                />
              </div>

              <p className="mt-5 text-xs leading-6 text-stone-500">
                仅供参考
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">届别对比</h2>

            {statistics.cohortSummaries.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm text-stone-600">
                暂时没有届别数据。
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-2xl border border-emerald-100">
                <table className="w-full min-w-[720px] border-collapse bg-white text-left text-sm">
                  <thead className="bg-[#fffdf4] text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">届别</th>
                      <th className="px-4 py-3 font-semibold">班级</th>
                      <th className="px-4 py-3 font-semibold">学生</th>
                      <th className="px-4 py-3 font-semibold">小老师</th>
                      <th className="px-4 py-3 font-semibold">课程</th>
                      <th className="px-4 py-3 font-semibold">近 30 天</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-emerald-50">
                    {statistics.cohortSummaries.map((cohort) => (
                      <tr key={cohort.cohortId}>
                        <td className="px-4 py-4">
                          <p className="font-bold text-emerald-950">
                            {cohort.cohortName}
                          </p>

                          <span
                            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getCohortStatusClassName(
                              cohort.cohortStatus
                            )}`}
                          >
                            {getCohortStatusLabel(cohort.cohortStatus)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {cohort.activeClassCount}/{cohort.classCount}
                        </td>

                        <td className="px-4 py-4">{cohort.studentCount}</td>

                        <td className="px-4 py-4">{cohort.teacherCount}</td>

                        <td className="px-4 py-4">
                          <div className="min-w-[120px]">
                            <ProgressBar
                              label={`${cohort.totalHours} 小时`}
                              value={cohort.lessonCount}
                              max={statistics.maxCohortLessonCount}
                            />
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {cohort.recentThirtyDaysLessonCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">
              课程与参与情况
            </h2>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-[#fffdf4] p-4">
                <p className="text-sm font-bold text-emerald-950">
                  课程记录完整度
                </p>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  当前系统已有 {statistics.totalLessonCount} 条课程记录，
                  累计 {statistics.totalHours} 小时。
                </p>
              </div>

              <div className="rounded-2xl bg-[#fffdf4] p-4">
                <p className="text-sm font-bold text-emerald-950">
                  近期活跃度
                </p>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  近 30 天共有 {statistics.recentThirtyDaysLessonCount} 条课程记录，
                  覆盖 {statistics.recentThirtyDaysActiveClassCount} 个班级。
                </p>
              </div>

              <div className="rounded-2xl bg-[#fffdf4] p-4">
                <p className="text-sm font-bold text-emerald-950">出勤情况</p>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  当前平均出勤率为 {formatPercent(statistics.attendanceRate)}。
                </p>
              </div>

              <div className="rounded-2xl bg-[#fffdf4] p-4">
                <p className="text-sm font-bold text-emerald-950">
                  留言与反馈
                </p>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  当前系统收集到 {statistics.messageCount} 条学生、家长或老师反馈。
                  这些内容可以进入留言中心，用于后续整理成 ORP 故事素材。
                </p>

                <Link
                  href="/admin/comments"
                  className="mt-4 inline-block rounded-full border border-emerald-700 px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                >
                  去留言中心
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-dashed border-emerald-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h2 className="text-xl font-bold text-emerald-950">
                用户体验度量预留区
              </h2>
            </div>

            <span className="w-fit rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">
              暂未接入埋点
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {uxMetrics.map((metric) => (
              <div
                key={metric.title}
                className="rounded-2xl border border-stone-100 bg-[#fffdf4] p-4"
              >
                <p className="text-sm font-bold text-emerald-950">
                  {metric.title}
                </p>

                <p className="mt-2 text-xl font-bold text-stone-500">
                  {metric.value}
                </p>

                <p className="mt-2 text-xs leading-6 text-stone-500">
                  {metric.description}
                </p>
              </div>
            ))}
          </div>

          {/* <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs leading-6 text-amber-800">
            <p className="mt-1">
              analytics_events：event_name、actor_role、page_path、target_id、duration_ms、created_at。
              例如记录“打开课程记录表单”“成功提交课程记录”“学生提交留言”“点击材料链接”等事件。
            </p>
          </div> */}
        </section>
      </section>
    </main>
  );
}