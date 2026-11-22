// dingn has no rules of its own: it runs the live kingdom plugin's
// (scripts/reward-plugin.mjs). Tests run the version installed as a dev
// dependency, as if it were live. Import this first.
import * as kingdomRules from "kingdom/rules";
import { setRules } from "../scripts/reward-plugin.mjs";

setRules(kingdomRules);
