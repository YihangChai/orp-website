import Link from "next/link";

//成果展示（累计授课时长，服务学生和参加的小老师）
const stats = [
  {
    label: "累计授课时长",
    value: "约3925+",
    unit: "小时",
  },
  {
    label: "累计服务学生",
    value: "约640+",
    unit: "人",
  },
  {
    label: "累计参与小老师",
    value: "约320+",
    unit: "人",
  },
];

//首页的ORP基本模块化介绍，简洁明了
const features = [
  {
    title: "稳定的线上课堂",
    description:
      "志愿小老师每周开展英语与数学课程，根据学生的年级、基础和学习进度准备课堂内容。在知识讲解之外，我们也通过阅读、表达和互动讨论，让学生能够主动参与课堂，拓展知识。",
  },
  {
    title: "持续课程记录",
    description:
      "每次授课结束后，小老师会记录课程内容、学生表现、作业安排与下一步计划，让后续课堂建立在真实的学习进度之上，而不是每次重新开始。",
  },
  {
    title: "双向的成长反馈",
    description:
      "学生可以通过留言和反馈表达自己的感受，小老师也会在备课、授课与课后反思中持续调整教学。长期、稳定的互动，让课堂不仅传递知识，也建立理解、信任与陪伴。",
  },
];

export default function HomePage() {
  return (
    <main className="bg-[#f6f5e9] text-stone-800">
      {/*首页第一部分，ORP标题，一句话介绍以及进入按钮（需要设置登录后才显示并且对应不同角色）*/}
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-emerald-950">
      {/* 背景图：之后把河北学生合照放到 public/hebei-students.jpg */}

      <div className="absolute inset-0 bg-[url('/hebei-students.jpg')] bg-cover bg-center opacity-75" />

      {/* 深色遮罩：用黑色/深灰代替绿色，避免照片变浑浊 */}

      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/5" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center px-6 py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#8fb8a3]">
              Online Reading Partner
            </p>

            <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight text-white md:text-7xl">
              ORP伙伴阅读项目
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-emerald-50 md:text-xl">
              ORP（Online Reading Partner）是由学生自主运营的线上公益教育项目。我们联结校内志愿小老师与河北小学三至六年级学生，通过长期、稳定的数学与英语课堂，为孩子们提供知识学习、阅读交流与持续陪伴。课堂之外，我们也创作原创英文绘本、开展公益活动，让教育与创意跨越地域相遇。
            </p>
        </div>
        </div>
      </section>

      {/* 首页第二部分，成果展示 */}
      {/* <section className="bg-[#f6f5e9]"> */}
        {/* <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Our Impact
              </p>

              <h2 className="mt-4 text-3xl font-semibold leading-tight text-emerald-950 md:text-5xl">
                我们的影响
              </h2>
            </div>

            <p className="leading-8 text-stone-700">
              从2018年运营至今，我们已达成单学年47名志愿授课教师累计完成490.7小时公益教学，稳定服务超100名河北三至六年级学生，以长期稳定的公益实践，给不同地区的孩子带去多元的学习体验。
            </p>
          </div> */}

          {/* <div className="mt-12 grid gap-6 border-y border-emerald-200 py-10 md:grid-cols-3">
            {stats.map((item) => (
              <div key={item.label}>
                <p className="text-5xl font-bold text-emerald-800 md:text-6xl">
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
        </div>
      </section> */}

      {/* 首页第三部分，深色使命区：适量深色色块，不要过度 */}
      <section className="bg-[#2f5d50] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-200">
              Our Mission
            </p>

            <h2 className="mt-5 text-3xl font-bold leading-tight md:text-5xl">
              我们的Mission
            </h2>
          </div>

          <div className="space-y-5 text-lg leading-9 text-emerald-50">
            <p>
              我们的核心工作是线上教学与长期陪伴，开设英语、数学两类课程；团队自制温情英文绘本丰富课堂素材，把课内知识点融入生活化趣味话题，降低学习的枯燥感。我们跨越地域距离，完整记录每位学生的学习成长轨迹，以志愿热忱带来高质量、有新意的线上教学体验。
            </p>
          </div>
        </div>
      </section>

      {/* 首页第四部分，2分钟内能看完并理解的ORP介绍 */}
      <section className="bg-[#f6f5e9]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
                What We Do
              </p>

              <h2 className="mt-5 text-3xl font-bold leading-tight text-emerald-950 md:text-5xl">
                我们如何让陪伴持续发生
              </h2>

              <p className="mt-6 leading-8 text-stone-700">
                ORP 以长期、稳定的线上教学为核心，由校内志愿小老师为河北小学三至六年级学生开展英语与数学课程。我们通过备课、授课、课程记录与反馈复盘，让每一堂课都承接学生真实的学习进度，也让一次次线上相遇逐渐沉淀为持续的陪伴。
              </p>
            </div>

            <div className="space-y-8">
              {features.map((item, index) => (
                <div
                  key={item.title}
                  className="border-t border-emerald-200 pt-8"
                >
                  <p className="text-sm font-semibold text-emerald-700">
                    0{index + 1}
                  </p>

                  <h3 className="mt-2 text-2xl font-bold text-emerald-950">
                    {item.title}
                  </h3>

                  <p className="mt-3 leading-8 text-stone-700">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 首页第五部分，ORP故事预览
      <section className="bg-[#edf3df]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Stories
              </p>

              <h2 className="mt-4 text-3xl font-bold text-emerald-950 md:text-5xl">
                来自 ORP 的故事
              </h2>
            </div>

            <Link
              href="/stories"
              className="w-fit rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900"
            >
              查看更多故事
            </Link>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {stories.map((item) => (
              <article
                key={item.title}
                className="grid overflow-hidden rounded-[2rem] bg-white shadow-sm md:grid-cols-[0.9fr_1.1fr]"
              >
                <div className="flex min-h-60 items-center justify-center bg-[#dfead2] text-stone-500">
                  故事图片占位区域
                </div>

                <div className="p-7">
                  <h3 className="text-2xl font-bold text-emerald-950">
                    {item.title}
                  </h3>

                  <p className="mt-4 leading-7 text-stone-700">
                    {item.description}
                  </p>

                  <Link
                    href="/stories"
                    className="mt-6 inline-block text-sm font-semibold text-emerald-800 hover:text-emerald-950"
                  >
                    阅读故事 →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section> */}

      {/* 首页第六部分，了解更多 */}
      <section className="bg-[#f6f5e9]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-[2rem] bg-emerald-950 px-8 py-10 text-white md:flex md:items-center md:justify-between md:px-12">
            <div>
              <h2 className="text-3xl font-bold">
                想进一步了解 ORP？
              </h2>

              <p className="mt-3 leading-7 text-emerald-50">
                查看 ORP 的理念、项目故事和加入方式。
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 md:mt-0">
              <Link
                href="/about"
                className="rounded-full bg-[#cfe8d6] px-7 py-3 text-base font-semibold text-emerald-950 shadow-sm hover:bg-[#bfe0c8]"
              >
                关于我们
              </Link>

            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
