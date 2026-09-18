# Fact AI Prompt

Paste the final Fact generation prompt below the marker.

<!-- PASTE FACT PROMPT BELOW THIS LINE -->
Generate {NUMBER} JSON items about the topic: "{TOPIC}" based on the exact sample structure and field definitions provided below.

### Sample JSON Structure:
[
  {
    "fact": "Required fact text and the main line shown on the pin.",
    "link": "https://techtreasure.sbs/redirector.html?url=https://example.com/fact",
    "bg_url": "default",
    "title": "Pinterest title and supporting pin metadata.",
    "description": "Pinterest description for the exported CSV.",
    "tags": ["animals", "ocean", "biology"],
    "main_line": "Optional large text override on the image.",
    "cta": "Engaging button text to drive clicks or comments!"
  }
]

### Field Definitions & Rules:
1. "fact": Required fact text and the main line shown on the pin.
2. "link": Optional destination URL for this pin. Always format external links using your redirector wrapper: "https://techtreasure.sbs/redirector.html?url=ACTUAL_URL".
3. "bg_url": Optional background URL, default, or Library name (set to "default" or stock name).
4. "title": Pinterest title and supporting pin metadata.
5. "description": Pinterest description for the exported CSV.
6. "tags": Array of Pinterest keywords.
7. "main_line": Optional large text override on the image.
8. "cta": Optional button text on fact pins (designed to encourage user comments or clicks).

Ensure the output is valid JSON only, matching the exact keys and types above.

<!-- END FACT PROMPT -->

## Expected output

The prompt should return JSON for one pin with these keys:

- `title`: Pinterest title.
- `description`: Pinterest description.
- `tags`: array of Pinterest keywords.
- `main_line`: large fact text shown on the image.
- `cta`: optional button text.
