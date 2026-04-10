/**
 * CaptureReader — port for reading/clearing captured variable responses.
 *
 * The plugin instructs Claude to write responses to files under
 * `.prompt-language/vars/`. This port abstracts the file I/O.
 */

export interface CaptureReader {
  /** Sentinel used to distinguish "no write yet" from empty capture content. */
  readonly PENDING_SENTINEL?: string;

  /** Read the captured value for a variable. Returns null if not found or empty. */
  read(varName: string): Promise<string | null>;

  /** Clear (delete) the capture file for a variable. */
  clear(varName: string): Promise<void>;

  /** Prime capture file with pending sentinel before emitting a capture prompt. */
  prime?(varName: string): Promise<void>;

  /** H-REL-005: Extract captured value from inline tags in text. Returns null if not found. */
  readFromText?(text: string, varName: string, nonce?: string): string | null;
}

export const CAPTURE_PENDING_SENTINEL = '__PENDING__';
