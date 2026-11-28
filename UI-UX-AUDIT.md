# DocuMind UI/UX Audit

## Product direction

DocuMind’s strongest interaction is opening a citation and seeing the evidence in the PDF. Build the experience around three tasks a new user can complete without guidance: **open a document, ask a question, verify the answer**. The desktop workspace already puts chat and the PDF side by side. The main gaps are getting to a useful first answer, understanding what supports it, and recovering when something goes wrong.

This review draws on the supplied desktop screenshots and the landing, workspace, chat, upload, and viewer code. Mobile behavior, accessibility, and usability findings need hands-on validation.

## P0 · Make the core workflow clear and trustworthy

| Area | What’s missing | Design change |
|---|---|---|
| First use | The landing page offers “Launch app” and “Try it live.” The workspace opens into a three-panel interface where first-time users must infer where to begin. | Offer **Try a sample** and **Upload a PDF** as distinct entry points. Open the sample with a relevant first question ready to send. After upload, show when the document is ready and offer prompts such as “Summarize this PDF.” |
| Question scope | A small sidebar checkbox is the main cue for which PDFs are being searched. The viewer can show a different document from the one being queried. | Show the selected document names above the composer. Give the viewer its own title and make it clear when the open PDF differs from the search scope. Explain why sending is disabled and how to enable it. |
| Answer provenance | The FFT answer combines general background and PDF evidence in one paragraph. Raw source IDs such as `[S1, S2]` appear alongside a second set of citation labels. | Present **General background** and **From this PDF** as separate sections when both apply. Put clickable citations next to the statement each page supports. Convert internal source IDs into user-facing citation controls. |
| Citation verification | A click opens the page, but the screenshot shows a highlight covering much of a specification table. Finding the exact supporting row still takes effort. | Show the supporting quote on demand. Scroll to and highlight the relevant line or table row where coordinates allow. When only a block or page location is available, show that level of precision in the citation. |
| Feedback and recovery | Upload limits and processing details sit near the bottom of the sidebar. Answer cards foreground provider names and milliseconds. | Put file limits, retention, and provider disclosure beside the upload action. Use actionable states such as **Reading PDF**, **Ready**, **Couldn’t read this file**, and **Answer service unavailable**. Preserve the question on failure and offer retry where applicable. Move timing and retrieved passages into expandable details. |

## P1 · Design for different devices and abilities

- **Desktop.** Use a shared typography, color, and spacing system across the landing page and workspace. Make the document list collapsible and the chat/PDF split adjustable. Prioritize the active filename, answer, and source actions over decorative accents and diagnostic text.
- **Mobile.** Build on the existing panel switcher. Opening a citation should take the user directly to the PDF location and offer **Back to answer**, preserving chat scroll position and draft text. Check PDF zoom, long names, and composer visibility with the keyboard open.
- **Accessibility.** Target WCAG 2.2 AA. Verify keyboard access through upload, chat, citations, and the viewer. Check visible focus, readable contrast, usable touch target sizes, and screen-reader announcements for upload and answer status. Provide source excerpts as selectable text alongside visual highlights. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- **Trust and privacy.** Explain what happens to uploads before submission, including current retention and whether extracted text goes to a third-party provider. Make deletion discoverable and show when it completes. Align landing-page claims about supported PDFs and citation precision with verified behavior.

## P2 · Prepare for a global audience

- **Localize the full journey.** Move hard-coded English interface strings into translation resources. Pilot one additional language with target users, including upload errors, consent copy, and citations. Test expanded text and use locale-aware numbers and dates where displayed. Plan for right-to-left layout before launching a language that requires it.
- **Define language support separately.** Test interface language, PDF language, OCR language, question language, and answer language independently. Publish the combinations that work reliably. Preserve source quotes in the original language and label any translation.
- **Design for slower devices and networks.** Keep chat usable while the PDF renders. Test first load, citation navigation, and upload recovery on a mid-range phone and throttled connection. Preserve drafts and show a meaningful status when processing takes time.

## How to validate the redesign

Run task-based sessions with first-time users on desktop and mobile, including keyboard and screen-reader users. Ask them to open a sample, upload a PDF, request an overview, verify a table citation, and recover from a failed upload. Include a glossary question like “What is FFT?” and check that users can identify which part is general background and which part the PDF supports.

Track **time to first cited answer**, **unassisted citation verification**, and **recovery after failure**. Establish a baseline before setting targets. The first release should make the upload → answer → evidence flow usable on desktop and mobile before adding more workspace features.
