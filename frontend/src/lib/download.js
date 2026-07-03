import { axiosInstance } from '../App';

// Download a protected sample file through the authenticated API. Using axios
// (which attaches the JWT bearer token) makes downloads work even in
// cross-site deployments where third-party cookies are blocked.
export async function downloadSampleFile(pdfUrl, filename) {
  if (!pdfUrl) return;
  // pdfUrl looks like "/api/uploads/<file>"; axios baseURL already ends in /api.
  const path = pdfUrl.replace(/^\/api/, '');
  const res = await axiosInstance.get(path, { responseType: 'blob' });
  const objectUrl = window.URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename || 'sample';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}
