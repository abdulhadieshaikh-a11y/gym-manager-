"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dumbbell, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { setLogoPath } from "./actions";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function LogoUploader({ currentUrl, readOnly }: { currentUrl: string | null; readOnly: boolean }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const upload = async (file: File) => {
    setError(undefined);
    const ext = TYPES[file.type];
    if (!ext) return setError("Use a PNG, JPG or WEBP image.");
    if (file.size > 1024 * 1024) return setError("The image must be smaller than 1 MB.");
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("gym-branding").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const res = await setLogoPath(path);
      if (!res.ok) throw new Error(res.error);
      toast.success("Logo updated");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /bucket|not found/i.test(msg)
          ? "The logo storage isn't set up. Apply the storage migration (see docs/SUPABASE_SETUP.md)."
          : msg && !/[A-Z_]{6,}/.test(msg) && msg.length < 140
            ? msg
            : "Could not upload the logo. Please try again.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await setLogoPath(null);
      if (res.ok) {
        toast.success("Logo removed");
        router.refresh();
      } else setError(res.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-lg)] border border-line bg-canvas">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo from Supabase Storage
          <img src={currentUrl} alt="Gym logo" className="size-full object-contain p-1" />
        ) : (
          <Dumbbell className="size-6 text-ink-faint" aria-hidden />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {!readOnly && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
              <Upload /> {currentUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {currentUrl && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
                Remove
              </Button>
            )}
          </div>
        )}
        <p className="text-[12.5px] text-ink-faint">Square PNG, JPG or WEBP, under 1 MB.</p>
        {error && <p className="text-[12.5px] text-bad">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>
    </div>
  );
}
