# Logo Image Issue Fix

## Problem
The application was showing this error:
```
⨯ The requested resource isn't a valid image for /logo.png received text/html; charset=utf-8
```

## Root Cause
- The code was referencing `/logo.png` in multiple places
- However, the actual logo file in the public directory is named `logo.jpg`
- When Next.js tried to load `/logo.png`, it returned a 404 HTML page instead of an image

## Files That Had Incorrect References
1. `src/components/header.tsx` - Line 23
2. `src/app/login/page.tsx` - Line 42

## Fix Applied
✅ Changed all references from `/logo.png` to `/logo.jpg`

### Before:
```tsx
<Image src="/logo.png" alt="Trajectorie Logo" width={140} height={30} priority />
```

### After:
```tsx
<Image src="/logo.jpg" alt="Trajectorie Logo" width={140} height={30} priority />
```

## Additional Cleanup
- Removed duplicate `logo.jpg` file from `src/components/` directory
- Kept the correct `logo.jpg` file in `public/` directory

## Result
✅ No more 404 errors for logo images
✅ Logo displays correctly across the application
✅ Cleaner console output without image loading errors

## Prevention
In the future, ensure that:
1. Image file names in code match actual file names
2. Images are placed in the correct `public/` directory
3. Use consistent file extensions (.jpg vs .png)
