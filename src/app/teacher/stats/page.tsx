import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const DEMO_TEACHER_ID = "11111111-1111-1111-1111-111111111111";

type LessonRecord = {
  id: string;
  goal_id: string | null;
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

export const dynamic = "force-dynamic";

export default async function TeacherStatsPage() {
  const { data: recordsFromSupabase } = await supabase
    .from("lesson_records")
    .select(
      "id, goal_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, teacher_reflection, created_at"
    )
    .eq("teacher_id", DEMO_TEACHER_ID)
    .order("lesson_date", { ascending: false })
    .order("created_at", { ascending: false });

  const records = (recordsFromSupabase || []) as LessonRecord[];

  const { data: goalsFromSupabase } = await supabase
    .from("teaching_goals")
    .select("id, title, expected_lessons, status, created_at, completed_at")
    .eq("teacher_id", DEMO_TEACHER_ID)
    .order("created_at", { ascending: false });

  const goals = (goalsFromSupabase || []) as TeachingGoal[];

  const { data: commentsFromSupabase } = await supabase
    .from("student_lesson_comments")
    .select("id, lesson_record_id, student_name, comment, created_at")
    .order("created_at", { ascending: false });

  const comments = (commentsFromSupabase || []) as StudentLessonComment[];

  const totalLessons = records.length;

  const totalMinutes = records.reduce((sum, record) => {
    return sum + (record.duration_minutes || 0);
  }, 0);

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const averageDuration =
    totalLessons > 0 ? Math.round(totalMinutes / totalLessons) : 0;

  const currentMonth = new Date().toISOString().slice(0, 7);

  const thisMonthRecords = records.filter((record) => {
    return record.lesson_date.slice(0, 7) === currentMonth;
  });

  const thisMonthMinutes = thisMonthRecords.reduce((sum, record) => {
    return sum + (record.duration_minutes || 0);
  }, 0);

  const thisMonthHours = Math.floor(thisMonthMinutes / 60);
  const thisMonthRemainingMinutes = thisMonthMinutes % 60;

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const completedGoals = goals.filter((goal) => goal.status === "completed");

  const goalProgressMap = new Map<string, number>();

  records.forEach((record) => {
    if (!record.goal_id) return;

    const currentCount = goalProgressMap.get(record.goal_id) || 0;
    goalProgressMap.set(record.goal_id, currentCount + 1);
  });

  const monthlyStatsMap = new Map<
    string,
    {
      lessonCount: number;
      totalMinutes: number;
    }
  >();

  records.forEach((record) => {
    const month = record.lesson_date.slice(0, 7);

    const currentMonthStats = monthlyStatsMap.get(month) || {
      lessonCount: 0,
      totalMinutes: 0,
    };

    monthlyStatsMap.set(month, {
      lessonCount: currentMonthStats.lessonCount + 1,
      totalMinutes: currentMonthStats.totalMinutes + record.duration_minutes,
    });
  });

  const monthlyStats = Array.from(monthlyStatsMap.entries())
    .map(([month, stats]) => ({
      month,
      lessonCount: stats.lessonCount,
      totalMinutes: stats.totalMinutes,
    }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 6);

  const latestComment = comments[0];

  const recordsWithReflection = records.filter((record) => {
    return record.teacher_reflection && record.teacher_reflection.trim() !== "";
  });

  const latestReflectionRecord = recordsWithReflection[0];

  const recentRecords = records.slice(0, 5);

  const warmSummary =
    totalLessons > 0
      ? `你已经陪伴学生完成了 ${totalLessons} 节课，累计留下了 ${totalHours} 小时${
          remainingMinutes > 0 ? ` ${remainingMinutes} 分钟` : ""
        }的教学时间。`
      : "这里会记录你和学生一起走过的教学旅程。第一节课之后，这里就会开始出现属于你的教学回顾。";

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-8 text-stone-800">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/teacher"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← 返回小老师主页
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[#2f5d50] text-white shadow-sm">
          <div className="px-6 py-8 md:px-8 md:py-9">
            <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight md:text-4xl">
              你的教学回顾
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-8 text-emerald-50">
              {warmSummary}
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-emerald-50">累计授课</p>
                <p className="mt-1 text-3xl font-bold">{totalLessons}</p>
                <p className="mt-1 text-xs text-emerald-100">节课</p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-emerald-50">累计时长</p>
                <p className="mt-1 text-3xl font-bold">
                  {totalHours}
                  <span className="ml-1 text-lg">h</span>
                  {remainingMinutes > 0 && (
                    <span className="ml-1 text-lg">{remainingMinutes}m</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-emerald-100">
                  平均每节 {averageDuration || 0} 分钟
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-emerald-50">本月陪伴</p>
                <p className="mt-1 text-3xl font-bold">
                  {thisMonthRecords.length}
                </p>
                <p className="mt-1 text-xs text-emerald-100">
                  次
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-emerald-50">学生回应</p>
                <p className="mt-1 text-3xl font-bold">{comments.length}</p>
                <p className="mt-1 text-xs text-emerald-100">条留言</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">教学旅程</h2>

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
                  {monthlyStats.map((monthStat) => {
                    const monthHours = Math.floor(
                      monthStat.totalMinutes / 60
                    );
                    const monthRemainingMinutes =
                      monthStat.totalMinutes % 60;

                    const width =
                      totalLessons > 0
                        ? Math.max(
                            8,
                            Math.round(
                              (monthStat.lessonCount / totalLessons) * 100
                            )
                          )
                        : 0;

                    return (
                      <article key={monthStat.month} className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-bold text-emerald-950">
                              {monthStat.month}
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              {monthStat.lessonCount} 节课 · {monthHours} 小时
                              {monthRemainingMinutes > 0
                                ? ` ${monthRemainingMinutes} 分钟`
                                : ""}
                            </p>
                          </div>

                          <p className="text-xs font-semibold text-emerald-800">
                            {monthStat.lessonCount} 次出现
                          </p>
                        </div>

                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                          <div
                            className="h-full rounded-full bg-[#2f5d50]"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </article>
                    );
                  })}
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
                <p className="text-xs text-stone-500">正在推进</p>
                <p className="mt-1 text-2xl font-bold text-emerald-950">
                  {activeGoals.length}
                </p>
                <p className="mt-1 text-xs text-stone-500">个学习计划</p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
                <p className="text-xs text-stone-500">已经完成</p>
                <p className="mt-1 text-2xl font-bold text-emerald-950">
                  {completedGoals.length}
                </p>
                <p className="mt-1 text-xs text-stone-500">段学习旅程</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {goals.length === 0 ? (
                <p className="rounded-2xl bg-[#fffdf4] p-4 text-sm leading-7 text-stone-600">
                  目前还没有教学目标。之后你创建的学习计划会显示在这里。
                </p>
              ) : (
                goals.slice(0, 4).map((goal) => {
                  const expectedLessons = goal.expected_lessons || 0;
                  const completedLessons = goalProgressMap.get(goal.id) || 0;

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
                              {isCompleted ? "已完成" : "进行中"}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-stone-500">
                            已推进 {completedLessons} /{" "}
                            {expectedLessons || "?"} 节
                          </p>
                        </div>

                        <p className="text-xs font-semibold text-emerald-800">
                          {progressPercent}%
                        </p>
                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
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

            {goals.length > 4 && (
              <Link
                href="/teacher/goals"
                className="mt-4 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              >
                查看全部学习计划 →
              </Link>
            )}
          </div>
        </section>

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
                      {record.lesson_date} · {record.duration_minutes} 分钟
                    </p>

                    <h3 className="mt-1 text-sm font-bold text-emerald-950">
                      {record.lesson_title}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-600">
                      {record.lesson_content_and_feedback}
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
                <p className="text-xs text-stone-500">累计学生留言</p>
                <p className="mt-1 text-2xl font-bold text-emerald-950">
                  {comments.length}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  条来自学生的回应
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
                <p className="text-xs text-stone-500">教学反思</p>
                <p className="mt-1 text-2xl font-bold text-emerald-950">
                  {recordsWithReflection.length}
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
                      {latestComment.student_name || "学生"}
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
                      {latestReflectionRecord.lesson_title}
                    </p>

                    <p className="mt-1 line-clamp-4 text-sm leading-6 text-stone-600">
                      {latestReflectionRecord.teacher_reflection}
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