export type ToolLinkName =
  | "kafka"
  | "rabbitmq"
  | "postgresql"
  | "mysql"
  | "redis"
  | "airflow";

export interface LocationLike {
  hostname: string;
}

export type ToolLinks = Partial<Record<ToolLinkName, string>>;

export function areToolLinksEnabled(): boolean {
  return typeof __ENABLE_TOOL_LINKS__ === "undefined" || __ENABLE_TOOL_LINKS__;
}

function hostForUrl(hostname: string): string {
  return hostname.includes(":") && !hostname.startsWith("[")
    ? "[" + hostname + "]"
    : hostname;
}

export function buildToolLinks(location: LocationLike): ToolLinks {
  if (!areToolLinksEnabled()) return {};
  const host = hostForUrl(location.hostname || "localhost");
  const url = (port: number, path = "/") =>
    "http://" + host + ":" + port + path;
  const ports = {
    kafka: 8083,
    rabbitmq: 15672,
    adminer: 8082,
    redis: 5540,
    airflow: 8088,
  };

  return {
    kafka: url(
      ports.kafka,
      "/ui/clusters/flashdrop/all-topics/flashdrop.orders.v1",
    ),
    rabbitmq: url(
      ports.rabbitmq,
      "/#/queues/%2F/flashdrop.inventory-worker.commands.v1",
    ),
    postgresql: url(
      ports.adminer,
      "/?pgsql=postgres&username=airflow&db=airflow&select=flashdrop_orders",
    ),
    mysql: url(
      ports.adminer,
      "/?server=mysql&username=message_lab&db=message_lab",
    ),
    redis: url(ports.redis),
    airflow: url(ports.airflow),
  };
}

export function installToolLinks(
  location: LocationLike = window.location,
): ToolLinks {
  const links = buildToolLinks(location);
  if (!areToolLinksEnabled()) {
    document.querySelector(".tool-nav")?.remove();
    return links;
  }
  (Object.entries(links) as Array<[ToolLinkName, string]>).forEach(
    ([name, href]) => {
      const anchor = document.querySelector<HTMLAnchorElement>(
        '[data-tool-link="' + name + '"]',
      );
      if (anchor) anchor.href = href;
    },
  );
  return links;
}
