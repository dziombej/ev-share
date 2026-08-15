import React, { useState } from "react";
import { Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import type { Poc } from "@/types";

interface Props {
  ownPocs: Poc[];
  serverError?: string | null;
}

interface FieldErrors {
  pocId?: string;
  seekerEmail?: string;
  kwh?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LogSessionForm({ ownPocs, serverError }: Props) {
  const [pocId, setPocId] = useState("");
  const [seekerEmail, setSeekerEmail] = useState("");
  const [kwh, setKwh] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  if (ownPocs.length === 0) {
    return (
      <p className="text-sm text-blue-100/60" data-testid="sessions-no-pocs">
        You need to register a charging point before you can log a session.{" "}
        <a href="/dashboard/pocs" className="underline">
          Register a POC
        </a>
        .
      </p>
    );
  }

  function validate() {
    const next: FieldErrors = {};
    const amount = Number(kwh);

    if (!pocId) {
      next.pocId = "Select one of your charging points";
    }

    if (!seekerEmail.trim() || !EMAIL_PATTERN.test(seekerEmail)) {
      next.seekerEmail = "Enter a valid email address";
    }

    if (!kwh.trim() || Number.isNaN(amount) || amount <= 0 || amount > 500) {
      next.kwh = "Enter a kWh amount between 0 and 500";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof FieldErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/sessions/create" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div>
        <Label htmlFor="pocId" className="mb-1 text-blue-100/80">
          Your charging point
        </Label>
        <Select
          name="pocId"
          value={pocId}
          onValueChange={(value) => {
            setPocId(value);
            clearError("pocId");
          }}
        >
          <SelectTrigger id="pocId" data-testid="pocId" className="w-full" aria-invalid={Boolean(errors.pocId)}>
            <SelectValue placeholder="Select a charging point" />
          </SelectTrigger>
          <SelectContent>
            {ownPocs.map((poc) => (
              <SelectItem key={poc.id} value={poc.id}>
                {poc.latitude}, {poc.longitude} — {poc.powerRatingKw} kW
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.pocId ? <p className="mt-1 text-xs text-red-300">{errors.pocId}</p> : null}
      </div>

      <div>
        <Label htmlFor="seekerEmail" className="mb-1 text-blue-100/80">
          Seeker email
        </Label>
        <Input
          id="seekerEmail"
          name="seekerEmail"
          data-testid="seekerEmail"
          type="email"
          value={seekerEmail}
          onChange={(e) => {
            setSeekerEmail(e.target.value);
            clearError("seekerEmail");
          }}
          placeholder="driver@example.com"
          aria-invalid={Boolean(errors.seekerEmail)}
        />
        {errors.seekerEmail ? <p className="mt-1 text-xs text-red-300">{errors.seekerEmail}</p> : null}
      </div>

      <div>
        <Label htmlFor="kwh" className="mb-1 text-blue-100/80">
          kWh delivered
        </Label>
        <Input
          id="kwh"
          name="kwh"
          data-testid="kwh"
          type="number"
          step="any"
          value={kwh}
          onChange={(e) => {
            setKwh(e.target.value);
            clearError("kwh");
          }}
          placeholder="10"
          aria-invalid={Boolean(errors.kwh)}
        />
        {errors.kwh ? <p className="mt-1 text-xs text-red-300">{errors.kwh}</p> : null}
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Logging session..." icon={<Zap className="size-4" />}>
        Log session
      </SubmitButton>
    </form>
  );
}
