// Knowledge-base article suggestion by TF-IDF cosine similarity.
//
// Each article is flattened into a weighted bag of words: a term in the title
// counts three times, in the tags twice, in the body once. IDF is computed over
// the supplied article set, so terms common to every article (the vocabulary of
// the helpdesk itself) contribute little and distinguishing terms dominate.
// Cosine similarity against the query then gives a length-normalised 0..1 score,
// so a short article is not penalised against a long one.

export interface KbSuggestion {
  id: string
  slug: string
  title: string
  score: number
}

const TITLE_WEIGHT = 3
const TAGS_WEIGHT = 2
const BODY_WEIGHT = 1

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'having', 'i', 'me',
  'my', 'mine', 'we', 'us', 'our', 'ours', 'you', 'your', 'yours', 'he',
  'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their',
  'theirs', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'about', 'against',
  'between', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again',
  'further', 'once', 'here', 'there', 'when', 'where', 'all', 'any', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'too', 'very', 'can', 'will', 'just',
  'should', 'would', 'could', 'may', 'might', 'must', 'please', 'also',
  'as', 'by', 'while',
])

interface Article {
  id: string
  slug: string
  title: string
  body: string
  tags: string
  category: string
}

/** Lowercase, strip punctuation, drop stopwords. */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token))
}

/** Add tokens into a term-frequency map, each occurrence worth `weight`. */
function addTerms(target: Map<string, number>, tokens: string[], weight: number): void {
  for (const token of tokens) {
    target.set(token, (target.get(token) ?? 0) + weight)
  }
}

/**
 * Weighted term frequencies for one article: title counts triple, tags double,
 * body single. The category is folded in alongside the tags — it is a
 * meaningful retrieval signal ("network", "hardware") that users type.
 */
function articleTermFrequencies(article: Article): Map<string, number> {
  const tf = new Map<string, number>()
  addTerms(tf, tokenise(article.title), TITLE_WEIGHT)
  addTerms(tf, tokenise(article.tags), TAGS_WEIGHT)
  addTerms(tf, tokenise(article.category), TAGS_WEIGHT)
  addTerms(tf, tokenise(article.body), BODY_WEIGHT)
  return tf
}

/** Cosine similarity of two sparse TF-IDF vectors. */
function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  for (const [term, weight] of a) {
    const other = b.get(term)
    if (other !== undefined) dot += weight * other
  }
  if (dot === 0) return 0

  let magA = 0
  for (const weight of a.values()) magA += weight * weight
  let magB = 0
  for (const weight of b.values()) magB += weight * weight

  const denominator = Math.sqrt(magA) * Math.sqrt(magB)
  return denominator === 0 ? 0 : dot / denominator
}

/** Scale a term-frequency map by per-term IDF. */
function applyIdf(tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  for (const [term, freq] of tf) {
    const weight = idf.get(term)
    // Terms absent from the corpus can never match an article — drop them.
    if (weight !== undefined) out.set(term, freq * weight)
  }
  return out
}

/**
 * Suggest the `limit` most relevant published articles for a draft ticket.
 *
 * Only articles with a score strictly above zero are returned, so a query that
 * genuinely matches nothing yields an empty list rather than three irrelevant
 * articles — the widget stays quiet instead of crying wolf.
 */
export function suggestArticles(
  query: string,
  articles: Article[],
  limit: number = 3,
): KbSuggestion[] {
  if (articles.length === 0 || limit <= 0) return []

  const queryTf = new Map<string, number>()
  addTerms(queryTf, tokenise(query), 1)
  if (queryTf.size === 0) return []

  const articleTfs = articles.map(articleTermFrequencies)

  // Smoothed IDF over the article set. The +1s keep the value strictly
  // positive, so a term present in every article still contributes a little
  // rather than zeroing out an otherwise perfect match.
  const documentFrequency = new Map<string, number>()
  for (const tf of articleTfs) {
    for (const term of tf.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
    }
  }
  const idf = new Map<string, number>()
  for (const [term, df] of documentFrequency) {
    idf.set(term, Math.log((articles.length + 1) / (df + 1)) + 1)
  }

  const queryVector = applyIdf(queryTf, idf)
  if (queryVector.size === 0) return []

  return articles
    .map((article, index) => ({
      id: article.id,
      slug: article.slug,
      title: article.title,
      score: cosine(queryVector, applyIdf(articleTfs[index]!, idf)),
    }))
    .filter((suggestion) => suggestion.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
}
