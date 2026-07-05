"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TeacherRow = {
  id: string;
  name: string;
  email: string | null;
  status: string;
};

type TeacherSession = {
  teacherId: string;
  teacherName: string;
  loggedInAt: string;
};

type LessonRecord = {
  id: string;
  class_id: string | null;
  lesson_date: string;
  duration_minutes: number;
  lesson_title: string;
  lesson_content_and_feedback: string;
};

type TeachingGoal = {
  id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  expected_lessons: number | null;
  status: string;
};

type TeachingGoalWithProgress = TeachingGoal & {
  completed_lessons: number;
};

type ClassTeacherRelation = {
  class_id: string;
  classes: any;
};

type ClassStudentRelation = {
  class_id: string;
  students: any;
};

export default function TeacherPage() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [teacherSession, setTeacherSession] = useState<TeacherSession | null>(
    null
  );

  const [classRelations, setClassRelations] = useState<ClassTeacherRelation[]>(
    []
  );
  const [studentsInClasses, setStudentsInClasses] = useState<
    ClassStudentRelation[]
  >([]);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [goalsWithProgress, setGoalsWithProgress] = useState<
    TeachingGoalWithProgress[]
  >([]);

  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true);
  const [isLoadingTeacherData, setIsLoadingTeacherData] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchTeachers() {
    setIsLoadingTeachers(true);
    setMessage("");

    const { data, error } = await supabase
      .from("teachers")
      .select("id, name, email, status")
      .neq("status", "archived")
      .order("name", { ascending: true });

    if (error) {
      setMessage(`读取小老师列表失败：${error.message}`);
      setIsLoadingTeachers(false);
      return;
    }

    const teacherRows = (data || []) as TeacherRow[];
    setTeachers(teacherRows);
    setIsLoadingTeachers(false);

    const storedSession = localStorage.getItem("orp_teacher_session");

    if (storedSession) {
      try {
        const parsedSession = JSON.parse(storedSession) as TeacherSession;

        const teacherStillExists = teacherRows.some(
          (teacher) => teacher.id === parsedSession.teacherId
        );

        if (parsedSession.teacherId && teacherStillExists) {
          setTeacherSession(parsedSession);
          setSelectedTeacherId(parsedSession.teacherId);
          await fetchTeacherData(parsedSession.teacherId);
          return;
        }

        localStorage.removeItem("orp_teacher_session");
      } catch {
        localStorage.removeItem("orp_teacher_session");
      }
    }
  }

  async function fetchTeacherData(teacherId: string) {
    setIsLoadingTeacherData(true);
    setMessage("");

    const { data: classTeacherData, error: classTeacherError } = await supabase
      .from("class_teachers")
      .select(
        `
        class_id,
        classes (
          id,
          name,
          school,
          status,
          cohorts (
            id,
            name,
            status
          )
        )
      `
      )
      .eq("teacher_id", teacherId);

    if (classTeacherError) {
      setMessage(`读取小老师班级失败：${classTeacherError.message}`);
      setIsLoadingTeacherData(false);
      return;
    }

    const relations = (classTeacherData || []) as ClassTeacherRelation[];
    const classIds = relations
      .map((relation) => relation.class_id)
      .filter(Boolean);

    let classStudentRows: ClassStudentRelation[] = [];

    if (classIds.length > 0) {
      const { data: classStudentsData, error: classStudentsError } =
        await supabase
          .from("class_students")
          .select(
            `
            class_id,
            students (
              id,
              name,
              note,
              status
            )
          `
          )
          .in("class_id", classIds);

      if (classStudentsError) {
        setMessage(`读取学生信息失败：${classStudentsError.message}`);
        setIsLoadingTeacherData(false);
        return;
      }

      classStudentRows = (classStudentsData || []) as ClassStudentRelation[];
    }

    const { data: lessonData, error: lessonError } = await supabase
      .from("lesson_records")
      .select(
        "id, class_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback"
      )
      .eq("teacher_id", teacherId)
      .order("lesson_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3);

    if (lessonError) {
      setMessage(`读取授课记录失败：${lessonError.message}`);
      setIsLoadingTeacherData(false);
      return;
    }

    const { data: teachingGoalsData, error: goalsError } = await supabase
      .from("teaching_goals")
      .select(
        "id, class_id, title, description, start_date, expected_lessons, status"
      )
      .eq("teacher_id", teacherId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (goalsError) {
      setMessage(`读取教学目标失败：${goalsError.message}`);
      setIsLoadingTeacherData(false);
      return;
    }

    const teachingGoals = (teachingGoalsData || []) as TeachingGoal[];
    const goalIds = teachingGoals.map((goal) => goal.id);

    let lessonRecordsForGoals: { id: string; goal_id: string | null }[] = [];

    if (goalIds.length > 0) {
      const { data: progressData, error: progressError } = await supabase
        .from("lesson_records")
        .select("id, goal_id")
        .in("goal_id", goalIds);

      if (progressError) {
        setMessage(`读取目标进度失败：${progressError.message}`);
        setIsLoadingTeacherData(false);
        return;
      }

      lessonRecordsForGoals =
        (progressData || []) as { id: string; goal_id: string | null }[];
    }

    const goalProgressMap = new Map<string, number>();

    lessonRecordsForGoals.forEach((record) => {
      if (!record.goal_id) return;

      const currentCount = goalProgressMap.get(record.goal_id) || 0;
      goalProgressMap.set(record.goal_id, currentCount + 1);
    });

    const goalsWithRealProgress: TeachingGoalWithProgress[] = teachingGoals.map(
      (goal) => ({
        ...goal,
        completed_lessons: goalProgressMap.get(goal.id) || 0,
      })
    );

    setClassRelations(relations);
    setStudentsInClasses(classStudentRows);
    setLessonRecords((lessonData || []) as LessonRecord[]);
    setGoalsWithProgress(goalsWithRealProgress);
    setIsLoadingTeacherData(false);
  }

  useEffect(() => {
    fetchTeachers();
  }, []);

  async function handleSelectTeacher(teacherId: string) {
    setSelectedTeacherId(teacherId);

    if (!teacherId) {
      setTeacherSession(null);
      setClassRelations([]);
      setStudentsInClasses([]);
      setLessonRecords([]);
      setGoalsWithProgress([]);
      localStorage.removeItem("orp_teacher_session");
      return;
    }

    const selectedTeacher = teachers.find((teacher) => teacher.id === teacherId);

    if (!selectedTeacher) {
      setMessage("没有找到这个小老师。");
      return;
    }

    const newSession: TeacherSession = {
      teacherId: selectedTeacher.id,
      teacherName: selectedTeacher.name,
      loggedInAt: new Date().toISOString(),
    };

    localStorage.setItem("orp_teacher_session", JSON.stringify(newSession));
    setTeacherSession(newSession);

    await fetchTeacherData(selectedTeacher.id);
  }

  async function completeGoal(goalId: string) {
    if (!teacherSession) {
      setMessage("请先选择小老师身份。");
      return;
    }

    const { error } = await supabase
      .from("teaching_goals")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", goalId)
      .eq("teacher_id", teacherSession.teacherId)
      .neq("status", "completed");

    if (error) {
      setMessage(`结束目标失败：${error.message}`);
      return;
    }

    setMessage("教学目标已结束。");
    await fetchTeacherData(teacherSession.teacherId);
  }

  function clearTeacherSession() {
    localStorage.removeItem("orp_teacher_session");
    setTeacherSession(null);
    setSelectedTeacherId("");
    setClassRelations([]);
    setStudentsInClasses([]);
    setLessonRecords([]);
    setGoalsWithProgress([]);
  }

  const selectedTeacher = teachers.find(
    (teacher) => teacher.id === selectedTeacherId
  );

  const classIds = classRelations
    .map((relation) => relation.class_id)
    .filter(Boolean);

  const classes = classRelations
    .map((relation) => relation.classes)
    .filter(Boolean);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();

    classRelations.forEach((relation) => {
      if (relation.class_id && relation.classes?.name) {
        map.set(relation.class_id, relation.classes.name);
      }
    });

    return map;
  }, [classRelations]);

  const activeStudents = studentsInClasses
    .map((relation) => relation.students)
    .filter(Boolean)
    .filter((student) => student.status !== "withdrawn")
    .filter((student) => student.status !== "archived");

  const studentNames = activeStudents.map((student) => student.name);

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold text-[#2f5d50]">
                ORP Teacher Portal
              </p>

              <h1 className="mt-2 text-3xl font-bold text-emerald-950">
                小老师工作台
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                现在是测试阶段，可以先用下拉菜单选择小老师身份。之后正式上线时会改成账号登录和权限控制。
              </p>
            </div>

            <div className="w-full md:w-80">
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">
                  选择小老师身份
                </span>

                <select
                  value={selectedTeacherId}
                  onChange={(event) => handleSelectTeacher(event.target.value)}
                  disabled={isLoadingTeachers}
                  className="mt-2 w-full rounded-2xl border border-emerald-100 bg-[#fffdf4] px-4 py-3 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">
                    {isLoadingTeachers ? "正在读取小老师..." : "请选择小老师"}
                  </option>

                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </label>

              {teacherSession && (
                <button
                  type="button"
                  onClick={clearTeacherSession}
                  className="mt-3 text-sm font-semibold text-red-600 hover:underline"
                >
                  清除当前小老师身份
                </button>
              )}
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              {message}
            </div>
          )}
        </section>

        {!teacherSession ? (
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-bold text-emerald-950">
              请先选择小老师身份
            </h2>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              选择后，这里会显示该小老师负责的班级、学生、教学目标和最近授课记录。
            </p>
          </section>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-6">
              <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#cfe8d6] text-xl font-bold text-emerald-950">
                    {selectedTeacher?.name?.slice(0, 1) || "师"}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      当前小老师
                    </p>

                    <h2 className="mt-1 text-2xl font-bold text-emerald-950">
                      {selectedTeacher?.name || teacherSession.teacherName}
                    </h2>

                    {selectedTeacher?.email && (
                      <p className="mt-1 text-xs text-stone-500">
                        {selectedTeacher.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-3 border-t border-emerald-100 pt-5 text-sm leading-6 text-stone-600">
                  <p>
                    <span className="font-semibold text-stone-800">
                      负责班级：
                    </span>
                    {classes.length > 0
                      ? classes.map((classItem) => classItem.name).join("、")
                      : "暂无班级"}
                  </p>

                  <p>
                    <span className="font-semibold text-stone-800">
                      学生：
                    </span>
                    {studentNames.length > 0
                      ? studentNames.join("、")
                      : "暂无学生"}
                  </p>
                </div>
              </section>

              <section className="rounded-[2rem] border border-emerald-100 bg-[#fffdf4] p-7 shadow-sm">
                <h2 className="mt-3 text-2xl font-bold text-emerald-950">
                  我的班级
                </h2>

                <div className="mt-5 space-y-4">
                  {classes.length === 0 ? (
                    <p className="rounded-2xl bg-white/80 p-5 text-sm leading-7 text-stone-600">
                      暂时没有分配班级。请先在管理员端给这个小老师分配班级。
                    </p>
                  ) : (
                    classes.map((classItem) => {
                      const studentsForClass = studentsInClasses
                        .filter(
                          (relation) =>
                            relation.class_id === classItem.id &&
                            relation.students &&
                            relation.students.status !== "withdrawn" &&
                            relation.students.status !== "archived"
                        )
                        .map((relation) => relation.students);

                      return (
                        <div
                          key={classItem.id}
                          className="rounded-2xl border border-emerald-100 bg-white/80 p-5"
                        >
                          <p className="font-bold text-emerald-950">
                            {classItem.name}
                          </p>

                          <p className="mt-1 text-xs text-stone-500">
                            {classItem.cohorts?.name || "未设置届别"}
                          </p>

                          <div className="mt-3 space-y-2">
                            {studentsForClass.length === 0 ? (
                              <p className="text-sm leading-6 text-stone-500">
                                这个班级暂时没有学生。
                              </p>
                            ) : (
                              studentsForClass.map((student) => (
                                <div
                                  key={student.id}
                                  className="rounded-xl bg-[#f6f5e9] px-4 py-3"
                                >
                                  <p className="text-sm font-semibold text-emerald-950">
                                    {student.name}
                                  </p>

                                  {student.note && (
                                    <p className="mt-1 text-xs leading-5 text-stone-500">
                                      {student.note}
                                    </p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
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
              {isLoadingTeacherData ? (
                <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
                  <p className="text-sm text-stone-600">
                    正在读取小老师数据...
                  </p>
                </section>
              ) : (
                <>
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

                                    {goal.class_id && (
                                      <p className="mt-2 text-sm font-semibold text-emerald-700">
                                        {classNameById.get(goal.class_id) ||
                                          "未知班级"}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <Link
                                      href={`/teacher/edit-goal/${goal.id}`}
                                      className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                                    >
                                      修改
                                    </Link>

                                    <button
                                      type="button"
                                      onClick={() => completeGoal(goal.id)}
                                      className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100"
                                    >
                                      结束
                                    </button>
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
                                      {completedLessons} /{" "}
                                      {expectedLessons || "?"} 节
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

                        <p className="mt-3 leading-7 text-stone-600">
                          这里显示当前小老师最近填写的课程记录。
                        </p>
                      </div>

                      <Link
                        href="/teacher/new-record"
                        className="w-fit rounded-full bg-[#cfe8d6] px-6 py-3 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-[#bfe0c8]"
                      >
                        添加记录
                      </Link>
                    </div>

                    <div className="mt-8 space-y-5">
                      {lessonRecords.length === 0 ? (
                        <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6">
                          <p className="leading-7 text-stone-600">
                            目前还没有授课记录。添加一条记录后，这里会自动显示。
                          </p>
                        </div>
                      ) : (
                        lessonRecords.map((record) => (
                          <article
                            key={record.id}
                            className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6"
                          >
                            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                              <div>
                                <p className="text-sm font-semibold text-emerald-700">
                                  {record.lesson_date}｜
                                  {record.duration_minutes} 分钟
                                </p>

                                <h3 className="mt-2 text-2xl font-bold text-emerald-950">
                                  {record.lesson_title}
                                </h3>
                              </div>

                              <p className="w-fit rounded-full bg-[#f6f5e9] px-4 py-2 text-sm font-semibold text-stone-600">
                                {record.class_id
                                  ? classNameById.get(record.class_id) ||
                                    "未知班级"
                                  : "未关联班级"}
                              </p>
                            </div>

                            <p className="mt-4 whitespace-pre-line leading-8 text-stone-700">
                              {record.lesson_content_and_feedback}
                            </p>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}