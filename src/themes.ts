import { RGBA } from "@opentui/core";
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
  tasklist?: string;
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
    tasklist: z.string().optional(),
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
  background?: Simplify<CommonThemeParameters & { codeBlock?: string; detailsElement?: string }>;
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
        .toZod<Simplify<CommonThemeParameters & { codeBlock?: string; detailsElement?: string }>>()(
          z.strictObject({
            ...CommonThemeParametersSchema.shape,
            codeBlock: z.string().optional(),
            detailsElement: z.string().optional(),
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
        tasklist: configFg?.tasklist ?? defaultFg.tasklist,
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
        inlineCode: configBg?.inlineCode ?? defaultBg.inlineCode,
        codeBlock: configBg?.codeBlock ?? defaultBg.codeBlock,
        tasklist: configBg?.tasklist ?? defaultBg.tasklist,
        detailsElement: configBg?.detailsElement ?? defaultBg.detailsElement,
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

// Make all properties of a type required
export type DeepRequired<T> = T extends RGBA
  ? T
  : T extends object
  ? {
    [K in keyof T]-?: DeepRequired<T[K]>;
  }
  : T;

export const themes: Record<string, DeepRequired<Theme>> = {
  Dark: {
    name: "Dark",
    type: "dark",
    foreground: {
      default: "#fff",
      link: "#8af",
      inlineCode: "#fff",
      toc: "#fff",
      bottomBar: "#fff",
      bottomBarLeft: "#fff",
      codeBlockHeader: "#fff",
      tasklist: "#fff",
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
      link: "transparent",
      toc: "transparent",
      codeBlock: "#222",
      inlineCode: "#222",
      bottomBar: "#282828",
      bottomBarLeft: "#089916",
      tasklist: "#808080",
      detailsElement: "#333",
      heading: {
        h1: "transparent",
        h2: "transparent",
        h3: "transparent",
        h4: "transparent",
        h5: "transparent",
        h6: "transparent",
      },
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
      text: {
        note: "#6af",
        tip: "#3b4",
        important: "#96f",
        warning: "#dd4",
        caution: "#f44",
      },
    },
  },
  Light: {
    name: "Light",
    type: "light",
    foreground: {
      default: "#000",
      link: "#027",
      inlineCode: "#000",
      toc: "#000",
      bottomBar: "#000",
      bottomBarLeft: "#000",
      codeBlockHeader: "#000",
      tasklist: "#000",
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
      link: "transparent",
      toc: "transparent",
      heading: {
        h1: "transparent",
        h2: "transparent",
        h3: "transparent",
        h4: "transparent",
        h5: "transparent",
        h6: "transparent",
      },
      tasklist: "#bfbfbf",
      codeBlock: "#ddd",
      inlineCode: "#ddd",
      bottomBar: "#d7d7d7",
      detailsElement: "#ccc",
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
      text: {
        note: "#6af",
        tip: "#3b4",
        important: "#96f",
        warning: "#dd4",
        caution: "#f44",
      },
    },
  },
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
