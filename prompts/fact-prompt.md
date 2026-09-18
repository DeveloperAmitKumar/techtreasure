Generate **{NUMBER} fresh JSON fact items** about **"{TOPIC}"**.

First, research the topic and find **real, accurate, and verifiable facts** related to `{TOPIC}`.

Prioritize facts that are:

* Surprising, unusual, fascinating, useful, or little-known
* Likely to make people stop scrolling and want to learn more
* About famous people, companies, animals, science, history, technology, space, nature, places, inventions, or other relevant subjects
* Based on reliable sources and current information when the topic requires it

Write the content like an **experienced professional content writer**: simple, punchy, curiosity-driven, and highly shareable while remaining completely factual. Do not use fake facts or misleading clickbait.

### Required JSON Structure

[
{
"fact": "A fascinating, accurate fact.",
"link": "https://techtreasure.sbs/redirector.html?url=ACTUAL_SOURCE_URL",
"bg_url": "DIRECT_RELEVANT_IMAGE_URL",
"title": "Pinterest title",
"description": "Pinterest description",
"tags": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
"main_line": "Short, powerful fact text shown on the image.",
"cta": "Short engaging call-to-action"
}
]

### Research & Accuracy Rules

* **Research before generating the JSON.**
* Use real, verifiable facts only.
* Verify important facts using reliable sources.
* Prefer authoritative sources such as official organizations, universities, scientific institutions, government websites, reputable publications, research papers, museums, and established news organizations.
* For science or medical facts, prefer authoritative scientific or institutional sources.
* For current facts, use up-to-date sources.
* Never invent statistics, dates, discoveries, quotes, records, or claims.
* Do not present rumors, myths, speculation, or internet claims as facts.
* If a commonly repeated fact is disputed or inaccurate, do not present it as established truth.
* Avoid duplicate or nearly identical facts.
* Make each item meaningfully different.
* Do not fabricate source URLs.

### Background Image Rules

**Never use `"default"` for `bg_url`.**

For every fact, search the internet for a **real, relevant background image** related to the fact.

The `bg_url` must:

* Be a **direct image URL** that can be loaded directly in HTML, for example:
  `<img src="IMAGE_URL" alt="...">`
* Point to an actual image or image/CDN resource, not a webpage.
* Be publicly accessible without requiring login.
* Be relevant to the specific fact.
* Be suitable for use as a pin background.
* Prefer reliable image sources such as Unsplash, Wikimedia Commons, official organizations, reputable publishers, or legitimate image/CDN hosts.
* Do not use Google/Bing image-search URLs.
* Do not use article/page URLs as `bg_url`.
* Do not use fake, guessed, placeholder, or fabricated image URLs.
* **Never use `"default"` or an empty value.**
* Prefer a different relevant image for each fact whenever possible.
* If the fact is about a specific person, animal, company, place, object, or event, use an image that actually represents that subject whenever a legitimate direct image URL is available.
* If a specific image cannot be found, use another legitimate direct image that accurately represents the fact rather than inventing a URL.

### Link Rules

`link` should point to the reliable source used to verify the fact.

Always wrap the source URL using:

`https://techtreasure.sbs/redirector.html?url=ACTUAL_SOURCE_URL`

Do not invent or guess source URLs.

### Writing Rules

**fact**

* State one clear and interesting fact.
* Keep it concise enough for a social-media pin.
* Make the first part interesting enough to grab attention.
* Do not sacrifice accuracy for a stronger hook.

**main_line**

* This is the large text displayed on the image.
* Make it short, bold, and easy to understand.
* Highlight the most surprising part of the fact.
* Do not simply copy a long paragraph.

**title**

* This is the Pinterest upload title.
* Make it searchable and curiosity-driven.
* Do not simply repeat `main_line`.
* Use natural keywords related to `{TOPIC}`.

**description**

* Write like an experienced Pinterest content writer.
* Briefly explain the fact and why it is interesting.
* Naturally include relevant search keywords.
* Encourage the reader to discover more without making unsupported claims.

**tags**

* Return **5–10 relevant Pinterest keywords**.
* Include specific subjects and broader topic keywords.
* Keep every tag genuinely relevant.
* Do not add unrelated trending keywords.

**cta**

* Keep it short and natural.
* Encourage actions such as saving, sharing, commenting, or learning more.
* Examples of style:
  `"Save this surprising fact!"`
  `"Did you know this?"`
  `"Would you have guessed this?"`
* Avoid spammy or misleading CTAs.

### Final Validation

Before returning the output, check every item:

1. The fact is real and verifiable.
2. The fact is relevant to `{TOPIC}`.
3. The source supports the fact.
4. The source URL is real and correctly wrapped.
5. `bg_url` is a **real direct image URL**.
6. The image is relevant to the specific fact.
7. The image URL can be used directly inside an HTML `<img>` element.
8. `bg_url` is never `"default"`.
9. No URL is fabricated, guessed, or a search-results URL.
10. All required keys are present.
11. `tags` is an array.
12. There are exactly `{NUMBER}` items.
13. The JSON syntax is valid.
14. There are no duplicate facts.

### Output Requirement

Return **only the JSON array**.

Do not include markdown, explanations, comments, headings, or any text outside the JSON.

The prompt must work correctly for **any valid number in `{NUMBER}` and any topic in `{TOPIC}`**.
### Image URL Rules

For every item, first search the internet for a **real, relevant image** related to the specific news/fact/quote.

The image URL must:

* Be a **direct image URL**, not a webpage or search-result URL.
* Prefer actual image files such as **`.jpg`, `.jpeg`, `.png`, or `.webp`**.
* Be publicly accessible and suitable for direct use in HTML, for example:
  `<img src="IMAGE_URL" alt="...">`
* Be directly relevant to the specific item.
* Prefer reliable sources such as official websites, Wikimedia Commons, Unsplash, reputable publishers, or legitimate image/CDN hosts.
* Do not use Google/Bing image-search URLs.
* Do not use article/page URLs as image URLs.
* Do not invent, guess, modify, or fabricate image URLs.
* Do not use an image that is unrelated simply to avoid using `"default"`.

### Fallback Rule

**If you cannot find and verify a suitable relevant direct `.jpg`, `.jpeg`, `.png`, or `.webp` image URL, add tags or serach terms like tech , car running etc or set the image field to exactly:**

`"default"`

Never fabricate an image URL just to fill the field.

### Final Image Check

Before returning each item, verify:

1. The image is relevant to the item.
2. The URL points directly to an image.
3. The image is a supported format such as `.jpg`, `.jpeg`, `.png`, or `.webp`.
4. The image can reasonably be loaded by an HTML `<img>` element.
5. If these conditions cannot be satisfied, use `"default"`.
