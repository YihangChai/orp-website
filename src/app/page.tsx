import Link from "next/link";
//模拟登录后页面变化后续链接数据库后修改
const isLoggedIn = false;
const userRole: "teacher" | "student" | "admin" = "teacher";

function getDashboardPath(role: "teacher" | "student" | "admin") {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "student") {
    return "/student";
  }

  return "/teacher";
}
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
    title: "线上阅读陪伴",
    description:
      "这里之后填写 ORP 如何通过线上课程陪伴河北小学学生阅读、表达和讨论。",
  },
  {
    title: "持续课程记录",
    description:
      "这里之后填写小老师如何记录每次课程内容、学生表现和下一步教学计划。",
  },
  {
    title: "学生成长反馈",
    description:
      "这里之后填写 ORP 如何通过反馈和数据帮助课程持续改进。",
  },
];

const stories = [
  {
    title: "ORP 故事标题 1",
    description:
      "这里之后可以填写来自小老师、学生、家长或项目管理者的故事摘要。",
  },
  {
    title: "ORP 故事标题 2",
    description:
      "这里之后可以填写另一段项目故事摘要，让访客感受到 ORP 背后真实的人和经历。",
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

      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center px-6 py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#8fb8a3]">
              Online Reading Partner
            </p>

            <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight text-white md:text-7xl">
              一段大大的介绍
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-emerald-50 md:text-xl">
              ORP 是一个由学生主导的线上阅读陪伴项目。我们连接小老师与河北小学学生，
              通过持续课程、阅读讨论和成长记录，让每一次线上相遇都成为长期支持的一部分。
            </p>
{/* 
后续接入登录系统后：
未登录用户显示“了解 ORP”
已登录用户显示“进入系统”，并根据角色跳转到 /teacher、/student 或 /admin
*/}
          <div className="mt-10 flex flex-wrap gap-4">
            {isLoggedIn ? (
              <Link
                href={getDashboardPath(userRole)}
                className="rounded-full bg-amber-200 px-7 py-3 text-base font-semibold text-emerald-950 shadow-sm hover:bg-amber-100"
              >
                进入系统
              </Link>
            ) : (
              <Link
                href="/about"
                className="rounded-full bg-amber-200 px-7 py-3 text-base font-semibold text-emerald-950 shadow-sm hover:bg-amber-100"
              >
                了解 ORP
              </Link>
            )}
          </div>
        </div>
        </div>
      </section>

      {/* 首页第二部分，成果展示 */}
      <section className="bg-[#f6f5e9]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Our Impact
              </p>

              <h2 className="mt-4 text-3xl font-bold leading-tight text-emerald-950 md:text-5xl">
                一段我们的impact介绍
              </h2>
            </div>

            <p className="leading-8 text-stone-700">
              这里之后可以用一小段话说明这些数据的意义：它们不仅是数字，
              也代表小老师投入的时间、学生参与的过程，以及 ORP 持续运行的成果。
            </p>
          </div>

          <div className="mt-12 grid gap-6 border-y border-emerald-200 py-10 md:grid-cols-3">
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
      </section>

      {/* 首页第三部分，深色使命区：适量深色色块，不要过度 */}
      <section className="bg-[#2f5d50] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-200">
              Our Mission
            </p>

            <h2 className="mt-5 text-3xl font-bold leading-tight md:text-5xl">
              一段我们mission的介绍
            </h2>
          </div>

          <div className="space-y-5 text-lg leading-9 text-emerald-50">
            <p>
              这里之后可以填写 ORP 的核心使命：为什么阅读陪伴需要长期发生，
              为什么课程记录和学生反馈能让线上教学变得更稳定。
            </p>

            <p>
              这一块不需要写很多，但要写得真诚、有力量，让访客理解 ORP 不只是一个活动，
              而是一个持续改进的公益项目。
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
                一段what we do的介绍
              </h2>

              <p className="mt-6 leading-8 text-stone-700">
                这里之后可以用一小段话解释 ORP 的基本工作方式：
                小老师如何上课，学生如何参与，管理团队如何通过记录和反馈持续优化课程。
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

      {/* 首页第五部分，ORP故事预览 */}
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
      </section>

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
                className="rounded-full bg-amber-200 px-6 py-3 font-semibold text-emerald-950 shadow-sm hover:bg-amber-100"
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
//把our mission加到关于我们里面，这样首页干净一点
