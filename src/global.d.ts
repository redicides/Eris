// Global type definitions

declare global {
  var eris: {
    maintenance: boolean;
    commandRatelimits: Set<string>;
  };
}

export {};
