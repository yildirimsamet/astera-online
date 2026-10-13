import { QueryClient } from '@tanstack/react-query';
import { shareStructure } from './structural.js';

/** The application's one query client and its defaults. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The server is the only authority; a failed read is worth one more try and
        // then a visible failure, never a silent stale render.
        retry: 1,
        refetchOnReconnect: true,
        /**
         * RETURNING TO THE TAB IS ONE PASS, OWNED BY THE EVENT STREAM. Resource analysis 2026-10-13.
         *
         * `useEventStream` re-reads every live payload after a hide long enough to
         * have missed something, a back-forward restore or a network return. Focus
         * refetch on top of it sent each read twice, and on its own it refetched on
         * every short app switch while the stream was still delivering. Screen-only
         * reads that are not part of that pass opt back in where they are declared.
         */
        refetchOnWindowFocus: false,
        /**
         * IDENTITY ACROSS A REFETCH, WHICH THE DEFAULT COULD NOT GIVE US.
         *
         * Every payload the disc draws from carries `Date` instants, and React
         * Query's own walker treats a Date as a leaf compared by reference — so a
         * refetch that read back exactly what it already held still produced brand
         * new arrays of brand new objects. Every memo below them re-ran, every
         * `BufferGeometry` built from one was rebuilt, and the camera re-framed
         * itself on data that had not moved.
         *
         * One clause fixes it for the whole client at once. See `api/structural.ts`.
         */
        structuralSharing: shareStructure,
      },
    },
  });
}
