# Golf Club Cybersecurity Assessment

## Overview
This repository contains the golf-club focused cybersecurity self-assessment experience that powers the Pearl Solutions Group landing page. It ships with fully designed markup (`index.html`), a backend-ready variant (`wpBackend.html`), the standalone script that drives the scoring logic (`assessment.js`), and the branded PDF background used when exporting results. The assessment walks clubs through 13 tailored yes/no questions that are grouped by risk area and instantly produces a risk classification, narrative findings, and prioritized next steps. Personal information fields are required before the score can be calculated so that every result is associated with a contact record.

## Repository Contents
- `index.html` – Reference implementation with full styling, the personal information capture form, results panels, and CTA content designed for standalone hosting.
- `assessment.js` – Standalone JavaScript module that mirrors the inline logic, including field validation, risk scoring, PDF generation, and backend submission helpers.
- `wpBackend.html` – Turnkey HTML package (with inline styles and script) intended for platforms such as WordPress that need a self-contained drop-in page using the same backend services.
- `golf-assessment-results-background.pdf` – The branded template that is embedded behind generated reports when the PDF asset is available from the configured endpoints.

## Quick Start
1. Clone or download the repository and open `index.html` in a modern browser. No build tooling is required – everything runs client-side with the hosted PDF-LIB dependency.
2. Complete the personal information card and answer all 13 questions. The **Calculate Risk Score** button stays disabled until every required contact field is filled in, and each question must be answered before the assessment will run.
3. Review the automatically generated risk tier, contextual findings, and recommended next steps that render in the results panel.
4. Click **Download Full Report (PDF)** to export a multi-page PDF summary. The script attempts to load the branded background, falls back to a plain layout if the template cannot be retrieved, and caches the most recent snapshot so repeated downloads are instant.

## Risk Scoring Model
The logic in `assessment.js` calculates percentages using only applicable (non “N/A”) responses. Scores ≥85% map to **Low Risk**, 62–84% to **Moderate Risk**, 38–61% to **High Risk**, and anything below 38% is **Critical Risk**. Dedicated messaging is also provided for submissions where every answer is marked “N/A.” Each band renders custom copy, breach-impact context, and step-by-step remediation priorities that are injected into the results view and exported PDF.

## PDF & HubSpot Integration
Generated PDFs leverage PDF-LIB and are built entirely on the client. The script looks for configurable template sources (global `PearlAssessmentConfig`/`PearlAssessment` objects, `<meta name="pdf-template-url">`, or `data-pdf-template-url` attributes) before defaulting to the hosted Render endpoint. A cached template is reused across downloads to minimize network calls.

When a score is calculated, the assessment attempts to:
1. Build a fresh PDF payload that captures the participant details, answers, and narrative content.
2. Upload the PDF to `https://keyring-fv5f.onrender.com/api/upload-pdf`, expecting a sharable link in the response.
3. Post the contact data, risk level, and generated PDF URL to the backend HubSpot relay at `https://keyring-fv5f.onrender.com/api/hubspot/pdf-submit`. Failures in any step are logged to the console so operators can troubleshoot integrations without breaking the on-page experience.

If you self-host these APIs, update the constants near the top of `assessment.js` (and the mirrored section inside `wpBackend.html`) to point at your services. The PDF download still works even when the upload/submission calls fail, ensuring business continuity during outages.

## Embedding the Assessment Elsewhere
To embed the assessment outside of the provided HTML files:
1. Copy the markup for the personal information form, question list, results container, and buttons, preserving IDs/classes such as `#assessmentForm`, `.calculate-btn`, `.save-pdf-btn`, and `#results`. The JavaScript relies on these selectors to bind behavior.
2. Include the PDF-LIB CDN before loading `assessment.js`, or host both assets yourself. The module immediately wires up event listeners when it runs, so ensure the DOM is present (placing the script at the end of the body or loading it with `defer` both work).
3. Optionally expose `window.PearlAssessmentConfig` with custom `pdfTemplateUrl`/`pdfTemplateUrls` before loading the script if you want to override where the template comes from.
4. For content management systems that prefer a single pasteable asset, use `wpBackend.html`, which inlines the styles and latest script so the entire experience can be dropped into a page builder or custom HTML block.

## Development Notes
- The experience is static; simply open the HTML files in a browser to test changes locally. Console warnings and errors surface HubSpot upload issues, PDF template fallbacks, or validation problems for quick debugging.
- The results background (`golf-assessment-results-background.pdf`) must remain in the project root if you expect the offline fallback in `index.html` to work; remote deployments should host the file somewhere that matches your configured template URL(s).
