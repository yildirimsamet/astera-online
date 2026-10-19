/** Vite's open environment index otherwise leaks `any` into platform boundaries. */
interface ImportMetaEnv {
  readonly VITE_ASTERA_PLATFORM?: string;
  readonly VITE_ASTERA_API_URL?: string;
  /** Android versionCode of a bundled build; absent on the web. */
  readonly VITE_ASTERA_NATIVE_BUILD?: string;
}
