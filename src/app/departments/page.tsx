import Link from "next/link";

const departments = [
  {
    name: "课程部",
    englishName: "Curriculum Department",
    description:
      "这里之后填写课程部的基本介绍。可以说明课程部如何设计阅读内容、支持小老师备课、整理课程资源，并帮助 ORP 的课堂保持连续性和质量。",
    responsibilities: [
      "阅读课程设计",
      "小老师备课支持",
      "课程材料整理",
      "教学反馈与优化",
    ],
  },
  {
    name: "行动部",
    englishName: "Action Department",
    description:
      "这里之后填写行动部的基本介绍。可以说明行动部如何负责项目执行、沟通协调、活动组织，以及让 ORP 的线上课程和线下合作更稳定地运行。",
    responsibilities: [
      "项目沟通协调",
      "活动组织执行",
      "成员联系与安排",
      "合作与宣传支持",
    ],
  },
];

export default function DepartmentsPage() {
  return (
    <main className="bg-[#f6f5e9] text-stone-800">
      {/* 部门介绍第一部分：页面标题 */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2f5d50]">
              Departments
            </p>

            <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight text-emerald-950 md:text-7xl">
              部门介绍
            </h1>
          </div>

          <p className="text-lg leading-8 text-stone-700 md:text-xl">
            这里之后填写一小段介绍：ORP 如何通过不同部门分工，让阅读课程、
            项目沟通和长期运营更加清晰、有序。
          </p>
        </div>
      </section>

      {/* 部门介绍第二部分：课程部和行动部 */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="space-y-10">
          {departments.map((department, index) => (
            <section
              key={department.name}
              className="grid overflow-hidden rounded-[2rem] bg-white shadow-sm md:grid-cols-[0.85fr_1.15fr]"
            >
              {/* 左侧图片区/图标占位 */}
              <div
                className={
                  index === 0
                    ? "flex min-h-72 items-center justify-center bg-[#dfead2] p-8"
                    : "flex min-h-72 items-center justify-center bg-[#2f5d50] p-8"
                }
              >
                <div
                  className={
                    index === 0
                      ? "flex h-36 w-36 items-center justify-center rounded-full border border-emerald-200 bg-white/70 text-center text-sm font-semibold text-emerald-800"
                      : "flex h-36 w-36 items-center justify-center rounded-full border border-white/30 bg-white/10 text-center text-sm font-semibold text-white"
                  }
                >
                  图标 / 图片
                  <br />
                  占位区域
                </div>
              </div>

              {/* 右侧文字内容 */}
              <div className="p-8 md:p-12">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
                  {department.englishName}
                </p>

                <h2 className="mt-4 text-4xl font-bold text-emerald-950">
                  {department.name}
                </h2>

                <p className="mt-6 leading-8 text-stone-700">
                  {department.description}
                </p>

                <div className="mt-8 border-t border-emerald-100 pt-6">
                  <h3 className="text-lg font-bold text-emerald-950">
                    主要工作
                  </h3>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {department.responsibilities.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-emerald-200 bg-[#f6f5e9] px-4 py-2 text-sm font-semibold text-emerald-800"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>

      {/* 部门介绍第三部分：协作说明 */}
      <section className="bg-[#2f5d50] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#8fb8a3]">
              How We Work Together
            </p>

            <h2 className="mt-5 text-3xl font-bold leading-tight md:text-5xl">
              两个部门共同支持 ORP 的长期运行
            </h2>
          </div>

          <div className="space-y-5 text-lg leading-9 text-emerald-50">
            <p>
              这里之后可以填写课程部和行动部如何配合：课程部关注教学内容和课程质量，
              行动部关注执行、沟通和项目推进。
            </p>

            <p>
              这一部分不用写很多，只要让访客理解 ORP 的运行不是临时安排，
              而是有分工、有协作、有长期计划。
            </p>
          </div>
        </div>
      </section>

      {/* 部门介绍第四部分：引导加入 */}
      <section className="bg-[#f6f5e9]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-[2rem] bg-emerald-950 px-8 py-10 text-white md:flex md:items-center md:justify-between md:px-12">
            <div>
              <h2 className="text-3xl font-bold">想加入 ORP？</h2>

              <p className="mt-3 leading-7 text-emerald-50">
                欢迎联系社长或加入微信群
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 md:mt-0">
              <Link
                href="/join"
                className="rounded-full bg-[#cfe8d6] px-7 py-3 text-base font-semibold text-emerald-950 shadow-sm hover:bg-[#bfe0c8]"
              >
                加入我们
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}