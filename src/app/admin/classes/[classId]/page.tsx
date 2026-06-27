import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ClassDetailPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

function getStatusLabel(status: string) {
  if (status === "active") return "运行中";
  if (status === "archived") return "已封存";
  if (status === "delete_requested") return "删除申请中";
  if (status === "completed") return "已完成";
  return status;
}

function getStatusClassName(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-stone-100 text-stone-500";
  if (status === "delete_requested") return "bg-red-50 text-red-700";
  if (status === "completed") return "bg-blue-50 text-blue-700";
  return "bg-stone-100 text-stone-600";
}

export default async function AdminClassDetailPage({
  params,
}: ClassDetailPageProps) {
  const { classId } = await params;

  const { data: classData, error: classError } = await supabase
    .from("classes")
    .select(
      `
      id,
      name,
      school,
      status,
      cohort_id,
      cohorts(name, status),
      class_teachers(
        teachers(id, name, email, status)
      ),
      class_students(
        students(id, name, note, status)
      )
    `
    )
    .eq("id", classId)
    .maybeSingle();

  const { data: lessonRecords, error: lessonError } = await supabase
    .from("lesson_records")
    .select(
      "id, lesson_title, lesson_date, duration_minutes, lesson_content_and_feedback, homework, next_plan, teacher_reflection, created_at"
    )
    .eq("class_id", classId)
    .order("lesson_date", { ascending: false });

  const { data: teachingGoals, error: goalError } = await supabase
    .from("teaching_goals")
    .select(
      "id, title, description, start_date, end_date, status, expected_lessons, completed_at, created_at"
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (classError) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">读取班级失败</h1>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            {classError.message}
          </p>

          <Link
            href="/admin/classes"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回班级管理
          </Link>
        </section>
      </main>
    );
  }

  if (!classData) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-emerald-950">
            没有找到这个班级
          </h1>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            这个班级可能已经被删除，或者链接里的 classId 不正确。
          </p>

          <Link
            href="/admin/classes"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回班级管理
          </Link>
        </section>
      </main>
    );
  }

  const teachers =
    (classData as any).class_teachers
      ?.map((item: any) => item.teachers)
      .filter(Boolean) || [];

  const students =
    (classData as any).class_students
      ?.map((item: any) => item.students)
      .filter(Boolean) || [];

  const lessons = lessonRecords || [];
  const goals = teachingGoals || [];

  const totalLessons = lessons.length;
  const totalMinutes = lessons.reduce(
    (sum: number, lesson: any) => sum + (lesson.duration_minutes || 0),
    0
  );
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  const activeGoals = goals.filter((goal: any) => goal.status === "active");
  const completedGoals = goals.filter(
    (goal: any) => goal.status === "completed"
  );

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-emerald-950">
                {(classData as any).name}
              </h1>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(
                  (classData as any).status
                )}`}
              >
                {getStatusLabel((classData as any).status)}
              </span>
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              这里用于查看单个班级的成员、教学目标、课程记录和基础运行情况。
            </p>
          </div>

          <Link
            href="/admin/classes"
            className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回班级管理
          </Link>
        </div>

        {(lessonError || goalError) && (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            部分数据读取失败：
            {lessonError?.message ? ` 课程记录：${lessonError.message}` : ""}
            {goalError?.message ? ` 教学目标：${goalError.message}` : ""}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">学生人数</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {students.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">小老师</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {teachers.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">课程记录</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {totalLessons}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">累计时长</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {totalHours}
            </p>
            <p className="mt-1 text-xs text-stone-500">小时</p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="space-y-6">
            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-emerald-950">
                班级基本信息
              </h2>

              <div className="mt-5 space-y-3 text-sm leading-7 text-stone-600">
                <p>
                  <span className="font-semibold text-stone-800">届别：</span>
                  {(classData as any).cohorts?.name || "未设置届别"}
                </p>

                <p>
                  <span className="font-semibold text-stone-800">
                    合作学校：
                  </span>
                  {(classData as any).school || "暂未填写"}
                </p>

                <p>
                  <span className="font-semibold text-stone-800">状态：</span>
                  {getStatusLabel((classData as any).status)}
                </p>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-emerald-950">
                小老师名单
              </h2>

              {teachers.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-600">
                  这个班级暂未分配小老师。
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {teachers.map((teacher: any) => (
                    <div
                      key={teacher.id}
                      className="rounded-2xl bg-[#fffdf4] p-4"
                    >
                      <p className="font-bold text-emerald-950">
                        {teacher.name}
                      </p>

                      <p className="mt-1 text-sm text-stone-500">
                        {teacher.email || "暂未填写邮箱"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-emerald-950">
                学生名单
              </h2>

              {students.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-600">
                  这个班级暂未录入学生。
                </p>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {students.map((student: any) => (
                    <div
                      key={student.id}
                      className="rounded-2xl bg-[#fffdf4] p-4"
                    >
                      <p className="font-bold text-emerald-950">
                        {student.name}
                      </p>

                      <p className="mt-1 text-sm leading-6 text-stone-500">
                        {student.note || "暂无学生备注"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>

          <section className="space-y-6">
            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-bold text-emerald-950">
                    教学目标
                  </h2>

                  <p className="mt-2 text-sm leading-7 text-stone-600">
                    当前班级的目标会帮助管理员判断课程是否有连续性。
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    进行中 {activeGoals.length}
                  </span>

                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                    已完成 {completedGoals.length}
                  </span>
                </div>
              </div>

              {goals.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-600">
                  这个班级还没有教学目标。
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {goals.map((goal: any) => (
                    <div
                      key={goal.id}
                      className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusClassName(
                            goal.status
                          )}`}
                        >
                          {getStatusLabel(goal.status)}
                        </span>

                        {goal.expected_lessons && (
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-500">
                            预计 {goal.expected_lessons} 节课
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2 font-bold text-emerald-950">
                        {goal.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {goal.description || "暂无目标描述"}
                      </p>

                      <p className="mt-2 text-xs text-stone-500">
                        {goal.start_date || "未设置开始日期"} -{" "}
                        {goal.end_date || "未设置结束日期"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-emerald-950">
                课程记录
              </h2>

              <p className="mt-2 text-sm leading-7 text-stone-600">
                这里显示这个班级所有已提交的课程记录。后续可以继续加入学生留言和出勤情况。
              </p>

              {lessons.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#fffdf4] p-4 text-sm text-stone-600">
                  这个班级还没有课程记录。
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {lessons.map((lesson: any) => (
                    <div
                      key={lesson.id}
                      className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-500">
                          {lesson.lesson_date || "未填写日期"}
                        </span>

                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          {lesson.duration_minutes || 0} 分钟
                        </span>
                      </div>

                      <h3 className="mt-2 font-bold text-emerald-950">
                        {lesson.lesson_title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {lesson.lesson_content_and_feedback ||
                          "暂无课程内容记录"}
                      </p>

                      {lesson.next_plan && (
                        <p className="mt-2 text-sm leading-6 text-stone-500">
                          <span className="font-semibold text-stone-700">
                            下一步：
                          </span>
                          {lesson.next_plan}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>
        </section>
      </section>
    </main>
  );
}