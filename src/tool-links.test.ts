import { afterEach, describe, expect, it, vi } from "vitest";

import { buildToolLinks, installToolLinks } from "./tool-links";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("tool links", () => {
  it("keeps local infrastructure navigation enabled by default", () => {
    document.body.innerHTML = '<nav class="tool-nav"><a data-tool-link="kafka">Kafka</a></nav>';

    installToolLinks({ hostname: "localhost" });

    expect(document.querySelector(".tool-nav")).not.toBeNull();
    expect(document.querySelector("a")?.href).toContain("http://localhost:8083/");
  });

  it("removes infrastructure navigation and links when disabled", () => {
    vi.stubGlobal("__ENABLE_TOOL_LINKS__", false);
    document.body.innerHTML = '<nav class="tool-nav"><a data-tool-link="kafka">Kafka</a></nav>';

    expect(buildToolLinks({ hostname: "playground.example.com" })).toEqual({});
    expect(installToolLinks({ hostname: "playground.example.com" })).toEqual({});
    expect(document.querySelector(".tool-nav")).toBeNull();
  });

  it("preserves an IPv6 host with standard tool ports", () => {
    const links = buildToolLinks({ hostname: "::1" });
    expect(links.kafka).toContain("http://[::1]:8083/");
    expect(links.rabbitmq).toContain("http://[::1]:15672/");
    expect(links.postgresql).toContain("http://[::1]:8082/");
    expect(links.redis).toBe("http://[::1]:5540/");
    expect(links.airflow).toBe("http://[::1]:8088/");
  });

  it("uses default compose ports", () => {
    const links = buildToolLinks({ hostname: "127.0.0.1" });
    expect(links.kafka).toContain("127.0.0.1:8083");
    expect(links.mysql).toContain("127.0.0.1:8082");
    expect(links.redis).toBe("http://127.0.0.1:5540/");
    expect(links.airflow).toBe("http://127.0.0.1:8088/");
  });

  it("links directly to the learning resources", () => {
    const links = buildToolLinks({ hostname: "localhost" });
    expect(Object.keys(links)).toEqual([
      "kafka",
      "rabbitmq",
      "postgresql",
      "mysql",
      "redis",
      "airflow",
    ]);
    expect(links.kafka).toContain("flashdrop.orders.v1");
    expect(links.kafka).toContain("clusters/flashdrop");
    expect(links.rabbitmq).toContain("flashdrop.inventory-worker.commands.v1");
    expect(links.postgresql).toContain("pgsql=postgres");
    expect(links.postgresql).toContain("select=flashdrop_orders");
    expect(links.mysql).toContain("server=mysql");
  });
});
