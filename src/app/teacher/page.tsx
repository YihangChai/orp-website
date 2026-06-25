import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";

const DEMO_TEACHER_ID = "11111111-1111-1111-1111-111111111111";

type LessonRecord = {
  id: string;
  lesson_date: string;
  duration_minutes: number;
  lesson_title: string;
  lesson_content_and_feedback: string;
};

type TeachingGoal = {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  expected_lessons: number | null;
  status: string;
};

type TeachingGoalWithProgress = TeachingGoal & {
  completed_lessons: number;
};

const students = [
  {
    name: "学生 A",
    grade: "四年级",
    note: "这里之后填写阅读基础、性格特点或上课注意事项。",
  },
  {
    name: "学生 B",
    grade: "四年级",
    note: "这里之后填写学生情况。",
  },
];

export const dynamic = "force-dynamic";

export default async function TeacherPage() {

  async function completeGoal(formData: FormData) {
    "use server";
    const goalId = String(formData.get("goal_id") || "");
    if (!goalId) return;
    await supabase
      .from("teaching_goals")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", goalId)
      .eq("teacher_id", DEMO_TEACHER_ID)
      .neq("status", "completed");
    revalidatePath("/teacher");
  }

  const { data: lessonRecordsFromSupabase } = await supabase
    .from("lesson_records")
    .select(
      "id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback"
    )
    .eq("teacher_id", DEMO_TEACHER_ID)
    .order("lesson_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3);

  const realLessonRecords = (lessonRecordsFromSupabase || []) as LessonRecord[];

  const { data: teachingGoalsFromSupabase } = await supabase
    .from("teaching_goals")
    .select("id, title, description, start_date, expected_lessons, status")
    .eq("teacher_id", DEMO_TEACHER_ID)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const teachingGoals = (teachingGoalsFromSupabase || []) as TeachingGoal[];

  const goalIds = teachingGoals.map((goal) => goal.id);

  const { data: lessonRecordsForGoals } =
    goalIds.length > 0
      ? await supabase
          .from("lesson_records")
          .select("id, goal_id")
          .in("goal_id", goalIds)
      : { data: [] };

  const goalProgressMap = new Map<string, number>();

  (lessonRecordsForGoals || []).forEach((record) => {
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

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <div className="mx-auto max-w-7xl">

        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#cfe8d6] text-xl font-bold text-emerald-950">
                  老师
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-emerald-950">
                    小老师姓名
                  </h2>
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-emerald-100 pt-5 text-sm leading-6 text-stone-600">
                <p>
                  <span className="font-semibold text-stone-800">学生：</span>
                  学生 A、学生 B
                </p>

                <p>
                  <span className="font-semibold text-stone-800">科目：</span>
                  英语/数学
                </p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-emerald-100 bg-[#fffdf4] p-7 shadow-sm">
              <h2 className="mt-3 text-2xl font-bold text-emerald-950">
                我的班级
              </h2>

              <div className="mt-5 space-y-4">
                {students.map((student) => (
                  <div
                    key={student.name}
                    className="rounded-2xl border border-emerald-100 bg-white/80 p-5"
                  >
                    <p className="font-bold text-emerald-950">
                      {student.name}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      {student.note}
                    </p>
                  </div>
                ))}
              </div>
            </section>

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

          <section className="space-y-8">
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
                            </div>

                            <div className="flex items-center gap-3">
                              <Link
                                href={`/teacher/edit-goal/${goal.id}`}
                                className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                              >
                                修改
                              </Link>

                              <form action={completeGoal}>
                                <input
                                  type="hidden"
                                  name="goal_id"
                                  value={goal.id}
                                />

                                <button
                                  type="submit"
                                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100"
                                >
                                  结束
                                </button>
                              </form>
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
                                {completedLessons} / {expectedLessons || "?"} 节
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

            <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <h2 className="text-3xl font-bold text-emerald-950">
                    最近授课记录
                  </h2>
                </div>

                <Link
                  href="/teacher/new-record"
                  className="w-fit rounded-full bg-[#cfe8d6] px-6 py-3 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-[#bfe0c8]"
                >
                  添加记录
                </Link>
              </div>

              <div className="mt-8 space-y-5">
                {realLessonRecords.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6">
                    <p className="leading-7 text-stone-600">
                      目前还没有授课记录。添加一条记录后，这里会自动显示。
                    </p>
                  </div>
                ) : (
                  realLessonRecords.map((record) => (
                    <article
                      key={record.id}
                      className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6"
                    >
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">
                            {record.lesson_date}｜{record.duration_minutes} 分钟
                          </p>

                          <h3 className="mt-2 text-2xl font-bold text-emerald-950">
                            {record.lesson_title}
                          </h3>
                        </div>

                        <p className="w-fit rounded-full bg-[#f6f5e9] px-4 py-2 text-sm font-semibold text-stone-600">
                          秋叶班
                        </p>
                      </div>

                      <p className="mt-4 leading-8 text-stone-700">
                        {record.lesson_content_and_feedback}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}