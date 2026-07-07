"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCurrentTeacher } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import TeacherGuard from "@/components/TeacherGuard";

type TeacherSession = {
  teacherId: string;
  teacherName: string;
  email: string | null;
  loggedInAt: string;
};

type ClassItem = {
  id: string;
  name: string;
  school: string | null;
  status: string;
};

type ClassTeacherRelation = {
  class_id: string;
  classes: ClassItem | ClassItem[] | null;
};

type TeachingGoal = {
  id: string;
  class_id: string | null;
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
  class_id: string | null;
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

export default function TeacherGoalsPage() {
  const [teacherSession, setTeacherSession] = useState<TeacherSession | null>(
    null
  );
  const [teacherClass, setTeacherClass] = useState<ClassItem | null>(null);

  const [goals, setGoals] = useState<TeachingGoal[]>([]);
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [comments, setComments] = useState<StudentLessonComment[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function fetchTeacherClass(teacherId: string) {
    const { data, error } = await supabase
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

    if (error) {
      setMessage(`读取小老师班级失败：${error.message}`);
      return null;
    }

    const relations = (data || []) as unknown as ClassTeacherRelation[];

    const classRows = relations
      .map((relation) => {
        if (!relation.classes) return null;

        return Array.isArray(relation.classes)
          ? relation.classes[0] || null
          : relation.classes;
      })
      .filter((classItem): classItem is ClassItem => classItem !== null)
      .filter((classItem) => classItem.status !== "archived");

    if (classRows.length === 0) {
      setMessage("这个小老师还没有绑定班级。请先在管理员端为小老师分配班级。");
      return null;
    }

    if (classRows.length > 1) {
      setMessage(
        "检测到这个小老师绑定了多个班级。当前页面会默认使用第一个班级；后续可以升级为班级下拉选择。"
      );
    }

    return classRows[0];
  }

  async function fetchTeacherRecordsAndGoals(
    teacherId: string,
    classId: string
  ) {
    const { data: goalsFromSupabase, error: goalsError } = await supabase
      .from("teaching_goals")
      .select(
        "id, class_id, title, description, start_date, expected_lessons, status, created_at, completed_at"
      )
      .eq("teacher_id", teacherId)
      .eq("class_id", classId)
      .order("created_at", { ascending: false });

    if (goalsError) {
      setMessage(`读取教学目标失败：${goalsError.message}`);
      return;
    }

    const { data: recordsFromSupabase, error: recordsError } = await supabase
      .from("lesson_records")
      .select(
        "id, goal_id, class_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, homework, next_plan, material_link, teacher_reflection, created_at"
      )
      .eq("teacher_id", teacherId)
      .eq("class_id", classId)
      .order("lesson_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (recordsError) {
      setMessage(`读取授课记录失败：${recordsError.message}`);
      return;
    }

    const lessonRecords = (recordsFromSupabase || []) as LessonRecord[];
    const lessonRecordIds = lessonRecords.map((record) => record.id);

    let commentsFromSupabase: StudentLessonComment[] = [];

    if (lessonRecordIds.length > 0) {
      const { data: commentsData, error: commentsError } = await supabase
        .from("student_lesson_comments")
        .select("id, lesson_record_id, student_name, comment")
        .in("lesson_record_id", lessonRecordIds);

      if (commentsError) {
        setMessage(`读取学生留言失败：${commentsError.message}`);
        return;
      }

      commentsFromSupabase = (commentsData || []) as StudentLessonComment[];
    }

    setGoals((goalsFromSupabase || []) as TeachingGoal[]);
    setRecords(lessonRecords);
    setComments(commentsFromSupabase);
  }

  useEffect(() => {
    async function initPage() {
      setIsLoading(true);
      setMessage("");

      const teacher = await getCurrentTeacher();

      if (!teacher) {
        localStorage.removeItem("orp_teacher_session");
        setTeacherSession(null);
        setIsLoading(false);
        return;
      }

      const activeSession: TeacherSession = {
        teacherId: teacher.id,
        teacherName: teacher.name,
        email: teacher.email,
        loggedInAt: new Date().toISOString(),
      };

      localStorage.setItem("orp_teacher_session", JSON.stringify(activeSession));

      setTeacherSession(activeSession);

      const currentClass = await fetchTeacherClass(teacher.id);

      if (!currentClass) {
        setIsLoading(false);
        return;
      }

      setTeacherClass(currentClass);

      await fetchTeacherRecordsAndGoals(teacher.id, currentClass.id);

      setIsLoading(false);
    }

    initPage();
  }, []);

  const commentsByLesson = useMemo(() => {
    const map = new Map<string, StudentLessonComment[]>();

    comments.forEach((comment) => {
      const existingComments = map.get(comment.lesson_record_id) || [];
      map.set(comment.lesson_record_id, [...existingComments, comment]);
    });

    return map;
  }, [comments]);

  const goalMap = useMemo(() => {
    const map = new Map<string, TeachingGoal>();

    goals.forEach((goal) => {
      map.set(goal.id, goal);
    });

    return map;
  }, [goals]);

  const goalsWithProgress = useMemo(() => {
    const goalProgressMap = new Map<string, number>();

    records.forEach((record) => {
      if (!record.goal_id) return;

      const currentCount = goalProgressMap.get(record.goal_id) || 0;
      goalProgressMap.set(record.goal_id, currentCount + 1);
    });

    const result: GoalWithProgress[] = goals.map((goal) => ({
      ...goal,
      completed_lessons: goalProgressMap.get(goal.id) || 0,
    }));

    return result;
  }, [goals, records]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-6xl">
          <Link
            href="/teacher"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← 返回小老师主页
          </Link>

          <div className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <p className="text-sm text-stone-600">
              正在读取目标与授课记录...
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!teacherSession) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-6xl">
          <Link
            href="/login"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← 前往登录
          </Link>

          <div className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-bold text-emerald-950">
              请先登录
            </h1>

            <p className="mt-3 leading-7 text-stone-600">
              小老师需要使用邮箱和密码登录后，才能查看全部目标与授课记录。
            </p>

            <Link
              href="/login"
              className="mt-5 inline-block rounded-full bg-[#2f5d50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              前往登录
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <TeacherGuard>
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-6xl">
          <Link
            href="/teacher"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← 返回小老师主页
          </Link>

          <div className="mt-8">
            <p className="text-sm font-semibold text-[#2f5d50]">
              当前小老师：{teacherSession.teacherName}
            </p>

            <h1 className="mt-2 text-4xl font-bold text-emerald-950">
              全部目标与授课记录
            </h1>

            <p className="mt-4 max-w-3xl leading-8 text-stone-600">
              这里保存你创建过的所有教学目标，以及所有已经提交的授课记录。当前班级：
              <span className="font-semibold text-emerald-800">
                {teacherClass?.name || "未读取到班级"}
              </span>
              。
            </p>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
              {message}
            </div>
          )}

          <section className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-7">
            <div>
              <h2 className="text-2xl font-bold text-emerald-950">全部目标</h2>

              <p className="mt-2 leading-7 text-stone-600">
                这里列出当前小老师在当前班级下的所有教学目标。进度按照该目标下已经提交的授课记录数量计算。
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

                    const lessonComments = commentsByLesson.get(record.id) || [];

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
                                <p className="mt-2 whitespace-pre-line leading-8 text-stone-700">
                                  {record.lesson_content_and_feedback}
                                </p>
                              </div>

                              {record.homework && (
                                <div>
                                  <p className="text-sm font-semibold text-stone-500">
                                    课后作业
                                  </p>
                                  <p className="mt-2 whitespace-pre-line leading-8 text-stone-700">
                                    {record.homework}
                                  </p>
                                </div>
                              )}

                              {record.next_plan && (
                                <div>
                                  <p className="text-sm font-semibold text-stone-500">
                                    下节课计划
                                  </p>
                                  <p className="mt-2 whitespace-pre-line leading-8 text-stone-700">
                                    {record.next_plan}
                                  </p>
                                </div>
                              )}

                              {record.material_link && (
                                <div>
                                  <p className="text-sm font-semibold text-stone-500">
                                    材料链接
                                  </p>
                                  <a
                                    href={record.material_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-block break-all text-sm font-semibold text-emerald-700 underline"
                                  >
                                    打开材料链接
                                  </a>
                                </div>
                              )}

                              {record.teacher_reflection && (
                                <div className="rounded-2xl border border-emerald-100 bg-white p-5">
                                  <p className="text-sm font-semibold text-emerald-700">
                                    小老师反思
                                  </p>
                                  <p className="mt-2 whitespace-pre-line leading-8 text-stone-700">
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
    </TeacherGuard>
  );
}