import QueryBuilder from './query-builder'
import { search, count } from './search-index/search'
import mapResultsToPouchDocs from './map-search-to-pouch'

/**
 * Results should always contain a `document` key containing the indexed doc.
 * In some special cases (if something is being removed, but t hasn't finished yet),
 * this could be `undefined`. May add more filters here if any other cases are encountered.
 */
const filterBadlyStructuredResults = results =>
    results.filter(result => result.document != null)

async function indexSearch({
    query,
    startDate,
    endDate,
    skip,
    limit = 10,
    getTotalCount = false,
}) {
    query = query.trim() // Don't count whitespace searches

    // Create SI query
    const indexQuery = new QueryBuilder()
        .searchTerm(query)
        .startDate(startDate)
        .endDate(endDate)
        .skipUntil(skip)
        .limit(limit)
        .get()

    // If there is only Bad Terms don't continue
    if (indexQuery.isBadTerm) {
        return {
            docs: [],
            resultsExhausted: true,
            totalCount: getTotalCount ? 0 : undefined,
            isBadTerm: true,
        }
    }

    // Get index results, filtering out any unexpectedly structured results
    console.log(indexQuery)
    let results = await search(indexQuery)
    results = filterBadlyStructuredResults(results)

    // Short-circuit if no results
    if (!results.length) {
        return {
            docs: [],
            resultsExhausted: true,
            totalCount: getTotalCount ? 0 : undefined,
            isBadTerm: false,
        }
    }

    console.log('YAY non-zero number of results', results)

    // Match the index results to data docs available in Pouch, consolidating meta docs
    const docs = await mapResultsToPouchDocs(results, { startDate, endDate })

    console.log('DOCS from results', docs)

    return {
        docs,
        resultsExhausted: false,
        totalCount: getTotalCount ? await count(indexQuery) : undefined,
        isBadTerm: false,
    }
}

// Export index interface
export { addPage, addPageConcurrent } from './search-index/add'
export { initSingleLookup } from './search-index/util'
export { default as del } from './search-index/del'
export { indexSearch as search }
