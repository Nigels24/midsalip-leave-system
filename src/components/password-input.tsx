"use client";
// A password box with an eye button that shows or hides what was typed.
// Takes the same props as <Input> (name, required, autoComplete, value, ...), so each form keeps its own.
// When the form is reset (after a successful save), the password is hidden again.
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PasswordInput({ className = "", ...props }: Omit<ComponentProps<"input">, "type">) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const hide = () => setShow(false);
    form.addEventListener("reset", hide);
    return () => form.removeEventListener("reset", hide);
  }, []);

  return (
    <div className="relative">
      <Input ref={ref} {...props} type={show ? "text" : "password"} className={`pr-10 ${className}`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        // Keep the cursor in the password box when the eye is clicked.
        onMouseDown={(e) => e.preventDefault()}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
