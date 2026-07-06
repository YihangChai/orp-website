"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentStudent, logoutCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type StudentSession = {
  studentId: string;
  studentName: string;
  username: string | null;
  loggedInAt: string;
};

type StudentRow = {
  id: string;
  name: string;
  status: string;
};

type ClassRelation = {
  class_id: string;
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

type AttendanceRecord = {
  id: string;
  lesson_record_id: string;
  student_id: string;
  is_present: boolean;
};

type StudentLessonComment = {
  id: string;
  lesson_record_id: string;
  student_id: string | null;
  student_name: string | null;
  comment: string;
  created_at: string;
};

export default function StudentLessonsPage() {
  const router = useRouter();

  const [session, setSession] = useState<StudentSession | null>(null);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(
    []
  );
  const [comments, setComments] = useState<StudentLessonComment[]>([]);

  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [commentLessonId, setCommentLessonId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchLessons(activeSession: StudentSession) {
    setIsLoading(true);
    setMessage("");

    const { data: studentFromSupabase, error: studentError } = await supabase
      .from("students")
      .select("id, name, status")
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

    const relation = ((relationFromSupabase || []) as ClassRelation[])[0];

    if (!relation) {
      setMessage("没有找到你的班级信息，请联系 ORP 管理员。");
      setIsLoading(false);
      return;
    }

    const activeClassId = relation.class_id;

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

    const { data: attendanceFromSupabase, error: attendanceError } =
      await supabase
        .from("lesson_attendance")
        .select("id, lesson_record_id, student_id, is_present")
        .eq("student_id", activeSession.studentId);

    if (attendanceError) {
      setMessage(`读取出勤记录失败：${attendanceError.message}`);
      setIsLoading(false);
      return;
    }

    const { data: commentsFromSupabase, error: commentsError } = await supabase
      .from("student_lesson_comments")
      .select("id, lesson_record_id, student_id, student_name, comment, created_at")
      .eq("student_id", activeSession.studentId)
      .order("created_at", { ascending: false });

    if (commentsError) {
      setMessage(`读取留言失败：${commentsError.message}`);
      setIsLoading(false);
      return;
    }

    setStudent(studentData);
    setRecords((recordsFromSupabase || []) as LessonRecord[]);
    setAttendanceRecords((attendanceFromSupabase || []) as AttendanceRecord[]);
    setComments((commentsFromSupabase || []) as StudentLessonComment[]);
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

      const activeSession: StudentSession = {
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        username: currentStudent.username,
        loggedInAt: new Date().toISOString(),
      };

      localStorage.setItem("orp_student_session", JSON.stringify(activeSession));

      setSession(activeSession);
      await fetchLessons(activeSession);
    }

    loadCurrentStudent();
  }, []);

  const attendanceByLessonId = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();

    attendanceRecords.forEach((attendance) => {
      map.set(attendance.lesson_record_id, attendance);
    });

    return map;
  }, [attendanceRecords]);

  const commentsByLessonId = useMemo(() => {
    const map = new Map<string, StudentLessonComment[]>();

    comments.forEach((comment) => {
      const existing = map.get(comment.lesson_record_id) || [];
      map.set(comment.lesson_record_id, [...existing, comment]);
    });

    return map;
  }, [comments]);

  async function handleLogout() {
    await logoutCurrentUser();
    router.push("/login");
  }

  async function submitComment(lessonId: string) {
    if (!session || !student) {
      setMessage("登录状态无效，请重新登录。");
      return;
    }

    const trimmedComment = commentText.trim();

    if (!trimmedComment) {
      setMessage("留言内容不能为空。");
      return;
    }

    setIsSubmittingComment(true);
    setMessage("");

    const { error } = await supabase.from("student_lesson_comments").insert({
      lesson_record_id: lessonId,
      student_id: session.studentId,
      student_name: student.name,
      comment: trimmedComment,
    });

    if (error) {
      setMessage(`提交留言失败：${error.message}`);
      setIsSubmittingComment(false);
      return;
    }

    setCommentText("");
    setCommentLessonId(null);
    setMessage("留言已提交。");
    await fetchLessons(session);
    setIsSubmittingComment(false);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-600">正在读取课程记录...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#2f5d50]">
            ORP 课程记录
          </p>

          <h1 className="mt-2 text-3xl font-bold text-emerald-950">
            请先登录
          </h1>

          <p className="mt-3 text-sm leading-7 text-stone-600">
            学生请使用用户名和密码登录后查看自己的课程记录。
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
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-[#2f5d50]">
              ORP 课程记录
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              {student?.name || session.studentName} 的全部课程
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              这里可以查看每一节课的内容、作业、下次计划、材料链接，也可以给小老师留言。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/student"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回学习空间
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        )}

        <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          {records.length === 0 ? (
            <p className="rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
              目前还没有课程记录。
            </p>
          ) : (
            <div className="space-y-4">
              {records.map((record) => {
                const isExpanded = expandedLessonId === record.id;
                const isWritingComment = commentLessonId === record.id;
                const attendance = attendanceByLessonId.get(record.id);
                const lessonComments = commentsByLessonId.get(record.id) || [];

                return (
                  <article
                    key={record.id}
                    className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-5"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <p className="text-sm text-stone-500">
                          {record.lesson_date} · {record.duration_minutes} 分钟
                        </p>

                        <h2 className="mt-2 text-xl font-bold text-emerald-950">
                          {record.lesson_title}
                        </h2>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                          attendance
                            ? attendance.is_present
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {attendance
                          ? attendance.is_present
                            ? "已出勤"
                            : "缺勤"
                          : "未记录出勤"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedLessonId(isExpanded ? null : record.id)
                        }
                        className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                      >
                        {isExpanded ? "收起详情" : "展开详情"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCommentLessonId(
                            isWritingComment ? null : record.id
                          );
                          setCommentText("");
                          setMessage("");
                        }}
                        className="rounded-full bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
                      >
                        {isWritingComment ? "取消留言" : "给小老师留言"}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-5 space-y-5">
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">
                            这节课学了什么
                          </p>

                          <p className="mt-2 whitespace-pre-line leading-8 text-stone-700">
                            {record.lesson_content_and_feedback}
                          </p>
                        </div>

                        {record.homework && (
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">
                              课后小任务
                            </p>

                            <p className="mt-2 whitespace-pre-line leading-8 text-stone-700">
                              {record.homework}
                            </p>
                          </div>
                        )}

                        {record.next_plan && (
                          <div>
                            <p className="text-sm font-semibold text-emerald-700">
                              下次课预告
                            </p>

                            <p className="mt-2 whitespace-pre-line leading-8 text-stone-700">
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

                        {lessonComments.length > 0 && (
                          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                            <p className="text-sm font-semibold text-emerald-700">
                              我的留言
                            </p>

                            <div className="mt-3 space-y-2">
                              {lessonComments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="rounded-2xl bg-[#fffdf4] p-3"
                                >
                                  <p className="text-sm leading-7 text-stone-700">
                                    {comment.comment}
                                  </p>

                                  <p className="mt-1 text-xs text-stone-500">
                                    {comment.created_at.slice(0, 10)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {isWritingComment && (
                      <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4">
                        <p className="text-sm font-semibold text-emerald-700">
                          写一句留言
                        </p>

                        <textarea
                          value={commentText}
                          onChange={(event) =>
                            setCommentText(event.target.value)
                          }
                          rows={4}
                          placeholder="比如：今天我最喜欢的是…… / 我还有点不明白的是……"
                          className="mt-3 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm leading-7 outline-none focus:border-emerald-500"
                        />

                        <button
                          type="button"
                          onClick={() => submitComment(record.id)}
                          disabled={isSubmittingComment}
                          className="mt-3 rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSubmittingComment ? "提交中..." : "提交留言"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}