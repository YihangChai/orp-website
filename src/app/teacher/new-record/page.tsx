"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getCurrentTeacher } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type TeacherSession = {
  teacherId: string;
  teacherName: string;
  email: string | null;
  loggedInAt: string;
};

type TeachingGoal = {
  id: string;
  class_id: string | null;
  title: string;
  expected_lessons: number | null;
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

type ClassStudentItem = {
  id: string;
  name: string;
  note: string | null;
  status: string;
};

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export default function NewRecordPage() {
  const router = useRouter();
  const today = getTodayDate();

  const [teacherSession, setTeacherSession] = useState<TeacherSession | null>(
    null
  );

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  const [goals, setGoals] = useState<TeachingGoal[]>([]);
  const [students, setStudents] = useState<ClassStudentItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>(
    {}
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingClassData, setIsLoadingClassData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchClassData(classId: string, teacherId: string) {
    setIsLoadingClassData(true);
    setMessage("");

    const { data: classStudentsData, error: classStudentsError } =
      await supabase
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
        .eq("class_id", classId);

    if (classStudentsError) {
      setMessage(`读取学生名单失败：${classStudentsError.message}`);
      setIsLoadingClassData(false);
      return;
    }

    const formattedStudents = (classStudentsData || [])
      .map((item: any) => item.students)
      .filter(Boolean)
      .filter((student: ClassStudentItem) => student.status !== "withdrawn")
      .filter(
        (student: ClassStudentItem) => student.status !== "archived"
      ) as ClassStudentItem[];

    setStudents(formattedStudents);

    const initialAttendance: Record<string, boolean> = {};

    formattedStudents.forEach((student) => {
      initialAttendance[student.id] = true;
    });

    setAttendanceMap(initialAttendance);

    const { data: goalsData, error: goalsError } = await supabase
      .from("teaching_goals")
      .select("id, class_id, title, expected_lessons")
      .eq("teacher_id", teacherId)
      .eq("class_id", classId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (goalsError) {
      setMessage(`读取教学目标失败：${goalsError.message}`);
      setIsLoadingClassData(false);
      return;
    }

    setGoals((goalsData || []) as TeachingGoal[]);
    setIsLoadingClassData(false);
  }

  async function fetchTeacherClasses(teacherId: string) {
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
      return;
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

    setClasses(classRows);

    if (classRows.length === 0) {
      setMessage("这个小老师还没有绑定班级。请先在管理员端为小老师分配班级。");
      return;
    }

    if (classRows.length > 1) {
      setMessage(
        "检测到这个小老师绑定了多个班级。当前页面会默认使用第一个班级；后续可以升级为班级下拉选择。"
      );
    }

    const teacherClass = classRows[0];

    setSelectedClassId(teacherClass.id);
    await fetchClassData(teacherClass.id, teacherId);
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

      await fetchTeacherClasses(teacher.id);

      setIsLoading(false);
    }

    initPage();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!teacherSession) {
      setMessage("请先登录小老师账号。");
      return;
    }

    if (!selectedClassId) {
      setMessage("没有读取到小老师对应的班级。");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);

    const lessonDate = String(formData.get("lesson_date") || "");
    const durationMinutes = Number(formData.get("duration_minutes"));
    const goalId = String(formData.get("goal_id") || "");
    const lessonTitle = String(formData.get("lesson_title") || "").trim();
    const lessonContentAndFeedback = String(
      formData.get("lesson_content_and_feedback") || ""
    ).trim();
    const homework = String(formData.get("homework") || "").trim();
    const nextPlan = String(formData.get("next_plan") || "").trim();
    const materialLink = String(formData.get("material_link") || "").trim();
    const teacherReflection = String(
      formData.get("teacher_reflection") || ""
    ).trim();

    if (
      !lessonDate ||
      !durationMinutes ||
      !lessonTitle ||
      !lessonContentAndFeedback
    ) {
      setMessage("请填写上课日期、授课时长、本节课主题和课程内容。");
      setIsSubmitting(false);
      return;
    }

    if (durationMinutes <= 0) {
      setMessage("授课时长必须大于 0。");
      setIsSubmitting(false);
      return;
    }

    const { data: insertedLesson, error: lessonError } = await supabase
      .from("lesson_records")
      .insert({
        teacher_id: teacherSession.teacherId,
        class_id: selectedClassId,
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
        setIsSubmitting(false);
        return;
      }
    }

    setMessage("课程记录和学生出勤已提交。");
    setIsSubmitting(false);

    router.push("/teacher");
    router.refresh();
  }

  const selectedClass = classes.find(
    (classItem) => classItem.id === selectedClassId
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm">
          <p className="text-sm text-stone-600">正在读取小老师信息...</p>
        </section>
      </main>
    );
  }

  if (!teacherSession) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
        <section className="mx-auto max-w-4xl rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm">
          <Link
            href="/login"
            className="text-sm font-semibold text-emerald-800 hover:text-emerald-950"
          >
            ← 前往登录
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-emerald-950">
            请先登录
          </h1>

          <p className="mt-3 leading-7 text-stone-600">
            小老师需要使用邮箱和密码登录后，才能添加授课记录。
          </p>

          <Link
            href="/login"
            className="mt-5 inline-block rounded-full bg-[#2f5d50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            前往登录
          </Link>
        </section>
      </main>
    );
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
            当前小老师：
            <span className="font-semibold text-emerald-800">
              {teacherSession.teacherName}
            </span>
            。请记录本节课的基本信息、出勤情况、课程内容和后续计划。
          </p>

          {message && (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
              {message}
            </div>
          )}
        </div>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
          <form onSubmit={handleSubmit} className="space-y-7">
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
                    value={selectedClass?.name || "未读取到班级"}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-stone-100 px-4 py-3 text-stone-600 outline-none"
                  />

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    班级根据当前登录的小老师账号自动读取。当前版本按一个小老师对应一个班级处理。
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    所属课程目标
                  </label>

                  <select
                    name="goal_id"
                    disabled={isLoadingClassData}
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {isLoadingClassData
                        ? "正在读取教学目标..."
                        : "不关联教学目标"}
                    </option>

                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                        {goal.expected_lessons
                          ? `（计划 ${goal.expected_lessons} 节）`
                          : ""}
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
                    defaultValue={40}
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
                        <p className="font-semibold text-emerald-950">
                          {student.name}
                        </p>

                        <p className="mt-1 text-xs text-stone-500">
                          {student.note || "暂无备注"}
                        </p>
                      </div>

                      <input
                        type="checkbox"
                        checked={attendanceMap[student.id] ?? false}
                        onChange={(event) => {
                          setAttendanceMap((previousMap) => ({
                            ...previousMap,
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

            <div className="flex flex-col gap-3 border-t border-emerald-100 pt-6 md:flex-row md:items-center md:justify-between">
              <p className="text-sm leading-6 text-stone-500">
                当前版本会根据登录的小老师账号，自动保存真实 teacher_id、class_id 和学生出勤。
              </p>

              <button
                type="submit"
                disabled={isSubmitting || !selectedClassId}
                className="rounded-full bg-[#cfe8d6] px-7 py-3 font-semibold text-emerald-950 shadow-sm hover:bg-[#bfe0c8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "保存中..." : "保存记录"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}