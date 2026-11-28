# DocuMind UI/UX Resolution Plan

This plan translates the [UI/UX audit](UI-UX-AUDIT.md) into a sequence of changes. The first release should let someone open a sample or upload their own PDF, ask a question, and verify the answer without instructions. Use that workflow to evaluate every design decision.

## 1. Give users a clear first step

On the landing page, make **Try a sample** the primary action and **Upload a PDF** the secondary action. Show a real example of an answer and its source near the hero. Place benchmarks and engineering details farther down the page. Describe citation precision in terms the product can consistently deliver.

| Entry point | Expected behavior |
|---|---|
| Try a sample | Open an available sample, select only that PDF for questions, and offer a sample-specific prompt the user can send. Show a recovery action if the sample is unavailable. |
| Upload a PDF | Open the upload panel with supported limits, retention, and applicable provider disclosure before file submission. Automatically select and open a successful upload only when doing so leaves any active question or draft intact. Otherwise offer **Ask about this PDF**. |
| Open the workspace directly | Show **Choose a sample** and **Upload a PDF** when no documents are selected. Keep existing eligible selections as the library refreshes and let users explicitly add or remove documents. |

Above the composer, show **Asking about** with selected filenames and a **Change documents** control. Open a PDF for reading independently of the search selection. Capture the selected document IDs when sending and retain that context on the answer and its retry action. If a source expires or is deleted, explain what changed and let the user choose how to proceed.

## 2. Make the answer and its evidence easy to read

Lead with the answer. Place inline citations next to the claims they support and show the exact supporting quote on demand. Use simple labels such as **vibit-datasheet · p. 4** in place of raw model IDs. Put provider details, timing, and retrieved passages behind **Answer details**.

For glossary questions, the answer should distinguish what the PDF supports from what the model supplies as background. For example:

> **General background**
>
> FFT stands for Fast Fourier Transform. It shows which frequencies are present in a vibration signal.
>
> **From this PDF**
>
> The retrieved passages mention FFT graph analysis without defining it. **vibit-datasheet · p. 4**

A citation opens the right PDF and page, then reveals the best supported location. Use an exact line or table row when available, a labeled passage highlight when only block coordinates exist, and a page link with a quote when coordinates are unavailable. Keep the quote accessible without relying on the visual highlight.

**API dependency.** The current response exposes an answer string, citations, and bounding boxes. Add structured answer sections with references to validated citation IDs, plus explicit evidence outcomes and location precision. Keep existing fields readable during the transition. Render a source list for older responses whose claim-to-citation links are unknown.

## 3. Design the states people actually encounter

| State | What the user sees and can do |
|---|---|
| Uploading or processing | Show the filename and stage. Show upload progress when measurable. Keep other ready documents available while processing continues. |
| Invalid file or processing failure | Show the file-specific reason and a next action, such as choosing a smaller PDF, uploading a replacement, or retrying a recoverable failure. |
| Waiting on an answer | Show that the question was sent and the answer is pending. Keep existing answers and citations usable. Keep a failed question available for retry. |
| No supporting evidence | Say what the search could establish and identify the document scope. Offer a narrower question or a scope change where relevant. |
| Answer service unavailable or limited | Show the service or usage limit explicitly. Offer retry when appropriate and include a reset time only when available. |
| Source deleted or expired | Update the document selection and explain why the source is unavailable. Give the user a path back to the remaining documents. |

Pull upload limits and expiry information from the API. Confirm deletion success after the server confirms it. Keep the landing page’s claims about document types and source precision aligned with the capabilities verified in testing.

## 4. Adapt the workspace to the device

**Desktop.** Keep chat and PDF side by side. Make the library collapsible and the divider adjustable with keyboard controls. Use shared type, color, spacing, and focus styles across the landing page and workspace. Keep diagnostics visually secondary.

**Mobile and narrow windows.** Build on the existing Documents, Chat, and PDF switcher. A citation moves directly to its source. **Back to answer** restores the same message, scroll position, and composer draft. Keep the composer visible with the software keyboard open and test PDF zoom and long filenames.

**Accessibility.** Apply the [WCAG 2.2 AA target in the audit](UI-UX-AUDIT.md). Verify keyboard operation, visible focus, contrast, and touch targets. Announce upload and answer states without reading the whole transcript. Restore focus to the invoking citation when returning from the viewer. Test the source quote and citation action with a screen reader.

## 5. Prepare for international rollout

Extract interface copy into translation resources and pilot one language with a target audience. Test language support separately for interface, PDF text, OCR, questions, and answers. Preserve original source quotes and label translated excerpts. Test text expansion, locale-aware numbers and dates, and right-to-left layout before releasing a locale that requires it.

On a mid-range phone and a throttled connection, check first load, upload recovery, and citation navigation. Keep chat usable while PDF pages render and preserve drafts across panel changes and recoverable connection failures.

## Delivery and release checks

| Stage | Deliverable | Acceptance check |
|---|---|---|
| 1. First-use flow | Landing actions, upload states, and explicit question scope | A first-time user opens a sample or uploads a PDF and can identify exactly which file will be searched. |
| 2. Answers and sources | Structured evidence, clear background labels, viewer navigation, and failure recovery | An FFT answer separates background from PDF evidence. A table citation opens the correct page with a readable quote. Unsupported answers and service errors produce distinct states. |
| 3. Device and access | Responsive workspace, keyboard and screen-reader flows, and performance checks | On desktop and mobile, users can verify a citation and return to the same answer. Keyboard-only and screen-reader users can complete the core workflow. |
| 4. Language pilot | Translated user journey and tested document-language combinations | Users in the pilot language complete the core workflow and can tell an original quote from its translation. |

Prototype and test stages 1 and 2 before expanding visual polish. Measure time from entry to first cited answer, the share of users who verify a citation unaided, and recovery after a failed upload or answer. Establish a baseline with the current UI before setting improvement targets. Use aggregate event data and exclude PDF content, questions, and quoted passages from analytics.
