"use client";

import { useState, useRef } from "react";

export interface UploadedAttachment {
  storage_path: string;
  original_name: string;
  size_bytes: number;
  mime: string;
}

interface FileUploadDropzoneProps {
  attachments: UploadedAttachment[];
  onAttachmentsChange: (attachments: UploadedAttachment[]) => void;
  maxFiles?: number;
  maxSizeMb?: number;
}

export function FileUploadDropzone({
  attachments,
  onAttachmentsChange,
  maxFiles = 10,
  maxSizeMb = 5,
}: FileUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (selectedFiles: FileList | File[]) => {
    setError(null);
    const files = Array.from(selectedFiles);

    if (files.length === 0) return;

    if (attachments.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed. You already have ${attachments.length}.`);
      return;
    }

    setUploading(true);
    const newUploaded: UploadedAttachment[] = [];

    for (const file of files) {
      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the ${maxSizeMb} MB limit.`);
        setUploading(false);
        return;
      }

      const lowerName = file.name.toLowerCase();
      const isAllowed = [".pdf", ".jpg", ".jpeg", ".png"].some((ext) =>
        lowerName.endsWith(ext)
      );
      if (!isAllowed) {
        setError(`File "${file.name}" has an unsupported format. Only PDF, JPG, and PNG are allowed.`);
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/attachments/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || `Upload failed for ${file.name}`);
          setUploading(false);
          return;
        }

        newUploaded.push({
          storage_path: data.storage_path,
          original_name: data.original_name,
          size_bytes: data.size_bytes,
          mime: data.mime,
        });
      } catch {
        setError(`Network error uploading "${file.name}". Please try again.`);
        setUploading(false);
        return;
      }
    }

    onAttachmentsChange([...attachments, ...newUploaded]);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-md flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition select-none ${
          isDragging
            ? "border-indigo-500 bg-indigo-50/70"
            : "border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf"
          disabled={uploading || attachments.length >= maxFiles}
          onChange={(e) => e.target.files && processFiles(e.target.files)}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-1.5">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-lg mb-1">
            📁
          </div>
          <p className="text-xs font-semibold text-slate-800">
            <span className="text-indigo-600 hover:underline">Click to browse files</span> or drag and drop here
          </p>
          <p className="text-[11px] text-slate-500">
            Supported formats: PDF, JPG, PNG (up to {maxSizeMb} MB each, max {maxFiles} files)
          </p>
        </div>

        {uploading && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-indigo-600 font-semibold animate-pulse">
            <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Uploading &amp; digitally verifying file...</span>
          </div>
        )}
      </div>

      {/* Uploaded Files List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-700 block">
            Attached Documents ({attachments.length} of {maxFiles}):
          </span>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-md bg-white">
            {attachments.map((file, idx) => (
              <li
                key={`${file.storage_path}-${idx}`}
                className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/80 transition"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className="font-mono text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                    {file.mime.includes("pdf") ? "PDF" : "IMG"}
                  </span>
                  <span className="truncate max-w-sm font-medium text-slate-800">
                    {file.original_name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {(file.size_bytes / 1024).toFixed(1)} KB
                  </span>
                  <span className="text-emerald-600 font-bold text-[11px]">✓ Ready</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttachment(idx);
                    }}
                    className="text-rose-600 hover:text-rose-800 font-bold text-xs hover:underline ml-1"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
