import { Entity } from '@backstage/catalog-model';
import { EmptyState, Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  MissingAnnotationEmptyState,
  useEntity,
} from '@backstage/plugin-catalog-react';
import { useEffect, useState } from 'react';
import { WizAPI, wizApiRef } from '../api';
import { EntityIds, IdsResult, GraphSearchResult } from '../types';
import {
  WIZ_ASSET_ANNOTATION,
  WIZ_EXTERNAL_ASSET_ANNOTATION,
  WIZ_PROJECT_ANNOTATION,
  WIZ_REPO_ANNOTATION,
  WIZ_K8S_ANNOTATIONS_ANNOTATION,
} from '../utils/constants';
import { Overview } from './Overview';

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

/**
 * Parses the wiz.io/kubernetes-annotations annotation value into key-value pairs.
 * Supports comma-separated "key=value" pairs.
 * Example: "nos.pt/backstage-component=batch,nos.pt/backstage-system=WACS"
 */
function parseKubernetesAnnotations(
  annotation: string | undefined,
): Array<{ key: string; value: string }> {
  if (!annotation) return [];
  return annotation
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.includes('='))
    .map(tag => {
      const eqIndex = tag.indexOf('=');
      return {
        key: tag.substring(0, eqIndex).trim(),
        value: tag.substring(eqIndex + 1).trim(),
      };
    })
    .filter(tag => tag.key && tag.value);
}

async function getGraphSearchIds(
  annotations: Array<{ key: string; value: string }>,
  wizApi: WizAPI,
  projectId?: string,
): Promise<GraphSearchResult> {
  try {
    return await wizApi.fetchGraphSearch(annotations, projectId);
  } catch (error) {
    return {
      entityIds: [],
      containerImageIds: [],
    };
  }
}

export const isWizAvailable = (entity: Entity) => {
  return Boolean(
    entity?.metadata.annotations?.[WIZ_PROJECT_ANNOTATION] ||
      entity?.metadata.annotations?.[WIZ_K8S_ANNOTATIONS_ANNOTATION],
  );
};

export const areWizAnnotationsMissing = (entity: Entity) => {
  const annotations = entity?.metadata.annotations || {};

  const requiredAnnotations = [
    WIZ_PROJECT_ANNOTATION,
    WIZ_ASSET_ANNOTATION,
    WIZ_EXTERNAL_ASSET_ANNOTATION,
    WIZ_REPO_ANNOTATION,
    WIZ_K8S_ANNOTATIONS_ANNOTATION,
  ];

  const hasRequiredAnnotation = requiredAnnotations.some(
    annotation => annotations[annotation],
  );

  return !hasRequiredAnnotation;
};

const MainPage = () => {
  const { entity } = useEntity();
  const api = useApi(wizApiRef);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();
  const [entityIds, setEntityIds] = useState<EntityIds>({
    cloudResourceIds: [],
    versionControlIds: [],
    directAssetIds: [],
    projectIds: [],
    graphEntityIds: [],
    graphContainerImageIds: [],
  });

  useEffect(() => {
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
        const emptyGraphResult: GraphSearchResult = {
          entityIds: [],
          containerImageIds: [],
        };

        // Parse kubernetes annotations for graph search
        const k8sAnnotations = parseKubernetesAnnotations(
          annotations[WIZ_K8S_ANNOTATIONS_ANNOTATION],
        );

        const [cloudResourcesResult, versionControlResult, graphSearchResult] =
          await Promise.all([
            externalAssetIds?.length
              ? getCloudResourceIds(externalAssetIds, api)
              : emptyResult,
            repoIds?.length ? getVersionControlIds(repoIds, api) : emptyResult,
            k8sAnnotations.length > 0
              ? getGraphSearchIds(
                  k8sAnnotations,
                  api,
                  projectIds.length === 1 ? projectIds[0] : undefined,
                )
              : emptyGraphResult,
          ]);

        // Handle errors
        if (cloudResourcesResult.error) {
          throw new Error(
            `Failed to fetch cloud resources: ${cloudResourcesResult.error.message}`,
          );
        }
        if (versionControlResult.error) {
          throw new Error(
            `Failed to fetch version control resources: ${versionControlResult.error.message}`,
          );
        }

        // Set all IDs
        setEntityIds({
          cloudResourceIds: cloudResourcesResult.ids || [],
          versionControlIds: versionControlResult.ids || [],
          directAssetIds,
          projectIds,
          graphEntityIds: graphSearchResult.entityIds,
          graphContainerImageIds: graphSearchResult.containerImageIds,
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch IDs'));
      } finally {
        setLoading(false);
      }
    }

    fetchIds();
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
    return (
      <EmptyState
        title="Error Loading Data"
        description={error.message}
        missing="info"
      />
    );
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
          description="No Wiz resources, projects, repositories, cloud assets or kubernetes annotations were found for this entity."
          missing="info"
        />
      );
    }

    return <Overview entityIds={entityIds} />;
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
