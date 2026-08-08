/**
 * Stands in for `vite` when bundling the PC session's server for an image.
 *
 * server.ts imports `createServer` from vite at the top level to build its
 * dev-mode middleware, but only calls it when NODE_ENV is not production —
 * and eye-pc.service always sets production. A static import still forces the
 * bundler to resolve it, so this satisfies the import without dragging the
 * real thing in.
 *
 * That is worth doing for its own sake, not just for image size. Vite brings
 * a bundler, a transformer and (through lightningcss) native code — a full
 * build toolchain. Putting a compiler on a locked-down appliance hands
 * anything that gets code execution a way to build and load more, which is
 * exactly what the rest of this image is arranged to prevent.
 *
 * If it is ever reached, that means something booted the session in dev mode,
 * and failing loudly is better than quietly running a dev server on an
 * appliance.
 */
export function createServer() {
  throw new Error(
    'eYe OS: the vite dev server is not bundled into an image — ' +
      'eye-pc.service must run with NODE_ENV=production',
  );
}

export default { createServer };
