import { createContext, useContext } from 'react';

/** Presentation only; positions, flight times and sensor reach retain their world units. */
export const ModelScale = createContext(1);
export const useModelScale = (): number => useContext(ModelScale);
