import { EntityIds, EntityTag } from '../../types';

export type Filters = {
  project?: string[];
  relatedEntity?: {
    ids?: string[];
    tag?: {
      containsAll: EntityTag[];
    };
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

  if (idSets.length > 0) {
    // Find intersection of all ID sets
    const allIds = idSets.reduce((intersection, currentIds) => {
      if (intersection.length === 0) return currentIds;
      return intersection.filter(id => currentIds.includes(id));
    }, [] as string[]);

    if (allIds.length > 0) {
      filter.relatedEntity = { ids: allIds };
    }
  }

  // Add resource tag filtering
  if (entityIds.entityTags.length > 0) {
    filter.relatedEntity = {
      ...(filter.relatedEntity || {}),
      tag: { containsAll: entityIds.entityTags },
    };
  }

  if (searchText?.trim()) {
    filter.search = searchText.trim();
  }

  return filter;
};
