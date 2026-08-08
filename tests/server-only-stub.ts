// `server-only` throws on import outside a React Server Component, which is
// exactly what it is for -- and which also stops vitest from importing any
// module that uses it. Aliasing it to nothing in the TEST configs lets the
// suites exercise those modules without touching production behaviour: the
// real package is still resolved by `next build`, so a client component that
// imports a server module is still a build error.
export {};
