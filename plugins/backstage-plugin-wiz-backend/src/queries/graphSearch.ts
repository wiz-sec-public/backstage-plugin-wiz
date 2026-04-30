export const GRAPH_SEARCH_QUERY = `
  query GraphSearchByAnnotations(
    $query: GraphEntityQueryInput,
    $projectId: String!,
    $first: Int,
    $after: String
  ) {
    graphSearch(
      query: $query
      projectId: $projectId
      first: $first
      after: $after
      quick: false
    ) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        entities {
          id
          type
          name
          providerUniqueId
        }
        aggregateCount
      }
    }
  }
`;
