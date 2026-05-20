import terminalImage from "terminal-image";
import type ImagePrinterService from "../../api/service/core/ImagePrinterService.ts";

export default class DefaultImagePrinterService implements ImagePrinterService {
  image(
    imageBuffer: Uint8Array,
    widthPercentage: number = 100,
  ): Promise<string> {
    const isGif = imageBuffer.length >= 3 &&
      imageBuffer[0] === 0x47 &&
      imageBuffer[1] === 0x49 &&
      imageBuffer[2] === 0x46;

    const widthOption = `${widthPercentage}%`;

    if (isGif) {
      return new Promise<string>((resolve) => {
        const renderFrame = Object.assign(
          (text: string) => {
            stopAnimation();
            resolve(text);
          },
          { done: () => {} },
        );
        const stopAnimation = terminalImage.gifBuffer(imageBuffer, {
          width: widthOption,
          renderFrame,
        });
      });
    }

    return terminalImage.buffer(imageBuffer, { width: widthOption });
  }
}
