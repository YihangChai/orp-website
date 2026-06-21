import Link from "next/link";

const qualities = [
  "有爱心",
  "有耐心",
  "愿意长期投入",
  "愿意认真备课",
  "愿意沟通和反思",
  "对阅读或教育感兴趣",
];

export default function JoinPage() {
  return (
    <main className="bg-[#f6f5e9] text-stone-800">
      {/* 加入我们第一部分：更有温度的 Hero */}
      <section className="bg-[#2f5d50] text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1fr_0.9fr] md:items-center md:py-28">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#8fb8a3]">
              Join ORP
            </p>

            <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              加入我们
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-9 text-emerald-50 md:text-xl">
              ORP 欢迎愿意陪伴学生阅读、认真对待每一次课程、并愿意长期参与项目建设的同学加入。
              这里不是一份冷冰冰的申请表，而是一段共同参与、共同成长的开始。
            </p>
          </div>

          <div className="rounded-[2rem] bg-[#f6f5e9] p-6 text-emerald-950 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              A Small Invitation
            </p>

            <p className="mt-5 text-2xl font-bold leading-10">
              一段小宣传语
            </p>

            <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-white/60 p-5 text-sm leading-7 text-stone-600">
              这里之后可以放一张小老师上课截图、微信群招募海报、ORP 活动照片，
              或者一句来自社长的招募寄语。
            </div>
          </div>
        </div>
      </section>

      {/* 加入我们第二部分：我们需要什么样的人 + 联系方式 */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 md:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[2rem] border border-emerald-100 bg-[#fffdf4] p-8 shadow-sm md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Who We Are Looking For
            </p>

            <h2 className="mt-4 text-3xl font-bold leading-tight text-emerald-950 md:text-4xl">
              我们需要怎样的成员？
            </h2>

            <p className="mt-6 leading-8 text-stone-700">
              ORP 更看重责任感、耐心和持续参与，而不只是一次性的热情。
              你不需要一开始就非常擅长教学，但需要愿意准备、愿意倾听、愿意和学生一起慢慢进步。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {qualities.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-emerald-200 bg-[#f6f5e9] px-4 py-2 text-sm font-semibold text-emerald-800"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-10 rounded-2xl bg-[#edf3df] p-6">
              <h3 className="text-xl font-bold text-emerald-950">
                你可以参与什么？
              </h3>

              <p className="mt-3 leading-8 text-stone-700">
                你可以成为小老师，参与阅读陪伴和课程记录；也可以加入课程部或行动部，
                帮助 ORP 进行备课支持、活动组织、项目沟通和长期运营。
              </p>
            </div>
          </section>

          {/* 联系方式卡片 */}
          <section className="rounded-[2rem] bg-[#2f5d50] p-8 text-white shadow-sm md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#8fb8a3]">
              Contact
            </p>

            <h2 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">
              联系社长
            </h2>

            <p className="mt-6 leading-8 text-emerald-50">
              如果你想加入 ORP，或者希望进一步了解课程部、行动部和小老师的具体工作，
              可以通过下面的方式联系社长。
            </p>

            <div className="mt-8 space-y-5">
              <div className="rounded-2xl bg-white/10 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8fb8a3]">
                  WeChat
                </p>

                <p className="mt-2 text-xl font-bold">这里填写微信号</p>
              </div>

              <div className="rounded-2xl bg-white/10 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8fb8a3]">
                  WeChat Group
                </p>
                {/* </img className="h-36 w-36 shrink-0 rounded-xl bg-white object-cover p-2"> */}
                <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl bg-white text-center text-sm font-semibold text-stone-500">
                    微信群二维码
                    <br />
                    占位区域
                  </div>

                  <p className="leading-7 text-emerald-50">
                    这里之后可以贴微信群二维码。想加入 ORP 的同学可以先扫码进群，
                    再联系社长了解具体部门和参与方式。
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8fb8a3]">
                  Email
                </p>

                <p className="mt-2 text-xl font-bold">
                  your-email@example.com
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>

      {/* 加入我们第三部分：加入流程 */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Next Step
              </p>

              <h2 className="mt-5 text-3xl font-bold leading-tight text-emerald-950 md:text-5xl">
                加入流程
              </h2>
            </div>

            <div className="space-y-6">
              <div className="border-l-4 border-emerald-700 bg-[#f6f5e9] px-6 py-5">
                <h3 className="text-xl font-bold text-emerald-950">
                  1. 联系社长
                </h3>

                <p className="mt-2 leading-8 text-stone-700">
                  通过微信或邮箱说明你想加入 ORP，并简单介绍自己的兴趣和可参与时间。
                </p>
              </div>

              <div className="border-l-4 border-emerald-700 bg-[#f6f5e9] px-6 py-5">
                <h3 className="text-xl font-bold text-emerald-950">
                  2. 了解部门
                </h3>

                <p className="mt-2 leading-8 text-stone-700">
                  根据你的兴趣和时间安排，进一步了解课程部、行动部或小老师相关工作。
                </p>
              </div>

              <div className="border-l-4 border-emerald-700 bg-[#f6f5e9] px-6 py-5">
                <h3 className="text-xl font-bold text-emerald-950">
                  3. 开始参与
                </h3>

                <p className="mt-2 leading-8 text-stone-700">
                  之后可以参与培训、备课、课程记录、活动执行或其他项目建设工作。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 加入我们第四部分：低调但有存在感的结尾卡片 */}
      <section className="bg-[#f6f5e9]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-[2rem] border border-emerald-100 bg-[#fffdf4] p-8 shadow-sm md:p-10">
            <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Before You Join
                </p>

                <h2 className="mt-4 text-3xl font-bold text-emerald-950">
                  还不确定适合哪个方向？
                </h2>
              </div>

              <div>
                <p className="leading-8 text-stone-700">
                  你可以先了解课程部和行动部的具体工作。也可以直接联系社长，
                  简单说说你的兴趣、时间和想参与的方式。
                </p>

                <div className="mt-5 flex flex-wrap gap-4">
                  <Link
                    href="/departments"
                    className="rounded-full bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"
                  >
                    查看部门介绍
                  </Link>

                  <Link
                    href="/about"
                    className="rounded-full border border-emerald-200 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    关于我们
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}