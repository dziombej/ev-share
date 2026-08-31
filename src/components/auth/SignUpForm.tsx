import React, { useEffect, useRef, useState } from "react";
import { Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { formText } from "@/lib/form";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  serverError?: string | null;
}

export default function SignUpForm({ serverError }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Mirrors the password field's length for the "N more characters" hint only.
  // The field itself is uncontrolled (see FormField), so this is a follower of
  // the DOM, never its owner — validation still reads the form directly.
  const [passwordLength, setPasswordLength] = useState(0);

  // A password typed before this island hydrated fired no onChange, so seed the
  // mirror from what is actually in the field. Safe precisely because the input
  // is uncontrolled: React never blanked it.
  useEffect(() => {
    const field = formRef.current?.elements.namedItem("password");
    if (field instanceof HTMLInputElement && field.value) {
      setPasswordLength(field.value.length);
    }
  }, []);

  function validate(form: HTMLFormElement) {
    const data = new FormData(form);
    const email = formText(data, "email");
    const password = formText(data, "password");
    const confirmPassword = formText(data, "confirmPassword");

    const next: typeof errors = {};

    if (!email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Enter a valid email address";
    }

    if (!password) {
      next.password = "Password is required";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate(e.currentTarget)) {
      e.preventDefault();
    }
  }

  const passwordHint =
    !errors.password && passwordLength > 0 && passwordLength < MIN_PASSWORD_LENGTH ? (
      <p className="mt-1 text-xs text-blue-100/50">
        {MIN_PASSWORD_LENGTH - passwordLength} more character
        {MIN_PASSWORD_LENGTH - passwordLength !== 1 ? "s" : ""} needed
      </p>
    ) : undefined;

  return (
    <form
      ref={formRef}
      method="POST"
      action="/api/auth/signup"
      className="space-y-4"
      onSubmit={handleSubmit}
      noValidate
    >
      <FormField
        id="email"
        type="email"
        label="Email"
        onChange={() => {
          clearError("email");
        }}
        placeholder="you@example.com"
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id="password"
        label="Password"
        type={showPassword ? "text" : "password"}
        onChange={(v) => {
          setPasswordLength(v.length);
          clearError("password");
        }}
        placeholder="Min. 6 characters"
        error={errors.password}
        hint={passwordHint}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        type={showConfirmPassword ? "text" : "password"}
        onChange={() => {
          clearError("confirmPassword");
        }}
        placeholder="Re-enter your password"
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Creating account..." icon={<UserPlus className="size-4" />}>
        Create account
      </SubmitButton>
    </form>
  );
}
