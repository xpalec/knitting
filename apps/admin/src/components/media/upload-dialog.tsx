'use client';

import { useRef, useState, useCallback } from 'react';
import { Upload, X, FileImage } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { mediaApi } from '@/lib/api/media';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

export function UploadDialog({ open, onOpenChange, onUploaded }: UploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  function handleClose() {
    if (isUploading) return;
    setPendingFiles([]);
    onOpenChange(false);
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (arr.length === 0) {
      toast.error('Only image and video files are supported');
      return;
    }
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...arr.filter((f) => !existing.has(f.name + f.size))];
    });
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload() {
    if (pendingFiles.length === 0) return;
    setIsUploading(true);

    let successCount = 0;
    let failCount = 0;

    for (const file of pendingFiles) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await mediaApi.uploadMedia(formData);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`);
      onUploaded();
    }
    if (failCount > 0) {
      toast.error(`${failCount} file${failCount > 1 ? 's' : ''} failed to upload`);
    }

    if (successCount > 0) {
      setPendingFiles([]);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop files here or click to browse"
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors cursor-pointer',
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
        >
          <Upload size={28} className="text-slate-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-slate-700">
              Drop files here or <span className="text-blue-600">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">Images and videos supported</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* Pending file list */}
        {pendingFiles.length > 0 && (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {pendingFiles.map((file, i) => (
              <li
                key={`${file.name}-${file.size}`}
                className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <FileImage size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                <span className="flex-1 truncate text-sm text-slate-700">{file.name}</span>
                <span className="text-xs text-slate-400 shrink-0">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={isUploading}
                  className="shrink-0 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={pendingFiles.length === 0 || isUploading}
          >
            {isUploading ? 'Uploading…' : `Upload${pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
