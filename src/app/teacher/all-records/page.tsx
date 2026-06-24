import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const DEMO_TEACHER_ID = "11111111-1111-1111-1111-111111111111";

type TeachingGoal = {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  expected_lessons: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type LessonRecord = {
  id: string;
  goal_id: string | null;
  lesson_date: string;
  duration_minutes: number;
  lesson_title: string;
  lesson_content_and_feedback: string;
  homework: string | null;
  next_plan: string | null;
  material_link: string | null;
  created_at: string;
};

type GoalWithProgress = TeachingGoal & {
  completed_lessons: number;
};

export const dynamic = "force-dynamic";

export default async function TeacherGoalsPage() {
  const { data: goalsFromSupabase } = await supabase
    .from("teaching_goals")
    .select(
      "id, title, description, start_date, expected_lessons, status, created_at, completed_at"
    )
    .eq("teacher_id", DEMO_TEACHER_ID)
    .order("created_at", { ascending: false });

  const goals = (goalsFromSupabase || []) as TeachingGoal[];

  const { data: recordsFromSupabase } = await supabase
    .from("lesson_records")
    .select(
      "id, goal_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, homework, next_plan, material_link, created_at"
    )
    .eq("teacher_id", DEMO_TEACHER_ID)
    .order("lesson_date", { ascending: false })
    .order("created_at", { ascending: false });

  const records = (recordsFromSupabase || []) as LessonRecord[];

  const goalMap = new Map<string, TeachingGoal>();

  goals.forEach((goal) => {
    goalMap.set(goal.id, goal);
  });

  const goalProgressMap = new Map<string, number>();

  records.forEach((record) => {
    if (!record.goal_id) return;

    const currentCount = goalProgressMap.get(record.goal_id) || 0;
    goalProgressMap.set(record.goal_id, currentCount + 1);
  });

  const goalsWithProgress: GoalWithProgress[] = goals.map((goal) => ({
    ...goal,
    completed_lessons: goalProgressMap.get(goal.id) || 0,
  }));

  const activeGoals = goalsWithProgress.filter(
    (goal) => goal.status === "active"
  );

  const completedGoals = goalsWithProgress.filter(
    (goal) => goal.status === "completed"
  );

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/teacher"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← 返回小老师主页
        </Link>

        <div className="mt-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Teaching Archive
            </p>

            <h1 className="mt-3 text-4xl font-bold text-emerald-950">
              教学目标与全部授课记录
            </h1>

            <p className="mt-4 max-w-3xl leading-8 text-stone-600">
              这里保存你创建过的所有教学目标，以及所有已经提交的授课记录。主页只展示最近内容，这里用于完整回顾和复盘。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/teacher/new-goal"
              className="rounded-full border border-emerald-700 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              设置新目标
            </Link>

            <Link
              href="/teacher/new-record"
              className="rounded-full bg-[#2f5d50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              添加授课记录
            </Link>
          </div>
        </div>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-stone-500">教学目标</p>
            <p className="mt-2 text-4xl font-bold text-emerald-950">
              {goals.length}
            </p>
            <p className="mt-2 text-sm text-stone-500">
              进行中 {activeGoals.length} 个，已结束 {completedGoals.length} 个
            </p>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-stone-500">授课记录</p>
            <p className="mt-2 text-4xl font-bold text-emerald-950">
              {records.length}
            </p>
            <p className="mt-2 text-sm text-stone-500">
              包括已关联目标和未关联目标的课程
            </p>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-stone-500">未关联目标</p>
            <p className="mt-2 text-4xl font-bold text-emerald-950">
              {records.filter((record) => !record.goal_id).length}
            </p>
            <p className="mt-2 text-sm text-stone-500">
              这些课程没有归入具体教学目标
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-3xl font-bold text-emerald-950">
                目标概览
              </h2>

              <p className="mt-3 leading-7 text-stone-600">
                这里列出所有教学目标。进度按照该目标下已经提交的授课记录数量计算。
              </p>
            </div>
          </div>

          <div className="mt-7 space-y-4">
            {goalsWithProgress.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6">
                <p className="leading-7 text-stone-600">
                  目前还没有教学目标。可以先创建一个阶段目标，再围绕目标添加授课记录。
                </p>
              </div>
            ) : (
              goalsWithProgress.map((goal) => {
                const expectedLessons = goal.expected_lessons || 0;
                const completedLessons = goal.completed_lessons;

                const progressPercent =
                  expectedLessons > 0
                    ? Math.min(
                        100,
                        Math.round((completedLessons / expectedLessons) * 100)
                      )
                    : 0;

                const isCompleted = goal.status === "completed";

                return (
                  <article
                    key={goal.id}
                    className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6"
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-2xl font-bold text-emerald-950">
                            {goal.title}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isCompleted
                                ? "bg-stone-100 text-stone-600"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isCompleted ? "已结束" : "进行中"}
                          </span>
                        </div>

                        {goal.description && (
                          <p className="mt-3 leading-7 text-stone-600">
                            {goal.description}
                          </p>
                        )}
                      </div>
                    </div>

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
                          {completedLessons} / {expectedLessons || "?"} 节
                        </strong>
                      </span>

                      <span>
                        开始日期：
                        <strong className="font-semibold text-stone-700">
                          {goal.start_date || "未设置"}
                        </strong>
                      </span>

                      {goal.completed_at && (
                        <span>
                          结束时间：
                          <strong className="font-semibold text-stone-700">
                            {goal.completed_at.slice(0, 10)}
                          </strong>
                        </span>
                      )}
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-[#2f5d50]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
          <div>
            <h2 className="text-3xl font-bold text-emerald-950">
              全部授课记录
            </h2>

            <p className="mt-3 leading-7 text-stone-600">
              所有课程按照上课日期从新到旧排列。是否关联目标不会影响时间顺序。
            </p>
          </div>

          <div className="mt-8">
            {records.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6">
                <p className="leading-7 text-stone-600">
                  目前还没有授课记录。添加记录后，这里会自动显示。
                </p>
              </div>
            ) : (
              <div className="relative space-y-5">
                <div className="absolute bottom-0 left-[15px] top-0 w-px bg-emerald-100" />

                {records.map((record) => {
                  const relatedGoal = record.goal_id
                    ? goalMap.get(record.goal_id)
                    : null;

                  return (
                    <article
                      key={record.id}
                      className="relative grid grid-cols-[32px_1fr] gap-4"
                    >
                      <div className="relative z-10 flex justify-center pt-8">
                        <div className="h-3 w-3 rounded-full bg-[#2f5d50]" />
                      </div>

                      <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6">
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">
                              {record.lesson_date}｜{record.duration_minutes} 分钟
                            </p>

                            <h3 className="mt-2 text-2xl font-bold text-emerald-950">
                              {record.lesson_title}
                            </h3>
                          </div>

                          <span
                            className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
                              relatedGoal
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-stone-100 text-stone-500"
                            }`}
                          >
                            {relatedGoal ? relatedGoal.title : "未关联目标"}
                          </span>
                        </div>

                        <p className="mt-4 leading-8 text-stone-700">
                          {record.lesson_content_and_feedback}
                        </p>

                        {(record.homework ||
                          record.next_plan ||
                          record.material_link) && (
                          <div className="mt-5 space-y-3 border-t border-emerald-100 pt-4 text-sm leading-7 text-stone-600">
                            {record.homework && (
                              <p>
                                <span className="font-semibold text-stone-800">
                                  作业：
                                </span>
                                {record.homework}
                              </p>
                            )}

                            {record.next_plan && (
                              <p>
                                <span className="font-semibold text-stone-800">
                                  下节课计划：
                                </span>
                                {record.next_plan}
                              </p>
                            )}

                            {record.material_link && (
                              <p>
                                <span className="font-semibold text-stone-800">
                                  材料链接：
                                </span>
                                {record.material_link}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}