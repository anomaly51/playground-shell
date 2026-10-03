export const topologyLoaderMarkup =
  '<div class="remote-loader" role="status" aria-live="polite">' +
  '<div class="remote-loader__line remote-loader__line--wide"></div>' +
  '<div class="remote-loader__canvas"></div>' +
  '<span>Loading topology</span>' +
  '</div>';

export const trafficLoaderMarkup =
  '<div class="remote-loader" role="status" aria-live="polite">' +
  '<div class="remote-loader__line"></div>' +
  '<div class="remote-loader__stack"></div>' +
  '<span>Loading traffic controls</span>' +
  '</div>';

const errorMarkup =
  '<div class="remote-load-error" role="alert">' +
  '<strong>This section is unavailable</strong>' +
  '<p>Check the remote bundle and import map.</p>' +
  '<a href="/">Reload</a>' +
  '</div>';

export const topologyErrorMarkup = errorMarkup;
export const trafficErrorMarkup = errorMarkup;
