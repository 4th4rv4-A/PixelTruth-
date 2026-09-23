# Local Workspace

PixelTruth includes an optional, entirely browser-local workspace feature designed to let users retain their recent inspection results, forensic reports, and hashes without compromising the application's strict privacy model.

## Privacy Model
By default, **PixelTruth DOES NOT persist your original image files.**
When you save an inspection result to the workspace, the application stores only:
- The generated `Forensic Report` JSON payload.
- A highly compressed base64 thumbnail string for visual identification in the UI.

This data is stored in your browser's `IndexedDB`.
**It is never uploaded to any server, nor is it accessible outside of this specific browser on this specific device.**

## Managing Data
Because `IndexedDB` is subject to browser storage quotas, PixelTruth explicitly avoids storing massive uncompressed binary files.
However, you still have total control over this data:
- **Exporting**: You can export the raw JSON or view/print the HTML report of any saved case directly from the Workspace tab.
- **Deleting**: You can delete individual cases.
- **Clearing All**: A destructive "Clear Local Data" button allows you to instantly drop the entire `IndexedDB` database, completely wiping your workspace.

## Technical Details
- **Database Name:** `PixelTruthWorkspace`
- **Store Name:** `cases`
- **Architecture:** Zero-dependency native IndexedDB API wrapped in Promises (`src/services/storage/workspaceRepository.js`).
