import Link from "next/link";

const students = [
  {
    name: "学生 A",
    grade: "四年级",
    note: "这里之后填写阅读基础、性格特点或上课注意事项。",
  },
  {
    name: "学生 B",
    grade: "四年级",
    note: "这里之后填写学生情况。",
  },
];

const goals = [
  {
    title: "小王子阅读计划",
    period: "第 1–5 周",
    description:
      "这里之后显示当前课程目标：例如完成《小王子》前几章阅读，并练习复述、表达和关键词理解。",
    status: "进行中",
  },
];

const lessonRecords = [
  {
    date: "2026-06-23",
    student: "学生n/n",
    title: "小王子阅读课：第一章",
    duration: "40 分钟",
    feedback:
      "学生能够跟上主要情节，但在表达自己的理解时还需要更多引导。",
  },
  {
    date: "2026-06-16",
    student: "学生n/n",
    title: "阅读导入与自我介绍",
    duration: "40 分钟",
    feedback:
      "完成了基本介绍和阅读兴趣了解，后续可以选择更适合学生水平的材料。",
  },
];

export default function TeacherPage() {
  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="mt-3 text-4xl font-bold text-emerald-950">
              小老师主页
            </h1>
          </div>

        </div>

        {/* 主体布局：左边个人主页，中间目标和授课记录 */}
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          {/* 左侧：个人主页 */}
          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#cfe8d6] text-xl font-bold text-emerald-950">
                  老师
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-emerald-950">
                    小老师姓名
                  </h2>
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-emerald-100 pt-5 text-sm leading-6 text-stone-600">
                <p>
                  <span className="font-semibold text-stone-800">
                    学生：
                  </span>
                  学生 A、学生 B
                </p>
                <p>
                  <span className="font-semibold text-stone-800">
                    科目：
                  </span>
                  英语/数学
                </p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-emerald-100 bg-[#fffdf4] p-7 shadow-sm">

              <h2 className="mt-3 text-2xl font-bold text-emerald-950">
                我的学生
              </h2>

              <div className="mt-5 space-y-4">
                {students.map((student) => (
                  <div
                    key={student.name}
                    className="rounded-2xl border border-emerald-100 bg-white/80 p-5"
                  >
                    <p className="font-bold text-emerald-950">
                      {student.name}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      {student.note}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                更多
              </p>
              <div className="mt-5 space-y-3">
                <Link
                  href="/teacher/stats"
                  className="block rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  查看个人统计
                </Link>

                <Link
                  href="/teacher/goals"
                  className="block rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  管理课程目标
                </Link>
              </div>
            </section>
          </aside>

          {/* 中间：目标和授课记录 */}
          <section className="space-y-8">
            {/* 当前目标 */}
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Current Goals
                  </p>

                  <h2 className="mt-3 text-3xl font-bold text-emerald-950">
                    当前课程目标
                  </h2>
                </div>

                <Link
                  href="/teacher/goals"
                  className="w-fit rounded-full border border-emerald-200 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  查看全部目标
                </Link>
              </div>

              <div className="mt-7 space-y-5">
                {goals.map((goal) => (
                  <article
                    key={goal.title}
                    className="rounded-2xl bg-[#edf3df] p-6"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div>
                        <h3 className="text-2xl font-bold text-emerald-950">
                          {goal.title}
                        </h3>

                        <p className="mt-1 text-sm font-semibold text-emerald-700">
                          {goal.period}
                        </p>
                      </div>

                      <span className="w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-800">
                        {goal.status}
                      </span>
                    </div>

                    <p className="mt-4 leading-8 text-stone-700">
                      {goal.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            {/* 授课记录 */}
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>

                  <h2 className="mt-3 text-3xl font-bold text-emerald-950">
                    最近授课记录
                  </h2>

                  <p className="mt-3 leading-7 text-stone-600">
                    这里之后会从 Supabase 的 lesson_records 表读取当前小老师的记录。
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
                {lessonRecords.map((record) => (
                  <article
                    key={`${record.date}-${record.title}`}
                    className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-6"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">
                          {record.date}｜{record.duration}
                        </p>

                        <h3 className="mt-2 text-2xl font-bold text-emerald-950">
                          {record.title}
                        </h3>
                      </div>

                      <p className="w-fit rounded-full bg-[#f6f5e9] px-4 py-2 text-sm font-semibold text-stone-600">
                        {record.student}
                      </p>
                    </div>

                    <p className="mt-4 leading-8 text-stone-700">
                      {record.feedback}
                    </p>
                  </article>
                ))}
              </div>

              <div className="mt-8 flex justify-center border-t border-emerald-100 pt-6">
                <Link
                  href="/teacher/records"
                  className="rounded-full border border-emerald-200 bg-[#f6f5e9] px-6 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  展开全部授课记录
                </Link>
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}