"use client";

// 스노우볼 만들기(create)와 내 홈으로 들어가기(login) 폼입니다.
// 동작만 하는 최소 형태입니다. 모양은 DESIGN.md 에 맞춰 자유롭게 바꾸세요.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { NICKNAME_RULE, createGlobe, openFailureMessage, openGlobe } from "@/lib/api";
import { globePath, saveOwnerToken } from "@/lib/owner-token";

const inputClass =
  "h-12 w-full rounded-full border border-white/15 bg-white/10 px-5 text-base text-white placeholder:text-slate-400 focus:outline-2 focus:outline-offset-2 focus:outline-white";

export default function EntryForm({ mode }: { mode: "create" | "login" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [nickname, setNickname] = useState(params.get("nickname") ?? "");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isCreate = mode === "create";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const name = nickname.trim();
    if (!name) return setError("닉네임을 적어 주세요.");
    if (password.length < 4) return setError("비밀번호는 4자 이상으로 적어 주세요.");

    setBusy(true);
    setError("");
    if (isCreate) {
      const result = await createGlobe(name, password, title);
      if (!result.ok) {
        setBusy(false);
        return setError(result.message);
      }
      saveOwnerToken(result.data.nickname, result.data.owner_token);
      return router.push(globePath(result.data.nickname));
    }

    const result = await openGlobe(name, password);
    if (!result.ok) {
      setBusy(false);
      return setError(result.message);
    }
    if (!result.data.ok) {
      setBusy(false);
      return setError(openFailureMessage(result.data));
    }
    saveOwnerToken(name, result.data.owner_token);
    router.push(globePath(name));
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-10 text-white">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4" noValidate>
        <h1 className="text-2xl font-bold">{isCreate ? "내 스노우볼 만들기" : "내 홈으로 들어가기"}</h1>
        <p className="text-sm text-slate-300">
          {isCreate
            ? "닉네임이 친구에게 보내는 링크가 돼요. 비밀번호는 다른 기기에서 내 홈에 들어올 때 써요."
            : "스노우볼을 만들 때 정한 닉네임과 비밀번호를 적어 주세요."}
        </p>

        <label className="block space-y-1">
          <span className="text-sm text-slate-300">닉네임</span>
          <input
            className={inputClass}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            autoComplete="username"
            autoCapitalize="none"
            placeholder={isCreate ? NICKNAME_RULE : "닉네임"}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-slate-300">비밀번호</span>
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={24}
            autoComplete={isCreate ? "new-password" : "current-password"}
            placeholder="4자 이상"
          />
        </label>

        {isCreate && (
          <>
            <label className="block space-y-1">
              <span className="text-sm text-slate-300">스노우볼 이름 (비워도 돼요)</span>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={30}
                placeholder="비우면 닉네임이 이름이 돼요"
              />
            </label>
            <p className="text-xs text-slate-400">
              비밀번호를 잊으면 다시 찾을 수 없어요. 꼭 기억할 수 있는 것으로 정해 주세요.
            </p>
          </>
        )}

        <p className="min-h-5 text-sm text-red-300" role="alert">
          {error}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-full bg-white font-semibold text-slate-900 disabled:opacity-40"
        >
          {busy ? "잠시만요" : isCreate ? "만들기" : "들어가기"}
        </button>

        <p className="text-center text-sm text-slate-300">
          {isCreate ? (
            <Link href="/login" className="underline">
              이미 스노우볼이 있어요
            </Link>
          ) : (
            <Link href="/new" className="underline">
              아직 스노우볼이 없어요
            </Link>
          )}
        </p>
      </form>
    </main>
  );
}
