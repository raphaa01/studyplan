import type { CSSProperties } from "react";

type GroveDepth = "mist" | "middle" | "near";

interface GrovePlant {
  x: number;
  height: number;
  delay: number;
  duration: number;
  lean: number;
  depth: GroveDepth;
  mirror?: boolean;
}

const grove: GrovePlant[] = [
  { x: 1, height: 54, delay: -52, duration: 138, lean: -2.4, depth: "mist" },
  { x: 7, height: 82, delay: -38, duration: 156, lean: 1.2, depth: "middle", mirror: true },
  { x: 13, height: 65, delay: -91, duration: 164, lean: -1.4, depth: "near" },
  { x: 20, height: 44, delay: -17, duration: 129, lean: 2.2, depth: "mist", mirror: true },
  { x: 28, height: 34, delay: -73, duration: 142, lean: -1, depth: "middle" },
  { x: 36, height: 26, delay: -24, duration: 118, lean: 1.5, depth: "mist", mirror: true },
  { x: 44, height: 31, delay: -66, duration: 151, lean: -1.8, depth: "middle" },
  { x: 55, height: 28, delay: -33, duration: 132, lean: 1.2, depth: "mist", mirror: true },
  { x: 64, height: 36, delay: -82, duration: 160, lean: -1.5, depth: "middle" },
  { x: 72, height: 48, delay: -12, duration: 124, lean: 2.1, depth: "mist", mirror: true },
  { x: 80, height: 69, delay: -58, duration: 149, lean: -1.1, depth: "near" },
  { x: 87, height: 86, delay: -29, duration: 168, lean: 1.4, depth: "middle", mirror: true },
  { x: 93, height: 58, delay: -97, duration: 176, lean: -2, depth: "mist" },
  { x: 99, height: 92, delay: -45, duration: 171, lean: 1, depth: "near", mirror: true },
];

export function BambooGrove({ running }: { running: boolean }) {
  return <div className={`bamboo-grove ${running ? "is-growing" : "is-resting"}`} aria-hidden="true">
    <div className="bamboo-grove-sun" />
    <div className="bamboo-grove-ground" />
    {grove.map((plant, index) => <div
      className={`bamboo-grove-plant depth-${plant.depth} ${plant.mirror ? "is-mirrored" : ""}`}
      key={`${plant.x}-${index}`}
      style={{
        "--plant-x": `${plant.x}%`,
        "--plant-height": `${plant.height}vh`,
        "--plant-delay": `${plant.delay}s`,
        "--plant-duration": `${plant.duration}s`,
        "--plant-lean": `${plant.lean}deg`,
      } as CSSProperties}
    ><BambooCluster /></div>)}
    <div className="bamboo-grove-vignette" />
  </div>;
}

function BambooCluster() {
  return <svg viewBox="0 0 132 460" preserveAspectRatio="xMidYMax meet" focusable="false">
    <g className="bamboo-shadow">
      <polygon points="56 438 82 438 80 374 57 374" />
      <polygon points="57 366 80 366 78 303 59 303" />
      <polygon points="59 295 78 295 76 233 60 233" />
      <polygon points="60 225 76 225 74 166 62 166" />
      <polygon points="62 158 74 158 72 101 64 101" />
      <polygon points="64 93 72 93 70 43 66 43" />
    </g>
    <g className="bamboo-stalk-faces">
      <polygon className="face-main" points="56 438 76 438 74 374 57 374" />
      <polygon className="face-light" points="56 438 62 432 63 379 57 374" />
      <polygon className="face-dark" points="76 438 82 438 80 374 74 374" />
      <polygon className="face-main" points="57 366 74 366 73 303 59 303" />
      <polygon className="face-light" points="57 366 62 361 63 308 59 303" />
      <polygon className="face-dark" points="74 366 80 366 78 303 73 303" />
      <polygon className="face-main" points="59 295 73 295 72 233 60 233" />
      <polygon className="face-light" points="59 295 63 290 64 238 60 233" />
      <polygon className="face-dark" points="73 295 78 295 76 233 72 233" />
      <polygon className="face-main" points="60 225 72 225 70 166 62 166" />
      <polygon className="face-light" points="60 225 64 220 65 170 62 166" />
      <polygon className="face-dark" points="72 225 76 225 74 166 70 166" />
      <polygon className="face-main" points="62 158 70 158 69 101 64 101" />
      <polygon className="face-light" points="62 158 65 154 66 105 64 101" />
      <polygon className="face-dark" points="70 158 74 158 72 101 69 101" />
      <polygon className="face-main" points="64 93 69 93 69 43 66 43" />
      <polygon className="face-light" points="64 93 66 90 67 46 66 43" />
      <polygon className="face-dark" points="69 93 72 93 70 43 69 43" />
    </g>
    <g className="bamboo-nodes">
      <polygon points="53 374 83 374 78 366 56 366" />
      <polygon points="56 303 81 303 76 295 58 295" />
      <polygon points="58 233 79 233 74 225 59 225" />
      <polygon points="60 166 77 166 72 158 61 158" />
      <polygon points="62 101 75 101 70 93 63 93" />
    </g>
    <g className="bamboo-branches">
      <polygon points="61 321 34 286 39 283 65 311" />
      <polygon points="72 255 100 217 104 221 75 266" />
      <polygon points="63 189 34 153 38 150 67 181" />
      <polygon points="69 124 94 88 98 91 71 135" />
    </g>
    <g className="bamboo-leaves">
      <polygon points="37 283 6 268 29 297" />
      <polygon points="37 283 14 300 43 294" />
      <polygon points="101 218 128 199 111 229" />
      <polygon points="101 218 127 229 106 235" />
      <polygon points="36 151 5 137 29 166" />
      <polygon points="36 151 14 171 43 162" />
      <polygon points="95 89 122 70 106 101" />
      <polygon points="95 89 121 101 101 107" />
      <polygon points="68 45 54 11 71 30" />
      <polygon points="68 45 85 15 76 48" />
    </g>
    <g className="bamboo-young-shoot">
      <polygon className="face-main" points="19 439 34 439 31 371 22 371" />
      <polygon className="face-light" points="19 439 24 434 26 376 22 371" />
      <polygon className="face-dark" points="34 439 38 439 35 371 31 371" />
      <polygon className="shoot-tip" points="22 371 35 371 29 340" />
      <polygon className="shoot-leaf" points="28 356 4 339 23 366" />
    </g>
  </svg>;
}
