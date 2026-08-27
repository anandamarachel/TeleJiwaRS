"use client";

import { useState } from "react";

const EMOJIS = ["😀", "😊", "🙂", "😌", "😔", "😢", "😟", "🙏", "👍", "❤️", "🌿", "✨"];

export function ChatEmojiPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-3 grid w-52 grid-cols-6 gap-1 rounded-xl border border-sage-200 bg-white p-2 shadow-xl">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-sage-100"
              aria-label={`Tambahkan emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-sage-200 text-lg hover:border-jade-500 disabled:opacity-40"
        aria-label="Pilih emoji"
        aria-expanded={open}
      >
        😊
      </button>
    </div>
  );
}
