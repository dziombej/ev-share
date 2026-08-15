import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import type { Poc } from "@/types";

interface Props {
  pocs: Poc[];
  currentUserId: string;
}

export default function PocList({ pocs: initialPocs, currentUserId }: Props) {
  const [pocs, setPocs] = useState(initialPocs);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleToggle(poc: Poc, next: boolean) {
    setPocs((prev) => prev.map((p) => (p.id === poc.id ? { ...p, isAvailable: next } : p)));
    setErrors((prev) => ({ ...prev, [poc.id]: "" }));

    try {
      const response = await fetch(`/api/pocs/${poc.id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: next }),
      });

      if (!response.ok) {
        throw new Error("Failed to update availability");
      }
    } catch {
      setPocs((prev) => prev.map((p) => (p.id === poc.id ? { ...p, isAvailable: !next } : p)));
      setErrors((prev) => ({ ...prev, [poc.id]: "Couldn't update availability. Try again." }));
    }
  }

  if (pocs.length === 0) {
    return (
      <p className="text-sm text-blue-100/60" data-testid="poc-list-empty">
        No POCs registered yet.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="poc-list">
      {pocs.map((poc) => {
        const isOwner = poc.ownerId === currentUserId;
        return (
          <Card key={poc.id} className="border-white/10 bg-white/10 text-white" data-testid={`poc-${poc.id}`}>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{poc.powerRatingKw} kW</p>
                <p className="text-sm text-blue-100/60">
                  {poc.latitude}, {poc.longitude}
                </p>
                {errors[poc.id] ? <p className="mt-1 text-xs text-red-300">{errors[poc.id]}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-100/80">{poc.isAvailable ? "Available" : "Unavailable"}</span>
                <Switch
                  checked={poc.isAvailable}
                  disabled={!isOwner}
                  data-testid={`poc-${poc.id}-toggle`}
                  onCheckedChange={(checked) => {
                    if (isOwner) void handleToggle(poc, checked);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
