import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

type StudentDetailPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

type StudentRecord = {
  id: string;
  name: string;
  note: string | null;
  status: string | null;
  username: string | null;
  grade: string | null;
  created_at: string;
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

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function getMany<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function getStudentStatusLabel(status: string) {
  if (status === "active") return "当前";
  if (status === "withdrawn") return "已退出";
  if (status === "archived") return "已归档";
  if (status === "delete_requested") return "待维护";
  return status;
}

function getStudentStatusClassName(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "withdrawn") return "bg-amber-50 text-amber-700";
  if (status === "archived") return "bg-stone-100 text-stone-500";
  if (status === "delete_requested") return "bg-red-50 text-red-700";
  return "bg-stone-100 text-stone-500";
}

function isCurrentStudent({
  status,
  classCount,
}: {
  status: string;
  classCount: number;
}) {
  return status === "active" && classCount > 0;
}

function isMaintenanceStudent({
  status,
  classCount,
}: {
  status: string;
  classCount: number;
}) {
  return (
    (status !== "active" && status !== "withdrawn" && status !== "archived") ||
    (status === "active" && classCount === 0)
  );
}

function getAttendanceRate(presentCount: number, attendanceCount: number) {
  if (attendanceCount === 0) return null;
  return presentCount / attendanceCount;
}

function formatAttendanceRate(presentCount: number, attendanceCount: number) {
  const rate = getAttendanceRate(presentCount, attendanceCount);
  if (rate === null) return "暂无";
  return `${Math.round(rate * 100)}%`;
}

function getAttendanceRateClassName(rate: number | null) {
  if (rate === null) return "bg-stone-100 text-stone-500";
  if (rate < 0.6) return "bg-red-50 text-red-700";
  if (rate < 0.8) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function isWithinRecentThirtyDays(dateString: string) {
  const lessonDate = new Date(dateString);
  const today = new Date();
  const thirtyDaysAgo = new Date();

  thirtyDaysAgo.setDate(today.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  return lessonDate >= thirtyDaysAgo && lessonDate <= today;
}

function formatHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function getAttentionLabel({
  status,
  classCount,
  lessonCount,
  recentThirtyDaysLessonCount,
  attendanceCount,
  presentCount,
}: {
  status: string;
  classCount: number;
  lessonCount: number;
  recentThirtyDaysLessonCount: number;
  attendanceCount: number;
  presentCount: number;
}) {
  if (status === "withdrawn") {
    return {
      text: "已退出",
      className: "bg-amber-50 text-amber-700",
      description: "这个学生已经退出或不再参与，历史记录仍然保留。",
    };
  }

  if (status === "archived") {
    return {
      text: "已归档",
      className: "bg-stone-100 text-stone-500",
      description: "这个学生属于历史数据，通常不再参与当前运营。",
    };
  }

  if (status !== "active") {
    return {
      text: "待维护：状态异常",
      className: "bg-red-50 text-red-700",
      description: "这个学生的状态不是 active / withdrawn / archived，需要在维护中心检查。",
    };
  }

  if (classCount === 0) {
    return {
      text: "待维护：未绑定班级",
      className: "bg-red-50 text-red-700",
      description: "这个学生账号存在，但没有绑定任何班级，需要在维护中心重新加入班级或处理异常数据。",
    };
  }

  if (lessonCount > 0 && attendanceCount === 0) {
    return {
      text: "缺少出勤记录",
      className: "bg-amber-50 text-amber-700",
      description: "班级已有课程记录，但这个学生没有对应出勤记录，需要检查课程记录是否完整。",
    };
  }

  if (attendanceCount > 0 && presentCount / attendanceCount < 0.6) {
    return {
      text: "需要关注",
      className: "bg-red-50 text-red-700",
      description: "该学生出勤率偏低，建议联系小老师或项目负责人确认参与情况。",
    };
  }

  if (lessonCount > 0 && recentThirtyDaysLessonCount === 0) {
    return {
      text: "近 30 天无课",
      className: "bg-amber-50 text-amber-700",
      description: "这个学生过去有课程记录，但近 30 天没有相关课程。",
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
    description: "该学生目前有课程记录，出勤和近期上课情况没有明显异常。",
  };
}

function ErrorCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-5xl rounded-[1.75rem] border border-red-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-red-700">{title}</h1>

        <p className="mt-3 text-sm text-stone-600">{message}</p>

        <Link
          href="/admin/students"
          className="mt-5 inline-block rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
        >
          返回学生查询
        </Link>
      </section>
    </main>
  );
}

export default async function StudentDetailPage({
  params,
}: StudentDetailPageProps) {
  const { studentId } = await params;

  const { data: studentData, error: studentError } = await supabase
    .from("students")
    .select("id, name, note, status, username, grade, created_at")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) {
    return (
      <ErrorCard title="读取失败" message={`读取学生资料失败：${studentError.message}`} />
    );
  }

  if (!studentData) {
    return (
      <ErrorCard
        title="没有找到这个学生"
        message="可能这个学生已经被删除，或者链接里的 ID 不正确。"
      />
    );
  }

  const student = studentData as StudentRecord;
  const studentStatus = student.status || "active";

  const { data: classRelationsData, error: classRelationError } = await supabase
    .from("class_students")
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
      <ErrorCard
        title="读取班级关系失败"
        message={classRelationError.message}
      />
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
        "id, teacher_id, class_id, lesson_date, duration_minutes, lesson_title, lesson_content_and_feedback, homework, next_plan, material_link, created_at"
      )
      .in("class_id", classIds)
      .order("lesson_date", { ascending: false });

    if (lessonError) {
      return (
        <ErrorCard title="读取课程记录失败" message={lessonError.message} />
      );
    }

    lessonRecords = (lessonData || []) as LessonRecord[];
  }

  const lessonIds = new Set(lessonRecords.map((lesson) => lesson.id));

  const { data: attendanceData, error: attendanceError } = await supabase
    .from("lesson_attendance")
    .select("id, lesson_record_id, student_id, is_present, created_at")
    .eq("student_id", studentId);

  if (attendanceError) {
    return (
      <ErrorCard title="读取出勤记录失败" message={attendanceError.message} />
    );
  }

  const { data: commentData } = await supabase
    .from("student_lesson_comments")
    .select("id, lesson_record_id, student_id, student_name, comment, created_at")
    .or(`student_id.eq.${studentId},student_name.eq.${student.name}`)
    .order("created_at", { ascending: false });

  const attendanceRecords = ((attendanceData || []) as AttendanceRecord[]).filter(
    (attendance) => lessonIds.has(attendance.lesson_record_id)
  );

  const studentComments = (commentData || []) as StudentComment[];

  const attendanceByLessonId = new Map<string, AttendanceRecord>();

  attendanceRecords.forEach((attendance) => {
    attendanceByLessonId.set(attendance.lesson_record_id, attendance);
  });

  const totalMinutes = lessonRecords.reduce(
    (sum, lesson) => sum + (lesson.duration_minutes || 0),
    0
  );

  const recentThirtyDaysLessonCount = lessonRecords.filter((lesson) =>
    isWithinRecentThirtyDays(lesson.lesson_date)
  ).length;

  const presentCount = attendanceRecords.filter(
    (attendance) => attendance.is_present
  ).length;

  const absentCount = attendanceRecords.filter(
    (attendance) => !attendance.is_present
  ).length;

  const attendanceCount = attendanceRecords.length;
  const attendanceRate = getAttendanceRate(presentCount, attendanceCount);

  const attention = getAttentionLabel({
    status: studentStatus,
    classCount: classRelations.length,
    lessonCount: lessonRecords.length,
    recentThirtyDaysLessonCount,
    attendanceCount,
    presentCount,
  });

  const teacherNames = Array.from(
    new Set(
      classRelations.flatMap((relation) => {
        const classItem = relation.classes;
        const classTeachers = getMany(classItem?.class_teachers);

        return classTeachers
          .map((item: any) => item.teachers?.name)
          .filter(Boolean);
      })
    )
  );

  const recentLessons = lessonRecords.slice(0, 8);
  const recentComments = studentComments.slice(0, 6);

  const shouldShowMaintenanceNotice = isMaintenanceStudent({
    status: studentStatus,
    classCount: classRelations.length,
  });

  return (
    <AdminGuard>
      <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
        <section className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold text-[#2f5d50]">
                Admin / 学生详情
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-emerald-950">
                  {student.name}
                </h1>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getStudentStatusClassName(
                    studentStatus
                  )}`}
                >
                  {getStudentStatusLabel(studentStatus)}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${attention.className}`}
                >
                  {attention.text}
                </span>
              </div>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                本页只用于查看学生资料、班级关系、课程记录、出勤和反馈。状态修改、班级调整、删除/归档、密码重置统一去维护中心处理。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/maintenance"
                className="w-fit rounded-full bg-[#2f5d50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              >
                进入维护中心
              </Link>

              <Link
                href="/admin/students"
                className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
              >
                返回学生查询
              </Link>

              <Link
                href="/admin"
                className="w-fit rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                返回管理员首页
              </Link>
            </div>
          </div>

          {shouldShowMaintenanceNotice && (
            <section className="mb-6 rounded-[1.75rem] border border-red-100 bg-red-50 p-5 text-sm leading-7 text-red-700">
              <p className="font-bold">这个学生需要维护</p>
              <p className="mt-1">
                {attention.description}
              </p>
            </section>
          )}

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
              <p className="text-sm text-stone-500">近 30 天课程</p>

              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {recentThirtyDaysLessonCount}
              </p>

              <p className="mt-1 text-xs text-stone-500">次课程</p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">出勤率</p>

              <span
                className={`mt-2 inline-flex rounded-full px-4 py-2 text-xl font-bold ${getAttendanceRateClassName(
                  attendanceRate
                )}`}
              >
                {formatAttendanceRate(presentCount, attendanceCount)}
              </span>

              <p className="mt-2 text-xs text-stone-500">
                出勤 {presentCount}/{attendanceCount}，缺勤 {absentCount}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">学生反馈</p>

              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {studentComments.length}
              </p>

              <p className="mt-1 text-xs text-stone-500">条留言</p>
            </div>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
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
                  <p className="text-stone-500">用户名 / 年级</p>
                  <p className="mt-1 font-semibold text-emerald-950">
                    {student.username || "无用户名"} ·{" "}
                    {student.grade || "未填写年级"}
                  </p>
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
                  <p className="text-stone-500">备注</p>
                  <p className="mt-1 whitespace-pre-line rounded-2xl bg-[#fffdf4] p-4 text-sm leading-7 text-stone-600">
                    {student.note || "暂无备注"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-emerald-950">所属班级</h2>

              {classRelations.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-red-50 p-5 text-sm leading-7 text-red-700">
                  这个学生暂时没有绑定任何班级。正常情况下，学生应该通过分班导入或维护中心加入班级。
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {classRelations.map((relation) => {
                    const classItem = relation.classes;
                    const cohort = getOne(classItem?.cohorts);
                    const teachers = getMany(classItem?.class_teachers);

                    const isClassArchived =
                      classItem?.status === "archived" ||
                      classItem?.status === "completed";

                    return (
                      <div
                        key={relation.class_id}
                        className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4"
                      >
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div>
                            <h3 className="font-bold text-emerald-950">
                              {classItem?.name || "未知班级"}
                            </h3>

                            <p className="mt-1 text-sm text-stone-600">
                              {cohort?.name || "未设置届别"} ·{" "}
                              {classItem?.school || "未填写学校"}
                            </p>
                          </div>

                          <span
                            className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                              isClassArchived
                                ? "bg-stone-100 text-stone-500"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isClassArchived ? "已封存" : "运行中"}
                          </span>
                        </div>

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
            </div>
          </section>

          <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
              <div>
                <h2 className="text-xl font-bold text-emerald-950">
                  最近课程记录
                </h2>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  只显示最近 8 条相关课程记录。完整课程统计后续会放到数据统计页。
                </p>
              </div>
            </div>

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

                      {(lesson.homework ||
                        lesson.next_plan ||
                        lesson.material_link) && (
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

          <section className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">学生反馈</h2>

            {recentComments.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                暂时没有学生反馈。
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {recentComments.map((comment) => (
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
          </section>
        </section>
      </main>
    </AdminGuard>
  );
}