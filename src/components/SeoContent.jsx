export default function SeoContent() {
  return (
    <section className="mt-16 pt-12 border-t border-ink-200 dark:border-ink-800 space-y-12 text-ink-700 dark:text-ink-300">
      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 flex items-center gap-2">
            <span className="text-safelight-500">📷</span> What is EXIF Metadata?
          </h2>
          <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-400">
            EXIF (Exchangeable Image File Format) is metadata silently embedded inside digital photos
            by cameras, smartphones, and editing software. Whenever you snap a picture, your phone
            records exact GPS coordinates, camera serial numbers, exposure settings, device model,
            and precise timestamps into the image file.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 flex items-center gap-2">
            <span className="text-safelight-500">🛡️</span> Why Remove Metadata?
          </h2>
          <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-400">
            Sharing photos on forums, social networks, or marketplaces can unintentionally expose your
            home address, workplace, and daily routines through embedded GPS coordinates. Stripping
            metadata protects your physical privacy, stops equipment profiling, and eliminates
            hidden uncropped thumbnail previews.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 flex items-center gap-2">
          <span className="text-safelight-500">⚡</span> How to Remove Metadata with PixelTruth
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-ink-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800">
            <div className="text-safelight-600 dark:text-safelight-400 font-bold text-sm mb-1">Step 1</div>
            <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm mb-1">Select Images</h3>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              Drag and drop up to 20 images or browse your files. Paste from clipboard with Ctrl+V.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-ink-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800">
            <div className="text-safelight-600 dark:text-safelight-400 font-bold text-sm mb-1">Step 2</div>
            <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm mb-1">Inspect Tags</h3>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              Select any photo in the filmstrip to inspect all embedded tags with live search and filtering.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-ink-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800">
            <div className="text-safelight-600 dark:text-safelight-400 font-bold text-sm mb-1">Step 3</div>
            <h3 className="font-semibold text-ink-900 dark:text-ink-100 text-sm mb-1">Strip & Download</h3>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              Click &ldquo;Clean All&rdquo; to download a clean ZIP, or remove EXIF and save images individually.
            </p>
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 flex items-center gap-2">
          <span className="text-safelight-500">⚖️</span> Removed vs. Preserved Metadata
        </h2>
        <div className="overflow-x-auto frame">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-ink-200 dark:border-ink-800 bg-ink-100/50 dark:bg-ink-900/50">
                <th className="text-left p-3 font-semibold text-ink-700 dark:text-ink-300">Data Field</th>
                <th className="text-left p-3 font-semibold text-ink-700 dark:text-ink-300">Status</th>
                <th className="text-left p-3 font-semibold text-ink-700 dark:text-ink-300">Purpose / Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
              <tr>
                <td className="p-3 font-mono font-medium">GPS Latitude, Longitude, Altitude</td>
                <td className="p-3 text-red-600 dark:text-red-400 font-bold">Removed</td>
                <td className="p-3 text-ink-500 dark:text-ink-400">Prevents tracking your home address, routes, and travel locations.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-medium">Make, Model, Lens, Serial Numbers</td>
                <td className="p-3 text-red-600 dark:text-red-400 font-bold">Removed</td>
                <td className="p-3 text-ink-500 dark:text-ink-400">Stops device fingerprinting and camera hardware profiling.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-medium">Date & Time Created / Digitized</td>
                <td className="p-3 text-red-600 dark:text-red-400 font-bold">Removed</td>
                <td className="p-3 text-ink-500 dark:text-ink-400">Eliminates timestamps that reveal schedules and activity habits.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-medium">Artist, Copyright, Owner, Comments</td>
                <td className="p-3 text-red-600 dark:text-red-400 font-bold">Removed</td>
                <td className="p-3 text-ink-500 dark:text-ink-400">Cleans personal names, usernames, and computer software tags.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-medium">Embedded Thumbnails (IFD1)</td>
                <td className="p-3 text-red-600 dark:text-red-400 font-bold">Removed</td>
                <td className="p-3 text-ink-500 dark:text-ink-400">Erases hidden uncropped camera previews that may show deleted image content.</td>
              </tr>
              <tr className="bg-safelight-50/30 dark:bg-safelight-950/20">
                <td className="p-3 font-mono font-medium text-safelight-700 dark:text-safelight-300">Orientation (0x0112)</td>
                <td className="p-3 text-emerald-600 dark:text-emerald-400 font-bold">Preserved</td>
                <td className="p-3 text-ink-600 dark:text-ink-400">Guarantees portrait and landscape photos stay right-side up without image distortion.</td>
              </tr>
              <tr className="bg-safelight-50/30 dark:bg-safelight-950/20">
                <td className="p-3 font-mono font-medium text-safelight-700 dark:text-safelight-300">ICC Color Profile (APP2)</td>
                <td className="p-3 text-emerald-600 dark:text-emerald-400 font-bold">Preserved (Default)</td>
                <td className="p-3 text-ink-600 dark:text-ink-400">Preserves Display P3 and wide-gamut colors so images don&rsquo;t look washed out. Removable via Full Sanitize.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Supported types & Privacy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 flex items-center gap-2">
            <span className="text-safelight-500">📁</span> Supported Formats
          </h2>
          <p className="text-sm text-ink-600 dark:text-ink-400">
            PixelTruth supports direct byte-level lossless metadata carving for:
          </p>
          <ul className="text-xs space-y-1.5 text-ink-600 dark:text-ink-400 list-disc list-inside">
            <li><strong className="text-ink-800 dark:text-ink-200">JPEG / JPG:</strong> Lossless APP marker carving, orientation preserved.</li>
            <li><strong className="text-ink-800 dark:text-ink-200">PNG:</strong> Lossless ancillary chunk carving (eXIf, tEXt, zTXt, iTXt).</li>
            <li><strong className="text-ink-800 dark:text-ink-200">WebP:</strong> Lossless RIFF container parsing and VP8X bitfield synchronization.</li>
            <li><strong className="text-ink-800 dark:text-ink-200">HEIC / HEIF:</strong> In-browser decode and conversion to clean JPEG.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 flex items-center gap-2">
            <span className="text-safelight-500">🔒</span> 100% Client-Side Privacy Guarantee
          </h2>
          <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-400">
            PixelTruth does not have a backend server or database. All image processing, binary carving,
            and ZIP compression run entirely in your browser using Web Workers and local memory.
            Your photos are never sent over the Internet.
          </p>
        </div>
      </div>
    </section>
  );
}
