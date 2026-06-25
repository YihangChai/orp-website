import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";


const DEMO_STUDENT_ID = "77777777-7777-7777-7777-777777777777";
const DEMO_STUDENT_NAME = "学生 A";
const DEMO_CLASS_ID = "22222222-2222-2222-2222-222222222222";

const studentInfo = {
  name: DEMO_STUDENT_NAME,
  className: "秋叶班",
  classmateName: "学生 A",
  teacherName: "小老师姓名",
};

type TeachingGoal = {
  id: string;
  title: string;
  description: string | null;
  expected_lessons: number | null;
  status: string;
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

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  async function submitComment(formData: FormData) {
    "use server";

    const lessonRecordId = String(formData.get("lesson_record_id") || "");
    const comment = String(formData.get("comment") || "").trim();

    if (!lessonRecordId || !comment) return;

    await supabase.from("student_lesson_comments").insert({
      lesson_record_id: lessonRecordId,
      student_id: DEMO_STUDENT_ID,
      student_name: DEMO_STUDENT_NAME,
      comment,
    });

    revalidatePath("/student");
    revalidatePath("/student/lessons");
  }

  const { data: goalsFromSupabase } = await supabase
    .from("teaching_goals")
    .select("id, title, description, expected_lessons, status")
    .eq("class_id", DEMO_CLASS_ID)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const goals = (goalsFromSupabase || []) as TeachingGoal[];
  const currentGoal = goals[0];

  const { data: recordsFromSupabase } = await supabase
    .from("lesson_records")
    .select(
      "id, goal_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, homework, next_plan, material_link, created_at"
    )
    .eq("class_id", DEMO_CLASS_ID)
    .order("lesson_date", { ascending: false })
    .order("created_at", { ascending: false });

  const records = (recordsFromSupabase || []) as LessonRecord[];
  const latestRecord = records[0];

  const completedLessonsForCurrentGoal = currentGoal
    ? records.filter((record) => record.goal_id === currentGoal.id).length
    : 0;

  const expectedLessons = currentGoal?.expected_lessons || 0;

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-4xl">
        <section className="grid gap-5 md:grid-cols-[0.8fr_1.4fr]">
          <aside className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2f5d50] text-2xl font-bold text-white">
                {studentInfo.name.slice(0, 1)}
              </div>

              <div>
                <p className="text-sm font-semibold text-emerald-700">
                  我的学习信息
                </p>

                <h2 className="mt-1 text-2xl font-bold text-emerald-950">
                  {studentInfo.name}
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-[#fffdf4] px-4 py-3">
                <p className="text-xs text-stone-500">班级</p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">
                  {studentInfo.className}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fffdf4] px-4 py-3">
                <p className="text-xs text-stone-500">同学</p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">
                  {studentInfo.classmateName}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fffdf4] px-4 py-3">
                <p className="text-xs text-stone-500">小老师</p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">
                  {studentInfo.teacherName}
                </p>
              </div>
            </div>
          </aside>

          <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <p className="text-sm font-semibold text-[#2f5d50]">
              ORP 学习空间
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              你好，{DEMO_STUDENT_NAME}
            </h1>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              这里会帮你记住最近学了什么、课后要做什么，也可以给小老师留一句话。
            </p>

            <div className="mt-5 rounded-2xl bg-[#fffdf4] p-5">
              <h2 className="text-lg font-bold text-emerald-950">
                你正在学习
              </h2>

              {currentGoal ? (
                <div className="mt-3">
                  <p className="text-2xl font-bold text-emerald-950">
                    {currentGoal.title}
                  </p>

                  {currentGoal.description && (
                    <p className="mt-3 text-sm leading-7 text-stone-600">
                      {currentGoal.description}
                    </p>
                  )}

                  <p className="mt-4 text-sm font-semibold text-emerald-800">
                    我们已经一起完成了 {completedLessonsForCurrentGoal} /{" "}
                    {expectedLessons || "?"} 节课
                  </p>

                  {expectedLessons > 0 && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-[#2f5d50]"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (completedLessonsForCurrentGoal /
                                expectedLessons) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  目前还没有正在进行的学习计划。
                </p>
              )}
            </div>
          </section>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold text-emerald-950">
                最近一次上课
              </h2>
            </div>

            <Link
              href="/student/lessons"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              查看全部课程
            </Link>
          </div>

          {latestRecord ? (
            <article className="mt-5 rounded-2xl bg-[#fffdf4] p-5">
              <p className="text-sm text-stone-500">
                {latestRecord.lesson_date} · {latestRecord.duration_minutes} 分钟
              </p>

              <h3 className="mt-2 text-2xl font-bold text-emerald-950">
                {latestRecord.lesson_title}
              </h3>

              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    这节课学了什么
                  </p>
                  <p className="mt-2 leading-8 text-stone-700">
                    {latestRecord.lesson_content_and_feedback}
                  </p>
                </div>

                {latestRecord.homework && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      课后小任务
                    </p>
                    <p className="mt-2 leading-8 text-stone-700">
                      {latestRecord.homework}
                    </p>
                  </div>
                )}

                {latestRecord.next_plan && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      下次课预告
                    </p>
                    <p className="mt-2 leading-8 text-stone-700">
                      {latestRecord.next_plan}
                    </p>
                  </div>
                )}

                {latestRecord.material_link && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      学习材料
                    </p>
                    <p className="mt-2 break-all leading-7 text-stone-700">
                      {latestRecord.material_link}
                    </p>
                  </div>
                )}
              </div>

              <form action={submitComment} className="mt-6">
                <input
                  type="hidden"
                  name="lesson_record_id"
                  value={latestRecord.id}
                />

                <label className="text-sm font-semibold text-emerald-700">
                  想对小老师说一句话吗？
                </label>

                <textarea
                  name="comment"
                  rows={4}
                  placeholder="比如：我今天学会了…… / 我还有点没懂…… / 我想对老师说……"
                  className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-emerald-500"
                />

                <button
                  type="submit"
                  className="mt-3 rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
                >
                  提交留言
                </button>
              </form>
            </article>
          ) : (
            <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 leading-7 text-stone-600">
              目前还没有课程记录。
            </p>
          )}
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-bold text-emerald-950">家长模式</h2>

          <p className="mt-2 text-sm leading-7 text-stone-600">
            家长可以查看孩子最近的学习情况、课程记录和学习计划，也可以给
            ORP 留下一些反馈。
          </p>

          <Link
            href="/student/parent"
            className="mt-4 inline-block rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            进入家长模式
          </Link>
        </section>
      </section>
    </main>
  );
}