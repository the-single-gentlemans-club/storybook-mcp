# Go-to-Market Plan: ForgeKit Storybook MCP

## 1. Value Proposition
**"Stop writing Storybook boilerplate. Let your codebase write it for you."**

*   **Problem**: Developers hate writing stories. It's tedious, repetitive, and they often skip it, leading to poor documentation and visual bugs.
*   **Solution**: An AI-powered agent (MCP) that lives in your editor, understands your component's props/dependencies, and generates perfect stories, tests, and docs instantly.
*   **Differentiator**: It's not just a "snippet". It analyzes your code (React Query, Router, Gluestack, etc.) and mocks everything automatically.

## 2. Target Audience
*   **Primary**: Senior Frontend Engineers & Tech Leads using Cursor/Claude.
*   **Secondary**: Design System maintainers.
*   **Tech Stack**: React, Storybook, Chakra/Shadcn/Tamagui/Gluestack/React Native.

## 3. Launch Channels

### A. Twitter / X (The "Hype" Launch)
*   **Hook**: Video demo of deleting a story file and regenerating it in 2 seconds via chat.
*   **Copy**:
    > "I got tired of writing Storybook boilerplate. So I built an AI agent to do it.
    >
    > Meet `forgekit-storybook-mcp` ⚡️
    >
    > It scans your React components and auto-generates:
    > 📚 Stories with controls
    > 🧪 Interaction tests
    > 📱 Responsive variants
    > 📝 MDX documentation
    >
    > Works with Chakra, Shadcn, Gluestack & React Native.
    >
    > `npx forgekit-storybook-mcp`
    >
    > [Link to Repo/NPM]"

### B. Reddit (r/reactjs, r/webdev)
*   **Title**: "I built an MCP server that auto-maintains your Storybook"
*   **Body**: Focus on the technical implementation. Explain how it uses AST analysis to detect props and dependencies (React Query, Router) to generate robust mocks, not just empty shells.

### C. Product Hunt
*   **Tagline**: "Auto-sync your React components with Storybook."
*   **First Comment**: "I built this because I found myself copy-pasting the same `meta` and `StoryObj` boilerplate 10 times a day. Now I just type 'sync all' and my documentation is done."

## 4. Pricing Strategy (Freemium)

*   **Free Tier (The Hook)**:
    *   Unlimited basic stories.
    *   Manual sync (one by one).
    *   *Goal*: Get them addicted to the convenience.

*   **Pro Tier ($X/mo or One-time)**:
    *   **"Sync All"**: The killer feature. CI/CD integration that ensures NO component is ever undocumented.
    *   **Test Generation**: Writing Playwright/Vitest tests is high-value drudgery.
    *   **Advanced Mocks**: MSW handlers, complex form states.

## 5. Roadmap to Revenue

1.  **Phase 1 (Now)**: Release Free version. Gather feedback. Fix bugs.
2.  **Phase 2 (Traction)**: Reach 100 stars on GitHub or 1000 NPM downloads.
3.  **Phase 3 (Monetization)**: Launch the "Pro" key purchase page.
    *   *Upsell*: "You have 50 components without tests. Upgrade to generate them all in 1 click."

## 6. Action Items

- [ ] Record a 30s demo video (Cursor + Storybook side-by-side).
- [ ] Create a simple landing page (forgekit.cloud) to capture emails/sell keys.
- [ ] Post to Twitter/Reddit.
