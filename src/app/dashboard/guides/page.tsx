import SampleCsvButton from "@/components/SampleCsvButton";
import CopyTextButton from "@/components/CopyTextButton";
import { Icon } from "@/components/Icon";
import { CSV_SPECS, type ContentType } from "@/lib/types";
import fs from "node:fs";
import path from "node:path";

export const metadata = { title: "Guides · TechTreasure" };

const TYPES: ContentType[] = ["quote", "news", "fact"];

const JSON_SAMPLES: Record<ContentType, string> = {
  quote: `[
  {
    "quote": "The best way to predict the future is to invent it.",
    "author": "Alan Kay",
    "link": "https://example.com/quote",
    "bg_url": "default",
    "title": "Invent the Future",
    "description": "A motivating quote about creating the future.",
    "tags": ["inspiration", "motivation"],
    "cta": "Learn More"
  }
]`,
  news: `[
  {
    "headline": "Luxury brands embrace sustainable materials",
    "source_link": "https://example.com/article",
    "image_url": "default",
    "image_title": "Fashion Goes Green",
    "image_description": "Designers are turning to recycled fabrics and lower-waste production.",
    "title": "Sustainable Fashion Trends 2026",
    "description": "Explore the brands changing fashion with eco materials.",
    "source": "Source: Reuters"
  }
]`,
  fact: `[
  {
    "fact": "Octopuses have three hearts.",
    "link": "https://example.com/fact",
    "bg_url": "Stock 5",
    "title": "Three Hearts",
    "description": "An unusual fact about octopus biology.",
    "tags": ["animals", "ocean", "biology"],
    "main_line": "Three hearts power one swimmer",
    "cta": "Discover"
  }
]`,
};

const PROMPT_FILES = TYPES.map((type) => {
  const file = `prompts/${type}-prompt.md`;
  const absolute = path.join(process.cwd(), file);
  return { type, file, exists: fs.existsSync(absolute) };
});

const PROMPT_TEXT: Record<ContentType, string> = Object.fromEntries(
  TYPES.map((type) => {
    const file = path.join(process.cwd(), "prompts", `${type}-prompt.md`);
    return [type, fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "Prompt file not found."];
  })
) as Record<ContentType, string>;

const FIELD_DEFINITIONS: Record<ContentType, { name: string; meaning: string; example: string }[]> = {
  quote: [
    { name: "quote", meaning: "Required quote text. It becomes the main text on the pin.", example: "Simplicity is the ultimate sophistication." },
    { name: "author", meaning: "Optional attribution shown below the quote.", example: "Leonardo da Vinci" },
    { name: "link", meaning: "Optional destination URL for this pin. Overrides the batch link.", example: "https://example.com" },
    { name: "bg_url", meaning: "Optional background URL, default, or Library name.", example: "default or Sunset" },
    { name: "title", meaning: "Pinterest title. AI fills it when blank in With-AI mode.", example: "Simplicity Wins" },
    { name: "description", meaning: "Pinterest description used in the exported CSV.", example: "A design lesson about clarity." },
    { name: "tags", meaning: "Comma- or semicolon-separated Pinterest keywords.", example: "design, minimalism" },
    { name: "cta", meaning: "Optional button text on quote pins.", example: "Discover" },
  ],
  news: [
    { name: "headline", meaning: "Required source headline. Used as the large headline in Breaking Newspaper.", example: "Luxury brands embrace sustainable materials" },
    { name: "source_link", meaning: "Article URL and destination link for this pin.", example: "https://news.example/article" },
    { name: "image_url", meaning: "Image URL, default, or Library name used as the visual background.", example: "https://example.com/photo.jpg" },
    { name: "image_title", meaning: "Title rendered inside the image. This is separate from the Pinterest title.", example: "Fashion Goes Green" },
    { name: "image_description", meaning: "Supporting copy rendered inside the image. This is separate from the Pinterest description.", example: "Designers are turning to recycled fabrics..." },
    { name: "title", meaning: "Pinterest title exported to the final upload CSV; not image copy.", example: "Sustainable Fashion Trends 2026" },
    { name: "description", meaning: "Pinterest description exported to the final upload CSV; not image copy.", example: "Explore the brands changing fashion..." },
    { name: "source", meaning: "Optional tiny source credit at the bottom of the image.", example: "Source: Reuters" },
  ],
  fact: [
    { name: "fact", meaning: "Required fact text and the main line shown on the pin.", example: "Octopuses have three hearts." },
    { name: "link", meaning: "Optional destination URL for this pin.", example: "https://example.com" },
    { name: "bg_url", meaning: "Optional background URL, default, or Library name.", example: "Stock 5" },
    { name: "title", meaning: "Pinterest title and supporting pin metadata.", example: "Three Hearts" },
    { name: "description", meaning: "Pinterest description for the exported CSV.", example: "An unusual fact about octopus biology." },
    { name: "tags", meaning: "Comma- or semicolon-separated Pinterest keywords.", example: "animals, ocean" },
    { name: "main_line", meaning: "Optional large text override on the image.", example: "Three hearts power one swimmer" },
    { name: "cta", meaning: "Optional button text on fact pins.", example: "Learn More" },
  ],
};

export default function GuidesPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Icon name="fluent-emoji-flat:open-book" size={26} />
          Guides
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          How to prepare inputs, choose backgrounds, and export pins for
          Pinterest.
        </p>
      </header>

      <Section icon="fluent-emoji-flat:compass" title="Workflow">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-700">
          <li>Create a <strong>brand</strong> (logo, colors, font).</li>
          <li>
            Start a <strong>new batch</strong>: pick a content type, board name,
            and destination link.
          </li>
          <li>
            Choose a mode: <strong>With AI</strong> (paste, topic, or basic
            CSV — AI fills what you leave empty) or <strong>Without AI</strong>{" "}
            (detailed CSV/JSON only — every row carries full details, no AI
            calls).
          </li>
          <li>
            Tune the look: font, colors, brand-name color, bold/italic, text
            background, blur, and an optional fixed call-to-action.
          </li>
          <li>
            Choose <strong>backgrounds</strong> — upload from your computer or
            choose from the built-in gradient and texture library.
          </li>
          <li>
            <strong>Review &amp; generate</strong> — each pin renders to a
            1000×1500 PNG and gets AI-written SEO metadata (With-AI mode).
          </li>
          <li>
            Export a <strong>publishable CSV</strong> or a{" "}
            <strong>ZIP of images</strong> from the batch page.
          </li>
        </ol>
      </Section>

      <Section icon="fluent-emoji-flat:page-facing-up" title="CSV import formats">
        <p className="mb-4 text-sm text-neutral-700">
          Upload a CSV on the <em>New batch</em> page. Headers are
          case-insensitive. Only the required column is mandatory — optional{" "}
          <code>title</code>, <code>description</code>, <code>tags</code>,{" "}
          <code>cta</code> (and <code>main_line</code>) cells override the AI
          for that row when filled, and fall back to AI when empty.{" "}
          <strong>If any cell in a row is invalid, that entire row is
          skipped</strong> — you&apos;ll see which rows were ignored before
          you confirm.
        </p>
        <div className="space-y-5">
          {TYPES.map((t) => {
            const spec = CSV_SPECS[t];
            return (
              <details key={t} open={t === "news"} className="group rounded-lg border border-neutral-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <span className="flex items-center gap-2 font-semibold capitalize">
                    <Icon name={t === "quote" ? "fluent-emoji-flat:thought-balloon" : t === "news" ? "fluent-emoji-flat:newspaper" : "fluent-emoji-flat:light-bulb"} size={22} />
                    {t} input guide
                  </span>
                  <span className="text-xs text-neutral-500 group-open:hidden">Open details</span>
                  <span className="hidden text-xs text-neutral-500 group-open:inline">Close details</span>
                </summary>
                <div className="border-t border-neutral-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-neutral-600">CSV columns and meanings for {t} pins.</p>
                  <SampleCsvButton type={t} />
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Columns: <code>{spec.columns.join(", ")}</code>
                  {" · "}
                  Required: <code>{spec.required.join(", ")}</code>
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 uppercase text-neutral-500">
                      <tr>
                        {spec.columns.map((c) => (
                          <th key={c} className="px-2 py-1">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {spec.samples.map((row, i) => (
                        <tr key={i}>
                          {spec.columns.map((c) => (
                            <td
                              key={c}
                              className="max-w-[180px] truncate px-2 py-1 text-neutral-700"
                            >
                              {row[c] || <span className="text-neutral-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
                  <p className="font-semibold text-neutral-800">In simple language</p>
                  <ul className="mt-2 space-y-1">
                    {FIELD_DEFINITIONS[t].map((field) => (
                      <li key={field.name}>
                        <code>{field.name}</code> means {field.meaning.toLowerCase()}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 uppercase text-neutral-500">
                      <tr>
                        <th className="px-2 py-2">Parameter</th>
                        <th className="px-2 py-2">What it does</th>
                        <th className="px-2 py-2">Example</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {FIELD_DEFINITIONS[t].map((field) => (
                        <tr key={field.name}>
                          <td className="whitespace-nowrap px-2 py-2 font-mono text-neutral-800">{field.name}</td>
                          <td className="min-w-[260px] px-2 py-2 text-neutral-600">{field.meaning}</td>
                          <td className="min-w-[180px] px-2 py-2 text-neutral-500">{field.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              </details>
            );
          })}
        </div>
      </Section>

      <Section icon="fluent-emoji-flat:keyboard" title="Paste-list format">
        <p className="text-sm text-neutral-700">
          In <strong>Paste list</strong> mode, enter one item per line, with
          optional per-line details separated by a pipe <code>|</code> (empty
          = AI default):
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">
{`The best way to predict the future is to invent it. | Alan Kay | | default | Invent the Future | | inspiration, motivation | Learn More
Simplicity is the ultimate sophistication.
Stay hungry, stay foolish.`}
        </pre>
        <p className="mt-2 text-xs text-neutral-500">
          Order for quotes:{" "}
          <code>
            quote | author | link | bg | title | description | tags | cta
          </code>
          . For news: {" "}
          <code>
            headline | link | bg | image_title | image_description | title | description | source
          </code>
          . Here <code>image_title</code> and <code>image_description</code> are
          shown on the image; <code>title</code> and <code>description</code>
          are kept for the final Pinterest CSV. A line without <code>|</code> is
          just the headline. Tags are comma-separated. Invalid links are
          ignored for that line.
        </p>
        <div className="mt-4 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
          <p className="font-semibold text-neutral-800">News sample explained</p>
          <ul className="mt-2 space-y-1">
            <li><code>headline</code> is the main news headline, especially large in the Breaking Newspaper template.</li>
            <li><code>image_title</code> is the title printed inside the pin image.</li>
            <li><code>image_description</code> is the extra news explanation printed inside the pin image.</li>
            <li><code>title</code> is the separate Pinterest upload title.</li>
            <li><code>description</code> is the separate Pinterest upload description.</li>
            <li><code>source</code> is a small optional credit such as a publisher name.</li>
          </ul>
        </div>
      </Section>

      <Section icon="fluent-emoji-flat:braces" title="JSON import format">
        <p className="text-sm text-neutral-700">
          In <strong>JSON import</strong> mode, paste (or load) a JSON array —
          one object per pin, with the same fields as CSV. A{" "}
          <strong>Copy sample JSON</strong> button in the form gives you a
          starter for each content type.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Any detail left empty falls back to the AI default; an object with
          all details filled skips the AI call for that pin entirely (still 1
          credit for rendering). Rows with a missing required field or an
          invalid URL are skipped with reasons, exactly like CSV.
        </p>
        <div className="mt-4 space-y-3">
          {TYPES.map((type) => (
            <details key={type} open={type === "news"} className="group rounded-md border border-neutral-200">
              <summary className="flex cursor-pointer list-none items-center justify-between p-3 font-semibold capitalize">
                <span>{type} JSON sample</span>
                <span className="text-xs font-normal text-neutral-500 group-open:hidden">Show sample</span>
                <span className="hidden text-xs font-normal text-neutral-500 group-open:inline">Hide sample</span>
              </summary>
              <div className="border-t border-neutral-100 p-3">
                <pre className="overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">{JSON_SAMPLES[type]}</pre>
                <div className="mt-3 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
                  <p className="font-semibold text-neutral-800">What these values mean</p>
                  <ul className="mt-2 space-y-1">
                    {FIELD_DEFINITIONS[type].map((field) => (
                      <li key={field.name}><code>{field.name}</code> = {field.meaning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          ))}
        </div>
        <p className="mt-4 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
          <strong>JSON shape:</strong> the outer <code>[ ]</code> is a list of
          pins, and each <code>{"{ }"}</code> inside it is one pin. Keep field
          names exactly as written. Change only the values. JSON requires
          double quotes around field names and text values.
        </p>
      </Section>

      <Section icon="fluent-emoji-flat:magic-wand" title="AI prompt templates">
        <p className="text-sm text-neutral-700">
          These are the exact prompts stored in the project. Edit the matching
          file, then refresh this page to see your changes.
          These prompts generates JSON with help of AI for generating high quality pins from OUR Bulk Pins Generator.
        </p>
        
        <div className="mt-4 space-y-4">
          {TYPES.map((type) => (
            <details key={type} open={type === "news"} className="group rounded-md border border-neutral-200">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 font-semibold capitalize">
                <span>{type} prompt</span>
                <span className="text-xs font-normal text-neutral-500 group-open:hidden">Show prompt</span>
                <span className="hidden text-xs font-normal text-neutral-500 group-open:inline">Hide prompt</span>
              </summary>
              <div className="border-t border-neutral-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] text-neutral-500">prompts/{type}-prompt.md</span>
                  <CopyTextButton text={PROMPT_TEXT[type]} />
                </div>
                <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-md bg-neutral-950 p-4 text-xs leading-5 text-neutral-100">
                  {PROMPT_TEXT[type]}
                </pre>
              </div>
            </details>
          ))}
        </div>
      </Section>

      <Section icon="fluent-emoji-flat:framed-picture" title="Backgrounds">
        <p className="mb-2 text-sm text-neutral-700">
          Upload from your computer, build a custom gradient, or pick from
          the stock-photo library.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>
            <strong>Upload</strong> — your own images, stored in your private
            <code> backgrounds</code> folder. They reappear under{" "}
            <strong>Yours</strong> in the Library tab.
          </li>
          <li>
            <strong>Custom gradient</strong> — pick any two colors in the
            Library tab instead of scrolling through presets.
          </li>
          <li>
            <strong>Stock photos</strong> — curated backgrounds, ready to use.
          </li>
          <li>
            <strong>Blur</strong> — softens background images (20px by
            default); adjust the strength or turn it off per batch.
          </li>
        </ul>
        <p className="mt-2 text-xs text-neutral-500">
          Select <strong>one</strong> background to use it for every pin, or{" "}
          <strong>several</strong> to cycle them per pin. A per-item background
          (CSV/paste/JSON) always wins for that pin — it accepts a full URL,{" "}
          <code>default</code> (use the batch choice), or a Library name such
          as <code>Sunset</code> or <code>Stock 5</code> (hover a Library photo
          to see its name). With no background, the brand background color is
          used.
        </p>
      </Section>

      <Section icon="fluent-emoji-flat:link" title="Source link & redirector">
        <p className="text-sm text-neutral-700">
          Every pin&apos;s destination URL is wrapped in the monetized
          redirector:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">
{`https://techtreasure.sbs/redirector.html?url=<your-destination>`}
        </pre>
        <p className="mt-2 text-sm text-neutral-700">
          <strong>Quotes</strong> default the destination to{" "}
          <code>https://techtreasure.sbs</code> — change it, or supply a
          per-quote link, to point somewhere else. Clicks are counted per
          destination so you can track earnings.
        </p>
      </Section>

      <Section icon="fluent-emoji-flat:newspaper" title="News pins">
        <p className="text-sm text-neutral-700">
            News imports use separate copy for the image and Pinterest export: 
            <code>image_title</code> and <code>image_description</code> are 
            rendered on the image, while <code>title</code> and <code>description</code> are kept for the final Pinterest CSV. In the Breaking Newspaper template, the required <code>headline</code> is the large newspaper headline and <code>image_description</code> becomes the supporting copy.
        </p>
      </Section>

      <Section icon="fluent-emoji-flat:outbox-tray" title="Export options">
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>
            <strong>Export CSV</strong> — a Pinterest bulk-upload file with
            Title, Media URL, board, Description, redirector Link, Publish date,
            and Keywords.
          </li>
          <li>
            <strong>Download ZIP</strong> — all rendered pin images in an{" "}
            <code>images/</code> folder, plus the same publishable CSV bundled
            inside.
          </li>
        </ul>
      </Section>

      <Section icon="fluent-emoji-flat:coin" title="Credits">
        <p className="text-sm text-neutral-700">
          Credits come in two pools. Each successfully generated pin costs{" "}
          <strong>1 pin credit</strong> (rendering + hosting). Pins that call
          the AI additionally cost <strong>1 AI credit</strong>. Fully-detailed
          Without-AI imports skip the AI, so they spend pin credits only. If a
          pin fails (AI, render, or upload), nothing is spent on it. Free plans
          start with 20 AI credits + 20 pin credits.
        </p>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Icon name={icon} size={22} />
        {title}
      </h2>
      {children}
    </section>
  );
}
