"use client";

import { useState, useEffect } from "react";
import { Check, Copy, ExternalLink, Eye, EyeOff, Key, Mail, MessageSquare, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ClientPortalShareCardProps = {
  customerName: string;
  companyName: string;
  clientCode: string;
  portalSlug: string;
  email: string | null;
  phone: string | null;
  plainPassword?: string | null;
};

export function ClientPortalShareCard({
  customerName,
  companyName,
  clientCode,
  portalSlug,
  email,
  phone,
  plainPassword,
}: ClientPortalShareCardProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const loginPath = `/portal/${portalSlug}/login`;
  const fullLoginUrl = origin ? `${origin}${loginPath}` : `http://localhost:3000${loginPath}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(fullLoginUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopyPassword = () => {
    if (!plainPassword) return;
    navigator.clipboard.writeText(plainPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  const passwordText = plainPassword ?? "Password set by client";
  const shareText = `Hello ${customerName},\n\nHere is your Client Portal Credentials for ${companyName}:\nLogin Link: ${fullLoginUrl}\nClient ID: ${clientCode}\nPassword: ${plainPassword ? plainPassword : "[Changed by client]"}`;

  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, "") : "";
  const whatsappUrl = `https://api.whatsapp.com/send?${cleanPhone ? `phone=${encodeURIComponent(cleanPhone)}&` : ""}text=${encodeURIComponent(shareText)}`;
  const mailtoUrl = `mailto:${email ?? ""}?subject=${encodeURIComponent(`Client Portal Login Credentials - ${companyName}`)}&body=${encodeURIComponent(shareText)}`;
  const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(shareText)}`;

  return (
    <Card className="border-cyan-200 bg-gradient-to-br from-white via-slate-50/50 to-cyan-50/30 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-cyan-600" />
            <CardTitle className="text-lg font-semibold">Client Portal Credentials</CardTitle>
          </div>
          <Badge variant="secondary" className="border-cyan-300 bg-cyan-50 text-cyan-800 font-mono">
            {clientCode}
          </Badge>
        </div>
        <CardDescription>
          Share this URL and login credentials directly with {customerName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credentials Display Box */}
        <div className="rounded-md border border-slate-200 bg-white p-3 space-y-3">
          {/* Client ID */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-cyan-600" />
              Client ID:
            </span>
            <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
              {clientCode}
            </span>
          </div>

          {/* Password Display */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 flex items-center justify-between">
              <span>Password {plainPassword ? "(One-Time)" : "(Client Private)"}</span>
              {plainPassword ? (
                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  One-Time Pass Active
                </span>
              ) : (
                <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                  Password Set by Client
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  type={showPassword ? "text" : "password"}
                  value={passwordText}
                  className="pr-10 font-mono text-xs bg-slate-50 border-slate-300"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!plainPassword}
                onClick={handleCopyPassword}
                className="shrink-0 gap-1 text-xs"
              >
                {copiedPassword ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Pass</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Copy Link Input Bar */}
          <div className="space-y-1 pt-1">
            <label className="text-xs font-medium text-slate-600">
              Portal Login URL
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  value={fullLoginUrl}
                  className="pr-10 font-mono text-xs bg-slate-50 border-slate-300"
                />
                <a
                  href={loginPath}
                  target="_blank"
                  rel="noreferrer"
                  title="Open login page in new tab"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleCopyUrl}
                className="shrink-0 gap-1.5 bg-cyan-700 hover:bg-cyan-800 text-white font-medium text-xs shadow-xs"
              >
                {copiedUrl ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy URL</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Send & Share Channels */}
        <div className="space-y-2 pt-2 border-t border-slate-200/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Send Login Credentials via Channels
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <Send className="h-3.5 w-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </a>

            {/* Email */}
            <a
              href={mailtoUrl}
              className="flex items-center justify-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
            >
              <Mail className="h-3.5 w-3.5 text-blue-600" />
              <span>Email</span>
            </a>

            {/* SMS */}
            <a
              href={smsUrl}
              className="flex items-center justify-center gap-2 rounded-md border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-800 hover:bg-purple-100 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5 text-purple-600" />
              <span>SMS</span>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

