export const ATTACHMENT_BUCKET = "attachments";
export const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip";

export const attachmentEntityTypes = ["task", "project", "client", "note", "content", "decision", "invoice"] as const;
export type AttachmentEntityType = (typeof attachmentEntityTypes)[number];

const mimeByExtension: Record<string, readonly string[]> = {
  jpg: ["image/jpeg", ""], jpeg: ["image/jpeg", ""], png: ["image/png", ""], webp: ["image/webp", ""], gif: ["image/gif", ""],
  pdf: ["application/pdf", ""], doc: ["application/msword", "application/octet-stream", ""],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream", ""],
  txt: ["text/plain", ""], csv: ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel", ""],
  xls: ["application/vnd.ms-excel", "application/octet-stream", ""],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream", ""],
  zip: ["application/zip", "application/x-zip-compressed", "application/octet-stream", ""],
};

export function extensionOf(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function safeAttachmentFilename(filename: string) {
  const normalized = filename.normalize("NFKD").replace(/[\\/\0]/g, "-").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "");
  return normalized.slice(-120) || "file";
}

export function attachmentStoragePath(userId: string, entityType: AttachmentEntityType, entityId: string, filename: string, objectId = crypto.randomUUID()) {
  return `${userId}/${entityType}/${entityId}/${objectId}-${safeAttachmentFilename(filename)}`;
}

export function validateAttachmentMetadata(file: { name: string; type: string; size: number }): string | null {
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_ATTACHMENT_BYTES) return "File is too large. Maximum size is 6 MB.";
  const extension = extensionOf(file.name);
  const acceptedMimes = mimeByExtension[extension];
  if (!acceptedMimes || !acceptedMimes.includes(file.type.toLowerCase())) return "This file type is not supported.";
  return null;
}

export function attachmentContentType(file: { name: string; type: string }) {
  return file.type || mimeByExtension[extensionOf(file.name)]?.[0] || "application/octet-stream";
}

export async function validateAttachmentContents(file: File): Promise<string | null> {
  const metadataError = validateAttachmentMetadata(file);
  if (metadataError) return metadataError;
  const extension = extensionOf(file.name);
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const begins = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const ascii = new TextDecoder().decode(bytes);
  const valid = extension === "jpg" || extension === "jpeg" ? begins(0xff, 0xd8, 0xff)
    : extension === "png" ? begins(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    : extension === "webp" ? ascii.slice(0, 4) === "RIFF" && ascii.slice(8, 12) === "WEBP"
    : extension === "gif" ? ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")
    : extension === "pdf" ? ascii.startsWith("%PDF-")
    : ["docx", "xlsx", "zip"].includes(extension) ? begins(0x50, 0x4b)
    : ["doc", "xls"].includes(extension) ? begins(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
    : ["txt", "csv"].includes(extension) ? !bytes.includes(0) : false;
  return valid ? null : "The file contents do not match the selected file type.";
}

export function attachmentKind(mimeType: string | null, filename: string) {
  if (mimeType?.startsWith("image/")) return "image";
  const extension = extensionOf(filename);
  if (extension === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(extension)) return "spreadsheet";
  if (extension === "zip") return "archive";
  if (extension === "txt") return "text";
  return "document";
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isAttachmentEntityType(value: string): value is AttachmentEntityType {
  return attachmentEntityTypes.includes(value as AttachmentEntityType);
}
