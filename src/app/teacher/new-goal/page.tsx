"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const DEMO_TEACHER_ID = "6cd37c11-61dc-4150-bb24-911ba3a6eebd";

const classInfo = {
  id: "887614b6-f449-4757-8b5b-7dfca9a16d7b",
  name: "秋叶班",
};

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export default function NewGoalPage() {
  const router = useRouter();
  const today = getTodayDate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const startDate = String(formData.get("start_date") || "").trim();
    const expectedLessonsValue = String(formData.get("expected_lessons") || "").trim();
    const expectedLessons = expectedLessonsValue ? Number(expectedLessonsValue) : null;

    if (!title) {
      setMessage("请填写目标标题。");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("teaching_goals").insert({
      teacher_id: DEMO_TEACHER_ID,
      class_id: classInfo.id,
      title,
      description: description || null,
      start_date: startDate || null,
      expected_lessons: expectedLessons,
      status: "active",
    });

    if (error) {
      setMessage(`保存目标失败：${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setMessage("目标保存成功，正在返回小老师主页...");
    setIsSubmitting(false);

    router.push("/teacher");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-6 py-10 text-stone-800">
      <section className="mx-auto max-w-3xl">
        <Link
          href="/teacher"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          ← 返回小老师主页
        </Link>

        <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">

          <h1 className="mt-3 text-4xl font-bold text-emerald-950">
            设置阶段教学目标
          </h1>

          <p className="mt-4 leading-8 text-stone-600">
            为当前班级设定一个阶段性教学目标。目标不需要提前固定结束日期，后续可以根据实际授课进度手动标记完成。
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            <div>
              <label className="text-sm font-semibold text-stone-700">
                所属班级
              </label>
              <input
                value={classInfo.name}
                readOnly
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-stone-100 px-4 py-3 text-stone-500 outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-700">
                目标标题 <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                placeholder="例如：小王子五周阅读计划"
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-700">
                目标说明
              </label>
              <textarea
                name="description"
                rows={5}
                placeholder="例如：带领学生完成《小王子》前五章阅读，重点训练情节理解、词汇积累和表达能力。"
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-stone-700">
                  开始日期
                </label>
                <input
                  type="date"
                  name="start_date"
                  defaultValue={today}
                  className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-stone-700">
                    预计课时
                </label>
                <input
                    type="number"
                    name="expected_lessons"
                    min="1"
                    placeholder="例如：5"
                    className="mt-2 w-full rounded-xl border border-emerald-100 bg-[#f6f5e9] px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {message && (
              <p className="rounded-xl bg-[#f6f5e9] px-4 py-3 text-sm font-semibold text-emerald-800">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[#2f5d50] px-6 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "保存中..." : "保存目标"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}