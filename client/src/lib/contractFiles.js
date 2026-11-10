import client from '../api/client.js';

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const filenameFrom = (headers, fallback) => {
  const match = /filename="?([^";]+)"?/i.exec(headers?.['content-disposition'] || '');
  return match ? match[1] : fallback;
};

// Details the lease doesn't have yet (they print as blank lines in the contract).
const missingFrom = (headers) =>
  decodeURIComponent(headers?.['x-missing-fields'] || '')
    .split('|')
    .filter(Boolean);

// The API answers errors as JSON, but when we ask for a blob axios hands the
// error body back as a Blob too, so read it before showing a message.
export async function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data;
  try {
    if (data instanceof Blob) {
      const parsed = JSON.parse(await data.text());
      return parsed?.error?.message || fallback;
    }
    return data?.error?.message || fallback;
  } catch {
    return fallback;
  }
}

// Ask the API for a PDF (with the login token). Returns the file and anything left blank.
export async function fetchPdf({ url, method = 'get', data, fallbackName = 'contract.pdf' }) {
  const res = await client.request({ url, method, data, responseType: 'blob' });
  return {
    blob: new Blob([res.data], { type: 'application/pdf' }),
    filename: filenameFrom(res.headers, fallbackName),
    missing: missingFrom(res.headers),
  };
}

// Fetch a PDF and save it to the device. Resolves with the list of blank details.
export async function downloadPdf(options) {
  const { blob, filename, missing } = await fetchPdf(options);
  saveBlob(blob, filename);
  return { missing };
}
