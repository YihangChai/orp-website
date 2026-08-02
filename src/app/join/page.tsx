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

      {/* Hero */}
      <section className="bg-[#2f5d50] text-white">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">

          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#8fb8a3]">
            Join ORP
          </p>

          <h1 className="mt-6 text-5xl font-bold md:text-7xl">
            加入我们
          </h1>

          <p className="mt-7 max-w-3xl text-lg leading-9 text-emerald-50 md:text-xl">
            ORP欢迎愿意陪伴学生成长、认真投入教学与公益实践的同学加入。
            无论你希望成为小老师，参与课程建设，还是支持项目运营，
            都可以在这里找到属于自己的参与方式。
          </p>

        </div>
      </section>


      {/* 主体 */}
      <section className="mx-auto max-w-6xl px-6 py-20">

        <div className="grid gap-10 md:grid-cols-[1fr_0.9fr]">


          {/* 左侧 */}
          <section className="rounded-[2rem] border border-emerald-100 bg-white p-8 shadow-sm md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Who We Need
            </p>

            <h2 className="mt-4 text-3xl font-bold text-emerald-950 md:text-4xl">
              我们期待这样的成员
            </h2>

            <p className="mt-6 leading-8 text-stone-700">
              ORP更看重责任感、耐心和持续参与。
              你不需要一开始就拥有丰富教学经验，
              但需要愿意准备课程、倾听学生反馈，
              并在长期陪伴中不断成长。
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

          </section>



          {/* 联系方式 */}
          <section className="rounded-[2rem] bg-[#2f5d50] p-8 text-white shadow-sm md:p-12">

            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#8fb8a3]">
              Contact
            </p>

            <h2 className="mt-4 text-3xl font-bold md:text-4xl">
              联系我们
            </h2>


            <p className="mt-6 leading-8 text-emerald-50">
              如果你希望加入ORP，
              或进一步了解小老师、课程部和行动部的具体工作，
              欢迎通过以下方式联系我们。
            </p>
            <div className="mt-8 space-y-5">

            <div className="rounded-2xl bg-white/10 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8fb8a3]">
                Email
              </p>


              <div className="mt-4 space-y-4 text-lg font-semibold">

                <div>
                  <p className="text-sm text-emerald-100">
                    社长
                  </p>
                  <p className="mt-1">
                    zhushengyuan25@shphschool.com
                  </p>
                </div>


                <div>
                  <p className="text-sm text-emerald-100">
                    课程部部长
                  </p>

                  <p className="mt-1">
                    sunxiaotong259@shphschool.com
                  </p>

                  <p>
                    xuezhetian259@shphschool.com
                  </p>
                </div>


                <div>
                  <p className="text-sm text-emerald-100">
                    宣传部部长
                  </p>

                  <p className="mt-1">
                    zhuyige25@shphschool.com
                  </p>
                </div>

              </div>

            </div>

          </div>
          </section>
        </div>
      </section>

      {/* 底部引导 */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-[2rem] bg-[#fffdf4] p-8 text-center shadow-sm md:p-12">
            <h2 className="text-3xl font-bold text-emerald-950">
              一起让阅读成为陪伴
            </h2>

            <p className="mx-auto mt-4 max-w-2xl leading-8 text-stone-700">
              ORP相信长期、稳定、有温度的教育陪伴。
              我们期待更多同学加入，一起创造有意义的公益实践。
            </p>


            <Link
              href="/departments"
              className="mt-8 inline-block rounded-full bg-emerald-800 px-7 py-3 font-semibold text-white hover:bg-emerald-900"
            >
              了解部门介绍
            </Link>

          </div>
        </div>
      </section>
    </main>
  );
}