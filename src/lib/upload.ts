import { getToken } from './auth';
import { ApiError, BASE } from './api';

export type UploadResult = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes: number;
  resourceType: string;
  mimetype: string;
  filename: string;
};

type JsonResponse =
  | { success: true; data: UploadResult }
  | { success: false; error: { code: string; message: string } };

/**
 * Upload one media file via the backend's `POST /api/v1/uploads` endpoint (Cloudinary
 * under the hood). Returns the public URL plus a bit of metadata.
 *
 * Pass `onProgress` to receive real upload progress (0-100). Uses XHR when provided
 * so the browser's upload stream fires progress events; falls back to fetch otherwise.
 */
export async function uploadMedia(
  file: File,
  options: {
    folder?: string;
    onProgress?: (pct: number) => void;
    purpose?: 'listing-gallery' | 'listing-description';
    /** Hit the retailer media endpoint so the upload is recorded in the library. */
    recordToLibrary?: boolean;
  } = {},
): Promise<UploadResult> {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
  const params = new URLSearchParams();
  if (options.folder) params.set('folder', options.folder);
  if (options.purpose) params.set('purpose', options.purpose);
  const qs = params.toString() ? `?${params}` : '';
  // Retailer media library records the asset; generic /uploads is fire-and-forget.
  const url = `${BASE}${options.recordToLibrary ? '/retailer/media' : '/uploads'}${qs}`;

  if (options.onProgress) {
    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) options.onProgress!(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        let json: JsonResponse;
        try {
          json = JSON.parse(xhr.responseText) as JsonResponse;
        } catch {
          reject(new ApiError(xhr.status, 'invalid_response', `Upload failed (HTTP ${xhr.status})`));
          return;
        }
        if (!json.success) {
          reject(new ApiError(xhr.status, json.error.code, json.error.message));
          return;
        }
        resolve(json.data);
      });
      xhr.addEventListener('error', () => reject(new ApiError(0, 'network_error', 'Upload failed')));
      xhr.open('POST', url);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(fd);
    });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  let json: JsonResponse;
  try {
    json = await res.json() as JsonResponse;
  } catch {
    throw new ApiError(res.status, 'invalid_response', `Upload failed (HTTP ${res.status})`);
  }
  if (!json.success) {
    throw new ApiError(res.status, json.error.code, json.error.message);
  }
  return json.data;
}
