# Extension Icons

This folder should contain the following icon files:

- `icon-16.png` - 16x16 pixels (toolbar icon, small)
- `icon-48.png` - 48x48 pixels (extensions page)
- `icon-128.png` - 128x128 pixels (Chrome Web Store, installation)

## How to Create Icons

You can create these icons using any image editor or online tool:

### Option 1: Using Canva (Free)
1. Go to canva.com
2. Create a custom design (128x128 pixels)
3. Add LinkedIn blue background (#0077b5)
4. Add "LA" text in white (for LinkedIn Automation)
5. Download as PNG
6. Resize to create 48x48 and 16x16 versions

### Option 2: Using Figma (Free)
1. Create a 128x128 frame
2. Add blue square background (#0077b5)
3. Add white "LA" text
4. Export as PNG at 1x, 0.375x, and 0.125x scales

### Option 3: Using an Icon Generator
1. Search for "Chrome extension icon generator"
2. Upload a logo or create one
3. Download all required sizes

### Temporary Placeholder
Until you create proper icons, you can:
1. Create solid blue squares (16x16, 48x48, 128x128) as placeholders
2. Use any free icon from https://www.flaticon.com/
3. Convert SVG icons to PNG using https://cloudconvert.com/

## Required Specifications

- Format: PNG
- Transparency: Optional (can use solid background)
- Colors: LinkedIn blue (#0077b5) recommended
- Content: Simple, recognizable at small sizes
- Text: Minimal (looks better as icon/symbol)

## Naming Convention

Must match the file names in manifest.json:
```json
{
  "16": "icons/icon-16.png",
  "48": "icons/icon-48.png",
  "128": "icons/icon-128.png"
}
```
