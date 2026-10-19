// Minimal typing for the one Node API the model-loading tests use, so the project does not need
// @types/node just for `readFileSync`.
declare module "node:fs" {
  export function readFileSync(path: URL | string): Uint8Array & { buffer: ArrayBufferLike; byteOffset: number; byteLength: number };
}
