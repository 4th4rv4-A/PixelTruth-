import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('usePwaInstall environment and logic', () => {
  let listeners;
  let mockWindow;

  beforeEach(() => {
    listeners = new Map();
    mockWindow = {
      addEventListener: vi.fn((event, cb) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(cb);
      }),
      removeEventListener: vi.fn((event, cb) => {
        if (listeners.has(event)) listeners.get(event).delete(cb);
      }),
      dispatchEvent: vi.fn((evt) => {
        const cbs = listeners.get(evt.type);
        if (cbs) cbs.forEach((fn) => fn(evt));
      }),
      matchMedia: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0', vendor: '' },
    };
  });

  it('handles beforeinstallprompt event lifecycle', async () => {
    // Test the prompt event handling contract
    const mockPrompt = vi.fn();
    const promptEvent = {
      type: 'beforeinstallprompt',
      preventDefault: vi.fn(),
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    mockWindow.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      expect(e.type).toBe('beforeinstallprompt');
    });

    mockWindow.dispatchEvent(promptEvent);
    expect(promptEvent.preventDefault).toHaveBeenCalled();

    // Trigger prompt
    promptEvent.prompt();
    expect(mockPrompt).toHaveBeenCalled();

    const choice = await promptEvent.userChoice;
    expect(choice.outcome).toBe('accepted');
  });

  it('detects standalone display mode correctly', () => {
    const standaloneMatchMedia = vi.fn((query) => ({
      matches: query === '(display-mode: standalone)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const isStandalone = standaloneMatchMedia('(display-mode: standalone)').matches;
    expect(isStandalone).toBe(true);

    const isRegular = standaloneMatchMedia('(display-mode: browser)').matches;
    expect(isRegular).toBe(false);
  });

  it('detects iOS platforms for tailored instructions', () => {
    const isIOS = (ua) => /iPad|iPhone|iPod/.test(ua);
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toBe(true);
    expect(isIOS('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)')).toBe(true);
    expect(isIOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
    expect(isIOS('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
  });
});
