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
  teacher_reflection: string | null;
  created_at: string;
};

type StudentLessonComment = {
  id: string;
  lesson_record_id: string;
  student_name: string | null;
  comment: string;
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
      "id, goal_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, homework, next_plan, material_link, teacher_reflection, created_at"
    )
    .eq("teacher_id", DEMO_TEACHER_ID)
    .order("lesson_date", { ascending: false })
    .order("created_at", { ascending: false });

  const records = (recordsFromSupabase || []) as LessonRecord[];

  const { data: commentsFromSupabase } = await supabase
    .from("student_lesson_comments")
    .select("id, lesson_record_id, student_name, comment");

  const comments = (commentsFromSupabase || []) as StudentLessonComment[];

  const commentsByLesson = new Map<string, StudentLessonComment[]>();

  comments.forEach((comment) => {
    const existingComments =
      commentsByLesson.get(comment.lesson_record_id) || [];

    commentsByLesson.set(comment.lesson_record_id, [
      ...existingComments,
      comment,
    ]);
  });

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

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/teacher"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← 返回小老师主页
        </Link>

        <div className="mt-8">
          <h1 className="text-4xl font-bold text-emerald-950">
            全部目标与授课记录
          </h1>

          <p className="mt-4 max-w-3xl leading-8 text-stone-600">
            这里保存你创建过的所有教学目标，以及所有已经提交的授课记录。目标用于整理长期计划，授课记录则按照时间顺序排列，方便回顾每一次真实发生的课程。
          </p>
        </div>

        <section className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-7">
          <div>
            <h2 className="text-2xl font-bold text-emerald-950">全部目标</h2>

            <p className="mt-2 leading-7 text-stone-600">
              这里列出所有教学目标。进度按照该目标下已经提交的授课记录数量计算。
            </p>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-100 bg-[#fffdf4]">
            {goalsWithProgress.length === 0 ? (
              <div className="p-5">
                <p className="leading-7 text-stone-600">
                  目前还没有教学目标。可以先创建一个阶段目标，再围绕目标添加授课记录。
                </p>
              </div>
            ) : (
              <div className="divide-y divide-emerald-100">
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

                  const isCompleted = goal.status === "completed";

                  return (
                    <article key={goal.id} className="p-5">
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-bold text-emerald-950">
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
                            <p className="mt-2 line-clamp-2 leading-7 text-stone-600">
                              {goal.description}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 text-sm font-semibold text-emerald-800">
                          {progressPercent}%
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-500">
                        <span>
                          计划：
                          <strong className="font-semibold text-stone-700">
                            {expectedLessons > 0
                              ? `${expectedLessons} 节`
                              : "未设置"}
                          </strong>
                        </span>

                        <span>
                          进度：
                          <strong className="font-semibold text-stone-700">
                            {completedLessons} / {expectedLessons || "?"} 节
                          </strong>
                        </span>

                        <span>
                          开始：
                          <strong className="font-semibold text-stone-700">
                            {goal.start_date || "未设置"}
                          </strong>
                        </span>

                        {goal.completed_at && (
                          <span>
                            结束：
                            <strong className="font-semibold text-stone-700">
                              {goal.completed_at.slice(0, 10)}
                            </strong>
                          </span>
                        )}
                      </div>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                        <div
                          className="h-full rounded-full bg-[#2f5d50]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-7">
          <div>
            <h2 className="text-2xl font-bold text-emerald-950">
              全部授课记录
            </h2>

            <p className="mt-2 leading-7 text-stone-600">
              默认只显示每节课的标题、简短内容和目标标签。点击展开后，可以查看上课时间、课程内容、作业、下节课计划、材料链接、小老师反思和学生留言。
            </p>
          </div>

          <div className="mt-6">
            {records.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-5">
                <p className="leading-7 text-stone-600">
                  目前还没有授课记录。添加记录后，这里会自动显示。
                </p>
              </div>
            ) : (
              <div className="relative space-y-4">
                <div className="absolute bottom-0 left-[12px] top-0 w-px bg-emerald-100" />

                {records.map((record) => {
                  const relatedGoal = record.goal_id
                    ? goalMap.get(record.goal_id)
                    : null;

                  const lessonComments =
                    commentsByLesson.get(record.id) || [];

                  return (
                    <article
                      key={record.id}
                      className="relative grid grid-cols-[26px_1fr] gap-3"
                    >
                      <div className="relative z-10 flex justify-center pt-7">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#2f5d50]" />
                      </div>

                      <details className="group rounded-2xl border border-emerald-100 bg-[#fffdf4] p-5">
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-xl font-bold text-emerald-950">
                                  {record.lesson_title}
                                </h3>

                                <span
                                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                                    relatedGoal
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-stone-100 text-stone-500"
                                  }`}
                                >
                                  {relatedGoal ? relatedGoal.title : "未关联"}
                                </span>
                              </div>

                              <p className="mt-2 line-clamp-2 leading-7 text-stone-600">
                                {record.lesson_content_and_feedback}
                              </p>
                            </div>

                            <div className="shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 transition group-open:bg-emerald-50">
                              <span className="group-open:hidden">展开</span>
                              <span className="hidden group-open:inline">
                                收起
                              </span>
                            </div>
                          </div>
                        </summary>

                        <div className="mt-5 border-t border-emerald-100 pt-5">
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl bg-white p-4">
                              <p className="text-sm text-stone-500">
                                上课日期
                              </p>
                              <p className="mt-1 font-semibold text-emerald-950">
                                {record.lesson_date}
                              </p>
                            </div>

                            <div className="rounded-xl bg-white p-4">
                              <p className="text-sm text-stone-500">
                                授课时长
                              </p>
                              <p className="mt-1 font-semibold text-emerald-950">
                                {record.duration_minutes} 分钟
                              </p>
                            </div>

                            <div className="rounded-xl bg-white p-4">
                              <p className="text-sm text-stone-500">
                                所属目标
                              </p>
                              <p className="mt-1 font-semibold text-emerald-950">
                                {relatedGoal ? relatedGoal.title : "未关联"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 space-y-4">
                            <div>
                              <p className="text-sm font-semibold text-stone-500">
                                课程内容与课堂反馈
                              </p>
                              <p className="mt-2 leading-8 text-stone-700">
                                {record.lesson_content_and_feedback}
                              </p>
                            </div>

                            {record.homework && (
                              <div>
                                <p className="text-sm font-semibold text-stone-500">
                                  课后作业
                                </p>
                                <p className="mt-2 leading-8 text-stone-700">
                                  {record.homework}
                                </p>
                              </div>
                            )}

                            {record.next_plan && (
                              <div>
                                <p className="text-sm font-semibold text-stone-500">
                                  下节课计划
                                </p>
                                <p className="mt-2 leading-8 text-stone-700">
                                  {record.next_plan}
                                </p>
                              </div>
                            )}

                            {record.material_link && (
                              <div>
                                <p className="text-sm font-semibold text-stone-500">
                                  材料链接
                                </p>
                                <p className="mt-2 break-all leading-8 text-stone-700">
                                  {record.material_link}
                                </p>
                              </div>
                            )}

                            {record.teacher_reflection && (
                              <div className="rounded-2xl border border-emerald-100 bg-white p-5">
                                <p className="text-sm font-semibold text-emerald-700">
                                  小老师反思
                                </p>
                                <p className="mt-2 leading-8 text-stone-700">
                                  {record.teacher_reflection}
                                </p>
                              </div>
                            )}

                            <div className="rounded-2xl border border-emerald-100 bg-white p-5">
                              <p className="text-sm font-semibold text-emerald-700">
                                学生留言
                              </p>

                              {lessonComments.length === 0 ? (
                                <p className="mt-2 leading-7 text-stone-500">
                                  这节课还没有学生留言。之后学生提交课后感受后，会显示在这里。
                                </p>
                              ) : (
                                <div className="mt-4 space-y-3">
                                  {lessonComments.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className="rounded-xl bg-[#f6f5e9] p-4"
                                    >
                                      <p className="font-semibold text-emerald-950">
                                        {comment.student_name || "学生"}
                                      </p>

                                      <p className="mt-2 leading-7 text-stone-700">
                                        {comment.comment}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </details>
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