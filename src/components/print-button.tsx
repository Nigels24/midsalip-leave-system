"use client";
// window.print() only exists in the browser, so this one button is a client component.
// Used by CS Form No. 6 and the leave card. The print CSS in globals.css hides everything else.
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print / Save as PDF", variant = "default" }: { label?: string; variant?: "default" | "outline" }) {
  return (
    <Button variant={variant} onClick={() => window.print()}>
      <Printer size={16} /> {label}
    </Button>
  );
}
