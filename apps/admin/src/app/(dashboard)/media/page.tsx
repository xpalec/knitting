'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Image as ImageIcon,
  Upload,
  Copy,
  ExternalLink,
  Trash2,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  Film,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';

import { mediaApi } from '@/lib/api/media';
import type { MediaAsset, MediaType } from '@/lib/api/media';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { UploadDialog } from '@/components/media/upload-dialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 24;

const TYPE_OPTIONS: Array<{ value: 'all' | MediaType; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'image', label: 'Images' },
  { value: 'diagram', label: 'Diagrams' },
  { value: 'video', label: 'Videos' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeBadgeVariant(type: MediaType): string {
  switch (type) {
    case 'image':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'diagram':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'video':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function isVideo(asset: MediaAsset): boolean {
  return asset.type === 'video' || asset.url.match(/\.(mp4|webm|ogg|mov)$/i) !== null;
}

// ---------------------------------------------------------------------------
// Skeleton grid
// ---------------------------------------------------------------------------

function SkeletonGrid() {
  return (
    <>
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-100 overflow-hidden bg-white">
          <Skeleton className="aspect-video w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Asset card
// ---------------------------------------------------------------------------

interface AssetCardProps {
  asset: MediaAsset;
  onDelete: (asset: MediaAsset) => void;
}

function AssetCard({ asset, onDelete }: AssetCardProps) {
  const cdnUrl = asset.cdn_url ?? asset.url;

  function copyUrl() {
    navigator.clipboard.writeText(cdnUrl).then(
      () => toast.success('URL copied to clipboard'),
      () => toast.error('Failed to copy URL'),
    );
  }

  return (
    <div className="group relative rounded-xl border border-slate-100 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-slate-100 overflow-hidden">
        {isVideo(asset) ? (
          <div className="flex h-full items-center justify-center">
            <Film size={32} className="text-slate-300" aria-hidden="true" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cdnUrl}
            alt={asset.alt_text ?? 'Media asset'}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        )}

        {/* Hover action overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={copyUrl}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 hover:bg-white transition-colors"
            aria-label="Copy CDN URL"
          >
            <Copy size={14} aria-hidden="true" />
          </button>
          {asset.entry_id && (
            <Link
              href={`/entries/${asset.entry_id}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 hover:bg-white transition-colors"
              aria-label="Go to linked entry"
            >
              <ExternalLink size={14} aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => onDelete(asset)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-600 hover:bg-white transition-colors"
            aria-label="Delete asset"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Card footer */}
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${typeBadgeVariant(asset.type)}`}
          >
            {asset.type}
          </span>
          {asset.entry_term_en && (
            <span className="truncate text-xs text-slate-500 max-w-[120px]" title={asset.entry_term_en}>
              {asset.entry_term_en}
            </span>
          )}
        </div>
        {asset.alt_text && (
          <p className="truncate text-xs text-slate-400" title={asset.alt_text}>
            {asset.alt_text}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MediaPage() {
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<'all' | MediaType>('all');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);

  const params = {
    page,
    limit: PAGE_SIZE,
    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['media', params],
    queryFn: () => mediaApi.listMedia(params),
  });

  const assets = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mediaApi.deleteMedia(id),
    onSuccess: () => {
      toast.success('Asset deleted');
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error('Failed to delete asset');
    },
  });

  function handleUploaded() {
    queryClient.invalidateQueries({ queryKey: ['media'] });
  }

  function handleTypeChange(value: string) {
    setTypeFilter(value as 'all' | MediaType);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Media Library</h1>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload size={16} aria-hidden="true" />
          Upload
        </Button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <div className="rounded-lg bg-slate-50 p-2 text-blue-600">
          <LayoutGrid size={18} aria-hidden="true" />
        </div>
        {isLoading ? (
          <Skeleton className="h-4 w-28" />
        ) : (
          <span>
            <span className="font-semibold text-slate-800">{total}</span>{' '}
            {total === 1 ? 'asset' : 'assets'} total
          </span>
        )}
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <ImageIcon size={15} className="text-slate-400 shrink-0" aria-hidden="true" />
            <Select value={typeFilter} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-40" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <SkeletonGrid />
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-20 text-slate-400">
          <ImageOff size={40} className="mb-3" aria-hidden="true" />
          <p className="text-sm font-medium">No media assets found</p>
          <p className="text-xs mt-1">
            {typeFilter !== 'all'
              ? 'Try a different type filter'
              : 'Upload your first asset to get started'}
          </p>
          {typeFilter === 'all' && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setUploadOpen(true)}
            >
              <Upload size={14} aria-hidden="true" />
              Upload
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && assets.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page <span className="font-medium text-slate-700">{page}</span> of{' '}
            <span className="font-medium text-slate-700">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {/* Upload dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={handleUploaded}
      />

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Asset"
        description="Are you sure you want to delete this asset? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
