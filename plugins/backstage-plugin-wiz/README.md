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
yarn add --cwd packages/app @wiz-sec/backstage-plugin-wiz
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
    wiz/project-id: 'proj-123'
    wiz/external-asset-id: 'aws-resource-789'
```

## New Frontend System

Follow these steps to detect and configure the Wiz plugin if you'd like to use it in an application that supports the new Backstage frontend system.

### Package Detection

Once you install the `@wiz-sec/backstage-plugin-wiz` package using your preferred package manager, you have to choose how the package should be detected by the app. The package can be automatically discovered when the feature discovery config is set, or it can be manually enabled via code (for more granular package customization cases).

<table>
  <tr>
    <td>Via config</td>
    <td>Via code</td>
  </tr>
  <tr>
    <td>
      <pre lang="yaml">
        <code>
# app-config.yaml
  app:
    # Enable package discovery for all plugins
    packages: 'all'
  ---
  app:
    # Enable package discovery only for Wiz
    packages:
      include:
        - '@wiz-sec/backstage-plugin-wiz'
        </code>
      </pre>
    </td>
    <td>
      <pre lang="javascript">
       <code>
// packages/app/src/App.tsx
import { createApp } from '@backstage/frontend-defaults';
import wizPlugin from '@wiz-sec/backstage-plugin-wiz/alpha';
//...
const app = createApp({
  // ...
  features: [
    //...
    wizPlugin,
  ],
});

//...
       </code>
      </pre>
    </td>
  </tr>
</table>

### Extensions Configuration

Currently, the plugin installs 2 extensions: 1 api and 1 entity page content (also known as entity page tab), see below examples of how to configure the available extensions. 

```yml
# app-config.yaml
app:
  extensions:
    # Example disabling the Wiz entity content
    - 'entity-content:wiz': false
    # Example customizing the Wiz entity content
    - 'entity-content:wiz':
        config:
          path: '/security'
          title: 'Security'
```

## Troubleshooting

Common issues and solutions:

1. No data displayed
   - Verify entity annotations are correct
   - Check backend connectivity
   - Validate API credentials
