import { Buffer } from "node:buffer";
import { WriteStream } from "node:tty";
import { PassThrough } from "node:stream";
import { WritableStream } from "node:stream/web";

export default class WritableStreamString {
  private chunks: string[];
  writableStream: WritableStream<Uint8Array>;
  writeStream: WriteStream;

  constructor() {
    this.chunks = [];

    this.writableStream = new WritableStream<Uint8Array>({
      write: (chunk: Uint8Array) => {
        const decoder = new TextDecoder();
        const chunkString = decoder.decode(chunk);
        this.chunks.push(chunkString);
      },
    });

    const passThrough = new PassThrough();
    this.writeStream = passThrough as unknown as WriteStream;

    passThrough.on("data", (chunk) => {
      if (Buffer.isBuffer(chunk)) {
        this.chunks.push(chunk.toString());
      } else {
        this.chunks.push(String(chunk));
      }
    });
  }

  getString(): string {
    return this.chunks.join("");
  }
}
