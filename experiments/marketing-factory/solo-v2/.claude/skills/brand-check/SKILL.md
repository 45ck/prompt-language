# Skill: Brand Voice Verification

## Trigger

After generating or modifying marketing copy, or when asked to check brand compliance.

## Process

### 1. Filler Word Scan

Search all visible text content for these banned filler words (case-insensitive):

- "just"
- "really"
- "very"
- "actually"
- "basically"
- "simply"
- "obviously"
- "clearly"
- "literally"
- "stuff"
- "things"
- "etc"

If found, rewrite the sentence without the filler word.

### 2. CTA Verb Check

All call-to-action buttons and links must use one of these approved verbs:

**Approved**: Start, Deploy, Monitor, Get, Try, Explore, See, View, Download, Launch, Connect, Build, Create, Discover, Upgrade, Activate

**Banned patterns**: "Click here", "Learn more", "Submit", "Sign up now", "Buy now", "Act now", "Don't miss"

Check every `<a>` and `<button>` element.

### 3. Title Case Verification

All headings (h1-h6) must use Title Case:

- Capitalize the first letter of every major word.
- Do not capitalize articles (a, an, the), conjunctions (and, but, or, nor), or short prepositions (in, on, at, to, for, of, by, up) unless they are the first or last word.
- Always capitalize the first and last word.

### 4. Exclamation Mark Check

Search the entire document for exclamation marks (`!`). There should be zero exclamation marks in any copy, headings, CTAs, or alt text. The only acceptable exception is inside `<code>` blocks or JSON-LD schemas.

### 5. Product Name Consistency

Search for all variations of the product name:

- Correct: "CloudPulse" (one word, capital C and P)
- Incorrect: "Cloud Pulse", "Cloudpulse", "cloudpulse", "CLOUDPULSE", "Cloud-Pulse"

Every instance must match the correct spelling exactly.

### 6. Sentence Length Check

For every paragraph and description:

- Split text into sentences (by period, question mark).
- Count words in each sentence.
- Flag any sentence exceeding 20 words.
- Rewrite flagged sentences by splitting them or removing unnecessary words.

### 7. Voice and Tone

- Verify active voice is used throughout. Flag passive constructions ("is monitored by" should be "monitors").
- Verify the reader is addressed as "you/your". Flag excessive "we/our" outside testimonials.
- Verify numbers over 999 use commas (1,000 not 1000).
- Verify the tone is professional and confident, not casual or salesy.

## Output

List every violation found with its location and the corrected version. Apply all fixes before delivering.
