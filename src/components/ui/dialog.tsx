"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /**
   * Largura do diálogo (ex.: `max-w-4xl`). A largura mora AQUI, no invólucro
   * — passar `max-w-*` no `DialogContent` não tem efeito, porque o invólucro
   * já limita em `max-w-lg`.
   */
  className?: string;
}

export function Dialog({ open, onOpenChange, children, className }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        data-testid="dialog-overlay"
        onClick={() => onOpenChange(false)}
      />
      <div className={cn("relative z-50 w-full max-w-lg mx-4", className)}>{children}</div>
    </div>
  );
}

export function DialogContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-[#e5e5e5] shadow-lg p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DialogHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mb-4">{children}</div>;
}

export function DialogTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h2
      className="text-lg font-bold text-[#1d1d1b]"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {children}
    </h2>
  );
}

export function DialogDescription({
  children,
}: {
  children: React.ReactNode;
}) {
  return <p className="text-sm text-[#737373] mt-1">{children}</p>;
}

export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex justify-end gap-2 mt-6", className)}>{children}</div>;
}

export function DialogClose({
  onClick,
}: {
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="absolute top-4 right-4 p-1 rounded-md hover:bg-[#f7f7f7] text-[#737373] transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
  );
}
