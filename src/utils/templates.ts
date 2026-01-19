/**
 * Template Manager
 * Provides story templates for different use cases
 */

import type { StoryTemplate } from './types.js'

/**
 * Get all available templates
 */
export function getTemplates(): Map<string, StoryTemplate> {
  return templates
}

/**
 * Get a specific template by name
 */
export function getTemplate(name: string): StoryTemplate | undefined {
  return templates.get(name)
}

/**
 * Built-in story templates
 */
const templates = new Map<string, StoryTemplate>([
  ['basic', {
    name: 'basic',
    description: 'Simple story with basic args',
    useCase: 'Quick component documentation with minimal setup',
    placeholders: ['ComponentName', 'component-name'],
    content: `import type { Meta, StoryObj } from '@storybook/react'
import { {{ComponentName}} } from './{{ComponentName}}'

const meta: Meta<typeof {{ComponentName}}> = {
  title: 'Components/{{ComponentName}}',
  component: {{ComponentName}},
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof {{ComponentName}}>

export const Default: Story = {
  args: {
    children: '{{ComponentName}} content',
  },
}
`,
  }],

  ['with-controls', {
    name: 'with-controls',
    description: 'Story with full argTypes controls',
    useCase: 'Interactive component exploration with all props exposed',
    placeholders: ['ComponentName', 'component-name'],
    content: `import type { Meta, StoryObj } from '@storybook/react'
import { {{ComponentName}} } from './{{ComponentName}}'

const meta: Meta<typeof {{ComponentName}}> = {
  title: 'Components/{{ComponentName}}',
  component: {{ComponentName}},
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['solid', 'outline', 'ghost'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Component size',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    children: {
      control: 'text',
      description: 'Content to display',
    },
  },
  args: {
    variant: 'solid',
    size: 'md',
    disabled: false,
    children: '{{ComponentName}}',
  },
}

export default meta
type Story = StoryObj<typeof {{ComponentName}}>

/**
 * Default {{ComponentName}} with standard configuration
 */
export const Default: Story = {}

/**
 * Playground - all controls available
 */
export const Playground: Story = {
  args: {
    children: 'Play with the controls!',
  },
}
`,
  }],

  ['with-variants', {
    name: 'with-variants',
    description: 'Story showcasing all variants and sizes',
    useCase: 'Design system documentation showing all visual options',
    placeholders: ['ComponentName', 'component-name'],
    content: `import type { Meta, StoryObj } from '@storybook/react'
import { {{ComponentName}} } from './{{ComponentName}}'

const meta: Meta<typeof {{ComponentName}}> = {
  title: 'Components/{{ComponentName}}',
  component: {{ComponentName}},
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['solid', 'outline', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof {{ComponentName}}>

export const Default: Story = {
  args: {
    children: '{{ComponentName}}',
  },
}

/**
 * All size variants side by side
 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <{{ComponentName}} size="sm">Small</{{ComponentName}}>
      <{{ComponentName}} size="md">Medium</{{ComponentName}}>
      <{{ComponentName}} size="lg">Large</{{ComponentName}}>
    </div>
  ),
}

/**
 * All style variants side by side
 */
export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <{{ComponentName}} variant="solid">Solid</{{ComponentName}}>
      <{{ComponentName}} variant="outline">Outline</{{ComponentName}}>
      <{{ComponentName}} variant="ghost">Ghost</{{ComponentName}}>
    </div>
  ),
}

/**
 * Disabled state
 */
export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
}

/**
 * Full variant matrix
 */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {(['solid', 'outline', 'ghost'] as const).map((variant) => (
        <div key={variant} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ width: '60px' }}>{variant}:</span>
          <{{ComponentName}} variant={variant} size="sm">Small</{{ComponentName}}>
          <{{ComponentName}} variant={variant} size="md">Medium</{{ComponentName}}>
          <{{ComponentName}} variant={variant} size="lg">Large</{{ComponentName}}>
        </div>
      ))}
    </div>
  ),
}
`,
  }],

  ['with-msw', {
    name: 'with-msw',
    description: 'Story with MSW API mocking',
    useCase: 'Components that fetch data and need mocked API responses',
    placeholders: ['ComponentName', 'component-name'],
    content: `import type { Meta, StoryObj } from '@storybook/react'
import { http, HttpResponse } from 'msw'
import { {{ComponentName}} } from './{{ComponentName}}'

const meta: Meta<typeof {{ComponentName}}> = {
  title: 'Components/{{ComponentName}}',
  component: {{ComponentName}},
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof {{ComponentName}}>

/**
 * Default state with mocked successful API response
 */
export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/data', () => {
          return HttpResponse.json({
            items: [
              { id: 1, name: 'Item 1' },
              { id: 2, name: 'Item 2' },
              { id: 3, name: 'Item 3' },
            ],
          })
        }),
      ],
    },
  },
}

/**
 * Loading state - delayed response
 */
export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/data', async () => {
          await new Promise((resolve) => setTimeout(resolve, 999999))
          return HttpResponse.json({})
        }),
      ],
    },
  },
}

/**
 * Error state - API failure
 */
export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/data', () => {
          return HttpResponse.json(
            { error: 'Failed to fetch data' },
            { status: 500 }
          )
        }),
      ],
    },
  },
}

/**
 * Empty state - no data returned
 */
export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/data', () => {
          return HttpResponse.json({ items: [] })
        }),
      ],
    },
  },
}
`,
  }],

  ['with-router', {
    name: 'with-router',
    description: 'Story with React Router context',
    useCase: 'Components that use routing (Link, useNavigate, useParams)',
    placeholders: ['ComponentName', 'component-name'],
    content: `import type { Meta, StoryObj } from '@storybook/react'
import { withRouter, reactRouterParameters } from 'storybook-addon-remix-react-router'
import { {{ComponentName}} } from './{{ComponentName}}'

const meta: Meta<typeof {{ComponentName}}> = {
  title: 'Components/{{ComponentName}}',
  component: {{ComponentName}},
  tags: ['autodocs'],
  decorators: [withRouter],
  parameters: {
    reactRouter: reactRouterParameters({
      location: {
        pathParams: { id: '123' },
        searchParams: { tab: 'details' },
      },
      routing: {
        path: '/items/:id',
      },
    }),
  },
}

export default meta
type Story = StoryObj<typeof {{ComponentName}}>

/**
 * Default route configuration
 */
export const Default: Story = {}

/**
 * With different route params
 */
export const WithParams: Story = {
  parameters: {
    reactRouter: reactRouterParameters({
      location: {
        pathParams: { id: '456' },
      },
      routing: {
        path: '/items/:id',
      },
    }),
  },
}

/**
 * With search params
 */
export const WithSearchParams: Story = {
  parameters: {
    reactRouter: reactRouterParameters({
      location: {
        searchParams: { filter: 'active', sort: 'name' },
      },
    }),
  },
}
`,
  }],

  ['page', {
    name: 'page',
    description: 'Full page story with layout',
    useCase: 'Page-level components that need full viewport',
    placeholders: ['PageName', 'page-name'],
    content: `import type { Meta, StoryObj } from '@storybook/react'
import { {{PageName}} } from './{{PageName}}'

const meta: Meta<typeof {{PageName}}> = {
  title: 'Pages/{{PageName}}',
  component: {{PageName}},
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof {{PageName}}>

/**
 * Default page view
 */
export const Default: Story = {}

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Tablet viewport
 */
export const Tablet: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
}

/**
 * Desktop viewport
 */
export const Desktop: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
}
`,
  }],

  ['interactive', {
    name: 'interactive',
    description: 'Story with play function for interaction testing',
    useCase: 'Components with user interactions that need testing',
    placeholders: ['ComponentName', 'component-name'],
    content: `import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import { {{ComponentName}} } from './{{ComponentName}}'

const meta: Meta<typeof {{ComponentName}}> = {
  title: 'Components/{{ComponentName}}',
  component: {{ComponentName}},
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof {{ComponentName}}>

/**
 * Default state
 */
export const Default: Story = {
  args: {
    children: 'Click me',
  },
}

/**
 * Click interaction test
 */
export const ClickTest: Story = {
  args: {
    children: 'Click me',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const element = canvas.getByText(/click me/i)

    // Verify initial state
    await expect(element).toBeInTheDocument()

    // Perform click
    await userEvent.click(element)

    // Verify post-click state
    // Add your assertions here
  },
}

/**
 * Keyboard navigation test
 */
export const KeyboardNavigation: Story = {
  args: {
    children: 'Focus me',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const element = canvas.getByText(/focus me/i)

    // Tab to element
    await userEvent.tab()
    await expect(element).toHaveFocus()

    // Press Enter
    await userEvent.keyboard('{Enter}')

    // Press Space
    await userEvent.keyboard(' ')
  },
}

/**
 * Hover interaction test
 */
export const HoverTest: Story = {
  args: {
    children: 'Hover me',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const element = canvas.getByText(/hover me/i)

    // Hover over element
    await userEvent.hover(element)

    // Add hover state assertions

    // Unhover
    await userEvent.unhover(element)
  },
}
`,
  }],

  ['form', {
    name: 'form',
    description: 'Form component with validation states',
    useCase: 'Form components with multiple input states and validation',
    placeholders: ['FormName', 'form-name'],
    content: `import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import { {{FormName}} } from './{{FormName}}'

const meta: Meta<typeof {{FormName}}> = {
  title: 'Forms/{{FormName}}',
  component: {{FormName}},
  tags: ['autodocs'],
  argTypes: {
    onSubmit: { action: 'submitted' },
  },
}

export default meta
type Story = StoryObj<typeof {{FormName}}>

/**
 * Empty form - initial state
 */
export const Empty: Story = {}

/**
 * Pre-filled form
 */
export const Prefilled: Story = {
  args: {
    defaultValues: {
      email: 'user@example.com',
      name: 'John Doe',
    },
  },
}

/**
 * With validation errors
 */
export const WithErrors: Story = {
  args: {
    errors: {
      email: 'Invalid email address',
      name: 'Name is required',
    },
  },
}

/**
 * Submitting state
 */
export const Submitting: Story = {
  args: {
    isSubmitting: true,
  },
}

/**
 * Form submission flow
 */
export const SubmissionTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Fill in form fields
    const emailInput = canvas.getByLabelText(/email/i)
    const nameInput = canvas.getByLabelText(/name/i)
    const submitButton = canvas.getByRole('button', { name: /submit/i })

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(nameInput, 'Test User')

    // Verify values
    await expect(emailInput).toHaveValue('test@example.com')
    await expect(nameInput).toHaveValue('Test User')

    // Submit form
    await userEvent.click(submitButton)
  },
}

/**
 * Validation error flow
 */
export const ValidationTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Submit without filling fields
    const submitButton = canvas.getByRole('button', { name: /submit/i })
    await userEvent.click(submitButton)

    // Check for error messages
    const errorMessage = await canvas.findByText(/required/i)
    await expect(errorMessage).toBeInTheDocument()
  },
}
`,
  }],
])
