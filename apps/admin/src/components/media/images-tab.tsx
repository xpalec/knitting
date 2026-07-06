'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  Upload,
  ImageOff,
  Loader2,
  AlertCircle,
  X,
  FileImage,
  Save,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { mediaApi } from '@/lib/api/media';
import type { MediaAsset } from '@/lib/api/media';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImagesTabProps {
  sourceType: 'entry' | 'article';
  sourceId: string;
}

// ---------------------------------------------------------------------------
// CopyButton — shows a ✓ tick for 1.5 s after copying
// ---------------------------------------------------------------------------

interface CopyButtonProps {
  label: string;
  url: string;
}

function CopyButton({ label, url }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy URL');
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${label} URL`}
      aria-label={`Copy ${label} URL`}
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
        'border border-slate-200 bg-white hover:bg-slate-50 text-slate-600',
        copied && 'border-green-300 bg-green-50 text-green-700',
      )}
    >
      {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// AssetCard
// ---------------------------------------------------------------------------

interface AssetCardProps {
  asset: MediaAsset;
  onUpdated: (updated: MediaAsset) => void;
}

function AssetCard({ asset, onUpdated }: AssetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [altTextDraft, setAltTextDraft] = useState(asset.alt_text ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const thumbnailUrl = asset.url_small ?? asset.url_original;

  async function handleSaveAltText() {
    setIsSaving(true);
    const previousAltText = asset.alt_text ?? '';
    try {
      const updated = await mediaApi.updateAltText(asset.id, altTextDraft || null);
      onUpdated(updated);
      setIsEditing(false);
    } catch {
      toast.error('Failed to save alt text');
      setAltTextDraft(previousAltText);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setAltTextDraft(asset.alt_text ?? '');
    setIsEditing(false);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt={asset.alt_text ?? asset.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Filename */}
        <p
          className="text-xs font-medium text-slate-700 truncate"
          title={asset.filename}
        >
          {asset.filename}
        </p>

        {/* Alt text */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Alt text</span>
            {!isEditing && (
              <button
                type="button"
                onClick={() => {
                  setAltTextDraft(asset.alt_text ?? '');
                  setIsEditing(true);
                }}
                aria-label="Edit alt text"
                className="text-slate-400 hover:text-violet-600 transition-colors"
              >
                <Pencil size={12} aria-hidden="true" />
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="flex flex-col gap-1.5">
              <Input
                value={altTextDraft}
                onChange={(e) => setAltTextDraft(e.target.value)}
                placeholder="Describe the image…"
                maxLength={500}
                disabled={isSaving}
                className="h-7 text-xs"
                autoFocus
              />
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                  aria-label="Cancel edit"
                >
                  <X size={11} aria-hidden="true" />
                  Cancel
                </button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveAltText}
                  disabled={isSaving}
                  className="h-6 px-2 text-xs gap-1 bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {isSaving ? (
                    <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Save size={11} aria-hidden="true" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic line-clamp-2">
              {asset.alt_text || <span className="text-slate-300">No alt text</span>}
            </p>
          )}
        </div>

        {/* Copy URL buttons */}
        <div className="flex flex-wrap gap-1 pt-1">
          <CopyButton label="Original" url={asset.url_original} />
          {asset.url_medium && <CopyButton label="Medium" url={asset.url_medium} />}
          {asset.url_small && <CopyButton label="Small" url={asset.url_small} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineUploadControl — file input that calls the correct upload endpoint
// ---------------------------------------------------------------------------

interface InlineUploadControlProps {
  sourceType: 'entry' | 'article';
  sourceId: string;
  onUploaded: (asset: MediaAsset) => void;
}

function InlineUploadControl({ sourceType, sourceId, onUploaded }: InlineUploadControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFile(file: File) {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const asset =
        sourceType === 'entry'
          ? await mediaApi.uploadForEntry(sourceId, formData)
          : await mediaApi.uploadForArticle(sourceId, formData);
      onUploaded(asset);
      toast.success('Image uploaded');
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;
    void uploadFile(file);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceType, sourceId],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drop an image here or click to browse"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
        isDragging
          ? 'border-violet-500 bg-violet-50'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
        isUploading && 'pointer-events-none opacity-60',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isUploading && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
          inputRef.current?.click();
        }
      }}
    >
      {isUploading ? (
        <Loader2 size={22} className="animate-spin text-violet-500" aria-hidden="true" />
      ) : (
        <Upload size={22} className="text-slate-400" aria-hidden="true" />
      )}
      <div>
        <p className="text-sm font-medium text-slate-700">
          {isUploading
            ? 'Uploading…'
            : <>Drop image here or <span className="text-violet-600">browse</span></>}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">PNG, JPEG, WebP, SVG · max 5 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImagesTab — main exported component
// ---------------------------------------------------------------------------

export function ImagesTab({ sourceType, sourceId }: ImagesTabProps) {
  const queryClient = useQueryClient();
  const queryKey = ['media-assets', sourceType, sourceId] as const;

  const { data: assets, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => mediaApi.listForEntity(sourceType, sourceId),
  });

  function handleAssetUpdated(updated: MediaAsset) {
    queryClient.setQueryData<MediaAsset[]>(queryKey, (prev) =>
      prev ? prev.map((a) => (a.id === updated.id ? updated : a)) : [updated],
    );
  }

  function handleAssetUploaded(newAsset: MediaAsset) {
    queryClient.setQueryData<MediaAsset[]>(queryKey, (prev) =>
      prev ? [...prev, newAsset] : [newAsset],
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload control */}
      <InlineUploadControl
        sourceType={sourceType}
        sourceId={sourceId}
        onUploaded={handleAssetUploaded}
      />

      {/* Asset list */}
      {isLoading && (
        <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          <span className="text-sm">Loading images…</span>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
          <AlertCircle size={22} className="text-red-400" aria-hidden="true" />
          <p className="text-sm text-slate-600">Failed to load images.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && assets?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
          <ImageOff size={28} aria-hidden="true" />
          <p className="text-sm">No images have been uploaded yet.</p>
        </div>
      )}

      {!isLoading && !isError && assets && assets.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onUpdated={handleAssetUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}
