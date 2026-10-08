// YKK AP residential catalog product-type illustrations.
// Self-hosted in src/assets/ykk/ — downloaded from YKK AP's residential catalog.

import typeSingleHung from "./ykk/type-single-hung.webp";
import typeDoubleHung from "./ykk/type-double-hung.webp";
import typeCasement from "./ykk/type-casement.webp";
import typeAwning from "./ykk/type-awning.webp";
import typePicture from "./ykk/type-picture.webp";
import typeTransom from "./ykk/type-transom.webp";
import typeGeometric from "./ykk/type-geometric.webp";
import typeSlider from "./ykk/type-slider.webp";
import typePatio from "./ykk/type-patio-door.webp";

import svcDoubleHung from "./ykk/styleview-classic-double-hung.webp";
import svcPicture from "./ykk/styleview-classic-picture.webp";
import svcTransom from "./ykk/styleview-classic-transom.webp";
import svcCasement from "./ykk/styleview-classic-casement.webp";
import svcCasementPicture from "./ykk/styleview-classic-casement-picture.webp";
import svcAwning from "./ykk/styleview-classic-awning.webp";
import svcSlider from "./ykk/styleview-classic-slider.webp";
import svcGeometric from "./ykk/styleview-classic-geometric.webp";
import precPicture from "./ykk/precedence-picture.webp";
import precCasement from "./ykk/precedence-casement.webp";
import precAwning from "./ykk/precedence-awning.webp";
import precDoubleHung from "./ykk/precedence-double-hung.webp";
import precDoubleSlider from "./ykk/precedence-double-slider.webp";
import svDoubleHung from "./ykk/styleview-double-hung.webp";
import svCasement from "./ykk/styleview-casement.webp";
import svSlider from "./ykk/styleview-slider.webp";
import svfDoubleHung from "./ykk/styleview-flange-double-hung.webp";
import svfCasement from "./ykk/styleview-flange-casement.webp";
import sgDoubleHung from "./ykk/styleguard-double-hung.webp";
import sgCasement from "./ykk/styleguard-casement.webp";
import svPatioDoor from "./ykk/styleview-sliding-patio-door.webp";
import svHdDoor from "./ykk/styleview-hd-sliding-door.webp";
import sgHdDoor from "./ykk/styleguard-hd-sliding-door.webp";

import finishWhite from "./ykk/finish-white.webp";
import finishTan from "./ykk/finish-tan.webp";
import finishStone from "./ykk/finish-stone.webp";
import finishBronze from "./ykk/finish-bronze.webp";
import finishBlack from "./ykk/finish-black.webp";

import glass366 from "./ykk/glass-low-e-366.webp";
import glass270 from "./ykk/glass-low-e-270.webp";
import glassClear from "./ykk/glass-clear.webp";
import glassGrey from "./ykk/glass-grey-tint.webp";
import glassBronze from "./ykk/glass-bronze-tint.webp";
import glassRain from "./ykk/glass-rain.webp";
import glassObscure from "./ykk/glass-obscure.webp";

import gridColonial from "./ykk/grid-colonial.webp";
import gridPrairie from "./ykk/grid-prairie.webp";
import gridTracery from "./ykk/grid-tracery.webp";
import gridDiamond from "./ykk/grid-diamond.webp";
import gridValance from "./ykk/grid-valance.webp";
import gridValanceXt from "./ykk/grid-valance-xt.webp";
import gridPerimeterPrairie from "./ykk/grid-perimeter-prairie.webp";
import gridSdl from "./ykk/grid-simulated-divided-lines.webp";
import gridFlat from "./ykk/grid-flat-between-glass.webp";
import gridSculptured from "./ykk/grid-sculptured-between-glass.webp";

export const YKK_TYPE_IMAGES: Record<string, string> = {
  singlehung: typeSingleHung,
  doublehung: typeDoubleHung,
  casement: typeCasement,
  awning: typeAwning,
  picture: typePicture,
  transom: typeTransom,
  geometric: typeGeometric,
  slider: typeSlider,
  patio: typePatio,
};

export interface YkkProductPhoto {
  series: string;
  type: string;
  src: string;
}

/** Real YKK AP catalog product photography (series-specific). */
export const YKK_PRODUCT_PHOTOS: YkkProductPhoto[] = [
  { series: "StyleView Classic", type: "Double-Hung", src: svcDoubleHung },
  { series: "StyleView Classic", type: "Picture Window", src: svcPicture },
  { series: "StyleView Classic", type: "Transom", src: svcTransom },
  { series: "StyleView Classic", type: "Casement", src: svcCasement },
  { series: "StyleView Classic", type: "Casement Picture", src: svcCasementPicture },
  { series: "StyleView Classic", type: "Awning", src: svcAwning },
  { series: "StyleView Classic", type: "Slider", src: svcSlider },
  { series: "StyleView Classic", type: "Geometric", src: svcGeometric },
  { series: "Precedence", type: "Picture Window", src: precPicture },
  { series: "Precedence", type: "Casement", src: precCasement },
  { series: "Precedence", type: "Awning", src: precAwning },
  { series: "Precedence", type: "Double-Hung", src: precDoubleHung },
  { series: "Precedence", type: "Double Slider", src: precDoubleSlider },
  { series: "StyleView", type: "Double-Hung", src: svDoubleHung },
  { series: "StyleView", type: "Casement", src: svCasement },
  { series: "StyleView", type: "Slider", src: svSlider },
  { series: "StyleView Flange", type: "Double-Hung", src: svfDoubleHung },
  { series: "StyleView Flange", type: "Casement", src: svfCasement },
  { series: "StyleGuard", type: "Double-Hung", src: sgDoubleHung },
  { series: "StyleGuard", type: "Casement", src: sgCasement },
];

export interface YkkFinish {
  name: string;
  src: string;
}

/** YKK AP residential vinyl finish swatches. */
export const YKK_FINISHES: YkkFinish[] = [
  { name: "White", src: finishWhite },
  { name: "Tan", src: finishTan },
  { name: "Stone", src: finishStone },
  { name: "Bronze", src: finishBronze },
  { name: "Black", src: finishBlack },
];

export interface YkkGlassOption {
  name: string;
  detail: string;
  src: string;
}

/** YKK AP residential glass packages and appearances. */
export const YKK_GLASS: YkkGlassOption[] = [
  {
    name: "Low-E 366",
    detail:
      "Reduces heat gain by 64% and blocks 95% of the sun's UV rays. Argon gas fill available.",
    src: glass366,
  },
  {
    name: "Low-E 270",
    detail:
      "Reduces heat gain by 50% and blocks 86% of the sun's UV rays. Argon gas fill available.",
    src: glass270,
  },
  { name: "Clear", detail: "Standard glass appearance.", src: glassClear },
  { name: "Grey tint", detail: "Tinted glass appearance.", src: glassGrey },
  { name: "Bronze tint", detail: "Tinted glass appearance.", src: glassBronze },
  { name: "Rain", detail: "Decorative obscure glass.", src: glassRain },
  { name: "Obscure", detail: "Privacy glass.", src: glassObscure },
];

export interface YkkGridOption {
  name: string;
  src: string;
}
/** YKK AP residential grid patterns and styles. */
export const YKK_GRIDS: YkkGridOption[] = [
  { name: "Colonial", src: gridColonial },
  { name: "Prairie", src: gridPrairie },
  { name: "Tracery", src: gridTracery },
  { name: "Diamond", src: gridDiamond },
  { name: "Valance", src: gridValance },
  { name: "Valance XT", src: gridValanceXt },
  { name: "Perimeter Prairie", src: gridPerimeterPrairie },
  { name: "Simulated Divided Lines", src: gridSdl },
  { name: "Flat Grids Between Glass", src: gridFlat },
  { name: "Sculptured Grids Between Glass", src: gridSculptured },
];

/** Distinct catalog photo per window series, for series cards. */
export const SERIES_CARD_IMAGES: Record<string, string> = {
  "styleview-classic": svcCasement,
  styleview: svDoubleHung,
  "styleview-flange": svfDoubleHung,
  precedence: precCasement,
  styleguard: sgDoubleHung,
  "styleguard-flange": sgCasement,
  "styleview-patio-door": svPatioDoor,
  "styleview-hd": svHdDoor,
  "styleguard-hd": sgHdDoor,
};
