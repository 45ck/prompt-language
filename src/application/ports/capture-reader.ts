/**
 * CaptureReader — port for reading/clearing captured variable responses.
 *
 * The plugin instructs Claude to write responses to files under
 * `.prompt-language/vars/`. This port abstracts the file I/O.
 */

export interface CaptureReader {
  /** Read the captured value for a variable. Returns null if not found or empty. */
  read(varName: string): Promise<string | null>;

  /** Clear (delete) the capture file for a variable. */
  clear(varName: string): Promise<void>;
}
