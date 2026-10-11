import { describe, it, expect } from 'vitest';
import { isAiGeneratorString, isAiAction } from '../c2paSignals';

describe('c2paSignals', () => {
  describe('isAiGeneratorString', () => {
    it('should match AI keywords', () => {
      expect(isAiGeneratorString('Midjourney')).toBe(true);
      expect(isAiGeneratorString('Adobe Firefly')).toBe(true);
      expect(isAiGeneratorString('AI Image Studio')).toBe(true);
      expect(isAiGeneratorString('DALL-E')).toBe(true);
      expect(isAiGeneratorString('Stable Diffusion')).toBe(true);
    });

    it('should NOT match unrelated software', () => {
      expect(isAiGeneratorString('Adobe Photoshop')).toBe(false);
      expect(isAiGeneratorString('Microsoft Paint')).toBe(false);
      expect(isAiGeneratorString('Gaia GPS')).toBe(false);
      expect(isAiGeneratorString('Canon EOS R5')).toBe(false);
      expect(isAiGeneratorString('Gained insights')).toBe(false); // 'ai' substring
      expect(isAiGeneratorString('Painting')).toBe(false); // 'ai' substring
    });
  });

  describe('isAiAction', () => {
    it('should match AI actions and source types', () => {
      expect(isAiAction('c2pa.generated', '')).toBe(true);
      expect(isAiAction('synthetic data', '')).toBe(true);
      expect(isAiAction('', 'cv:trainedAlgorithmicMedia')).toBe(true);
      expect(isAiAction('c2pa.created', 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia')).toBe(true);
    });

    it('should NOT match unrelated actions', () => {
      expect(isAiAction('c2pa.edited', '')).toBe(false);
      expect(isAiAction('c2pa.cropped', '')).toBe(false);
      expect(isAiAction('painted', '')).toBe(false);
      expect(isAiAction('', 'someOtherSource')).toBe(false);
    });
  });
});
