import { createRoot } from "react-dom/client";
import "@fontsource-variable/space-grotesk";
import "./base.css";
import "./crowd.css";
import { connect } from "../../../packages/game-sdk/dingn-sdk.js";
import { DingnProvider } from "./dingn";
import { CrowdGame } from "./crowd-game";
import { loadStore } from "./crowd-shared";

const sdk = await connect();
document.documentElement.lang = sdk.locale;
await loadStore(sdk.storage);
createRoot(document.getElementById("root")!).render(
  <DingnProvider sdk={sdk}>
    <CrowdGame />
  </DingnProvider>,
);
sdk.ready();
