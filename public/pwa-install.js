/**
 * PixelTruth Early PWA Install Prompt Capture
 * Executes synchronously in <head> to capture beforeinstallprompt at the earliest
 * possible microsecond, ensuring 1-click native install is never missed.
 */
(function() {
  window.__pt_prompt = null;
  window.__pt_prompt_listeners = [];

  window.addEventListener('beforeinstallprompt', function(e) {
    // Prevent standard automatic mini-infobar on mobile so our dedicated 1-click button handles it
    e.preventDefault();
    window.__pt_prompt = e;
    for (let i = 0; i < window.__pt_prompt_listeners.length; i++) {
      try {
        window.__pt_prompt_listeners[i](e);
      } catch (err) {
        console.error('PWA prompt listener error:', err);
      }
    }
  });

  window.addEventListener('appinstalled', function() {
    window.__pt_prompt = null;
    window.__pt_is_installed = true;
    for (let i = 0; i < window.__pt_prompt_listeners.length; i++) {
      try {
        window.__pt_prompt_listeners[i](null);
      } catch (err) {
        console.error('PWA prompt listener error:', err);
      }
    }
  });
})();
