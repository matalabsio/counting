"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export function AdminLogin() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Unable to sign in. Try again.");
        setPending(false);
        return;
      }
      window.location.replace("/admin");
    } catch {
      setError("Unable to connect. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="counting-day counting-admin" data-theme="light">
      <div className="admin-frame">
        <header className="admin-top">
          <div className="admin-brand">
            <span className="admin-mark" aria-hidden>CD</span>
            <h1>Counting Day · Admin</h1>
          </div>
          <Link className="btn admin-link" href="/">Public board</Link>
        </header>
        <main className="admin-sheet">
          <section className="admin-gate" aria-labelledby="login-title">
            <h2 id="login-title">Sign in to admin</h2>
            <p className="hint">Enter your username and password to manage counting.</p>
            <form onSubmit={login} aria-busy={pending}>
              <div className="field">
                <label htmlFor="admin-username">Username</label>
                <input className="inp" id="admin-username" name="username" autoComplete="username"
                  autoCapitalize="none" spellCheck={false} required maxLength={128} />
              </div>
              <div className="field">
                <label htmlFor="admin-password">Password</label>
                <input className="inp" id="admin-password" name="password" type="password"
                  autoComplete="current-password" required maxLength={256}
                  aria-describedby={error ? "login-error" : undefined} />
              </div>
              {error ? <p id="login-error" className="notice err" role="alert">{error}</p> : null}
              <button className="btn primary" type="submit" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}
