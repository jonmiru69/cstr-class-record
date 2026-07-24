# CSTR Class Record

A static, client-side class-record web application for Colegio de Sto. Tomas - Recoletos, Incorporated, San Carlos City, Negros Occidental. It is designed for the single owner named in the app and displays this label exactly: **Website for Class Record, with respect to DepEd Order No. 15, s. 2026.** The app does not add or interpret details about that order.

## What is included

- Password convenience gate using `harty342002` (case-sensitive) with login state held in `sessionStorage`.
- Seven class records, each with a 42-row blank roster, independent grading periods, HPS fields, learner scores, and grade calculations.
- JHS weights of 30 / 40 / 30 and SHS weights of 20 / 50 / 30.
- Written Work (10 slots), Performance Task (8 slots), and Quarterly Assessment (ST1, ST2, Term Exam) score sheets.
- Quarterly Assessment intra-weights of 30% / 30% / 40%. If only some QA slots are filled, the active intra-weights are normalized so blank slots do not lower a learner's result.
- A persistent Save Changes button that writes the complete state - including roster, scores, periods, and compressed teacher photo - to one GitHub Gist JSON file.

The password gate is intentionally only a convenience for a single-owner static site. It is **not** real security: people who can inspect the page source can find the client-side check.

## Use locally

Open `index.html` in a modern browser. For the most reliable local testing, serve the folder with any basic static-file server. There is no build step, framework, package install, or secret in the source.

## GitHub Gist setup

1. Create a GitHub account if you do not already have one.
2. Create a **secret Gist** with a single file named `cstr-class-record-data.json` containing `{}`.
3. Copy the Gist ID from its URL.
4. Create a fine-grained GitHub Personal Access Token with only the minimum Gist read/write permission. Do not use a broader repository token.
5. Open the app, log in, choose **Settings**, then enter the Gist ID and Personal Access Token.
6. Select **Save credentials**. They are stored only in that browser's `localStorage`.
7. Press **Save Changes** whenever you want to send the latest complete state to the Gist. The yellow status means saving, blue means saved, and red means an error with its raw response for troubleshooting.

To use the same data on another device, enter the same Gist ID and PAT in Settings on that device and select **Load saved data**. A static site cannot provide automatic credential-free cross-device sync without a backend, so this device-level setup is required.

## Publish to GitHub Pages

1. Create a new GitHub repository and copy the contents of this folder to its root, preserving the file structure.
2. Commit and push the files to the `main` branch. Never commit your PAT; the app prompts for it at runtime and does not contain one.
3. In the repository, open **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main`, and choose `/ (root)`.
5. Save. GitHub will display the public Pages URL after deployment.

## Grading behavior

`assets/js/grading-engine.js` is a DOM-free module that can be tested independently. It keeps calculations at full precision and rounds only for display:

- Percentage Score and Weighted Score: two decimal places.
- Initial Grade: standard half-up rounding to a whole number, implemented through `roundHalfUp` and `FINAL_GRADE_DECIMALS` so it is easy to change later.
- Empty scores or an HPS total of zero show `-` in the interface, never `NaN` or `Infinity`.
- A raw score higher than its HPS remains visible and is flagged with a pastel-red border so it can be corrected; it is never silently clamped.

The engine's built-in `workedExample()` reproduces the required JHS check: 80.00 / 24.00 for Written Work, 90.00 / 36.00 for Performance Task, 86.00 / 25.80 for Quarterly Assessment, and a final Initial Grade of 86.

## Notes on source assumptions

- All Grade 8 Science records use pastel yellow, Grade 9 Research uses pastel red, and SHS records use pastel blue.
- SHS roster capacity is set to 42.
- The Grade 11 Our Lady of Consolacion class is shown as **Physics 1 & General Science 11**, following the supplied assumption that both are tracked in that class record.
- Uploaded PNG/JPEG portraits are resized to a maximum long edge of about 500px, encoded as a data URI, and stored in the same Gist state.
