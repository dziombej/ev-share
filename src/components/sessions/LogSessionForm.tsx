import React, { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import type { Poc, UserSearchResult } from "@/types";

interface Props {
  ownPocs: Poc[];
  serverError?: string | null;
  success?: boolean;
}

interface FieldErrors {
  pocId?: string;
  seekerEmail?: string;
  kwh?: string;
}

const MIN_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 300;

export default function LogSessionForm({ ownPocs, serverError, success }: Props) {
  const [pocId, setPocId] = useState("");
  const [kwh, setKwh] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const [seekerQuery, setSeekerQuery] = useState("");
  const [seekerId, setSeekerId] = useState("");
  const [lockedSeekerEmail, setLockedSeekerEmail] = useState("");
  const [seekerResults, setSeekerResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    const query = seekerQuery.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      return;
    }

    const seq = ++searchSeq.current;

    const timeout = setTimeout(() => {
      void fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json() as Promise<{ users?: UserSearchResult[] }>)
        .then((body) => {
          if (seq !== searchSeq.current) return;
          setSeekerResults(body.users ?? []);
        })
        .catch(() => {
          if (seq !== searchSeq.current) return;
          setSeekerResults([]);
        })
        .finally(() => {
          if (seq !== searchSeq.current) return;
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [seekerQuery]);

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

    if (!seekerId) {
      next.seekerEmail = "Select a seeker from the list";
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

  function handleSeekerQueryChange(value: string) {
    setSeekerQuery(value);
    setSeekerId("");
    setLockedSeekerEmail("");
    setPopoverOpen(true);
    clearError("seekerEmail");

    if (value.trim().length < MIN_QUERY_LENGTH) {
      searchSeq.current += 1;
      setSeekerResults([]);
      setSearching(false);
    } else {
      setSearching(true);
    }
  }

  function handleSeekerSelect(user: UserSearchResult) {
    setSeekerId(user.id);
    setLockedSeekerEmail(user.email);
    setSeekerQuery(user.email);
    setPopoverOpen(false);
    clearError("seekerEmail");
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  const showEmptyState = !searching && seekerQuery.trim().length >= MIN_QUERY_LENGTH && seekerResults.length === 0;

  return (
    <form method="POST" action="/api/sessions/create" className="space-y-4" onSubmit={handleSubmit} noValidate>
      {success ? (
        <p
          className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300"
          data-testid="session-success"
        >
          Session logged successfully.
        </p>
      ) : null}

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
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <Command shouldFilter={false} className="overflow-visible bg-transparent text-white">
            <PopoverAnchor asChild>
              <div>
                <CommandInput
                  id="seekerEmail"
                  data-testid="seekerEmail"
                  value={seekerQuery}
                  onValueChange={handleSeekerQueryChange}
                  onFocus={() => {
                    setPopoverOpen(true);
                  }}
                  placeholder="driver@example.com"
                  wrapperClassName="rounded-md border border-white/20"
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="start"
              sideOffset={4}
              onOpenAutoFocus={(e) => {
                e.preventDefault();
              }}
              className="w-[--radix-popover-trigger-width] border-white/10 bg-slate-950 p-0 text-white shadow-xl"
            >
              <CommandList data-testid="seeker-results">
                {searching ? <CommandEmpty className="text-blue-100/60">Searching...</CommandEmpty> : null}
                {showEmptyState ? (
                  <CommandEmpty className="text-blue-100/60" data-testid="seeker-no-match">
                    No matching user
                  </CommandEmpty>
                ) : null}
                <CommandGroup>
                  {seekerResults.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      data-testid={`seeker-option-${user.id}`}
                      onSelect={() => {
                        handleSeekerSelect(user);
                      }}
                      className="text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white"
                    >
                      {user.email}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </PopoverContent>
          </Command>
        </Popover>
        <input type="hidden" name="seekerId" value={seekerId} />
        <input type="hidden" name="seekerEmail" value={lockedSeekerEmail} />
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

      <SubmitButton pendingText="Logging session..." icon={<Zap className="size-4" />} disabled={!seekerId}>
        Log session
      </SubmitButton>
    </form>
  );
}
