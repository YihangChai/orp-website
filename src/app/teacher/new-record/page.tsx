import Link from "next/link";

const classInfo = {
  name: "秋叶班",
  teacher: "小老师姓名",
};

const students = [
  {
    id: "student-a",
    name: "学生 A",
  },
  {
    id: "student-b",
    name: "学生 B",
  },
  {
    id: "student-c",
    name: "学生 C",
  },
];

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export default function NewRecordPage() {
  const today = getTodayDate();

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link
            href="/teacher"
            className="text-sm font-semibold text-emerald-800 hover:text-emerald-950"
          >
            ← 返回小老师主页
          </Link>

          <h1 className="mt-3 text-4xl font-bold text-emerald-950">
            添加授课记录
          </h1>

          <p className="mt-4 leading-8 text-stone-600">
            请记录本节课的基本信息、出勤情况、课程内容和后续计划。
            学生反馈会在课程记录生成后由学生单独留言，不需要老师在这里填写。
          </p>
        </div>

        <section className="rounded-[2rem] border border-emerald-100 bg-white p-7 shadow-sm md:p-9">
          <form className="space-y-7">
            {/* 基本信息 */}
            <section>
              <h2 className="text-2xl font-bold text-emerald-950">
                基本信息
              </h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    所属班级
                  </label>

                  <input
                    type="text"
                    value={classInfo.name}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-stone-100 px-4 py-3 text-stone-600 outline-none"
                  />

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    班级根据当前小老师账号自动填写，后续不可在这里手动更改。
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    所属课程目标
                  </label>

                  <select className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500">
                    <option>小王子阅读计划</option>
                    <option>暂不绑定目标</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    上课日期
                  </label>

                  <input
                    type="date"
                    defaultValue={today}
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    默认是今天，也可以手动修改为实际上课日期。
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    授课时长（分钟）
                  </label>

                  <input
                    type="number"
                    placeholder="例如：40"
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-stone-700">
                    本节课主题
                  </label>

                  <input
                    type="text"
                    placeholder="例如：小王子第一章 / 自我介绍与阅读导入"
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </section>

            {/* 出勤 */}
            <section className="border-t border-emerald-100 pt-7">
              <h2 className="text-2xl font-bold text-emerald-950">
                学生出勤
              </h2>

              <p className="mt-3 leading-7 text-stone-600">
                点击下方区域后，会显示本班所有学生。到了的学生打勾，未到的学生不勾选。
              </p>

              <details className="mt-5 rounded-2xl border border-emerald-100 bg-[#fffdf4] p-5">
                <summary className="cursor-pointer select-none text-base font-semibold text-emerald-900">
                  选择出勤学生｜{classInfo.name}
                </summary>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {students.map((student) => (
                    <label
                      key={student.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-stone-700 hover:bg-emerald-50"
                    >
                      <input
                        type="checkbox"
                        name="attendance"
                        value={student.id}
                        className="h-4 w-4 accent-emerald-700"
                      />

                      <span className="font-medium">{student.name}</span>
                    </label>
                  ))}
                </div>
              </details>
            </section>

            {/* 课程内容 */}
            <section className="border-t border-emerald-100 pt-7">
              <h2 className="text-2xl font-bold text-emerald-950">
                课程内容与课后安排
              </h2>

              <div className="mt-5 space-y-5">
                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    本节课内容与课堂反馈
                  </label>

                  <textarea
                    rows={6}
                    placeholder="记录本节课讲了什么、学生整体理解情况、互动情况、哪里做得好、哪里需要继续练习。"
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-stone-700">
                      课后作业（选填）
                    </label>

                    <textarea
                      rows={3}
                      placeholder="例如：复习关键词，完成一段复述。"
                      className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-stone-700">
                      下节课计划（选填）
                    </label>

                    <textarea
                      rows={3}
                      placeholder="例如：继续阅读下一章，加入开放式问题。"
                      className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-700">
                    视频 / 材料链接（选填）
                  </label>

                  <input
                    type="url"
                    placeholder="https://..."
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </section>

            {/* 私密反思 */}
            <section className="border-t border-emerald-100 pt-7">
              <div className="rounded-2xl border border-emerald-100 bg-[#edf3df] p-5">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-emerald-950">
                      小老师反思（私密）
                    </h2>

                    <p className="mt-2 leading-7 text-stone-600">
                      这部分只对小老师本人和管理员可见，不会显示给学生。
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-800">
                    私密
                  </span>
                </div>

                <textarea
                  rows={4}
                  placeholder="例如：这节课哪里顺利？哪里需要调整？下次如何改进？有没有需要管理员或课程部帮助的地方？"
                  className="mt-5 w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 leading-7 outline-none focus:border-emerald-500"
                />
              </div>
            </section>

            {/* 保存 */}
            <div className="flex flex-col gap-3 border-t border-emerald-100 pt-6 md:flex-row md:items-center md:justify-between">
              <p className="text-sm leading-6 text-stone-500">
                当前版本只显示表单，不会真正提交。下一步会连接 Supabase 保存记录。
              </p>

              <button
                type="button"
                className="rounded-full bg-[#cfe8d6] px-7 py-3 font-semibold text-emerald-950 shadow-sm hover:bg-[#bfe0c8]"
              >
                保存记录
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}