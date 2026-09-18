import { readMetadata } from './readMetadata';

/**
 * Known AI-generation software identifiers (lowercase for matching).
 */
const KNOWN_AI_SOFTWARE_TAGS = [
  'midjourney', 'stable diffusion', 'dall-e', 'dalle',
  'firefly', 'runway', 'leonardo.ai', 'ideogram',
  'nightcafe', 'playground ai', 'bing image creator',
  'imagen', 'dreamstudio', 'stability ai', 'openai',
  'copilot designer', 'craiyon', 'starryai',
];

/** Cached C2PA instance — singleton, reused across calls. */
let c2paInstance = null;

async function getC2pa() {
  if (!c2paInstance) {
    const { createC2pa } = await import('@contentauth/c2pa-web/inline');
    c2paInstance = await createC2pa();
  }
  return c2paInstance;
}

/**
 * Check for C2PA Content Credentials in an image file.
 * @param {File} file
 * @returns {Promise<Object|null>} credential info or null if no C2PA manifest found
 */
export async function checkC2PA(file) {
  try {
    const { Reader } = await import('@contentauth/c2pa-web/inline');
    const c2pa = await getC2pa();
    const reader = await Reader.fromBlob(c2pa, file.type, file);

    if (!reader) return null;

    const manifest = await reader.activeManifest();
    if (!manifest) {
      reader.free();
      return null;
    }

    // Extract claim generator info
    const generatorInfo = manifest.claim_generator_info || [];
    const generatorNames = generatorInfo.map((g) => g.name).filter(Boolean);
    const generator =
      generatorNames.length > 0
        ? generatorNames.join(', ')
        : manifest.claim_generator || 'Unknown generator';

    // Extract signature info
    const sigInfo = manifest.signature_info || {};

    // Extract assertions
    const assertions = (manifest.assertions || []).map((a) => ({
      label: a.label,
      data: a.data,
      kind: a.kind,
    }));

    // Extract ingredients
    const ingredients = (manifest.ingredients || []).map((ing) => ({
      title: ing.title,
      format: ing.format,
      relationship: ing.relationship,
    }));

    reader.free();

    return {
      verified: true,
      issuer: sigInfo.issuer || sigInfo.common_name || 'Unknown issuer',
      generator,
      generatorInfo,
      signingAlg: sigInfo.alg || null,
      signedAt: sigInfo.time || null,
      assertions,
      ingredients,
      title: manifest.title || null,
      claimVersion: manifest.claim_version || null,
    };
  } catch (err) {
    console.warn('C2PA check failed:', err);
    return null;
  }
}

/**
 * Check EXIF software tags for known AI generator names.
 * @param {File} file
 * @returns {Promise<Object|null>} matched tag info or null
 */
export async function checkSoftwareTags(file) {
  try {
    const metadata = await readMetadata(file);
    const fields = [
      metadata.Software,
      metadata.Producer,
      metadata.Creator,
    ].filter(Boolean);

    const combined = fields.join(' ').toLowerCase();
    const match = KNOWN_AI_SOFTWARE_TAGS.find((tag) => combined.includes(tag));

    return match
      ? { tag: match, raw: fields.join(', ') }
      : null;
  } catch {
    return null;
  }
}

export async function detectAI(file) {
  // Step 1: C2PA credentials
  const c2paResult = await checkC2PA(file);
  if (c2paResult) {
    // Determine if it's explicitly AI
    let isAi = false;

    // Check assertions for AI digitalSourceType
    for (const assertion of c2paResult.assertions) {
      if (assertion.label === 'c2pa.actions' && assertion.data?.actions) {
        for (const action of assertion.data.actions) {
          const dst = action.parameters?.digitalSourceType;
          if (
            dst &&
            (dst.includes('trainedAlgorithmicMedia') || dst.includes('compositeWithTrainedAlgorithmicMedia'))
          ) {
            isAi = true;
          }
        }
      }
    }

    // Also check if generator name is a known AI generator as fallback
    if (!isAi) {
      const combinedGenerator = c2paResult.generator.toLowerCase();
      if (KNOWN_AI_SOFTWARE_TAGS.some((tag) => combinedGenerator.includes(tag))) {
        isAi = true;
      }
    }

    if (isAi) {
      return { verdict: 'verified-ai', ...c2paResult };
    } else {
      return { verdict: 'verified-provenance', ...c2paResult };
    }
  }

  // Step 2: Software tag heuristic (weaker signal)
  const softwareMatch = await checkSoftwareTags(file);
  if (softwareMatch) {
    return { verdict: 'possible', ...softwareMatch };
  }

  // Step 3: No signal found
  return { verdict: 'inconclusive' };
}
