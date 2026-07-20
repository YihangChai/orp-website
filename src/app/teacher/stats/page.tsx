"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import TeacherGuard, {
  useCurrentTeacher,
} from "@/components/TeacherGuard";

/**
 * teacher/stats 页面原则：
 * 1. TeacherGuard 负责确认当前小老师身份。
 * 2. 本页面只读取“个人统计”需要的业务数据。
 * 3. 本页面不再调用 getCurrentTeacher，避免重复身份查询。
 * 4. 统计数据在前端由 records / goals / comments 派生出来。
 */

/* =========================
   1. 页面内部使用的标准类型
   ========================= */

type ClassItem = {
  id: string;
  name: string;
  school: string | null;
  status: string;
};

type LessonRecord = {
  id: string;
  goal_id: string | null;
  class_id: string | null;
  lesson_date: string;
  duration_minutes: number;
  lesson_title: string;
  lesson_content_and_feedback: string;
  teacher_reflection: string | null;
  created_at: string;
};

type TeachingGoal = {
  id: string;
  title: string;
  expected_lessons: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type StudentLessonComment = {
  id: string;
  lesson_record_id: string;
  student_name: string | null;
  comment: string;
  created_at: string;
};

type MonthlyStat = {
  month: string;
  lessonCount: number;
  totalMinutes: number;
};

type TeacherStatsPageData = {
  teacherClass: ClassItem;
  records: LessonRecord[];
  goals: TeachingGoal[];
  comments: StudentLessonComment[];
};

/* =========================
   2. Supabase 原始嵌套关系类型
   ========================= */

/**
 * Supabase 的嵌套关系有时会被推断为：
 * - 一个对象
 * - 对象数组
 * - null
 *
 * 所以先用原始类型接住，再转换成页面标准类型。
 */
type RawClassTeacherRelation = {
  class_id: string;
  classes: ClassItem | ClassItem[] | null;
};

/* =========================
   3. 稳定的空数组
   ========================= */

/**
 * 这些空数组定义在组件外，只创建一次。
 *
 * 不直接写 pageData?.records || []，
 * 因为字面量 [] 每次 render 都会创建一个新数组。
 */
const EMPTY_RECORDS: LessonRecord[] = [];
const EMPTY_GOALS: TeachingGoal[] = [];
const EMPTY_COMMENTS: StudentLessonComment[] = [];

/* =========================
   4. 工具函数
   ========================= */

/**
 * 不论 Supabase 返回单个对象还是数组，
 * 都统一取出一个对象。
 */
function getOne<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

/* =========================
   5. 数据读取函数
   ========================= */

/**
 * 这个函数位于组件外：
 * - 不会在每次 render 时重新创建；
 * - 只接收稳定的 teacherId 字符串；
 * - 只负责查询、检查错误、整理和返回数据；
 * - 不直接修改 React state。
 */
async function loadTeacherStatsPageData(
  teacherId: string
): Promise<TeacherStatsPageData> {
  /**
   * 第一步：读取当前老师绑定的班级。
   * 当前版本默认使用第一个未归档班级。
   */
  const {
    data: classTeacherData,
    error: classTeacherError,
  } = await supabase
    .from("class_teachers")
    .select(
      `
        class_id,
        classes (
          id,
          name,
          school,
          status
        )
      `
    )
    .eq("teacher_id", teacherId);

  if (classTeacherError) {
    throw new Error(
      `读取小老师班级失败：${classTeacherError.message}`
    );
  }

  /*
   * 在 Supabase 数据边界进行一次类型转换。
   * 页面后续不再处理 unknown 或 any。
   */
  const rawRelations =
    (classTeacherData ??
      []) as unknown as RawClassTeacherRelation[];

  const classRows: ClassItem[] = [];

  rawRelations.forEach((relation) => {
    const classItem = getOne(relation.classes);

    if (!classItem) {
      return;
    }

    if (classItem.status === "archived") {
      return;
    }

    classRows.push(classItem);
  });

  const teacherClass = classRows[0];

  if (!teacherClass) {
    throw new Error(
      "这个小老师还没有绑定班级。请先在管理员端为小老师分配班级。"
    );
  }

  /**
   * 第二步：并行读取授课记录和教学目标。
   * 两个查询互不依赖，因此使用 Promise.all。
   */
  const [recordsResult, goalsResult] =
    await Promise.all([
      supabase
        .from("lesson_records")
        .select(
          "id, goal_id, class_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, teacher_reflection, created_at"
        )
        .eq("teacher_id", teacherId)
        .eq("class_id", teacherClass.id)
        .order("lesson_date", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("teaching_goals")
        .select(
          "id, title, expected_lessons, status, created_at, completed_at"
        )
        .eq("teacher_id", teacherId)
        .eq("class_id", teacherClass.id)
        .order("created_at", {
          ascending: false,
        }),
    ]);

  if (recordsResult.error) {
    throw new Error(
      `读取授课记录失败：${recordsResult.error.message}`
    );
  }

  if (goalsResult.error) {
    throw new Error(
      `读取教学目标失败：${goalsResult.error.message}`
    );
  }

  const records =
    (recordsResult.data ?? []) as LessonRecord[];

  const goals =
    (goalsResult.data ?? []) as TeachingGoal[];

  /**
   * 第三步：只读取当前课程记录对应的学生留言。
   */
  const recordIds = records.map(
    (record) => record.id
  );

  let comments: StudentLessonComment[] = [];

  if (recordIds.length > 0) {
    const {
      data: commentsData,
      error: commentsError,
    } = await supabase
      .from("student_lesson_comments")
      .select(
        "id, lesson_record_id, student_name, comment, created_at"
      )
      .in("lesson_record_id", recordIds)
      .order("created_at", {
        ascending: false,
      });

    if (commentsError) {
      throw new Error(
        `读取学生留言失败：${commentsError.message}`
      );
    }

    comments =
      (commentsData ??
        []) as StudentLessonComment[];
  }

  return {
    teacherClass,
    records,
    goals,
    comments,
  };
}

/* =========================
   6. 页面外壳
   ========================= */

export default function TeacherStatsPage() {
  return (
    <TeacherGuard>
      <TeacherStatsContent />
    </TeacherGuard>
  );
}

/* =========================
   7. 页面主体
   ========================= */

function TeacherStatsContent() {
  /**
   * 当前老师身份来自 TeacherGuard。
   * 页面不重复查询身份。
   */
  const currentTeacher = useCurrentTeacher();

  /*
   * effect 只依赖字符串 ID，
   * 不依赖整个 currentTeacher 对象。
   */
  const teacherId = currentTeacher.id;

  const [pageData, setPageData] =
    useState<TeacherStatsPageData | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [message, setMessage] = useState("");

  /* =========================
     8. 页面加载
     ========================= */

  useEffect(() => {
    let isCancelled = false;

    async function loadPage() {
      try {
        const loadedPageData =
          await loadTeacherStatsPageData(
            teacherId
          );

        if (isCancelled) {
          return;
        }

        setPageData(loadedPageData);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "读取教学统计失败。"
        );

        setPageData(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    /*
     * isLoading 初始值本来就是 true，
     * 所以这里不重复 setIsLoading(true)。
     */
    void loadPage();

    return () => {
      isCancelled = true;
    };
  }, [teacherId]);

  /* =========================
     9. 基础数据
     ========================= */

  const teacherClass =
    pageData?.teacherClass ?? null;

  /*
   * 使用组件外的稳定空数组。
   * 当 pageData 为空时，不会每次 render 都创建新的 []。
   */
  const records =
    pageData?.records ?? EMPTY_RECORDS;

  const goals =
    pageData?.goals ?? EMPTY_GOALS;

  const comments =
    pageData?.comments ?? EMPTY_COMMENTS;

  /* =========================
     10. 派生统计
     ========================= */

  const totalLessons = records.length;

  const totalMinutes = useMemo(() => {
    return records.reduce(
      (sum, record) =>
        sum + (record.duration_minutes ?? 0),
      0
    );
  }, [records]);

  const totalHours = Math.floor(
    totalMinutes / 60
  );

  const remainingMinutes = totalMinutes % 60;

  const averageDuration =
    totalLessons > 0
      ? Math.round(
          totalMinutes / totalLessons
        )
      : 0;

  /*
   * currentMonth 是字符串，而不是对象。
   * 即使每次 render 重新计算，只要内容相同，
   * React 依赖比较仍会认为它没有改变。
   */
  const currentMonth = new Date()
    .toISOString()
    .slice(0, 7);

  const thisMonthRecords = useMemo(() => {
    return records.filter(
      (record) =>
        record.lesson_date.slice(0, 7) ===
        currentMonth
    );
  }, [records, currentMonth]);

  const thisMonthMinutes = useMemo(() => {
    return thisMonthRecords.reduce(
      (sum, record) =>
        sum + (record.duration_minutes ?? 0),
      0
    );
  }, [thisMonthRecords]);

  const activeGoals = useMemo(() => {
    return goals.filter(
      (goal) => goal.status === "active"
    );
  }, [goals]);

  const completedGoals = useMemo(() => {
    return goals.filter(
      (goal) => goal.status === "completed"
    );
  }, [goals]);

  const goalProgressMap = useMemo(() => {
    const map = new Map<string, number>();

    records.forEach((record) => {
      if (!record.goal_id) {
        return;
      }

      const currentCount =
        map.get(record.goal_id) ?? 0;

      map.set(
        record.goal_id,
        currentCount + 1
      );
    });

    return map;
  }, [records]);

  const monthlyStats = useMemo(() => {
    const monthlyStatsMap = new Map<
      string,
      {
        lessonCount: number;
        totalMinutes: number;
      }
    >();

    records.forEach((record) => {
      const month =
        record.lesson_date.slice(0, 7);

      const currentMonthStats =
        monthlyStatsMap.get(month) ?? {
          lessonCount: 0,
          totalMinutes: 0,
        };

      monthlyStatsMap.set(month, {
        lessonCount:
          currentMonthStats.lessonCount + 1,
        totalMinutes:
          currentMonthStats.totalMinutes +
          (record.duration_minutes ?? 0),
      });
    });

    const result: MonthlyStat[] =
      Array.from(
        monthlyStatsMap.entries()
      )
        .map(([month, stats]) => ({
          month,
          lessonCount: stats.lessonCount,
          totalMinutes: stats.totalMinutes,
        }))
        .sort((a, b) =>
          b.month.localeCompare(a.month)
        )
        .slice(0, 6);

    return result;
  }, [records]);

  const latestComment = comments[0];

  const recordsWithReflection =
    useMemo(() => {
      return records.filter((record) => {
        return Boolean(
          record.teacher_reflection?.trim()
        );
      });
    }, [records]);

  const latestReflectionRecord =
    recordsWithReflection[0];

  const recentRecords = useMemo(() => {
    return records.slice(0, 5);
  }, [records]);

  const warmSummary =
    totalLessons > 0
      ? `你已经陪伴学生完成了 ${totalLessons} 节课，累计留下了 ${totalHours} 小时${
          remainingMinutes > 0
            ? ` ${remainingMinutes} 分钟`
            : ""
        }的教学时间。`
      : "这里会记录你和学生一起走过的教学旅程。第一节课之后，这里就会开始出现属于你的教学回顾。";

  /* =========================
     11. 加载状态
     ========================= */

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-8 text-stone-800">
        <section className="mx-auto max-w-6xl">
          <Link
            href="/teacher"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← 返回小老师主页
          </Link>

          <div className="mt-6 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <p className="text-sm text-stone-600">
              正在读取教学统计...
            </p>
          </div>
        </section>
      </main>
    );
  }

  /* =========================
     12. 页面渲染
     ========================= */

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-8 text-stone-800">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/teacher"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← 返回小老师主页
        </Link>

        {message && (
          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        )}

        {/* 顶部总结区 */}
        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[#2f5d50] text-white shadow-sm">
          <div className="px-6 py-8 md:px-8 md:py-9">
            <p className="text-sm font-semibold text-emerald-100">
              当前小老师：
              {currentTeacher.name}
              {teacherClass
                ? ` · ${teacherClass.name}`
                : ""}
            </p>

            <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight md:text-4xl">
              你的教学回顾
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-8 text-emerald-50">
              {warmSummary}
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-emerald-50">
                  累计授课
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {totalLessons}
                </p>

                <p className="mt-1 text-xs text-emerald-100">
                  节课
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-emerald-50">
                  累计时长
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {totalHours}
                  <span className="ml-1 text-lg">
                    h
                  </span>

                  {remainingMinutes > 0 && (
                    <span className="ml-1 text-lg">
                      {remainingMinutes}m
                    </span>
                  )}
                </p>

                <p className="mt-1 text-xs text-emerald-100">
                  平均每节{" "}
                  {averageDuration || 0} 分钟
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-emerald-50">
                  本月陪伴
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {thisMonthRecords.length}
                </p>

                <p className="mt-1 text-xs text-emerald-100">
                  {thisMonthMinutes > 0
                    ? `${Math.floor(
                        thisMonthMinutes / 60
                      )}h ${
                        thisMonthMinutes % 60
                      }m`
                    : "暂无时长"}
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-emerald-50">
                  学生回应
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {comments.length}
                </p>

                <p className="mt-1 text-xs text-emerald-100">
                  条留言
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 教学旅程和目标推进 */}
        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">
              教学旅程
            </h2>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              这些不是冰冷的数据，而是你每个月持续出现、持续陪伴学生的痕迹。
            </p>

            <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-100 bg-[#fffdf4]">
              {monthlyStats.length === 0 ? (
                <div className="p-4">
                  <p className="text-sm leading-7 text-stone-600">
                    目前还没有可以统计的授课记录。
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-emerald-100">
                  {monthlyStats.map(
                    (monthStat) => {
                      const monthHours =
                        Math.floor(
                          monthStat.totalMinutes /
                            60
                        );

                      const monthRemainingMinutes =
                        monthStat.totalMinutes %
                        60;

                      return (
                        <article
                          key={monthStat.month}
                          className="p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-bold text-emerald-950">
                                {monthStat.month}
                              </p>

                              <p className="mt-1 text-xs text-stone-500">
                                {
                                  monthStat.lessonCount
                                }{" "}
                                节课 ·{" "}
                                {monthHours} 小时
                                {monthRemainingMinutes >
                                0
                                  ? ` ${monthRemainingMinutes} 分钟`
                                  : ""}
                              </p>
                            </div>

                            <p className="text-xs font-semibold text-emerald-800">
                              {
                                monthStat.lessonCount
                              }{" "}
                              次出现
                            </p>
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">
              学习计划推进
            </h2>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              这里记录你和学生一起推进过的阅读计划、知识主题或阶段目标。
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
                <p className="text-xs text-stone-500">
                  正在推进
                </p>

                <p className="mt-1 text-2xl font-bold text-emerald-950">
                  {activeGoals.length}
                </p>

                <p className="mt-1 text-xs text-stone-500">
                  个学习计划
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
                <p className="text-xs text-stone-500">
                  已经完成
                </p>

                <p className="mt-1 text-2xl font-bold text-emerald-950">
                  {completedGoals.length}
                </p>

                <p className="mt-1 text-xs text-stone-500">
                  段学习旅程
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {goals.length === 0 ? (
                <p className="rounded-2xl bg-[#fffdf4] p-4 text-sm leading-7 text-stone-600">
                  目前还没有教学目标。之后你创建的学习计划会显示在这里。
                </p>
              ) : (
                goals.slice(0, 4).map((goal) => {
                  const expectedLessons =
                    goal.expected_lessons ?? 0;

                  const completedLessons =
                    goalProgressMap.get(
                      goal.id
                    ) ?? 0;

                  const progressPercent =
                    expectedLessons > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (completedLessons /
                              expectedLessons) *
                              100
                          )
                        )
                      : 0;

                  const isCompleted =
                    goal.status ===
                    "completed";

                  return (
                    <article
                      key={goal.id}
                      className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-emerald-950">
                              {goal.title}
                            </h3>

                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                isCompleted
                                  ? "bg-stone-100 text-stone-600"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {isCompleted
                                ? "已完成"
                                : "进行中"}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-stone-500">
                            已推进{" "}
                            {completedLessons} /{" "}
                            {expectedLessons ||
                              "?"}{" "}
                            节
                          </p>
                        </div>

                        <p className="text-xs font-semibold text-emerald-800">
                          {progressPercent}%
                        </p>
                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                        <div
                          className="h-full rounded-full bg-[#2f5d50]"
                          style={{
                            width: `${progressPercent}%`,
                          }}
                        />
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {goals.length > 4 && (
              <Link
                href="/teacher/all-records"
                className="mt-4 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              >
                查看全部学习计划 →
              </Link>
            )}
          </div>
        </section>

        {/* 最近记录、留言与反思 */}
        <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">
              最近教学轨迹
            </h2>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              最近几节课留下的主题，帮助你快速想起自己和学生讲到哪里。
            </p>

            <div className="mt-5 space-y-3">
              {recentRecords.length === 0 ? (
                <p className="rounded-2xl bg-[#fffdf4] p-4 text-sm leading-7 text-stone-600">
                  目前还没有授课记录。
                </p>
              ) : (
                recentRecords.map((record) => (
                  <article
                    key={record.id}
                    className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                  >
                    <p className="text-xs text-stone-500">
                      {record.lesson_date} ·{" "}
                      {record.duration_minutes}{" "}
                      分钟
                    </p>

                    <h3 className="mt-1 text-sm font-bold text-emerald-950">
                      {record.lesson_title}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-600">
                      {
                        record.lesson_content_and_feedback
                      }
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">
              学生回应与教学复盘
            </h2>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              真正重要的不只是上了几节课，也包括学生有没有回应，以及你有没有在教学中慢慢形成自己的方法。
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
                <p className="text-xs text-stone-500">
                  累计学生留言
                </p>

                <p className="mt-1 text-2xl font-bold text-emerald-950">
                  {comments.length}
                </p>

                <p className="mt-1 text-xs text-stone-500">
                  条来自学生的回应
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
                <p className="text-xs text-stone-500">
                  教学反思
                </p>

                <p className="mt-1 text-2xl font-bold text-emerald-950">
                  {
                    recordsWithReflection.length
                  }
                </p>

                <p className="mt-1 text-xs text-stone-500">
                  次写给自己的复盘
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                <p className="text-sm font-semibold text-emerald-700">
                  最近学生留言
                </p>

                {latestComment ? (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-emerald-950">
                      {latestComment.student_name ||
                        "学生"}
                    </p>

                    <p className="mt-1 line-clamp-4 text-sm leading-6 text-stone-600">
                      {latestComment.comment}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    目前还没有学生留言。之后学生提交课后感受后，会显示在这里。
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                <p className="text-sm font-semibold text-emerald-700">
                  最近教学反思
                </p>

                {latestReflectionRecord ? (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-emerald-950">
                      {
                        latestReflectionRecord.lesson_title
                      }
                    </p>

                    <p className="mt-1 line-clamp-4 text-sm leading-6 text-stone-600">
                      {
                        latestReflectionRecord.teacher_reflection
                      }
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    目前还没有教学反思。之后你在授课记录里写下的复盘，会显示在这里。
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}