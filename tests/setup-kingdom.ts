// dingn has no kingdom rules of its own: the pages use the live plugin's
// (src/lib/reward-plugin.ts). Tests use the version installed as a dev
// dependency, as if it had loaded.
import * as kingdomRules from "kingdom/rules";
import { setKingdomRules } from "../src/lib/reward-plugin";

setKingdomRules(kingdomRules);
