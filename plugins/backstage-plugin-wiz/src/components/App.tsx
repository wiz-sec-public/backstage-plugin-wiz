import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { EmptyState, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  MissingAnnotationEmptyState,
  useEntity,
} from '@backstage/plugin-catalog-react';
import { useEffect, useState } from 'react';
import { WizAPI, wizApiRef } from '../api';
import { EntityIds, IdsResult } from '../types';
import {
  WIZ_ASSET_ANNOTATION,
  WIZ_EXTERNAL_ASSET_ANNOTATION,
  WIZ_PROJECT_ANNOTATION,
  WIZ_REPO_ANNOTATION,
} from '../utils/constants';
import { Overview } from './Overview';
import { WizErrorState } from './shared/WizErrorState';

async function getCloudResourceIds(
  externalIds: readonly string[],
  wizApi: WizAPI,
): Promise<IdsResult> {
  try {
    const response = await wizApi.fetchCloudResources({
      providerUniqueId: externalIds,
    });
    return {
      ids: response.data.cloudResources.nodes?.map(node => node.id) || [],
    };
  } catch (error) {
    return {
      ids: [],
      error:
        error instanceof Error
          ? error
          : new Error('Failed to fetch cloud resources'),
    };
  }
}

async function getVersionControlIds(
  repoIds: string[],
  wizApi: WizAPI,
): Promise<IdsResult> {
  try {
    const response = await wizApi.fetchVersionControlResources({
      search: repoIds,
    });
    return {
      ids:
        response.data.versionControlResources.nodes?.map(node => node.id) || [],
    };
  } catch (error) {
    return {
      ids: [],
      error:
        error instanceof Error
          ? error
          : new Error('Failed to fetch version control resources'),
    };
  }
}

export const isWizAvailable = (entity: Entity) => {
  return Boolean(entity?.metadata.annotations?.[WIZ_PROJECT_ANNOTATION]);
};

export const areWizAnnotationsMissing = (entity: Entity) => {
  const annotations = entity?.metadata.annotations || {};

  const requiredAnnotations = [
    WIZ_PROJECT_ANNOTATION,
    WIZ_ASSET_ANNOTATION,
    WIZ_EXTERNAL_ASSET_ANNOTATION,
    WIZ_REPO_ANNOTATION,
  ];

  const hasRequiredAnnotation = requiredAnnotations.some(
    annotation => annotations[annotation],
  );

  return !hasRequiredAnnotation;
};

const EMPTY_ENTITY_IDS: EntityIds = {
  cloudResourceIds: [],
  versionControlIds: [],
  directAssetIds: [],
  projectIds: [],
};

const MainPage = () => {
  const { entity } = useEntity();
  const api = useApi(wizApiRef);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();
  const [entityIds, setEntityIds] = useState<EntityIds>(EMPTY_ENTITY_IDS);

  // When the user switches to a different catalog entity, drop the previous
  // entity's resolved state *during render* so the Overview subtree unmounts
  // and re-resolves from a clean slate. Otherwise `loading` stays false and the
  // old widgets linger with stale entityIds while `resetKey` (the entity ref)
  // has already flipped — a late RATE_LIMITED response for the old entity would
  // then flip the banner onto the new one. React's documented "adjust state on
  // prop change" pattern, as used in WizRateLimitContext. See WZ-113816.
  const entityRef = entity ? stringifyEntityRef(entity) : undefined;
  const [prevEntityRef, setPrevEntityRef] = useState(entityRef);
  if (entityRef !== prevEntityRef) {
    setPrevEntityRef(entityRef);
    setLoading(true);
    setError(undefined);
    setEntityIds(EMPTY_ENTITY_IDS);
  }

  useEffect(() => {
    // Guard against a slow fetch for a prior entity resolving after the user
    // switches entities: only the latest effect run may commit state. Mirrors
    // the requestId/isStale guard the data widgets use. See WZ-113816.
    let cancelled = false;

    async function fetchIds() {
      if (!entity) return;

      try {
        const annotations = entity.metadata.annotations || {};

        // Get project IDs
        const projectIds =
          annotations[WIZ_PROJECT_ANNOTATION]?.split(',').map(id =>
            id.trim(),
          ) || [];

        // Get direct asset IDs
        const directAssetIds =
          annotations[WIZ_ASSET_ANNOTATION]?.split(',').map(id => id.trim()) ||
          [];

        // Get external asset IDs
        const externalAssetIds = annotations[
          WIZ_EXTERNAL_ASSET_ANNOTATION
        ]?.split(',').map(id => id.trim());

        // Get repo IDs
        const repoIds = annotations[WIZ_REPO_ANNOTATION]?.split(',').map(id =>
          id.trim(),
        );

        // Fetch IDs from external sources
        const emptyResult: IdsResult = { ids: [] };
        const [cloudResourcesResult, versionControlResult] = await Promise.all([
          externalAssetIds?.length
            ? getCloudResourceIds(externalAssetIds, api)
            : emptyResult,
          repoIds?.length ? getVersionControlIds(repoIds, api) : emptyResult,
        ]);

        if (cancelled) return;

        // Re-throw the original error so its WizError type (e.g. RATE_LIMITED)
        // is preserved for WizErrorState. Wrapping with `new Error(...)` would
        // strip the type and force the generic error panel.
        if (cloudResourcesResult.error) {
          throw cloudResourcesResult.error;
        }
        if (versionControlResult.error) {
          throw versionControlResult.error;
        }

        // Set all IDs
        setEntityIds({
          cloudResourceIds: cloudResourcesResult.ids || [],
          versionControlIds: versionControlResult.ids || [],
          directAssetIds,
          projectIds,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to fetch IDs'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchIds();

    return () => {
      cancelled = true;
    };
  }, [entity, api]);

  // Handle initial states
  if (!entity) {
    return (
      <EmptyState
        title="No Entity Context"
        description="This plugin must be used within an entity page."
        missing="info"
      />
    );
  }

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <WizErrorState error={error} />;
  }

  try {
    if (areWizAnnotationsMissing(entity)) {
      return (
        <MissingAnnotationEmptyState annotation={WIZ_PROJECT_ANNOTATION} />
      );
    }

    if (Object.values(entityIds).every(arr => arr.length === 0)) {
      return (
        <EmptyState
          title="No Resources Found"
          description="No Wiz resources and projects, repositories or cloud assets were found for this entity."
          missing="info"
        />
      );
    }

    return (
      <Overview entityIds={entityIds} resetKey={stringifyEntityRef(entity)} />
    );
  } catch {
    return (
      <EmptyState
        title="No Entity Context"
        description="This plugin must be used within an entity page."
        missing="info"
      />
    );
  }
};

export const App = () => {
  return <MainPage />;
};
