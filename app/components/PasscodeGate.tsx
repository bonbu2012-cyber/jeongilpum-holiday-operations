"use client";

import { useState } from "react";

export default function PasscodeGate() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/operator-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "암호를 확인하지 못했습니다.");
      location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "암호를 확인하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="passcode-gate">
    <form className="passcode-card" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <small>JEONGILPUM OPERATOR</small>
      <h1>운영 화면 암호</h1>
      <p>공용 운영 암호를 입력해주세요.</p>
      <label>
        <span>암호</span>
        <input type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} autoComplete="current-password" />
      </label>
      <p className="passcode-error" role="alert">{error}</p>
      <button disabled={submitting || !passcode}>{submitting ? "확인 중…" : "확인"}</button>
    </form>
  </main>;
}
