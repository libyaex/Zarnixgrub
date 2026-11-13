/**
 * Express 4 does not forward rejected promises from async handlers, so one
 * unexpected throw (network blip to Supabase) leaves the request hanging.
 * `protectRouter` wraps every handler registered on a router so rejections
 * reach the JSON error middleware instead.
 */
type Handler = (...args: any[]) => unknown;
interface LayerLike { handle: Handler; route?: { stack: LayerLike[] }; }

function wrap(fn: Handler): Handler {
  if (fn.length >= 4) return fn; // error-handling middleware: leave as is
  const wrapped: Handler = function (this: unknown, ...args: any[]) {
    const next = args[args.length - 1] as (e?: unknown) => void;
    try {
      const out = fn.apply(this, args);
      if (out && typeof (out as Promise<unknown>).catch === 'function') {
        (out as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
  return wrapped;
}

export function protectRouter<T extends { stack: LayerLike[] }>(router: T): T {
  for (const layer of router.stack) {
    if (layer.route) {
      for (const inner of layer.route.stack) inner.handle = wrap(inner.handle);
    } else {
      layer.handle = wrap(layer.handle);
    }
  }
  return router;
}
