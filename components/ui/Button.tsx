// 버튼 3종 (DESIGN.md 8장)
//  - primary: 레드 면 + 흰 글자. 한 화면에 하나
//  - secondary: 유리 면
//  - IconButton: 유리 원형 44px, 글자 없이 aria-label 필수

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icons";

type Variant = "primary" | "secondary";

const base =
  "inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-[15px] transition duration-200 ease-soft active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 sm:h-[52px] sm:px-7 sm:text-base";

const variants: Record<Variant, string> = {
  primary: "bg-accent font-bold text-on-accent shadow-[0_6px_20px_rgba(200,54,61,0.35)] hover:bg-accent-hover",
  secondary: "border border-glass-border bg-glass font-semibold text-ink hover:bg-glass-strong",
};

type Common = { variant?: Variant; icon?: IconName; children: ReactNode; className?: string };

export function Button({
  variant = "primary",
  icon,
  children,
  className = "",
  type = "button",
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", icon, children, className = "", href }: Common & { href: string }) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}

export function IconButton({
  icon,
  label,
  className = "",
  ...rest
}: { icon: IconName; label: string; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`glass inline-flex size-11 items-center justify-center rounded-full text-ink transition duration-200 ease-soft hover:bg-glass-strong active:scale-[0.97] ${className}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
