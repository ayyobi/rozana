import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  // Texte chocolat sur corail : 5,0:1 (AA)
  primary: 'bg-coral text-ink hover:bg-[#cf9670] active:bg-[#c58a63] shadow-soft',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-ink hover:bg-ink/5',
  danger: 'bg-danger text-white hover:bg-[#8f322e]',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-[0.95rem] gap-2',
  lg: 'h-13 px-6 text-base gap-2',
  icon: 'h-11 w-11 justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra?: string): string {
  return cn(
    'inline-flex items-center justify-center rounded-pill font-medium select-none',
    'transition-[background-color,transform,box-shadow] duration-200 ease-soft',
    'active:scale-[0.98] disabled:opacity-55 disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
