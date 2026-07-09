"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import TeacherGuard, { useCurrentTeacher } from "@/components/TeacherGuard";
import type { CurrentTeacher } from "@/lib/auth";

/**
 * 这个页面的结构原则：
 * 1. TeacherGuard 负责确认当前登录者是不是小老师。
 * 2. 本页面只负责读取“小老师主页”需要的业务数据。
 * 3. 本页面不再调用 getCurrentTeacher，避免和 TeacherGuard 重复查身份。
 */

/* =========================
   1. 类型定义：描述页面会用到的数据结构
   ========================= */

type StudentRow = {
  id: string;
  name: string;
  note: string | null;
  status: string;
};

type CohortRow = {
  id: string;
  name: string;
  status: string;
};

type ClassStudentRelation = {
  students: StudentRow | null;
};

type ClassRow = {
  id: string;
  name: string;
  school: string | null;
  status: string;
  cohorts: CohortRow | null;
  class_students: ClassStudentRelation[];
};

type ClassTeacherRelation = {
  class_id: string;
  classes: ClassRow | null;
};

type StudentInClass = {
  class_id: string;
  students: StudentRow | null;
};

type LessonRecord = {
  id: string;
  class_id: string | null;
  lesson_date: string;
  duration_minutes: number;
  lesson_title: string;
  lesson_content_and_feedback: string;
};

type TeachingGoal = {
  id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  expected_lessons: number | null;
  status: string;
};

type TeachingGoalWithProgress = TeachingGoal & {
  completed_lessons: number;
};

type TeacherHomePageData = {
  classRelations: ClassTeacherRelation[];
  studentsInClasses: StudentInClass[];
  lessonRecords: LessonRecord[];
  goalsWithProgress: TeachingGoalWithProgress[];
};

/* =========================
   2. 页面外壳：只负责套 TeacherGuard
   ========================= */

export default function TeacherPage() {
  return (
    <TeacherGuard>
      <TeacherHomeContent />
    </TeacherGuard>
  );
}

/* =========================
   3. 页面主体：真正的小老师主页
   ========================= */

function TeacherHomeContent() {
  /**
   * currentTeacher 来自 TeacherGuard。
   * 这里不会重新访问数据库确认老师身份。
   */
  const currentTeacher = useCurrentTeacher();

  const [pageData, setPageData] = useState<TeacherHomePageData | null>(null);
  const [isLoadingTeacherData, setIsLoadingTeacherData] = useState(true);
  const [isCompletingGoal, setIsCompletingGoal] = useState(false);
  const [message, setMessage] = useState("");

  /* =========================
     4. 数据读取函数：读取老师主页需要的业务数据
     ========================= */

  async function loadTeacherHomePageData(
    activeTeacher: CurrentTeacher
  ): Promise<TeacherHomePageData> {
    /**
     * 第一次查询：
     * 从 class_teachers 找到这个老师负责的班级。
     * 同时嵌套读取：
     * - classes 班级信息
     * - cohorts 届别信息
     * - class_students 班级学生关系
     * - students 学生基本信息
     *
     * 这样就不需要再单独查一次 class_students。
     */
    const { data: classTeacherData, error: classTeacherError } = await supabase
      .from("class_teachers")
      .select(
        `
        class_id,
        classes (
          id,
          name,
          school,
          status,
          cohorts (
            id,
            name,
            status
          ),
          class_students (
            students (
              id,
              name,
              note,
              status
            )
          )
        )
      `
      )
      .eq("teacher_id", activeTeacher.id);

    if (classTeacherError) {
      throw new Error(`读取小老师班级失败：${classTeacherError.message}`);
    }

    const classRelations = (
      (classTeacherData || []) as unknown as ClassTeacherRelation[]
    ).filter((relation) => Boolean(relation.classes));

    const classIds = classRelations
      .map((relation) => relation.class_id)
      .filter(Boolean);

    /**
     * 把 nested select 里的班级学生关系整理成统一数组。
     * 后面页面渲染“学生名单”和“每个班的学生”都会用这个数组。
     */
    const studentsInClasses: StudentInClass[] = classRelations.flatMap(
      (relation) => {
        const classStudents = relation.classes?.class_students || [];

        return classStudents.map((classStudent) => ({
          class_id: relation.class_id,
          students: classStudent.students,
        }));
      }
    );

    /**
     * 如果这个老师暂时没有分配班级：
     * 后面的课程记录、教学目标都没有必要查。
     */
    if (classIds.length === 0) {
      return {
        classRelations,
        studentsInClasses,
        lessonRecords: [],
        goalsWithProgress: [],
      };
    }

    /**
     * 第二组查询：并行读取最近授课记录和当前教学目标。
     * 这两个查询互不依赖，所以用 Promise.all 同时发出。
     */
    const [lessonResult, goalsResult] = await Promise.all([
      supabase
        .from("lesson_records")
        .select(
          "id, class_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback"
        )
        .eq("teacher_id", activeTeacher.id)
        .order("lesson_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3),

      supabase
        .from("teaching_goals")
        .select(
          "id, class_id, title, description, start_date, expected_lessons, status"
        )
        .eq("teacher_id", activeTeacher.id)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

    if (lessonResult.error) {
      throw new Error(`读取授课记录失败：${lessonResult.error.message}`);
    }

    if (goalsResult.error) {
      throw new Error(`读取教学目标失败：${goalsResult.error.message}`);
    }

    const teachingGoals = (goalsResult.data || []) as TeachingGoal[];
    const goalIds = teachingGoals.map((goal) => goal.id);

    /**
     * 第三次查询：
     * 如果有正在进行的教学目标，就查这些目标下面已经有多少授课记录。
     *
     * 这里目前还需要单独查 lesson_records(id, goal_id)，
     * 因为主页要显示每个目标的 completed_lessons。
     */
    let lessonRecordsForGoals: { id: string; goal_id: string | null }[] = [];

    if (goalIds.length > 0) {
      const { data: progressData, error: progressError } = await supabase
        .from("lesson_records")
        .select("id, goal_id")
        .in("goal_id", goalIds);

      if (progressError) {
        throw new Error(`读取目标进度失败：${progressError.message}`);
      }

      lessonRecordsForGoals =
        (progressData || []) as { id: string; goal_id: string | null }[];
    }

    /**
     * 在前端计算每个 goal 已完成几节课。
     */
    const goalProgressMap = new Map<string, number>();

    lessonRecordsForGoals.forEach((record) => {
      if (!record.goal_id) return;

      const currentCount = goalProgressMap.get(record.goal_id) || 0;
      goalProgressMap.set(record.goal_id, currentCount + 1);
    });

    const goalsWithProgress: TeachingGoalWithProgress[] = teachingGoals.map(
      (goal) => ({
        ...goal,
        completed_lessons: goalProgressMap.get(goal.id) || 0,
      })
    );

    return {
      classRelations,
      studentsInClasses,
      lessonRecords: (lessonResult.data || []) as LessonRecord[],
      goalsWithProgress,
    };
  }

  /* =========================
     5. 页面加载：currentTeacher 准备好后读取主页业务数据
     ========================= */

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsLoadingTeacherData(true);
      setMessage("");

      try {
        const loadedPageData = await loadTeacherHomePageData(currentTeacher);

        if (!isMounted) return;

        setPageData(loadedPageData);
      } catch (error) {
        if (!isMounted) return;

        const errorMessage =
          error instanceof Error ? error.message : "读取小老师数据失败。";

        setMessage(errorMessage);
        setPageData(null);
      } finally {
        if (isMounted) {
          setIsLoadingTeacherData(false);
        }
      }
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [currentTeacher]);

  /* =========================
     6. 操作函数：结束一个教学目标
     ========================= */

  async function completeGoal(goalId: string) {
    setIsCompletingGoal(true);
    setMessage("");

    /**
     * 这里仍然带上 teacher_id 条件。
     * 即使前端传错 goalId，也只能更新当前老师自己的目标。
     * 真正安全还要继续依赖 Supabase RLS。
     */
    const { error } = await supabase
      .from("teaching_goals")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", goalId)
      .eq("teacher_id", currentTeacher.id)
      .neq("status", "completed");

    if (error) {
      setMessage(`结束目标失败：${error.message}`);
      setIsCompletingGoal(false);
      return;
    }

    /**
     * 局部更新：
     * 原来是结束目标后重新 fetchTeacherData() 全量重查。
     * 现在只把这个目标从当前页面的 active goals 里移除。
     */
    setPageData((currentPageData) => {
      if (!currentPageData) return currentPageData;

      return {
        ...currentPageData,
        goalsWithProgress: currentPageData.goalsWithProgress.filter(
          (goal) => goal.id !== goalId
        ),
      };
    });

    setMessage("教学目标已结束。");
    setIsCompletingGoal(false);
  }

  /* =========================
     7. 派生数据：把 pageData 整理成页面更好用的格式
     ========================= */

  const classRelations = pageData?.classRelations || [];
  const studentsInClasses = pageData?.studentsInClasses || [];
  const lessonRecords = pageData?.lessonRecords || [];
  const goalsWithProgress = pageData?.goalsWithProgress || [];

  const classes = useMemo(() => {
    return classRelations
      .map((relation) => relation.classes)
      .filter((classItem): classItem is ClassRow => Boolean(classItem));
  }, [classRelations]);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();

    classRelations.forEach((relation) => {
      if (relation.class_id && relation.classes?.name) {
        map.set(relation.class_id, relation.classes.name);
      }
    });

    return map;
  }, [classRelations]);

  const activeStudents = useMemo(() => {
    return studentsInClasses
      .map((relation) => relation.students)
      .filter((student): student is StudentRow => Boolean(student))
      .filter((student) => student.status !== "withdrawn")
      .filter((student) => student.status !== "archived");
  }, [studentsInClasses]);

  const studentNames = useMemo(() => {
    return activeStudents.map((student) => student.name);
  }, [activeStudents]);

  /* =========================
     8. 页面渲染
     ========================= */

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <div className="mx-auto max-w-7xl">
        {message && (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          {/* 左侧栏：老师身份、负责班级、学生名单、快捷入口 */}
          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#cfe8d6] text-xl font-bold text-emerald-950">
                  {currentTeacher.name?.slice(0, 1) || "师"}
                </div>

                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    当前小老师
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-emerald-950">
                    {currentTeacher.name}
                  </h2>

                  {currentTeacher.email && (
                    <p className="mt-1 text-xs text-stone-500">
                      {currentTeacher.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-emerald-100 pt-5 text-sm leading-6 text-stone-600">
                <p>
                  <span className="font-semibold text-stone-800">
                    负责班级：
                  </span>
                  {classes.length > 0
                    ? classes.map((classItem) => classItem.name).join("、")
                    : "暂无班级"}
                </p>

                <p>
                  <span className="font-semibold text-stone-800">学生：</span>
                  {studentNames.length > 0 ? studentNames.join("、") : "暂无学生"}
                </p>
              </div>
            </section>

            {/* 我的班级 */}
            <section className="rounded-[2rem] border border-emerald-100 bg-[#fffdf4] p-7 shadow-sm">
              <h2 className="mt-3 text-2xl font-bold text-emerald-950">
                我的班级
              </h2>

              <div className="mt-5 space-y-4">
                {classes.length === 0 ? (
                  <p className="rounded-2xl bg-white/80 p-5 text-sm leading-7 text-stone-600">
                    暂时没有分配班级。请先在管理员端给这个小老师分配班级。
                  </p>
                ) : (
                  classes.map((classItem) => {
                    const studentsForClass = studentsInClasses
                      .filter(
                        (relation) =>
                          relation.class_id === classItem.id &&
                          relation.students &&
                          relation.students.status !== "withdrawn" &&
                          relation.students.status !== "archived"
                      )
                      .map((relation) => relation.students)
                      .filter(
                        (student): student is StudentRow => Boolean(student)
                      );

                    return (
                      <div
                        key={classItem.id}
                        className="rounded-2xl border border-emerald-100 bg-white/80 p-5"
                      >
                        <p className="font-bold text-emerald-950">
                          {classItem.name}
                        </p>

                        <p className="mt-1 text-xs text-stone-500">
                          {classItem.cohorts?.name || "未设置届别"}
                        </p>

                        <div className="mt-3 space-y-2">
                          {studentsForClass.length === 0 ? (
                            <p className="text-sm leading-6 text-stone-500">
                              这个班级暂时没有学生。
                            </p>
                          ) : (
                            studentsForClass.map((student) => (
                              <div
                                key={student.id}
                                className="rounded-xl bg-[#f6f5e9] px-4 py-3"
                              >
                                <p className="text-sm font-semibold text-emerald-950">
                                  {student.name}
                                </p>

                                {student.note && (
                                  <p className="mt-1 text-xs leading-5 text-stone-500">
                                    {student.note}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* 快捷入口 */}
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                更多
              </p>

              <div className="mt-5 space-y-3">
                <Link
                  href="/teacher/all-records"
                  className="block rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  查看全部记录
                </Link>

                <Link
                  href="/teacher/stats"
                  className="block rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  查看个人统计
                </Link>

                <Link
                  href="/teacher/new-goal"
                  className="block rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  设置新目标
                </Link>
              </div>
            </section>
          </aside>

          {/* 右侧主内容：目标与最近授课记录 */}
          <section className="space-y-8">
            {isLoadingTeacherData ? (
              <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
                <p className="text-sm text-stone-600">
                  正在读取小老师数据...
                </p>
              </section>
            ) : (
              <>
                {/* 当前教学目标 */}
                <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <h2 className="text-3xl font-bold text-emerald-950">
                        当前教学目标
                      </h2>

                      <p className="mt-3 leading-7 text-stone-600">
                        这里显示还在进行中的阶段目标。结束后的目标会进入全部目标记录。
                      </p>
                    </div>
                  </div>

                  <div className="mt-8">
                    {goalsWithProgress.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6">
                        <p className="leading-7 text-stone-600">
                          目前还没有进行中的教学目标。可以先创建一个阶段目标，再围绕目标添加授课记录。
                        </p>

                        <Link
                          href="/teacher/new-goal"
                          className="mt-4 inline-block rounded-full bg-[#2f5d50] px-5 py-3 font-semibold text-white transition hover:bg-emerald-900"
                        >
                          设置一个目标
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {goalsWithProgress.map((goal) => {
                          const expectedLessons = goal.expected_lessons || 0;
                          const completedLessons = goal.completed_lessons;

                          const progressPercent =
                            expectedLessons > 0
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (completedLessons / expectedLessons) * 100
                                  )
                                )
                              : 0;

                          return (
                            <article
                              key={goal.id}
                              className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6"
                            >
                              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                                <div>
                                  <h3 className="text-2xl font-bold text-emerald-950">
                                    {goal.title}
                                  </h3>

                                  {goal.class_id && (
                                    <p className="mt-2 text-sm font-semibold text-emerald-700">
                                      {classNameById.get(goal.class_id) ||
                                        "未知班级"}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  <Link
                                    href={`/teacher/edit-goal/${goal.id}`}
                                    className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                                  >
                                    修改
                                  </Link>

                                  <button
                                    type="button"
                                    onClick={() => completeGoal(goal.id)}
                                    disabled={isCompletingGoal}
                                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    结束
                                  </button>
                                </div>
                              </div>

                              {goal.description && (
                                <p className="mt-4 leading-8 text-stone-700">
                                  {goal.description}
                                </p>
                              )}

                              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-500">
                                <span>
                                  计划课次：
                                  <strong className="font-semibold text-stone-700">
                                    {expectedLessons > 0
                                      ? `${expectedLessons} 节`
                                      : "未设置"}
                                  </strong>
                                </span>

                                <span>
                                  当前进度：
                                  <strong className="font-semibold text-stone-700">
                                    {completedLessons} / {expectedLessons || "?"}{" "}
                                    节
                                  </strong>
                                </span>

                                <span>
                                  开始日期：
                                  <strong className="font-semibold text-stone-700">
                                    {goal.start_date || "未设置"}
                                  </strong>
                                </span>
                              </div>

                              <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100">
                                <div
                                  className="h-full rounded-full bg-[#2f5d50]"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>

                              <p className="mt-2 text-xs text-stone-500">
                                已完成 {progressPercent}%。
                                {expectedLessons > 0 &&
                                completedLessons > expectedLessons
                                  ? " 实际课次已经超过原计划，可以考虑修改计划课次。"
                                  : ""}
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                {/* 最近授课记录 */}
                <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <h2 className="text-3xl font-bold text-emerald-950">
                        最近授课记录
                      </h2>

                      <p className="mt-3 leading-7 text-stone-600">
                        这里显示当前小老师最近填写的课程记录。
                      </p>
                    </div>

                    <Link
                      href="/teacher/new-record"
                      className="w-fit rounded-full bg-[#cfe8d6] px-6 py-3 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-[#bfe0c8]"
                    >
                      添加记录
                    </Link>
                  </div>

                  <div className="mt-8 space-y-5">
                    {lessonRecords.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6">
                        <p className="leading-7 text-stone-600">
                          目前还没有授课记录。添加一条记录后，这里会自动显示。
                        </p>
                      </div>
                    ) : (
                      lessonRecords.map((record) => (
                        <article
                          key={record.id}
                          className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6"
                        >
                          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                            <div>
                              <p className="text-sm font-semibold text-emerald-700">
                                {record.lesson_date}｜{record.duration_minutes}{" "}
                                分钟
                              </p>

                              <h3 className="mt-2 text-2xl font-bold text-emerald-950">
                                {record.lesson_title}
                              </h3>
                            </div>

                            <p className="w-fit rounded-full bg-[#f6f5e9] px-4 py-2 text-sm font-semibold text-stone-600">
                              {record.class_id
                                ? classNameById.get(record.class_id) ||
                                  "未知班级"
                                : "未关联班级"}
                            </p>
                          </div>

                          <p className="mt-4 whitespace-pre-line leading-8 text-stone-700">
                            {record.lesson_content_and_feedback}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}