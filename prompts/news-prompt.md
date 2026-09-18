# News AI Prompt

Paste the final News generation prompt below the marker.

<!-- PASTE NEWS PROMPT BELOW THIS LINE -->
Generate {NUMBER} JSON items about the topic: "{TOPIC}" based on the exact sample structure and field definitions provided below.

### Sample JSON Structure:
[
  {
    "headline": "Example news headline from a real or realistic source",
    "source_link": "https://techtreasure.sbs/redirector.html?url=https://example.com/article",
    "image_url": "https://images.unsplash.com/photo-...",
    "image_title": "Short catchy image text",
    "image_description": "Supporting copy rendered inside the image.",
    "title": "Pinterest Export Title",
    "description": "Pinterest export description optimized for clicks.",
    "source": "Source: Publisher Name"
  }
]

### Field Definitions & Rules:
1. "headline": Required source headline. Used as the large headline in Breaking Newspaper.
2. "source_link": Article URL and destination link for this pin. Always format external links using your redirector wrapper: "https://techtreasure.sbs/redirector.html?url=ACTUAL_URL".
3. "image_url": Direct image URL (e.g., Unsplash link) or use "default".
4. "image_title": Title rendered inside the image (separate from Pinterest title).
5. "image_description": Supporting copy rendered inside the image (separate from Pinterest description).
6. "title": Pinterest title exported to the final upload CSV; not image copy.
7. "description": Pinterest description exported to the final upload CSV; not image copy.
8. "source": Optional tiny source credit at the bottom of the image (e.g., "Source: Reuters").

Ensure the output is valid JSON only, matching the exact keys above.
<!-- END NEWS PROMPT -->

## Expected output

The prompt should return JSON for one pin with these keys:

- `headline`: source headline, especially for the Breaking Newspaper template.
- `image_title`: title shown on the rendered pin image.
- `image_description`: supporting news copy shown on the rendered pin image.
- `title`: Pinterest upload title, kept separate from image copy.
- `description`: Pinterest upload description, kept separate from image copy.
- `tags`: array of Pinterest keywords.
- `source`: optional small source credit on the image.
