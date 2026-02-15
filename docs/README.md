# Storybook MCP Documentation

This directory contains Mintlify documentation for the Storybook MCP package.

## Structure

```
docs/
├── introduction.mdx          # Landing page
├── quickstart.mdx           # 5-minute setup guide
├── installation.mdx         # Detailed installation
├── configuration.mdx        # Configuration options
├── features/                # Feature guides
│   ├── auto-sync.mdx
│   ├── frameworks.mdx
│   └── cli-flags.mdx
├── mcp-setup/              # MCP client setup
│   ├── cursor.mdx
│   ├── claude-desktop.mdx
│   └── programmatic.mdx
├── api-reference/          # Tool documentation
│   ├── overview.mdx
│   ├── list-components.mdx
│   ├── analyze-component.mdx
│   ├── generate-story.mdx
│   ├── generate-test.mdx
│   ├── generate-docs.mdx
│   ├── validate-story.mdx
│   ├── sync-all.mdx
│   ├── sync-component.mdx
│   ├── get-component-coverage.mdx
│   ├── suggest-stories.mdx
│   └── check-health.mdx
├── templates/              # Template showcase
│   ├── overview.mdx
│   ├── basic.mdx
│   ├── with-variants.mdx
│   ├── with-msw.mdx
│   ├── with-router.mdx
│   ├── interactive.mdx
│   └── form.mdx
└── license/                # License info
    ├── pricing.mdx
    └── activation.mdx
```

## Local Development

Install Mintlify CLI:

```bash
npm install -g mintlify
```

Preview docs locally:

```bash
mintlify dev
```

## Deployment

Docs are automatically deployed to Mintlify when pushed to main branch.

## Auto-Generation

Use the doc generator script to auto-create API reference pages:

```bash
npm run docs:generate
```

This reads `src/tools.ts` and creates MDX pages for each tool.

## Maintenance

When adding new tools:
1. Add tool to `src/tools.ts`
2. Run `npm run docs:generate`
3. Add page to `mint.json` navigation
4. Commit changes

## Style Guide

- Use Mintlify components (Card, Accordion, Tabs)
- Include code examples for every parameter
- Add "Related Tools" section at bottom
- Use icons from Font Awesome
- Keep pages under 500 lines

## Links

- [Mintlify Docs](https://mintlify.com/docs)
- [Mintlify Components](https://mintlify.com/docs/components)
- [Live Site](https://storybook-mcp.mintlify.app) (when deployed)
