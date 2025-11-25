# Wiz Plugin for Backstage

This plugin provides a user interface for viewing Wiz security information within Backstage.

## Features

- Display security issues and vulnerabilities in a comprehensive table view
- Severity-based issue categorization
- Real-time search functionality
- Pagination support
- Integration with Backstage catalog entities
- Support for various security annotations

## Installation

### Add the Frontend Plugin

```bash
# From your Backstage root directory
yarn --cwd packages/app add @wiz-sec/backstage-plugin-wiz
```

## Configuration

### Entity Annotations

Add the following annotations to your catalog entities:

```yaml
metadata:
  annotations:
    wiz.io/project-id: 'your-project-id'
    wiz.io/asset-id: 'your-asset-id'
    wiz.io/external-asset-id: 'your-external-asset-id'
    wiz.io/repository-external-id: 'your <org/repo>'
```

Available annotations:

- `wiz.io/project-id`: Wiz project identifier
- `wiz.io/asset-id`: Direct asset identifier in Wiz
- `wiz.io/external-asset-id`: External asset identifier (e.g., AWS resource ID)
- `wiz.io/repository-external-id`: Repository identifier for version control integration (e.g., demo-org/demo-repo)

## Features

### Search Functionality

- Real-time search for vulnerabilities by CVE IDs
- Search issues by rule or resource name

### Pagination

- Configurable page sizes (5, 10, 20 items)
- Load more data on demand
- Total count display

## Usage Examples

### Basic Implementation

```typescript
// packages/app/src/components/catalog/EntityPage.tsx

import {
  BackstagePluginWizPage
} from "@wiz-sec/backstage-plugin-wiz";

...

const serviceEntityPage = (
  ...
  <EntityLayout.Route
    path="/wiz"
    title="Wiz"
  >
    <BackstagePluginWizPage />
  </EntityLayout.Route>
);
```

### Entity Integration

```yaml
# catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    wiz.io/project-id: 'proj-123'
    wiz.io/external-asset-id: 'aws-resource-789'
```

## Troubleshooting

Common issues and solutions:

1. No data displayed
   - Verify entity annotations are correct
   - Check backend connectivity
   - Validate API credentials
