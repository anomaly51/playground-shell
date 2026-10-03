import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aggregateObservations,
  derivePlatformHealth,
  platformProbeUrls,
  probePlatformHealth,
  probeUrl,
  renderHealthState,
  type ProbeResult,
  type ProbeResults,
} from "./health";

afterEach(() => {
  vi.unstubAllGlobals();
});

const ready = (payload: unknown): ProbeResult => ({
  reachable: true,
  ok: true,
  status: 200,
  payload,
});

function fullyReady(): ProbeResults {
  return {
    gateway: ready({
      status: "ready",
      dependencies: {
        brokers: true,
        processor: true,
        postgres: true,
        redis: true,
      },
    }),
    eventHub: ready({
      status: "ready",
      dependencies: { kafka: true, rabbitmq: true },
    }),
    processor: ready({ status: "ready", http: true, kafka: true }),
    analytics: ready({ status: "ready", kafka: true, postgres: true }),
    rabbitWorker: ready({
      status: "ready",
      dependencies: { rabbitmq: true, mysql: true },
    }),
    kafkaUi: ready({ status: "UP" }),
    adminer: ready(undefined),
    redisInsight: ready(undefined),
    airflow: ready({
      metadatabase: { status: "healthy" },
      scheduler: { status: "healthy" },
      dag_processor: { status: "healthy" },
      triggerer: { status: null },
    }),
  };
}

describe("platform readiness", () => {
  it("probes optional infrastructure tools by default", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));

    await probePlatformHealth(fetcher);

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(Object.values(platformProbeUrls));
  });

  it("keeps service probes but skips optional tools when disabled", async () => {
    vi.stubGlobal("__ENABLE_TOOL_LINKS__", false);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));

    await probePlatformHealth(fetcher);

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/readyz",
      "/events/readyz",
      "/ops/processor/readyz",
      "/ops/analytics/readyz",
      "/ops/rabbit-worker/readyz",
    ]);
  });

  it("aggregates mixed observations as degraded", () => {
    expect(aggregateObservations([true, false, undefined])).toBe("degraded");
    expect(aggregateObservations([undefined])).toBe("unknown");
  });

  it("derives broker, database, and tool readiness", () => {
    const health = derivePlatformHealth(fullyReady());
    expect(health.overall).toBe("online");
    expect(health.services.kafka).toBe("online");
    expect(health.services.rabbitmq).toBe("online");
    expect(health.services.redis).toBe("online");
    expect(health.tools.postgresql).toBe("online");
    expect(health.services.analytics).toBe("online");
    expect(health.tools.redis).toBe("online");
  });

  it("shows optional Redis loss as degraded while Gateway remains online", () => {
    const probes = fullyReady();
    probes.gateway = ready({
      status: "ready",
      dependencies: {
        brokers: true,
        processor: true,
        postgres: true,
        redis: false,
      },
    });

    const health = derivePlatformHealth(probes);
    expect(health.services.gateway).toBe("online");
    expect(health.services.redis).toBe("offline");
    expect(health.tools.redis).toBe("degraded");
    expect(health.overall).toBe("degraded");
  });

  it("uses a 503 body instead of falling back to liveness", () => {
    const probes = fullyReady();
    probes.analytics = {
      reachable: true,
      ok: false,
      status: 503,
      payload: { status: "not-ready", kafka: true, postgres: false },
    };

    const health = derivePlatformHealth(probes);
    expect(health.services.kafka).toBe("online");
    expect(health.services.analytics).toBe("offline");
    expect(health.services.postgresql).toBe("degraded");
    expect(health.overall).toBe("degraded");
  });

  it("retains analytics as an independent readiness check", () => {
    const probes = fullyReady();
    probes.analytics = { reachable: false, ok: false };

    const health = derivePlatformHealth(probes);
    expect(health.services.postgresql).toBe("online");
    expect(health.services.analytics).toBe("unknown");
    expect(health.overall).toBe("degraded");
  });

  it("does not report Airflow online when HTTP is 200 but scheduler is unhealthy", () => {
    const probes = fullyReady();
    probes.airflow = ready({
      metadatabase: { status: "healthy" },
      scheduler: { status: "unhealthy" },
      dag_processor: { status: "healthy" },
    });

    expect(derivePlatformHealth(probes).tools.airflow).toBe("offline");
  });

  it("requires every Airflow control-plane component to be healthy", () => {
    const probes = fullyReady();
    expect(derivePlatformHealth(probes).tools.airflow).toBe("online");

    probes.airflow = ready({
      metadatabase: { status: "healthy" },
      scheduler: { status: "healthy" },
    });
    expect(derivePlatformHealth(probes).tools.airflow).toBe("offline");
  });

  it("parses JSON from an unsuccessful readiness response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ status: "not-ready", dependencies: { mysql: false } }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(probeUrl("/ops/rabbit-worker/readyz", fetcher)).resolves.toMatchObject({
      reachable: true,
      ok: false,
      status: 503,
      payload: { status: "not-ready", dependencies: { mysql: false } },
    });
  });

  it("renders an English semantic state", () => {
    document.body.innerHTML =
      '<span id="target"><strong id="target-text"></strong></span>';
    expect(renderHealthState("target", "target-text", "online")).toBe(true);
    expect(document.getElementById("target")?.dataset.state).toBe("online");
    expect(document.getElementById("target-text")?.textContent).toBe("Operational");
  });
});
