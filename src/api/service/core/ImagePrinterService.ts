export const IMAGE_PRINTER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/image-printer-service";

export default interface ImagePrinterService {
  image(imageBuffer: Uint8Array, widthPercentage?: number): Promise<string>;
}
