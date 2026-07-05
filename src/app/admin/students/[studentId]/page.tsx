import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type StudentDetailPageProps = {
  params: Promise<{
    studentId: string;
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
  goal_id: string | null;
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

type AttendanceRecord = {
  id: string;
  lesson_record_id: string;
  student_id: string;
  is_present: boolean;
  created_at: string;
};

type StudentComment = {
  id: string;
  lesson_record_id: string;
  student_id: string | null;
  student_name: string | null;
  comment: string;
  created_at: string;
};

type ParentMessage = {
  id: string;
  student_id: string | null;
  student_name: string | null;
  parent_name: string | null;
  message: string;
  created_at: string;
};

function getStudentStatusLabel(status: string) {
  if (status === "withdrawn") return "已退出";
  if (status === "archived") return "已归档";
  if (status === "delete_requested") return "待删除确认";
  return "当前";
}

function getStudentStatusClassName(status: string) {
  if (status === "withdrawn") return "bg-red-50 text-red-700";
  if (status === "archived") return "bg-stone-100 text-stone-500";
  if (status === "delete_requested") return "bg-red-50 text-red-700";
  return "bg-emerald-50 text-emerald-700";
}

function formatHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function formatAttendanceRate(presentCount: number, attendanceCount: number) {
  if (attendanceCount === 0) return "暂无";
  return `${Math.round((presentCount / attendanceCount) * 100)}%`;
}

function getAttentionLabel({
  status,
  lessonCount,
  attendanceCount,
  presentCount,
}: {
  status: string;
  lessonCount: number;
  attendanceCount: number;
  presentCount: number;
}) {
  if (status === "withdrawn") {
    return {
      text: "已退出",
      className: "bg-red-50 text-red-700",
      description: "这个学生已经被标记为退出，历史课程和出勤记录仍然保留。",
    };
  }

  if (lessonCount > 0 && attendanceCount === 0) {
    return {
      text: "缺少出勤记录",
      className: "bg-amber-50 text-amber-700",
      description: "班级已有课程记录，但这个学生还没有对应出勤记录，需要检查课程记录是否填写完整。",
    };
  }

  if (attendanceCount > 0 && presentCount / attendanceCount < 0.6) {
    return {
      text: "需要关注",
      className: "bg-red-50 text-red-700",
      description: "该学生出勤率偏低，建议联系小老师或河北老师确认是否还在持续参加课程。",
    };
  }

  if (lessonCount === 0) {
    return {
      text: "暂无课程",
      className: "bg-stone-100 text-stone-500",
      description: "这个学生所在班级暂时还没有课程记录。",
    };
  }

  return {
    text: "正常",
    className: "bg-emerald-50 text-emerald-700",
    description: "该学生目前有课程记录，出勤情况没有明显异常。",
  };
}

export default async function StudentDetailPage({
  params,
}: StudentDetailPageProps) {
  const { studentId } = await params;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select(
      "id, name, note, status, student_code, pin_code, auth_user_id, created_at"
    )
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">读取失败</h1>
          <p className="mt-3 text-sm text-stone-600">
            读取学生资料失败：{studentError.message}
          </p>

          <Link
            href="/admin/students"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回学生管理
          </Link>
        </section>
      </main>
    );
  }

  if (!student) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-emerald-950">
            没有找到这个学生
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            可能这个学生已经被删除，或者链接里的 ID 不正确。
          </p>

          <Link
            href="/admin/students"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回学生管理
          </Link>
        </section>
      </main>
    );
  }

  const { data: classRelationsData, error: classRelationError } =
    await supabase
      .from("class_students")
      .select(
        `
        class_id,
        classes (
          id,
          name,
          school,
          status,
          class_code,
          cohort_id,
          cohorts (
            id,
            name,
            status
          ),
          class_teachers (
            teachers (
              id,
              name,
              email,
              status
            )
          )
        )
      `
      )
      .eq("student_id", studentId);

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
            href="/admin/students"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回学生管理
          </Link>
        </section>
      </main>
    );
  }

  const classRelations = (classRelationsData || []) as ClassRelation[];

  const classIds = classRelations
    .map((relation) => relation.class_id)
    .filter(Boolean);

  let lessonRecords: LessonRecord[] = [];

  if (classIds.length > 0) {
    const { data: lessonData, error: lessonError } = await supabase
      .from("lesson_records")
      .select(
        "id, teacher_id, class_id, goal_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, homework, next_plan, material_link, teacher_reflection, created_at"
      )
      .in("class_id", classIds)
      .order("lesson_date", { ascending: false });

    if (lessonError) {
      return (
        <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
          <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-red-100 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-red-700">
              读取课程记录失败
            </h1>
            <p className="mt-3 text-sm text-stone-600">
              {lessonError.message}
            </p>

            <Link
              href="/admin/students"
              className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回学生管理
            </Link>
          </section>
        </main>
      );
    }

    lessonRecords = (lessonData || []) as LessonRecord[];
  }

  const { data: attendanceData, error: attendanceError } = await supabase
    .from("lesson_attendance")
    .select("id, lesson_record_id, student_id, is_present, created_at")
    .eq("student_id", studentId);

  if (attendanceError) {
    return (
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">
            读取出勤记录失败
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            {attendanceError.message}
          </p>

          <Link
            href="/admin/students"
            className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            返回学生管理
          </Link>
        </section>
      </main>
    );
  }

  const { data: commentData } = await supabase
    .from("student_lesson_comments")
    .select("id, lesson_record_id, student_id, student_name, comment, created_at")
    .or(`student_id.eq.${studentId},student_name.eq.${student.name}`)
    .order("created_at", { ascending: false });

  const { data: parentMessageData } = await supabase
    .from("parent_messages")
    .select("id, student_id, student_name, parent_name, message, created_at")
    .or(`student_id.eq.${studentId},student_name.eq.${student.name}`)
    .order("created_at", { ascending: false });

  const attendanceRecords = (attendanceData || []) as AttendanceRecord[];
  const studentComments = (commentData || []) as StudentComment[];
  const parentMessages = (parentMessageData || []) as ParentMessage[];

  const attendanceByLessonId = new Map<string, AttendanceRecord>();

  attendanceRecords.forEach((attendance) => {
    attendanceByLessonId.set(attendance.lesson_record_id, attendance);
  });

  const totalMinutes = lessonRecords.reduce(
    (sum, lesson) => sum + (lesson.duration_minutes || 0),
    0
  );

  const presentCount = attendanceRecords.filter(
    (attendance) => attendance.is_present
  ).length;

  const absentCount = attendanceRecords.filter(
    (attendance) => !attendance.is_present
  ).length;

  const attendanceCount = attendanceRecords.length;

  const attention = getAttentionLabel({
    status: student.status || "active",
    lessonCount: lessonRecords.length,
    attendanceCount,
    presentCount,
  });

  const teacherNames = Array.from(
    new Set(
      classRelations.flatMap((relation) => {
        const classTeachers = relation.classes?.class_teachers || [];

        return classTeachers
          .map((item: any) => item.teachers?.name)
          .filter(Boolean);
      })
    )
  );

  const recentLessons = lessonRecords.slice(0, 8);

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              {student.name}
            </h1>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/students"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回学生管理
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
            <p className="text-sm text-stone-500">相关课程</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {lessonRecords.length}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              累计 {formatHours(totalMinutes)} 小时
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">出勤</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {presentCount}/{attendanceCount}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              出勤率 {formatAttendanceRate(presentCount, attendanceCount)}
            </p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">缺勤</p>
            <p className="mt-2 text-3xl font-bold text-red-700">
              {absentCount}
            </p>
            <p className="mt-1 text-xs text-stone-500">根据出勤记录统计</p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">关注状态</p>
            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${attention.className}`}
            >
              {attention.text}
            </span>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              {attention.description}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">基本信息</h2>

            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="text-stone-500">学生姓名</p>
                <p className="mt-1 font-semibold text-emerald-950">
                  {student.name}
                </p>
              </div>

              <div>
                <p className="text-stone-500">学生状态</p>
                <span
                  className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStudentStatusClassName(
                    student.status || "active"
                  )}`}
                >
                  {getStudentStatusLabel(student.status || "active")}
                </span>
              </div>

              <div>
                <p className="text-stone-500">负责小老师</p>
                <p className="mt-1 font-semibold text-emerald-950">
                  {teacherNames.length > 0 ? teacherNames.join("、") : "暂无"}
                </p>
              </div>

              <div>
                <p className="text-stone-500">创建时间</p>
                <p className="mt-1 font-semibold text-emerald-950">
                  {student.created_at?.slice(0, 10) || "暂无"}
                </p>
              </div>

              <div>
                <p className="text-stone-500">备注 / 退出记录</p>
                <p className="mt-1 whitespace-pre-line rounded-2xl bg-[#fffdf4] p-4 text-sm leading-7 text-stone-600">
                  {student.note || "暂无备注"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-dashed border-emerald-200 bg-[#fffdf4] p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">
              学生登录信息
            </h2>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              第一版学生端使用班级码 + 学生码 + PIN 登录。管理员可以在学生管理页生成或重置学生 PIN。
            </p>

            <div className="mt-5 space-y-3 rounded-2xl bg-white p-4 text-sm">
              <div>
                <p className="text-stone-500">班级码</p>
                <p className="mt-1 font-semibold text-emerald-950">
                  {classRelations[0]?.classes?.class_code || "暂未生成"}
                </p>
              </div>

              <div>
                <p className="text-stone-500">学生码</p>
                <p className="mt-1 font-semibold text-emerald-950">
                  {student.student_code || "暂未生成"}
                </p>
              </div>

              <div>
                <p className="text-stone-500">PIN</p>
                <p className="mt-1 font-semibold text-emerald-950">
                  {student.pin_code || "暂未生成"}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-6 text-stone-500">
              注意：现在是 MVP 阶段，为了方便测试，PIN 会直接显示。正式上线后应该改成只允许重置，不长期明文展示。
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-bold text-emerald-950">所属班级</h2>

          {classRelations.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-red-600">
              这个学生暂时没有绑定任何班级。正常情况下，学生应该通过班级管理导入分班表自动创建和绑定。
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {classRelations.map((relation) => {
                const classItem = relation.classes;
                const teachers = classItem?.class_teachers || [];

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
                      班级码：
                      <span className="font-semibold text-emerald-950">
                        {classItem?.class_code || "暂未生成"}
                      </span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {teachers.length > 0 ? (
                        teachers.map((teacherRelation: any) => (
                          <span
                            key={teacherRelation.teachers?.id}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-600"
                          >
                            {teacherRelation.teachers?.name || "未知老师"}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-stone-400">
                          暂无小老师
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

        <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-bold text-emerald-950">最近课程记录</h2>

          {recentLessons.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
              暂时没有课程记录。
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {recentLessons.map((lesson) => {
                const attendance = attendanceByLessonId.get(lesson.id);

                const className =
                  classRelations.find(
                    (relation) => relation.class_id === lesson.class_id
                  )?.classes?.name || "未知班级";

                return (
                  <div
                    key={lesson.id}
                    className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <h3 className="font-bold text-emerald-950">
                          {lesson.lesson_title}
                        </h3>

                        <p className="mt-1 text-xs text-stone-500">
                          {lesson.lesson_date} · {className} ·{" "}
                          {lesson.duration_minutes} 分钟
                        </p>
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

                    <p className="mt-3 line-clamp-4 text-sm leading-7 text-stone-600">
                      {lesson.lesson_content_and_feedback}
                    </p>

                    {(lesson.homework || lesson.next_plan || lesson.material_link) && (
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {lesson.homework && (
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-xs font-semibold text-emerald-950">
                              作业 / 练习
                            </p>
                            <p className="mt-1 text-xs leading-5 text-stone-600">
                              {lesson.homework}
                            </p>
                          </div>
                        )}

                        {lesson.next_plan && (
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-xs font-semibold text-emerald-950">
                              下次计划
                            </p>
                            <p className="mt-1 text-xs leading-5 text-stone-600">
                              {lesson.next_plan}
                            </p>
                          </div>
                        )}

                        {lesson.material_link && (
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-xs font-semibold text-emerald-950">
                              课程材料
                            </p>
                            <a
                              href={lesson.material_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block text-xs font-semibold text-emerald-700 underline"
                            >
                              打开材料链接
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">学生反馈</h2>

            {studentComments.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                暂时没有学生反馈。
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {studentComments.slice(0, 5).map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                  >
                    <p className="text-sm leading-7 text-stone-700">
                      {comment.comment}
                    </p>

                    <p className="mt-2 text-xs text-stone-500">
                      {comment.created_at.slice(0, 10)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">家长/老师留言</h2>

            {parentMessages.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                暂时没有留言。
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {parentMessages.slice(0, 5).map((message) => (
                  <div
                    key={message.id}
                    className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                  >
                    <p className="text-sm leading-7 text-stone-700">
                      {message.message}
                    </p>

                    <p className="mt-2 text-xs text-stone-500">
                      {message.parent_name || "未署名"} ·{" "}
                      {message.created_at.slice(0, 10)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}