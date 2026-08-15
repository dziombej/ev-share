import React, { useState } from "react";
import { Plug } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  serverError?: string | null;
}

interface FieldErrors {
  latitude?: string;
  longitude?: string;
  powerRatingKw?: string;
}

export default function PocForm({ serverError }: Props) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [powerRatingKw, setPowerRatingKw] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate() {
    const next: FieldErrors = {};
    const lat = Number(latitude);
    const lng = Number(longitude);
    const power = Number(powerRatingKw);

    if (!latitude.trim() || Number.isNaN(lat) || lat < -90 || lat > 90) {
      next.latitude = "Enter a latitude between -90 and 90";
    }

    if (!longitude.trim() || Number.isNaN(lng) || lng < -180 || lng > 180) {
      next.longitude = "Enter a longitude between -180 and 180";
    }

    if (!powerRatingKw.trim() || Number.isNaN(power) || power <= 0 || power > 350) {
      next.powerRatingKw = "Enter a power rating between 0 and 350 kW";
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
    <form method="POST" action="/api/pocs/create" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div>
        <Label htmlFor="latitude" className="mb-1 text-blue-100/80">
          Latitude
        </Label>
        <Input
          id="latitude"
          name="latitude"
          data-testid="latitude"
          type="number"
          step="any"
          value={latitude}
          onChange={(e) => {
            setLatitude(e.target.value);
            clearError("latitude");
          }}
          placeholder="52.2297"
          aria-invalid={Boolean(errors.latitude)}
        />
        {errors.latitude ? <p className="mt-1 text-xs text-red-300">{errors.latitude}</p> : null}
      </div>

      <div>
        <Label htmlFor="longitude" className="mb-1 text-blue-100/80">
          Longitude
        </Label>
        <Input
          id="longitude"
          name="longitude"
          data-testid="longitude"
          type="number"
          step="any"
          value={longitude}
          onChange={(e) => {
            setLongitude(e.target.value);
            clearError("longitude");
          }}
          placeholder="21.0122"
          aria-invalid={Boolean(errors.longitude)}
        />
        {errors.longitude ? <p className="mt-1 text-xs text-red-300">{errors.longitude}</p> : null}
      </div>

      <div>
        <Label htmlFor="powerRatingKw" className="mb-1 text-blue-100/80">
          Power rating (kW)
        </Label>
        <Input
          id="powerRatingKw"
          name="powerRatingKw"
          data-testid="powerRatingKw"
          type="number"
          step="any"
          value={powerRatingKw}
          onChange={(e) => {
            setPowerRatingKw(e.target.value);
            clearError("powerRatingKw");
          }}
          placeholder="11"
          aria-invalid={Boolean(errors.powerRatingKw)}
        />
        {errors.powerRatingKw ? <p className="mt-1 text-xs text-red-300">{errors.powerRatingKw}</p> : null}
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Registering..." icon={<Plug className="size-4" />}>
        Register POC
      </SubmitButton>
    </form>
  );
}
