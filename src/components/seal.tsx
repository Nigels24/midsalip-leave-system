// The municipal seal (public/logo.png).
import Image from "next/image";

export function Seal({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Municipal Government of Midsalip seal"
      width={608}
      height={410}
      priority
      className={["object-contain", className].filter(Boolean).join(" ")}
    />
  );
}
