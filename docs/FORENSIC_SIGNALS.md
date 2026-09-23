# Forensic Signals and Limitations

PixelTruth exposes visual forensic diagnostic signals to help experts analyze the structure and compression characteristics of an image.

**CRITICAL WARNING:** Visual forensic signals (like ELA and FFT) are *diagnostic aids*, not binary truth classifiers. They DO NOT prove an image is AI-generated, nor do they definitively prove manipulation on their own.

## 1. Error Level Analysis (Compression Difference Map)

**How it works:**
The tool decodes the image, re-encodes a temporary copy at a known JPEG quality level, and subtracts the original image from the re-encoded copy. The resulting absolute differences are amplified into a heat map.

**Interpretation:**
- If an image has been uniformly saved as a JPEG once, the entire image should show a roughly uniform error level (except at sharp high-contrast edges).
- If a portion of an image was spliced in from a different source (with a different compression history), it may appear significantly brighter or darker in the difference map.

**Limitations:**
- **High-Quality Saves:** If an image is saved at 100% quality multiple times, ELA often fails to highlight differences.
- **Natural Edges:** Text, sharp lines, and high-contrast edges *naturally* produce higher differences. This is normal JPEG behavior, not manipulation.
- **AI Generation:** ELA *cannot* directly identify AI generation. An AI-generated image saved uniformly as a JPEG will look identical under ELA to a real camera photo saved uniformly as a JPEG.

## 2. Fast Fourier Transform (2D FFT Magnitude Spectrum)

**How it works:**
The tool converts the image to grayscale and transforms spatial pixels into the frequency domain using a 2D Cooley-Tukey Radix-2 algorithm. The resulting magnitude spectrum reveals underlying repeating patterns, grids, and frequencies.

**Interpretation:**
- Natural photographs typically have a smooth drop-off from the center (low frequencies) outwards (high frequencies), often shaped like a cross due to horizontal and vertical edge biases.
- Some generative AI models (especially older GANs) introduce high-frequency checkerboard artifacts due to upsampling convolutions (e.g., transposed convolutions). These can appear as bright grid points or "starbursts" in the FFT spectrum.

**Limitations:**
- **Normal Upscaling:** Standard bicubic or nearest-neighbor upscaling also introduces regular grid artifacts in the frequency domain.
- **Textures:** Photos of bricks, fabrics, or screens (moiré patterns) naturally produce strong geometric frequency peaks.
- **Compression:** Heavy JPEG compression introduces its own 8x8 block frequency signatures.
- **Modern Diffusion Models:** Modern models (like Midjourney v6, Stable Diffusion 3, DALL-E 3) often do not exhibit obvious GAN-like checkerboard artifacts in the frequency domain.

## Summary

Do not use ELA or FFT as definitive proof of anything. They are purely mathematical transformations meant to highlight anomalies that warrant further investigation. True cryptographic verification requires inspecting C2PA Content Credentials.
