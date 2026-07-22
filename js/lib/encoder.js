/** Browser JPEG encoder — mozjpeg WASM with canvas fallback. */

const MOZ_OPTS = {
  baseline: false,
  progressive: true,
  quant_table: 2,
  trellis_multipass: true,
  separate_chroma_quality: true,
};

let encodeFn = null;
let loadPromise = null;

export async function initEncoder() {
  if (encodeFn) return encodeFn;
  if (window.__mozEncodeReady) {
    encodeFn = window.__mozEncodeReady;
    return encodeFn;
  }
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const done = (fn) => {
      encodeFn = fn;
      resolve(fn);
    };
    const timer = setTimeout(() => reject(new Error("mozjpeg load timeout")), 30000);
    window.addEventListener(
      "mozjpeg-ready",
      () => {
        clearTimeout(timer);
        if (window.__mozEncodeReady) done(window.__mozEncodeReady);
        else reject(new Error("mozjpeg not ready"));
      },
      { once: true }
    );
    import("/vendor/mozjpeg.mjs").then((m) => {
      clearTimeout(timer);
      done(m.encodeImageData);
    }).catch(reject);
  });
  return loadPromise;
}

function imageDataFrom(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export async function encodeStudio(canvas, quality, minQ = 18) {
  const encode = await initEncoder();
  const q = Math.max(minQ, Math.min(100, Math.round(quality)));
  return encode(imageDataFrom(canvas), {
    ...MOZ_OPTS,
    quality: q,
    chroma_quality: Math.max(18, Math.round(q * 0.62)),
  });
}

export async function encodeFramed(canvas, quality, minQ = 28) {
  const q = Math.max(minQ, Math.min(98, Math.round(quality)));
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || new Blob()), "image/jpeg", q / 100);
  });
}

export async function compressStudioToKb(canvas, targetKb, whiteRatio = 0.7) {
  const targetBytes = targetKb * 1024;
  const minQ = whiteRatio >= 0.72 ? 18 : whiteRatio >= 0.55 ? 22 : 26;
  let lo = minQ;
  let hi = 92;
  let best = await encodeStudio(canvas, minQ, minQ);
  if (best.size <= targetBytes) {
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      const blob = await encodeStudio(canvas, mid, minQ);
      if (blob.size <= targetBytes) {
        best = blob;
        lo = mid;
      } else hi = mid;
    }
    const top = await encodeStudio(canvas, lo, minQ);
    if (top.size <= targetBytes) return top;
  }
  for (let q = minQ - 1; q >= 14 && best.size > targetBytes; q--) {
    const blob = await encodeStudio(canvas, q, 14);
    if (blob.size <= targetBytes) return blob;
    if (blob.size < best.size) best = blob;
  }
  return best;
}

export async function compressFramedToKb(canvas, targetKb) {
  const targetBytes = targetKb * 1024;
  let lo = 28;
  let hi = 98;
  let best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const blob = await encodeFramed(canvas, mid);
    if (blob.size <= targetBytes) {
      best = blob;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (best) return best;
  return encodeFramed(canvas, 28);
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
