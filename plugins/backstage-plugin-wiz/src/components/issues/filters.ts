import { EntityIds } from '../../types';

export type Filters = {
  project?: string[];
  relatedEntity?: {
    ids?: string[];
  };
  search?: string;
};

export const buildFilterBy = (
  entityIds: EntityIds,
  searchText?: string,
): Filters => {
  const filter: Filters = {};

  if (entityIds.projectIds.length > 0) {
    filter.project = entityIds.projectIds;
  }

  // Create arrays of IDs for intersection
  const idSets = [
    entityIds.directAssetIds.length ? entityIds.directAssetIds : null,
    entityIds.cloudResourceIds.length ? entityIds.cloudResourceIds : null,
    entityIds.versionControlIds.length ? entityIds.versionControlIds : null,
  ].filter((ids): ids is string[] => ids !== null);

  let resolvedIds: string[] = [];
  if (idSets.length > 0) {
    // Find intersection of all ID sets
    resolvedIds = idSets.reduce((intersection, currentIds) => {
      if (intersection.length === 0) return currentIds;
      return intersection.filter(id => currentIds.includes(id));
    }, [] as string[]);
  }

  // Union with graph search entity IDs (these come from K8S graph traversal)
  const allIds = [
    ...new Set([...resolvedIds, ...entityIds.graphEntityIds]),
  ];

  if (allIds.length > 0) {
    filter.relatedEntity = { ids: allIds };
  }

  if (searchText?.trim()) {
    filter.search = searchText.trim();
  }

  return filter;
};
