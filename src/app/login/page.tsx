"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Swords, Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const syncPassword = () => {
    const realValue = passwordRef.current?.value ?? "";
    setPassword(realValue);
    setError("");
  };

  const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e && "preventDefault" in e) e.preventDefault();
    const realUsername = usernameRef.current?.value ?? username;
    const realPassword = passwordRef.current?.value ?? password;
    if (!realUsername.trim() || !realPassword.trim()) return;

    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: realUsername.trim(), password: realPassword }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "操作失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (e.currentTarget === usernameRef.current) {
        // 用户名回车 → 跳到密码框
        e.preventDefault();
        passwordRef.current?.focus();
      } else {
        syncPassword();
        handleSubmit();
      }
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 4, repeat: Infinity }} />
        <motion.div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-secondary/5 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 5, repeat: Infinity }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Infinity }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 mb-4">
            <Swords className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-black text-foreground">LevelUp Life</h1>
          <p className="text-sm text-muted-foreground mt-1">将人生，玩成 RPG</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={usernameRef}
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-4 py-3 bg-card border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              autoFocus autoComplete="username"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={passwordRef}
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onInput={syncPassword}
              onKeyDown={handleKeyDown}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="w-full pl-10 pr-4 py-3 bg-card border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            />
          </div>

          {error && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="text-sm text-destructive text-center">{error}</motion.p>
          )}

          <Button type="submit" disabled={loading || !username.trim() || !password.trim()}
            className="w-full py-3 font-bold text-base gap-2">
            {loading ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block">⚔️</motion.span>
            ) : (
              <>{mode === "register" ? "创建账户" : "开始冒险"}<ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          {mode === "login" ? "还没有账户？" : "已有账户？"}
          <button onClick={toggleMode} className="text-primary hover:underline ml-1">
            {mode === "login" ? "注册" : "登录"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
