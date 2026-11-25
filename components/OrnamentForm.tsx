"use client";

// 친구가 오너먼트와 메시지를 다는 폼입니다. 동작만 하는 최소 형태입니다.

import { useState, type FormEvent } from "react";
import { MESSAGE_MAX, SENDER_MAX, addOrnament } from "@/lib/api";

export const ORNAMENT_COLORS = ["#e5484d", "#f5a524", "#30a46c", "#3e63dd", "#d6409f"];

const fieldClass =
  "w-full border border-white/15 bg-white/10 px-5 text-base text-white placeholder:text-slate-400 focus:outline-2 focus:outline-offset-2 focus:outline-white";

export default function OrnamentForm({ nickname, onAdded }: { nickname: string; onAdded: () => Promise<void> }) {
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [color, setColor] = useState(ORNAMENT_COLORS[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!sender.trim()) return setError("보내는 사람 이름을 적어 주세요.");
    if (!message.trim()) return setError("메시지를 적어 주세요.");

    setBusy(true);
    setError("");
    const result = await addOrnament(nickname, sender, message, color);
    if (!result.ok) {
      setBusy(false);
      return setError(result.message);
    }
    setMessage("");
    await onAdded();
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl border border-white/15 bg-white/10 p-5" noValidate>
      <h2 className="text-lg font-bold">오너먼트 달기</h2>

      <label className="block space-y-1">
        <span className="text-sm text-slate-300">보내는 사람</span>
        <input
          className={`${fieldClass} h-12 rounded-full`}
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          maxLength={SENDER_MAX}
          placeholder="이름이나 별명"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-slate-300">메시지 (스노우볼 주인만 읽어요)</span>
        <textarea
          className={`${fieldClass} min-h-24 resize-none rounded-3xl py-3`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX}
          placeholder="전하고 싶은 말을 적어 주세요"
        />
        <span className="block text-right text-xs text-slate-400">
          {message.length}/{MESSAGE_MAX}
        </span>
      </label>

      <fieldset>
        <legend className="mb-2 text-sm text-slate-300">오너먼트 색</legend>
        <div className="flex gap-3">
          {ORNAMENT_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`색 ${value}`}
              aria-pressed={color === value}
              onClick={() => setColor(value)}
              className={`h-11 w-11 rounded-full border-2 ${color === value ? "border-white" : "border-transparent"}`}
              style={{ backgroundColor: value }}
            />
          ))}
        </div>
      </fieldset>

      <p className="min-h-5 text-sm text-red-300" role="alert">
        {error}
      </p>

      <button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-full bg-white font-semibold text-slate-900 disabled:opacity-40"
      >
        {busy ? "다는 중이에요" : "달기"}
      </button>
    </form>
  );
}
