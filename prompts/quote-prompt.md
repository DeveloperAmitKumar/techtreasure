Generate **{NUMBER} fresh JSON quote items** about **"{TOPIC}"**.

First, research the topic and find **real, verified quotes** that genuinely relate to `{TOPIC}`.

Prioritize quotes from notable authors, writers, scientists, entrepreneurs, artists, leaders, philosophers, creators, or other relevant public figures. Choose quotes that are meaningful, memorable, thought-provoking, surprising, emotional, or highly shareable.

Write the Pinterest titles, descriptions, tags, and CTAs like an **experienced professional content writer**. Make them natural, curiosity-driven, and suitable for Pinterest without using fake claims or misleading clickbait.

### Required JSON Structure

[
{
"quote": "The real verified quote text.",
"author": "Author Name",
"link": "https://techtreasure.sbs/redirector.html?url=ACTUAL_SOURCE_URL",
"bg_url": "DIRECT_RELEVANT_IMAGE_URL",
"title": "Pinterest title",
"description": "Pinterest description",
"tags": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
"cta": "Short engaging call-to-action"
}
]

### Research & Quote Rules

* Research before generating the JSON.
* Use **real, attributable quotes only**.
* Do not invent, rewrite, paraphrase, or combine quotes and present them as originals.
* Verify the quote and attribution using a reliable source whenever possible.
* Prefer authoritative sources, books, official websites, reputable publications, interviews, speeches, or trustworthy quotation references.
* Avoid commonly misattributed internet quotes.
* If the exact wording or attribution cannot be reasonably verified, do not use that quote.
* Avoid repeating the same author excessively when many suitable sources are available.
* Choose quotes that genuinely fit `{TOPIC}`.
* Do not fabricate source URLs.

### Background Image Rules

For every quote, first try to find a **real, visually relevant background image** that fits the quote, author, or topic.

The `bg_url` accepts, in order of preference:

1. A **direct image URL** (rules below), or
2. **Pexels search terms**: 2–4 lowercase words describing the ideal photo,
   for example `"mountain sunrise"` or `"boy standing street"`.
   The app automatically fetches a matching photo from Pexels.
3. `"default"` only when no meaningful search terms exist for the quote.

The `bg_url` must:

* Be a **direct image URL** that can be used inside:
  `<img src="IMAGE_URL">`
* Be publicly accessible without requiring login.
* Point to an actual image or image/CDN resource, not a webpage.
* Be relevant to the quote, author, or topic.
* Work when loaded directly by an HTML page.
* Prefer reliable sources such as Unsplash, Wikimedia Commons, official websites, or reputable image/CDN hosts.
* Do not use Google/Bing image-search URLs.
* Do not use an article URL as `bg_url`.
* Do not use fake, guessed, placeholder, or fabricated image URLs.
* Use `"default"` only as a last resort when neither a direct URL nor
  meaningful search terms are possible.
* Prefer a different suitable background for each quote when possible.
* If a specific author is the subject, an appropriate portrait or related visual can be used when a legitimate direct image URL is available.
* If no author-specific image is suitable, use a visually relevant image representing the quote's topic or concept.

### Link Rules

`link` should point to the source used to verify the quote.

Always format external links using:

`https://techtreasure.sbs/redirector.html?url=ACTUAL_SOURCE_URL`

If a reliable source URL cannot be verified, do not invent one.

### Writing Rules

**quote**

* Keep the verified wording accurate.
* Preserve the author's intended wording.
* Do not add words to make the quote sound better.

**author**

* Use the verified author's name.
* If the quote is genuinely anonymous, use `"Anonymous"` only when reliable sources support that attribution.

**title**

* Write a strong Pinterest title.
* Make it searchable and curiosity-driven.
* Do not simply repeat the quote.
* Make it relevant to `{TOPIC}`.

**description**

* Write like an experienced Pinterest content writer.
* Explain the idea or feeling behind the quote.
* Naturally include relevant keywords.
* Make the reader interested in saving or reading the pin.
* Do not make unsupported claims about the author or quote.

**tags**

* Return **5–10 relevant Pinterest keywords**.
* Include topic, quote category, author where useful, and related concepts.
* Avoid unrelated trending keywords.

**cta**

* Keep it short and natural.
* Encourage an action such as saving, sharing, reflecting, or exploring.
* Examples of style: `"Save this for later."`, `"Which line speaks to you?"`
* Do not make false promises or use spammy wording.

### Final Validation

Before returning the output, verify every item:

1. The quote is real and correctly attributed.
2. The quote actually relates to `{TOPIC}`.
3. The source link corresponds to the quote.
4. The redirector wrapper is correctly applied.
5. `bg_url` is a **real direct image URL, Pexels search terms, or `"default"`**.
6. `bg_url` is relevant to the quote/topic/author.
7. A direct URL can be loaded directly by an HTML `<img>` element.
8. No `bg_url` is empty or fabricated.
9. No URLs are fabricated or placeholders.
10. All required keys are present.
11. There are exactly `{NUMBER}` items.
12. The JSON is syntactically valid.

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

**If you cannot find and verify a suitable relevant direct `.jpg`, `.jpeg`, `.png`, or `.webp` image URL, do NOT fabricate one.** Instead, write 2–4 lowercase search terms describing the ideal photo (for example `"tech gadgets"`, `"car running road"`). The app fetches a matching photo from Pexels automatically. Use `"default"` only when no meaningful search terms exist.

Never fabricate an image URL just to fill the field.

### Final Image Check

Before returning each item, verify:

1. The image/query is relevant to the item.
2. A direct URL points directly to an image.
3. A direct URL is a supported format such as `.jpg`, `.jpeg`, `.png`, or `.webp`.
4. A direct URL can reasonably be loaded by an HTML `<img>` element.
5. Search terms are 2–4 plain lowercase words, not a URL and not a sentence.
6. If none of these can be satisfied, use `"default"`.
