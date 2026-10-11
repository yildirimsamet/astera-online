import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  onError?: () => void;
}

interface State { failed: boolean }

/** A failed GLB must leave the galaxy usable. Key by look to retry a new asset. */
export class SkinAssetBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(): void {
    this.props.onError?.();
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
