import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BambooGrove } from "@/components/bamboo-grove";

describe("BambooGrove", () => {
  it("stays invisible and outside document flow before CSS loads", () => {
    const markup = renderToStaticMarkup(createElement(BambooGrove, { running: false }));

    expect(markup).toContain("position:fixed");
    expect(markup).toContain("height:100vh");
    expect(markup).toContain("position:absolute");
    expect(markup).toContain("opacity:0");
    expect(markup).toContain('fill="#698466"');
    expect(markup.match(/bamboo-grove-plant/g)).toHaveLength(6);
    expect(markup).not.toMatch(/--plant-delay:-/);
  });
});
