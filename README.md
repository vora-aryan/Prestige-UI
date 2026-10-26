# Prestige UI

Animated React components and blocks built with Tailwind CSS and Motion. Install them with the shadcn CLI or copy the source from this repo.

![Prestige UI](.github/assets/banner.png)

[Website](https://prestigeui.com) · [Docs](https://prestigeui.com/docs/introduction) · [All components](https://prestigeui.com/components) · [All blocks](https://prestigeui.com/blocks)

This repo holds the free items (20 components and blocks). Live previews, props and examples for each one are on [prestigeui.com](https://prestigeui.com).

## Install

With the shadcn CLI, using the item's URL:

```bash
npx shadcn@latest add https://prestigeui.com/r/gradient-button.json
```

Or add the registry once to `components.json` and install by name:

```json
{
  "registries": {
    "@prestige": "https://prestigeui.com/r/{name}.json"
  }
}
```

```bash
npx shadcn@latest add @prestige/gradient-button
```

The CLI installs the dependencies, the shared `cn` helper and any CSS an item needs.

## Free components and blocks

| Item | Description |
| --- | --- |
| [shine-button](https://prestigeui.com/components/shine-button) | A CTA button with a sweeping shine highlight on hover. |
| [magnetic-button](https://prestigeui.com/components/magnetic-button) | A button that gently magnetizes toward the cursor. |
| [social-login-button](https://prestigeui.com/components/social-login-button) | Clean, accessible buttons for Google, Apple, and GitHub SSO. |
| [async-button](https://prestigeui.com/components/async-button) | A button with a smooth loading spinner and success state. |
| [copy-button](https://prestigeui.com/components/copy-button) | An interactive copy-to-clipboard button with micro-animations. |
| [gradient-button](https://prestigeui.com/components/gradient-button) | A glowing, animated gradient border button for primary CTAs. |
| [payment-button](https://prestigeui.com/components/payment-button) | Standardized Apple Pay and Google Pay buttons. |
| [interactive-button](https://prestigeui.com/components/interactive-button) | A button with advanced internal layout animations, like downloading. |
| [text-reveal](https://prestigeui.com/components/text-reveal) | Word-by-word blur reveal for headlines and copy. |
| [infinite-marquee](https://prestigeui.com/components/infinite-marquee) | Seamless looping marquee for logos, chips, and quotes. |
| [navbar-pill](https://prestigeui.com/components/navbar-pill) | A floating capsule with a sliding active pill. |
| [navbar-mega](https://prestigeui.com/components/navbar-mega) | A full-width header whose mega menus glide and resize between triggers. |
| [navbar-condense](https://prestigeui.com/components/navbar-condense) | A full-width header that tightens into a floating, frosted capsule as the page scrolls. |
| [navbar-announce](https://prestigeui.com/components/navbar-announce) | A navbar with a dismissible announcement bar that folds away smoothly and stays dismissed. |
| [footer-wordmark](https://prestigeui.com/blocks/footer-wordmark) | Link columns over an edge-to-edge wordmark that rises in and lights up under the pointer, with status, a live local clock and back-to-top. |
| [auth-otp](https://prestigeui.com/blocks/auth-otp) | Email then a 6-digit code: auto-advance, paste and autofill, a forgiving error with a gentle shake, and a resend countdown. |
| [scramble-text](https://prestigeui.com/components/scramble-text) | A text animation component that cycles characters through random glyphs before settling. |
| [marquee-rows](https://prestigeui.com/components/marquee-rows) | Three labelled rows of feature chips (security, workflow, insight) that travel at their own pace in alternating directions, and ease to a stop under the pointer. |
| [illustration-orbit](https://prestigeui.com/components/illustration-orbit) | Eight tool logos on a ring around an AI model. They connect in turn: a beam runs each spoke inward, the line stays inked, and the model answers every arrival with a single ripple. |
| [cta-bloom](https://prestigeui.com/blocks/cta-bloom) | A centered closing panel on a slow color field that drifts like light on paper and brightens under the pointer, with two actions and three short reassurances. |

## Manual install

1. Requires React 19 and Tailwind CSS v4.
2. Install the dependencies: `npm install clsx lucide-react motion tailwind-merge`
3. Copy `lib/utils.ts` and the files you need from `components/prestigeui/`. Files ending in `-ui.tsx` are shared parts used by their family (for example `auth-ui.tsx` for `auth-otp.tsx`), and `prestige-brand.tsx` is the placeholder logo used in the navbar, footer and auth blocks.
4. For Shine Button and Basic Marquee, add `styles/prestigeui.css` to your global CSS.

The imports use the `@/` alias, as in a standard shadcn/ui project.

## More

Pro blocks and templates (heroes, pricing, bento grids, AI blocks, backgrounds) are on [prestigeui.com](https://prestigeui.com/pricing).

## License

MIT. See [LICENSE](LICENSE).
