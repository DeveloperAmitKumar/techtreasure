Generate **{N} fresh JSON news items** about **"{TOPIC}"**.

First, research the **latest real news** related to `{TOPIC}`. Prioritize recent stories with high public interest, especially surprising, important, unusual, controversial, or widely discussed developments involving famous people, companies, organizations, products, events, or technologies relevant to the topic.

Write the content like an **experienced professional news and Pinterest content writer**: strong hooks, natural language, curiosity-driven titles, and concise descriptions. Make it attention-grabbing without using misleading clickbait or inventing information.

### Required JSON Structure

[
{
"headline": "Real source headline",
"source_link": "https://techtreasure.sbs/redirector.html?url=ACTUAL_ARTICLE_URL",
"image_url": "DIRECT_RELEVANT_IMAGE_URL",
"image_title": "Short attention-grabbing title for the image",
"image_description": "Short supporting news copy shown on the image",
"title": "Pinterest upload title",
"description": "Pinterest upload description",
"tags": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
"source": "Source: Publisher Name"
}
]

### Important Image Rule

**Never use `"default"` for `image_url`.**

For every news item, search the internet and find a **real, relevant image URL specifically related to that news story**.

The `image_url` must:

* Be the URL of the actual image file or a direct image/CDN endpoint.
* Be usable directly in HTML like:
  `<img src="IMAGE_URL" alt="...">`
* Load without requiring the user to visit another webpage.
* Be publicly accessible without login.
* Match the specific person, company, product, event, or subject in the news.
* Prefer reliable publisher/CDN, official company, Wikimedia, Unsplash, or other reputable image hosting URLs.
* Do **not** provide an article/page URL in `image_url`.
* Do **not** use search-result URLs.
* Do **not** use fake, guessed, placeholder, or fabricated image URLs.
* Verify that the URL is likely to work as a direct image before returning it.
* If the original news article contains a suitable image, prefer using its direct image/CDN URL when it can be legally and technically embedded.
* Choose a different relevant image for each story whenever possible.

### Research Rules

* Research the latest available news before generating the JSON.
* Use real published news only.
* Prefer reputable sources such as Reuters, AP, BBC, Bloomberg, CNBC, TechCrunch, The Verge, Wired, official company websites, and other reliable publishers.
* Prioritize recent and genuinely interesting stories.
* Avoid duplicate stories covering the same event.
* Cover different companies, people, products, events, and developments when possible.
* Verify important facts against the source article.
* Never invent events, quotes, statistics, people, article URLs, or image URLs.
* Clearly distinguish confirmed information from rumors or speculation.

### Writing Rules

**headline**

* Use the real source headline.
* Do not alter it in a way that changes its meaning.
* This is used as the main headline in the Breaking Newspaper template.

**image_title**

* Write a short, powerful title for the rendered news image.
* Ideally 4–10 words.
* Make it immediately understandable and attention-grabbing.
* Do not simply copy the source headline.

**image_description**

* Write 1–2 short sentences explaining the important development.
* Make it interesting enough to encourage people to read the full story.
* Keep it factually accurate.

**title**

* This is the Pinterest upload title, separate from the image text.
* Make it searchable, natural, and curiosity-driven.
* Do not simply repeat `image_title`.

**description**

* Write like an experienced Pinterest/news content writer.
* Briefly explain what happened and why it matters.
* Naturally include relevant search keywords.
* Encourage the reader to learn more without making false claims.

**tags**

* Return 5–10 relevant Pinterest keywords.
* Include specific names/entities plus broader topic keywords.
* Do not add unrelated trending keywords just to attract clicks.

**source**

* Use the real publisher name.
* Format exactly as:
  `"Source: Publisher Name"`

**source_link**

* Use the actual article URL.
* Always wrap it with:
  `https://techtreasure.sbs/redirector.html?url=ACTUAL_ARTICLE_URL`

### Final Validation

Before returning the result, check every item:

1. The news story is real and relevant to `{TOPIC}`.
2. The article URL matches the story.
3. `image_url` is a **real direct image URL**, not a webpage URL.
4. The image is relevant to that specific story.
5. The image URL can be used directly inside an HTML `<img>` element.
6. No `image_url` contains `"default"`.
7. No URLs are fabricated or placeholders.
8. There are exactly `{N}` items.
9. All required keys are present.
10. The final response is **valid JSON only**.

Return **only the JSON array**. Do not include markdown, explanations, comments, or any text outside the JSON.
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
