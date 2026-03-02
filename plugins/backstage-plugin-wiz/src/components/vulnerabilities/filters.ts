import { EntityIds, EntityTag } from '../../types';

export type Filters = {
  projectId?: string[];
  assetId?: string[];
  vulnerabilityExternalId?: string[];
  assetTags?: {
    containsAny: EntityTag[];
  };
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

  if (idSets.length > 0) {
    // Find intersection of all ID sets
    const allIds = idSets.reduce((intersection, currentIds) => {
      if (intersection.length === 0) return currentIds;
      return intersection.filter(id => currentIds.includes(id));
    }, [] as string[]);

    if (allIds.length > 0) {
      filter.assetId = allIds;
    }
  }

  // Add resource tag filtering
  if (entityIds.entityTags.length > 0) {
    filter.assetTags = { containsAny: entityIds.entityTags };
  }

  if (searchText?.trim()) {
    filter.vulnerabilityExternalId = searchText
      .trim()
      .split(',')
      .map(id => id.trim());
  }

  return filter;
};
