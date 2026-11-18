import { type ColorInput } from "@opentui/core";
import { Glob } from "bun";
import { homedir } from "node:os";
import { join } from "node:path";

// These properties are common to Theme.foreground and Theme.background
type CommonThemeParameters = {
  default: ColorInput;
  link?: ColorInput;
  bottomBar?: ColorInput;
  bottomBarLeft?: ColorInput;
  toc?: ColorInput;
  codeBlockHeader?: ColorInput;
  inlineCode?: ColorInput;
  heading?: {
    h1?: ColorInput;
    h2?: ColorInput;
    h3?: ColorInput;
    h4?: ColorInput;
    h5?: ColorInput;
    h6?: ColorInput;
  };
};

type AlertTypes = {
  note?: ColorInput;
  tip?: ColorInput;
  important?: ColorInput;
  warning?: ColorInput;
  caution?: ColorInput;
};

type Theme = {
  name: string;
  foreground?: CommonThemeParameters;
  background?: CommonThemeParameters & { codeBlock?: ColorInput };
  alerts?: {
    borderCharacter?: string;
    borderCharacterColor?: AlertTypes;
    text?: AlertTypes;
  };
};

function isColorInput(val: ColorInput): val is ColorInput {
  const isString = typeof val === "string";
  const isRGBA = typeof val === "object" && val !== null && "r" in val && "g" in val && "b" in val;
  return isString || isRGBA;
}

function validateHeadingEntry(val: unknown): string[] {
  const errors = [];
  const headingKeys = ["h1", "h2", "h3", "h4", "h5", "h6"];
  if (!val) {
    errors.push("Configuration must not be null");
    return errors;
  }
  if (typeof val !== "object") {
    errors.push("Configuration must be key-value pairs at all levels, did you use a list?");
    return errors;
  }
  for (const [key, value] of Object.entries(val)) {
    if (!(key in headingKeys)) {
      errors.push(
        `${key} is not a valid key. Heading keys must be one of h1, h2, h3, h4, h5. or h6.`,
      );
    } else if (!isColorInput(value)) {
      errors.push(`${value} is an invalid value for heading.${key}`);
    }
  }
  return errors;
}

type CombinedCommonThemeParameters = CommonThemeParameters & { codeBlock: ColorInput };

function validateCommonThemeParameters(
  val: unknown,
  isBg: boolean,
): asserts val is CombinedCommonThemeParameters {
  const errors = [];
  const commonThemeParamsKeys = [
    "default",
    "link",
    "bottomBar",
    "bottomBarLeft",
    "toc",
    "codeBlockHeader",
    "inlineCode",
    "heading",
    ...(isBg ? (["codeBlock"] as const satisfies (keyof CombinedCommonThemeParameters)[]) : []),
  ] as const satisfies (keyof CombinedCommonThemeParameters)[];
  if (!val) {
    throw new Error(`foreground or background is null`);
  }
  if (typeof val !== "object") {
    throw new Error("Configuration must be key-value pairs at all levels, did you use a list?");
  }
  for (const [key, value] of Object.entries(val)) {
    if (!(key in commonThemeParamsKeys)) {
      errors.push(`${key} is not a valid key.`);
    } else if (!isColorInput(value)) {
      errors.push(`${value} is an invalid value for ${key}`);
    }
    if (key === "heading") {
      errors.push(...validateHeadingEntry(value));
    }
  }
  if (errors.length > 0) {
    throw new Error(`Errors: ${errors.join(", ")}`);
  }
}

function validateAlerts(val: unknown): asserts val is AlertTypes {
  const alertKeys = [
    "note",
    "caution",
    "tip",
    "important",
    "warning",
  ] as const satisfies (keyof AlertTypes)[];
  if (!val) {
    throw new Error(`alerts key is null`);
  }
  if (typeof val !== "object") {
    throw new Error("Configuration must be key-value pairs at all levels, did you use a list?");
  }
  for (const [key, value] of Object.entries(val)) {
    if (!(key in alertKeys)) {
      throw new Error(`${key} is not a valid key.`);
    } else if (!isColorInput(value)) {
      throw new Error(`${value} is an invalid value for ${key}`);
    }
  }
}

function isTheme(val: unknown): asserts val is Theme {
  const themeKeys = ["foreground", "background", "alerts"] as const satisfies (keyof Theme)[];
  const mapKeyToFunction = {
    name: (val: unknown) => {
      return typeof val === "string";
    },
    foreground: (val: unknown) => {
      validateCommonThemeParameters(val, false);
    },
    background: (val: unknown) => {
      validateCommonThemeParameters(val, true);
    },
    alerts: validateAlerts,
  };
  if (!val) {
    throw new Error(`Configuration must not be null`);
  }
  if (typeof val !== "object") {
    throw new Error("Configuration must be key-value pairs at all levels, did you use a list?");
  }
  for (const [key, value] of Object.entries(val)) {
    if (!(key in themeKeys)) {
      throw new Error(`${key} is not a valid key.`);
    }
    if (value === null) {
      throw new Error(`Value of ${key} must not be null`);
    }
    if (typeof value !== "object") {
      throw new Error(
        `Configuration must be key-value pairs at all levels, did you use a list for ${key}?`,
      );
    }
    try {
      // key definitely satisfies keyof Theme, TypeScript just doesn't see it
      mapKeyToFunction[key as keyof Theme](value);
    } catch (err) {
      throw err;
    }
  }
}

const themeFilesDir = join(homedir(), ".config", "remder", "themes");
const themeFiles = await Array.fromAsync(
  new Glob("*.yaml").scan({
    cwd: themeFilesDir,
    onlyFiles: true,
    absolute: true,
  }),
);
const themes: Theme[] = [
  {
    name: "Default dark",
    foreground: {
      default: "#fff",
      link: "#8af",
      inlineCode: "#fff",
      toc: "#fff",
      heading: {
        h1: "#ffa50a",
        h2: "#eeee00",
        h3: "#0acadd",
        h4: "#ffa5a5",
        h5: "#22ff22",
        h6: "#aaaaaa",
      },
    },
    background: {
      default: "transparent",
      codeBlock: "#222",
      inlineCode: "#222",
      bottomBar: "#282828",
      bottomBarLeft: "#089916",
    },
    alerts: {
      borderCharacter: "\u258c", // displays as ▌
      borderCharacterColor: {
        note: "#6af",
        tip: "#3b4",
        important: "#96f",
        warning: "#dd4",
        caution: "#f44",
      },
    },
  },
];
for (const theme of themeFiles) {
}
