/*
 * config.ts - manage config files
 * */
import { homedir } from "node:os";
import { join } from "path";
import { parseArgs } from "node:util";

// Use ~/.config/ on all systems, including Windows
// `~` resolves to `C:\Users\<user>\` on Windows
const configDir = join(homedir(), ".config", "remder");
const configFilePath = join(configDir, "config.yaml");

const args = parseArgs({
  options: {
    noRenderImages: {
      type: "boolean",
      short: "i",
    },
    noRenderHeadings: {
      type: "boolean",
      short: "H",
    },
    theme: {
      type: "string",
      short: "T",
    },
    width: {
      type: "string",
      short: "w",
    },
    height: {
      type: "string",
      short: "y",
    },
    printToStdout: {
      type: "boolean",
      short: "o",
    },
    debug: {
      type: "boolean",
      short: "d",
    },
    help: {
      type: "boolean",
      default: false,
      short: "h",
    },
  },
  allowPositionals: true,
});
const defaultArgs = {
  debug: false,
  noRenderImages: false,
  noRenderHeadings: false,
  printToStdout: false,
  theme: "Dark",
  width: process.stdout.columns?.toString() || "80",
  height: process.stdout.rows?.toString() || "25",
};
// Filter out supplied arguments whose value is undefined
const filterOutUndefinedArgs: {
  debug?: boolean;
  noRenderImages?: boolean;
  noRenderHeadings?: boolean;
  theme?: string;
  printToStdout?: boolean;
  width?: string;
  height?: string;
  help: boolean;
} = {
  ...Object.fromEntries(Object.entries(args.values).filter(([_, v]) => v !== undefined)),
  help: args.values.help, // This line is unnecessary, but TypeScript thinks otherwise
};
export const finalOpts: {
  positionals: string[];
  values: {
    debug: boolean;
    noRenderImages: boolean;
    noRenderHeadings: boolean;
    theme: string;
    printToStdout: boolean;
    width: string;
    height: string;
    help: boolean;
  };
} = {
  positionals: args.positionals,
  values: { ...defaultArgs, help: false },
};

try {
  const configFile = await Bun.file(configFilePath).text();
  const parsedConfig = Bun.YAML.parse(configFile);
  if (!parsedConfig || typeof parsedConfig !== "object") {
    throw new Error("Invalid configuration: File must be a flat structure.");
  }
  const errorList = [];
  const optsAndValuesMap: Record<string, "string" | "boolean"> = {
    debug: "boolean",
    noRenderImages: "boolean",
    noRenderHeadings: "boolean",
    theme: "string",
    printToStdout: "boolean",
    width: "string",
    height: "string",
  };
  for (const [key, value] of Object.entries(parsedConfig)) {
    // This serves to check if the key exists and the value is the specified type
    const mapKey = optsAndValuesMap[key];
    if (!mapKey) {
      errorList.push(`${key} is not an option`);
    } else if (typeof value !== mapKey) {
      errorList.push(`${key} should be of the type "${mapKey}"`);
    }
  }
  if (errorList.length > 0) {
    throw new Error(`Invalid config: ${errorList.join(", ")}`);
  }
  // Merge the parsed config
  finalOpts.values = {
    ...defaultArgs,
    ...parsedConfig,
    ...filterOutUndefinedArgs,
  };
} catch (err) {
  finalOpts.values = {
    ...defaultArgs,
    ...filterOutUndefinedArgs,
  };
  if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) {
    console.error(err);
  }
}
