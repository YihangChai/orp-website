"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DeleteStudentCommentButtonProps = {
  commentId: string;
  studentId: string;
};

export default function DeleteStudentCommentButton({
  commentId,
  studentId,
}: DeleteStudentCommentButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm("确定要删除这条留言吗？删除后不能恢复。");

    if (!confirmed) return;

    setIsDeleting(true);

    const { error } = await supabase
      .from("student_lesson_comments")
      .delete()
      .eq("id", commentId)
      .eq("student_id", studentId);

    setIsDeleting(false);

    if (error) {
      alert(`删除失败：${error.message}`);
      return;
    }

    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      title="删除留言"
      aria-label="删除留言"
      className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-100 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isDeleting ? (
        <span className="text-[10px] font-semibold">...</span>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </svg>
      )}
    </button>
  );
}