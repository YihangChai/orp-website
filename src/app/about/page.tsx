import Link from "next/link";

const principles = [
  "持续陪伴",
  "认真记录",
  "双向成长",
];

export default function AboutPage() {
  return (
    <main className="bg-[#f6f5e9] text-stone-800">
      {/* 关于我们第一部分：文章式开头，不重复首页的大背景图 */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2f5d50]">
              About ORP
            </p>

            <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight text-emerald-950 md:text-7xl">
              关于我们
            </h1>
          </div>

          <p className="text-lg leading-8 text-stone-700 md:text-xl">
            这里之后填写一小段简洁介绍：ORP 是一个怎样的项目，我们为什么开始，
            以及我们希望通过长期阅读陪伴建立什么样的连接。
          </p>
        </div>
      </section>

      {/* 关于我们第二部分：图片 + 简短故事，不做复杂模块 */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid overflow-hidden rounded-[2rem] bg-white shadow-sm md:grid-cols-[1fr_1fr]">
          <div className="flex min-h-80 items-center justify-center bg-[#dfead2] text-stone-500">
            关于我们图片占位区域
          </div>

          <div className="flex flex-col justify-center p-8 md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Why We Started
            </p>

            <h2 className="mt-4 text-3xl font-bold leading-tight text-emerald-950">
              我们为什么开始
            </h2>

            <p className="mt-6 leading-8 text-stone-700">
              这里之后填写 ORP 的成立背景。可以写你们最初观察到的阅读需求、
              线上陪伴的可能性，以及为什么这个项目值得长期做下去。
            </p>

            <p className="mt-4 leading-8 text-stone-700">
              这一部分不用写得很长，重点是让访客感受到 ORP 不是突然出现的活动，
              而是从真实需求和真实关系中慢慢发展出来的项目。
            </p>
          </div>
        </div>
      </section>

      {/* 关于我们第三部分：深色色块，承载核心理念 */}
      <section className="bg-[#2f5d50] text-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#8fb8a3]">
            What We Believe
          </p>

          <h2 className="mt-5 text-3xl font-bold leading-tight md:text-5xl">
            我们相信，阅读陪伴不是一次性的善意
          </h2>

          <p className="mt-7 text-lg leading-9 text-emerald-50">
            这里之后可以写一句 ORP 的核心理念：阅读陪伴需要持续发生，
            也需要被认真记录、理解和改进。每一次课程都不只是一次线上见面，
            而是学生、小老师和项目共同成长的一部分。
          </p>
        </div>
      </section>

      {/* 关于我们第四部分：三个关键词，轻量表达，不重复首页 features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Our Approach
            </p>

            <h2 className="mt-5 text-3xl font-bold leading-tight text-emerald-950 md:text-5xl">
              ORP 如何理解陪伴
            </h2>
          </div>

          <div>
            <p className="leading-8 text-stone-700">
              这里之后可以用一小段话说明 ORP 的工作方式。不要写得太像功能介绍，
              而是解释这个项目如何看待学生、小老师、课程记录和长期成长之间的关系。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {principles.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-emerald-200 bg-white/70 px-5 py-2 text-sm font-semibold text-emerald-800"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-10 space-y-8 border-t border-emerald-200 pt-8">
              <section>
                <h3 className="text-2xl font-bold text-emerald-950">
                  对学生
                </h3>

                <p className="mt-3 leading-8 text-stone-700">
                  这里之后填写 ORP 希望给学生带来的支持，例如阅读兴趣、表达机会、
                  稳定陪伴和更持续的学习体验。
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-bold text-emerald-950">
                  对小老师
                </h3>

                <p className="mt-3 leading-8 text-stone-700">
                  这里之后填写小老师在 ORP 中的成长，例如备课、沟通、反思、
                  责任感和对教育问题的理解。
                </p>
              </section>

              <section>
                <h3 className="text-2xl font-bold text-emerald-950">
                  对项目
                </h3>

                <p className="mt-3 leading-8 text-stone-700">
                  这里之后填写为什么 ORP 需要课程记录、反馈和网站系统：
                  让项目不只依靠热情，也能依靠清晰的流程持续运行。
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>

      {/* 关于我们第五部分：结尾引导，保持简单 */}
      <section className="bg-[#f6f5e9]">
        <div className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-[2rem] bg-emerald-950 px-8 py-10 text-white md:flex md:items-center md:justify-between md:px-12">
            <div>
              <h2 className="text-3xl font-bold">
                想继续了解 ORP？
              </h2>

              <p className="mt-3 leading-7 text-emerald-50">
                可以查看部门介绍、项目故事，或者了解如何加入我们。
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 md:mt-0">
              <Link
                href="/departments"
                className="rounded-full bg-amber-200 px-6 py-3 font-semibold text-emerald-950 shadow-sm hover:bg-amber-100"
              >
                部门介绍
              </Link>

              <Link
                href="/stories"
                className="rounded-full border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10"
              >
                ORP 故事
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}