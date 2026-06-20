import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="bg-[#f6f5e9] text-stone-800">
      {/* 关于我们页面：文章式介绍页面，后续替换具体文字和图片 */}
      <article className="mx-auto max-w-3xl px-6 py-20 md:py-28">
        {/* 页面开头 */}
        <header className="text-center">

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-emerald-950 md:text-6xl">
            关于我们
          </h1>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
            About ORP
          </p>
          <p className="mt-6 text-lg leading-8 text-stone-700 md:text-xl">
            这里之后填写一句简洁的介绍：ORP 是谁，我们为什么开始，以及我们希望通过阅读陪伴带来什么改变。
          </p>
        </header>

        {/* 图片占位：之后可以换成河北学生、线上课堂或 ORP 活动照片 */}
        <div className="mt-14 overflow-hidden rounded-[2rem] border border-emerald-100 bg-white/70 p-3 shadow-sm">
          <div className="flex h-72 items-center justify-center rounded-[1.5rem] border border-dashed border-emerald-300 bg-[#edf3df] text-stone-500">
            图片占位区域
          </div>
        </div>

        {/* 正文内容 */}
        <section className="mt-16 space-y-14">
          <section>
            <h2 className="text-2xl font-bold text-emerald-950">
              ORP 是什么
            </h2>

            <p className="mt-5 leading-8 text-stone-700">
              这里之后填写 ORP 的基本介绍。可以说明 ORP 的全称、服务对象、主要形式，
              以及它和普通一次性志愿活动不同的地方。
            </p>

            <p className="mt-4 leading-8 text-stone-700">
              这里可以继续补充一段，说明 ORP 如何通过线上阅读课程连接小老师和河北学生。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-950">
              我们为什么开始
            </h2>

            <p className="mt-5 leading-8 text-stone-700">
              这里之后填写 ORP 的成立背景。可以写你们观察到的真实需求、
              项目最初的契机，以及为什么选择从阅读陪伴开始。
            </p>

            <p className="mt-4 leading-8 text-stone-700">
              这一段可以写得更有故事感，不一定要像项目介绍书一样正式。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-950">
              我们相信什么
            </h2>

            <p className="mt-5 leading-8 text-stone-700">
              这里之后填写 ORP 的核心理念，比如持续陪伴、双向成长、尊重学生差异、
              让阅读成为一种可以被长期接触和享受的事情。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-emerald-950">
              我们未来的方向
            </h2>

            <p className="mt-5 leading-8 text-stone-700">
              这里之后填写 ORP 的未来方向。可以提到课程体系、授课记录、学生反馈、
              数据化管理，以及这个网站为什么会被建立。
            </p>
          </section>
        </section>

        {/* 结尾引导 */}
        <footer className="mt-20 border-t border-emerald-100 pt-10">
          <p className="text-lg font-semibold text-emerald-950">
            想继续了解 ORP？
          </p>

          <p className="mt-3 leading-7 text-stone-700">
            你可以继续查看我们的部门介绍、参与者故事，或者了解如何加入我们。
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/departments"
              className="rounded-full border border-emerald-200 bg-white/70 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              部门介绍
            </Link>

            <Link
              href="/stories"
              className="rounded-full border border-emerald-200 bg-white/70 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              我和 ORP 的故事
            </Link>

            <Link
              href="/join"
              className="rounded-full border border-emerald-200 bg-white/70 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              加入我们
            </Link>
          </div>
        </footer>
      </article>
    </main>
  );
}