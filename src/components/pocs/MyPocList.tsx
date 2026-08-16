import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Poc } from "@/types";

interface Props {
  pocs: Poc[];
}

export default function MyPocList({ pocs: initialPocs }: Props) {
  const [pocs, setPocs] = useState(initialPocs);
  const [powerDrafts, setPowerDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  function setPending(pocId: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) {
        next.add(pocId);
      } else {
        next.delete(pocId);
      }
      return next;
    });
  }

  async function handleToggle(poc: Poc, next: boolean) {
    if (pendingIds.has(poc.id)) return;

    setPending(poc.id, true);
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
    } finally {
      setPending(poc.id, false);
    }
  }

  async function handlePowerSave(poc: Poc) {
    if (pendingIds.has(poc.id)) return;

    const draft = powerDrafts[poc.id];
    const powerRatingKw = Number(draft);
    if (!draft || Number.isNaN(powerRatingKw) || powerRatingKw <= 0 || powerRatingKw > 350) {
      setErrors((prev) => ({ ...prev, [poc.id]: "Enter a power rating between 0 and 350 kW" }));
      return;
    }

    setPending(poc.id, true);
    setErrors((prev) => ({ ...prev, [poc.id]: "" }));

    try {
      const response = await fetch(`/api/pocs/${poc.id}/power`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ powerRatingKw }),
      });

      if (!response.ok) {
        throw new Error("Failed to update power rating");
      }

      setPocs((prev) => prev.map((p) => (p.id === poc.id ? { ...p, powerRatingKw } : p)));
      setPowerDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== poc.id)));
    } catch {
      setErrors((prev) => ({ ...prev, [poc.id]: "Couldn't update power rating. Try again." }));
    } finally {
      setPending(poc.id, false);
    }
  }

  async function handleRemove(poc: Poc) {
    if (pendingIds.has(poc.id)) return;
    if (!window.confirm("Remove this charging point? This can't be undone.")) return;

    setPending(poc.id, true);
    setErrors((prev) => ({ ...prev, [poc.id]: "" }));

    try {
      const response = await fetch(`/api/pocs/${poc.id}`, { method: "DELETE" });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to remove charging point");
      }

      setRemovedIds((prev) => new Set(prev).add(poc.id));
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [poc.id]: error instanceof Error ? error.message : "Failed to remove charging point",
      }));
    } finally {
      setPending(poc.id, false);
    }
  }

  const visiblePocs = pocs.filter((poc) => !removedIds.has(poc.id));

  if (visiblePocs.length === 0) {
    return (
      <p className="text-sm text-blue-100/60" data-testid="my-poc-list-empty">
        You haven&apos;t registered a charging point yet.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="my-poc-list">
      {visiblePocs.map((poc) => {
        const pending = pendingIds.has(poc.id);
        const powerDraft = powerDrafts[poc.id] ?? String(poc.powerRatingKw);

        return (
          <Card key={poc.id} className="border-white/10 bg-white/10 text-white" data-testid={`my-poc-${poc.id}`}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-blue-100/60">
                  {poc.latitude}, {poc.longitude}
                </p>
                {errors[poc.id] ? <p className="mt-1 text-xs text-red-300">{errors[poc.id]}</p> : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  step="any"
                  value={powerDraft}
                  disabled={pending}
                  onChange={(e) => {
                    setPowerDrafts((prev) => ({ ...prev, [poc.id]: e.target.value }));
                  }}
                  className="w-24"
                  data-testid={`my-poc-${poc.id}-power-input`}
                />
                <span className="text-sm text-blue-100/60">kW</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => void handlePowerSave(poc)}
                  data-testid={`my-poc-${poc.id}-power-save`}
                >
                  Save
                </Button>

                <span className="text-sm text-blue-100/80">{poc.isAvailable ? "Available" : "Unavailable"}</span>
                <Switch
                  checked={poc.isAvailable}
                  disabled={pending}
                  data-testid={`my-poc-${poc.id}-toggle`}
                  onCheckedChange={(checked) => void handleToggle(poc, checked)}
                />

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => void handleRemove(poc)}
                  data-testid={`my-poc-${poc.id}-remove`}
                >
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
