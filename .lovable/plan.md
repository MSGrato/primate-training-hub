

# Replace Primate Logo with WaNPRC Icon

## Overview
Replace the current simplified primate SVG in `PrimateLogo.tsx` with a new SVG that closely matches the official WaNPRC logo from the uploaded image: a walking macaque silhouette inside a circle with a navy/purple upper half and gold/tan lower hill shape.

## What will change

### File: `src/components/PrimateLogo.tsx`
- Replace the entire SVG contents with a new design matching the WaNPRC logo:
  - **Circle background**: Navy/purple (`#2D2B6B`) filled circle
  - **Gold hill/ground**: A tan/gold (`#C4AD6E`) curved hill shape in the lower portion
  - **Macaque silhouette**: A white walking primate profile (facing right, tail curled up) rendered as a single SVG path
- The component will continue to accept `className` for sizing
- Use `currentColor` only where appropriate; the logo has specific brand colors (navy, gold, white) so those will be hardcoded to match the reference image

### No other files need changes
The `PrimateLogo` component is already used in:
- `src/pages/Login.tsx` (login page header)
- `src/components/AppSidebar.tsx` (sidebar header)

Since both import and render `<PrimateLogo />`, updating the single component file will propagate the change throughout the app automatically.

## Technical Details

### SVG structure
```
<svg viewBox="0 0 100 100">
  <!-- Navy circle background -->
  <circle cx="50" cy="50" r="48" fill="#2D2B6B" />
  <!-- Gold ground/hill shape (clipped to circle) -->
  <clipPath id="circle-clip">
    <circle cx="50" cy="50" r="48" />
  </clipPath>
  <path d="..." fill="#C4AD6E" clip-path="url(#circle-clip)" />
  <!-- White macaque silhouette path -->
  <path d="..." fill="white" />
</svg>
```

- The clipPath ensures the gold hill stays within the circle boundary
- The macaque is a detailed silhouette path showing a walking primate in profile view with a curled tail
- A unique clipPath ID will be generated to avoid conflicts if multiple logos render on the same page

