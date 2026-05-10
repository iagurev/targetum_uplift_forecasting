"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-provider";
import { Logo } from "@/components/app/logo";
import { Button, ButtonLoadingContent } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { saveAuth } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [login, setLogin] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const isRegister = mode === "register";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = isRegister
        ? await api.register({ full_name: fullName, login, password })
        : await api.login({ login, password });
      saveAuth(payload);
      toast.success(isRegister ? "Аккаунт создан" : "Вход выполнен");
      router.replace("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка авторизации");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <Logo />
          <h1 className="auth-title">
            {isRegister ? "Создание аккаунта" : "Авторизация"}
          </h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister ? (
            <label className="pilot-field">
              <span className="pilot-field-label">Имя</span>
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Иван Петров"
                required
              />
            </label>
          ) : null}

          <label className="pilot-field">
            <span className="pilot-field-label">Логин</span>
            <Input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="agent.admin"
              required
            />
          </label>

          <label className="pilot-field">
            <span className="pilot-field-label">Пароль</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Минимум 8 символов"
              required
            />
          </label>

          <Button disabled={isSubmitting} type="submit">
            <ButtonLoadingContent
              idleLabel={isRegister ? "Создать аккаунт" : "Войти"}
              isLoading={isSubmitting}
              loadingLabel={isRegister ? "Создаём аккаунт..." : "Входим..."}
            />
          </Button>
        </form>

        <p className="auth-switch">
          {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}{" "}
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Войти" : "Зарегистрироваться"}
          </Link>
        </p>
      </div>
    </div>
  );
}
