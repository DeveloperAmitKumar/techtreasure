# Quote AI Prompt

Paste the final Quote generation prompt below the marker.

<!-- PASTE QUOTE PROMPT BELOW THIS LINE -->

Generate {NUMBER} JSON items about the topic: "{TOPIC}" based on the exact sample structure and field definitions provided below.

### Sample JSON Structure:
[
  {
    "quote": "The inspiring or famous quote text goes here.",
    "author": "Author Name",
    "link": "https://techtreasure.sbs/redirector.html?url=https://example.com/quote",
    "bg_url": "default",
    "title": "Pinterest Export Title",
    "description": "Pinterest description used in the exported CSV.",
    "tags": ["inspiration", "motivation"],
    "cta": "Engaging call-to-action text!"
  }
]

### Field Definitions & Rules:
1. "quote": Required quote text. It becomes the main text on the pin.
2. "author": Optional attribution shown below the quote.
3. "link": Optional destination URL for this pin. Always format external links using your redirector wrapper: "https://techtreasure.sbs/redirector.html?url=ACTUAL_URL".
4. "bg_url": Optional background URL, default, or Library name (set to "default").
5. "title": Pinterest title.
6. "description": Pinterest description used in the exported CSV.
7. "tags": Array of keywords (or comma/semicolon-separated string based on requirement).
8. "cta": Optional button text on quote pins designed to drive comments or clicks.

Ensure the output is valid JSON only, matching the exact keys and types above.
<!-- END QUOTE PROMPT -->

## Expected output

The prompt should return JSON for one pin with these keys:

- `title`: Pinterest title.
- `description`: Pinterest description.
- `tags`: array of Pinterest keywords.
- `main_line`: large quote text when applicable.
- `cta`: optional button text.
