import Link from "next/link";

//成果展示（累计授课时长，服务学生和参加的小老师）
const stats = [
  {
    label: "累计授课时长",
    value: "500+",
    unit: "小时",
  },
  {
    label: "服务学生",
    value: "80+",
    unit: "人",
  },
  {
    label: "参与小老师",
    value: "30+",
    unit: "人",
  },
];

//首页的ORP基本模块化介绍，简洁明了
const features = [
  {
    title: "持续的阅读陪伴",
    description:
      "ORP 通过线上课程连接学生志愿者与河北小学学生，让阅读不只是一次活动，而是一段可以持续发生的陪伴。",
  },
  {
    title: "清晰的课程目标",
    description:
      "小老师可以围绕阅读内容、词汇积累和拓展讨论进行备课，让每节课都有明确方向。",
  },
  {
    title: "可追踪的成长记录",
    description:
      "通过课程记录、学生反馈和项目数据，ORP 能更好地了解学生情况，也让管理团队持续优化课程质量。",
  },
];

export default function HomePage() {
  return (
    <main className="bg-[#f6f5e9] text-stone-800">
      {/*首页第一部分，ORP标题，一句话介绍以及进入按钮（需要设置登录后才显示并且对应不同角色）*/}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#dfead2] via-[#f8f5e8] to-[#ecf3df]">
        {/* 简单装饰：让首页更像纸张、草地和手绘风格 */}
        <div className="absolute left-8 top-20 h-36 w-36 rounded-full bg-emerald-200/40 blur-2xl" />
        <div className="absolute bottom-16 right-8 h-44 w-44 rounded-full bg-amber-200/40 blur-2xl" />
        <div className="absolute right-1/4 top-28 h-20 w-20 rotate-12 rounded-3xl bg-white/35" />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col items-center justify-center px-6 py-24 text-center">

          <h1 className="text-6xl font-bold tracking-tight text-emerald-950 md:text-8xl">
            ORP
          </h1>

          <p className="mb-5 rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm">
            Online Reading Partner
          </p>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-stone-700 md:text-xl">
            由学生主导，为河北小学提供线上阅读陪伴与课程支持的公益项目。
          </p>
          {/* 需修改 */}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-emerald-700 px-7 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              登陆后进入系统
            </Link>
          </div>
        </div>
      </section>

      {/* 首页第二部分，成果展示 */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-[2rem] border border-emerald-100 bg-white/80 p-8 text-center shadow-sm"
            >
              <p className="text-5xl font-bold text-emerald-800">
                {item.value}
              </p>
              <p className="mt-2 text-sm font-medium text-stone-500">
                {item.unit}
              </p>
              <p className="mt-4 text-base font-semibold text-stone-800">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 首页第三部分，2分钟内能看完并理解的ORP介绍 */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-[2rem] border border-emerald-100 bg-white/85 p-8 shadow-sm md:p-12">
          <div className="mx-auto max-w-3xl text-center">


            <h2 className="mt-4 text-3xl font-bold tracking-tight text-emerald-950 md:text-4xl">
              我们的愿景
            </h2>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Our Vision
            </p>
            <p className="mt-5 text-lg leading-8 text-stone-700">
              ORP 不只是一次次线上授课，而是希望通过稳定的课程陪伴、清晰的教学目标和持续的成长记录，
              让阅读成为学生可以长期接触、理解和享受的事情。
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl bg-[#f6f5e9] p-7"
              >
                <h3 className="text-xl font-semibold text-emerald-950">
                  {item.title}
                </h3>
                <p className="mt-4 leading-7 text-stone-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 首页第四部分，了解更多 */}
      <section className="border-t border-emerald-100 bg-[#edf3df]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-14 text-center md:flex-row md:text-left">
          <div>
            <h2 className="text-2xl font-bold text-emerald-950">
              想进一步了解 ORP？
            </h2>
            <p className="mt-2 text-stone-700">
              查看 ORP 的故事、理念和项目运行方式。
            </p>
          </div>

          <Link
            href="/about"
            className="rounded-full bg-emerald-800 px-6 py-3 font-semibold text-white shadow-sm hover:bg-emerald-900"
          >
            点击“关于我们”了解更多
          </Link>
        </div>
      </section>
    </main>
  );
}