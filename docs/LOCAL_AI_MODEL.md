# Local AI Model Architecture

PixelTruth provides an optional, browser-native AI analysis engine for deepfake and generative media detection.

## Architecture & Privacy
The entire inference pipeline runs **locally in your browser**. Images are never uploaded to a remote server for analysis. 
- **Inference Engine**: We use [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) (`onnxruntime-web`).
- **Hardware Acceleration**: The engine automatically detects and prefers **WebGPU** for massive parallel tensor execution. If WebGPU is unavailable (e.g., Firefox, older Safari, or older hardware), it gracefully falls back to a multi-threaded **WebAssembly (WASM)** execution provider.

## Model Format and ABI
PixelTruth standardizes on the **ONNX** format for its interoperability and performance.
Models are interfaced through a `ModelAdapter` abstraction which handles:
1. **Preprocessing**: The browser's native `OffscreenCanvas` is used to center-crop and resize the image (typically to 224x224). Pixel data is extracted, normalized using ImageNet means/stds, and converted to an NCHW `Float32Array` tensor.
2. **Inference**: The ONNX session executes the computational graph.
3. **Postprocessing**: The raw output logits are passed through a Softmax function. The resulting score is standardized as a `syntheticLikelihood` metric.

## Limitations & Explanations

**AI Inference is probabilistic, not deterministic.** The output is a heuristic signal, not absolute proof. Please be aware of the following fundamental limitations:

1. **Adversarial Adaptation**: It is mathematically possible to inject invisible noise patterns (adversarial perturbations) into an image that force an AI detector to confidently misclassify an AI image as a real photograph.
2. **Unseen Generators**: A model trained to detect GANs (like StyleGAN) will likely fail to detect modern Diffusion models (like Midjourney or FLUX). Distribution shifts significantly degrade model accuracy.
3. **Resizing and Compression**: Downscaling an image or heavily compressing it destroys the high-frequency pixel anomalies that many AI detectors rely on. A heavily compressed fake will often score as "Real".
4. **Screenshots**: Taking a screenshot of an AI-generated image fundamentally changes its compression and pixel structure, completely bypassing many detection models.
5. **Score vs Calibration**: The `syntheticLikelihood` score is a raw confidence output. Unless explicitly calibrated against a known validation dataset, a score of "0.9" does not mean a 90% true probability of being synthetic.

For absolute verification of an image's origin, rely on cryptographic Content Credentials (C2PA) rather than statistical AI inference.
