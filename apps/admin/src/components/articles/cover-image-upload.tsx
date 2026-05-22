'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { mediaApi } from '@/lib/api/media';
import { Button } from '@/components/ui/button';

interface CoverImageUploadProps {
  value: string | undefined;
  onChange: (url: string | undefined) => void;
  disabled?: boolean;
}

export function CoverImageUpload({ value, onChange, disabled }: CoverImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const asset = await mediaApi.uploadMedia(formData);
      onChange(asset.cdn_url ?? asset.url);
    } catch {
      toast.error('Cover image upload failed');
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be re-selected if needed
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  function handleRemove() {
    onChange(undefined);
  }

  if (isUploading) {
    return (
      <div className="text-sm text-muted-foreground">Uploading…</div>
    );
  }

  if (value) {
    return (
      <div className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Cover image"
          className="max-h-40 rounded object-cover w-full"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRemove}
          disabled={disabled}
        >
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || isUploading}
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Choose image
      </Button>
    </div>
  );
}
