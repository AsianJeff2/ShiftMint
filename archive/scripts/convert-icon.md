# Icon Conversion Instructions

To properly set up the ShiftMint desktop application icons, you need to convert the source image to the required formats.

## Online Conversion Tools (Recommended)

### For ICO (Windows):
1. Go to https://icoconvert.com/
2. Upload the ShiftMint icon image
3. Select multiple sizes: 16, 32, 48, 64, 128, 256
4. Download as `icon.ico` and place in `assets/`

### For ICNS (macOS):
1. Go to https://iconverticons.com/online/
2. Upload the ShiftMint icon image
3. Convert to ICNS format
4. Download as `icon.icns` and place in `assets/`

### For PNG (Linux):
1. Resize the image to 512x512 pixels
2. Save as `icon.png` and place in `assets/`

## Command Line Tools (Alternative)

### Using ImageMagick:
```bash
# Install ImageMagick first
# For PNG (Linux)
magick input.jpg -resize 512x512 assets/icon.png

# For ICO (Windows)
magick input.jpg -resize 256x256 assets/icon.ico

# For ICNS (macOS) - requires additional steps
magick input.jpg -resize 1024x1024 icon-1024.png
# Then use iconutil on macOS or online converter
```

## Verification

After converting, verify the files:
- `assets/icon.png` - Should be 512x512 PNG
- `assets/icon.ico` - Should contain multiple sizes
- `assets/icon.icns` - Should be valid macOS icon format

Then run: `npm run dist` to test the desktop build with the new icons.