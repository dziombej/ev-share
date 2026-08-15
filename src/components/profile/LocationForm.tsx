import React, { useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { UserLocation } from "@/types";

interface Props {
  initialLocation: UserLocation | null;
}

interface FieldErrors {
  latitude?: string;
  longitude?: string;
}

export default function LocationForm({ initialLocation }: Props) {
  const [mode, setMode] = useState<"view" | "edit">(initialLocation ? "view" : "edit");
  const [latitude, setLatitude] = useState(initialLocation ? String(initialLocation.latitude) : "");
  const [longitude, setLongitude] = useState(initialLocation ? String(initialLocation.longitude) : "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  function validate() {
    const next: FieldErrors = {};
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!latitude.trim() || Number.isNaN(lat) || lat < -90 || lat > 90) {
      next.latitude = "Enter a latitude between -90 and 90";
    }

    if (!longitude.trim() || Number.isNaN(lng) || lng < -180 || lng > 180) {
      next.longitude = "Enter a longitude between -180 and 180";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof FieldErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setStatus("pending");

    try {
      const response = await fetch("/api/profile/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: Number(latitude), longitude: Number(longitude) }),
      });

      if (!response.ok) {
        throw new Error("Failed to save location");
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setServerError("Couldn't save your location. Try again.");
    }
  }

  const hasLocation = Boolean(latitude && longitude);

  if (mode === "view") {
    return (
      <div className="flex items-center justify-between gap-3 text-sm" data-testid="location-summary">
        <span className="flex items-center gap-2 text-blue-100/80">
          <MapPin className="size-4 shrink-0" />
          {hasLocation ? `${latitude}, ${longitude}` : "Location not set"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="location-edit-button"
          onClick={() => {
            setMode("edit");
          }}
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div>
      <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)} noValidate>
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
              setStatus("idle");
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
              setStatus("idle");
            }}
            placeholder="21.0122"
            aria-invalid={Boolean(errors.longitude)}
          />
          {errors.longitude ? <p className="mt-1 text-xs text-red-300">{errors.longitude}</p> : null}
        </div>

        {status === "success" ? (
          <p className="text-sm text-green-300" data-testid="location-success">
            Location saved.
          </p>
        ) : null}
        {status === "error" && serverError ? (
          <p className="text-sm text-red-300" data-testid="location-error">
            {serverError}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={status === "pending"}
            data-testid="submit-button"
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
          >
            {status === "pending" ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <MapPin className="size-4" />
                Save location
              </span>
            )}
          </Button>
          {hasLocation ? (
            <Button
              type="button"
              variant="outline"
              data-testid="location-done-button"
              onClick={() => {
                setMode("view");
              }}
            >
              Done
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
