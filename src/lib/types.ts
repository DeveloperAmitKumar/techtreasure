export type Plan = "free" | "pro" | "pro_plus" | "pro_max";
export type ContentType = "news" | "quote" | "fact";
export type NewsTemplate = "magazine" | "newspaper";

export interface Profile {
  id: string;
  email: string;
  plan: Plan;
  /** Pin credits: rendering + hosting, spent by every generated pin. */
  credits: number;
  /** AI credits: Gemini metadata, spent only by pins that call the AI. */
  ai_credits: number;
  language: string;
  gemini_api_key: string | null;
  use_custom_gemini_key: boolean;
  created_at: string;
}

export interface Brand {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  icon_name: string | null;
  text_color: string;
  bg_color: string;
  font: string;
  created_at: string;
}

export interface SavedBoard {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  pinterest_url: string | null;
  created_at: string;
}

export interface Batch {
  id: string;
  user_id: string;
  brand_id: string;
  board_name: string;
  source_link: string;
  content_type: ContentType;
  language: string;
  created_at: string;
  brand?: Brand;
}

export interface Pin {
  id: string;
  user_id: string;
  batch_id: string;
  title: string;
  description: string;
  tags: string[];
  main_line: string;
  cta: string;
  image_url: string;
  source_link: string | null;
  scheduled_at: string;
  created_at: string;
}

export interface Redirect {
  id: string;
  user_id: string;
  source_link: string;
  clicks: number;
  created_at: string;
}

export interface GeneratedMeta {
  title: string;
  description: string;
  tags: string[];
  main_line: string;
  cta: string;
  /** Tiny source credit used by news templates (bottom corner). */
  source?: string;
  /** News-only copy rendered on the image, separate from Pinterest metadata. */
  image_title?: string;
  image_description?: string;
  headline?: string;
}

// A single resolved input row for a batch. `text` is the quote/fact/headline.
// author/link/bgUrl are optional per-item overrides. title/description/tags/
// cta/mainLine are optional per-item details: any field left empty falls back
// to the AI-generated default for that pin. (Quotes always render `text` as
// the pin's main line, so `mainLine` is ignored for quotes.)
export interface PinItem {
  text: string;
  author?: string;
  link?: string;
  bgUrl?: string;
  title?: string;
  description?: string;
  tags?: string[];
  cta?: string;
  mainLine?: string;
  /** Tiny source credit used by news templates (bottom corner). */
  source?: string;
  /** News-only Pinterest export fields. */
  pinterestTitle?: string;
  pinterestDescription?: string;
  /** News-only image fields, never used for the final Pinterest CSV. */
  imageTitle?: string;
  imageDescription?: string;
  headline?: string;
}

export const SITE_HOME_URL = "https://techtreasure.sbs";

// Per-content-type configuration: the required CSV column, optional columns,
// and the sample rows shown in the guides + CSV template downloads.
export interface CsvSpec {
  columns: string[];
  required: string[];
  samples: Record<string, string>[];
}

export const CSV_SPECS: Record<ContentType, CsvSpec> = {
  quote: {
    columns: ["quote", "author", "link", "bg_url", "title", "description", "tags", "cta"],
    required: ["quote"],
    samples: [
      {
        quote: "The best way to predict the future is to invent it.",
        author: "Alan Kay",
        link: "https://techtreasure.sbs",
        bg_url: "default",
        title: "Invent the Future",
        description: "Alan Kay on why shaping tomorrow beats predicting it.",
        tags: "inspiration, motivation",
        cta: "Learn More",
      },
      {
        quote: "Simplicity is the ultimate sophistication.",
        author: "Leonardo da Vinci",
        link: "",
        bg_url: "",
        title: "Simplicity Wins",
        description: "Leonardo da Vinci on the power of simple design.",
        tags: "design, minimalism",
        cta: "Discover",
      },
    ],
  },
  news: {
    columns: ["headline", "source_link", "image_url", "image_title", "image_description", "title", "description", "source"],
    required: ["headline"],
    samples: [
      {
        headline: "New telescope captures sharpest image of a black hole",
        source_link: "https://example.com/article-1",
        image_url: "default",
        image_title: "Sharpest Black Hole Image Ever",
        image_description: "Astronomers combined signals from eight telescopes across five continents to reveal the clearest image yet.",
        title: "Sharpest Black Hole Image Ever",
        description: "Astronomers released the highest-resolution image of a distant black hole in a landmark global observation.",
        source: "Image Source: EHT Collaboration",
      },
      {
        headline: "Startup raises $40M to build modular EV batteries",
        source_link: "https://example.com/article-2",
        image_url: "",
        image_title: "Modular EV Batteries Raise $40M",
        image_description: "A startup is scaling swappable battery packs for electric vehicles across 12 cities.",
        title: "Modular EV Batteries Raise $40M",
        description: "The funding will support a new network of modular battery packs and faster charging stops.",
        source: "",
      },
    ],
  },
  fact: {
    columns: ["fact", "link", "bg_url", "title", "description", "tags", "main_line", "cta"],
    required: ["fact"],
    samples: [
      {
        fact: "Honey never spoils — edible after 3,000 years.",
        link: "https://techtreasure.sbs",
        bg_url: "Sunset",
        title: "Honey Never Spoils",
        description: "Archaeologists found edible honey in ancient Egyptian tombs.",
        tags: "food facts, did you know",
        main_line: "Honey never spoils — edible after 3,000 years",
        cta: "Learn More",
      },
      {
        fact: "Octopuses have three hearts.",
        link: "",
        bg_url: "",
        title: "Three Hearts",
        description: "An octopus pumps blood with three hearts, two of which rest while it swims.",
        tags: "animals, ocean, biology",
        main_line: "Octopuses have three hearts",
        cta: "Discover",
      },
    ],
  },
};

export const PLAN_CREDITS: Record<Plan, number> = {
  free: 20,
  pro: 10_000,
  pro_plus: 100_000,
  pro_max: 1_000_000,
};

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "hi", label: "Hindi" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
];

export const FONTS = [
  "Georgia, serif",
  "Helvetica, Arial, sans-serif",
  "'Times New Roman', serif",
  "Verdana, sans-serif",
  "'Trebuchet MS', sans-serif",
  "'Courier New', monospace",
  "'Inter', sans-serif",
  "'Playfair Display', Georgia, serif",
  "'Roboto Slab', Georgia, serif",
  "'Poppins', 'Helvetica Neue', Arial, sans-serif",
  "'Lora', Georgia, serif",
  "'Merriweather', Georgia, serif",
  "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
  "'Source Sans 3', 'Helvetica Neue', Arial, sans-serif",
  "'Oswald', 'Impact', sans-serif",
  "'Libre Baskerville', Georgia, serif",
  "'Nunito', sans-serif",
  "'Raleway', sans-serif",
  "'DM Sans', sans-serif",
  "'Work Sans', sans-serif",
  "'Space Grotesk', sans-serif",
  "'Roboto', sans-serif",
  "'Open Sans', sans-serif",
  "'Quicksand', sans-serif",
  "'Bebas Neue', 'Impact', sans-serif",
  "'Abril Fatface', Georgia, serif",
  "'Cormorant Garamond', Georgia, serif",
  "'Dancing Script', cursive",
];

export const BRAND_ICONS = [
  "fluent-emoji-flat:glowing-star",
  "fluent-emoji-flat:crown",
  "fluent-emoji-flat:fire",
  "fluent-emoji-flat:rocket",
  "fluent-emoji-flat:light-bulb",
  "fluent-emoji-flat:artist-palette",
  "fluent-emoji-flat:camera-with-flash",
  "fluent-emoji-flat:book",
  "fluent-emoji-flat:earth-globe-europe-africa",
  "fluent-emoji-flat:heart",
  "fluent-emoji-flat:diamond-with-a-dot",
  "fluent-emoji-flat:sparkles",
] as const;
