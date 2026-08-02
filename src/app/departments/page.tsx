import Link from "next/link";

const departments = [
  {
    name: "课程部",
    englishName: "Curriculum Department",
    description:
      "课程部是ORP的核心教学部门。部门成员每周独自完成备课、线上授课、作业布置批改等全套教学工作，还会定期举办线下社团交流活动，帮助各位志愿老师交流授课思路、优化课堂内容。我们为河北三至六年级的小学生开展数学、英语公益课程，在讲解知识之余给予长期的陪伴互动。",
    responsibilities: [
      "课程设计",
      "课程材料整理",
      "教学反馈与优化",
    ],
  },
  {
    name: "行动部",
    englishName: "Action Department",
    description:
      "行动部负责ORP的品牌运营与创意落地，是社团对外传递公益实践价值的窗口。日常工作包含公众号运营、宣传视觉设计、原创英文绘本创作、公益周边设计、校内外公益活动策划等丰富内容。设计的英文绘本等原创产品皆会运用在平时的教学与公益活动中。",
    responsibilities: [
      "项目沟通协调",
      "活动组织执行",
      "合作与宣传支持",
    ],
  },
];

export default function DepartmentsPage() {
  return (
    <main className="bg-[#f6f5e9] text-stone-800">
      
      {/* 页面标题 */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2f5d50]">
              Departments
            </p>

            <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight text-emerald-950 md:text-7xl">
              部门介绍
            </h1>
          </div>
        </div>
      </section>


      {/* 部门介绍 */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="space-y-8">

          {departments.map((department, index) => (
            <section
              key={department.name}
              className="rounded-[2rem] border border-emerald-100 bg-white p-8 shadow-sm md:p-12"
            >

              <div className="flex flex-col gap-8 md:flex-row md:justify-between">

                <div className="md:max-w-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
                    {department.englishName}
                  </p>

                  <h2 className="mt-4 text-4xl font-bold text-emerald-950">
                    {department.name}
                  </h2>

                  <div className="mt-6 h-1 w-16 rounded-full bg-[#cfe8d6]" />
                </div>


                <div className="md:max-w-3xl">
                  <p className="leading-8 text-stone-700">
                    {department.description}
                  </p>


                  <div className="mt-8 border-t border-emerald-100 pt-6">

                    <h3 className="text-lg font-bold text-emerald-950">
                      主要工作
                    </h3>


                    <div className="mt-4 flex flex-wrap gap-3">
                      {department.responsibilities.map(
                        (item) => (
                          <span
                            key={item}
                            className="rounded-full border border-emerald-200 bg-[#f6f5e9] px-4 py-2 text-sm font-semibold text-emerald-800"
                          >
                            {item}
                          </span>
                        )
                      )}
                    </div>

                  </div>

                </div>

              </div>

            </section>
          ))}

        </div>
      </section>


      {/* 协作说明 */}
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
              课程部关注教学内容与课程质量，
              行动部负责项目运营、宣传与资源支持。
              两个部门相互配合，共同保障ORP线上公益教学的稳定开展。
            </p>


            <p>
              从课堂设计到项目运营，
              ORP希望通过明确分工与持续协作，
              建立一个长期、稳定、有温度的公益教育平台。
            </p>

          </div>

        </div>
      </section>


      {/* 加入 */}
      <section className="bg-[#f6f5e9]">
        <div className="mx-auto max-w-6xl px-6 py-16">

          <div className="rounded-[2rem] bg-emerald-950 px-8 py-10 text-white md:flex md:items-center md:justify-between md:px-12">

            <div>
              <h2 className="text-3xl font-bold">
                想加入 ORP？
              </h2>

              <p className="mt-3 leading-7 text-emerald-50">
                欢迎联系社长或加入微信群
              </p>
            </div>


            <div className="mt-8 md:mt-0">
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