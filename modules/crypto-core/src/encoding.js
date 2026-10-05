/**
 * Byte / base64 / UTF-8 helpers.
 *
 * Base64 here is standard RFC 4648 (`+/`, padded) — what `btoa` and Python's
 * `base64.b64encode` produce, so Backend can decode it without surprises.
 */
import { CryptoCoreError, ErrorCodes } from './errors.js';

const CHUNK = 0x8000; // keeps String.fromCharCode.apply under arg-count limits
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/** Normalise ArrayBuffer / TypedArray / DataView to a Uint8Array view (no copy). */
export function toBytes(input, label = 'input') {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new CryptoCoreError(
    ErrorCodes.INVALID_INPUT,
    `${label} must be an ArrayBuffer, TypedArray or DataView.`,
  );
}

/** Like toBytes, but also accepts Blob/File (e.g. from <input type="file">). */
export async function readBytes(input, label = 'input') {
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  return toBytes(input, label);
}

export function bytesToBase64(input) {
  const bytes = toBytes(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(value, label = 'value') {
  if (typeof value !== 'string') {
    throw new CryptoCoreError(ErrorCodes.INVALID_BASE64, `${label} must be a base64 string.`);
  }
  const clean = value.replace(/\s+/g, '');
  if (clean.length % 4 !== 0 || !BASE64_RE.test(clean)) {
    throw new CryptoCoreError(ErrorCodes.INVALID_BASE64, `${label} is not valid base64.`);
  }
  let binary;
  try {
    binary = atob(clean);
  } catch (cause) {
    throw new CryptoCoreError(ErrorCodes.INVALID_BASE64, `${label} is not valid base64.`, { cause });
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Accept either a base64 string or raw bytes. */
export function bytesOrBase64(input, label) {
  return typeof input === 'string' ? base64ToBytes(input, label) : toBytes(input, label);
}

export function utf8Encode(text) {
  return new TextEncoder().encode(text);
}

export function utf8Decode(bytes) {
  return new TextDecoder().decode(toBytes(bytes));
}

export function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function bytesToHex(input) {
  return Array.from(toBytes(input), (b) => b.toString(16).padStart(2, '0')).join('');
}
