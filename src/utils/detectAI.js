import { readMetadata } from './readMetadata';
import { VERDICTS } from './verdicts';

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

/** Cached C2PA promise singleton, reused across calls to prevent concurrent worker spawn */
let c2paPromise = null;

async function getC2pa() {
  if (!c2paPromise) {
    c2paPromise = (async () => {
      const { createC2pa } = await import('@contentauth/c2pa-web/inline');
      return await createC2pa();
    })().catch((err) => {
      c2paPromise = null;
      throw err;
    });
  }
  return c2paPromise;
}

/**
 * Determine whether the validation state from the C2PA library
 * establishes sufficient trust for a "verified" claim.
 *
 * Only "Valid" or "Trusted" states are considered verified.
 * "Invalid", null, undefined, or any unknown value is treated as unverified.
 *
 * @param {string|null|undefined} validationState
 * @returns {boolean}
 */
export function isValidationVerified(validationState) {
  return validationState === 'Valid' || validationState === 'Trusted';
}

/**
 * Pure function implementing the verdict state machine according to the semantic model:
 *
 * Case A — No provenance:
 *   If software tag matches: 'possible'
 *   Otherwise: 'inconclusive'
 * Case B — Manifest exists but validation is 'Invalid':
 *   'inconclusive' (no verified claim)
 * Case C — Manifest exists, validation is 'Valid' or 'Trusted', and AI marker found:
 *   'verified-ai'
 * Case D — Manifest exists, validation is 'Valid' or 'Trusted', and no AI marker:
 *   'verified-provenance'
 * Case E — Manifest exists, but validation state is null/undefined or unknown:
 *   'inconclusive' (no verified claim)
 *
 * @param {Object} params
 * @param {boolean} params.hasManifest
 * @param {string|null|undefined} params.validationState
 * @param {boolean} [params.hasAiMarker]
 * @param {boolean} [params.hasSoftwareTag]
 * @returns {string} verdict string from VERDICTS
 */
export function determineVerdict({
  hasManifest,
  validationState,
  hasAiMarker = false,
  hasSoftwareTag = false,
}) {
  if (!hasManifest) {
    return hasSoftwareTag ? VERDICTS.POSSIBLE : VERDICTS.INCONCLUSIVE;
  }

  const isVerified = isValidationVerified(validationState);
  if (!isVerified) {
    return VERDICTS.INCONCLUSIVE;
  }

  return hasAiMarker ? VERDICTS.VERIFIED_AI : VERDICTS.VERIFIED_PROVENANCE;
}

/**
 * Check for C2PA Content Credentials in an image file.
 * Uses reader.manifestStore() to retrieve the full manifest store
 * including validation state.
 *
 * @param {File} file
 * @returns {Promise<Object|null>} credential info or null if no C2PA manifest found
 */
async function checkC2PA(file) {
  try {
    const { Reader } = await import('@contentauth/c2pa-web/inline');
    const c2pa = await getC2pa();
    const reader = await Reader.fromBlob(c2pa, file.type, file);

    if (!reader) return null;

    // Use manifestStore() to get full store including validation information
    let store;
    try {
      store = await reader.manifestStore();
    } catch {
      // Fallback: if manifestStore() fails, try activeManifest() directly
      const manifest = await reader.activeManifest();
      if (!manifest) {
        reader.free();
        return null;
      }
      reader.free();
      return extractManifestInfo(manifest, null);
    }

    if (!store) {
      reader.free();
      return null;
    }

    // Retrieve the active manifest from the store
    const activeLabel = store.active_manifest;
    const manifests = store.manifests || {};
    const manifest = activeLabel ? manifests[activeLabel] : null;

    if (!manifest) {
      reader.free();
      return null;
    }

    // Read validation state from the manifest store
    // The c2pa-types define: validation_state?: "Invalid" | "Valid" | "Trusted" | null
    const validationState = store.validation_state || null;

    reader.free();
    return extractManifestInfo(manifest, validationState);
  } catch (err) {
    console.warn('C2PA check failed:', err);
    return null;
  }
}

/**
 * Extract structured info from a C2PA manifest.
 * @param {Object} manifest
 * @param {string|null} validationState
 * @returns {Object}
 */
function extractManifestInfo(manifest, validationState) {
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

  return {
    issuer: sigInfo.issuer || sigInfo.common_name || 'Unknown issuer',
    generator,
    generatorInfo,
    signingAlg: sigInfo.alg || null,
    signedAt: sigInfo.time || null,
    assertions,
    ingredients,
    title: manifest.title || null,
    claimVersion: manifest.claim_version || null,
    validationState,
  };
}

/**
 * Check EXIF software tags for known AI generator names.
 * @param {File} file
 * @returns {Promise<Object|null>} matched tag info or null
 */
async function checkSoftwareTags(file) {
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

/**
 * Detect whether an image was AI-generated using metadata-based heuristics.
 *
 * Detection hierarchy:
 * 1. C2PA Content Credentials (strongest signal)
 * 2. EXIF software tag matching (weaker, spoofable signal)
 * 3. No signal found
 *
 * Validation state gating:
 * - Only claims "verified-ai" or "verified-provenance" when the C2PA library
 *   reports validation_state as "Valid" or "Trusted".
 * - If validation is "Invalid", null, or unavailable, downgrades to "inconclusive"
 *   even if a manifest is present — we cannot cryptographically confirm the credential.
 *
 * @param {File} file
 * @returns {Promise<Object>} result with verdict and optional metadata
 */
/**
 * Wrapper with timeout to prevent the UI from hanging if C2PA WASM
 * initialization takes too long or fails silently.
 */
async function checkC2PAWithTimeout(file, ms = 5000) {
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      console.warn(`C2PA check timed out after ${ms}ms for ${file.name}`);
      resolve(null);
    }, ms);
  });

  try {
    const result = await Promise.race([checkC2PA(file), timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

export async function detectAI(file) {
  console.log('[PixelTruth] detectAI started for:', file.name);
  // Step 1: C2PA credentials
  let c2paResult = null;
  try {
    c2paResult = await checkC2PAWithTimeout(file);
    console.log('[PixelTruth] C2PA check result:', c2paResult);
  } catch (err) {
    console.warn('[PixelTruth] C2PA check exception:', err);
  }
  if (c2paResult) {
    const validated = isValidationVerified(c2paResult.validationState);

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

    const verdict = determineVerdict({
      hasManifest: true,
      validationState: c2paResult.validationState,
      hasAiMarker: isAi,
    });

    // Gate on validation state: only claim verified if SDK confirms validity
    if (!validated) {
      // Manifest found but validation not established — downgrade
      return {
        verdict,
        ...c2paResult,
        validationNote: c2paResult.validationState === 'Invalid'
          ? 'Credential found but validation state is "Invalid" (cryptographic verification failed).'
          : (c2paResult.validationState
              ? `Credential found but validation state is "${c2paResult.validationState}".`
              : 'Credential found but validation could not be cryptographically established.'),
      };
    }

    return { verdict, ...c2paResult };
  }

  // Step 2: Software tag heuristic (weaker signal)
  const softwareMatch = await checkSoftwareTags(file);
  if (softwareMatch) {
    return { verdict: VERDICTS.POSSIBLE, ...softwareMatch };
  }

  // Step 3: No signal found
  return { verdict: VERDICTS.INCONCLUSIVE };
}
