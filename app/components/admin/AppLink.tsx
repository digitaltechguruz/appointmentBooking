import type { ReactNode, MouseEvent } from "react";
import { useAppHref, useAppNavigate } from "../../lib/useAppHref";

type Props = {
  to: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
};

export function AppLink({ to, children, onClick, className }: Props) {
  const href = useAppHref(to);
  const navigateApp = useAppNavigate();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    navigateApp(to);
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
