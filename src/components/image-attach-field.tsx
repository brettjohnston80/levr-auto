"use client";

import { useState, type ChangeEvent } from "react";

/**
 * Shared by article-review-form.tsx and social-post-review-form.tsx --
 * manual image attachment for the weekly review step. No automated image
 * sourcing this pass, per explicit scope cut -- an agent picks a file,
 * this uploads it and shows a preview via the resulting public URL
 * (social-post-images bucket is public, so no signed-URL refresh needed).
 */
export function ImageAttachField({
  imageUrl,
  onUpload,
}: {
  imageUrl: string | null;
  onUpload: (file: File) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const result = await onUpload(file);
    setUploading(false);

    if (!result.ok) {
      setError(result.error ?? "Upload failed.");
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400">Image</label>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic Storage URL, not a static local asset
        <img src={imageUrl} alt="" className="mt-2 h-32 w-32 rounded-md border border-white/10 object-cover" />
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={uploading}
        className="mt-2 block text-sm text-zinc-400 file:mr-3 file:rounded-md file:border file:border-white/10 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:text-white disabled:opacity-50"
      />
      {uploading && <p className="mt-1 text-xs text-zinc-500">Uploading…</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
