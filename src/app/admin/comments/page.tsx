"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminGuard from "@/components/AdminGuard";

/**
 * admin/messages 留言中心页面原则：
 * 1. 本页面只用于集中查看学生留言和家长/老师留言。
 * 2. MVP 阶段不真正发布留言到首页或“我和 ORP 的故事”页面。
 * 3. 页面预留“发布准备区”，用于以后把有代表性的学生/家长/老师感想整理成公开展示内容。
 * 4. 真正上线发布功能前，必须增加授权、脱敏、审核状态和发布记录表。
 */

type MessageSource = "student" | "parent";

type UnifiedMessage = {
  id: string;
  source: MessageSource;
  authorName: string;
  studentId: string | null;
  studentName: string | null;
  lessonRecordId: string | null;
  content: string;
  createdAt: string;
};

type StudentLessonCommentRow = {
  id: string;
  lesson_record_id: string;
  student_id: string | null;
  student_name: string | null;
  comment: string;
  created_at: string;
};

type ParentMessageRow = {
  id: string;
  student_id: string | null;
  student_name: string | null;
  parent_name: string | null;
  message: string;
  created_at: string;
};

function getSourceLabel(source: MessageSource) {
  if (source === "student") return "学生留言";
  return "家长/老师留言";
}

function getSourceClassName(source: MessageSource) {
  if (source === "student") return "bg-emerald-50 text-emerald-700";
  return "bg-amber-50 text-amber-700";
}

function formatDate(dateString: string) {
  return dateString?.slice(0, 10) || "暂无日期";
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export default function AdminMessagesPage() {
  return (
    <AdminGuard>
      <AdminMessagesContent />
    </AdminGuard>
  );
}

function AdminMessagesContent() {
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [selectedSource, setSelectedSource] = useState<"all" | MessageSource>(
    "all"
  );
  const [keyword, setKeyword] = useState("");
  const [selectedMessage, setSelectedMessage] =
    useState<UnifiedMessage | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function fetchMessages() {
    setIsLoading(true);
    setMessage("");

    try {
      const { data: studentCommentData, error: studentCommentError } =
        await supabase
          .from("student_lesson_comments")
          .select(
            "id, lesson_record_id, student_id, student_name, comment, created_at"
          )
          .order("created_at", { ascending: false });

      if (studentCommentError) {
        throw new Error(`读取学生留言失败：${studentCommentError.message}`);
      }

      const { data: parentMessageData, error: parentMessageError } =
        await supabase
          .from("parent_messages")
          .select("id, student_id, student_name, parent_name, message, created_at")
          .order("created_at", { ascending: false });

      if (parentMessageError) {
        throw new Error(`读取家长/老师留言失败：${parentMessageError.message}`);
      }

      const studentMessages: UnifiedMessage[] = (
        (studentCommentData || []) as StudentLessonCommentRow[]
      ).map((item) => ({
        id: item.id,
        source: "student",
        authorName: item.student_name || "学生",
        studentId: item.student_id,
        studentName: item.student_name,
        lessonRecordId: item.lesson_record_id,
        content: item.comment,
        createdAt: item.created_at,
      }));

      const parentMessages: UnifiedMessage[] = (
        (parentMessageData || []) as ParentMessageRow[]
      ).map((item) => ({
        id: item.id,
        source: "parent",
        authorName: item.parent_name || item.student_name || "未署名",
        studentId: item.student_id,
        studentName: item.student_name,
        lessonRecordId: null,
        content: item.message,
        createdAt: item.created_at,
      }));

      const allMessages = [...studentMessages, ...parentMessages].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setMessages(allMessages);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取留言失败。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchMessages();
  }, []);

  const filteredMessages = useMemo(() => {
    const searchText = keyword.trim().toLowerCase();

    let result = messages;

    if (selectedSource !== "all") {
      result = result.filter((item) => item.source === selectedSource);
    }

    if (searchText) {
      result = result.filter((item) => {
        const searchableText = [
          getSourceLabel(item.source),
          item.authorName,
          item.studentName || "",
          item.content,
          formatDate(item.createdAt),
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchText);
      });
    }

    return result;
  }, [messages, selectedSource, keyword]);

  const studentMessageCount = useMemo(() => {
    return messages.filter((item) => item.source === "student").length;
  }, [messages]);

  const parentMessageCount = useMemo(() => {
    return messages.filter((item) => item.source === "parent").length;
  }, [messages]);

  const totalMessageCount = messages.length;

  const publishPreviewTitle = selectedMessage
    ? selectedMessage.source === "student"
      ? `${selectedMessage.authorName}的学习反馈`
      : `${selectedMessage.authorName}的 ORP 感想`
    : "";

  const publishPreviewSummary = selectedMessage
    ? truncateText(selectedMessage.content, 120)
    : "";

  return (
    <main className="min-h-screen bg-[#f6f5e9] px-5 py-8 text-stone-800">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-[#2f5d50]">
              Admin / 留言中心
            </p>

            <h1 className="mt-2 text-3xl font-bold text-emerald-950">
              留言中心
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              返回管理员首页
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">全部留言</p>

            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {totalMessageCount}
            </p>

            <p className="mt-1 text-xs text-stone-500">学生 + 家长/老师</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">学生留言</p>

            <p className="mt-2 text-3xl font-bold text-emerald-950">
              {studentMessageCount}
            </p>

            <p className="mt-1 text-xs text-stone-500">来自课程反馈</p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">家长/老师留言</p>

            <p className="mt-2 text-3xl font-bold text-amber-700">
              {parentMessageCount}
            </p>

            <p className="mt-1 text-xs text-stone-500">来自留言表</p>
          </div>

          <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-500">发布准备</p>

            <p className="mt-2 text-3xl font-bold text-stone-700">
              {selectedMessage ? 1 : 0}
            </p>

            <p className="mt-1 text-xs text-stone-500">当前选中的故事素材</p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <h2 className="text-xl font-bold text-emerald-950">
                  留言列表
                </h2>

                <p className="mt-2 text-sm leading-7 text-stone-600">
                  可以按来源和关键词筛选留言。看到适合公开展示的内容，可以先放入右侧发布准备区。
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-[180px_260px]">
                <select
                  value={selectedSource}
                  onChange={(event) =>
                    setSelectedSource(event.target.value as "all" | MessageSource)
                  }
                  className="rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="all">全部留言</option>
                  <option value="student">学生留言</option>
                  <option value="parent">家长/老师留言</option>
                </select>

                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索姓名、内容、日期..."
                  className="rounded-full border border-emerald-100 bg-[#fffdf4] px-4 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {isLoading ? (
              <p className="mt-6 rounded-2xl bg-[#fffdf4] p-5 text-sm text-stone-600">
                正在读取留言...
              </p>
            ) : filteredMessages.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-[#fffdf4] p-5 text-sm text-stone-600">
                暂时没有找到符合条件的留言。
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {filteredMessages.map((item) => {
                  const isSelected =
                    selectedMessage?.id === item.id &&
                    selectedMessage?.source === item.source;

                  return (
                    <article
                      key={`${item.source}-${item.id}`}
                      className={`rounded-2xl border p-4 transition ${
                        isSelected
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-emerald-100 bg-[#fffdf4]"
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getSourceClassName(
                                item.source
                              )}`}
                            >
                              {getSourceLabel(item.source)}
                            </span>

                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>

                          <h3 className="mt-3 font-bold text-emerald-950">
                            {item.authorName}
                          </h3>

                          <p className="mt-1 text-xs text-stone-500">
                            关联学生：
                            {item.studentName || item.authorName || "暂无"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedMessage(item)}
                          className="w-fit rounded-full border border-emerald-700 px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                        >
                          放入发布准备区
                        </button>
                      </div>

                      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-stone-700">
                        {item.content}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.studentId && (
                          <Link
                            href={`/admin/students/${item.studentId}`}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                          >
                            查看学生详情
                          </Link>
                        )}

                        {item.lessonRecordId && (
                          <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-500">
                            已关联课程反馈
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold text-emerald-950">
              发布准备区
            </h2>

            <p className="mt-2 text-sm leading-7 text-stone-600">
              这里是未来功能预留：以后可以把学生、家长或老师的感想整理后发布到首页或“我和 ORP 的故事”页面。
            </p>

            {!selectedMessage ? (
              <div className="mt-5 rounded-2xl bg-[#fffdf4] p-5 text-sm leading-7 text-stone-600">
                暂未选择留言。请在左侧列表中选择一条适合公开展示的留言。
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
                  <p className="text-xs font-semibold text-stone-500">
                    预览标题
                  </p>

                  <h3 className="mt-2 font-bold text-emerald-950">
                    {publishPreviewTitle}
                  </h3>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-[#fffdf4] p-4">
                  <p className="text-xs font-semibold text-stone-500">
                    预览摘要
                  </p>

                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-stone-700">
                    {publishPreviewSummary}
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-6 text-amber-800">
                  <p className="font-bold">MVP 提醒</p>

                  <p className="mt-1">
                    这个按钮目前只做界面预留，不会真的发布。正式上线前需要确认授权、去除敏感信息，并新增审核/发布记录表。
                  </p>
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-full bg-stone-200 px-4 py-2 text-sm font-semibold text-stone-500"
                  >
                    模拟发布到首页故事区
                  </button>

                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-full bg-stone-200 px-4 py-2 text-sm font-semibold text-stone-500"
                  >
                    模拟发布到“我和 ORP 的故事”
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                  >
                    清空准备区
                  </button>
                </div>
              </div>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}