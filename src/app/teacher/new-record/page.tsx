"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
const DEMO_TEACHER_ID = "6cd37c11-61dc-4150-bb24-911ba3a6eebd";

type TeachingGoal = {
  id: string;
  title: string;
  expected_lessons: number | null;
};

type ClassStudentItem = {
  id: string;
  name: string;
  note: string | null;
  status: string;
};

const classInfo = {
  id: "887614b6-f449-4757-8b5b-7dfca9a16d7b",
  name: "秋叶班",
  teacher: "小老师姓名",
};


const students = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "学生 A",
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    name: "学生 B",
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    name: "学生 C",
  },
];

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export default function NewRecordPage() {
  const today = getTodayDate();
  const router = useRouter();
  const [goals, setGoals] = useState<TeachingGoal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [students, setStudents] = useState<ClassStudentItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadGoals() {
      setIsLoadingGoals(true);
      fetchClassStudents();

      const { data, error } = await supabase
        .from("teaching_goals")
        .select("id, title, expected_lessons")
        .eq("teacher_id", DEMO_TEACHER_ID)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(`读取教学目标失败：${error.message}`);
        setIsLoadingGoals(false);
        return;
      }

      setGoals((data || []) as TeachingGoal[]);
      setIsLoadingGoals(false);
    }

    loadGoals();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);

    const lessonDate = String(formData.get("lesson_date") || "");
    const durationMinutes = Number(formData.get("duration_minutes"));
    const goalId = String(formData.get("goal_id") || "");
    const lessonTitle = String(formData.get("lesson_title") || "");
    const lessonContentAndFeedback = String(
      formData.get("lesson_content_and_feedback") || ""
    );
    const homework = String(formData.get("homework") || "");
    const nextPlan = String(formData.get("next_plan") || "");
    const materialLink = String(formData.get("material_link") || "");
    const teacherReflection = String(formData.get("teacher_reflection") || "");

    const presentStudentIds = formData.getAll("attendance").map(String);

    if (!lessonDate || !durationMinutes || !lessonTitle || !lessonContentAndFeedback) {
      setMessage("请填写上课日期、授课时长、本节课主题和课程内容。");
      setIsSubmitting(false);
      return;
    }

    const { data: insertedLesson, error: lessonError } = await supabase
      .from("lesson_records")
      .insert({
        teacher_id: DEMO_TEACHER_ID,
        class_id: classInfo.id,
        goal_id: goalId || null,
        lesson_date: lessonDate,
        duration_minutes: durationMinutes,
        lesson_title: lessonTitle,
        lesson_content_and_feedback: lessonContentAndFeedback,
        homework: homework || null,
        next_plan: nextPlan || null,
        material_link: materialLink || null,
        teacher_reflection: teacherReflection || null,
      })
      .select("id")
      .single();

    if (lessonError) {
      console.error(lessonError);
      setMessage(`保存课程记录失败：${lessonError.message}`);
      setIsSubmitting(false);
      return;
    }

    const attendanceRows = students.map((student) => ({
      lesson_record_id: insertedLesson.id,
      student_id: student.id,
      is_present: attendanceMap[student.id] ?? false,
    }));


    if (attendanceRows.length > 0) {
      const { error: attendanceError } = await supabase
        .from("lesson_attendance")
        .insert(attendanceRows);
      if (attendanceError) {
        setMessage(`课程记录已提交，但学生出勤保存失败：${attendanceError.message}`);
        return;
      }
    }

      setMessage("课程记录和学生出勤已提交。");
      setIsSubmitting(false);
      router.push("/teacher");
      router.refresh();
  }
  async function fetchClassStudents() {
    const { data, error } = await supabase
      .from("class_students")
      .select(
        `
        students (
          id,
          name,
          note,
          status
        )
      `
      )
      .eq("class_id", classInfo.id);

    if (error) {
      setMessage(`读取学生名单失败：${error.message}`);
      return;
    }

    const formattedStudents =
      data
        ?.map((item: any) => item.students)
        .filter(Boolean)
        .filter((student: any) => student.status === "active") || [];

    setStudents(formattedStudents);

    const initialAttendance: Record<string, boolean> = {};

    formattedStudents.forEach((student: ClassStudentItem) => {
      initialAttendance[student.id] = true;
    });

    setAttendanceMap(initialAttendance);
  }


  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link
            href="/teacher"
            className="text-sm font-semibold text-emerald-800 hover:text-emerald-950"
          >
            ← 返回小老师主页
          </Link>

          <h1 className="mt-3 text-4xl font-bold text-emerald-950">
            添加授课记录
          </h1>

          <p className="mt-4 leading-8 text-stone-600">
            请记录本节课的基本信息、出勤情况、课程内容和后续计划。
            学生反馈会在课程记录生成后由学生单独留言。
          </p>
        </div>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
          <form onSubmit={handleSubmit} className="space-y-7">
            {/* 基本信息 */}
            <section>
              <h2 className="text-2xl font-bold text-emerald-950">
                基本信息
              </h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    所属班级
                  </label>

                  <input
                    type="text"
                    value={classInfo.name}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-stone-100 px-4 py-3 text-stone-600 outline-none"
                  />

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    班级根据当前小老师账号自动填写，后续不可在这里手动更改。
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    所属课程目标
                  </label>

                  <select
                    name="goal_id"
                    disabled={isLoadingGoals}
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {isLoadingGoals ? "正在读取教学目标..." : "不关联教学目标"}
                    </option>
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                        {goal.expected_lessons ? `（计划 ${goal.expected_lessons} 节）` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    上课日期
                  </label>

                  <input
                    type="date"
                    name="lesson_date"
                    defaultValue={today}
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    默认是今天，也可以手动修改为实际上课日期。
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    授课时长（分钟）
                  </label>

                  <input
                    type="number"
                    name="duration_minutes"
                    placeholder="例如：40"
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-stone-700">
                    本节课主题
                  </label>

                  <input
                    type="text"
                    name="lesson_title"
                    placeholder="例如：小王子第一章 / 自我介绍与阅读导入"
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </section>

            {/* 出勤 */}
            <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-emerald-950">学生出勤</h2>

              <p className="mt-2 text-sm leading-7 text-stone-600">
                默认全部出勤。如果有学生没有参加本节课，请取消勾选。
              </p>

              {students.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-600">
                  当前班级还没有录入学生，暂时无法记录出勤。
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {students.map((student) => (
                    <label
                      key={student.id}
                      className="flex cursor-pointer items-center justify-between rounded-2xl bg-[#fffdf4] p-4 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-emerald-950">{student.name}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {student.note || "暂无备注"}
                        </p>
                      </div>

                      <input
                        type="checkbox"
                        checked={attendanceMap[student.id] ?? false}
                        onChange={(event) => {
                          setAttendanceMap((prev) => ({
                            ...prev,
                            [student.id]: event.target.checked,
                          }));
                        }}
                        className="h-4 w-4"
                      />
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* 课程内容 */}
            <section className="border-t border-emerald-100 pt-7">
              <h2 className="text-2xl font-bold text-emerald-950">
                课程内容与课后安排
              </h2>

              <div className="mt-5 space-y-5">
                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    本节课内容与课堂反馈
                  </label>

                  <textarea
                    name="lesson_content_and_feedback"
                    rows={6}
                    placeholder="记录本节课讲了什么、学生整体理解情况、互动情况、哪里做得好、哪里需要继续练习。"
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-stone-700">
                      课后作业（选填）
                    </label>

                    <textarea
                      name="homework"
                      rows={3}
                      placeholder="例如：复习关键词，完成一段复述。"
                      className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-stone-700">
                      下节课计划（选填）
                    </label>

                    <textarea
                      name="next_plan"
                      rows={3}
                      placeholder="例如：继续阅读下一章，加入开放式问题。"
                      className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    视频 / 材料链接（选填）
                  </label>

                  <input
                    type="url"
                    name="material_link"
                    placeholder="https://..."
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </section>

            {/* 私密反思 */}
            <section className="border-t border-emerald-100 pt-7">
              <div className="rounded-2xl border border-emerald-100 bg-[#edf3df] p-5">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-emerald-950">
                      小老师反思（私密）
                    </h2>

                    <p className="mt-2 leading-7 text-stone-600">
                      这部分只对小老师本人和管理员可见，不会显示给学生。
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-800">
                    私密
                  </span>
                </div>

                <textarea
                  name="teacher_reflection"
                  rows={4}
                  placeholder="例如：这节课哪里顺利？哪里需要调整？下次如何改进？有没有需要管理员或课程部帮助的地方？"
                  className="mt-5 w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                />
              </div>
            </section>

            {/* 保存 */}
            <div className="flex flex-col gap-3 border-t border-emerald-100 pt-6 md:flex-row md:items-center md:justify-between">
              <p className="text-sm leading-6 text-stone-500">
                当前版本会把课程记录保存到 Supabase。正式账号系统完成后，班级和老师信息会自动来自登录身份。
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-[#cfe8d6] px-7 py-3 font-semibold text-emerald-950 shadow-sm hover:bg-[#bfe0c8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "保存中..." : "保存记录"}
              </button>
            </div>

            {message && (
              <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] px-5 py-4 text-sm font-semibold text-emerald-900">
                {message}
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}