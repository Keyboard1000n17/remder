import { RGBA, type ColorInput } from "@opentui/core";
import { Glob } from "bun";
import { homedir } from "node:os";
import { join } from "node:path";
import * as z from "zod";

type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

// These properties are common to Theme.foreground and Theme.background
type CommonThemeParameters = {
  default: string;
  link?: string;
  bottomBar?: string;
  bottomBarLeft?: string;
  toc?: string;
  inlineCode?: string;
  heading?: {
    h1?: string;
    h2?: string;
    h3?: string;
    h4?: string;
    h5?: string;
    h6?: string;
  };
};

const CommonThemeParametersSchema = z.toZod<CommonThemeParameters>()(
  z.strictObject({
    default: z.string(),
    link: z.string().optional(),
    bottomBar: z.string().optional(),
    bottomBarLeft: z.string().optional(),
    toc: z.string().optional(),
    inlineCode: z.string().optional(),
    heading: z
      .strictObject({
        h1: z.string().optional(),
        h2: z.string().optional(),
        h3: z.string().optional(),
        h4: z.string().optional(),
        h5: z.string().optional(),
        h6: z.string().optional(),
      })
      .optional(),
  }),
);

type AlertTypes = {
  note?: string;
  tip?: string;
  important?: string;
  warning?: string;
  caution?: string;
};

const AlertTypesSchema = z.toZod<AlertTypes>()(
  z.strictObject({
    note: z.string().optional(),
    tip: z.string().optional(),
    important: z.string().optional(),
    warning: z.string().optional(),
    caution: z.string().optional(),
  }),
);

export type Theme = {
  name: string;
  type: "light" | "dark";
  foreground?: Simplify<CommonThemeParameters & { codeBlockHeader?: string }>;
  background?: Simplify<CommonThemeParameters & { codeBlock?: string }>;
  alerts?: {
    borderCharacter?: string;
    borderCharacterColor?: AlertTypes;
    text?: AlertTypes;
  };
};

const ThemeSchema = z
  .toZod<Theme>()(
    z.strictObject({
      name: z.string(),
      type: z.literal(["light", "dark"]),
      foreground: z
        .toZod<Simplify<CommonThemeParameters & { codeBlockHeader?: string }>>()(
          z.strictObject({
            ...CommonThemeParametersSchema.shape,
            codeBlockHeader: z.string().optional(),
          }),
        )
        .optional(),
      background: z
        .toZod<Simplify<CommonThemeParameters & { codeBlock?: string }>>()(
          z.strictObject({
            ...CommonThemeParametersSchema.shape,
            codeBlock: z.string().optional(),
          }),
        )
        .optional(),
      alerts: z
        .strictObject({
          borderCharacter: z.string().optional(),
          borderCharacterColor: AlertTypesSchema.optional(),
          text: AlertTypesSchema.optional(),
        })
        .optional(),
    }),
  )
  .transform((config) => {
    const defaultTheme = config.type === "dark" ? themes["Dark"]! : themes["Light"]!;
    const configFg = config.foreground;
    const defaultFg = defaultTheme.foreground;
    const configBg = config.background;
    const defaultBg = defaultTheme.background;
    const configAlerts = config.alerts;
    const defaultAlerts = defaultTheme.alerts;
    return {
      ...defaultTheme,
      ...config,
      name: config.name,
      type: config.type,
      foreground: {
        default: configFg?.default ?? defaultFg.default,
        link: configFg?.link ?? defaultFg.link,
        bottomBar: configFg?.bottomBar ?? defaultFg.bottomBar,
        bottomBarLeft: configFg?.bottomBarLeft ?? defaultFg.bottomBarLeft,
        toc: configFg?.toc ?? defaultFg.toc,
        inlineCode: configFg?.toc ?? defaultFg.toc,
        codeBlockHeader: configFg?.codeBlockHeader ?? defaultFg.codeBlockHeader,
        heading: {
          h1: configFg?.heading?.h1 ?? defaultFg.heading.h1,
          h2: configFg?.heading?.h2 ?? defaultFg.heading.h2,
          h3: configFg?.heading?.h3 ?? defaultFg.heading.h3,
          h4: configFg?.heading?.h4 ?? defaultFg.heading.h4,
          h5: configFg?.heading?.h5 ?? defaultFg.heading.h5,
          h6: configFg?.heading?.h6 ?? defaultFg.heading.h6,
        },
      },
      background: {
        default: configBg?.default ?? defaultBg.default,
        link: configBg?.link ?? defaultBg.link,
        bottomBar: configBg?.bottomBar ?? defaultBg.bottomBar,
        bottomBarLeft: configBg?.bottomBarLeft ?? defaultBg.bottomBarLeft,
        toc: configBg?.toc ?? defaultBg.toc,
        inlineCode: configBg?.toc ?? defaultBg.toc,
        codeBlock: configBg?.codeBlock ?? defaultBg.codeBlock,
        heading: {
          h1: configBg?.heading?.h1 ?? defaultBg.heading.h1,
          h2: configBg?.heading?.h2 ?? defaultBg.heading.h2,
          h3: configBg?.heading?.h3 ?? defaultBg.heading.h3,
          h4: configBg?.heading?.h4 ?? defaultBg.heading.h4,
          h5: configBg?.heading?.h5 ?? defaultBg.heading.h5,
          h6: configBg?.heading?.h6 ?? defaultBg.heading.h6,
        },
      },
      alerts: {
        borderCharacter: configAlerts?.borderCharacter ?? defaultAlerts.borderCharacter,
        borderCharacterColor: {
          note: configAlerts?.borderCharacterColor?.note ?? defaultAlerts.borderCharacterColor.note,
          tip: configAlerts?.borderCharacterColor?.tip ?? defaultAlerts.borderCharacterColor.tip,
          important:
            configAlerts?.borderCharacterColor?.important
            ?? defaultAlerts.borderCharacterColor.important,
          warning:
            configAlerts?.borderCharacterColor?.warning
            ?? defaultAlerts.borderCharacterColor.warning,
          caution:
            configAlerts?.borderCharacterColor?.caution
            ?? defaultAlerts.borderCharacterColor.caution,
        },
        text: {
          note: configAlerts?.borderCharacterColor?.note ?? defaultAlerts.borderCharacterColor.note,
          tip: configAlerts?.borderCharacterColor?.tip ?? defaultAlerts.borderCharacterColor.tip,
          important:
            configAlerts?.borderCharacterColor?.important
            ?? defaultAlerts.borderCharacterColor.important,
          warning:
            configAlerts?.borderCharacterColor?.warning
            ?? defaultAlerts.borderCharacterColor.warning,
          caution:
            configAlerts?.borderCharacterColor?.caution
            ?? defaultAlerts.borderCharacterColor.caution,
        },
      },
    };
  });

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
    if (!headingKeys.includes(key)) {
      errors.push(
        `${key} is not a valid key. Heading keys must be one of h1, h2, h3, h4, h5. or h6.`,
      );
    } else if (typeof value !== "string") {
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
    if (!(commonThemeParamsKeys as string[]).includes(key)) {
      errors.push(`${key} is not a valid key.`);
    } else if (key !== "heading" && typeof value !== "string") {
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
    if (!(alertKeys as string[]).includes(key)) {
      throw new Error(`${key} is not a valid key.`);
    } else if (typeof value !== "string") {
      throw new Error(`${value} is an invalid value for ${key}`);
    }
  }
}

function isTheme(val: unknown): asserts val is Theme {
  const themeKeys = [
    "name",
    "type",
    "foreground",
    "background",
    "alerts",
  ] satisfies (keyof Theme)[];
  const mapKeyToFunction = {
    name: (val: unknown) => {
      return typeof val === "string" && val !== "Default Light" && val !== "Default Dark";
    },
    type: (val: unknown) => {
      return val === "left" || val === "right";
    },
    foreground: (val: unknown) => {
      validateCommonThemeParameters(val, false);
    },
    background: (val: unknown) => {
      validateCommonThemeParameters(val, true);
    },
    alerts: validateAlerts,
  };
  const mapKeyToValueType: Record<keyof Theme, "string" | "object"> = {
    name: "string",
    type: "string",
    foreground: "object",
    background: "object",
    alerts: "object",
  };
  if (!val) {
    throw new Error(`Configuration must not be null`);
  }
  if (typeof val !== "object") {
    throw new Error("Configuration must be key-value pairs at all levels, did you use a list?");
  }
  for (const [key, value] of Object.entries(val)) {
    if (!(themeKeys as string[]).includes(key)) {
      throw new Error(`${key} is not a valid key.`);
    }
    if (!value) {
      throw new Error(`Value of ${key} must not be null or undefined`);
    }
    if (typeof value !== mapKeyToValueType[key as keyof Theme]) {
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

function fillDefaults(theme: Theme, fallback?: ColorInput): DeepRequired<Theme> {
  const commonKeys = [
    "link",
    "bottomBar",
    "bottomBarLeft",
    "toc",
    "inlineCode",
    "heading",
  ] as const satisfies (keyof CommonThemeParameters)[];
  const headingKeys = ["h1", "h2", "h3", "h4", "h5", "h6"];
  if (theme.foreground) {
    const fg = theme.foreground;
    const defaultValue = fg.default ?? fallback;
    for (const key of commonKeys) {
      if (key === "heading") {
        if (fg.heading) {
          const heading = fg.heading;
          const headingColor = heading.h1 ?? defaultValue;
          for (const h of headingKeys) {
            if (!Object.hasOwn(heading, h)) {
              Object.defineProperty(heading, h, headingColor);
            }
          }
        } else {
          fg.heading = {
            h1: defaultValue,
            h2: defaultValue,
            h3: defaultValue,
            h4: defaultValue,
            h5: defaultValue,
            h6: defaultValue,
          };
        }
        continue;
      }
      if (!fg[key]) {
        fg[key] = defaultValue;
      }
    }
  }
  if (theme.background) {
    const bg = theme.background;
    const defaultValue = bg.default ?? fallback;
    for (const key of [
      ...commonKeys,
      "codeBlock",
    ] as const satisfies (keyof CombinedCommonThemeParameters)[]) {
      if (key === "heading") {
        if (bg.heading) {
          const heading = bg.heading;
          const headingColor = heading.h1 ?? defaultValue;
          for (const h of headingKeys) {
            if (!Object.hasOwn(heading, h)) {
              Object.defineProperty(heading, h, headingColor);
            }
          }
        } else {
          bg.heading = {
            h1: defaultValue,
            h2: defaultValue,
            h3: defaultValue,
            h4: defaultValue,
            h5: defaultValue,
            h6: defaultValue,
          };
        }
        continue;
      }
      if (!bg[key]) {
        bg[key] = defaultValue;
      }
    }
  }
  return theme as DeepRequired<Theme>;
}

// Make all properties of a type required
export type DeepRequired<T> = T extends RGBA
  ? T
  : T extends object
  ? {
    [K in keyof T]-?: DeepRequired<T[K]>;
  }
  : T;

export const themes: Record<string, DeepRequired<Theme>> = {
  Dark: fillDefaults({
    name: "Dark",
    type: "dark",
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
  }),
  Light: fillDefaults({
    name: "Light",
    type: "light",
    foreground: {
      default: "#000",
      link: "#027",
      inlineCode: "#000",
      toc: "#000",
      heading: {
        h1: "#996100",
        h2: "#666600",
        h3: "#045962",
        h4: "#cc1f4f",
        h5: "#006600",
        h6: "#333333",
      },
    },
    background: {
      default: "transparent",
      codeBlock: "#ddd",
      inlineCode: "#ddd",
      bottomBar: "#d7d7d7",
      bottomBarLeft: "#66f774",
    },
    alerts: {
      borderCharacter: "\u258c",
      borderCharacterColor: {
        note: "#6af",
        tip: "#3b4",
        important: "#96f",
        warning: "#dd4",
        caution: "#f44",
      },
    },
  }),
};
try {
  const themeFilesDir = join(homedir(), ".config", "remder", "themes");
  const themeFiles = await Array.fromAsync(
    new Glob("*.yaml").scan({
      cwd: themeFilesDir,
      onlyFiles: true,
      absolute: true,
    }),
  );
  for (const theme of themeFiles) {
    try {
      const file = await Bun.file(theme).text();
      const parsedYaml = Bun.YAML.parse(file);
      const parsedTheme = ThemeSchema.parse(parsedYaml);
      themes[parsedTheme.name] = parsedTheme;
    } catch (e) {
      console.error(e);
    }
  }
} catch (e) {
  if (e instanceof Error && "code" in e && e.code !== "ENOENT") {
    console.error(e);
  }
}
