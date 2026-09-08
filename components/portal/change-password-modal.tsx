"use client";

import { useState, useTransition } from "react";
import { Lock, Eye, EyeOff, KeyRound, Check, Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeClientPortalPassword } from "@/lib/actions/client-portal";

type ChangePasswordModalProps = {
  companySlug: string;
  triggerLabel?: string;
  className?: string;
  variant?: "outline" | "default" | "secondary" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  forceMandatory?: boolean;
};

export function ChangePasswordModal({
  companySlug,
  triggerLabel = "Change Password",
  className,
  variant = "outline",
  size = "sm",
  forceMandatory = false,
}: ChangePasswordModalProps) {
  const [isOpen, setIsOpen] = useState(forceMandatory);
  const [isPending, startTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleOpen = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isPending || forceMandatory) return;
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirmation password do not match.");
      return;
    }

    const formData = new FormData();
    formData.append("companySlug", companySlug);
    formData.append("currentPassword", currentPassword);
    formData.append("newPassword", newPassword);
    formData.append("confirmPassword", confirmPassword);

    startTransition(async () => {
      const res = await changeClientPortalPassword(formData);
      if (res.ok) {
        setSuccessMessage("Password updated successfully! Opening your portal dashboard...");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        window.location.href = `/portal/${companySlug}`;
      } else {
        setErrorMessage(res.message || "Failed to change password.");
      }
    });
  };

  return (
    <>
      {!forceMandatory ? (
        <Button
          type="button"
          variant={variant}
          size={size}
          onClick={handleOpen}
          className={className}
        >
          <KeyRound className="h-4 w-4 mr-1.5" />
          <span>{triggerLabel}</span>
        </Button>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
            {/* Close Button (only if not mandatory) */}
            {!forceMandatory ? (
              <button
                type="button"
                onClick={handleClose}
                className="absolute right-4 top-4 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <Lock className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {forceMandatory ? "Update One-Time Password" : "Change Password"}
                </h3>
                <p className="text-xs text-slate-500">
                  {forceMandatory
                    ? "First-time security setup: Please change your One-Time Password to unlock your portal dashboard."
                    : "Set a secure password for your Client Portal account."}
                </p>
              </div>
            </div>

            {/* Alert Messages */}
            {errorMessage ? (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            {successMessage ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            ) : null}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">Current One-Time Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrent ? "text" : "password"}
                    placeholder="Enter one-time password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pr-10"
                    disabled={isPending}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNew ? "text" : "password"}
                    placeholder="Enter new password (min. 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                    disabled={isPending}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                    disabled={isPending}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {!forceMandatory ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-medium gap-1.5"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  <span>{forceMandatory ? "Set Password & Open Dashboard" : "Update Password"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
