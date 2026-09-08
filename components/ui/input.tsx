import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const semanticName =
      props["aria-label"] ??
      props.placeholder ??
      (typeof props.name === "string"
        ? props.name
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replaceAll("_", " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase())
        : undefined);
    return (
      <input
        type={type}
        aria-label={type === "hidden" ? undefined : semanticName}
        title={type === "hidden" ? undefined : props.title ?? semanticName}
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
