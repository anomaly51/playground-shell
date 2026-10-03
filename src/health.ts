import { areToolLinksEnabled } from "./tool-links";

export type HealthState =
  | "checking"
  | "online"
  | "degraded"
  | "offline"
  | "unknown";

export type ProbeName =
  | "gateway"
  | "eventHub"
  | "processor"
  | "analytics"
  | "rabbitWorker"
  | "kafkaUi"
  | "adminer"
  | "redisInsight"
  | "airflow";

export interface ProbeResult {
  reachable: boolean;
  ok: boolean;
  status?: number;
  payload?: unknown;
}

export type ProbeResults = Partial<Record<ProbeName, ProbeResult>>;

export interface PlatformHealth {
  overall: HealthState;
  services: {
    gateway: HealthState;
    eventHub: HealthState;
    processor: HealthState;
    analytics: HealthState;
    kafka: HealthState;
    rabbitmq: HealthState;
    postgresql: HealthState;
    mysql: HealthState;
    redis: HealthState;
  };
  tools: {
    kafka: HealthState;
    rabbitmq: HealthState;
    postgresql: HealthState;
    mysql: HealthState;
    redis: HealthState;
    airflow: HealthState;
  };
}

export const platformProbeUrls: Record<ProbeName, string> = {
  gateway: "/api/readyz",
  eventHub: "/events/readyz",
  processor: "/ops/processor/readyz",
  analytics: "/ops/analytics/readyz",
  rabbitWorker: "/ops/rabbit-worker/readyz",
  kafkaUi: "/ops/tools/kafka-ui",
  adminer: "/ops/tools/adminer",
  redisInsight: "/ops/tools/redis-insight",
  airflow: "/ops/tools/airflow",
};

const healthLabels: Record<HealthState, string> = {
  checking: "Checking",
  online: "Operational",
  degraded: "Degraded",
  offline: "Unavailable",
  unknown: "Unknown",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function valueAt(payload: unknown, path: string[]): unknown {
  let current: unknown = payload;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function booleanAt(probe: ProbeResult | undefined, path: string[]): boolean | undefined {
  const value = valueAt(probe?.payload, path);
  return typeof value === "boolean" ? value : undefined;
}

function readinessAt(probe: ProbeResult | undefined): boolean | undefined {
  if (!probe?.reachable) return undefined;
  const status = valueAt(probe.payload, ["status"]);
  if (status === "ready" || status === "ok" || status === "UP") return true;
  if (status === "not-ready" || status === "stopping" || status === "DOWN") {
    return false;
  }
  return probe.ok;
}

export function airflowReadinessAt(
  probe: ProbeResult | undefined,
): boolean | undefined {
  if (!probe?.reachable) return undefined;
  const required = ["metadatabase", "scheduler", "dag_processor"] as const;
  const statuses = required.map((component) =>
    valueAt(probe.payload, [component, "status"]),
  );
  const isAirflowPayload = statuses.some(
    (status) => typeof status === "string",
  );
  if (!isAirflowPayload) return readinessAt(probe);
  return statuses.every((status) => status === "healthy");
}

export function aggregateObservations(
  observations: Array<boolean | undefined>,
): HealthState {
  const known = observations.filter(
    (value): value is boolean => typeof value === "boolean",
  );
  if (known.length === 0) return "unknown";
  if (known.every(Boolean)) return "online";
  if (known.every((value) => !value)) return "offline";
  return "degraded";
}

export function combineHealthStates(states: HealthState[]): HealthState {
  if (states.length === 0 || states.every((state) => state === "unknown")) {
    return "unknown";
  }
  if (states.every((state) => state === "checking")) return "checking";
  if (states.every((state) => state === "online")) return "online";
  if (states.every((state) => state === "offline")) return "offline";
  return "degraded";
}

function probeState(probe: ProbeResult | undefined): HealthState {
  return aggregateObservations([readinessAt(probe)]);
}

export function derivePlatformHealth(probes: ProbeResults): PlatformHealth {
  const gateway = aggregateObservations([readinessAt(probes.gateway)]);
  const eventHub = aggregateObservations([readinessAt(probes.eventHub)]);
  const analytics = aggregateObservations([readinessAt(probes.analytics)]);
  const processor = aggregateObservations([
    booleanAt(probes.gateway, ["dependencies", "processor"]),
    booleanAt(probes.processor, ["http"]),
  ]);
  const kafka = aggregateObservations([
    booleanAt(probes.eventHub, ["dependencies", "kafka"]),
    booleanAt(probes.processor, ["kafka"]),
    booleanAt(probes.analytics, ["kafka"]),
  ]);
  const rabbitmq = aggregateObservations([
    booleanAt(probes.eventHub, ["dependencies", "rabbitmq"]),
    booleanAt(probes.rabbitWorker, ["dependencies", "rabbitmq"]),
  ]);
  const postgresql = aggregateObservations([
    booleanAt(probes.gateway, ["dependencies", "postgres"]),
    booleanAt(probes.analytics, ["postgres"]),
  ]);
  const mysql = aggregateObservations([
    booleanAt(probes.rabbitWorker, ["dependencies", "mysql"]),
  ]);
  const redis = aggregateObservations([
    booleanAt(probes.gateway, ["dependencies", "redis"]),
  ]);

  const services = {
    gateway,
    eventHub,
    processor,
    analytics,
    kafka,
    rabbitmq,
    postgresql,
    mysql,
    redis,
  };

  return {
    overall: combineHealthStates(Object.values(services)),
    services,
    tools: {
      kafka: combineHealthStates([kafka, probeState(probes.kafkaUi)]),
      rabbitmq,
      postgresql: combineHealthStates([
        postgresql,
        probeState(probes.adminer),
      ]),
      mysql: combineHealthStates([mysql, probeState(probes.adminer)]),
      redis: combineHealthStates([
        redis,
        probeState(probes.redisInsight),
      ]),
      airflow: aggregateObservations([airflowReadinessAt(probes.airflow)]),
    },
  };
}

export async function probeUrl(
  url: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 2500,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    let payload: unknown;
    try {
      payload = (await response.clone().json()) as unknown;
    } catch {
      payload = undefined;
    }
    return {
      reachable: true,
      ok: response.ok,
      status: response.status,
      ...(payload === undefined ? {} : { payload }),
    };
  } catch {
    return { reachable: false, ok: false };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function probePlatformHealth(
  fetcher: typeof fetch = fetch,
): Promise<PlatformHealth> {
  const entries = await Promise.all(
    (Object.entries(platformProbeUrls) as Array<[ProbeName, string]>).filter(
      ([, url]) => areToolLinksEnabled() || !url.startsWith("/ops/tools/"),
    ).map(
      async ([name, url]) => [name, await probeUrl(url, fetcher)] as const,
    ),
  );
  return derivePlatformHealth(Object.fromEntries(entries) as ProbeResults);
}

export function renderHealthState(
  containerId: string,
  textId: string,
  state: HealthState,
): boolean {
  const container = document.getElementById(containerId);
  const text = document.getElementById(textId);
  if (!container || !text) return false;
  const label = healthLabels[state];
  if (container.dataset.state === state && text.textContent === label) {
    return false;
  }
  container.dataset.state = state;
  text.textContent = label;
  return true;
}

const toolTargets = {
  kafka: ["tool-kafka", "tool-kafka-state"],
  rabbitmq: ["tool-rabbitmq", "tool-rabbitmq-state"],
  postgresql: ["tool-postgresql", "tool-postgresql-state"],
  mysql: ["tool-mysql", "tool-mysql-state"],
  redis: ["tool-redis", "tool-redis-state"],
  airflow: ["tool-airflow", "tool-airflow-state"],
} as const;

export function renderPlatformHealth(snapshot: PlatformHealth): string[] {
  const transitions: string[] = [];
  if (
    renderHealthState(
      "platform-health",
      "platform-health-text",
      snapshot.overall,
    )
  ) {
    transitions.push("Platform: " + healthLabels[snapshot.overall] + ".");
  }

  (Object.entries(toolTargets) as Array<
    [keyof PlatformHealth["tools"], readonly [string, string]]
  >).forEach(([name, [containerId, textId]]) => {
    const state = snapshot.tools[name];
    if (renderHealthState(containerId, textId, state)) {
      transitions.push(name + ": " + healthLabels[state] + ".");
    }
  });

  const platform = document.getElementById("platform-health");
  platform?.setAttribute(
    "aria-label",
    "Platform status: " + healthLabels[snapshot.overall] + ".",
  );
  return transitions;
}

export function installPlatformHealthPolling(intervalMs = 10000): () => void {
  let disposed = false;
  let running = false;

  const poll = async () => {
    if (disposed || running) return;
    running = true;
    const snapshot = await probePlatformHealth();
    running = false;
    if (disposed) return;
    const transitions = renderPlatformHealth(snapshot);
    const announcer = document.getElementById("health-announcer");
    if (announcer && transitions.length > 0) {
      announcer.textContent = transitions.join(" ");
    }
  };

  const firstPoll = window.setTimeout(poll, 0);
  const interval = window.setInterval(poll, intervalMs);
  return () => {
    disposed = true;
    window.clearTimeout(firstPoll);
    window.clearInterval(interval);
  };
}
