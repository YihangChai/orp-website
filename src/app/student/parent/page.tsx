"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getCurrentStudent } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type CurrentStudentSession = {
  studentId: string;
  studentName: string;
  username: string | null;
  loggedInAt: string;
};

type StudentRow = {
  id: string;
  name: string;
  username: string | null;
  status: string;
};

type ClassRelation = {
  class_id: string;
};

type TeachingGoal = {
  id: string;
  title: string;
  description: string | null;
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

export default function ParentModePage() {
  const [session, setSession] = useState<CurrentStudentSession | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [classId, setClassId] = useState("");

  const [goals, setGoals] = useState<TeachingGoal[]>([]);
  const [records, setRecords] = useState<LessonRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchParentData(activeSession: CurrentStudentSession) {
    setIsLoading(true);
    setMessage("");

    const { data: studentFromSupabase, error: studentError } = await supabase
      .from("students")
      .select("id, name, username, status")
      .eq("id", activeSession.studentId)
      .maybeSingle();

    if (studentError) {
      setMessage(`读取学生资料失败：${studentError.message}`);
      setIsLoading(false);
      return;
    }

    if (!studentFromSupabase) {
      setMessage("没有找到学生资料，请重新登录。");
      setIsLoading(false);
      return;
    }

    const studentData = studentFromSupabase as StudentRow;

    if (
      studentData.status === "withdrawn" ||
      studentData.status === "archived"
    ) {
      setMessage("这个学生账号当前不可用。如有疑问，请联系 ORP 管理员。");
      setIsLoading(false);
      return;
    }

    const { data: relationFromSupabase, error: relationError } = await supabase
      .from("class_students")
      .select("class_id")
      .eq("student_id", activeSession.studentId);

    if (relationError) {
      setMessage(`读取班级关系失败：${relationError.message}`);
      setIsLoading(false);
      return;
    }

    const relations = (relationFromSupabase || []) as ClassRelation[];
    const relation = relations[0];

    if (!relation) {
      setMessage("没有找到班级信息，请联系 ORP 管理员。");
      setIsLoading(false);
      return;
    }

    if (relations.length > 1) {
      setMessage(
        "系统检测到这个学生关联了多个班级。当前家长模式默认显示第一个班级。"
      );
    }

    const activeClassId = relation.class_id;

    const { data: goalsFromSupabase, error: goalsError } = await supabase
      .from("teaching_goals")
      .select(
        "id, title, description, expected_lessons, status, created_at, completed_at"
      )
      .eq("class_id", activeClassId)
      .order("created_at", { ascending: false });

    if (goalsError) {
      setMessage(`读取学习计划失败：${goalsError.message}`);
      setIsLoading(false);
      return;
    }

    const { data: recordsFromSupabase, error: recordsError } = await supabase
      .from("lesson_records")
      .select(
        "id, goal_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, homework, next_plan, material_link, created_at"
      )
      .eq("class_id", activeClassId)
      .order("lesson_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (recordsError) {
      setMessage(`读取课程记录失败：${recordsError.message}`);
      setIsLoading(false);
      return;
    }

    setStudent(studentData);
    setClassId(activeClassId);
    setGoals((goalsFromSupabase || []) as TeachingGoal[]);
    setRecords((recordsFromSupabase || []) as LessonRecord[]);
    setIsLoading(false);
  }

  useEffect(() => {
    async function loadCurrentStudent() {
      setIsLoading(true);
      setMessage("");

      const currentStudent = await getCurrentStudent();

      if (!currentStudent) {
        localStorage.removeItem("orp_student_session");
        setSession(null);
        setIsLoading(false);
        return;
      }

      const activeSession: CurrentStudentSession = {
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        username: currentStudent.username,
        loggedInAt: new Date().toISOString(),
      };

      localStorage.setItem("orp_student_session", JSON.stringify(activeSession));

      setSession(activeSession);
      await fetchParentData(activeSession);
    }

    loadCurrentStudent();
  }, []);

  async function submitParentMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !student || !classId) {
      setMessage("登录状态或班级信息无效，请重新登录后再留言。");
      return;
    }

    setIsSubmittingMessage(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);

    const parentName = String(formData.get("parent_name") || "").trim();
    const parentMessage = String(formData.get("message") || "").trim();

    if (!parentMessage) {
      setMessage("留言内容不能为空。");
      setIsSubmittingMessage(false);
      return;
    }

    const { error } = await supabase.from("parent_messages").insert({
      student_id: session.studentId,
      student_name: student.name,
      parent_name: parentName || `${student.name} 家长`,
      class_id: classId,
      message: parentMessage,
    });

    if (error) {
      setMessage(`提交留言失败：${error.message}`);
      setIsSubmittingMessage(false);
      return;
    }

    event.currentTarget.reset();
    setMessage("留言已提交，感谢你的反馈。");
    setIsSubmittingMessage(false);
  }

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const completedGoals = goals.filter((goal) => goal.status === "completed");

  const totalLessons = records.length;

  const totalMinutes = records.reduce((sum, record) => {
    return sum + (record.duration_minutes || 0);
  }, 0);

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const latestRecord = records[0];

  const goalProgressMap = new Map<string, number>();

  records.forEach((record) => {
    if (!record.goal_id) return;

    const currentCount = goalProgressMap.get(record.goal_id) || 0;
    goalProgressMap.set(record.goal_id, currentCount + 1);
  });

  const learnedGoalTitles = goals.map((goal) => goal.title);

  const learnedGoalSummary =
    learnedGoalTitles.length > 0
      ? learnedGoalTitles.slice(0, 3).join("、")
      : "还没有正式记录的学习计划";

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-600">正在读取家长模式...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#2f5d50]">ORP 家长模式</p>

          <h1 className="mt-2 text-3xl font-bold text-emerald-950">
            请先登录
          </h1>

          <p className="mt-3 text-sm leading-7 text-stone-600">
            请先使用学生账号登录，再进入家长模式查看学习情况。
          </p>

          <Link
            href="/login"
            className="mt-5 inline-block rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            前往登录
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-5xl">
        <Link
          href="/student"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← 返回学生首页
        </Link>

        {message && (
          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-[2rem] bg-[#2f5d50] px-6 py-8 text-white shadow-sm md:px-8">
          <h1 className="mt-3 text-3xl font-bold">
            你好，{student?.name || session.studentName} 家长
          </h1>

          <p className="mt-4 max-w-3xl leading-8 text-emerald-50">
            这里可以查看 {student?.name || session.studentName} 最近的学习情况、课程记录和学习计划。
          </p>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-bold text-emerald-950">
            最近学习概况
          </h2>

          <p className="mt-3 leading-8 text-stone-700">
            你的孩子最近学习了：
            <span className="font-semibold text-emerald-800">
              {learnedGoalSummary}
            </span>
            {learnedGoalTitles.length > 3 && " 等学习内容"}。
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
              <p className="text-sm text-stone-500">累计上课</p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {totalLessons}
              </p>
              <p className="mt-1 text-sm text-stone-500">节课</p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
              <p className="text-sm text-stone-500">累计学习时长</p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {totalHours}
                <span className="ml-1 text-lg">小时</span>
                {remainingMinutes > 0 && (
                  <span className="ml-1 text-lg">{remainingMinutes}分钟</span>
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
              <p className="text-sm text-stone-500">正在学习</p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {activeGoals.length}
              </p>
              <p className="mt-1 text-sm text-stone-500">个学习计划</p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
              <p className="text-sm text-stone-500">已经完成</p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {completedGoals.length}
              </p>
              <p className="mt-1 text-sm text-stone-500">段学习旅程</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">
              最近一次课程
            </h2>

            {latestRecord ? (
              <article className="mt-4 rounded-2xl bg-[#fffdf4] p-5">
                <p className="text-sm text-stone-500">
                  {latestRecord.lesson_date} · {latestRecord.duration_minutes} 分钟
                </p>

                <h3 className="mt-2 text-xl font-bold text-emerald-950">
                  {latestRecord.lesson_title}
                </h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      最近学了什么
                    </p>
                    <p className="mt-2 text-sm leading-7 text-stone-700">
                      {latestRecord.lesson_content_and_feedback}
                    </p>
                  </div>

                  {latestRecord.homework && (
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">
                        课后任务
                      </p>
                      <p className="mt-2 text-sm leading-7 text-stone-700">
                        {latestRecord.homework}
                      </p>
                    </div>
                  )}

                  {latestRecord.next_plan && (
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">
                        下次课预告
                      </p>
                      <p className="mt-2 text-sm leading-7 text-stone-700">
                        {latestRecord.next_plan}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            ) : (
              <p className="mt-4 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                目前还没有课程记录。
              </p>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">
              学习计划
            </h2>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              这里显示孩子正在推进或已经完成的学习目标。
            </p>

            <div className="mt-5 space-y-3">
              {goals.length === 0 ? (
                <p className="rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                  目前还没有学习计划。
                </p>
              ) : (
                goals.slice(0, 5).map((goal) => {
                  const completedLessons = goalProgressMap.get(goal.id) || 0;
                  const expectedLessons = goal.expected_lessons || 0;

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

                          {goal.description && (
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">
                              {goal.description}
                            </p>
                          )}

                          <p className="mt-2 text-xs text-stone-500">
                            已学习 {completedLessons} / {expectedLessons || "?"} 节
                          </p>
                        </div>

                        <p className="text-xs font-semibold text-emerald-800">
                          {progressPercent}%
                        </p>
                      </div>

                      {expectedLessons > 0 && (
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                          <div
                            className="h-full rounded-full bg-[#2f5d50]"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <details className="group mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold text-emerald-950">
                  全部课程记录
                </h2>
              </div>

              <div className="w-fit rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800 group-open:bg-emerald-50">
                <span className="group-open:hidden">展开查看</span>
                <span className="hidden group-open:inline">收起记录</span>
              </div>
            </div>
          </summary>

          <div className="mt-5 border-t border-emerald-100 pt-5">
            {records.length === 0 ? (
              <p className="rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                目前还没有课程记录。
              </p>
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <details
                    key={record.id}
                    className="group/lesson rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div>
                          <p className="text-xs text-stone-500">
                            {record.lesson_date} · {record.duration_minutes} 分钟
                          </p>

                          <h3 className="mt-1 text-sm font-bold text-emerald-950">
                            {record.lesson_title}
                          </h3>

                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-600">
                            {record.lesson_content_and_feedback}
                          </p>
                        </div>

                        <div className="w-fit rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 group-open/lesson:bg-emerald-50">
                          <span className="group-open/lesson:hidden">展开</span>
                          <span className="hidden group-open/lesson:inline">
                            收起
                          </span>
                        </div>
                      </div>
                    </summary>

                    <div className="mt-4 border-t border-emerald-100 pt-4">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">
                            课程内容
                          </p>
                          <p className="mt-2 text-sm leading-7 text-stone-700">
                            {record.lesson_content_and_feedback}
                          </p>
                        </div>

                        {record.homework && (
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">
                              课后任务
                            </p>
                            <p className="mt-2 text-sm leading-7 text-stone-700">
                              {record.homework}
                            </p>
                          </div>
                        )}

                        {record.next_plan && (
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">
                              下次课预告
                            </p>
                            <p className="mt-2 text-sm leading-7 text-stone-700">
                              {record.next_plan}
                            </p>
                          </div>
                        )}

                        {record.material_link && (
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">
                              学习材料
                            </p>
                            <a
                              href={record.material_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block break-all text-sm font-semibold text-emerald-700 underline"
                            >
                              打开学习材料
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </details>

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-bold text-emerald-950">
            给 ORP 留言
          </h2>

          <p className="mt-2 text-sm leading-7 text-stone-600">
            如果家长希望反馈孩子的学习情况、课程时间安排、上课体验或其他建议，欢迎在这里留下一句话。优秀留言可能会被发布在 ORP 网站首页。
          </p>

          <form onSubmit={submitParentMessage} className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-stone-700">
                家长称呼
              </label>

              <input
                name="parent_name"
                placeholder={`${student?.name || session.studentName} 家长`}
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-700">
                留言内容
              </label>

              <textarea
                name="message"
                rows={4}
                placeholder="可以写孩子最近的学习感受、家长建议、课程安排问题等。"
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm leading-7 outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingMessage}
              className="rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmittingMessage ? "提交中..." : "提交留言"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}