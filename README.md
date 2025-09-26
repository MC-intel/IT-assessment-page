# Golf Club Cybersecurity Assessment

This project contains the interactive cybersecurity assessment used on the Pearl Solutions Group landing page. It includes the HTML experience (`index.html`), a pre-built PDF background template, and a standalone JavaScript file (`assessment.js`) that replicates the inline script logic with HubSpot form submission support.

## Using the Script on Other Platforms (e.g., WordPress)

The `assessment.js` file is designed so you can either load it as an external script or paste its contents directly into an inline `<script>` block. When copying it into another platform:

1. **Ensure the markup matches** the IDs and class names that the script expects (for example `#assessmentForm`, `.calculate-btn`, `.save-pdf-btn`, etc.).
2. **Include the PDF-LIB dependency** somewhere before the assessment script runs:
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js" defer></script>
   ```
3. **Add the assessment logic** either by linking to `assessment.js` or pasting its contents in a `<script defer>` tag. The script now auto-initializes immediately if the DOM is already ready, so it works whether it is loaded in the `<head>`, footer, or injected dynamically.
4. (Optional) Call `PearlAssessment.init()` manually if you inject the assessment markup after the script has already run.

The script exposes `calculateScore` and `saveToPDF` on `window` for backwards compatibility with the original inline button handlers, and it submits assessment details to HubSpot before generating the PDF.

## Repository Contents

- `index.html` – reference implementation of the assessment page.
- `assessment.js` – standalone JavaScript module with HubSpot integration.
- `golf-assessment-results-background.pdf` – PDF template used when exporting results.

## Development Notes

No build tooling is required; open `index.html` in a browser to test locally. The HubSpot endpoint will log errors to the console if submission fails.
