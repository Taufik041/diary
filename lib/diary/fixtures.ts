import type { Page } from "./types";

// Recreates the mockup's "Desktop spread" (pages 11–12), with body text at
// the raised default size. Stand-in for real rows until the database exists.
//
// Photos: Wikimedia Commons, CC BY-SA 2.0 —
//   "Grey Heron, standing still" © Peter Barr
//   "Evening sun on the hedgerows" © Robin Webster
//   "Beach and Pier at low tide, Worthing" © Roger Kidd

const HERON =
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/62/Grey_Heron%2C_standing_still_-_geograph.org.uk_-_2527575.jpg/960px-Grey_Heron%2C_standing_still_-_geograph.org.uk_-_2527575.jpg";
const HEDGEROW =
  "https://upload.wikimedia.org/wikipedia/commons/0/08/Evening_sun_on_the_hedgerows_-_geograph.org.uk_-_2478945.jpg";
const PIER =
  "https://upload.wikimedia.org/wikipedia/commons/6/6a/Beach_and_Pier_at_low_tide%2C_Worthing%2C_West_Sussex_-_geograph.org.uk_-_4300244.jpg";

const DIARY_ID = "d-sample";

export const leftPage: Page = {
  id: "p-11",
  diary_id: DIARY_ID,
  index: 10,
  background: "blush",
  elements: [
    {
      id: "l-date",
      type: "text",
      x: 66,
      y: 56,
      w: 520,
      h: 80,
      rotation: -1.1,
      z: 1,
      content: "Tuesday, 8 September",
      style: "plain",
      fontFamily: "cormorant",
      fontSize: 46,
      color: "ink",
      align: "left",
      rule: true,
    },
    {
      id: "l-body",
      type: "text",
      x: 68,
      y: 158,
      w: 640,
      h: 440,
      rotation: -0.5,
      z: 1,
      content:
        "Slept badly and woke before the alarm, so I made coffee and sat on the back step until the neighbours' cat came over. The garden still smells of last night's rain. Sunday keeps coming back to me.",
      style: "plain",
      fontFamily: "caveat",
      fontSize: 39,
      color: "ink",
      align: "left",
    },
    {
      id: "l-clip",
      type: "clip",
      x: 712,
      y: 104,
      w: 28,
      h: 70,
      rotation: 16,
      z: 6,
    },
    {
      id: "l-hedgerow",
      type: "photo",
      x: 74,
      y: 640,
      w: 286,
      h: 348,
      rotation: -2.6,
      z: 2,
      src: HEDGEROW,
      frame: "thin",
    },
    {
      id: "l-tape",
      type: "tape",
      x: 396,
      y: 590,
      w: 132,
      h: 38,
      rotation: -27,
      z: 7,
      variant: "sage-stripe",
    },
    {
      id: "l-heron",
      type: "photo",
      x: 428,
      y: 616,
      w: 296,
      h: 302,
      rotation: 3.2,
      z: 3,
      src: HERON,
      frame: "polaroid",
      caption: "doing absolutely nothing",
    },
    {
      id: "l-aside",
      type: "text",
      x: 418,
      y: 942,
      w: 340,
      h: 122,
      rotation: 1.6,
      z: 1,
      content: "no photos for the first hour, then forty in ten minutes.",
      style: "plain",
      fontFamily: "caveat",
      fontSize: 32,
      color: "ink-soft",
      align: "left",
    },
  ],
};

export const rightPage: Page = {
  id: "p-12",
  diary_id: DIARY_ID,
  index: 11,
  background: "blush",
  elements: [
    {
      id: "r-card",
      type: "text",
      x: 64,
      y: 96,
      w: 400,
      h: 312,
      rotation: 1.7,
      z: 2,
      title: "Worth keeping from this week",
      content: "the smell of the wet lawn\nthirty seconds of quiet\na stamp from the pier",
      style: "card",
      fontFamily: "caveat",
      fontSize: 32,
      color: "ink",
      align: "left",
    },
    {
      id: "r-clip",
      type: "clip",
      x: 386,
      y: 74,
      w: 26,
      h: 64,
      rotation: -9,
      z: 5,
    },
    {
      id: "r-pier",
      type: "photo",
      x: 480,
      y: 262,
      w: 264,
      h: 338,
      rotation: -3.4,
      z: 3,
      src: PIER,
      frame: "rounded",
    },
    {
      id: "r-tape",
      type: "tape",
      x: 436,
      y: 568,
      w: 150,
      h: 40,
      rotation: 9,
      z: 7,
      variant: "rose-gingham",
    },
    {
      id: "r-body",
      type: "text",
      x: 70,
      y: 450,
      w: 380,
      h: 520,
      rotation: -0.7,
      z: 1,
      content:
        "Note to self: bring the little camera next time, and a proper jumper. We were both cold by the time we got back to the car and neither of us said so.",
      style: "plain",
      fontFamily: "caveat",
      fontSize: 39,
      color: "ink",
      align: "left",
    },
    {
      id: "r-time",
      type: "text",
      x: 480,
      y: 940,
      w: 242,
      h: 44,
      rotation: -1.4,
      z: 1,
      content: "nine forty, lamp on",
      style: "plain",
      fontFamily: "cormorant",
      fontSize: 30,
      color: "ink-faint",
      align: "right",
    },
  ],
};

export const sampleSpread = [leftPage, rightPage] as const;
