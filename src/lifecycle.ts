export function bindPageLifecycle(target: EventTarget, handlers: { suspend(): void; resume(): void; dispose(): void }): void {
  target.addEventListener('pagehide', event => {
    handlers.suspend();
    if (!(event as PageTransitionEvent).persisted) handlers.dispose();
  });
  target.addEventListener('pageshow', event => {
    if ((event as PageTransitionEvent).persisted) handlers.resume();
  });
}
