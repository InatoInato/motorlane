"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { carRequest, setAuthToken } from "./cars";

export type Account = { id: number; username: string };

export function AuthDialog({ onClose, onSignedIn }: {
  onClose: () => void;
  onSignedIn: (account: Account) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(true);
  const [register, setRegister] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    active.current = true;
    const previous = document.activeElement;
    const modal = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Native modal dialogs contain focus and make the page behind them inert.
    modal?.showModal();
    return () => {
      active.current = false;
      modal?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const body = JSON.stringify({ username: data.get("username"), password: data.get("password") });
    try {
      if (register) {
        await carRequest("/auth/register", { method: "POST", body });
        if (!active.current) return;
        setRegister(false);
        setNotice("Account created. Signing you in…");
      }
      const result = await carRequest("/auth/login", { method: "POST", body });
      if (!active.current) return;
      if (!result || typeof result !== "object" || !("token" in result) || typeof result.token !== "string" || !("id" in result) || !Number.isSafeInteger(result.id) || !("username" in result) || typeof result.username !== "string") throw new Error("We couldn't read your sign-in response. Please try again.");
      // Preserve the existing in-memory session; no browser storage is added.
      setAuthToken(result.token);
      onSignedIn({ id: result.id as number, username: result.username });
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return <dialog ref={dialog} className="listing-dialog auth-dialog" aria-labelledby="auth-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-topline">
      <span className="eyebrow">YOUR MOTORLANE ACCOUNT</span>
      <button className="icon-button" type="button" onClick={onClose} aria-label="Close authentication">×</button>
    </div>
    <h2 id="auth-title">{register ? "Create account" : "Sign in"}</h2>
    <p className="dialog-intro">{register ? "Create an account to list and manage your cars." : "Welcome back. Sign in to manage your listings."}</p>
    <form className="auth-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}>
        <label htmlFor="auth-username">Username</label>
        <input id="auth-username" name="username" required pattern="[a-zA-Z0-9_]{3,80}" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby={register ? "username-requirements" : undefined} />
        {register && <p id="username-requirements" className="auth-hint">3–80 letters, numbers or underscores.</p>}
        <label htmlFor="auth-password">Password</label>
        <div className="password-field">
          <input id="auth-password" name="password" type={visible ? "text" : "password"} required minLength={8} maxLength={128} autoComplete={register ? "new-password" : "current-password"} aria-describedby={register ? "password-requirements" : undefined} />
          <button type="button" className="text-button" aria-controls="auth-password" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "Hide password" : "Show password"}</button>
        </div>
        {register && <p id="password-requirements" className="auth-hint">8–128 characters.</p>}
      </fieldset>
      {notice && <p role="status" className="auth-hint">{notice}</p>}
      {error && <p role="alert" className="auth-error">{error}</p>}
      <button className="button primary" disabled={busy}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
      <p className="auth-switch">{register ? "Already have an account?" : "New to Motorlane?"} <button className="text-button" type="button" disabled={busy} onClick={() => { setRegister(!register); setError(""); setNotice(""); setVisible(false); }}>{register ? "Sign in" : "Create account"}</button></p>
    </form>
  </dialog>;
}

export function AccountControl({ account, onSignedOut }: { account: Account; onSignedOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await carRequest("/auth/logout", { method: "POST" });
      setAuthToken(null);
      onSignedOut();
    } catch { setError("Sign out failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <details className="account-control">
    <summary aria-label={`Account: ${account.username}`}>Account</summary>
    <div className="account-panel">
      <p>Signed in as <strong>{account.username}</strong></p>
      <button className="text-button" disabled={busy} onClick={logout}>{busy ? "Signing out…" : "Sign out"}</button>
      {error && <p role="alert" className="auth-error">{error}</p>}
    </div>
  </details>;
}
