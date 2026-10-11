/**
 * Evaluates whether a generator string indicates an AI tool.
 * @param {string} str 
 * @returns {boolean}
 */
export function isAiGeneratorString(str) {
  if (!str) return false;
  const lowerStr = str.toLowerCase();
  
  const keywords = [
    'midjourney',
    'dall-e',
    'dalle',
    'openai',
    'firefly',
    'stable diffusion',
    'stability.ai',
    'dreamstudio',
    'leonardo.ai'
  ];
  
  for (const keyword of keywords) {
    if (lowerStr.includes(keyword)) {
      return true;
    }
  }
  
  if (/\bai\b/i.test(str)) {
    return true;
  }
  
  return false;
}

/**
 * Evaluates whether a C2PA action and its digitalSourceType indicate AI generation.
 * @param {string} actionName 
 * @param {string} digitalSourceType 
 * @returns {boolean}
 */
export function isAiAction(actionName, digitalSourceType) {
  const act = (actionName || '').toLowerCase();
  const source = (digitalSourceType || '').toLowerCase();
  
  if (act.includes('generated') || act.includes('synthetic')) {
    return true;
  }
  
  if (source.includes('trainedalgorithmicmedia')) {
    return true;
  }
  
  return false;
}
