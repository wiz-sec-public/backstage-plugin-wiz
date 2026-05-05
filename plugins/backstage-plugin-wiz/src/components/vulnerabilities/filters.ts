import { EntityIds } from '../../types';

export type Filters = {
  projectId?: string[];
  assetId?: string[];
  vulnerabilityExternalId?: string[];
};

export const buildFilterBy = (
  entityIds: EntityIds,
  searchText?: string,
): Filters => {
  const filter: Filters = {};

  if (entityIds.projectIds.length > 0) {
    filter.projectId = entityIds.projectIds;
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

  // Union with container image IDs (discovered via K8S graph traversal)
  // Only container images are valid for vulnerability findings queries;
  // K8s resource entity IDs (deployments, configmaps, etc.) are NOT valid
  const allAssetIds = [
    ...new Set([...resolvedIds, ...entityIds.graphContainerImageIds]),
  ];

  if (allAssetIds.length > 0) {
    filter.assetId = allAssetIds;
  }

  if (searchText?.trim()) {
    filter.vulnerabilityExternalId = searchText
      .trim()
      .split(',')
      .map(id => id.trim());
  }

  return filter;
};
