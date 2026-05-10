import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "outline" | "primary" | "soft";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        variant === "primary" && "pilot-primary-button",
        variant === "outline" && "pilot-outline-button",
        variant === "soft" && "pilot-soft-button",
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";

export function ButtonLoadingContent({
  icon,
  idleLabel,
  isLoading,
  loadingLabel,
}: {
  icon?: React.ReactNode;
  idleLabel: string;
  isLoading: boolean;
  loadingLabel: string;
}) {
  return (
    <>
      {!isLoading ? icon ?? null : null}
      <span>{isLoading ? loadingLabel : idleLabel}</span>
    </>
  );
}
