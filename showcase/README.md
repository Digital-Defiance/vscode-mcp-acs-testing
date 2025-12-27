# @digitaldefiance/suite-core-lib Showcase

This is the GitHub Pages showcase site for **@digitaldefiance/suite-core-lib**, the foundational building blocks library for secure user management and cryptographic operations. Built with React, TypeScript, and Vite.

## About Suite Core Lib

`@digitaldefiance/suite-core-lib` provides:
- Type-safe base interfaces for user, role, and permissions management
- Cryptographically-secure backup code generation and validation
- Localized error handling in multiple languages (English, French, Spanish, Chinese, Ukrainian)
- Role-based access control (RBAC) primitives
- Zero-knowledge authentication flow foundations
- Fluent builder APIs for users and roles

## Development

```bash
cd showcase
npm install
npm run dev
```

Visit `http://localhost:5173` to see the site.

## Building

```bash
npm run build
```

The built site will be in the `dist` directory.

## Deployment

The site is automatically deployed to GitHub Pages when changes are pushed to the `main` branch. The deployment is handled by the `.github/workflows/deploy-showcase.yml` workflow.

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Framer Motion** - Animations
- **React Icons** - Icon library
- **React Intersection Observer** - Scroll animations

## Structure

- `/src/components` - React components
- `/src/assets` - Static assets
- `/public` - Public files
- `index.html` - Entry HTML file
- `vite.config.ts` - Vite configuration
