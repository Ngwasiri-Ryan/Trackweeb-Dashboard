export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchBlob(_path: string): Promise<Blob> {
  throw new ApiError("Use barcode helpers instead of fetchBlob", 501);
}

export async function fetchText(_path: string): Promise<string> {
  throw new ApiError("Use receipt helpers instead of fetchText", 501);
}
