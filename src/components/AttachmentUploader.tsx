"use client";

import { FileUploadDropzone, type UploadedAttachment } from "./FileUploadDropzone";

export type UploadedFileItem = UploadedAttachment;

export interface AttachmentUploaderProps {
  attachments: UploadedFileItem[];
  onChange: (attachments: UploadedFileItem[]) => void;
  maxFiles?: number;
  maxSizeMb?: number;
}

export function AttachmentUploader({
  attachments,
  onChange,
  maxFiles = 10,
  maxSizeMb = 5,
}: AttachmentUploaderProps) {
  return (
    <FileUploadDropzone
      attachments={attachments}
      onAttachmentsChange={onChange}
      maxFiles={maxFiles}
      maxSizeMb={maxSizeMb}
    />
  );
}
