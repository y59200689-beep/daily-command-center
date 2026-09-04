import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  emphasis?: "solid" | "outline" | "ghost" | "danger";
  intent?: "brand" | "neutral" | "success" | "warning" | "danger";
};

export function Button({ className, emphasis = "solid", intent = "neutral", type = "button", onClick, ...props }: ButtonProps) {
  return <button type={type} onClick={onClick} className={cn("button", `button--${emphasis}`, `button--${intent}`, className)} {...props} />;
}
