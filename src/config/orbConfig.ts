import type { ISourceOptions } from "tsparticles-engine";

export const backgroundConfig: ISourceOptions = {
  fullscreen: false,
  style: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 0,
  },
  particles: {
    number: {
      value: 100,
      density: {
        enable: true,
      },
    },
    color: {
      value: "#ffffff",
    },
    shape: {
      type: "circle",
    },
    opacity: {
      value: { min: 0.1, max: 0.5 },
    },
    size: {
      value: { min: 1, max: 2 },
    },
    links: {
      enable: false,
    },
    move: {
      enable: true,
      speed: 0.5,
      direction: "none",
      straight: false,
    },
  },
  interactivity: {
    events: {
      onHover: {
        enable: true,
        mode: "bubble",
      },
      resize: true,
    },
    modes: {
      bubble: {
        distance: 100,
        duration: 2,
        opacity: 0.8,
        size: 3,
      },
    },
  },
  background: {
    color: "transparent",
  },
};

export const orbConfig: ISourceOptions = {
  fullscreen: false,
  style: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 1,
  },
  particles: {
    number: {
      value: 250,
      density: {
        enable: true,
        area: 800,
      },
    },
    color: {
      value: ["#00BFFF", "#8A2BE2", "#FF00FF"],
    },
    shape: {
      type: "circle",
    },
    opacity: {
      value: { min: 0.3, max: 0.8 },
    },
    size: {
      value: { min: 1, max: 3 },
    },
    links: {
      enable: false,
    },
    move: {
      enable: true,
      speed: 1,
      direction: "none",
      random: true,
      straight: false,
      outModes: {
        default: "out",
      },
    },
    shadow: {
      enable: true,
      color: "#00BFFF",
      blur: 10,
    },
  },
  interactivity: {
    events: {
      resize: true,
    },
  },
  background: {
    color: "transparent",
  },
  polygon: {
    enable: true,
    type: "inside",
    move: {
      radius: 20,
    },
    scale: 0.4,
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='1000'><circle cx='500' cy='500' r='500' fill='%23fff'/></svg>",
  },
};