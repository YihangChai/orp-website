"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import StudentGuard, { useCurrentStudent } from "@/components/StudentGuard";
import type { CurrentStudent } from "@/lib/auth";

const STUDENT_ARCHIVED_REVIEW_PATH = "/student/archive-review";

type StudentAccessState = "active" | "withdrawn" | "archived" | "unavailable";

type StudentRow = {
  id: string;
  name: string;
  status: string;
};

type CohortRow = {
  id: string;
  name: string;
  status: string;
};

type ClassRow = {
  id: string;
  name: string;
  school: string | null;
  status: string;
  subject: string | null;
  cohorts: CohortRow | null;
};

type ClassRelation = {
  class_id: string;
  classes: ClassRow | null;
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

type StudentLessonsPageData = {
  student: StudentRow;
  accessState: StudentAccessState;
  classRelations: ClassRelation[];
  selectedClassRelation: ClassRelation | null;
  selectedClassId: string;
  records: LessonRecord[];
  attendanceRecords: AttendanceRecord[];
  comments: StudentLessonComment[];
};

function getSubjectLabel(subject: string | null | undefined) {
  if (subject === "english") return "英语";
  if (subject === "math") return "数学";
  return "暂未设置";
}

function getStudentAccessState(
  status: string | null | undefined
): StudentAccessState {
  if (status === "active") return "active";
  if (status === "withdrawn") return "withdrawn";
  if (status === "archived") return "archived";
  return "unavailable";
}

function buildStudentClassLink(path: string, classId: string | null) {
  if (!classId) return path;
  return `${path}?classId=${encodeURIComponent(classId)}`;
}

export default function StudentLessonsPage() {
  return (
    <StudentGuard>
      <StudentLessonsContent />
    </StudentGuard>
  );
}

function StudentLessonsContent() {
  const currentStudent = useCurrentStudent();
  const searchParams = useSearchParams();
  const classIdFromUrl = searchParams.get("classId") || "";

  const [selectedClassId, setSelectedClassId] = useState(classIdFromUrl);
  const [pageData, setPageData] = useState<StudentLessonsPageData | null>(null);

  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [commentLessonId, setCommentLessonId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [message, setMessage] = useState("");

  async function loadStudentLessonsPageData(
    activeStudent: CurrentStudent,
    requestedClassId: string
  ): Promise<StudentLessonsPageData> {
    const { data: studentFromSupabase, error: studentError } = await supabase
      .from("students")
      .select("id, name, status")
      .eq("id", activeStudent.id)
      .maybeSingle();

    if (studentError) {
      throw new Error(`读取学生资料失败：${studentError.message}`);
    }

    if (!studentFromSupabase) {
      throw new Error("没有找到学生资料，请重新登录。");
    }

    const studentData = studentFromSupabase as StudentRow;
    const accessState = getStudentAccessState(studentData.status);

    /**
     * archived 学生预留逻辑：
     * - 目前不进入普通课程记录页，不允许继续留言。
     * - 后续可以在 /student/archive-review 读取历史班级和历史课程。
     */
    if (accessState === "archived") {
      return {
        student: studentData,
        accessState,
        classRelations: [],
        selectedClassRelation: null,
        selectedClassId: "",
        records: [],
        attendanceRecords: [],
        comments: [],
      };
    }

    if (accessState !== "active") {
      throw new Error("这个学生账号当前不可用。如有疑问，请联系 ORP 管理员。");
    }

    const { data: relationFromSupabase, error: relationError } = await supabase
      .from("class_students")
      .select(
        `
        class_id,
        classes (
          id,
          name,
          school,
          status,
          subject,
          cohorts (
            id,
            name,
            status
          )
        )
      `
      )
      .eq("student_id", activeStudent.id);

    if (relationError) {
      throw new Error(`读取班级关系失败：${relationError.message}`);
    }

    const allRelations = (
      (relationFromSupabase || []) as unknown as ClassRelation[]
    ).filter((relation) => Boolean(relation.classes));

    const activeRelations = allRelations.filter((relation) => {
      const classItem = relation.classes;

      if (!classItem) return false;
      if (classItem.status === "archived") return false;
      if (classItem.status === "withdrawn") return false;
      if (classItem.cohorts?.status === "archived") return false;

      return true;
    });

    if (activeRelations.length === 0) {
      throw new Error("没有找到你的可用班级信息，请联系 ORP 管理员。");
    }

    const requestedRelation = requestedClassId
      ? activeRelations.find(
          (relation) => relation.class_id === requestedClassId
        )
      : null;

    const selectedRelation = requestedRelation || activeRelations[0];
    const activeClassId = selectedRelation.class_id;

    const { data: recordsFromSupabase, error: recordsError } = await supabase
      .from("lesson_records")
      .select(
        "id, goal_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, homework, next_plan, material_link, created_at"
      )
      .eq("class_id", activeClassId)
      .order("lesson_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (recordsError) {
      throw new Error(`读取课程记录失败：${recordsError.message}`);
    }

    const lessonRecords = (recordsFromSupabase || []) as LessonRecord[];
    const lessonRecordIds = lessonRecords.map((record) => record.id);

    if (lessonRecordIds.length === 0) {
      return {
        student: studentData,
        accessState,
        classRelations: activeRelations,
        selectedClassRelation: selectedRelation,
        selectedClassId: activeClassId,
        records: [],
        attendanceRecords: [],
        comments: [],
      };
    }

    const [attendanceResult, commentsResult] = await Promise.all([
      supabase
        .from("lesson_attendance")
        .select("id, lesson_record_id, student_id, is_present")
        .eq("student_id", activeStudent.id)
        .in("lesson_record_id", lessonRecordIds),

      supabase
        .from("student_lesson_comments")
        .select(
          "id, lesson_record_id, student_id, student_name, comment, created_at"
        )
        .eq("student_id", activeStudent.id)
        .in("lesson_record_id", lessonRecordIds)
        .order("created_at", { ascending: false }),
    ]);

    if (attendanceResult.error) {
      throw new Error(`读取出勤记录失败：${attendanceResult.error.message}`);
    }

    if (commentsResult.error) {
      throw new Error(`读取留言失败：${commentsResult.error.message}`);
    }

    return {
      student: studentData,
      accessState,
      classRelations: activeRelations,
      selectedClassRelation: selectedRelation,
      selectedClassId: activeClassId,
      records: lessonRecords,
      attendanceRecords: (attendanceResult.data || []) as AttendanceRecord[],
      comments: (commentsResult.data || []) as StudentLessonComment[],
    };
  }

  useEffect(() => {
    if (classIdFromUrl && classIdFromUrl !== selectedClassId) {
      setSelectedClassId(classIdFromUrl);
    }
  }, [classIdFromUrl, selectedClassId]);

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setIsLoading(true);
      setMessage("");

      try {
        const requestedClassId = selectedClassId || classIdFromUrl;

        const loadedPageData = await loadStudentLessonsPageData(
          currentStudent,
          requestedClassId
        );

        if (!isMounted) return;

        setPageData(loadedPageData);

        if (
          loadedPageData.accessState === "active" &&
          selectedClassId !== loadedPageData.selectedClassId
        ) {
          setSelectedClassId(loadedPageData.selectedClassId);
        }
      } catch (error) {
        if (!isMounted) return;

        const errorMessage =
          error instanceof Error ? error.message : "读取课程记录失败。";

        setMessage(errorMessage);
        setPageData(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [currentStudent, selectedClassId, classIdFromUrl]);

  const attendanceByLessonId = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();

    pageData?.attendanceRecords.forEach((attendance) => {
      map.set(attendance.lesson_record_id, attendance);
    });

    return map;
  }, [pageData?.attendanceRecords]);

  const commentsByLessonId = useMemo(() => {
    const map = new Map<string, StudentLessonComment[]>();

    pageData?.comments.forEach((comment) => {
      const existing = map.get(comment.lesson_record_id) || [];
      map.set(comment.lesson_record_id, [...existing, comment]);
    });

    return map;
  }, [pageData?.comments]);

  function handleSelectClass(nextClassId: string) {
    setSelectedClassId(nextClassId);
    setExpandedLessonId(null);
    setCommentLessonId(null);
    setCommentText("");
    setMessage("");
  }

  async function submitComment(lessonId: string) {
    if (!pageData || pageData.accessState !== "active") {
      setMessage("当前账号不能提交留言。");
      return;
    }

    const lessonExists = pageData.records.some(
      (record) => record.id === lessonId
    );

    if (!lessonExists) {
      setMessage("这节课不属于当前学生可查看的课程，不能留言。");
      return;
    }

    const trimmedComment = commentText.trim();

    if (!trimmedComment) {
      setMessage("留言内容不能为空。");
      return;
    }

    setIsSubmittingComment(true);
    setMessage("");

    const { data: insertedComment, error } = await supabase
      .from("student_lesson_comments")
      .insert({
        lesson_record_id: lessonId,
        student_id: currentStudent.id,
        student_name: pageData.student.name,
        comment: trimmedComment,
      })
      .select(
        "id, lesson_record_id, student_id, student_name, comment, created_at"
      )
      .single();

    if (error) {
      setMessage(`提交留言失败：${error.message}`);
      setIsSubmittingComment(false);
      return;
    }

    const newComment = insertedComment as StudentLessonComment;

    setPageData((currentPageData) => {
      if (!currentPageData) return currentPageData;

      return {
        ...currentPageData,
        comments: [newComment, ...currentPageData.comments],
      };
    });

    setCommentText("");
    setCommentLessonId(null);
    setMessage("留言已提交。");
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

  if (pageData?.accessState === "archived") {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-semibold text-[#2f5d50]">
            ORP 历史课程记录
          </p>

          <h1 className="mt-2 text-3xl font-bold text-emerald-950">
            {pageData.student.name} 的历史学习回顾
          </h1>

          <p className="mt-4 text-sm leading-7 text-stone-600">
            你的账号目前已经归档。之后这里会开放历史课程记录回顾，用来查看你曾经上过的课程、学习内容和留言。
          </p>

          <div className="mt-6 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
            当前版本先保留这个入口。正式开放后，归档学生可以进入专门的历史学习回顾页面，而不是继续使用当前班级课程页。
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={STUDENT_ARCHIVED_REVIEW_PATH}
              className="rounded-full bg-[#2f5d50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              查看历史学习回顾
            </Link>

            <Link
              href="/student"
              className="rounded-full border border-emerald-700 px-5 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回学习空间
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const studentName = pageData?.student.name || currentStudent.name;
  const records = pageData?.records || [];
  const selectedClass = pageData?.selectedClassRelation?.classes || null;
  const currentClassId = pageData?.selectedClassId || selectedClassId || "";
  const currentClassName = selectedClass?.name || "当前班级";
  const currentSubjectName = getSubjectLabel(selectedClass?.subject);
  const hasMultipleClasses = (pageData?.classRelations.length || 0) > 1;
  const studentHomeLink = buildStudentClassLink("/student", currentClassId);

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-[#2f5d50]">
              ORP 课程记录
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              {studentName} 的全部课程
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              这里可以查看当前班级每一节课的内容、作业、下次计划、材料链接，也可以给小老师留言。
            </p>

            <p className="mt-2 text-sm font-semibold text-emerald-800">
              当前班级：{currentClassName} · {currentSubjectName}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={studentHomeLink}
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

        {pageData && hasMultipleClasses && (
          <section className="mb-6 rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">
              选择当前班级
            </p>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              你同时参加了多个 ORP 班级。切换班级后，下面的课程记录、出勤和留言会跟随切换。
            </p>

            <select
              value={currentClassId}
              onChange={(event) => handleSelectClass(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm font-semibold text-emerald-950 outline-none transition focus:border-emerald-500 focus:bg-white"
            >
              {pageData.classRelations.map((relation) => {
                const classItem = relation.classes;
                const className = classItem?.name || "未命名班级";
                const subjectName = getSubjectLabel(classItem?.subject);
                const cohortName = classItem?.cohorts?.name || "";

                return (
                  <option key={relation.class_id} value={relation.class_id}>
                    {className} · {subjectName}
                    {cohortName ? ` · ${cohortName}` : ""}
                  </option>
                );
              })}
            </select>
          </section>
        )}

        <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          {records.length === 0 ? (
            <p className="rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
              当前班级目前还没有课程记录。
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