/**
 * Deterministic local embeddings for the pgvector novelty feature.
 *
 * The demo intentionally avoids an external embedding API: text is expanded
 * with a small ESG synonym dictionary, hashed into a 384-dimensional vector
 * (signed feature hashing) and L2-normalised. This keeps the project fully
 * reproducible offline. Swap `embedText` for a hosted embedding model in
 * production without changing the database or search API.
 */

export const EMBEDDING_DIMENSIONS = 384;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'by', 'for',
  'from', 'has', 'have', 'he', 'her', 'his', 'in', 'is', 'it', 'its', 'of',
  'on', 'or', 'our', 'she', 'that', 'the', 'their', 'them', 'there', 'these',
  'they', 'this', 'to', 'was', 'we', 'were', 'will', 'with', 'would', 'you',
]);

const PHRASE_EXPANSIONS: Array<[RegExp, string]> = [
  [/\bghg\b|greenhouse gas(es)?/gi, 'greenhouse gas carbon emissions accounting inventory'],
  [/\biso\s*14064\b/gi, 'carbon footprint verification standard assurance iso 14064'],
  [/\biso\s*14001\b/gi, 'environmental management system standard certification iso 14001'],
  [/\bscope\s*1\b/gi, 'scope 1 direct emissions fuel combustion fleet'],
  [/\bscope\s*2\b/gi, 'scope 2 purchased electricity energy indirect emissions'],
  [/\bscope\s*3\b/gi, 'scope 3 supply chain value chain logistics upstream downstream emissions'],
  [/\bnet\s*zero\b/gi, 'net zero carbon neutral emissions reduction target'],
  [/\brenewable\b/gi, 'renewable energy solar wind green power'],
  [/\baudit(ed|ing|or)?\b/gi, 'audit verification assurance compliance review'],
  [/\boffset(s|ting)?\b/gi, 'carbon offset credit removal compensation'],
  [/\besg\b/gi, 'esg environmental social governance sustainability disclosure'],
  [/\bsbti\b|science[- ]based targets?/gi, 'science based targets initiative emission reduction pathway'],
  [/\bcsrd\b/gi, 'csrd corporate sustainability reporting directive disclosure'],
  [/\bverified\b|\bverification\b/gi, 'verification assurance third party independent'],
  [/\bsupply\s*chain\b/gi, 'supply chain procurement vendor logistics upstream downstream'],
];

const WORD_EXPANSIONS: Record<string, string> = {
  ghg: 'greenhouse gas carbon',
  co2: 'carbon dioxide emissions',
  co2e: 'carbon dioxide equivalent emissions',
  esg: 'sustainability governance disclosure',
  carbon: 'emissions greenhouse gas',
  climate: 'carbon emissions environment',
  energy: 'electricity power consumption',
  freight: 'logistics transport shipping',
  fleet: 'vehicles transport fuel',
  supplier: 'vendor procurement supply chain',
  vendors: 'supplier procurement',
  compliance: 'conformance regulation audit',
  report: 'disclosure reporting',
  reporting: 'disclosure report',
  emissions: 'carbon greenhouse gas',
  emission: 'carbon greenhouse gas',
  sustainability: 'esg environmental',
};

function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return normalise(text)
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .split(/[\s/-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expand(text: string): string {
  const additions: string[] = [];
  for (const [pattern, expansion] of PHRASE_EXPANSIONS) {
    if (pattern.test(text)) additions.push(expansion);
    pattern.lastIndex = 0;
  }
  return additions.join(' ');
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function addToken(vector: Float64Array, token: string, weight: number) {
  const hash = hash32(token);
  const index = hash % EMBEDDING_DIMENSIONS;
  const sign = (hash >>> 13) & 1 ? 1 : -1;
  vector[index] += sign * weight;
}

/**
 * Convert free text into a normalised 384-dimensional vector.
 */
export function embedText(text: string): number[] {
  const normalised = normalise(text);
  const expandedText = `${normalised} ${expand(normalised)}`;
  const tokens = tokenize(expandedText);

  const vector = new Float64Array(EMBEDDING_DIMENSIONS);

  tokens.forEach((token, index) => {
    addToken(vector, token, 1);
    const expansion = WORD_EXPANSIONS[token];
    if (expansion) {
      expansion.split(' ').forEach((word) => addToken(vector, word, 0.35));
    }
    if (index > 0) {
      addToken(vector, `${tokens[index - 1]}_${token}`, 0.55);
    }
  });

  let magnitude = 0;
  for (let i = 0; i < vector.length; i += 1) magnitude += vector[i] * vector[i];
  magnitude = Math.sqrt(magnitude) || 1;

  return Array.from(vector, (value) => Number((value / magnitude).toFixed(7)));
}

/**
 * pgvector accepts a textual vector literal such as "[0.1,0.2,...]".
 */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export function buildDocumentEmbedding(input: {
  vendor_name: string;
  raw_text: string;
  compliance_tags?: string[];
  reporting_year?: number;
}): number[] {
  const tagText = (input.compliance_tags ?? []).join(' ');
  return embedText(
    `${input.vendor_name} ${input.vendor_name} ${tagText} ${tagText} ${input.raw_text} ${input.reporting_year ?? ''}`,
  );
}
