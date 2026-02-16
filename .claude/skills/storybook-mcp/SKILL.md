# storybook-mcp skill

Storybook MCP development and maintenance assistant.

## Description

Expert assistant for the forgekit-storybook-mcp project. Provides guidance on:
- Test suite management (Vitest 3.x configuration)
- Story template development
- Framework detection patterns
- Release workflow
- MCP tool development

## Usage

Invoke this skill when working on the storybook-mcp codebase or when you need to:
- Debug test failures
- Add new story templates
- Implement framework detection
- Prepare releases
- Understand project architecture

## Commands

### /storybook-mcp test
Run the test suite with proper environment configuration.

**Action:**
```bash
NODE_ENV=development npm test
```

**Validates:**
- All 124 tests passing
- Vitest 3.x compatibility
- Framework detection working

### /storybook-mcp release [patch|minor|major]
Prepare and publish a new release.

**Action:**
1. Run tests (must pass 124/124)
2. Update CHANGELOG
3. Bump version
4. Build package
5. Push to GitHub
6. Publish to npm (with OTP prompt)

**Example:**
```
/storybook-mcp release patch
```

### /storybook-mcp analyze
Analyze project health and configuration.

**Reports:**
- Test coverage status
- Dependency versions
- Framework detection coverage
- Template completeness
- Documentation status

### /storybook-mcp template <name>
Create or analyze a story template.

**Example:**
```
/storybook-mcp template with-context
```

## Knowledge Base

### Critical Constraints
- **Vitest**: Must be 3.x (NOT 4.x - has runner errors)
- **Node**: >=20.0.0
- **TypeScript**: moduleResolution: "node" (NOT "bundler")
- **Tests**: Import from 'vitest' with globals: false

### Framework Support
- Chakra UI (@chakra-ui)
- shadcn/ui (@radix-ui, class-variance-authority)
- Tamagui (tamagui, @tamagui)
- Gluestack UI (@gluestack-ui)
- React Native (react-native, expo-)

### Router Detection
Check BOTH:
- react-router
- react-router-dom

### Template Types
1. basic (Free)
2. with-controls (Pro)
3. with-variants (Pro)
4. with-msw (Pro - 5000ms timeout)
5. with-router (Pro)
6. page (Pro)
7. interactive (Pro)
8. form (Pro - flexible props)

## Quick Reference

### Run Tests
```bash
NODE_ENV=development npm test
```

### Build
```bash
npm run build
```

### Release Workflow
```bash
# 1. Update CHANGELOG
# 2. Commit CHANGELOG
git commit -m "docs: update CHANGELOG for vX.Y.Z"

# 3. Bump version
npm version patch

# 4. Build
npm run build

# 5. Push
git push origin master --tags

# 6. Publish
npm publish --otp=CODE --access public
```

### Key Files
- `src/tools.ts` - MCP tools
- `src/utils/scanner.ts` - Framework detection
- `src/utils/generator.ts` - Story generation
- `src/utils/templates.ts` - Story templates
- `src/utils/test-generator.ts` - Test generation
- `src/utils/docs-generator.ts` - Docs generation
- `src/utils/license.ts` - License validation

## Common Issues

### Tests Failing
1. Check Vitest version (must be 3.x)
2. Verify NODE_ENV=development
3. Check imports (must import from 'vitest')

### Windows Issues
- Use NODE_ENV=development for all npm commands
- Scripts use npx prefix for PATH compatibility

### Framework Detection
- Component-level via import analysis
- Check both base and -dom packages for routers
- Use importsFrom() helper in scanner.ts

## License Model
- **Free**: 5 components, basic template only
- **Pro**: $49 lifetime, unlimited, all features
- **Validation**: Polar.sh API (24h cache)
