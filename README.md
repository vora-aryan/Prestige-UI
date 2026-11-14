# Prestige UI

Animated React components and blocks built with Tailwind CSS and Motion. Install them with the shadcn CLI or copy the source from this repo.

![Prestige UI](.github/assets/banner.png)

[Website](https://prestigeui.com) · [Docs](https://prestigeui.com/docs/introduction) · [All components](https://prestigeui.com/components) · [All blocks](https://prestigeui.com/blocks)

This repo holds the free items (48 components and blocks). Live previews, props and examples for each one are on [prestigeui.com](https://prestigeui.com).

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
| [waitlist-button](https://prestigeui.com/components/waitlist-button) | A waitlist button that opens into an email field, with the button becoming the submit, then a confirmation across the field. |
| [hold-to-confirm](https://prestigeui.com/components/hold-to-confirm) | A delete button you press and hold: a red fill rises and the trash can's lid lifts with the hold, then it snaps shut and confirms. |
| [slide-to-confirm](https://prestigeui.com/components/slide-to-confirm) | A slider for irreversible actions: ink follows the thumb and turns the label white where it passes, then the thumb locks and confirms. |
| [theme-toggle](https://prestigeui.com/components/theme-toggle) | A theme button whose icon turns from sun to moon as an eclipse, while the page changes like the sky: dusk sweeps down, dawn rises. |
| [star-button](https://prestigeui.com/components/star-button) | A star or upvote button whose count rolls like an odometer, carrying digit by digit, with an optional live GitHub star count. |
| [follow-button](https://prestigeui.com/components/follow-button) | A follow button whose icon morphs from plus to check to cross: Follow, Following, and Unfollow on hover, always centred and never resizing. |
| [split-button](https://prestigeui.com/components/split-button) | A primary action with a menu of alternatives: picking one makes it the main action, and running it turns its icon into a spinner, then a check. |
| [add-to-cart](https://prestigeui.com/components/add-to-cart) | An add to cart button: the item drops into the cart icon and the button opens into a quantity stepper in the same space. |
| [copy-button](https://prestigeui.com/components/copy-button) | An interactive copy-to-clipboard button with micro-animations. |
| [gradient-button](https://prestigeui.com/components/gradient-button) | A glowing, animated gradient border button for primary CTAs. |
| [payment-button](https://prestigeui.com/components/payment-button) | A checkout button that shows the amount, then processing, paid or failed, without changing size. |
| [interactive-button](https://prestigeui.com/components/interactive-button) | A download button whose fill tracks real progress, with a percentage and a finished state. |
| [text-reveal](https://prestigeui.com/components/text-reveal) | Word-by-word blur reveal for headlines and copy. |
| [infinite-marquee](https://prestigeui.com/components/infinite-marquee) | Seamless looping marquee for logos, chips, and quotes. |
| [navbar-pill](https://prestigeui.com/components/navbar-pill) | A floating capsule with a sliding active pill. |
| [navbar-mega](https://prestigeui.com/components/navbar-mega) | A full-width header whose mega menus glide and resize between triggers. |
| [navbar-condense](https://prestigeui.com/components/navbar-condense) | A full-width header that tightens into a floating, frosted capsule as the page scrolls. |
| [navbar-announce](https://prestigeui.com/components/navbar-announce) | A navbar with a dismissible announcement bar that folds away smoothly and stays dismissed. |
| [footer-wordmark](https://prestigeui.com/blocks/footer-wordmark) | Link columns over an edge-to-edge wordmark that rises in and lights up under the pointer, with status, a live local clock and back-to-top. |
| [auth-otp](https://prestigeui.com/blocks/auth-otp) | Email then a 6-digit code: auto-advance, paste and autofill, a forgiving error with a gentle shake, and a resend countdown. |
| [scramble-text](https://prestigeui.com/components/scramble-text) | A text animation component that cycles characters through random glyphs before settling. |
| [rotating-words](https://prestigeui.com/components/rotating-words) | A word in a headline that rotates through a list: the letters roll up in a wave and the line's width glides to each new word. |
| [scroll-fill](https://prestigeui.com/components/scroll-fill) | A paragraph whose words fill from faint to full ink as you scroll through it, with a soft edge between read and unread, finishing while the copy is still in view. |
| [line-mask-reveal](https://prestigeui.com/components/line-mask-reveal) | A headline whose lines rise one after another from behind their own masks when it comes into view, split exactly where the browser wraps the text. |
| [membership-card](https://prestigeui.com/components/membership-card) | A metal membership card that tilts toward the cursor, with a banknote-style security print that catches the light as it turns and one slow sweep of light when it first comes into view. |
| [contact-card](https://prestigeui.com/components/contact-card) | A paper business card that turns over in 3D: name and role on the front, clickable contact details and a scannable QR code that saves the contact on the back. |
| [expandable-card](https://prestigeui.com/components/expandable-card) | A compact card that grows into its full detail view from where it sits, with the title gliding into place; a bottom sheet you can drag down to close on phones. |
| [article-card](https://prestigeui.com/components/article-card) | A blog or changelog card that lays itself out by the space it is given: stacked when narrow, image beside the text when wider, and a featured layout with a larger title when wide. The photo zooms slowly and the title's underline draws in on hover. |
| [profile-card](https://prestigeui.com/components/profile-card) | A team member card with a full-bleed portrait and the name set over it; on hover, focus or tap the bio, social links and a mail button rise over the photo, without the card changing size. |
| [product-card](https://prestigeui.com/components/product-card) | A store product card: move across the photo to flip through it (swipe on phones), pick a color swatch to swap the photos, and add to cart from a button that rises over the photo on hover, with price, sale price, a short detail line and a tag. |
| [instant-photo](https://prestigeui.com/components/instant-photo) | An instant photo print that slides out of a slot when it scrolls into view and develops from milky grey to full colour, with a caption and date on its wide bottom edge. Give each print a slight tilt to scatter a few; hovering picks one up and straightens it. |
| [stacking-cards](https://prestigeui.com/components/stacking-cards) | Cards that pin as you scroll and stack on top of each other, one screen of scrolling per card, with wheel and trackpad scrolling eased while the stack is on screen. The cards underneath ease back and darken a little while their top rows stay visible, so the finished stack reads as a list you can click to jump back, and each photo settles from a slight zoom as its card rises. Each card takes a label, title, description, facts, a link and an image or any visual. |
| [compare-card](https://prestigeui.com/components/compare-card) | Two versions of one card split by a divider that follows the cursor as you move across it and glides back when you leave, for light and dark themes, before and after, or old and new designs. It rests in the middle; on touch screens it drags, and with the keyboard it is a slider. Takes any two layouts plus optional labels. |
| [testimonial-deck](https://prestigeui.com/components/testimonial-deck) | A stack of quote cards: drag or flick the top card away, or use the buttons or arrow keys, and the next one lifts into place. It loops, keeps the height of its longest quote and takes any quotes with name, role, company, photo and rating. |
| [stat-card](https://prestigeui.com/components/stat-card) | A metric card whose number rolls into place like an odometer while its line or bar chart draws in; scrub the chart with a pointer, a finger or the arrow keys and the number rolls to that day, then back to today. |
| [feature-card](https://prestigeui.com/components/feature-card) | A feature card with a small app window that plays a short story on hover, focus or when it scrolls into view on phones: search filtering to a result, a scheduled export finishing, a member's role changing. Bring your own illustration or use the three built in; it lays out by its own width. |
| [marquee-rows](https://prestigeui.com/components/marquee-rows) | Three labelled rows of feature chips (security, workflow, insight) that travel at their own pace in alternating directions, and ease to a stop under the pointer. |
| [illustration-orbit](https://prestigeui.com/components/illustration-orbit) | Eight tool logos on a ring around an AI model. They connect in turn: a beam runs each spoke inward, the line stays inked, and the model answers every arrival with a single ripple. |
| [cta-bloom](https://prestigeui.com/blocks/cta-bloom) | A centered closing panel on a slow color field that drifts like light on paper and brightens under the pointer, with two actions and three short reassurances. |
| [command-palette](https://prestigeui.com/blocks/command-palette) | A ⌘K command palette for an app: a search button that opens a dialog of pages and actions in groups, with their own shortcuts. Typing ranks matches as you go and marks the matched letters, projects and help appear once you search, and the last items you chose come first under Recent. It works fully from the keyboard, Escape clears the search before it closes, and on phones it fills the width. |
| [settings-profile](https://prestigeui.com/blocks/settings-profile) | A profile settings page: photo upload by click or drop with honest size and type checks, name, and a username with a live availability check that suggests a free one when it's taken. Changing the email sends a confirmation link and keeps the old address active until it's confirmed, with a timed resend. Language, time zone (with each zone's current time), date format and week start show today's date as you'll see it. Edits stay a draft until the save bar's Save or ⌘S, and Discard puts everything back. |
| [dashboard-overview](https://prestigeui.com/blocks/dashboard-overview) | The home page of a business dashboard. Switch between metrics to change the main chart, compare with the previous period, click any point to see what made it up, and follow recent activity and goals. Includes loading, empty and error states, CSV export, and any locale or currency. |
| [background-ink](https://prestigeui.com/backgrounds/background-ink) | A watercolor simulation behind your content. Drops of ink land on paper, bloom and dry into darker rims; a click drops more ink and a pointer moving through wet ink drags it like a brush. |
| [model-picker](https://prestigeui.com/ai-blocks/model-picker) | A menu for choosing the AI model. Models are grouped by provider and searchable, and a side pane compares the one under the cursor: what it's good at, relative intelligence, speed and cost, context size and what it accepts. Models on a higher plan stay visible with an upgrade button. Works from the keyboard. |

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
