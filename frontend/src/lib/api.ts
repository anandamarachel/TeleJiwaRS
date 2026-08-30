const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function getWebSocketUrl(path: string): string {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const url = new URL(path, API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

function getErrorDetail(errorBody: unknown, fallback: string): string {
  if (!errorBody || typeof errorBody !== "object" || !("detail" in errorBody)) {
    return fallback;
  }

  const detail = errorBody.detail;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") {
          return item.msg;
        }
        return null;
      })
      .filter((message): message is string => message !== null);

    if (messages.length > 0) return messages.join(". ");
  }

  return fallback;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let detail = "Terjadi kesalahan. Silakan coba lagi.";
    try {
      const errorBody: unknown = await response.json();
      detail = getErrorDetail(errorBody, detail);
    } catch {
      // response body wasn't JSON, keep the default message
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include" });

  if (!response.ok) {
    let detail = "File tidak dapat dimuat.";
    try {
      const errorBody: unknown = await response.json();
      detail = getErrorDetail(errorBody, detail);
    } catch {
      // Keep the default message for non-JSON failures.
    }
    throw new ApiError(response.status, detail);
  }

  return response.blob();
}
