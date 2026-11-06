"use client";
// HRMO only: choose whose leave to file. Changing it sets ?for=<employeeId>, so the server
// page reloads the leave options and credits for that employee.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  currentId: string;
  employees: { id: string; name: string; officeId: string }[]; // everyone except the HRMO
}

export function FilingForPicker({ currentId, employees }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const current = employees.find((e) => e.id === currentId);
  const needle = query.trim().toLowerCase();
  const matches = needle ? employees.filter((e) => e.name.toLowerCase().includes(needle)).slice(0, 8) : [];

  const choose = (id: string | null) => {
    setQuery("");
    router.push(id ? `/apply?for=${id}` : "/apply");
  };

  return (
    <Card className="mb-4 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <UserRound size={16} className="text-slate-400" />
          <span className="text-slate-500">Filing for:</span>
          <b className="text-slate-800">{current ? `${current.name} (${current.officeId})` : "Myself"}</b>
          {current && (
            <Button type="button" variant="outline" size="sm" onClick={() => choose(null)}>
              Switch to myself
            </Button>
          )}
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search an employee by name to file on their behalf…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {needle && (
          <ul className="overflow-hidden rounded-md border">
            {matches.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No active employee matches.</li>}
            {matches.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => choose(e.id)}
                  className={cn("flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-brand-50", e.id === currentId && "bg-brand-50")}
                >
                  <span>{e.name}</span>
                  <span className="text-xs text-slate-500">{e.officeId}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
