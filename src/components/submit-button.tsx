"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for a plain <form action={serverAction}> (walkthrough note
 * 13, 2026-10-10): disabled with a busy label while the form is submitting,
 * so a double tap can't send it twice. useFormStatus reads the enclosing
 * form's own pending state, so server-rendered pages can use it as is.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  role,
  onClick,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
  role?: string;
  onClick?: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      role={role}
      onClick={onClick}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
