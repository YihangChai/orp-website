import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";

const DEMO_STUDENT_ID = "77777777-7777-7777-7777-777777777777";
const DEMO_STUDENT_NAME = "学生 A";
const DEMO_CLASS_ID = "22222222-2222-2222-2222-222222222222";

type LessonRecord = {
  id: string;
  lesson_date: string;
  duration_minutes: number;
  lesson_title: string;
  lesson_content_and_feedback: string;
  homework: string | null;
  next_plan: string | null;
  material_link: string | null;
  created_at: string;
};

type StudentLessonComment = {
  id: string;
  lesson_record_id: string;
  student_name: string | null;
  comment: string;
  created_at: string;
};

export const dynamic = "force-dynamic";

export default async function StudentLessonsPage() {
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

  const { data: recordsFromSupabase } = await supabase
    .from("lesson_records")
    .select(
      "id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, homework, next_plan, material_link, created_at"
    )
    .eq("class_id", DEMO_CLASS_ID)
    .order("lesson_date", { ascending: false })
    .order("created_at", { ascending: false });

  const records = (recordsFromSupabase || []) as LessonRecord[];

  const { data: commentsFromSupabase } = await supabase
    .from("student_lesson_comments")
    .select("id, lesson_record_id, student_name, comment, created_at")
    .eq("student_id", DEMO_STUDENT_ID)
    .order("created_at", { ascending: false });

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

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-4xl">
        <Link
          href="/student"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← 返回学生首页
        </Link>

        <div className="mt-6 rounded-[2rem] bg-[#2f5d50] px-6 py-8 text-white shadow-sm md:px-8">
          <h1 className="mt-3 text-3xl font-bold">我的课程记录</h1>
          <p className="mt-4 max-w-2xl leading-8 text-emerald-50">
            这里保存每一次上课的内容。想复习的时候，可以从最近一节课开始看。
          </p>
        </div>

        <section className="mt-6">
          {records.length === 0 ? (
            <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
              <p className="leading-7 text-stone-600">
                目前还没有课程记录。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => {
                const lessonComments =
                  commentsByLesson.get(record.id) || [];

                return (
                  <details
                    key={record.id}
                    className="group rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div>
                          <p className="text-sm text-stone-500">
                            {record.lesson_date} · {record.duration_minutes} 分钟
                          </p>

                          <h2 className="mt-2 text-xl font-bold text-emerald-950">
                            {record.lesson_title}
                          </h2>

                          <p className="mt-2 line-clamp-2 text-sm leading-7 text-stone-600">
                            {record.lesson_content_and_feedback}
                          </p>
                        </div>

                        <div className="w-fit rounded-full border border-emerald-200 px-3 py-1.5 text-sm font-semibold text-emerald-800 group-open:bg-emerald-50">
                          <span className="group-open:hidden">展开</span>
                          <span className="hidden group-open:inline">收起</span>
                        </div>
                      </div>
                    </summary>

                    <div className="mt-5 border-t border-emerald-100 pt-5">
                      <div className="space-y-5">
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">
                            这节课学了什么
                          </p>

                          <p className="mt-2 leading-8 text-stone-700">
                            {record.lesson_content_and_feedback}
                          </p>
                        </div>

                        {record.homework && (
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">
                              课后小任务
                            </p>

                            <p className="mt-2 leading-8 text-stone-700">
                              {record.homework}
                            </p>
                          </div>
                        )}

                        {record.next_plan && (
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">
                              下次课预告
                            </p>

                            <p className="mt-2 leading-8 text-stone-700">
                              {record.next_plan}
                            </p>
                          </div>
                        )}

                        {record.material_link && (
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">
                              学习材料
                            </p>

                            <p className="mt-2 break-all leading-7 text-stone-700">
                              {record.material_link}
                            </p>
                          </div>
                        )}

                        <div className="rounded-2xl bg-[#fffdf4] p-5">
                          <p className="text-sm font-semibold text-emerald-700">
                            我的留言
                          </p>

                          {lessonComments.length > 0 ? (
                            <div className="mt-3 space-y-3">
                              {lessonComments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="rounded-xl bg-white p-4"
                                >
                                  <p className="text-sm leading-7 text-stone-700">
                                    {comment.comment}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm leading-7 text-stone-500">
                              你还没有给这节课留言。
                            </p>
                          )}

                          <form action={submitComment} className="mt-4">
                            <input
                              type="hidden"
                              name="lesson_record_id"
                              value={record.id}
                            />

                            <textarea
                              name="comment"
                              rows={3}
                              placeholder="我想对小老师说……"
                              className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-emerald-500"
                            />

                            <button
                              type="submit"
                              className="mt-3 rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
                            >
                              提交留言
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}