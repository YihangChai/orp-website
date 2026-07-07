import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

type TeacherDetailPageProps = {
  params: Promise<{
    teacherId: string;
  }>;
};

type ClassRelation = {
  class_id: string;
  classes: any;
};

type LessonRecord = {
  id: string;
  teacher_id: string | null;
  class_id: string | null;
  lesson_date: string;
  duration_minutes: number;
  lesson_title: string;
  lesson_content_and_feedback: string;
  created_at: string;
};

type TeachingGoal = {
  id: string;
  teacher_id: string | null;
  class_id: string | null;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  expected_lessons: number | null;
};

function getTeacherStatusLabel(status: string) {
  if (status === "archived") return "已归档";
  if (status === "delete_requested") return "待删除确认";
  return "当前";
}

function getTeacherStatusClassName(status: string) {
  if (status === "archived") return "bg-stone-100 text-stone-500";
  if (status === "delete_requested") return "bg-red-50 text-red-700";
  return "bg-emerald-50 text-emerald-700";
}

function getGoalStatusLabel(status: string) {
  if (status === "completed") return "已完成";
  if (status === "paused") return "已暂停";
  if (status === "archived") return "已归档";
  return "进行中";
}

function formatHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "暂无";
  return dateString;
}

export default async function TeacherDetailPage({
  params,
}: TeacherDetailPageProps) {
  const { teacherId } = await params;

  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id, name, email, status, auth_user_id, created_at")
    .eq("id", teacherId)
    .maybeSingle();

  if (teacherError) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">读取失败</h1>
          <p className="mt-3 text-sm text-stone-600">
            读取小老师资料失败：{teacherError.message}
          </p>

          <Link
            href="/admin/teachers"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回小老师管理
          </Link>
        </section>
      </main>
    );
  }

  if (!teacher) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-emerald-950">
            没有找到这个小老师
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            可能这个小老师已经被删除，或者链接里的 ID 不正确。
          </p>

          <Link
            href="/admin/teachers"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回小老师管理
          </Link>
        </section>
      </main>
    );
  }

  const { data: classRelationsData, error: classRelationError } =
    await supabase
      .from("class_teachers")
      .select(
        `
        class_id,
        classes (
          id,
          name,
          school,
          status,
          cohort_id,
          cohorts (
            id,
            name,
            status
          ),
          class_students (
            student_id,
            students (
              id,
              name,
              status
            )
          )
        )
      `
      )
      .eq("teacher_id", teacherId);

  if (classRelationError) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">
            读取班级关系失败
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            {classRelationError.message}
          </p>

          <Link
            href="/admin/teachers"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回小老师管理
          </Link>
        </section>
      </main>
    );
  }

  const classRelations = (classRelationsData || []) as ClassRelation[];

  const classIds = classRelations
    .map((relation) => relation.class_id)
    .filter(Boolean);

  const { data: lessonRecordsData, error: lessonError } = await supabase
    .from("lesson_records")
    .select(
      "id, teacher_id, class_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, created_at"
    )
    .eq("teacher_id", teacherId)
    .order("lesson_date", { ascending: false });

  if (lessonError) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">
            读取课程记录失败
          </h1>
          <p className="mt-3 text-sm text-stone-600">{lessonError.message}</p>

          <Link
            href="/admin/teachers"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回小老师管理
          </Link>
        </section>
      </main>
    );
  }

  const { data: goalsData, error: goalsError } = await supabase
    .from("teaching_goals")
    .select(
      "id, teacher_id, class_id, title, description, status, start_date, end_date, expected_lessons"
    )
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (goalsError) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">
            读取教学目标失败
          </h1>
          <p className="mt-3 text-sm text-stone-600">{goalsError.message}</p>

          <Link
            href="/admin/teachers"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回小老师管理
          </Link>
        </section>
      </main>
    );
  }

  const lessonRecords = (lessonRecordsData || []) as LessonRecord[];
  const teachingGoals = (goalsData || []) as TeachingGoal[];

  const totalMinutes = lessonRecords.reduce(
    (sum, lesson) => sum + (lesson.duration_minutes || 0),
    0
  );

  const studentIds = new Set<string>();

  classRelations.forEach((relation) => {
    const classStudents = relation.classes?.class_students || [];

    classStudents.forEach((classStudent: any) => {
      if (classStudent.student_id) {
        studentIds.add(classStudent.student_id);
      }
    });
  });

  const recentLessons = lessonRecords.slice(0, 8);

  const activeGoals = teachingGoals.filter(
    (goal) => goal.status !== "completed" && goal.status !== "archived"
  );

  return (
    <AdminGuard>
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>

              <h1 className="mt-2 text-3xl font-bold text-emerald-950">
                {teacher.name}
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                这里展示该小老师的真实数据库资料、负责班级、学生覆盖、课程记录和教学目标。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/teachers"
                className="w-fit rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                返回小老师管理
              </Link>

              <Link
                href="/admin"
                className="w-fit rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                返回管理员首页
              </Link>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">负责班级</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {classRelations.length}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">覆盖学生</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {studentIds.size}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">课程记录</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {lessonRecords.length}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">累计时长</p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {formatHours(totalMinutes)}
              </p>
              <p className="mt-1 text-xs text-stone-500">小时</p>
            </div>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-emerald-950">基本资料</h2>

              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <p className="text-stone-500">姓名</p>
                  <p className="mt-1 font-semibold text-emerald-950">
                    {teacher.name}
                  </p>
                </div>

                <div>
                  <p className="text-stone-500">邮箱</p>
                  <p className="mt-1 font-semibold text-emerald-950">
                    {teacher.email || "暂未填写"}
                  </p>
                </div>

                <div>
                  <p className="text-stone-500">状态</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getTeacherStatusClassName(
                      teacher.status || "active"
                    )}`}
                  >
                    {getTeacherStatusLabel(teacher.status || "active")}
                  </span>
                </div>

                <div>
                  <p className="text-stone-500">创建时间</p>
                  <p className="mt-1 font-semibold text-emerald-950">
                    {teacher.created_at?.slice(0, 10) || "暂无"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-dashed border-emerald-200 bg-[#fffdf4] p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-emerald-950">
                账号绑定状态
              </h2>

              <p className="mt-3 text-sm leading-7 text-stone-600">
                小老师的登录账号未来会通过 Supabase Auth 创建。现在这里只显示是否已经和
                teachers.auth_user_id 绑定。
              </p>

              <div className="mt-5 rounded-2xl bg-white p-4">
                <p className="text-sm text-stone-500">绑定状态</p>

                <span
                  className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    teacher.auth_user_id
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {teacher.auth_user_id ? "已绑定账号" : "未绑定账号"}
                </span>

                <p className="mt-3 break-all text-xs leading-6 text-stone-500">
                  {teacher.auth_user_id
                    ? `Auth User ID：${teacher.auth_user_id}`
                    : "接入登录系统后，这里会显示对应的 auth.users.id。"}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">负责班级</h2>

            {classRelations.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-red-600">
                这个小老师暂时没有绑定任何班级。正常情况下，小老师应该通过班级管理导入分班表自动创建和绑定。
              </p>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {classRelations.map((relation) => {
                  const classItem = relation.classes;
                  const classStudents = classItem?.class_students || [];

                  return (
                    <div
                      key={relation.class_id}
                      className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-emerald-950">
                            {classItem?.name || "未知班级"}
                          </h3>

                          <p className="mt-1 text-sm text-stone-600">
                            {classItem?.cohorts?.name || "未设置届别"} ·{" "}
                            {classItem?.school || "未填写学校"}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            classItem?.status === "archived"
                              ? "bg-stone-100 text-stone-500"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {classItem?.status === "archived" ? "已封存" : "运行中"}
                        </span>
                      </div>

                      <p className="mt-4 text-sm text-stone-600">
                        学生人数：{" "}
                        <span className="font-semibold text-emerald-950">
                          {classStudents.length}
                        </span>
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {classStudents.length > 0 ? (
                          classStudents.map((classStudent: any) => (
                            <span
                              key={classStudent.student_id}
                              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-600"
                            >
                              {classStudent.students?.name || "未知学生"}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-stone-400">
                            暂无学生
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/admin/classes/${relation.class_id}`}
                        className="mt-4 inline-block rounded-full border border-emerald-700 px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                      >
                        查看班级详情
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-emerald-950">教学目标</h2>

              {teachingGoals.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                  暂时没有教学目标记录。
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {teachingGoals.slice(0, 6).map((goal) => (
                    <div
                      key={goal.id}
                      className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-emerald-950">
                          {goal.title}
                        </h3>

                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-600">
                          {getGoalStatusLabel(goal.status)}
                        </span>
                      </div>

                      {goal.description && (
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {goal.description}
                        </p>
                      )}

                      <p className="mt-3 text-xs text-stone-500">
                        {formatDate(goal.start_date)} - {formatDate(goal.end_date)}
                        {goal.expected_lessons
                          ? ` · 预计 ${goal.expected_lessons} 节课`
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeGoals.length > 0 && (
                <p className="mt-4 text-sm text-emerald-700">
                  当前有 {activeGoals.length} 个进行中的教学目标。
                </p>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-emerald-950">最近课程</h2>

              {recentLessons.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                  暂时没有课程记录。
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {recentLessons.map((lesson) => {
                    const className =
                      classRelations.find(
                        (relation) => relation.class_id === lesson.class_id
                      )?.classes?.name || "未知班级";

                    return (
                      <div
                        key={lesson.id}
                        className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                      >
                        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
                          <div>
                            <h3 className="font-bold text-emerald-950">
                              {lesson.lesson_title}
                            </h3>

                            <p className="mt-1 text-xs text-stone-500">
                              {lesson.lesson_date} · {className} ·{" "}
                              {lesson.duration_minutes} 分钟
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-600">
                          {lesson.lesson_content_and_feedback}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
    </AdminGuard>
  );
}