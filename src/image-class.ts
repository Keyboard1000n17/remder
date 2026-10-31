import got from "got";
import { Resvg } from "@resvg/resvg-js";
import { randomUUID } from "crypto";
import { join, dirname, isAbsolute } from "path";
import type { Token } from "markdown-it";
import {
  BoxRenderable,
  ImageRenderable,
  TextRenderable,
  StyledText,
  type RenderContext,
} from "@opentui/core";
import { Logger } from "tslog";
import { queryTerminal } from "terminal-query";
import { openSync } from "node:fs";
import { ReadStream } from "node:tty";
import { feature } from "bun:bundle";

type BufferedLog = {
  level: "log" | "error";
  line: string;
};

const argv = process.argv.slice(1);
const separator = argv.indexOf("--");
const options = separator === -1 ? argv : argv.slice(0, separator);

const printToStdout = options.some(
  (arg) =>
    arg === "--print-to-stdout"
    || (arg.startsWith("-") && !arg.startsWith("--") && arg.slice(1).includes("o")),
);

const logbuf: BufferedLog[] = [];
let writeLog: ((entry: BufferedLog) => void) | undefined;
const logger = new Logger({ type: "hidden" });

logger.attachTransport({
  format: "pretty",
  write(record, line) {
    const entry: BufferedLog = {
      level: (record._logMeta?.logLevelId || 5) >= 5 ? "error" : "log",
      line,
    };
    if (writeLog) {
      writeLog(entry);
    } else {
      logbuf.push(entry);
    }
  },
});

let terminalInput: NodeJS.ReadStream | undefined = undefined;

if (process.stdin.isTTY) {
  terminalInput = process.stdin;
} else if (process.platform === "win32" && feature("WINDOWS_CONSOLE")) {
  const openWindowsConsoleInput = (await import("./windows-console-input")).openWindowsConsoleInput;
  terminalInput = openWindowsConsoleInput().stream;
} else {
  terminalInput = new ReadStream(openSync("/dev/tty", "r+"));
}

export default class Image {
  public imageBuffer: Promise<Uint8Array<ArrayBuffer> | undefined>;
  public type: "image";
  public properties: {};
  private id: `${string}-${string}-${string}-${string}-${string}`;
  private loadState: "not loaded" | "loading" | "loaded";
  public static frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  public static frame = 0;
  constructor(
    public path: string,
    public filePath: string,
    public imageAlt: string,
    public token: Token,
    public parentAlignment?: "left" | "center" | "right",
  ) {
    this.imageBuffer = Image.getBuffer(filePath, path);
    this.type = "image";
    this.properties = {};
    this.id = randomUUID();
    this.loadState = "not loaded";
  }
  static preferNativeRender = !/tmux|screen|^xterm$|alacritty/.test(process.env.TERM || "");
  static async getBuffer(filePath: string, path: string) {
    logger.info("path: " + path + " | " + "absolute?: " + isAbsolute(path));
    logger.info("tried to access" + isAbsolute(path) ? path : join(dirname(filePath), path));
    try {
      let properPath;
      const pathSeparator = /(?<!:\/|:|\\)\//;
      // this regex matches a `/` if it is not preceded by `:/`, `:`, or `\`
      const filePathArray = filePath.split(pathSeparator).slice(0, -1);
      const pathArray = path.split(pathSeparator);
      if (URL.canParse(path)) {
        properPath = path;
      } else if (isAbsolute(path)) {
        properPath = (filePathArray[0] === undefined ? "" : filePathArray[0]) + path;
      } else {
        for (const dir of pathArray) {
          if (dir === ".") {
            continue;
          } else if (dir === "..") {
            filePathArray.pop();
          } else {
            filePathArray.push(dir);
          }
        }
        properPath = filePathArray.join("/");
      }
      logger.info(
        `path is ${properPath}. file path array was ${JSON.stringify(filePathArray)}. supplied image path was ${path}`,
      );
      return URL.canParse(properPath)
        ? (
          await got(properPath, {
            retry: { limit: 2, maxRetryAfter: 10_000 },
            timeout: { request: 10_000 },
          })
        ).rawBody
        : await Bun.file(properPath).bytes();
    } catch (err) {
      logger.error(`${err}`);
      return undefined;
    }
  }
  async getImageSize(
    tempBuf: Uint8Array<ArrayBuffer> | Buffer<ArrayBufferLike>,
    parentWidth: number,
    makeOneRowHigh: boolean,
    ctx?: RenderContext,
  ) {
    // we use another package isntead of using the resolution given by opentui
    // because the --print-to-stdout option does not use opentui
    let pixelWidth, pixelHeight;
    const terminalWidth = process.stdout.columns;
    const terminalHeight = process.stdout.rows;
    const getImageSize = (await import("image-size")).imageSize;
    const imageSize = getImageSize(tempBuf);
    if (ctx) {
      pixelWidth = ctx.resolution?.width || 1920;
      pixelHeight = ctx.resolution?.height || 1080;
    } else {
      const response = await queryTerminal("\u001b[14t", { stdin: terminalInput });
      const dimensions = response?.match(/\u001b\[4;(\d+);(\d+)t/);
      if (!dimensions || !terminalWidth || !terminalHeight) {
        throw new Error("Failed to query terminal pixel and cell dimensions");
      }
      pixelHeight = Number(dimensions[1]);
      pixelWidth = Number(dimensions[2]);
      if (!pixelHeight || !pixelWidth) {
        throw new Error(`Invalid terminal pixel dimensions: ${response}`);
      }
    }
    const cellAspectRatio = pixelHeight / terminalHeight / (pixelWidth / terminalWidth);
    logger.info(`image type: ${imageSize.type}`);
    const rowHeight = pixelHeight / terminalHeight;
    const cellWidth = pixelWidth / terminalWidth;
    const pxRatio = imageSize.width / imageSize.height;
    const ratio = pxRatio * cellAspectRatio; // cellAspectRatio is around 2 usually
    let tempWidth = imageSize.width;
    let tempHeight;
    let shouldUseWidth = true;
    const passedWidth = this.token.attrGet("width");
    const passedHeight = this.token.attrGet("height");
    const parseAttrs = /(?<num>\d+)(?<unit>\D+)?/;
    if (passedWidth) {
      const parsedWidth = String(passedWidth).match(parseAttrs);
      const integerWidth = parseInt(parsedWidth?.groups?.num || "1");
      const unit = parsedWidth?.groups?.unit;
      if (unit === "px") {
        tempWidth = integerWidth;
      } else if (unit === "pt") {
        tempWidth = (integerWidth * 4) / 3;
      } else if (unit === "%") {
        tempWidth = (integerWidth / 100) * parentWidth * cellWidth;
      } else if (unit === "pc") {
        tempWidth = integerWidth * 16;
      } else {
        tempWidth = integerWidth;
      }
    }
    if (passedHeight) {
      const parsedHeight = String(passedHeight).match(parseAttrs);
      shouldUseWidth = false;
      const integerHeight = parseInt(parsedHeight?.groups?.num || "1");
      const unit = parsedHeight?.groups?.unit;
      if (unit === "px") {
        tempHeight = integerHeight;
      } else if (unit === "pt") {
        tempHeight = (integerHeight * 4) / 3;
      } else if (unit === "pc") {
        tempHeight = integerHeight * 16;
      } else {
        tempHeight = integerHeight;
      }
    }
    if (!(passedWidth && passedHeight) && makeOneRowHigh) {
      tempWidth = ratio * cellWidth;
      shouldUseWidth = true;
    }
    if (tempWidth > (parentWidth - 2) * cellWidth) tempWidth = (parentWidth - 2) * cellWidth;
    const width = tempWidth;
    const height = tempHeight ?? width / pxRatio;
    logger.info(
      `width for ${this.imageAlt || "unknown"}: pixels - ${width}, cells - ${width / cellWidth}`,
    );
    return {
      cellWidth,
      rowHeight,
      shouldUseWidth,
      width,
      height,
      imageType: imageSize.type,
    };
  }
  async #finishLoad(
    ctx: RenderContext,
    wrapper: BoxRenderable,
    spinner: TextRenderable,
    spinnerLoop: ReturnType<typeof setInterval>,
    parentWidth: number,
    makeOneRowHigh: boolean,
  ) {
    const tempBuf = await this.imageBuffer;
    if (tempBuf === undefined) {
      this.loadState = "loaded";
      spinner.visible = false;
      wrapper.remove(spinner);
      wrapper.add(
        new TextRenderable(ctx, {
          content: `\u{f082b} ${this.imageAlt}`,
          fg: "gray",
        }),
      );
      return;
    }
    const { cellWidth, rowHeight, shouldUseWidth, width, height, imageType } =
      await this.getImageSize(tempBuf, parentWidth, makeOneRowHigh, ctx);
    const buf =
      imageType === "svg"
        ? new Resvg(Buffer.from(tempBuf!), {
          fitTo: {
            mode: shouldUseWidth ? "width" : "height",
            value: shouldUseWidth ? width : height,
          },
          shapeRendering: 2,
        })
          .render()
          .asPng()
        : tempBuf;
    const imageRenderable = new ImageRenderable(ctx, {
      source: buf,
      id: `${this.id}__image`,
      padding: 0,
      margin: 0,
      width: Math.ceil(width / cellWidth),
      height: Math.ceil(height / rowHeight),
      onLoad: async () => {
        logger.info(`image height: px - ${height} colums - ${height / rowHeight}`);
        clearInterval(spinnerLoop);
        spinner.visible = false;
        wrapper.remove(spinner);
        this.loadState = "loaded";
      },
      onError: (err) => {
        clearInterval(spinnerLoop);
        logger.error(`Caught error: ${err}`);
        wrapper.add(
          new TextRenderable(ctx, {
            content: `\u{f082b} ${this.imageAlt}`,
            fg: "gray",
          }),
        );
        spinner.visible = false;
        wrapper.remove(spinner);
        this.loadState = "loaded";
      },
    });
    wrapper.add(imageRenderable);
    return;
  }
  load(ctx: RenderContext, parentWidth: number, makeOneRowHigh: boolean) {
    if (this.loadState === "loaded" || this.loadState === "loading") return;
    this.loadState = "loading";
    const tokenAlignment = this.token.attrGet("align");
    const alignment =
      tokenAlignment === "left" || tokenAlignment === "center" || tokenAlignment === "right"
        ? tokenAlignment
        : this.parentAlignment;
    logger.info(`token alignment for image is ${alignment}`);
    const wrapper = new BoxRenderable(
      ctx,
      alignment
        ? {
          width: parentWidth,
          flexDirection: "row",
          justifyContent:
            alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center",
        }
        : {},
    );
    const frames = Image.frames;
    const spinner = new TextRenderable(ctx, {
      content: `${frames[0]} Loading`,
      id: `${this.id}__spinner`,
    });
    const spinnerLoop = setInterval(() => {
      Image.frame = (Image.frame + 1) % frames.length;
      spinner.content = new StyledText([
        { text: `${frames[Image.frame]!} Loading`, __isChunk: true },
      ]);
    }, 80);
    wrapper.add(spinner);
    this.#finishLoad(...[ctx, wrapper, spinner, spinnerLoop, parentWidth, makeOneRowHigh]);
    return wrapper;
  }
}

if (printToStdout) {
  logbuf.length = 0;
  writeLog = () => { };
} else {
  writeLog = ({ level, line }) => {
    (level === "error" ? console.error : console.log)(line);
  };

  for (const entry of logbuf.splice(0)) {
    writeLog(entry);
  }
}
