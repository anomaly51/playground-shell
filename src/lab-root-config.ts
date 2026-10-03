import "./set-public-path";
import "./styles.css";

import {
  constructApplications,
  constructLayoutEngine,
  constructRoutes,
} from "single-spa-layout";
import { registerApplication, start } from "single-spa";

import { installPlatformHealthPolling } from "./health";
import {
  topologyErrorMarkup,
  topologyLoaderMarkup,
  trafficErrorMarkup,
  trafficLoaderMarkup,
} from "./loaders";
import layoutDefinition from "./microfrontend-layout.html";
import { installToolLinks } from "./tool-links";

const routes = constructRoutes(layoutDefinition, {
  props: {},
  loaders: {
    topologyLoader: topologyLoaderMarkup,
    trafficLoader: trafficLoaderMarkup,
  },
  errors: {
    topologyError: topologyErrorMarkup,
    trafficError: trafficErrorMarkup,
  },
});

const applications = constructApplications({
  routes,
  loadApp: ({ name }) => System.import(name),
});

applications.forEach(registerApplication);

const layoutEngine = constructLayoutEngine({ routes, applications });
layoutEngine.activate();
start({ urlRerouteOnly: true });

const installToolLinksTimer = window.setTimeout(installToolLinks, 0);
const stopHealthPolling = installPlatformHealthPolling();

if (module.hot) {
  module.hot.dispose(() => {
    window.clearTimeout(installToolLinksTimer);
    stopHealthPolling();
  });
}
