/** How long the address of the file is kept after the click: a browser reads it in its own time, Safari the latest. */
const KEEP_ADDRESS_MS = 10_000;

/**
 * Hands `text` to the person as a file to keep (a download named `name`). The link is clicked inside `host`, which must be part of
 * what the person can reach: under a modal dialog the rest of the page is inert, and a link there is not followed.
 */
export function saveTextFile(host: HTMLElement, name: string, text: string, type: string): void {
  const address = URL.createObjectURL(new Blob([text], { type }));
  const link = host.ownerDocument.createElement('a');
  link.href = address;
  link.download = name;
  link.hidden = true;
  host.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(address);
  }, KEEP_ADDRESS_MS);
}
