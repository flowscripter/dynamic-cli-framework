import ImageRenderer from "../../terminal/ImageRenderer.ts";
import type ImagePrinterService from "../../api/service/core/ImagePrinterService.ts";
import type Terminal from "../../terminal/Terminal.ts";

export default class DefaultImagePrinterService implements ImagePrinterService {
  readonly #renderer: ImageRenderer;

  constructor(terminal: Terminal) {
    this.#renderer = new ImageRenderer(terminal);
  }

  image(
    imageBuffer: Uint8Array,
    widthPercentage: number = 100,
  ): Promise<string> {
    return this.#renderer.renderImage(imageBuffer, widthPercentage);
  }
}
