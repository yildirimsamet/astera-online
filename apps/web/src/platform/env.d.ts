/** Vite's open environment index otherwise leaks `any` into platform boundaries. */
interface ImportMetaEnv {
  readonly VITE_ASTERA_PLATFORM?: string;
  readonly VITE_ASTERA_API_URL?: string;
}
